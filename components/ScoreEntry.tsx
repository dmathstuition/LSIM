"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Save, Check, AlertCircle, Cloud, CloudOff, Loader2, Upload, FileDown } from "lucide-react";
import { draftKey, loadDraft, saveDraft, clearDraft, loadSelection, saveSelection } from "@/lib/draft";
import { parseCsv, toCsv, downloadCsv } from "@/lib/csv";
import { applyCsvScores } from "@/lib/score-import";

const CAP = { first_ca: 20, second_ca: 20, exam: 60 };
const TOTAL_MAX = CAP.first_ca + CAP.second_ca + CAP.exam;
const BANDS = [
  { min: 80, c: "#1FA97A" }, { min: 70, c: "#5BB04A" }, { min: 60, c: "#C9A227" },
  { min: 50, c: "#E08A1E" }, { min: 40, c: "#DB6334" }, { min: 0, c: "#D2353A" },
];
// Fall back to the lowest band so a stray NaN/blank total can never crash render.
const bandColor = (t: number) => (BANDS.find((b) => t >= b.min) ?? BANDS[BANDS.length - 1]).c;
// Current academic period — used when no prior selection is remembered.
const DEFAULT_TERM = "Term 3";
const DEFAULT_SESSION = "2025/2026";

export interface Row { learner_id: string; adm: string; name: string; first_ca: number; second_ca: number; exam: number; }
export interface Opt { id: string; label: string; }

const ghostBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600, fontSize: 13,
};

