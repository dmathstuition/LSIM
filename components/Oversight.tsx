"use client";

import React from "react";
import Link from "next/link";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Users, School, AlertTriangle, HeartPulse, BookOpen } from "lucide-react";
import { C, card, Wrap, PageHead, Empty, bandColor, RISK } from "@/components/ui";
import type { OversightSummary } from "@/lib/oversight-queries";

export default function Oversight({ data }: { data: OversightSummary }) {
  const { rows, totals, riskMix } = data;
  const mix = (["Low", "Medium", "High", "Critical"] as const).map((k) => ({ name: k, value: riskMix[k], color: RISK[k] }));

  return (
    <Wrap max={1120}>
      <PageHead title="Oversight" sub="Supervisor view across every teacher and arm." />

      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <Kpi icon={Users} label="Teachers" value={totals.teachers} />
        <Kpi icon={School} label="Arms" value={totals.classes} />
        <Kpi icon={BookOpen} label="Learners" value={totals.learners} />
        <Kpi icon={AlertTriangle} label="At risk" value={totals.atRisk} color={totals.atRisk > 0 ? RISK.Critical : C.good} />
        <Kpi icon={HeartPulse} label="Open interventions" value={totals.openInterventions} color={C.brand} />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>By arm</div>
          {rows.length === 0 ? <Empty>No classes found across teachers yet.</Empty> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>{["Arm", "Teacher", "Learners", "Avg", "At risk", "Open"].map((h, i) => (
                <th key={h} style={{ textAlign: i > 1 ? "right" : "left", padding: "0 8px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: C.inkFaint }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.class_id} style={{ borderTop: `1px solid #EEF1F6` }}>
                    <td style={{ padding: "9px 8px", fontWeight: 700 }}>{r.class_label}</td>
                    <td style={{ padding: "9px 8px", color: C.inkSoft }}>{r.teacher_name}</td>
                    <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{r.learners}</td>
                    <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: "ui-monospace, monospace", fontWeight: 700, color: bandColor(r.avg) }}>{r.avg}</td>
                    <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: "ui-monospace, monospace", color: r.atRisk > 0 ? RISK.Critical : C.inkSoft }}>{r.atRisk}</td>
                    <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{r.openInterventions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Risk mix</div>
          <div style={{ fontSize: 12, color: C.inkFaint, marginBottom: 8 }}>All learners</div>
          {totals.learners === 0 ? <Empty>No data.</Empty> : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ResponsiveContainer width="55%" height={180}>
                <PieChart><Pie data={mix} dataKey="value" innerRadius={40} outerRadius={64} paddingAngle={2} stroke="none">{mix.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {mix.map((d) => (
                  <div key={d.name} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: d.color }} />{d.name}</span>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Wrap>
  );
}

function Kpi({ icon: Icon, label, value, color }: any) {
  return (
    <div style={{ ...card, padding: 16, flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: C.inkFaint }}>{label}</span>
        <Icon size={16} color={color || C.brand} />
      </div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 30, fontWeight: 700, marginTop: 10, color: color || C.ink }}>{value}</div>
    </div>
  );
}
