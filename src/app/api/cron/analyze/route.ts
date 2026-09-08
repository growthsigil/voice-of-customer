/**
 * Analyze sweep - a safety net that picks up any call that has a transcript but
 * wasn't analyzed yet (or failed). Normal calls analyze on intake; this catches
 * retries and backfilled transcripts.
 *
 *   GET /api/cron/analyze   (Authorization: Bearer <CRON_SECRET>)
 */
import { NextRequest, NextResponse } from "next/server";
import { callsNeedingAnalysis } from "@/lib/supabase";
import { analyzeCalls } from "@/lib/analyze";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const calls = await callsNeedingAnalysis(10);
  const result = await analyzeCalls(calls);
  return NextResponse.json({ ok: true, picked: calls.length, ...result });
}
