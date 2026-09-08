/**
 * The shape of a weekly report (content_json) and a deterministic Markdown
 * renderer for it. The report page renders the same structure visually; this
 * Markdown is the copy-paste version you can drop straight into a doc or a
 * content brief.
 */
export interface RankedTheme {
  theme: string;
  calls: number;
  percent?: number;
  what_they_mean?: string;
  quotes?: string[];
  content_angle?: string;
}

export interface RankedQuestion {
  question: string;
  calls: number;
  percent?: number;
  example_phrasings?: string[];
  content_angle?: string;
}

export interface ICP {
  summary?: string;
  role?: string;
  industry?: string;
  stage?: string;
  goals?: string[];
  pains?: string[];
  fears?: string[];
  triggers?: string[];
  emotional_drivers?: string[];
  objections_they_carry?: string[];
  awareness_level?: string;
  budget_reality?: string;
  demographics?: string;
  how_they_talk?: string[];
}

export interface ContentIdea {
  idea: string;
  format?: string;
  hook?: string;
}

export interface VocReport {
  headline?: string;
  top_objections?: RankedTheme[];
  top_fears?: RankedTheme[];
  top_pain_points?: RankedTheme[];
  top_questions?: RankedQuestion[];
  ideal_client_profile?: ICP;
  secondary_avatars?: Array<{ label: string; summary: string }>;
  voc_language_bank?: string[];
  content_ideas?: ContentIdea[];
  standout_quotes?: string[];
}

export interface ReportMeta {
  title: string;
  period_start: string;
  period_end: string;
  calls_count: number;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function themeBlock(t: RankedTheme): string {
  const pct = t.percent != null ? ` (${t.percent}% of calls)` : "";
  let s = `**${t.theme}** - ${t.calls} call${t.calls === 1 ? "" : "s"}${pct}\n`;
  if (t.what_they_mean) s += `\n${t.what_they_mean}\n`;
  for (const q of t.quotes ?? []) s += `\n> ${q}`;
  if (t.content_angle) s += `\n\n_Content angle: ${t.content_angle}_`;
  return s + "\n";
}

export function reportMarkdown(r: VocReport, meta: ReportMeta): string {
  const lines: string[] = [];
  lines.push(`# ${meta.title}`);
  lines.push(`_${fmtDate(meta.period_start)} - ${fmtDate(meta.period_end)} · ${meta.calls_count} call${meta.calls_count === 1 ? "" : "s"} analyzed_`);
  if (r.headline) lines.push(`\n${r.headline}`);

  const section = (title: string, themes?: RankedTheme[]) => {
    if (!themes || !themes.length) return;
    lines.push(`\n## ${title}`);
    themes.forEach((t, i) => lines.push(`\n### ${i + 1}. ${themeBlock(t)}`));
  };
  section("Top objections", r.top_objections);
  section("Top fears", r.top_fears);
  section("Top pain points", r.top_pain_points);

  if (r.top_questions && r.top_questions.length) {
    lines.push(`\n## Most-asked questions`);
    r.top_questions.forEach((q, i) => {
      const pct = q.percent != null ? ` (${q.percent}%)` : "";
      lines.push(`\n**${i + 1}. ${q.question}** - ${q.calls} call${q.calls === 1 ? "" : "s"}${pct}`);
      for (const ex of q.example_phrasings ?? []) lines.push(`> ${ex}`);
      if (q.content_angle) lines.push(`_Content angle: ${q.content_angle}_`);
    });
  }

  const icp = r.ideal_client_profile;
  if (icp) {
    lines.push(`\n## Ideal client profile`);
    if (icp.summary) lines.push(`\n${icp.summary}`);
    const facts: Array<[string, string | undefined]> = [
      ["Role", icp.role],
      ["Industry", icp.industry],
      ["Stage", icp.stage],
      ["Awareness", icp.awareness_level],
      ["Budget reality", icp.budget_reality],
      ["Demographics", icp.demographics],
    ];
    const factLines = facts.filter(([, v]) => v).map(([k, v]) => `- **${k}:** ${v}`);
    if (factLines.length) lines.push("\n" + factLines.join("\n"));
    const list = (label: string, items?: string[]) => {
      if (items && items.length) lines.push(`\n**${label}**\n` + items.map((x) => `- ${x}`).join("\n"));
    };
    list("Goals", icp.goals);
    list("Pains", icp.pains);
    list("Fears", icp.fears);
    list("What triggers them to look", icp.triggers);
    list("Emotional drivers", icp.emotional_drivers);
    list("Objections they carry", icp.objections_they_carry);
    list("How they talk (use these words)", icp.how_they_talk);
  }

  if (r.secondary_avatars && r.secondary_avatars.length) {
    lines.push(`\n## Other profiles seen`);
    r.secondary_avatars.forEach((a) => lines.push(`\n- **${a.label}** - ${a.summary}`));
  }

  if (r.voc_language_bank && r.voc_language_bank.length) {
    lines.push(`\n## Voice-of-customer language bank`);
    lines.push(`_Their exact words - steal these for hooks, headlines, and ad copy._\n`);
    lines.push(r.voc_language_bank.map((x) => `- "${x}"`).join("\n"));
  }

  if (r.content_ideas && r.content_ideas.length) {
    lines.push(`\n## Content ideas from this week`);
    r.content_ideas.forEach((c, i) => {
      lines.push(`\n**${i + 1}. ${c.idea}**${c.format ? ` _(${c.format})_` : ""}`);
      if (c.hook) lines.push(`Hook: ${c.hook}`);
    });
  }

  if (r.standout_quotes && r.standout_quotes.length) {
    lines.push(`\n## Standout quotes`);
    r.standout_quotes.forEach((q) => lines.push(`\n> ${q}`));
  }

  return lines.join("\n") + "\n";
}
