"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { Users, TrendingUp, Percent, CalendarCheck, FileCheck, AlertTriangle, Download, Clock, TrendingDown, FileText, Lightbulb } from "lucide-react";
import type { LearnerRow, TrendPoint } from "@/lib/dashboard-queries";
import type { OverdueFollowup } from "@/lib/intervention-queries";
import { toCsv, downloadCsv } from "@/lib/csv";
import { COMPONENT_LABELS, COMPONENT_ORDER, type ScoreComponent } from "@/lib/grading";
import { useTheme } from "@/components/ThemeProvider";

const METRIC_TITLE: Record<ScoreComponent, string> = {
  total: "Total", first_ca: "CA1 · 1st test", second_ca: "CA2 · 2nd test", exam: "Exam",
};

const THEMES = {
  light: { bg: "#EAEDF4", grid: "rgba(19,24,43,0.05)", surface: "#FFFFFF", surface2: "#F5F7FB", border: "#E1E5EF", ink: "#13182B", inkSoft: "#576074", inkFaint: "#8B92A4", brand: "#5B43F0" },
  dark: { bg: "#0B0E18", grid: "rgba(255,255,255,0.04)", surface: "#141826", surface2: "#1A1F30", border: "#272D40", ink: "#EDEFF5", inkSoft: "#9BA2B6", inkFaint: "#6B7288", brand: "#8B78FF" },
};
const BANDS = [
  { name: "Outstanding", min: 80, color: "#1FA97A" }, { name: "Very Good", min: 70, color: "#5BB04A" },
  { name: "Good", min: 60, color: "#C9A227" }, { name: "Fair", min: 50, color: "#E08A1E" },
  { name: "Needs Improv.", min: 40, color: "#DB6334" }, { name: "At Risk", min: 0, color: "#D2353A" },
];
const RISK: Record<string, string> = { Low: "#1FA97A", Medium: "#C9A227", High: "#E0701E", Critical: "#D2353A" };
const bandOf = (s: number) => BANDS.find((b) => s >= b.min)!;
const ASSIGNMENTS_PER_TERM = 8;

export interface Opt { id: string; label: string; }

