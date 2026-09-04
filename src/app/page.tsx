/**
 * Dashboard — a quick pulse: how many calls are in, how many analyzed, and a
 * link to the latest weekly report. Server component; reads Supabase directly.
 */
import Link from "next/link";
import { supabase, latestReport } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e6e6e6", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ color: "#6b6b6b", fontSize: 13, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default async function Home() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const head = { count: "exact" as const, head: true };
  const [totalRes, analyzedRes, weekRes, report] = await Promise.all([
    supabase.from("calls").select("id", head),
    supabase.from("calls").select("id", head).eq("status", "analyzed"),
    supabase.from("calls").select("id", head).gte("created_at", weekAgo),
    latestReport(),
  ]);
  const total = totalRes.count ?? 0;
  const analyzed = analyzedRes.count ?? 0;
  const week = weekRes.count ?? 0;

  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasFathom = !!process.env.FATHOM_WEBHOOK_SECRET;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "52px 20px 72px" }}>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "#b0561f" }}>
        Voice of Customer
      </div>
      <h1 style={{ fontSize: 30, lineHeight: 1.1, margin: "10px 0 8px", letterSpacing: "-0.02em" }}>
        What your prospects actually say — every week.
      </h1>
      <p style={{ color: "#6b6b6b", fontSize: 15, lineHeight: 1.55, margin: "0 0 26px", maxWidth: "60ch" }}>
        Your Fathom calls flow in here, get read for objections, fears, pain points, questions and who
        the person is, and once a week it&apos;s compiled into a report you can hand straight to content.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <Stat label="calls collected" value={total} />
        <Stat label="analyzed" value={analyzed} />
        <Stat label="in last 7 days" value={week} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 30 }}>
        {report ? (
          <Link href={`/reports/${report.id}`} style={{ textDecoration: "none", background: "#1a1a1a", color: "#fff", padding: "12px 18px", borderRadius: 10, fontWeight: 600, fontSize: 14 }}>
            Read the latest report →
          </Link>
        ) : (
          <span style={{ color: "#6b6b6b", fontSize: 14 }}>
            No report yet — it compiles weekly (or run one now via <code>/api/compile</code>).
          </span>
        )}
        <Link href="/reports" style={{ textDecoration: "none", background: "#fff", border: "1px solid #e6e6e6", color: "#1a1a1a", padding: "12px 18px", borderRadius: 10, fontWeight: 600, fontSize: 14 }}>
          All reports
        </Link>
      </div>

      <div style={{ borderTop: "1px solid #ececec", paddingTop: 18, color: "#8a8a8a", fontSize: 12.5, lineHeight: 1.7 }}>
        <b style={{ color: "#6b6b6b" }}>Setup:</b> Supabase {hasSupabase ? "✓" : "✗"} · Claude key{" "}
        {hasAnthropic ? "✓" : "✗"} · Fathom secret {hasFathom ? "✓" : "✗"}. Send calls to{" "}
        <code>/api/webhook/fathom</code>. See the README to finish setup.
      </div>
    </main>
  );
}
