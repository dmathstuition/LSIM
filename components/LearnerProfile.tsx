"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Printer, ArrowLeft, User, CalendarCheck, FileCheck, HeartPulse } from "lucide-react";
import { C, card, Wrap, Chip, RISK, bandColor } from "@/components/ui";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import type { LearnerProfileData } from "@/lib/learner-queries";

const ATT_COLOR: Record<string, string> = { Present: C.good, Late: C.warn, Absent: C.bad };

export default function LearnerProfile({ data }: { data: LearnerProfileData }) {
  const { learner, risk, scores, attendance, submissions, interventions } = data;
  const missing = submissions.filter((s) => s.status === "Not Submitted").length;
  const attMap = useMemo(() => new Map(attendance.all.map((a) => [a.date, a.status])), [attendance.all]);

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
function Muted({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 13, color: C.inkFaint }}>{children}</div>; }
