"use client";

import React, { useEffect, useState } from "react";
import { BookMarked, Plus, Check, Trash2, Pencil, X, Upload } from "lucide-react";
import { C, card, inp, btn, Wrap, PageHead, Empty } from "@/components/ui";
import { getSubjects, createSubject, bulkAddSubjects, renameSubject, deleteSubject, type SubjectRow } from "@/lib/classes";

export default function SubjectManager() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function refresh() { setSubjects(await getSubjects()); }
  useEffect(() => { refresh().catch((e) => setMsg({ kind: "err", text: e.message })); }, []);

  async function add() {
    if (!name.trim()) return;
    try { await createSubject(name.trim()); setName(""); setMsg({ kind: "ok", text: "Subject added." }); await refresh(); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); }
  }
  // Split a pasted list on newlines, commas, tabs or semicolons.
  const bulkNames = bulk.split(/[\n,;\t]+/).map((s) => s.trim()).filter(Boolean);
  async function importBulk() {
    if (bulkNames.length === 0) return;
    try {
      const added = await bulkAddSubjects(bulkNames);
      const skipped = new Set(bulkNames.map((n) => n.toLowerCase())).size - added;
      setBulk(""); setShowBulk(false);
      setMsg({ kind: "ok", text: `Added ${added} course${added === 1 ? "" : "s"}${skipped > 0 ? ` · ${skipped} already existed` : ""}.` });
      await refresh();
    } catch (e: any) { setMsg({ kind: "err", text: e.message }); }
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
        <button onClick={() => setShowBulk((v) => !v)} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, color: C.brand, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Upload size={14} /> {showBulk ? "Hide bulk import" : "Bulk import courses"}
        </button>
        {showBulk && (
          <div style={{ marginTop: 10 }}>
            <textarea style={{ ...inp, width: "100%", minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
              placeholder={"Paste one course per line (or comma-separated):\nEnglish\nMathematics\nBasic Science\nBusiness Studies"}
              value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, marginTop: 9 }}>
              <span style={{ fontSize: 12, color: C.inkFaint }}>{bulkNames.length} course{bulkNames.length === 1 ? "" : "s"} detected · duplicates are skipped</span>
              <button className="btn-press" style={{ ...btn, opacity: bulkNames.length === 0 ? 0.5 : 1 }} disabled={bulkNames.length === 0} onClick={importBulk}>
                <Upload size={15} /> Import {bulkNames.length || ""}
              </button>
            </div>
          </div>
        )}
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
