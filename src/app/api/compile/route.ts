/**
 * Manual "compile now" — build a report on demand. Defaults to the last 7 days;
 * pass ?days=N or ?start=YYYY-MM-DD&end=YYYY-MM-DD for a custom window.
 *
 *   GET|POST /api/compile?key=<CRON_SECRET>&days=30
 */
import { NextRequest, NextResponse } from "next/server";
import { compileWindow } from "@/lib/compile";
import { reportUrl } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
  const key = new URL(req.url).searchParams.get("key") === secret;
  return bearer || key;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  const params = new URL(req.url).searchParams;

  let start: Date;
  let end: Date;
  const startParam = params.get("start");
  const endParam = params.get("end");
  if (startParam && endParam) {
    start = new Date(`${startParam}T00:00:00Z`);
    end = new Date(`${endParam}T23:59:59Z`);
  } else {
    const days = Math.max(1, Math.min(365, Number(params.get("days") || 7)));
    end = new Date();
    start = new Date(end.getTime() - days * 24 * 3600_000);
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ ok: false, reason: "bad_dates" }, { status: 400 });
  }

  const report = await compileWindow({
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    periodStart: ymd(start),
    periodEnd: ymd(end),
  });
  if (!report) return NextResponse.json({ ok: true, report: null, note: "no analyzed calls in that window" });
  return NextResponse.json({ ok: true, report_id: report.id, calls: report.calls_count, url: reportUrl(report.id) });
}

export const GET = handle;
export const POST = handle;
