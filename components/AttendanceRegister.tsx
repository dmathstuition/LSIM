"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Save, Check, AlertCircle, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { C, Wrap, PageHead, Empty, Sel, type Opt } from "@/components/ui";
import { getClassAttendanceSummary, type AttRow, type AttStatus } from "@/lib/attendance-queries";

const STATUSES: { key: AttStatus; color: string }[] = [
  { key: "Present", color: C.good }, { key: "Late", color: C.warn }, { key: "Absent", color: C.bad },
];

export default function AttendanceRegister({
  arms, loadRows, onSave,
}: {
  arms: Opt[];
  loadRows: (classId: string, date: string) => Promise<AttRow[]>;
  onSave: (rows: AttRow[], date: string) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [arm, setArm] = useState(arms[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<AttRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => { setArm(arms[0]?.id ?? ""); }, [arms]);

  useEffect(() => {
    if (!arm) { setRows([]); return; }
    let live = true;
    setStatus("loading");
    loadRows(arm, date)
      .then((r) => { if (live) { setRows(r); setStatus("idle"); } })
      .catch((e) => { if (live) { setStatus("error"); setMsg(e.message); } });
    return () => { live = false; };
  }, [arm, date]);

  const setStatusFor = (i: number, s: AttStatus) => {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, status: s } : row)));
    setStatus("idle");
  };
  const markAll = (s: AttStatus) => { setRows((r) => r.map((row) => ({ ...row, status: s }))); setStatus("idle"); };

  const counts = useMemo(() => ({
    Present: rows.filter((r) => r.status === "Present").length,
    Late: rows.filter((r) => r.status === "Late").length,
    Absent: rows.filter((r) => r.status === "Absent").length,
  }), [rows]);

  async function save() {
    if (!arm || rows.length === 0) return;
    setStatus("saving");
    try { await onSave(rows, date); setStatus("saved"); setMsg(`Register saved for ${date}.`); }
    catch (e: any) { setStatus("error"); setMsg(e.message); }
  }

  if (arms.length === 0) {
    return <Wrap><Empty>No arms yet. <Link href="/classes" style={{ color: C.brand, fontWeight: 600 }}>Create a class and add learners</Link> first.</Empty></Wrap>;
  }

  return (
    <Wrap max={820}>
      <PageHead title="Attendance register" sub="Mark today's register, then save. Re-saving a date edits the same rows."
        right={
          <button onClick={save} disabled={status === "saving" || rows.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "none", fontWeight: 600, fontSize: 14,
              cursor: rows.length === 0 ? "not-allowed" : "pointer", background: status === "saved" ? C.good : C.brand, color: "#fff", opacity: rows.length === 0 ? 0.5 : 1 }}>
            {status === "saved" ? <Check size={16} /> : <Save size={16} />}
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save register"}
          </button>
        } />

      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <Sel label="Arm" value={arm} set={setArm} opts={arms} />
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: C.inkFaint }}>Date</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)}
            style={{ padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, background: "#fff", color: C.ink }} />
        </label>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {STATUSES.map((s) => (
            <button key={s.key} onClick={() => markAll(s.key)}
              style={{ fontSize: 12, fontWeight: 600, padding: "8px 11px", borderRadius: 9, border: `1px solid ${C.border}`, background: "#fff", color: s.color, cursor: "pointer" }}>
              All {s.key}
            </button>
          ))}
        </div>
      </div>

      {(status === "saved" || status === "error") &&
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, fontSize: 13, color: status === "error" ? C.bad : C.good }}>
          {status === "error" ? <AlertCircle size={15} /> : <Check size={15} />}{msg}
        </div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 13 }}>
        {STATUSES.map((s) => (
          <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />{s.key}: <strong style={{ fontFamily: "ui-monospace, monospace" }}>{counts[s.key]}</strong>
          </span>
        ))}
      </div>

      {status === "loading" ? <Empty>Loading learners…</Empty>
        : rows.length === 0 ? <Empty>No learners in this arm yet. Add them under Classes &amp; learners.</Empty>
          : (
            <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              {rows.map((r, i) => (
                <div key={r.learner_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: i < rows.length - 1 ? `1px solid #EEF1F6` : "none" }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.inkFaint, width: 22 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <Link href={`/learners/${r.learner_id}`} style={{ fontWeight: 600, fontSize: 14, color: C.ink, textDecoration: "none" }}>{r.name}</Link>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.inkFaint }}>{r.adm}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, background: C.surface2, padding: 3, borderRadius: 10 }}>
                    {STATUSES.map((s) => (
                      <button key={s.key} onClick={() => setStatusFor(i, s.key)}
                        style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                          background: r.status === s.key ? s.color : "transparent", color: r.status === s.key ? "#fff" : C.inkFaint }}>
                        {s.key}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

      {arm && <MonthOverview classId={arm} />}
    </Wrap>
  );
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MonthOverview({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [{ y, m }, setYm] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [data, setData] = useState<Map<string, { present: number; total: number }>>(new Map());

  useEffect(() => {
    if (!open) return;
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, "0")}`;
    getClassAttendanceSummary(classId, from, to).then(setData).catch(() => setData(new Map()));
  }, [open, classId, y, m]);

  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const label = first.toLocaleString("en", { month: "long", year: "numeric" });
  const iso = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const shift = (delta: number) => setYm(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div className="no-print" style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, marginTop: 14, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.ink, fontWeight: 600, fontSize: 14 }}>
        <CalendarDays size={16} color={C.brand} /> Month overview {open ? "▾" : "▸"}
      </button>
      {open && (
        <div style={{ padding: "0 14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month" style={navBtn}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month" style={navBtn}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {DOW.map((d) => <div key={d} style={{ fontSize: 10, fontWeight: 600, textAlign: "center", color: C.inkFaint }}>{d}</div>)}
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;
              const b = data.get(iso(d));
              const pct = b && b.total ? Math.round((b.present / b.total) * 100) : null;
              const bg = pct === null ? "#fff" : `rgba(31,169,122,${0.12 + (pct / 100) * 0.55})`;
              return (
                <div key={d} title={pct === null ? iso(d) : `${iso(d)} · ${pct}% present`}
                  style={{ aspectRatio: "1 / 1", display: "grid", placeItems: "center", borderRadius: 8, fontSize: 11, fontFamily: "ui-monospace, monospace",
                    border: `1px solid ${C.border}`, background: bg, color: pct !== null && pct < 40 ? C.bad : C.inkSoft }}>
                  <div style={{ textAlign: "center", lineHeight: 1.1 }}>
                    <div>{d}</div>
                    {pct !== null && <div style={{ fontSize: 9, fontWeight: 700 }}>{pct}%</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = { display: "inline-flex", padding: 5, border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", color: C.inkSoft, cursor: "pointer" };
