"use client";

import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";
import { getLearners, getScoreTrend, getAttendanceTrend, getScorePeriods, type LearnerRow, type TrendPoint } from "@/lib/dashboard-queries";
import { getOverdueFollowups, type OverdueFollowup } from "@/lib/intervention-queries";
import { getClasses, getSubjects } from "@/lib/classes";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [classes, setClasses] = useState<{ id: string; label: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; label: string }[]>([]);
  const [terms, setTerms] = useState<string[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [sel, setSel] = useState("all");
  const [subject, setSubject] = useState("all");
  const [term, setTerm] = useState("all");
  const [session, setSession] = useState("all");
  const [trend, setTrend] = useState<TrendPoint[]>([]);
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

  useEffect(() => {
    (async () => {
      const cid = sel === "all" ? undefined : sel;
      const scope = {
        subjectId: subject === "all" ? undefined : subject,
        term: term === "all" ? undefined : term,
        session: session === "all" ? undefined : session,
      };
      const [l, tr, at, ov] = await Promise.all([getLearners(cid, scope), getScoreTrend(cid, scope), getAttendanceTrend(cid), getOverdueFollowups(cid)]);
      setLearners(l); setTrend(tr); setAtt(at); setOverdue(ov);
    })().catch(console.error);
  }, [sel, subject, term, session]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>Loading…</div>;

  return (
    <Dashboard learners={learners} classes={classes} selectedClass={sel} onSelectClass={setSel}
      subjects={subjects} selectedSubject={subject} onSelectSubject={setSubject}
      terms={terms} selectedTerm={term} onSelectTerm={setTerm}
      sessions={sessions} selectedSession={session} onSelectSession={setSession}
      scoreTrend={trend} attTrend={att} overdue={overdue} teacherEmail={email} />
  );
}
