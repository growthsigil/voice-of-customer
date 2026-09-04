/**
 * Fathom intake webhook.
 *
 * Point your Fathom webhook (or a small automation) at:
 *   POST  https://<your-app>/api/webhook/fathom?secret=<FATHOM_WEBHOOK_SECRET>
 * (or send the secret as an `x-webhook-secret` header). Configure it to include
 * the transcript. Each call is stored and analyzed automatically.
 */
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { parseFathomPayload } from "@/lib/fathom";
import { upsertCall, logEvent } from "@/lib/supabase";
import { analyzeCall } from "@/lib/analyze";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const expected = process.env.FATHOM_WEBHOOK_SECRET;
  if (!expected) return true; // no secret configured → open (not recommended)
  const header = req.headers.get("x-webhook-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return header === expected || query === expected;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const parsed = parseFathomPayload(body);
  try {
    const { call, created } = await upsertCall({
      external_id: parsed.external_id,
      source: "fathom",
      title: parsed.title,
      call_date: parsed.call_date,
      attendees: parsed.attendees,
      duration_minutes: parsed.duration_minutes,
      recording_url: parsed.recording_url,
      transcript: parsed.transcript,
      summary: parsed.summary,
      raw: body,
    });

    if (!created) return NextResponse.json({ ok: true, duplicate: true, call_id: call.id });

    await logEvent("call_received", { call_id: call.id, has_transcript: !!parsed.transcript, title: parsed.title });

    // Analyze in the background if we got a transcript; otherwise it waits for
    // the analyze sweep (and you can add a transcript later).
    if (parsed.transcript && parsed.transcript.trim()) {
      waitUntil(analyzeCall(call.id).then(() => {}));
    }
    return NextResponse.json({ ok: true, call_id: call.id, analyzing: !!parsed.transcript });
  } catch (err) {
    console.error("[fathom] intake failed:", err);
    return NextResponse.json({ ok: false, reason: "store_failed" }, { status: 500 });
  }
}
