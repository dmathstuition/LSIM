"use client";

import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";
import { getLearners, getScoreTrend, getAttendanceTrend, type LearnerRow } from "@/lib/dashboard-queries";
import { getClasses } from "@/lib/classes";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [classes, setClasses] = useState<{ id: string; label: string }[]>([]);
  const [sel, setSel] = useState("all");
  const [trend, setTrend] = useState<{ term: string; avg: number }[]>([]);
  const [att, setAtt] = useState<{ w: string; v: number }[]>([]);
  const [email, setEmail] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      setEmail(user?.email ?? undefined);
      const cs = await getClasses();
      setClasses(cs.map((c) => ({ id: c.id, label: `${c.grade_level} ${c.arm}` })));
      setLoading(false);
    })().catch((e) => { console.error(e); setLoading(false); });
  }, []);

  useEffect(() => {
    (async () => {
      const cid = sel === "all" ? undefined : sel;
      const [l, tr, at] = await Promise.all([getLearners(cid), getScoreTrend(cid), getAttendanceTrend(cid)]);
      setLearners(l); setTrend(tr); setAtt(at);
    })().catch(console.error);
  }, [sel]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#8B92A4" }}>Loading…</div>;

  return (
    <Dashboard learners={learners} classes={classes} selectedClass={sel} onSelectClass={setSel}
      scoreTrend={trend} attTrend={att} teacherEmail={email} />
  );
}
