/**
 * Parse a Fathom webhook payload into our shape. Fathom's exact fields vary by
 * plan and by how the webhook is configured, so this reads the common field
 * names and falls back gracefully. The one thing that matters is getting the
 * transcript text out — configure the Fathom webhook to include the transcript.
 */
export interface ParsedCall {
  external_id: string | null;
  title: string | null;
  call_date: string | null;
  attendees: Array<{ name?: string; email?: string }>;
  duration_minutes: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** First non-null string among several dotted paths (e.g. "meeting.title"). */
function pick(body: Obj, paths: string[]): string | null {
  for (const path of paths) {
    let cur: unknown = body;
    for (const seg of path.split(".")) {
      cur = isObj(cur) ? cur[seg] : undefined;
    }
    const s = str(cur);
    if (s) return s;
  }
  return null;
}

function firstArray(body: Obj, paths: string[]): unknown[] | null {
  for (const path of paths) {
    let cur: unknown = body;
    for (const seg of path.split(".")) cur = isObj(cur) ? cur[seg] : undefined;
    if (Array.isArray(cur)) return cur;
  }
  return null;
}

/** Turn a transcript into plain "Speaker: text" lines, whatever shape it's in. */
function extractTranscript(body: Obj): string | null {
  const direct = pick(body, [
    "transcript_plaintext",
    "plaintext_transcript",
    "transcript.plaintext",
    "transcript.text",
    "transcript",
    "transcript_markdown",
  ]);
  if (direct) return direct;

  const segments =
    firstArray(body, ["transcript.segments", "transcript_segments", "segments", "transcript.entries"]) ?? null;
  if (segments && segments.length) {
    const lines = segments
      .map((s) => {
        if (!isObj(s)) return null;
        const speaker = str(s.speaker) || str((s.speaker as Obj)?.name) || str(s.speaker_name) || str(s.name) || "";
        const text = str(s.text) || str(s.content) || str(s.words) || "";
        if (!text) return null;
        return speaker ? `${speaker}: ${text}` : text;
      })
      .filter(Boolean);
    if (lines.length) return lines.join("\n");
  }
  return null;
}

function extractAttendees(body: Obj): Array<{ name?: string; email?: string }> {
  const arr = firstArray(body, ["invitees", "attendees", "meeting.invitees", "participants", "meeting.attendees"]) ?? [];
  return arr
    .map((a) => {
      if (typeof a === "string") return { name: a };
      if (isObj(a)) return { name: str(a.name) ?? undefined, email: str(a.email) ?? undefined };
      return null;
    })
    .filter((a): a is { name?: string; email?: string } => !!a && (!!a.name || !!a.email));
}

export function parseFathomPayload(body: Obj): ParsedCall {
  const durationRaw = pick(body, [
    "recording_duration_in_minutes",
    "duration_minutes",
    "duration",
    "meeting.duration_minutes",
  ]);
  const durationNum = durationRaw ? Number(durationRaw) : NaN;

  return {
    external_id: pick(body, ["recording_id", "meeting_id", "id", "external_id", "recording.id", "meeting.id"]),
    title: pick(body, ["title", "meeting_title", "topic", "meeting.title", "recording.title", "name"]),
    call_date: pick(body, [
      "recording_start_time",
      "started_at",
      "start_time",
      "date",
      "meeting.scheduled_start_time",
      "meeting.started_at",
      "created_at",
    ]),
    attendees: extractAttendees(body),
    duration_minutes: Number.isFinite(durationNum) ? Math.round(durationNum) : null,
    recording_url: pick(body, ["recording_url", "share_url", "recording_share_url", "url", "recording.url", "recording.share_url"]),
    transcript: extractTranscript(body),
    summary: pick(body, ["summary", "ai_summary", "summary_markdown", "default_summary", "meeting.summary", "notes"]),
  };
}