export default function Dashboard({
  learners, classes, selectedClass, onSelectClass,
  subjects = [], selectedSubject = "all", onSelectSubject,
  terms = [], selectedTerm = "all", onSelectTerm,
  sessions = [], selectedSession = "all", onSelectSession,
  scoreTrend, attTrend, overdue = [], teacherEmail,
}: {
  learners: LearnerRow[];
  classes: Opt[];
  selectedClass: string;
  onSelectClass: (v: string) => void;
  subjects?: Opt[];
  selectedSubject?: string;
  onSelectSubject?: (v: string) => void;
  terms?: string[];
  selectedTerm?: string;
  onSelectTerm?: (v: string) => void;
  sessions?: string[];
  selectedSession?: string;
  onSelectSession?: (v: string) => void;
  scoreTrend: TrendPoint[];
  attTrend: { w: string; v: number }[];
  overdue?: OverdueFollowup[];
  teacherEmail?: string;
}) {
  const { theme, setTheme } = useTheme();
  const [perfMode, setPerfMode] = useState<"top" | "bottom">("top");
  const [metric, setMetric] = useState<ScoreComponent>("total");
  const t = THEMES[theme];

  const subjectLabel = selectedSubject === "all" ? "All subjects" : (subjects.find((s) => s.id === selectedSubject)?.label ?? "All subjects");
  const periodLabel = `${selectedTerm === "all" ? "All terms" : selectedTerm} · ${selectedSession === "all" ? "all sessions" : selectedSession}`;
  const selStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, padding: "8px 11px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.ink, cursor: "pointer" };
  // Academic panels are scoped to the selected subject, so they only count
  // learners who actually have marks in scope. Whole-child early-warning panels
  // (attendance, submission, risk) keep using the full cohort `learners`.
  const scored = useMemo(() => learners.filter((l) => l.hasScore), [learners]);

  // Selected-component value for each learner (% of that component's max).
  const val = (l: LearnerRow) => l.comp?.[metric] ?? 0;

  const k = useMemo(() => {
    const n = learners.length || 1;          // cohort denominator (whole-child)
    const sn = scored.length || 1;           // academic denominator (in-subject)
    return {
      n: learners.length,
      avg: scored.reduce((s, l) => s + val(l), 0) / sn,
      att: learners.reduce((s, l) => s + l.attendance, 0) / n,
      sub: (learners.reduce((s, l) => s + (ASSIGNMENTS_PER_TERM - l.missing), 0) / (n * ASSIGNMENTS_PER_TERM)) * 100,
      pass: (scored.filter((l) => l.avg >= 50).length / sn) * 100,
      atRisk: learners.filter((l) => l.level === "High" || l.level === "Critical").length,
    };
  }, [learners, scored, metric]);

  // Class-average % for each component (always all components, for the breakdown panel).
  const breakdown = useMemo(() => {
    const n = scored.length || 1;
    return COMPONENT_ORDER.map((c) => ({
      key: c, name: COMPONENT_LABELS[c],
      value: Math.round(scored.reduce((s, l) => s + (l.comp?.[c] ?? 0), 0) / n),
    }));
  }, [scored]);

  const dist = useMemo(() => BANDS.map((b) => ({ name: b.name, color: b.color, value: scored.filter((l) => bandOf(val(l)).name === b.name).length })), [scored, metric]);
  const riskMix = useMemo(() => ["Low", "Medium", "High", "Critical"].map((lv) => ({ name: lv, color: RISK[lv], value: learners.filter((l) => l.level === lv).length })), [learners]);
  const ranked = [...scored].sort((a, b) => val(b) - val(a));
  const perfList = perfMode === "top" ? ranked.slice(0, 8) : ranked.slice(-8).reverse();
  const atRiskList = [...learners].filter((l) => l.level !== "Low").sort((a, b) => (b.level === "Critical" ? 1 : 0) - (a.level === "Critical" ? 1 : 0) || a.avg - b.avg);

  // Score comparison by gender (only groups that are actually present).
  const byGender = useMemo(() => {
    const order = ["Female", "Male", "Other"];
    const groups = order.map((g) => {
      const rows = scored.filter((l) => (l.gender ?? "Unspecified") === g);
      const n = rows.length;
      return {
        name: g, n,
        avg: n ? Math.round(rows.reduce((s, l) => s + val(l), 0) / n) : 0,
        pass: n ? Math.round((rows.filter((l) => l.avg >= 50).length / n) * 100) : 0,
      };
    }).filter((g) => g.n > 0);
    const unspecified = scored.filter((l) => !l.gender || !order.includes(l.gender)).length;
    return { groups, unspecified };
  }, [scored, metric]);
  const genderColor: Record<string, string> = { Female: "#C0504D", Male: t.brand, Other: "#C9A227" };

  // Auto-derived one-line inferences from the data in scope.
  const insights = useMemo(() => {
    const out: string[] = [];
    if (scored.length === 0) return out;
    const n = scored.length;
    const mlabel = METRIC_TITLE[metric].toLowerCase();
    const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const vals = ranked.map(val);   // sorted high → low

    // 1. Gender gap
    const g = byGender.groups;
    const f = g.find((x) => x.name === "Female"), m = g.find((x) => x.name === "Male");
    if (f && m) {
      const d = f.avg - m.avg;
      out.push(Math.abs(d) < 1
        ? `Girls and boys are performing about equally (${f.avg}% vs ${m.avg}%).`
        : `${d > 0 ? "Girls" : "Boys"} lead by ${Math.abs(d)} pts on ${mlabel} (${f.avg}% vs ${m.avg}%).`);
    }

    // 2. Term-over-term direction (when a trend exists)
    if (scoreTrend.length >= 2) {
      const d = +(scoreTrend[scoreTrend.length - 1].total - scoreTrend[0].total).toFixed(1);
      if (Math.abs(d) >= 1) out.push(`Class average has ${d > 0 ? "risen" : "fallen"} ${Math.abs(d)} pts from ${scoreTrend[0].term} to ${scoreTrend[scoreTrend.length - 1].term}.`);
    }

    // 3. Strongest / weakest assessment component
    const comps = COMPONENT_ORDER.filter((c) => c !== "total").map((c) => ({ c, v: breakdown.find((b) => b.key === c)?.value ?? 0 }));
    if (comps.length) {
      const weak = comps.reduce((a, b) => (b.v < a.v ? b : a));
      const strong = comps.reduce((a, b) => (b.v > a.v ? b : a));
      if (weak.v !== strong.v) out.push(`${COMPONENT_LABELS[strong.c]} is the strongest component (${strong.v}%) and ${COMPONENT_LABELS[weak.c]} the weakest (${weak.v}%) — focus revision there.`);
    }

    // 4. Spread + median
    if (vals.length && vals[0] !== vals[vals.length - 1]) {
      out.push(`Scores span ${vals[vals.length - 1]}%–${vals[0]}% (a ${vals[0] - vals[vals.length - 1]}-pt spread); the middle learner sits at ${vals[Math.floor((n - 1) / 2)]}%.`);
    }

    // 5. Pass rate + at-risk
    out.push(`${k.pass.toFixed(0)}% of learners are passing (≥50%); ${k.atRisk} ${k.atRisk === 1 ? "is" : "are"} High/Critical risk.`);

    // 6. Outstanding share
    const out80 = vals.filter((v) => v >= 80).length;
    if (out80) out.push(`${out80} learner${out80 === 1 ? "" : "s"} (${Math.round((out80 / n) * 100)}%) are scoring 80%+ (Outstanding).`);

    // 7. Attendance ↔ results link
    const lowAtt = scored.filter((l) => l.attendance < 75), highAtt = scored.filter((l) => l.attendance >= 75);
    if (lowAtt.length && highAtt.length) {
      const gap = Math.round(mean(highAtt.map(val)) - mean(lowAtt.map(val)));
      if (gap >= 3) out.push(`Attendance tracks results: learners under 75% attendance average ${Math.round(mean(lowAtt.map(val)))}%, ${gap} pts below the rest.`);
    }

    // 8. Missing-work impact
    const miss = scored.filter((l) => l.missing >= 3), fewMiss = scored.filter((l) => l.missing < 3);
    if (miss.length && fewMiss.length) {
      const gap = Math.round(mean(fewMiss.map(val)) - mean(miss.map(val)));
      if (gap >= 3) out.push(`${miss.length} learner${miss.length === 1 ? "" : "s"} with 3+ missing tasks average ${gap} pts below their peers.`);
    }

    // 9. Declining learners
    const dec = scored.filter((l) => l.declining).length;
    if (dec) out.push(`${dec} learner${dec === 1 ? " is" : "s are"} trending down (▼) versus their previous term — worth an early check-in.`);

    // 10. Attendance health
    const belowAtt = scored.filter((l) => l.attendance < 75).length;
    if (belowAtt) out.push(`${belowAtt} of ${n} learner${belowAtt === 1 ? "" : "s"} sit below 75% attendance.`);

    // 11. Top & bottom names
    if (ranked.length) out.push(`Top: ${ranked[0].name} (${val(ranked[0])}%); lowest in scope: ${ranked[ranked.length - 1].name} (${val(ranked[ranked.length - 1])}%).`);
    return out;
  }, [scored, byGender, breakdown, k, ranked, metric, scoreTrend]);

  // Print to PDF. Force light colours first (inline chart colours don't adapt to
  // an @media print rule), then restore the user's theme afterwards.
  function downloadPdf() {
    if (typeof window === "undefined") return;
    if (theme === "dark") {
      setTheme("light");
      setTimeout(() => { window.print(); setTheme("dark"); }, 200);
    } else {
      window.print();
    }
  }

  function exportCsv() {
    const arm = classes.find((c) => c.id === selectedClass)?.label ?? "all-arms";
    const label = selectedSubject === "all" ? arm : `${arm}-${subjectLabel}`;
    const csv = toCsv(ranked, [
      { key: "adm", header: "Admission no." }, { key: "name", header: "Name" },
      { key: "gender", header: "Gender", get: (l) => l.gender ?? "" },
      { key: "ca1", header: "CA1 %", get: (l) => l.comp?.first_ca ?? 0 },
      { key: "ca2", header: "CA2 %", get: (l) => l.comp?.second_ca ?? 0 },
      { key: "exam", header: "Exam %", get: (l) => l.comp?.exam ?? 0 },
      { key: "avg", header: "Total %" },
      { key: "attendance", header: "Attendance %" },
      { key: "missing", header: "Missing work" }, { key: "level", header: "Risk" },
      { key: "declining", header: "Declining", get: (l) => (l.declining ? "Yes" : "") },
    ]);
    downloadCsv(`learners-${label.replace(/\s+/g, "-").toLowerCase()}.csv`, csv);
  }

  const css = `
    .dm-root{background:${t.bg};color:${t.ink};min-height:calc(100vh - 56px);
      font-family:system-ui,-apple-system,sans-serif;
      background-image:linear-gradient(${t.grid} 1px,transparent 1px),linear-gradient(90deg,${t.grid} 1px,transparent 1px);
      background-size:26px 26px;}
    .dm-num{font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;letter-spacing:-.02em;}
    .dm-card{background:${t.surface};border:1px solid ${t.border};border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,${theme === "dark" ? ".25" : ".05"});}
    .dm-eyebrow{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${t.inkFaint};}
    .dm-th{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${t.inkFaint};text-align:left;padding:0 0 10px;}
    .dm-td{padding:11px 0;font-size:14px;}
    .dm-chip{font-size:11px;font-weight:600;padding:2px 9px;border-radius:999px;}
    .dm-printonly{display:none;}
    @media print {
      .dm-root{background:#fff !important;background-image:none !important;min-height:auto !important;}
      .dm-card{box-shadow:none !important;break-inside:avoid;page-break-inside:avoid;}
      section{break-inside:avoid;}
      .dm-printonly{display:block;font-size:11px;color:#576074;margin-top:3px;}
    }
  `;

  const Tip = ({ active, payload, label }: any) => (!active || !payload?.length) ? null : (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 11px", fontSize: 12, color: t.ink }}>
      <div style={{ color: t.inkSoft, marginBottom: 2 }}>{label}</div>
      {payload.map((p: any, i: number) => <div key={i} className="dm-num" style={{ fontWeight: 600 }}>{p.name}: {p.value}</div>)}
    </div>
  );
  const Kpi = ({ icon: Icon, label, value, suffix, tone }: any) => (
    <div className="dm-card" style={{ padding: 16, flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="dm-eyebrow">{label}</span><Icon size={16} color={tone || t.brand} />
      </div>
      <div className="dm-num" style={{ fontSize: 30, fontWeight: 700, marginTop: 10, color: tone || t.ink }}>
        {value}<span style={{ fontSize: 15, color: t.inkFaint }}>{suffix}</span>
      </div>
    </div>
  );
  const Panel = ({ title, sub, right, children, style }: any) => (
    <div className="dm-card" style={{ padding: 18, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div><div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>{sub && <div style={{ fontSize: 12, color: t.inkFaint, marginTop: 2 }}>{sub}</div>}</div>{right}
      </div>{children}
    </div>
  );
  const NoData = ({ msg }: { msg: string }) => <div style={{ height: 196, display: "grid", placeItems: "center", color: t.inkFaint, fontSize: 13 }}>{msg}</div>;

  return (
    <div className="dm-root" data-theme={theme}>
      <style>{css}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 20px 60px" }}>
        <header style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Dashboard</div>
            <div style={{ fontSize: 12, color: t.inkFaint, marginTop: 3 }}>{teacherEmail ? `${teacherEmail} · ` : ""}{subjectLabel} · {periodLabel}</div>
            <div className="dm-printonly">Generated {new Date().toLocaleDateString()}</div>
          </div>
          <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={selectedClass} onChange={(e) => onSelectClass(e.target.value)} style={selStyle}>
              <option value="all">All arms</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            {onSelectSession && sessions.length > 0 && (
              <select value={selectedSession} onChange={(e) => onSelectSession(e.target.value)} style={selStyle} title="Session">
                <option value="all">All sessions</option>
                {sessions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {onSelectTerm && terms.length > 0 && (
              <select value={selectedTerm} onChange={(e) => onSelectTerm(e.target.value)} style={selStyle} title="Term">
                <option value="all">All terms</option>
                {terms.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
              </select>
            )}
            <button onClick={exportCsv} disabled={learners.length === 0} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "8px 13px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.ink, cursor: learners.length === 0 ? "not-allowed" : "pointer", opacity: learners.length === 0 ? 0.5 : 1 }}>
              <Download size={15} /> Export CSV
            </button>
            <button onClick={downloadPdf} disabled={learners.length === 0} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "8px 13px", borderRadius: 10, border: "none", background: t.brand, color: "#fff", cursor: learners.length === 0 ? "not-allowed" : "pointer", opacity: learners.length === 0 ? 0.5 : 1 }}>
              <FileText size={15} /> Download PDF
            </button>
          </div>
        </header>

        {subjects.length > 0 && onSelectSubject && (
          <section className="no-print" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 4, background: t.surface2, padding: 3, borderRadius: 10, flexWrap: "wrap" }}>
              {[{ id: "all", label: "All subjects" }, ...subjects].map((s) => (
                <button key={s.id} onClick={() => onSelectSubject(s.id)}
                  style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "none", background: selectedSubject === s.id ? t.surface : "transparent", color: selectedSubject === s.id ? t.brand : t.inkFaint }}>
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: t.inkFaint, marginTop: 6 }}>
              Academic charts reflect {selectedSubject === "all" ? "all subjects" : subjectLabel} · {periodLabel}. Attendance, submission &amp; risk are all-time (not term-scoped).
            </div>
          </section>
        )}

        {learners.length === 0 ? (
          <div className="dm-card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No data yet</div>
            <div style={{ fontSize: 14, color: t.inkFaint, marginBottom: 16 }}>Add an arm and learners, then enter some scores.</div>
            <Link href="/classes" style={{ background: t.brand, color: "#fff", padding: "10px 16px", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Set up a class</Link>
          </div>
        ) : (
          <>
            <section style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <Kpi icon={Users} label="Learners" value={k.n} />
              <Kpi icon={TrendingUp} label={metric === "total" ? "Class average" : `${COMPONENT_LABELS[metric]} average`} value={k.avg.toFixed(1)} suffix="%" tone={bandOf(k.avg).color} />
              <Kpi icon={Percent} label="Pass rate" value={k.pass.toFixed(0)} suffix="%" tone={k.pass >= 60 ? RISK.Low : RISK.Medium} />
              <Kpi icon={CalendarCheck} label="Attendance" value={k.att.toFixed(0)} suffix="%" />
              <Kpi icon={FileCheck} label="Submission" value={k.sub.toFixed(0)} suffix="%" />
              <Kpi icon={AlertTriangle} label="At risk" value={k.atRisk} tone={k.atRisk > 0 ? RISK.Critical : RISK.Low} />
              <Kpi icon={Clock} label="Follow-ups due" value={overdue.length} tone={overdue.length > 0 ? RISK.Critical : RISK.Low} />
            </section>

            <section style={{ marginBottom: 14 }}>
              <Panel title="Component breakdown" sub="Class average per assessment component (% of its max). Pick one to drill the charts below."
                right={
                  <div style={{ display: "flex", gap: 4, background: t.surface2, padding: 3, borderRadius: 10, flexWrap: "wrap" }}>
                    {COMPONENT_ORDER.map((c) => (
                      <button key={c} onClick={() => setMetric(c)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 8, cursor: "pointer", border: "none", background: metric === c ? t.surface : "transparent", color: metric === c ? t.brand : t.inkFaint }}>
                        {COMPONENT_LABELS[c]}
                      </button>
                    ))}
                  </div>
                }>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={breakdown} layout="vertical" margin={{ top: 0, right: 28, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.border} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: t.inkFaint }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: t.inkSoft }} tickLine={false} axisLine={{ stroke: t.border }} width={42} />
                    <Tooltip content={<Tip />} cursor={{ fill: t.grid }} />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]} onClick={(d: any) => d?.key && setMetric(d.key)} cursor="pointer" label={{ position: "right", fontSize: 11, fill: t.inkSoft, formatter: (v: number) => `${v}%` }}>
                      {breakdown.map((d, i) => <Cell key={i} fill={bandOf(d.value).color} fillOpacity={metric === d.key ? 1 : 0.55} stroke={metric === d.key ? t.ink : "none"} strokeWidth={metric === d.key ? 1 : 0} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </section>

            <section className="lay-2" style={{ marginBottom: 14 }}>
              <Panel title="Performance distribution" sub={`Learners per band · ${METRIC_TITLE[metric]}`}>
                <ResponsiveContainer width="100%" height={216}>
                  <BarChart data={dist} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: t.inkSoft }} tickLine={false} axisLine={{ stroke: t.border }} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: t.inkFaint }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<Tip />} cursor={{ fill: t.grid }} />
                    <Bar dataKey="value" radius={[5, 5, 0, 0]}>{dist.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Risk mix" sub="Early-warning levels">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ResponsiveContainer width="55%" height={196}>
                    <PieChart><Pie data={riskMix} dataKey="value" innerRadius={42} outerRadius={66} paddingAngle={2} stroke="none">{riskMix.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip content={<Tip />} /></PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {riskMix.map((d) => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: d.color }} />{d.name}</span>
                        <span className="dm-num" style={{ fontWeight: 700 }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            </section>

            <section className="lay-side" style={{ marginBottom: 14 }}>
              <Panel title="Gender comparison" sub={`${METRIC_TITLE[metric]} average & pass rate by gender`}>
                {byGender.groups.length === 0 ? <NoData msg="Add gender on the Classes page to compare." /> : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={byGender.groups} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: t.inkSoft }} tickLine={false} axisLine={{ stroke: t.border }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: t.inkFaint }} tickLine={false} axisLine={false} />
                        <Tooltip content={<Tip />} cursor={{ fill: t.grid }} />
                        <Bar dataKey="avg" name={METRIC_TITLE[metric]} radius={[5, 5, 0, 0]}>
                          {byGender.groups.map((g, i) => <Cell key={i} fill={genderColor[g.name] ?? t.brand} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      {byGender.groups.map((g) => (
                        <div key={g.name} style={{ flex: "1 1 120px", border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 11px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600 }}>
                            <span style={{ width: 9, height: 9, borderRadius: 3, background: genderColor[g.name] ?? t.brand }} />{g.name} · {g.n}
                          </div>
                          <div className="dm-num" style={{ marginTop: 4, fontSize: 13 }}>Avg <b style={{ color: bandOf(g.avg).color }}>{g.avg}%</b> · Pass <b>{g.pass}%</b></div>
                        </div>
                      ))}
                      {byGender.unspecified > 0 && <div style={{ alignSelf: "center", fontSize: 11, color: t.inkFaint }}>{byGender.unspecified} without gender set</div>}
                    </div>
                  </>
                )}
              </Panel>
              <Panel title="Insights" sub="Auto-derived from the data in view"
                right={<Lightbulb size={16} color={t.brand} />}>
                {insights.length === 0 ? <NoData msg="No data in scope." /> : (
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 9 }}>
                    {insights.map((s, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.45, color: t.ink }}>{s}</li>)}
                  </ul>
                )}
              </Panel>
            </section>

            <section className="lay-even" style={{ marginBottom: 14 }}>
              <Panel title="Score trend" sub={`${METRIC_TITLE[metric]} average across terms`}>
                {scoreTrend.length < 2 ? <NoData msg="Enter marks across more than one term to see a trend." /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={scoreTrend} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                      <XAxis dataKey="term" tick={{ fontSize: 11, fill: t.inkSoft }} tickLine={false} axisLine={{ stroke: t.border }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: t.inkFaint }} tickLine={false} axisLine={false} />
                      <Tooltip content={<Tip />} />
                      <Line type="monotone" dataKey={metric} name={METRIC_TITLE[metric]} stroke={t.brand} strokeWidth={2.5} dot={{ r: 4, fill: t.brand }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Panel>
              <Panel title="Attendance trend" sub="Weekly">
                {attTrend.length < 2 ? <NoData msg="Log attendance to see weekly trend." /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={attTrend} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="att" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.brand} stopOpacity={0.35} /><stop offset="100%" stopColor={t.brand} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                      <XAxis dataKey="w" tick={{ fontSize: 11, fill: t.inkSoft }} tickLine={false} axisLine={{ stroke: t.border }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: t.inkFaint }} tickLine={false} axisLine={false} />
                      <Tooltip content={<Tip />} />
                      <Area type="monotone" dataKey="v" stroke={t.brand} strokeWidth={2.5} fill="url(#att)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Panel>
            </section>

            <section className="lay-2">
              <Panel title="Learners needing attention" sub={`${atRiskList.length} flagged`}>
                {atRiskList.length === 0 ? <NoData msg="No one flagged. Nice." /> : (
                  <div className="table-wrap"><table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th className="dm-th">Learner</th><th className="dm-th" style={{ textAlign: "right" }}>Avg</th><th className="dm-th" style={{ textAlign: "right" }}>Att.</th><th className="dm-th" style={{ textAlign: "right" }}>Missing</th><th className="dm-th" style={{ textAlign: "right" }}>Risk</th></tr></thead>
                    <tbody>
                      {atRiskList.slice(0, 9).map((l) => (
                        <tr key={l.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td className="dm-td"><Link href={`/learners/${l.id}`} style={{ fontWeight: 600, color: t.ink, textDecoration: "none" }}>{l.name}</Link>{l.adm && <div className="dm-num" style={{ fontSize: 11, color: t.inkFaint }}>{l.adm}</div>}</td>
                          <td className="dm-td dm-num" style={{ textAlign: "right", fontWeight: 600, color: bandOf(l.avg).color }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                              {l.declining && <TrendingDown size={13} color={RISK.Critical} aria-label="declining" />}{l.avg}
                            </span>
                          </td>
                          <td className="dm-td dm-num" style={{ textAlign: "right" }}>{l.attendance}%</td>
                          <td className="dm-td dm-num" style={{ textAlign: "right" }}>{l.missing}</td>
                          <td className="dm-td" style={{ textAlign: "right" }}><span className="dm-chip" style={{ background: RISK[l.level] + "22", color: RISK[l.level] }}>{l.level}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
              </Panel>
              <Panel title="Performers" sub={METRIC_TITLE[metric]} right={
                <div style={{ display: "flex", gap: 4, background: t.surface2, padding: 3, borderRadius: 10 }}>
                  {(["top", "bottom"] as const).map((m) => (
                    <button key={m} onClick={() => setPerfMode(m)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 8, cursor: "pointer", border: "none", background: perfMode === m ? t.surface : "transparent", color: perfMode === m ? t.ink : t.inkFaint }}>{m === "top" ? "Top" : "Bottom"}</button>
                  ))}
                </div>
              }>
                {perfList.map((l, i) => (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: `1px solid ${t.border}` }}>
                    <span className="dm-num" style={{ width: 20, color: t.inkFaint, fontSize: 13 }}>{perfMode === "top" ? i + 1 : ranked.length - i}</span>
                    <Link href={`/learners/${l.id}`} style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.ink, textDecoration: "none" }}>{l.name}</Link>
                    <span className="dm-num" style={{ fontWeight: 700, color: bandOf(val(l)).color }}>{val(l)}</span>
                  </div>
                ))}
              </Panel>
            </section>

            {overdue.length > 0 && (
              <section style={{ marginTop: 14 }}>
                <Panel title="Follow-ups due" sub={`${overdue.length} intervention${overdue.length === 1 ? "" : "s"} past their follow-up date`}
                  right={<Link href="/interventions" style={{ fontSize: 12, fontWeight: 600, color: t.brand, textDecoration: "none" }}>Open board →</Link>}>
                  <div className="table-wrap"><table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th className="dm-th">Learner</th><th className="dm-th">Issue</th><th className="dm-th">Status</th><th className="dm-th" style={{ textAlign: "right" }}>Due</th></tr></thead>
                    <tbody>
                      {overdue.slice(0, 10).map((o) => (
                        <tr key={o.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td className="dm-td"><Link href={`/learners/${o.learner_id}`} style={{ fontWeight: 600, color: t.ink, textDecoration: "none" }}>{o.learner_name}</Link></td>
                          <td className="dm-td" style={{ color: t.inkSoft }}>{o.issue}</td>
                          <td className="dm-td" style={{ color: t.inkSoft }}>{o.status}</td>
                          <td className="dm-td dm-num" style={{ textAlign: "right", color: RISK.Critical }}>{o.follow_up_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </Panel>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
