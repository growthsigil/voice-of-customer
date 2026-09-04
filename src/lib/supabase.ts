/**
 * Supabase client (service role) + typed helpers. Service role bypasses RLS, so
 * this only ever runs on the server.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
}
export const supabase = createClient(url ?? "", serviceKey ?? "", { auth: { persistSession: false } });

export type Call = {
  id: string;
  external_id: string | null;
  source: string;
  title: string | null;
  call_date: string | null;
  attendees: unknown;
  duration_minutes: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  raw: unknown;
  status: "received" | "analyzed" | "failed" | "skipped";
  analyzed_at: string | null;
  error: string | null;
  created_at: string;
};

export type CallInsight = {
  id: string;
  call_id: string;
  objections: unknown[];
  fears: unknown[];
  pain_points: unknown[];
  questions: unknown[];
  avatar: Record<string, unknown>;
  buying_signals: unknown[];
  notable_quotes: unknown[];
  voc_language: unknown[];
  model_used: string | null;
  created_at: string;
};

export type Report = {
  id: string;
  period_start: string;
  period_end: string;
  calls_count: number;
  title: string | null;
  content_json: Record<string, unknown>;
  content_md: string | null;
  status: string;
  model_used: string | null;
  created_at: string;
};

export async function logEvent(event_type: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await supabase.from("events").insert({ event_type, metadata });
}

/** Insert a call, deduped on external_id. Returns the row (new or existing) and
 *  whether it was freshly created. */
export async function upsertCall(row: {
  external_id: string | null;
  source?: string;
  title?: string | null;
  call_date?: string | null;
  attendees?: unknown;
  duration_minutes?: number | null;
  recording_url?: string | null;
  transcript?: string | null;
  summary?: string | null;
  raw?: unknown;
}): Promise<{ call: Call; created: boolean }> {
  if (row.external_id) {
    const { data: existing } = await supabase.from("calls").select("*").eq("external_id", row.external_id).maybeSingle();
    if (existing) return { call: existing as Call, created: false };
  }
  const { data, error } = await supabase
    .from("calls")
    .insert({
      external_id: row.external_id,
      source: row.source ?? "fathom",
      title: row.title ?? null,
      call_date: row.call_date ?? null,
      attendees: row.attendees ?? [],
      duration_minutes: row.duration_minutes ?? null,
      recording_url: row.recording_url ?? null,
      transcript: row.transcript ?? null,
      summary: row.summary ?? null,
      raw: row.raw ?? null,
      status: "received",
    })
    .select("*")
    .single();
  if (error) throw error;
  return { call: data as Call, created: true };
}

export async function getCall(id: string): Promise<Call | null> {
  const { data } = await supabase.from("calls").select("*").eq("id", id).maybeSingle();
  return (data as Call | null) ?? null;
}

/** Calls that have a transcript but haven't been analyzed yet (or failed). */
export async function callsNeedingAnalysis(limit = 20): Promise<Call[]> {
  const { data } = await supabase
    .from("calls")
    .select("*")
    .in("status", ["received", "failed"])
    .not("transcript", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data as Call[] | null) ?? [];
}

export async function markCall(id: string, patch: Partial<Pick<Call, "status" | "analyzed_at" | "error">>): Promise<void> {
  await supabase.from("calls").update(patch).eq("id", id);
}

export async function saveInsight(insight: {
  call_id: string;
  objections: unknown[];
  fears: unknown[];
  pain_points: unknown[];
  questions: unknown[];
  avatar: Record<string, unknown>;
  buying_signals: unknown[];
  notable_quotes: unknown[];
  voc_language: unknown[];
  model_used: string;
}): Promise<void> {
  await supabase.from("call_insights").upsert(insight, { onConflict: "call_id" });
}

/** Calls (+ their insights) whose call_date falls in [start, end). Falls back to
 *  created_at when a call has no call_date. */
export async function analyzedCallsInWindow(startIso: string, endIso: string): Promise<Array<Call & { insight: CallInsight | null }>> {
  const { data } = await supabase
    .from("calls")
    .select("*, call_insights(*)")
    .eq("status", "analyzed")
    .or(`and(call_date.gte.${startIso},call_date.lt.${endIso}),and(call_date.is.null,created_at.gte.${startIso},created_at.lt.${endIso})`)
    .order("call_date", { ascending: true });
  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as Call & { call_insights: CallInsight[] };
    const insight = (row.call_insights ?? [])[0] ?? null;
    const { call_insights: _drop, ...call } = row;
    return { ...(call as Call), insight };
  });
}

export async function createReport(row: {
  period_start: string;
  period_end: string;
  calls_count: number;
  title: string;
  content_json: Record<string, unknown>;
  content_md: string;
  status: string;
  model_used: string;
}): Promise<Report> {
  const { data, error } = await supabase.from("reports").insert(row).select("*").single();
  if (error) throw error;
  return data as Report;
}

export async function getReport(id: string): Promise<Report | null> {
  const { data } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
  return (data as Report | null) ?? null;
}

export async function listReports(limit = 30): Promise<Report[]> {
  const { data } = await supabase.from("reports").select("id, period_start, period_end, calls_count, title, status, created_at").order("created_at", { ascending: false }).limit(limit);
  return (data as Report[] | null) ?? [];
}

export async function latestReport(): Promise<Report | null> {
  const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as Report | null) ?? null;
}
