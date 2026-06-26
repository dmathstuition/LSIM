"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, Plus, Save, Check, Upload, Paperclip, Trash2, Download } from "lucide-react";
import { C, card, inp, btn, Wrap, PageHead, Empty, Sel, type Opt } from "@/components/ui";
import {
  getWeeklyEntries, upsertWeeklyEntry, listEvidence, uploadEvidence, signedUrl, deleteEvidence,
  type WeeklyEntry, type EvidenceFile,
} from "@/lib/weekly-queries";
import { currentSession, sessionOptions } from "@/lib/sessions";

const TERMS: Opt[] = [{ id: "Term 1", label: "Term 1" }, { id: "Term 2", label: "Term 2" }, { id: "Term 3", label: "Term 3" }];

const FIELDS: { key: keyof WeeklyEntry; label: string; area?: boolean }[] = [
  { key: "topic", label: "Topic" },
  { key: "objectives", label: "Objectives", area: true },
  { key: "class_activity", label: "Class activity", area: true },
  { key: "homework", label: "Homework", area: true },
  { key: "participation", label: "Participation" },
  { key: "reflection", label: "Reflection", area: true },
];

export default function WeeklyTracker({ arms, subjects }: { arms: Opt[]; subjects: Opt[] }) {
  const [arm, setArm] = useState(arms[0]?.id ?? "");
  const [subject, setSubject] = useState(subjects[0]?.id ?? "");
  const [term, setTerm] = useState("Term 2");
  const [session, setSession] = useState(currentSession());
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { setArm(arms[0]?.id ?? ""); }, [arms]);
  useEffect(() => { setSubject(subjects[0]?.id ?? ""); }, [subjects]);

  async function refresh() {
    if (!arm) { setEntries([]); return; }
    setEntries(await getWeeklyEntries(arm, term, session));
  }
  useEffect(() => { refresh().catch((e) => setMsg(e.message)); }, [arm, term, session]);

  async function addWeek() {
    if (!arm) return;
    setAdding(true); setMsg("");
    const next = (entries.reduce((m, e) => Math.max(m, e.week_number), 0) || 0) + 1;
    try {
      await upsertWeeklyEntry({
        class_id: arm, subject_id: subject || null, week_number: next, term, session,
        topic: "", objectives: "", class_activity: "", homework: "", participation: "", reflection: "",
      });
      await refresh();
    } catch (e: any) { setMsg(e.message); } finally { setAdding(false); }
  }

  if (arms.length === 0) {
    return <Wrap><Empty>No arms yet. <Link href="/classes" style={{ color: C.brand, fontWeight: 600 }}>Create a class</Link> first.</Empty></Wrap>;
  }

  return (
    <Wrap>
      <PageHead title="Weekly tracker" sub="Log each week's plan, reflection and upload supporting evidence."
        right={<button onClick={addWeek} disabled={adding || !arm} className="btn-press" style={{ ...btn, opacity: arm ? 1 : 0.5 }}><Plus size={15} /> {adding ? "Adding…" : "Add week"}</button>} />

      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Sel label="Arm" value={arm} set={setArm} opts={arms} />
        {subjects.length > 0 && <Sel label="Subject" value={subject} set={setSubject} opts={subjects} />}
        <Sel label="Term" value={term} set={setTerm} opts={TERMS} />
        <Sel label="Session" value={session} set={setSession} opts={sessionOptions([session])} />
      </div>
      {msg && <div style={{ fontSize: 13, color: C.bad, marginBottom: 12 }}>{msg}</div>}

      {entries.length === 0 ? <Empty>No weeks logged for {term} {session}. Click “Add week”.</Empty> : (
        <div style={{ display: "grid", gap: 14 }}>
          {entries.map((e) => <WeekCard key={e.id} entry={e} />)}
        </div>
      )}
    </Wrap>
  );
}

function WeekCard({ entry }: { entry: WeeklyEntry }) {
  const [form, setForm] = useState<WeeklyEntry>(entry);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { if (entry.id) listEvidence(entry.id).then(setFiles).catch((e) => setErr(e.message)); }, [entry.id]);

  const set = (k: keyof WeeklyEntry, v: string) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  async function save() {
    setSaving(true); setErr("");
    try { const r = await upsertWeeklyEntry(form); setForm(r); setSaved(true); }
    catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }
  async function onUpload(file?: File | null) {
    if (!file || !entry.id) return;
    setBusy(true); setErr("");
    try { await uploadEvidence(entry.id, file); setFiles(await listEvidence(entry.id)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function open(f: EvidenceFile) {
    try { window.open(await signedUrl(f.storage_path), "_blank"); } catch (e: any) { setErr(e.message); }
  }
  async function remove(f: EvidenceFile) {
    if (!confirm(`Delete evidence “${f.name}”?`)) return;
    try { await deleteEvidence(f.id, f.storage_path); setFiles((xs) => xs.filter((x) => x.id !== f.id)); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 700 }}>
          <CalendarRange size={17} color={C.brand} /> Week {form.week_number}
        </div>
        <button onClick={save} disabled={saving} className="btn-press"
          style={{ ...btn, background: saved ? C.good : C.brand, padding: "8px 13px" }}>
          {saved ? <Check size={15} /> : <Save size={15} />}{saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {FIELDS.map((f) => (
          <label key={String(f.key)} style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: C.inkFaint }}>{f.label}</span>
            {f.area
              ? <textarea rows={2} value={(form[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} style={{ ...inp, resize: "vertical", width: "100%" }} />
              : <input value={(form[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} style={{ ...inp, width: "100%" }} />}
          </label>
        ))}
      </div>

      {/* evidence */}
      <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.inkFaint, textTransform: "uppercase", letterSpacing: ".05em", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Paperclip size={13} /> Evidence ({files.length})
          </span>
          <label className="btn-press" style={{ ...btn, padding: "7px 12px", background: C.surface2, color: C.inkSoft, cursor: busy ? "wait" : "pointer" }}>
            <Upload size={14} /> {busy ? "Uploading…" : "Upload file"}
            <input type="file" hidden disabled={busy} onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>
        </div>
        {files.length > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {files.map((f) => (
              <div key={f.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 8, fontSize: 13 }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <button onClick={() => open(f)} title="Open" className="icon-btn" style={iconBtn}><Download size={14} /></button>
                <button onClick={() => remove(f)} title="Delete" className="icon-btn" style={iconBtn}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      {err && <div style={{ fontSize: 12, color: C.bad, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

const iconBtn: React.CSSProperties = { display: "inline-flex", padding: 5, border: "none", borderRadius: 7, background: "transparent", color: C.inkFaint, cursor: "pointer" };