export default function ScoreEntry({
  arms, subjects, loadRows, onSave,
}: {
  arms: Opt[];
  subjects: Opt[];
  loadRows: (classId: string, subjectId: string, term: string, session: string) => Promise<Row[]>;
  onSave: (rows: Row[], m: { classId: string; subjectId: string; term: string; session: string }) => Promise<void>;
}) {
  const [arm, setArm] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [session, setSession] = useState(DEFAULT_SESSION);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);       // edits not yet persisted to the DB
  const [savedAt, setSavedAt] = useState("");       // time of last successful save
  const [restored, setRestored] = useState(false);  // a local draft was restored
  const [importMsg, setImportMsg] = useState("");    // CSV-import summary banner
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Last-used selection (from localStorage), applied once the option lists load
  // so a refresh returns to the same Arm/Subject/Term/Session instead of resetting.
  const savedSel = useRef(typeof window !== "undefined" ? loadSelection() : null);
  useEffect(() => {
    const s = savedSel.current;
    if (s?.term) setTerm(s.term);
    if (s?.session) setSession(s.session);
  }, []);
  useEffect(() => {
    if (!arms.length) return;
    const saved = savedSel.current?.arm;
    setArm(saved && arms.some((a) => a.id === saved) ? saved : arms[0].id);
  }, [arms]);
  useEffect(() => {
    if (!subjects.length) return;
    const saved = savedSel.current?.subject;
    setSubject(saved && subjects.some((s) => s.id === saved) ? saved : subjects[0].id);
  }, [subjects]);
  useEffect(() => { if (arm && subject) saveSelection({ arm, subject, term, session }); }, [arm, subject, term, session]);

  const overCap = (v: number, f: keyof typeof CAP) => v < 0 || v > CAP[f];
  const totals = rows.map((r) => r.first_ca + r.second_ca + r.exam);
  const invalid = useMemo(() => rows.some((r) =>
    overCap(r.first_ca, "first_ca") || overCap(r.second_ca, "second_ca") || overCap(r.exam, "exam")), [rows]);
  const classAvg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const armLabel = arms.find((a) => a.id === arm)?.label ?? "—";
  const subjectLabel = subjects.find((s) => s.id === subject)?.label ?? "—";

  const dKey = useMemo(() => (arm && subject ? draftKey({ arm, subject, term, session }) : ""), [arm, subject, term, session]);
  const toDraft = (rs: Row[]) => rs.map((r) => ({ learner_id: r.learner_id, first_ca: r.first_ca, second_ca: r.second_ca, exam: r.exam }));
  const sameMarks = (a: Row[], b: Row[]) =>
    a.length === b.length && a.every((r, i) => r.first_ca === b[i].first_ca && r.second_ca === b[i].second_ca && r.exam === b[i].exam);

  // Latest values for the debounced autosave closure.
  const rowsRef = useRef(rows); rowsRef.current = rows;
  const metaRef = useRef({ arm, subject, term, session }); metaRef.current = { arm, subject, term, session };
  const invalidRef = useRef(invalid); invalidRef.current = invalid;
  const dKeyRef = useRef(dKey); dKeyRef.current = dKey;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the roster; if a local draft for this exact view exists and differs from
  // the saved marks, restore it (so refresh/crash never loses typed marks).
  useEffect(() => {
    if (!arm || !subject) { setRows([]); return; }
    let live = true;
    setStatus("loading"); setRestored(false); setDirty(false);
    loadRows(arm, subject, term, session)
      .then((r) => {
        if (!live) return;
        const draft = dKey ? loadDraft(dKey) : null;
        if (draft) {
          const byId = new Map(draft.map((d) => [d.learner_id, d]));
          const merged = r.map((row) => {
            const d = byId.get(row.learner_id);
            return d ? { ...row, first_ca: d.first_ca, second_ca: d.second_ca, exam: d.exam } : row;
          });
          if (!sameMarks(merged, r)) { setRows(merged); setRestored(true); setDirty(true); setStatus("idle"); return; }
        }
        setRows(r); setStatus("idle");
      })
      .catch((e) => { if (live) { setStatus("error"); setMsg(e.message); } });
    return () => { live = false; };
  }, [arm, subject, term, session]);

  async function flush() {
    const r = rowsRef.current, m = metaRef.current;
    if (!m.arm || !m.subject || r.length === 0 || invalidRef.current) return;
    setStatus("saving");
    try {
      await onSave(r, { classId: m.arm, subjectId: m.subject, term: m.term, session: m.session });
      clearDraft(dKeyRef.current);
      setDirty(false); setRestored(false); setStatus("saved");
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setMsg(`${r.length} learners saved.`);
    } catch (e: any) { setStatus("error"); setMsg(e.message); }
  }
  function saveNow() { if (timer.current) clearTimeout(timer.current); void flush(); }

  // Shared write path for manual edits and CSV import: update the grid, mirror to
  // the device draft, mark dirty and (re)arm the debounced autosave.
  const applyRows = (next: Row[]) => {
    setRows(next);
    if (dKey) saveDraft(dKey, toDraft(next));
    setDirty(true); setStatus("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 1000);
  };

  const set = (i: number, f: keyof typeof CAP, raw: string) => {
    const n = Number(raw);
    // Treat blank / non-numeric input (e.g. "1e", a bad paste) as 0 so a NaN can
    // never reach the grid — NaN slips past the cap check and crashes bandColor.
    const v = raw === "" || !Number.isFinite(n) ? 0 : n;
    applyRows(rows.map((row, j) => (j === i ? { ...row, [f]: v } : row)));
  };

  function discardDraft() {
    if (dKey) clearDraft(dKey);
    setRestored(false); setDirty(false); setStatus("loading");
    loadRows(arm, subject, term, session)
      .then((r) => { setRows(r); setStatus("idle"); })
      .catch((e) => { setStatus("error"); setMsg(e.message); });
  }

  // Download the current roster as a Name,CA1,CA2,Exam template / backup.
  function exportCsv() {
    const where = `${armLabel}-${subjectLabel}-${term}`.replace(/\s+/g, "-").toLowerCase();
    downloadCsv(`scores-${where}.csv`, toCsv(rows, [
      { key: "name", header: "Name" },
      { key: "first_ca", header: "CA1" },
      { key: "second_ca", header: "CA2" },
      { key: "exam", header: "Exam" },
    ]));
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";   // allow re-importing the same file
    if (!file || rows.length === 0) return;
    try {
      const res = applyCsvScores(parseCsv(await file.text()), rows, CAP);
      if (res.matched === 0 && res.unmatched.length === 0) {
        setImportMsg("Couldn't read that file. Expected a header row with Name, CA1, CA2 and Exam columns.");
        return;
      }
      applyRows(res.rows);
      const parts = [`Imported marks for ${res.matched} of ${rows.length} learners into ${armLabel} · ${subjectLabel} · ${term}.`];
      if (res.unmatched.length) parts.push(`${res.unmatched.length} not matched: ${res.unmatched.slice(0, 6).join(", ")}${res.unmatched.length > 6 ? "…" : ""}.`);
      if (res.missing.length) parts.push(`${res.missing.length} learner${res.missing.length === 1 ? "" : "s"} not in the file (left unchanged).`);
      if (res.overCap) parts.push(`${res.overCap} mark${res.overCap === 1 ? "" : "s"} exceed the maximum — shown in red, fix before they can save.`);
      setImportMsg(parts.join(" "));
    } catch (err: any) {
      setImportMsg(`Import failed: ${err.message}`);
    }
  }

  // Warn on refresh/close while there are unsaved edits or a save is in flight.
  useEffect(() => {
    if (!dirty && status !== "saving") return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, status]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <SyncStatus status={status} dirty={dirty} invalid={invalid} savedAt={savedAt} />
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onImportFile} style={{ display: "none" }} />
          <button onClick={exportCsv} disabled={rows.length === 0} title="Download this roster as a CSV template"
            style={{ ...ghostBtn, opacity: rows.length === 0 ? 0.5 : 1, cursor: rows.length === 0 ? "not-allowed" : "pointer" }}>
            <FileDown size={15} /> Export
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={rows.length === 0} title="Import marks from a CSV (Name, CA1, CA2, Exam)"
            style={{ ...ghostBtn, opacity: rows.length === 0 ? 0.5 : 1, cursor: rows.length === 0 ? "not-allowed" : "pointer" }}>
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={saveNow} disabled={invalid || status === "saving" || rows.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10,
              border: "none", fontWeight: 600, fontSize: 14, cursor: invalid ? "not-allowed" : "pointer",
              background: status === "saved" && !dirty ? "#1FA97A" : "#5B43F0", color: "#fff",
              opacity: invalid || rows.length === 0 ? 0.5 : 1 }}>
            {status === "saved" && !dirty ? <Check size={16} /> : <Save size={16} />}
            {status === "saving" ? "Saving…" : status === "saved" && !dirty ? "Saved" : "Save all"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Sel label="Arm" value={arm} set={setArm} opts={arms} />
        <Sel label="Subject" value={subject} set={setSubject} opts={subjects} />
        <Sel label="Term" value={term} set={setTerm} opts={[{ id: "Term 1", label: "Term 1" }, { id: "Term 2", label: "Term 2" }, { id: "Term 3", label: "Term 3" }]} />
        <Sel label="Session" value={session} set={setSession} opts={[{ id: "2024/2025", label: "2024/2025" }, { id: "2025/2026", label: "2025/2026" }]} />
      </div>

      {restored &&
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 12px", fontSize: 13,
          background: "color-mix(in srgb, #E08A1E 12%, transparent)", border: "1px solid color-mix(in srgb, #E08A1E 40%, transparent)", borderRadius: 10, color: "var(--ink)" }}>
          <AlertCircle size={15} color="#E08A1E" />
          <span style={{ flex: 1 }}>Restored unsaved marks from this device. <strong>Save all</strong> to keep them.</span>
          <button onClick={discardDraft} style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink-soft)", cursor: "pointer" }}>Discard</button>
        </div>}

      {importMsg &&
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, padding: "10px 12px", fontSize: 13,
          background: "color-mix(in srgb, #5B43F0 9%, transparent)", border: "1px solid color-mix(in srgb, #5B43F0 35%, transparent)", borderRadius: 10, color: "var(--ink)" }}>
          <Upload size={15} color="#5B43F0" style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{importMsg}</span>
          <button onClick={() => setImportMsg("")} style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink-soft)", cursor: "pointer" }}>Dismiss</button>
        </div>}

      {status === "error" &&
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, fontSize: 13, color: "#D2353A" }}>
          <AlertCircle size={15} />{msg}
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

function SyncStatus({ status, dirty, invalid, savedAt }: { status: string; dirty: boolean; invalid: boolean; savedAt: string }) {
  let icon: React.ReactNode, text: string, color = "var(--ink-faint)";
  if (status === "saving") { icon = <Loader2 size={14} className="dm-spin" />; text = "Saving…"; }
  else if (status === "error") { icon = <CloudOff size={14} />; text = "Couldn't save — kept on this device"; color = "#D2353A"; }
  else if (invalid) { icon = <AlertCircle size={14} />; text = "Fix highlighted marks to save"; color = "#D2353A"; }
  else if (dirty) { icon = <Cloud size={14} />; text = "Unsaved changes…"; color = "#E08A1E"; }
  else if (status === "saved") { icon = <Check size={14} />; text = savedAt ? `All changes saved · ${savedAt}` : "All changes saved"; color = "#1FA97A"; }
  else return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color }}>
      <style>{`@keyframes dm-spin{to{transform:rotate(360deg)}}.dm-spin{animation:dm-spin 1s linear infinite}`}</style>
      {icon}{text}
    </span>
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
