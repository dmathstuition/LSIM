"use client";

import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";
import { getLearners, getScoreTrend, getAttendanceTrend, type LearnerRow, type TrendPoint } from "@/lib/dashboard-queries";
import { getOverdueFollowups, type OverdueFollowup } from "@/lib/intervention-queries";
import { getClasses, getSubjects } from "@/lib/classes";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [classes, setClasses] = useState<{ id: string; label: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; label: string }[]>([]);
  const [sel, setSel] = useState("all");
  const [subject, setSubject] = useState("all");
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
      const [cs, su] = await Promise.all([getClasses(), getSubjects()]);
      setClasses(cs.map((c) => ({ id: c.id, label: `${c.grade_level} ${c.arm}` })));
      setSubjects(su.map((s) => ({ id: s.id, label: s.subject_name })));
      setLoading(false);
    })().catch((e) => { console.error(e); setLoading(false); });
  }, []);

  useEffect(() => {
    (async () => {
      const cid = sel === "all" ? undefined : sel;
      const sid = subject === "all" ? undefined : subject;
      const [l, tr, at, ov] = await Promise.all([getLearners(cid, sid), getScoreTrend(cid, sid), getAttendanceTrend(cid), getOverdueFollowups(cid)]);
      setLearners(l); setTrend(tr); setAtt(at); setOverdue(ov);
    })().catch(console.error);
  }, [sel, subject]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>Loading…</div>;

  return (
    <Dashboard learners={learners} classes={classes} selectedClass={sel} onSelectClass={setSel}
      subjects={subjects} selectedSubject={subject} onSelectSubject={setSubject}
      scoreTrend={trend} attTrend={att} overdue={overdue} teacherEmail={email} />
  );
}
