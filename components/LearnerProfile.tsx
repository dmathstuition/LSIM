"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, Legend,
} from "recharts";
import { Printer, ArrowLeft, User, CalendarCheck, FileCheck, HeartPulse, TrendingUp } from "lucide-react";
import { C, card, Wrap, Chip, RISK, bandColor } from "@/components/ui";
import { componentPct } from "@/lib/grading";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import type { LearnerProfileData } from "@/lib/learner-queries";

/** Short period label for chart axes: session "2025/2026" + "Term 1" → "T1 25/26". */
function shortPeriod(session: string, term: string): string {
  const t = (term.match(/\d+/)?.[0]) ?? term;
  const yrs = session.split("/");
  const yy = yrs.length === 2 ? `${yrs[0].slice(-2)}/${yrs[1].slice(-2)}` : session;
  return `T${t} ${yy}`;
}
// Theme-/print-aware chart chrome (CSS vars resolve in SVG and flip to the light
// sheet under @media print, so the charts match the rest of the report card).
const axisTick = { fontSize: 11, fill: C.inkFaint } as const;
const tooltipStyle = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.ink } as const;

const ATT_COLOR: Record<string, string> = { Present: C.good, Late: C.warn, Absent: C.bad };

export default function LearnerProfile({ data }: { data: LearnerProfileData }) {
  const { learner, risk, scores, attendance, submissions, interventions } = data;
  const missing = submissions.filter((s) => s.status === "Not Submitted").length;
  const attMap = useMemo(() => new Map(attendance.all.map((a) => [a.date, a.status])), [attendance.all]);

  // Per-period (session+term) averages — drives the progress line and the
  // component (CA1/CA2/Exam) term-comparison bars. Sorted chronologically.
  const byPeriod = useMemo(() => {
    const m = new Map<string, { key: string; label: string; total: number; ca1: number; ca2: number; exam: number; n: number }>();
    for (const s of scores) {
      const key = `${s.session}|${s.term}`;
      const b = m.get(key) ?? { key, label: shortPeriod(s.session, s.term), total: 0, ca1: 0, ca2: 0, exam: 0, n: 0 };
      b.total += s.total;
      b.ca1 += componentPct("first_ca", s.first_ca);
      b.ca2 += componentPct("second_ca", s.second_ca);
      b.exam += componentPct("exam", s.exam);
      b.n += 1;
      m.set(key, b);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key)).map((b) => ({
      period: b.label,
      avg: Math.round(b.total / b.n),
      CA1: Math.round(b.ca1 / b.n),
      CA2: Math.round(b.ca2 / b.n),
      Exam: Math.round(b.exam / b.n),
    }));
  }, [scores]);

  // Mean total per subject across all terms — strongest → weakest.
  const bySubject = useMemo(() => {
    const m = new Map<string, { total: number; n: number }>();
    for (const s of scores) {
      const b = m.get(s.subject_name) ?? { total: 0, n: 0 };
      b.total += s.total; b.n += 1; m.set(s.subject_name, b);
    }
    return [...m.entries()].map(([subject, b]) => ({ subject, avg: Math.round(b.total / b.n) })).sort((a, b) => b.avg - a.avg);
  }, [scores]);

  return (
    <Wrap>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: C.inkSoft, textDecoration: "none" }}>
          <ArrowLeft size={15} /> Back
        </Link>
        <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.ink, cursor: "pointer" }}>
          <Printer size={15} /> Print report
        </button>
      </div>

      {/* header */}
      <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.brandSoft, display: "grid", placeItems: "center", color: C.brand }}><User size={24} /></div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{learner.fullname}</div>
            <div style={{ fontSize: 13, color: C.inkFaint, fontFamily: "ui-monospace, monospace" }}>
              {learner.admission_number} · {learner.class_label}{learner.gender ? ` · ${learner.gender}` : ""}
            </div>
            {learner.guardian_name && <div style={{ fontSize: 12, color: C.inkFaint, marginTop: 3 }}>Guardian: {learner.guardian_name}{learner.guardian_phone ? ` · ${learner.guardian_phone}` : ""}</div>}
            {learner.joined_term && <div style={{ fontSize: 12, color: C.inkFaint, marginTop: 3 }}>Joined {learner.joined_term}{learner.joined_session ? ` · ${learner.joined_session}` : ""} · not ranked in earlier terms</div>}
          </div>
        </div>
        <Chip label={`${risk.level} risk`} color={RISK[risk.level] ?? C.inkFaint} />
      </div>

      {/* KPI strip */}
      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <Kpi icon={HeartPulse} label="Average" value={`${risk.avg}`} suffix="%" color={bandColor(risk.avg)} />
        <Kpi icon={CalendarCheck} label="Attendance" value={`${attendance.pct}`} suffix="%" color={attendance.pct >= 75 ? C.good : C.warn} />
        <Kpi icon={FileCheck} label="Missing work" value={`${missing || risk.missing}`} color={(missing || risk.missing) > 0 ? C.bad : C.good} />
        <Kpi icon={User} label="Days logged" value={`${attendance.total}`} />
      </section>

      {/* performance analysis — trends, subject strengths, term comparison */}
      {scores.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 2px 12px" }}>
            <TrendingUp size={16} color={C.brand} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Performance analysis</span>
          </div>
          <div className="lay-even" style={{ marginBottom: 14 }}>
            {/* progress over time */}
            <div style={card}>
              <Title>Progress over time</Title>
              <Sub>Average total (%) each term the learner was assessed</Sub>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={byPeriod} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="period" tick={axisTick} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "Average"]} />
                  <Line type="monotone" dataKey="avg" stroke={C.brand} strokeWidth={2.5} dot={{ r: 4, fill: C.brand }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* subject strengths */}
            <div style={card}>
              <Title>Subject strengths</Title>
              <Sub>Average total (%) per subject — strongest to weakest</Sub>
              <ResponsiveContainer width="100%" height={Math.max(220, bySubject.length * 34)}>
                <BarChart data={bySubject} layout="vertical" margin={{ top: 4, right: 16, left: 6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="subject" width={90} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "Average"]} cursor={{ fill: C.brandSoft }} />
                  <Bar dataKey="avg" radius={[0, 5, 5, 0]}>
                    {bySubject.map((s, i) => <Cell key={i} fill={bandColor(s.avg)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* term comparison — assessment components */}
          <div style={{ ...card, marginBottom: 14 }}>
            <Title>Term comparison — assessment components</Title>
            <Sub>How each term was built: CA1, CA2 and Exam averaged as % of their max</Sub>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byPeriod} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="period" tick={axisTick} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} cursor={{ fill: C.brandSoft }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="CA1" fill="#5E8DF0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="CA2" fill="#C9A227" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Exam" fill="#1FA97A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="lay-2">
        {/* scores */}
        <div style={card}>
          <Title>Scores</Title>
          {scores.length === 0 ? <Muted>No marks entered yet.</Muted> : (
            <div className="table-wrap"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>{["Subject", "Term", "CA1", "CA2", "Exam", "Total", "Grade", "Pos."].map((h, i) => (
                <th key={h} style={{ textAlign: i > 1 ? "center" : "left", padding: "0 6px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: C.inkFaint }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "7px 6px", fontWeight: 600 }}>{s.subject_name}</td>
                    <td style={{ padding: "7px 6px", color: C.inkSoft }}>{s.term}</td>
                    <td style={{ padding: "7px 6px", textAlign: "center", fontFamily: "ui-monospace, monospace" }}>{s.first_ca}</td>
                    <td style={{ padding: "7px 6px", textAlign: "center", fontFamily: "ui-monospace, monospace" }}>{s.second_ca}</td>
                    <td style={{ padding: "7px 6px", textAlign: "center", fontFamily: "ui-monospace, monospace" }}>{s.exam}</td>
                    <td style={{ padding: "7px 6px", textAlign: "center", fontFamily: "ui-monospace, monospace", fontWeight: 700, color: bandColor(s.total) }}>{s.total}</td>
                    <td style={{ padding: "7px 6px", textAlign: "center", fontWeight: 700 }}>{s.grade}</td>
                    <td style={{ padding: "7px 6px", textAlign: "center", fontFamily: "ui-monospace, monospace", color: C.inkSoft }}>{s.position ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        {/* attendance summary */}
        <div style={card}>
          <Title>Attendance</Title>
          {attendance.total === 0 ? <Muted>No attendance logged.</Muted> : (
            <>
              <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 13 }}>
                {(["Present", "Late", "Absent"] as const).map((k) => (
                  <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: ATT_COLOR[k] }} />{k}:
                    <strong style={{ fontFamily: "ui-monospace, monospace" }}>{k === "Present" ? attendance.present : k === "Late" ? attendance.late : attendance.absent}</strong>
                  </span>
                ))}
              </div>
              <AttendanceCalendar byDate={attMap} />
            </>
          )}
        </div>
      </div>

      {/* submissions + interventions */}
      <div className="lay-side" style={{ marginTop: 14 }}>
        <div style={card}>
          <Title>Submissions</Title>
          {submissions.length === 0 ? <Muted>No assignments tracked yet.</Muted> : (
            <div style={{ display: "grid", gap: 6 }}>
              {submissions.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{s.title}</span>
                  <Chip label={s.status} color={s.status === "Submitted" ? C.good : s.status === "Late" ? C.warn : C.bad} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <Title>Intervention history</Title>
          {interventions.length === 0 ? <Muted>No interventions logged.</Muted> : (
            <div style={{ display: "grid", gap: 10 }}>
              {interventions.map((it) => (
                <div key={it.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{it.issue}</span>
                    <span style={{ fontSize: 11, color: C.inkFaint, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" }}>{it.date_identified}</span>
                  </div>
                  {it.strategy && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>Strategy: {it.strategy}</div>}
                  {it.actual_outcome && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>Outcome: {it.actual_outcome}</div>}
                  <div style={{ marginTop: 6 }}><Chip label={it.status} color={it.status === "Improved" ? C.good : it.status === "Needs Further Support" ? "#E0701E" : it.status === "Ongoing" ? C.brand : C.inkFaint} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Wrap>
  );
}

function Kpi({ icon: Icon, label, value, suffix, color }: any) {
  return (
    <div style={{ ...card, padding: 16, flex: "1 1 140px", minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: C.inkFaint }}>{label}</span>
        <Icon size={16} color={color || C.brand} />
      </div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 28, fontWeight: 700, marginTop: 8, color: color || C.ink }}>
        {value}<span style={{ fontSize: 14, color: C.inkFaint }}>{suffix}</span>
      </div>
    </div>
  );
}
function Title({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{children}</div>; }
function Sub({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 12, color: C.inkFaint, margin: "-8px 0 12px" }}>{children}</div>; }
function Muted({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 13, color: C.inkFaint }}>{children}</div>; }
