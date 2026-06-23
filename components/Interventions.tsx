"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HeartPulse, Plus, AlertTriangle, X } from "lucide-react";
import { C, card, inp, btn, Wrap, PageHead, Empty, Sel, Chip, RISK, type Opt } from "@/components/ui";
import {
  PROGRESS_STATUSES, type InterventionRow, type ProgressStatus, type RiskItem,
} from "@/lib/intervention-queries";

const STATUS_COLOR: Record<ProgressStatus, string> = {
  "Not Started": C.inkFaint, "Ongoing": "#5B43F0", "Improved": C.good, "Needs Further Support": "#E0701E",
};

export default function Interventions({
  arms, loadRisk, loadInterventions, onCreate, onUpdate,
}: {
  arms: Opt[];
  loadRisk: (classId?: string) => Promise<RiskItem[]>;
  loadInterventions: (classId?: string) => Promise<InterventionRow[]>;
  onCreate: (i: { learner_id: string; issue: string; strategy: string | null; expected_outcome: string | null; follow_up_date: string | null }) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Pick<InterventionRow, "status" | "actual_outcome" | "follow_up_date">>) => Promise<void>;
}) {
  const [arm, setArm] = useState("all");
  const [risk, setRisk] = useState<RiskItem[]>([]);
  const [items, setItems] = useState<InterventionRow[]>([]);
  const [form, setForm] = useState<{ learner_id: string; name: string } | null>(null);
  const [issue, setIssue] = useState("");
  const [strategy, setStrategy] = useState("");
  const [expected, setExpected] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [msg, setMsg] = useState("");

  const cid = arm === "all" ? undefined : arm;
  async function refresh() {
    const [r, i] = await Promise.all([loadRisk(cid), loadInterventions(cid)]);
    setRisk(r); setItems(i);
  }
  useEffect(() => { refresh().catch((e) => setMsg(e.message)); }, [arm]);

  // Learners flagged but with no open intervention yet → suggested.
  const openByLearner = useMemo(() => {
    const m = new Set(items.filter((i) => i.status !== "Improved").map((i) => i.learner_id));
    return m;
  }, [items]);
  const suggested = useMemo(
    () => risk.filter((r) => r.level !== "Low").sort((a, b) => rank(b.level) - rank(a.level) || a.avg - b.avg),
    [risk]
  );

  const byStatus = (s: ProgressStatus) => items.filter((i) => i.status === s);

  function openForm(learner_id: string, name: string) {
    setForm({ learner_id, name }); setIssue(""); setStrategy(""); setExpected(""); setFollowUp(""); setMsg("");
  }
  async function submit() {
    if (!form || !issue.trim()) return;
    try {
      await onCreate({ learner_id: form.learner_id, issue: issue.trim(), strategy: strategy.trim() || null, expected_outcome: expected.trim() || null, follow_up_date: followUp || null });
      setForm(null); await refresh(); setMsg("Intervention logged.");
    } catch (e: any) { setMsg(e.message); }
  }
  async function update(id: string, patch: any) {
    try { await onUpdate(id, patch); await refresh(); } catch (e: any) { setMsg(e.message); }
  }

  return (
    <Wrap max={1100}>
      <PageHead title="Interventions" sub="Identify flagged learners, log a strategy, and track follow-up to outcome." />

      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Sel label="Arm" value={arm} set={setArm} opts={[{ id: "all", label: "All arms" }, ...arms]} />
      </div>
      {msg && <div style={{ fontSize: 13, color: C.brand, marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.6fr", gap: 14, alignItems: "start" }}>
        {/* suggested / at-risk */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, marginBottom: 4 }}>
            <AlertTriangle size={17} color={RISK.Critical} /> Needs attention
          </div>
          <div style={{ fontSize: 12, color: C.inkFaint, marginBottom: 12 }}>{suggested.length} flagged by early-warning</div>
          {suggested.length === 0 ? <Empty>No one flagged. Nice.</Empty> : (
            <div style={{ display: "grid", gap: 8 }}>
              {suggested.map((r) => (
                <div key={r.learner_id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <Link href={`/learners/${r.learner_id}`} style={{ fontWeight: 600, fontSize: 14, color: C.ink, textDecoration: "none" }}>{r.name}</Link>
                    <Chip label={r.level} color={RISK[r.level]} />
                  </div>
                  <div style={{ fontSize: 12, color: C.inkFaint, fontFamily: "ui-monospace, monospace", marginTop: 4 }}>
                    avg {r.avg} · att {r.attendance}% · missing {r.missing}
                  </div>
                  <button onClick={() => openForm(r.learner_id, r.name)}
                    style={{ ...btn, marginTop: 8, padding: "6px 11px", fontSize: 12, background: openByLearner.has(r.learner_id) ? C.surface2 : C.brand, color: openByLearner.has(r.learner_id) ? C.inkSoft : "#fff" }}>
                    <Plus size={13} /> {openByLearner.has(r.learner_id) ? "Add another" : "Log intervention"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* board */}
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700 }}>
            <HeartPulse size={18} color={C.brand} /> Intervention board <span style={{ fontWeight: 500, color: C.inkFaint, fontSize: 13 }}>· {items.length} total</span>
          </div>
          {items.length === 0 ? <Empty>No interventions yet. Log one from the panel on the left.</Empty> : (
            <div style={{ display: "grid", gap: 14 }}>
              {PROGRESS_STATUSES.map((s) => {
                const group = byStatus(s);
                if (group.length === 0) return null;
                return (
                  <div key={s}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_COLOR[s] }} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{s}</span>
                      <span style={{ fontSize: 12, color: C.inkFaint, fontFamily: "ui-monospace, monospace" }}>{group.length}</span>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {group.map((it) => (
                        <div key={it.id} style={{ ...card, padding: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <Link href={`/learners/${it.learner_id}`} style={{ fontWeight: 700, fontSize: 14, color: C.ink, textDecoration: "none" }}>{it.learner_name}</Link>
                              <div style={{ fontSize: 13, marginTop: 3 }}>{it.issue}</div>
                            </div>
                            <span style={{ fontSize: 11, color: C.inkFaint, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" }}>{it.date_identified}</span>
                          </div>
                          {it.strategy && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}><strong>Strategy:</strong> {it.strategy}</div>}
                          {it.expected_outcome && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}><strong>Expected:</strong> {it.expected_outcome}</div>}

                          <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
                            <select value={it.status} onChange={(e) => update(it.id, { status: e.target.value })}
                              style={{ ...inp, fontSize: 12, fontWeight: 600, padding: "6px 9px", cursor: "pointer" }}>
                              {PROGRESS_STATUSES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <label style={{ fontSize: 11, color: C.inkFaint, display: "inline-flex", alignItems: "center", gap: 5 }}>
                              Follow-up
                              <input type="date" value={it.follow_up_date ?? ""} onChange={(e) => update(it.id, { follow_up_date: e.target.value || null })}
                                style={{ ...inp, fontSize: 12, padding: "5px 8px" }} />
                            </label>
                          </div>
                          <input placeholder="Record actual outcome…" defaultValue={it.actual_outcome ?? ""}
                            onBlur={(e) => { if (e.target.value !== (it.actual_outcome ?? "")) update(it.id, { actual_outcome: e.target.value || null }); }}
                            className="no-print" style={{ ...inp, width: "100%", marginTop: 8, fontSize: 12 }} />
                          {it.actual_outcome && <div className="print-only" style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}><strong>Outcome:</strong> {it.actual_outcome}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* log modal */}
      {form && (
        <div className="no-print" onClick={() => setForm(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(8,11,20,.45)", display: "grid", placeItems: "center", zIndex: 100, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 440, maxWidth: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>Log intervention · {form.name}</div>
              <button onClick={() => setForm(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.inkFaint }}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gap: 9 }}>
              <textarea rows={2} placeholder="Issue identified (required)" value={issue} onChange={(e) => setIssue(e.target.value)} style={{ ...inp, resize: "vertical" }} />
              <textarea rows={2} placeholder="Strategy / action" value={strategy} onChange={(e) => setStrategy(e.target.value)} style={{ ...inp, resize: "vertical" }} />
              <input placeholder="Expected outcome" value={expected} onChange={(e) => setExpected(e.target.value)} style={inp} />
              <label style={{ fontSize: 11, fontWeight: 600, color: C.inkFaint, textTransform: "uppercase", letterSpacing: ".05em" }}>Follow-up date</label>
              <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} style={inp} />
              <button style={{ ...btn, justifyContent: "center", opacity: issue.trim() ? 1 : 0.5 }} disabled={!issue.trim()} onClick={submit}>
                <Plus size={15} /> Save intervention
              </button>
            </div>
          </div>
        </div>
      )}
    </Wrap>
  );
}

function rank(level: string) { return level === "Critical" ? 3 : level === "High" ? 2 : level === "Medium" ? 1 : 0; }
