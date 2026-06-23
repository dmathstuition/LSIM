"use client";

import { useEffect, useState } from "react";
import WeeklyTracker from "@/components/WeeklyTracker";
import { getClasses, getSubjects } from "@/lib/classes";
import type { Opt } from "@/components/ui";

export default function WeeklyPage() {
  const [arms, setArms] = useState<Opt[]>([]);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [cs, ss] = await Promise.all([getClasses(), getSubjects()]);
      setArms(cs.map((c) => ({ id: c.id, label: `${c.grade_level} ${c.arm}` })));
      setSubjects(ss.map((s) => ({ id: s.id, label: s.subject_name })));
      setReady(true);
    })().catch(console.error);
  }, []);

  if (!ready) return <div style={{ padding: 40, textAlign: "center", color: "#8B92A4" }}>Loading…</div>;

  return <WeeklyTracker arms={arms} subjects={subjects} />;
}
