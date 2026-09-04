/**
 * The weekly compile. Gathers every analyzed call in a time window, clusters and
 * counts the objections / fears / pains / questions across calls, derives the
 * most common ideal-client profile, and writes it up as a report (structured
 * JSON + Markdown) ready for content.
 */
import { REPORT_MODEL, generateJSON } from "./anthropic";
import { reportMarkdown, type VocReport } from "./report-format";
import { analyzedCallsInWindow, createReport, logEvent, type Report } from "./supabase";
import { sendTelegram, reportUrl } from "./notify";

const trim = (s: unknown, n = 180): string => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** Compact a call's insights down to what the compiler needs (keeps token
 *  cost sane on a big week). */
function compactCall(c: { call_date: string | null; insight: Record<string, unknown> | null }): unknown {
  const ins = (c.insight ?? {}) as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(ins[k]) ? (ins[k] as Record<string, unknown>[]) : []);
  return {
    date: c.call_date,
    objections: arr("objections").map((o) => ({ label: trim(o.label, 80), concern: trim(o.concern, 120), quote: trim(o.quote) })),
    fears: arr("fears").map((o) => ({ label: trim(o.label, 80), quote: trim(o.quote) })),
    pain_points: arr("pain_points").map((o) => ({ label: trim(o.label, 80), quote: trim(o.quote) })),
    questions: arr("questions").map((o) => ({ question: trim(o.question, 160), quote: trim(o.quote) })),
    avatar: ins.avatar ?? {},
    buying_signals: arr("buying_signals").map((o) => ({ label: trim(o.label, 80), quote: trim(o.quote) })),
    voc_language: (Array.isArray(ins.voc_language) ? ins.voc_language : []).slice(0, 12).map((x) => trim(x)),
    notable_quotes: (Array.isArray(ins.notable_quotes) ? ins.notable_quotes : []).slice(0, 6).map((x) => trim(x)),
  };
}

function systemPrompt(total: number): string {
  const ctx = (process.env.VOC_BUSINESS_CONTEXT || "").slice(0, 1500);
  return `You compile a weekly VOICE OF CUSTOMER report from structured notes taken on ${total} sales call${total === 1 ? "" : "s"} this week. You write for a marketer who will turn this into content, so be concrete and specific and use the prospects' OWN words.

${ctx ? `BUSINESS CONTEXT:\n${ctx}\n\n` : ""}METHOD:
- Cluster similar items across calls (synonyms and paraphrases = the SAME theme).
- For each theme, count how many DISTINCT calls it appears in, and rank by that count.
- Every quote must be a real line from the notes. Never invent a number or a quote.
- The ideal client profile is the single MOST COMMON avatar across the calls — make it vivid and specific, grounded in the notes.

Output ONLY a JSON object of exactly this shape (no prose, no markdown):
{
  "headline": "one or two sentences: the biggest pattern this week",
  "top_objections":  [{"theme":"", "calls":0, "percent":0, "what_they_mean":"", "quotes":[""], "content_angle":""}],
  "top_fears":       [{"theme":"", "calls":0, "percent":0, "what_they_mean":"", "quotes":[""]}],
  "top_pain_points": [{"theme":"", "calls":0, "percent":0, "what_they_mean":"", "quotes":[""]}],
  "top_questions":   [{"question":"", "calls":0, "percent":0, "example_phrasings":[""], "content_angle":""}],
  "ideal_client_profile": {
    "summary":"", "role":"", "industry":"", "stage":"", "awareness_level":"", "budget_reality":"", "demographics":"",
    "goals":[], "pains":[], "fears":[], "triggers":[], "emotional_drivers":[], "objections_they_carry":[], "how_they_talk":[]
  },
  "secondary_avatars": [{"label":"", "summary":""}],
  "voc_language_bank": ["exact phrases to reuse in copy"],
  "content_ideas": [{"idea":"", "format":"reel | email | carousel | video | post", "hook":"a scroll-stopping opener in the prospect's own voice"}],
  "standout_quotes": [""]
}

RULES: percent = round(calls / ${total} * 100). Give 3-7 items per ranked section (fewer only if the data is thin). 5-8 content_ideas, each tied to a real objection, pain, or question. Omit a section's items array only if there is genuinely nothing.`;
}

/** Compile a report for [startIso, endIso). Returns the report, or null when
 *  there were no analyzed calls in the window. */
export async function compileWindow(params: {
  startIso: string;
  endIso: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  title?: string;
}): Promise<Report | null> {
  const calls = await analyzedCallsInWindow(params.startIso, params.endIso);
  if (!calls.length) {
    await logEvent("weekly_skipped_no_calls", { period_start: params.periodStart, period_end: params.periodEnd });
    return null;
  }

  const total = calls.length;
  const compact = calls.map((c) => compactCall({ call_date: c.call_date, insight: (c.insight as unknown as Record<string, unknown>) ?? null }));
  const user = `TOTAL CALLS: ${total}\n\nPER-CALL NOTES (JSON):\n${JSON.stringify(compact)}`;

  const json = await generateJSON<VocReport>({ model: REPORT_MODEL, system: systemPrompt(total), user, maxTokens: 9000 });

  const title = params.title || `Voice of Customer — week of ${params.periodStart}`;
  const md = reportMarkdown(json, { title, period_start: params.periodStart, period_end: params.periodEnd, calls_count: total });

  const report = await createReport({
    period_start: params.periodStart,
    period_end: params.periodEnd,
    calls_count: total,
    title,
    content_json: json as unknown as Record<string, unknown>,
    content_md: md,
    status: "ready",
    model_used: REPORT_MODEL,
  });

  await logEvent("weekly_report_ready", { report_id: report.id, calls: total });
  const link = reportUrl(report.id);
  await sendTelegram(`📊 Voice of Customer — new weekly report (${total} call${total === 1 ? "" : "s"}).${link ? `\n${link}` : ""}`);
  return report;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The scheduled weekly run: compile the trailing 7 days. */
export async function runWeekly(): Promise<Report | null> {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 3600_000);
  return compileWindow({
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    periodStart: ymd(start),
    periodEnd: ymd(end),
  });
}
