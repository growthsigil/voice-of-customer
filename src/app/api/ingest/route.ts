/**
 * Manual ingest — paste or POST a transcript in. Great for backfilling old calls
 * or testing without wiring up Fathom.
 *
 *   POST /api/ingest      (Authorization: Bearer <CRON_SECRET>  or  ?key=<CRON_SECRET>)
 *   body: { "title": "...", "transcript": "...", "call_date": "2026-01-01", "external_id": "optional" }
 *   (a raw Fathom-shaped payload is also accepted)
 */
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { parseFathomPayload } from "@/lib/fathom";
import { upsertCall, logEvent } from "@/lib/supabase";
import { analyzeCall } from "@/lib/analyze";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
  const key = new URL(req.url).searchParams.get("key") === secret;
  return bearer || key;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  // Accept our simple shape directly, and fall back to the Fathom parser.
  const parsed = parseFathomPayload(body);
  const transcript = (typeof body.transcript === "string" && body.transcript.trim()) ? body.transcript : parsed.transcript;
  if (!transcript || !transcript.trim()) {
    return NextResponse.json({ ok: false, reason: "no_transcript" }, { status: 400 });
  }

  const { call, created } = await upsertCall({
    external_id: (typeof body.external_id === "string" && body.external_id) || parsed.external_id,
    source: "manual",
    title: (typeof body.title === "string" && body.title) || parsed.title,
    call_date: (typeof body.call_date === "string" && body.call_date) || parsed.call_date,
    attendees: parsed.attendees,
    duration_minutes: parsed.duration_minutes,
    recording_url: parsed.recording_url,
    transcript,
    summary: parsed.summary,
    raw: body,
  });
  if (!created) return NextResponse.json({ ok: true, duplicate: true, call_id: call.id });

  await logEvent("call_received", { call_id: call.id, source: "manual" });
  waitUntil(analyzeCall(call.id).then(() => {}));
  return NextResponse.json({ ok: true, call_id: call.id });
}
