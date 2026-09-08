import Link from "next/link";
import { listReports } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function ReportsPage() {
  const reports = await listReports(50);
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 72px" }}>
      <Link href="/" style={{ color: "#b0561f", textDecoration: "none", fontSize: 13 }}>← Dashboard</Link>
      <h1 style={{ fontSize: 26, margin: "12px 0 20px", letterSpacing: "-0.02em" }}>Weekly reports</h1>
      {reports.length === 0 ? (
        <p style={{ color: "#6b6b6b" }}>No reports yet. They compile weekly, or run one now via <code>/api/compile</code>.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              style={{ textDecoration: "none", color: "#1a1a1a", background: "#fff", border: "1px solid #e6e6e6", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{r.title || `Week of ${fmt(r.period_start)}`}</div>
                <div style={{ color: "#8a8a8a", fontSize: 12.5, marginTop: 2 }}>
                  {fmt(r.period_start)} - {fmt(r.period_end)} · {r.calls_count} call{r.calls_count === 1 ? "" : "s"}
                </div>
              </div>
              <span style={{ color: "#b0561f", fontSize: 13 }}>Open →</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
