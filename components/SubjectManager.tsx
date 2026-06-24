"use client";

import React, { useEffect, useState } from "react";
import { BookMarked, Plus, Check, Trash2, Pencil, X } from "lucide-react";
import { C, card, inp, btn, Wrap, PageHead, Empty } from "@/components/ui";
import { getSubjects, createSubject, renameSubject, deleteSubject, type SubjectRow } from "@/lib/classes";

export default function SubjectManager() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function refresh() { setSubjects(await getSubjects()); }
  useEffect(() => { refresh().catch((e) => setMsg({ kind: "err", text: e.message })); }, []);

  async function add() {
    if (!name.trim()) return;
    try { await createSubject(name.trim()); setName(""); setMsg({ kind: "ok", text: "Subject added." }); await refresh(); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); }
  }
  async function saveRename(id: string) {
    if (!draft.trim()) return;
    try { await renameSubject(id, draft.trim()); setEditing(null); setMsg({ kind: "ok", text: "Renamed." }); await refresh(); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); }
  }
  async function remove(s: SubjectRow) {
    if (!confirm(`Delete subject “${s.subject_name}”?`)) return;
    try { await deleteSubject(s.id); setMsg({ kind: "ok", text: "Deleted." }); await refresh(); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); }
  }

  return (
    <Wrap max={620}>
      <PageHead title="Subjects" sub="Shared lookup used by scores, assignments and the weekly tracker." />
      {msg && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, fontSize: 13, color: msg.kind === "err" ? C.bad : C.good }}>
          {msg.kind === "err" ? <X size={15} /> : <Check size={15} />}{msg.text}
        </div>
      )}

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 9 }}>
          <input style={{ ...inp, flex: 1 }} placeholder="New subject (e.g. English)" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn-press" style={btn} onClick={add}><Plus size={15} /> Add</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, marginBottom: 12 }}>
          <BookMarked size={17} color={C.brand} /> {subjects.length} subject{subjects.length === 1 ? "" : "s"}
        </div>
        {subjects.length === 0 ? <Empty>No subjects yet.</Empty> : (
          <div style={{ display: "grid", gap: 6 }}>
            {subjects.map((s) => (
              <div key={s.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9 }}>
                {editing === s.id ? (
                  <>
                    <input autoFocus style={{ ...inp, flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveRename(s.id)} />
                    <button className="icon-btn" style={iconBtn} title="Save" onClick={() => saveRename(s.id)}><Check size={15} /></button>
                    <button className="icon-btn" style={iconBtn} title="Cancel" onClick={() => setEditing(null)}><X size={15} /></button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.subject_name}</span>
                    <button className="icon-btn" style={iconBtn} title="Rename" onClick={() => { setEditing(s.id); setDraft(s.subject_name); }}><Pencil size={14} /></button>
                    <button className="icon-btn" style={iconBtn} title="Delete" onClick={() => remove(s)}><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Wrap>
  );
}

const iconBtn: React.CSSProperties = { display: "inline-flex", padding: 6, border: "none", borderRadius: 7, background: "transparent", color: C.inkFaint, cursor: "pointer" };
