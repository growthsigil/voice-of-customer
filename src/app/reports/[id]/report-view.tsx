"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { VocReport, RankedTheme, RankedQuestion } from "@/lib/report-format";

interface Meta {
  title: string;
  period_start: string;
  period_end: string;
  calls_count: number;
}

function fmt(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function Quote({ children }: { children: string }) {
  return (
    <blockquote style={{ margin: "8px 0 0", padding: "6px 12px", borderLeft: "3px solid #e0b48a", background: "#faf4ec", color: "#4a4137", fontSize: 13.5, lineHeight: 1.5, borderRadius: "0 6px 6px 0" }}>
      &ldquo;{children}&rdquo;
    </blockquote>
  );
}

function Bar({ percent }: { percent?: number }) {
  if (percent == null) return null;
  return (
    <div style={{ height: 6, background: "#eee", borderRadius: 4, overflow: "hidden", marginTop: 8 }}>
      <div style={{ width: `${Math.max(3, Math.min(100, percent))}%`, height: "100%", background: "#b0561f" }} />
    </div>
  );
}

function ThemeCard({ t, n }: { t: RankedTheme; n: number }) {
  return (
    <div className="voc-card" style={{ background: "#fff", border: "1px solid #ececec", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div style={{ fontWeight: 700, fontSize: 15.5 }}>{n}. {t.theme}</div>
        <div style={{ color: "#8a8a8a", fontSize: 12.5, whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace" }}>
          {t.calls} call{t.calls === 1 ? "" : "s"}{t.percent != null ? ` · ${t.percent}%` : ""}
        </div>
      </div>
      <Bar percent={t.percent} />
      {t.what_they_mean && <p style={{ margin: "10px 0 0", color: "#4a4a4a", fontSize: 14, lineHeight: 1.55 }}>{t.what_they_mean}</p>}
      {(t.quotes ?? []).map((q, i) => <Quote key={i}>{q}</Quote>)}
      {t.content_angle && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#b0561f", background: "#fbf1e9", padding: "8px 10px", borderRadius: 8 }}>
          <b>Content angle:</b> {t.content_angle}
        </p>
      )}
    </div>
  );
}

function QuestionCard({ q, n }: { q: RankedQuestion; n: number }) {
  return (
    <div className="voc-card" style={{ background: "#fff", border: "1px solid #ececec", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{n}. {q.question}</div>
        <div style={{ color: "#8a8a8a", fontSize: 12.5, whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace" }}>
          {q.calls} call{q.calls === 1 ? "" : "s"}{q.percent != null ? ` · ${q.percent}%` : ""}
        </div>
      </div>
      {(q.example_phrasings ?? []).map((e, i) => <Quote key={i}>{e}</Quote>)}
      {q.content_angle && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#b0561f", background: "#fbf1e9", padding: "8px 10px", borderRadius: 8 }}>
          <b>Content angle:</b> {q.content_angle}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="voc-section" style={{ marginTop: 34 }}>
      <h2 style={{ fontSize: 19, letterSpacing: "-0.01em", margin: "0 0 14px", paddingBottom: 8, borderBottom: "2px solid #f0e6da" }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}

function Chips({ items }: { items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((x, i) => (
        <span key={i} style={{ background: "#f3ede4", color: "#5a4d3d", fontSize: 13, padding: "5px 11px", borderRadius: 100 }}>{x}</span>
      ))}
    </div>
  );
}

function List({ label, items }: { label: string; items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>{label}</div>
      <ul style={{ margin: 0, paddingLeft: 18, color: "#4a4a4a", fontSize: 14, lineHeight: 1.6 }}>
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

export default function ReportView({ report, meta, markdown }: { report: VocReport; meta: Meta; markdown: string }) {
  const [copied, setCopied] = useState(false);
  const icp = report.ideal_client_profile;

  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const btn: CSSProperties = { cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 9, border: "1px solid #e0d5c6", background: "#fff", color: "#1a1a1a" };

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px 80px" }}>
      <style>{`
        @media print {
          .voc-noprint { display: none !important; }
          .voc-card, .voc-section { break-inside: avoid; }
          body { background: #fff !important; }
        }
        @page { margin: 18mm; }
      `}</style>

      <div className="voc-noprint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <a href="/reports" style={{ color: "#b0561f", textDecoration: "none", fontSize: 13 }}>← All reports</a>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn} onClick={copyMd}>{copied ? "Copied ✓" : "Copy Markdown"}</button>
          <button style={{ ...btn, background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a" }} onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      <header>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#b0561f" }}>Voice of Customer</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.1, margin: "8px 0 6px", letterSpacing: "-0.02em" }}>{meta.title}</h1>
        <div style={{ color: "#8a8a8a", fontSize: 13.5 }}>
          {fmt(meta.period_start)} – {fmt(meta.period_end)} · {meta.calls_count} call{meta.calls_count === 1 ? "" : "s"} analyzed
        </div>
        {report.headline && <p style={{ fontSize: 16.5, lineHeight: 1.55, color: "#2a2a2a", marginTop: 16 }}>{report.headline}</p>}
      </header>

      {report.top_objections?.length ? <Section title="Top objections">{report.top_objections.map((t, i) => <ThemeCard key={i} t={t} n={i + 1} />)}</Section> : null}
      {report.top_fears?.length ? <Section title="Top fears">{report.top_fears.map((t, i) => <ThemeCard key={i} t={t} n={i + 1} />)}</Section> : null}
      {report.top_pain_points?.length ? <Section title="Top pain points">{report.top_pain_points.map((t, i) => <ThemeCard key={i} t={t} n={i + 1} />)}</Section> : null}
      {report.top_questions?.length ? <Section title="Most-asked questions">{report.top_questions.map((q, i) => <QuestionCard key={i} q={q} n={i + 1} />)}</Section> : null}

      {icp && (
        <Section title="Ideal client profile">
          <div className="voc-card" style={{ background: "#fff", border: "1px solid #ececec", borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {icp.summary && <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "#2a2a2a" }}>{icp.summary}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[["Role", icp.role], ["Industry", icp.industry], ["Stage", icp.stage], ["Awareness", icp.awareness_level], ["Budget", icp.budget_reality], ["Demographics", icp.demographics]]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span key={k as string} style={{ fontSize: 13, background: "#f7f2ea", border: "1px solid #eee2d3", borderRadius: 8, padding: "5px 10px" }}>
                    <b style={{ color: "#8a6a45" }}>{k}:</b> {v as string}
                  </span>
                ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <List label="Goals" items={icp.goals} />
              <List label="Pains" items={icp.pains} />
              <List label="Fears" items={icp.fears} />
              <List label="What triggers them" items={icp.triggers} />
              <List label="Emotional drivers" items={icp.emotional_drivers} />
              <List label="Objections they carry" items={icp.objections_they_carry} />
            </div>
            {icp.how_they_talk?.length ? (
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>How they talk (use these words)</div>
                <Chips items={icp.how_they_talk} />
              </div>
            ) : null}
          </div>
          {report.secondary_avatars?.length ? (
            <div className="voc-card" style={{ background: "#fff", border: "1px solid #ececec", borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Other profiles seen</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#4a4a4a", fontSize: 14, lineHeight: 1.6 }}>
                {report.secondary_avatars.map((a, i) => <li key={i}><b>{a.label}</b> — {a.summary}</li>)}
              </ul>
            </div>
          ) : null}
        </Section>
      )}

      {report.voc_language_bank?.length ? (
        <Section title="Language bank">
          <p style={{ margin: "-4px 0 0", color: "#8a8a8a", fontSize: 13 }}>Their exact words — steal these for hooks, headlines, and ad copy.</p>
          <div className="voc-card"><Chips items={report.voc_language_bank} /></div>
        </Section>
      ) : null}

      {report.content_ideas?.length ? (
        <Section title="Content ideas from this week">
          {report.content_ideas.map((c, i) => (
            <div key={i} className="voc-card" style={{ background: "#fff", border: "1px solid #ececec", borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{i + 1}. {c.idea}{c.format ? <span style={{ color: "#8a8a8a", fontWeight: 400 }}> · {c.format}</span> : null}</div>
              {c.hook && <p style={{ margin: "8px 0 0", fontSize: 14, color: "#4a4a4a", lineHeight: 1.5 }}><b>Hook:</b> {c.hook}</p>}
            </div>
          ))}
        </Section>
      ) : null}

      {report.standout_quotes?.length ? (
        <Section title="Standout quotes">{report.standout_quotes.map((q, i) => <Quote key={i}>{q}</Quote>)}</Section>
      ) : null}
    </main>
  );
}
