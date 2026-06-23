"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { C, Wrap, PageHead, Empty, Sel, bandColor, type Opt } from "@/components/ui";
import type { BroadsheetData } from "@/lib/report-queries";

const TERMS: Opt[] = [{ id: "Term 1", label: "Term 1" }, { id: "Term 2", label: "Term 2" }, { id: "Term 3", label: "Term 3" }];
const SESSIONS: Opt[] = [{ id: "2024/2025", label: "2024/2025" }, { id: "2025/2026", label: "2025/2026" }];

export default function Broadsheet({
  arms, load,
}: {
  arms: Opt[];
  load: (classId: string, term: string, session: string) => Promise<BroadsheetData>;
}) {
  const [arm, setArm] = useState(arms[0]?.id ?? "");
  const [term, setTerm] = useState("Term 2");
  const [session, setSession] = useState("2024/2025");
  const [data, setData] = useState<BroadsheetData | null>(null);

  useEffect(() => { setArm(arms[0]?.id ?? ""); }, [arms]);
  useEffect(() => {
    if (!arm) { setData(null); return; }
    load(arm, term, session).then(setData).catch(console.error);
  }, [arm, term, session]);

  const armLabel = arms.find((a) => a.id === arm)?.label ?? "";

  if (arms.length === 0) {
    return <Wrap><Empty>No arms yet. <Link href="/classes" style={{ color: C.brand, fontWeight: 600 }}>Create a class</Link> first.</Empty></Wrap>;
  }

  return (
    <Wrap max={1100}>
      <PageHead title="Class broadsheet" sub="Every learner × subject for one arm, term and session. Print to PDF for records."
        right={
          <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", color: C.ink, cursor: "pointer" }}>
            <Printer size={15} /> Print
          </button>
        } />

      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Sel label="Arm" value={arm} set={setArm} opts={arms} />
        <Sel label="Term" value={term} set={setTerm} opts={TERMS} />
        <Sel label="Session" value={session} set={setSession} opts={SESSIONS} />
      </div>

      <div className="print-only" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{armLabel} — Broadsheet</div>
        <div style={{ fontSize: 13, color: C.inkFaint }}>{term} · {session}</div>
      </div>

      {!data || data.rows.length === 0 ? <Empty>No learners in this arm.</Empty>
        : data.subjects.length === 0 ? <Empty>No marks entered for {term} {session} yet.</Empty>
          : (
            <div className="table-wrap" style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.surface2 }}>
                    <th style={th(true)}>#</th>
                    <th style={th(true)}>Learner</th>
                    {data.subjects.map((s) => <th key={s.id} style={th(false)}>{s.name}</th>)}
                    <th style={th(false)}>Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={r.learner_id} style={{ borderTop: `1px solid #EEF1F6` }}>
                      <td style={{ padding: "8px 10px", fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.inkFaint }}>{i + 1}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <Link href={`/learners/${r.learner_id}`} style={{ fontWeight: 600, color: C.ink, textDecoration: "none" }}>{r.name}</Link>
                        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.inkFaint }}>{r.adm}</div>
                      </td>
                      {data.subjects.map((s) => {
                        const m = r.marks[s.id];
                        return (
                          <td key={s.id} style={{ padding: "8px 10px", textAlign: "center", fontFamily: "ui-monospace, monospace" }}>
                            {m ? <span style={{ fontWeight: 700, color: bandColor(m.total) }}>{m.total}<span style={{ color: C.inkFaint, fontWeight: 400 }}> {m.grade}</span></span> : <span style={{ color: C.inkFaint }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ padding: "8px 10px", textAlign: "center", fontFamily: "ui-monospace, monospace", fontWeight: 700, color: bandColor(r.avg) }}>{r.avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </Wrap>
  );
}

const th = (left: boolean): React.CSSProperties => ({ textAlign: left ? "left" : "center", padding: "11px 10px", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: C.inkFaint, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" });
