"use client";

import { useEffect, useMemo, useState } from "react";
import Dashboard from "@/components/Dashboard";
import { getDashboardRaw, computeLearners, computeScoreTrend, getAttendanceTrend, getScorePeriods, type DashboardRaw } from "@/lib/dashboard-queries";
import { getOverdueFollowups, type OverdueFollowup } from "@/lib/intervention-queries";
import { getClasses, getSubjects } from "@/lib/classes";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [raw, setRaw] = useState<DashboardRaw | null>(null);
  const [classes, setClasses] = useState<{ id: string; label: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; label: string }[]>([]);
  const [terms, setTerms] = useState<string[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [sel, setSel] = useState("all");
  const [subject, setSubject] = useState("all");
  const [term, setTerm] = useState("all");
  const [session, setSession] = useState("all");
  const [att, setAtt] = useState<{ w: string; v: number }[]>([]);
  const [overdue, setOverdue] = useState<OverdueFollowup[]>([]);
  const [email, setEmail] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      setEmail(user?.email ?? undefined);
      const [cs, su, pe] = await Promise.all([getClasses(), getSubjects(), getScorePeriods()]);
      setClasses(cs.map((c) => ({ id: c.id, label: `${c.grade_level} ${c.arm}` })));
      setSubjects(su.map((s) => ({ id: s.id, label: s.subject_name })));
      setTerms(pe.terms); setSessions(pe.sessions);
      setLoading(false);
    })().catch((e) => { console.error(e); setLoading(false); });
  }, []);

  // Fetch the arm's raw data once; attendance trend & overdue depend only on the
  // arm. Subject/term/session filtering is done in-memory below (no refetch).
  useEffect(() => {
    const cid = sel === "all" ? undefined : sel;
    Promise.all([getDashboardRaw(cid), getAttendanceTrend(cid), getOverdueFollowups(cid)])
      .then(([r, at, ov]) => { setRaw(r); setAtt(at); setOverdue(ov); })
      .catch(console.error);
  }, [sel]);

  const scope = useMemo(() => ({
    subjectId: subject === "all" ? undefined : subject,
    term: term === "all" ? undefined : term,
    session: session === "all" ? undefined : session,
  }), [subject, term, session]);

  const learners = useMemo(() => (raw ? computeLearners(raw, scope) : []), [raw, scope]);
  const trend = useMemo(() => (raw ? computeScoreTrend(raw.scores, scope) : []), [raw, scope]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>Loading…</div>;

  return (
    <Dashboard learners={learners} classes={classes} selectedClass={sel} onSelectClass={setSel}
      subjects={subjects} selectedSubject={subject} onSelectSubject={setSubject}
      terms={terms} selectedTerm={term} onSelectTerm={setTerm}
      sessions={sessions} selectedSession={session} onSelectSession={setSession}
      scoreTrend={trend} attTrend={att} overdue={overdue} teacherEmail={email} />
  );
}
