"use client";

import { useEffect, useState } from "react";
import { UserPlus, FolderPlus, Upload } from "lucide-react";
import {
  ensureProfile, getClasses, createClass, getLearnersBasic, bulkAddLearners,
  type ClassRow, type LearnerBasic,
} from "@/lib/classes";

const GRADES = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12"];
const card: React.CSSProperties = { background: "#fff", border: "1px solid #E1E5EF", borderRadius: 14, padding: 18 };
const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 10, border: "1px solid #E1E5EF", fontSize: 13, boxSizing: "border-box" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, border: "none", background: "#5B43F0", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" };

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sel, setSel] = useState<string>("");
  const [learners, setLearners] = useState<LearnerBasic[]>([]);
  const [grade, setGrade] = useState(GRADES[0]);
  const [arm, setArm] = useState("A");
  const [year, setYear] = useState("2024/2025");
  const [adm, setAdm] = useState("");
  const [name, setName] = useState("");
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState("");

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
    try { await bulkAddLearners(sel, [{ admission_number: adm.trim(), fullname: name.trim() }]);
      setAdm(""); setName(""); setMsg("Learner added."); setLearners(await getLearnersBasic(sel)); }
    catch (e: any) { setMsg(e.message); }
  }
  async function importCsv() {
    if (!sel || !csv.trim()) return;
    // lines: admission_number, fullname[, gender]
    const rows = csv.trim().split(/\r?\n/).map((line) => {
      const [admission_number, fullname, gender] = line.split(",").map((s) => s?.trim());
      return { admission_number, fullname, gender: gender || null };
    }).filter((r) => r.admission_number && r.fullname);
    try { await bulkAddLearners(sel, rows); setCsv(""); setMsg(`Imported ${rows.length} learners.`);
      setLearners(await getLearnersBasic(sel)); }
    catch (e: any) { setMsg(e.message); }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "22px 20px 60px", fontFamily: "system-ui, sans-serif", color: "#13182B" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Classes &amp; learners</h1>
      <p style={{ fontSize: 13, color: "#8B92A4", marginTop: 0, marginBottom: 18 }}>
        Create each arm you teach, then add its learners.
      </p>
      {msg && <div style={{ fontSize: 13, color: "#5B43F0", marginBottom: 14 }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14, alignItems: "start" }}>
        {/* create arm */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, marginBottom: 12 }}>
            <FolderPlus size={17} color="#5B43F0" /> New arm
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            <select style={{ ...inp, fontWeight: 600, cursor: "pointer", background: "#fff" }} value={grade} onChange={(e) => setGrade(e.target.value)}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <input style={inp} placeholder="Arm (e.g. A)" value={arm} onChange={(e) => setArm(e.target.value)} />
            <input style={inp} placeholder="Session (e.g. 2024/2025)" value={year} onChange={(e) => setYear(e.target.value)} />
            <button style={btn} onClick={addArm}><FolderPlus size={15} /> Create arm</button>
          </div>
          <div style={{ marginTop: 16, fontSize: 12, fontWeight: 600, color: "#8B92A4", textTransform: "uppercase", letterSpacing: ".05em" }}>Your arms</div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {classes.length === 0 && <span style={{ fontSize: 13, color: "#8B92A4" }}>None yet.</span>}
            {classes.map((c) => (
              <button key={c.id} onClick={() => setSel(c.id)} style={{ padding: "6px 11px", borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid #E1E5EF",
                background: sel === c.id ? "#ECE9FF" : "#fff", color: sel === c.id ? "#5B43F0" : "#576074" }}>
                {c.grade_level} {c.arm}
              </button>
            ))}
          </div>
        </div>

        {/* add learners */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, marginBottom: 4 }}>
            <UserPlus size={17} color="#5B43F0" /> Add learners
            {sel && <span style={{ fontWeight: 500, color: "#8B92A4", fontSize: 13 }}>
              · {classes.find((c) => c.id === sel)?.grade_level} {classes.find((c) => c.id === sel)?.arm}</span>}
          </div>
          {!sel ? (
            <p style={{ fontSize: 13, color: "#8B92A4" }}>Create an arm first, then select it.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 9, marginTop: 10 }}>
                <input style={{ ...inp, flex: "0 0 130px" }} placeholder="Adm. no." value={adm} onChange={(e) => setAdm(e.target.value)} />
                <input style={{ ...inp, flex: 1 }} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                <button style={btn} onClick={addOne}><UserPlus size={15} /> Add</button>
              </div>

              <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: "#8B92A4", textTransform: "uppercase", letterSpacing: ".05em" }}>
                Or paste / import many — one per line: <code>adm, name, gender</code>
              </div>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4}
                placeholder={"IJA/24/001, Amaka Okafor, Female\nIJA/24/002, Tunde Adeyemi, Male"}
                style={{ ...inp, width: "100%", marginTop: 8, fontFamily: "ui-monospace, monospace", resize: "vertical" }} />
              <button style={{ ...btn, marginTop: 8 }} onClick={importCsv}><Upload size={15} /> Import list</button>

              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8B92A4", marginBottom: 6 }}>
                  {learners.length} learner{learners.length === 1 ? "" : "s"} in this arm
                </div>
                <div style={{ border: "1px solid #EEF1F6", borderRadius: 10, maxHeight: 240, overflow: "auto" }}>
                  {learners.map((l, i) => (
                    <div key={l.id} style={{ display: "flex", gap: 10, padding: "8px 12px",
                      borderBottom: i < learners.length - 1 ? "1px solid #F2F4F8" : "none", fontSize: 13 }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: "#8B92A4", width: 110 }}>{l.admission_number}</span>
                      <span style={{ fontWeight: 600 }}>{l.fullname}</span>
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
