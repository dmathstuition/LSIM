"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Save, Check, AlertCircle } from "lucide-react";

const CAP = { first_ca: 20, second_ca: 20, exam: 60 };
const TOTAL_MAX = CAP.first_ca + CAP.second_ca + CAP.exam;
const BANDS = [
  { min: 80, c: "#1FA97A" }, { min: 70, c: "#5BB04A" }, { min: 60, c: "#C9A227" },
  { min: 50, c: "#E08A1E" }, { min: 40, c: "#DB6334" }, { min: 0, c: "#D2353A" },
];
const bandColor = (t: number) => BANDS.find((b) => t >= b.min)!.c;

export interface Row { learner_id: string; adm: string; name: string; first_ca: number; second_ca: number; exam: number; }
export interface Opt { id: string; label: string; }

export default function ScoreEntry({
  arms, subjects, loadRows, onSave,
}: {
  arms: Opt[];
  subjects: Opt[];
  loadRows: (classId: string, subjectId: string, term: string, session: string) => Promise<Row[]>;
  onSave: (rows: Row[], m: { classId: string; subjectId: string; term: string; session: string }) => Promise<void>;
}) {
  const [arm, setArm] = useState(arms[0]?.id ?? "");
  const [subject, setSubject] = useState(subjects[0]?.id ?? "");
  const [term, setTerm] = useState("Term 2");
  const [session, setSession] = useState("2024/2025");
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => { setArm(arms[0]?.id ?? ""); }, [arms]);
  useEffect(() => { setSubject(subjects[0]?.id ?? ""); }, [subjects]);

  useEffect(() => {
    if (!arm || !subject) { setRows([]); return; }
    let live = true;
    setStatus("loading");
    loadRows(arm, subject, term, session)
      .then((r) => { if (live) { setRows(r); setStatus("idle"); } })
      .catch((e) => { if (live) { setStatus("error"); setMsg(e.message); } });
    return () => { live = false; };
  }, [arm, subject, term, session]);

  const set = (i: number, f: keyof typeof CAP, raw: string) => {
    const v = raw === "" ? 0 : Number(raw);
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [f]: v } : row)));
    setStatus("idle");
  };
  const overCap = (v: number, f: keyof typeof CAP) => v < 0 || v > CAP[f];
  const totals = rows.map((r) => r.first_ca + r.second_ca + r.exam);
  const invalid = useMemo(() => rows.some((r) =>
    overCap(r.first_ca, "first_ca") || overCap(r.second_ca, "second_ca") || overCap(r.exam, "exam")), [rows]);
  const classAvg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;

  async function save() {
    if (invalid || !arm || !subject) return;
    setStatus("saving");
    try { await onSave(rows, { classId: arm, subjectId: subject, term, session });
      setStatus("saved"); setMsg(`${rows.length} learners saved.`); }
    catch (e: any) { setStatus("error"); setMsg(e.message); }
  }

  if (arms.length === 0) {
    return (
      <Wrap>
        <Empty>
          No arms yet. <Link href="/classes" style={{ color: "#5B43F0", fontWeight: 600 }}>Create a class and add learners</Link> first.
        </Empty>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, fontWeight: 700 }}>Score entry</div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 3 }}>
            CA1 /{CAP.first_ca} · CA2 /{CAP.second_ca} · Exam /{CAP.exam} · Total /{TOTAL_MAX}
          </div>
        </div>
        <button onClick={save} disabled={invalid || status === "saving" || rows.length === 0}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10,
            border: "none", fontWeight: 600, fontSize: 14, cursor: invalid ? "not-allowed" : "pointer",
            background: status === "saved" ? "#1FA97A" : "#5B43F0", color: "#fff",
            opacity: invalid || rows.length === 0 ? 0.5 : 1 }}>
          {status === "saved" ? <Check size={16} /> : <Save size={16} />}
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save all"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Sel label="Arm" value={arm} set={setArm} opts={arms} />
        <Sel label="Subject" value={subject} set={setSubject} opts={subjects} />
        <Sel label="Term" value={term} set={setTerm} opts={[{ id: "Term 1", label: "Term 1" }, { id: "Term 2", label: "Term 2" }, { id: "Term 3", label: "Term 3" }]} />
        <Sel label="Session" value={session} set={setSession} opts={[{ id: "2024/2025", label: "2024/2025" }, { id: "2025/2026", label: "2025/2026" }]} />
      </div>

      {(status === "saved" || status === "error") &&
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, fontSize: 13,
          color: status === "error" ? "#D2353A" : "#1FA97A" }}>
          {status === "error" ? <AlertCircle size={15} /> : <Check size={15} />}{msg}
        </div>}

      {status === "loading" ? <Empty>Loading learners…</Empty>
        : rows.length === 0 ? <Empty>No learners in this arm yet. Add them under Classes &amp; learners.</Empty>
          : (
            <div className="table-wrap" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--card-shadow)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "var(--surface2)" }}>
                    {["#", "Learner", "CA1", "CA2", "Exam", "Total", "%"].map((h, i) => (
                      <th key={h} style={{ textAlign: i > 1 ? "center" : "left", padding: "11px 12px", fontSize: 11,
                        letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink-faint)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const total = totals[i];
                    return (
                      <tr key={r.learner_id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 12px", fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--ink-faint)" }}>{i + 1}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ fontWeight: 600 }}>{r.name}</div>
                          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--ink-faint)" }}>{r.adm}</div>
                        </td>
                        {(["first_ca", "second_ca", "exam"] as const).map((f) => (
                          <td key={f} style={{ padding: "8px 6px", textAlign: "center" }}>
                            <input type="number" inputMode="numeric" value={r[f] || ""} onChange={(e) => set(i, f, e.target.value)}
                              style={{ width: 56, padding: "7px 6px", textAlign: "center", fontFamily: "ui-monospace, monospace",
                                borderRadius: 8, border: `1px solid ${overCap(r[f], f) ? "#D2353A" : "var(--border)"}`, color: "var(--ink)",
                                background: overCap(r[f], f) ? "color-mix(in srgb, var(--bad) 14%, transparent)" : "var(--surface)" }} />
                          </td>
                        ))}
                        <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "ui-monospace, monospace", fontWeight: 700, color: bandColor(total) }}>{total}</td>
                        <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "ui-monospace, monospace", color: "var(--ink-soft)" }}>{Math.round((total / TOTAL_MAX) * 100)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--surface2)" }}>
                    <td colSpan={5} style={{ padding: "11px 12px", fontSize: 13, color: "var(--ink-soft)" }}>{rows.length} learners</td>
                    <td style={{ padding: "11px 12px", textAlign: "center", fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{classAvg.toFixed(1)}</td>
                    <td style={{ padding: "11px 12px", textAlign: "center", fontSize: 12, color: "var(--ink-faint)" }}>avg</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="page-pad" style={{ maxWidth: 940, margin: "0 auto", fontFamily: "system-ui, sans-serif", color: "var(--ink)" }}>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 14, padding: 32, textAlign: "center", color: "var(--ink-faint)", fontSize: 14 }}>{children}</div>;
}
function Sel({ label, value, set, opts }: { label: string; value: string; set: (v: string) => void; opts: Opt[] }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink-faint)" }}>{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)} style={{ padding: "9px 11px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, fontWeight: 600, background: "var(--surface)", color: "var(--ink)", cursor: "pointer" }}>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}
