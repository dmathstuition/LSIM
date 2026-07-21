"use client";

import { useEffect, useState } from "react";
import { UserPlus, FolderPlus, Upload, Trash2 } from "lucide-react";
import {
  ensureProfile, getClasses, createClass, getLearnersBasic, bulkAddLearners,
  deleteClass, deleteLearner, updateLearnerJoin, updateLearnerAttrs, type ClassRow, type LearnerBasic,
} from "@/lib/classes";
import { currentSession } from "@/lib/sessions";

const GRADES = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12"];
// Mid-term joiner options. "" = present from the start (Term 1).
const JOIN_TERMS = [{ v: "", label: "From start (Term 1)" }, { v: "Term 2", label: "Joined Term 2" }, { v: "Term 3", label: "Joined Term 3" }];
// Group attributes for cohort analysis. "" = unspecified.
const GENDERS = [{ v: "", label: "Gender…" }, { v: "Male", label: "Male" }, { v: "Female", label: "Female" }, { v: "Other", label: "Other" }];
const SEN_OPTS = [{ v: "no", label: "Non-SEND" }, { v: "yes", label: "SEND" }];
const RESIDENCY = [{ v: "", label: "Day/Boarding…" }, { v: "Day", label: "Day" }, { v: "Boarding", label: "Boarding" }];
const ORIGIN = [{ v: "", label: "Local/Intl…" }, { v: "Local", label: "Local" }, { v: "International", label: "International" }];
const SCHOOL_BAND = [{ v: "", label: "HPA/LPA…" }, { v: "HPA", label: "HPA" }, { v: "LPA", label: "LPA" }];
const attrSel: React.CSSProperties = { padding: "4px 7px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11, background: "var(--surface)", color: "var(--ink)", cursor: "pointer" };
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, boxShadow: "var(--card-shadow)" };
const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, boxSizing: "border-box", background: "var(--surface)", color: "var(--ink)" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, border: "none", background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 700, fontSize: 13, cursor: "pointer" };

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sel, setSel] = useState<string>("");
  const [learners, setLearners] = useState<LearnerBasic[]>([]);
  const [grade, setGrade] = useState(GRADES[0]);
  const [arm, setArm] = useState("A");
  const [year, setYear] = useState(currentSession());
  const [adm, setAdm] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState("");   // "" = from start; else "Term 2"/"Term 3"
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState("");
  const selSession = classes.find((c) => c.id === sel)?.academic_year ?? null;

  async function refresh() {
    const cs = await getClasses();
    setClasses(cs);
    if (!sel && cs.length) setSel(cs[0].id);
  }
  useEffect(() => { ensureProfile().then(refresh).catch((e) => setMsg(e.message)); }, []);
  useEffect(() => { if (sel) getLearnersBasic(sel).then(setLearners).catch((e) => setMsg(e.message)); }, [sel]);

  async function addArm() {
    try { await createClass(grade.trim(), arm.trim(), year.trim()); setMsg(`Added ${grade} ${arm}.`); refresh(); }
    catch (e: any) { setMsg(e.message); }
  }
  async function addOne() {
    if (!sel || !adm || !name) return;
    try { await bulkAddLearners(sel, [{ admission_number: adm.trim(), fullname: name.trim(), joined_term: joined || null, joined_session: joined ? selSession : null }]);
      setAdm(""); setName(""); setJoined(""); setMsg("Learner added."); setLearners(await getLearnersBasic(sel)); }
    catch (e: any) { setMsg(e.message); }
  }
  async function importCsv() {
    if (!sel || !csv.trim()) return;
    // lines: admission_number, fullname[, gender[, joined-term e.g. "Term 2"]]
    const rows = csv.trim().split(/\r?\n/).map((line) => {
      const [admission_number, fullname, gender, joined_term] = line.split(",").map((s) => s?.trim());
      return { admission_number, fullname, gender: gender || null, joined_term: joined_term || null, joined_session: joined_term ? selSession : null };
    }).filter((r) => r.admission_number && r.fullname);
    try { await bulkAddLearners(sel, rows); setCsv(""); setMsg(`Imported ${rows.length} learners.`);
      setLearners(await getLearnersBasic(sel)); }
    catch (e: any) { setMsg(e.message); }
  }
  async function setJoin(l: LearnerBasic, term: string) {
    try { await updateLearnerJoin(l.id, term ? selSession : null, term || null); setLearners(await getLearnersBasic(sel)); }
    catch (e: any) { setMsg(e.message); }
  }
  async function setAttr(l: LearnerBasic, patch: Partial<{ gender: string | null; sen: boolean; residency: string | null; origin: string | null; school_band: string | null }>) {
    try { await updateLearnerAttrs(l.id, patch); setLearners(await getLearnersBasic(sel)); }
    catch (e: any) { setMsg(e.message); }
  }
  async function removeArm(c: ClassRow) {
    if (!confirm(`Delete ${c.grade_level} ${c.arm}? This also removes its learners and all their scores, attendance and interventions. This cannot be undone.`)) return;
    try {
      await deleteClass(c.id);
      if (sel === c.id) { setSel(""); setLearners([]); }
      setMsg(`Deleted ${c.grade_level} ${c.arm}.`); refresh();
    } catch (e: any) { setMsg(e.message); }
  }
  async function removeLearner(l: LearnerBasic) {
    if (!confirm(`Delete ${l.fullname}? This also removes their scores, attendance, submissions and interventions. This cannot be undone.`)) return;
    try { await deleteLearner(l.id); setMsg(`Deleted ${l.fullname}.`); setLearners(await getLearnersBasic(sel)); }
    catch (e: any) { setMsg(e.message); }
  }

  return (
    <div className="page-pad" style={{ maxWidth: 960, margin: "0 auto", fontFamily: "var(--font-sans), system-ui, sans-serif", color: "var(--ink)" }}>
      <h1 className="h-page" style={{ marginTop: 0, marginBottom: 4 }}>Classes &amp; learners</h1>
      <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 0, marginBottom: 18 }}>
        Create each arm you teach, then add its learners.
      </p>
      {msg && <div style={{ fontSize: 13, color: "var(--brand)", marginBottom: 14 }}>{msg}</div>}

      <div className="lay-side">
        {/* create arm */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, marginBottom: 12 }}>
            <FolderPlus size={17} color="var(--brand)" /> New arm
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            <select style={{ ...inp, fontWeight: 600, cursor: "pointer" }} value={grade} onChange={(e) => setGrade(e.target.value)}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <input style={inp} placeholder="Arm (e.g. A)" value={arm} onChange={(e) => setArm(e.target.value)} />
            <input style={inp} placeholder="Session (e.g. 2025/2026)" value={year} onChange={(e) => setYear(e.target.value)} />
            <button style={btn} onClick={addArm}><FolderPlus size={15} /> Create arm</button>
          </div>
          <div style={{ marginTop: 16, fontSize: 12, fontWeight: 600, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>Your arms</div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {classes.length === 0 && <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>None yet.</span>}
            {classes.map((c) => (
              <span key={c.id} style={{ display: "inline-flex", alignItems: "center", borderRadius: 8, border: "1px solid var(--border)",
                background: sel === c.id ? "var(--brand-soft)" : "var(--surface)", overflow: "hidden" }}>
                <button onClick={() => setSel(c.id)} style={{ padding: "6px 6px 6px 11px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "none", background: "transparent", color: sel === c.id ? "var(--brand)" : "var(--ink-soft)" }}>
                  {c.grade_level} {c.arm}
                </button>
                <button onClick={() => removeArm(c)} title="Delete arm" aria-label={`Delete ${c.grade_level} ${c.arm}`}
                  style={{ display: "inline-flex", alignItems: "center", padding: "6px 8px", border: "none",
                    borderLeft: "1px solid var(--border)", background: "transparent", color: "var(--ink-faint)", cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* add learners */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, marginBottom: 4 }}>
            <UserPlus size={17} color="var(--brand)" /> Add learners
            {sel && <span style={{ fontWeight: 500, color: "var(--ink-faint)", fontSize: 13 }}>
              · {classes.find((c) => c.id === sel)?.grade_level} {classes.find((c) => c.id === sel)?.arm}</span>}
          </div>
          {!sel ? (
            <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>Create an arm first, then select it.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 9, marginTop: 10, flexWrap: "wrap" }}>
                <input style={{ ...inp, flex: "0 0 130px" }} placeholder="Adm. no." value={adm} onChange={(e) => setAdm(e.target.value)} />
                <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                <label style={{ display: "flex", flexDirection: "column", fontSize: 10, fontWeight: 600, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  Joined
                  <select style={{ ...inp, flex: "0 0 170px" }} value={joined} onChange={(e) => setJoined(e.target.value)} title="When this learner joined the class">
                    {JOIN_TERMS.map((j) => <option key={j.v} value={j.v}>{j.label}</option>)}
                  </select>
                </label>
                <button style={{ ...btn, alignSelf: "flex-end" }} onClick={addOne}><UserPlus size={15} /> Add</button>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-faint)" }}>
                Leave <strong>Joined</strong> as “From start” for learners present since Term 1. Mark mid-term joiners as Term 2 / Term 3 so they aren’t entered or ranked in earlier terms.
              </div>

              <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                Or paste / import many — one per line: <code>adm, name, gender, joined-term</code>
              </div>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4}
                placeholder={"IJA/24/001, Amaka Okafor, Female\nIJA/24/002, Tunde Adeyemi, Male"}
                style={{ ...inp, width: "100%", marginTop: 8, fontFamily: "ui-monospace, monospace", resize: "vertical" }} />
              <button style={{ ...btn, marginTop: 8 }} onClick={importCsv}><Upload size={15} /> Import list</button>

              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-faint)", marginBottom: 6 }}>
                  {learners.length} learner{learners.length === 1 ? "" : "s"} in this arm
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, maxHeight: 240, overflow: "auto" }}>
                  {learners.map((l, i) => (
                    <div key={l.id} className="row-hover" style={{ display: "grid", gap: 6, padding: "9px 12px",
                      borderBottom: i < learners.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--ink-faint)", width: 110 }}>{l.admission_number}</span>
                        <span style={{ fontWeight: 600, flex: 1, minWidth: 90 }}>{l.fullname}</span>
                        <button onClick={() => removeLearner(l)} title="Delete learner" aria-label={`Delete ${l.fullname}`} className="icon-btn"
                          style={{ display: "inline-flex", alignItems: "center", padding: 5, border: "none", borderRadius: 7,
                            background: "transparent", color: "var(--ink-faint)", cursor: "pointer" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <select value={l.gender ?? ""} onChange={(e) => setAttr(l, { gender: e.target.value || null })} title="Gender" style={attrSel}>
                          {GENDERS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                        <select value={l.sen ? "yes" : "no"} onChange={(e) => setAttr(l, { sen: e.target.value === "yes" })} title="Special educational needs" style={attrSel}>
                          {SEN_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                        <select value={l.residency ?? ""} onChange={(e) => setAttr(l, { residency: e.target.value || null })} title="Day or boarding" style={attrSel}>
                          {RESIDENCY.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                        <select value={l.origin ?? ""} onChange={(e) => setAttr(l, { origin: e.target.value || null })} title="International or local" style={attrSel}>
                          {ORIGIN.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                        <select value={l.school_band ?? ""} onChange={(e) => setAttr(l, { school_band: e.target.value || null })} title="School-assigned HPA/LPA band"
                          style={{ ...attrSel, color: l.school_band ? "var(--ink)" : "var(--ink-faint)" }}>
                          {SCHOOL_BAND.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                        <select value={l.joined_term ?? ""} onChange={(e) => setJoin(l, e.target.value)} title="When this learner joined"
                          style={{ ...attrSel, color: l.joined_term ? "var(--ink)" : "var(--ink-faint)" }}>
                          {JOIN_TERMS.map((j) => <option key={j.v} value={j.v}>{j.label}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
