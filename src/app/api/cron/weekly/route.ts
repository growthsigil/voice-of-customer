/**
 * Weekly compile - builds the voice-of-customer report for the trailing 7 days.
 * Scheduled by vercel.json (Mondays 08:00 UTC).
 *
 *   GET /api/cron/weekly   (Authorization: Bearer <CRON_SECRET>)
 */
import { NextRequest, NextResponse } from "next/server";
import { runWeekly } from "@/lib/compile";
import { reportUrl } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const report = await runWeekly();
  if (!report) return NextResponse.json({ ok: true, report: null, note: "no analyzed calls in the last 7 days" });
  return NextResponse.json({ ok: true, report_id: report.id, calls: report.calls_count, url: reportUrl(report.id) });
}
