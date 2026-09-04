import Link from "next/link";
import { getReport } from "@/lib/supabase";
import type { VocReport } from "@/lib/report-format";
import ReportView from "./report-view";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "60px 20px" }}>
        <Link href="/reports" style={{ color: "#b0561f", textDecoration: "none", fontSize: 13 }}>← All reports</Link>
        <h1 style={{ fontSize: 24, marginTop: 16 }}>Report not found</h1>
      </main>
    );
  }

  return (
    <ReportView
      report={report.content_json as VocReport}
      markdown={report.content_md ?? ""}
      meta={{
        title: report.title || `Week of ${report.period_start}`,
        period_start: report.period_start,
        period_end: report.period_end,
        calls_count: report.calls_count,
      }}
    />
  );
}
