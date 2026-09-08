/**
 * Per-call analysis. Reads one call's transcript and pulls out the prospect's
 * objections, fears, pain points, questions, buying signals, avatar signals,
 * notable quotes, and the exact language they used. Saves it to call_insights.
 */
import { ANALYSIS_MODEL, generateJSON } from "./anthropic";
import { type Call, getCall, saveInsight, markCall, logEvent } from "./supabase";

const MAX_TRANSCRIPT_CHARS = 60_000; // generous; a long call still fits

interface Analysis {
  objections: Array<{ label: string; concern?: string; quote?: string }>;
  fears: Array<{ label: string; quote?: string }>;
  pain_points: Array<{ label: string; quote?: string }>;
  questions: Array<{ question: string; quote?: string }>;
  avatar: Record<string, unknown>;
  buying_signals: Array<{ label: string; quote?: string }>;
  notable_quotes: string[];
  voc_language: string[];
}

function systemPrompt(): string {
  const ctx = (process.env.VOC_BUSINESS_CONTEXT || "").slice(0, 1500);
  return `You analyze one recorded SALES CALL and extract structured "voice of customer" intel about the PROSPECT (the potential buyer) - never about the salesperson.

${ctx ? `BUSINESS CONTEXT (so you understand the offer and who's selling):\n${ctx}\n\n` : ""}RULES:
- Extract ONLY what the PROSPECT actually said or clearly implied. Ignore the rep's pitch.
- Keep the prospect's own words in every "quote" - verbatim, trimmed to the essential line.
- If something isn't present, use an empty array (or empty string) - never invent.
- "label" fields are short, canonical, reusable (e.g. "Price / can't justify cost", "Tried before and failed", "No time to implement") so similar items across calls can be grouped later.
- questions = things the prospect asked, cleaned into a clear question.
- avatar = who this person is, from evidence in the call only.

Output ONLY a JSON object of this exact shape (no prose, no markdown):
{
  "objections":   [{"label": "", "concern": "", "quote": ""}],
  "fears":        [{"label": "", "quote": ""}],
  "pain_points":  [{"label": "", "quote": ""}],
  "questions":    [{"question": "", "quote": ""}],
  "avatar": {
    "role": "", "industry": "", "business_stage": "",
    "goals": [], "current_situation": "",
    "triggers": [], "emotional_drivers": [],
    "budget_signal": "", "awareness_level": "", "demographics": ""
  },
  "buying_signals": [{"label": "", "quote": ""}],
  "notable_quotes": [],
  "voc_language": []
}`;
}

/** Analyze one call by id. Returns true on success. */
export async function analyzeCall(callId: string): Promise<boolean> {
  const call = await getCall(callId);
  if (!call) return false;
  if (!call.transcript || !call.transcript.trim()) {
    await markCall(call.id, { status: "skipped", error: "no transcript" });
    return false;
  }
  try {
    const transcript = call.transcript.slice(0, MAX_TRANSCRIPT_CHARS);
    const user = `CALL: ${call.title || "(untitled)"}${call.call_date ? ` - ${call.call_date}` : ""}\n\nTRANSCRIPT:\n${transcript}`;
    const a = await generateJSON<Analysis>({ model: ANALYSIS_MODEL, system: systemPrompt(), user, maxTokens: 3000 });

    await saveInsight({
      call_id: call.id,
      objections: a.objections ?? [],
      fears: a.fears ?? [],
      pain_points: a.pain_points ?? [],
      questions: a.questions ?? [],
      avatar: a.avatar ?? {},
      buying_signals: a.buying_signals ?? [],
      notable_quotes: a.notable_quotes ?? [],
      voc_language: a.voc_language ?? [],
      model_used: ANALYSIS_MODEL,
    });
    await markCall(call.id, { status: "analyzed", analyzed_at: new Date().toISOString(), error: null });
    await logEvent("call_analyzed", { call_id: call.id });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze] failed for call", callId, msg);
    await markCall(call.id, { status: "failed", error: msg.slice(0, 500) });
    await logEvent("call_analysis_failed", { call_id: callId, error: msg.slice(0, 300) });
    return false;
  }
}

/** Analyze a batch (used by the sweep). */
export async function analyzeCalls(calls: Call[]): Promise<{ analyzed: number; failed: number }> {
  let analyzed = 0;
  let failed = 0;
  for (const c of calls) {
    const ok = await analyzeCall(c.id);
    if (ok) analyzed++;
    else failed++;
  }
  return { analyzed, failed };
}
