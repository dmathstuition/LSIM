"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Save, Check, AlertCircle, FilePlus, ClipboardCheck } from "lucide-react";
import { C, card, inp, btn, Wrap, PageHead, Empty, Sel, type Opt } from "@/components/ui";
import type { AssignmentRow, SubmissionRow, SubStatus } from "@/lib/assignment-queries";

const STATUSES: { key: SubStatus; color: string }[] = [
  { key: "Submitted", color: C.good }, { key: "Late", color: C.warn }, { key: "Not Submitted", color: C.bad },
];

export default function Assignments({
  arms, subjects, loadAssignments, onCreate, loadSubmissions, onSaveSubmissions,
}: {
  arms: Opt[];
  subjects: Opt[];
  loadAssignments: (classId: string) => Promise<AssignmentRow[]>;
  onCreate: (classId: string, a: { title: string; due_date: string | null; subject_id: string | null; description: string | null }) => Promise<AssignmentRow>;
  loadSubmissions: (assignmentId: string, classId: string) => Promise<SubmissionRow[]>;
  onSaveSubmissions: (assignmentId: string, rows: SubmissionRow[]) => Promise<void>;
}) {
  const [arm, setArm] = useState(arms[0]?.id ?? "");
  const [list, setList] = useState<AssignmentRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [subj, setSubj] = useState(subjects[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => { setArm(arms[0]?.id ?? ""); }, [arms]);
  useEffect(() => { setSubj(subjects[0]?.id ?? ""); }, [subjects]);

  async function refreshList(keepSelected = false) {
    if (!arm) { setList([]); setSelected(""); return; }
    const l = await loadAssignments(arm);
    setList(l);
    if (!keepSelected) setSelected(l[0]?.id ?? "");
  }
  useEffect(() => { refreshList().catch((e) => setMsg(e.message)); }, [arm]);
  useEffect(() => {
    if (!selected || !arm) { setRows([]); return; }
    loadSubmissions(selected, arm).then(setRows).catch((e) => setMsg(e.message));
  }, [selected, arm]);

  async function create() {
    if (!arm || !title.trim()) return;
    try {
      const a = await onCreate(arm, { title: title.trim(), due_date: due || null, subject_id: subj || null, description: null });
      setTitle(""); setDue("");
      await refreshList(true); setSelected(a.id); setMsg("Assignment created.");
    } catch (e: any) { setMsg(e.message); }
  }

  const setStatusFor = (i: number, s: SubStatus) => {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, status: s } : row)));
    setStatus("idle");
  };

  const counts = useMemo(() => ({
    Submitted: rows.filter((r) => r.status === "Submitted").length,
    Late: rows.filter((r) => r.status === "Late").length,
    "Not Submitted": rows.filter((r) => r.status === "Not Submitted").length,
  }), [rows]);

  async function save() {
    if (!selected || rows.length === 0) return;
    setStatus("saving");
    try { await onSaveSubmissions(selected, rows); setStatus("saved"); setMsg("Submissions saved."); }
    catch (e: any) { setStatus("error"); setMsg(e.message); }
  }

  if (arms.length === 0) {
    return <Wrap><Empty>No arms yet. <Link href="/classes" style={{ color: C.brand, fontWeight: 600 }}>Create a class and add learners</Link> first.</Empty></Wrap>;
  }

  return (
    <Wrap>
      <PageHead title="Assignments & submissions" sub="Create assignments per arm and track who turned work in." />

      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Sel label="Arm" value={arm} set={setArm} opts={arms} />
      </div>

      <div className="lay-side">
        {/* create + list */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, marginBottom: 12 }}>
            <FilePlus size={17} color={C.brand} /> New assignment
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            <input style={inp} placeholder="Title (e.g. Algebra worksheet 3)" value={title} onChange={(e) => setTitle(e.target.value)} />
            {subjects.length > 0 && (
              <select value={subj} onChange={(e) => setSubj(e.target.value)} style={{ ...inp, fontWeight: 600, cursor: "pointer" }}>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
            <label style={{ fontSize: 11, fontWeight: 600, color: C.inkFaint, textTransform: "uppercase", letterSpacing: ".05em" }}>Due date</label>
            <input type="date" style={inp} value={due} onChange={(e) => setDue(e.target.value)} />
            <button style={btn} onClick={create}><FilePlus size={15} /> Create</button>
          </div>

          <div style={{ marginTop: 16, fontSize: 12, fontWeight: 600, color: C.inkFaint, textTransform: "uppercase", letterSpacing: ".05em" }}>Assignments</div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {list.length === 0 && <span style={{ fontSize: 13, color: C.inkFaint }}>None yet.</span>}
            {list.map((a) => (
              <button key={a.id} onClick={() => setSelected(a.id)}
                style={{ textAlign: "left", padding: "9px 11px", borderRadius: 9, cursor: "pointer", border: `1px solid ${C.border}`,
                  background: selected === a.id ? C.brandSoft : C.surface, color: selected === a.id ? C.brand : C.inkSoft }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                {a.due_date && <div style={{ fontSize: 11, color: C.inkFaint, fontFamily: "ui-monospace, monospace" }}>due {a.due_date}</div>}
              </button>
            ))}
          </div>
        </div>

        {/* submissions grid */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700 }}>
              <ClipboardCheck size={17} color={C.brand} /> Submissions
            </div>
            <button onClick={save} disabled={status === "saving" || rows.length === 0 || !selected}
              style={{ ...btn, background: status === "saved" ? C.good : C.brand, opacity: rows.length === 0 || !selected ? 0.5 : 1, cursor: rows.length === 0 ? "not-allowed" : "pointer" }}>
              {status === "saved" ? <Check size={15} /> : <Save size={15} />}{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save"}
            </button>
          </div>

          {(status === "saved" || status === "error" || msg) &&
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, fontSize: 13, color: status === "error" ? C.bad : C.good }}>
              {status === "error" ? <AlertCircle size={15} /> : <Check size={15} />}{msg}
            </div>}

          {!selected ? <Empty>Create or pick an assignment to mark submissions.</Empty>
            : rows.length === 0 ? <Empty>No learners in this arm yet.</Empty>
              : (
                <>
                  <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 13 }}>
                    {STATUSES.map((s) => (
                      <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />{s.key}: <strong style={{ fontFamily: "ui-monospace, monospace" }}>{counts[s.key]}</strong>
                      </span>
                    ))}
                  </div>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                    {rows.map((r, i) => (
                      <div key={r.learner_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <span style={{ flex: 1 }}>
                          <Link href={`/learners/${r.learner_id}`} style={{ fontSize: 13, fontWeight: 600, color: C.ink, textDecoration: "none" }}>{r.name}</Link>
                        </span>
                        <div style={{ display: "flex", gap: 4, background: C.surface2, padding: 3, borderRadius: 9 }}>
                          {STATUSES.map((s) => (
                            <button key={s.key} onClick={() => setStatusFor(i, s.key)}
                              style={{ fontSize: 11, fontWeight: 600, padding: "5px 9px", borderRadius: 7, border: "none", cursor: "pointer",
                                background: r.status === s.key ? s.color : "transparent", color: r.status === s.key ? "#fff" : C.inkFaint }}>
                              {s.key === "Not Submitted" ? "Missing" : s.key}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
        </div>
      </div>
    </Wrap>
  );
}
