"use client";

import { useEffect, useState } from "react";
import AttendanceRegister from "@/components/AttendanceRegister";
import { getClasses } from "@/lib/classes";
import { getAttendanceForDate, saveAttendance } from "@/lib/attendance-queries";
import type { Opt } from "@/components/ui";

export default function AttendancePage() {
  const [arms, setArms] = useState<Opt[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const cs = await getClasses();
      setArms(cs.map((c) => ({ id: c.id, label: `${c.grade_level} ${c.arm}` })));
      setReady(true);
    })().catch(console.error);
  }, []);

  if (!ready) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>Loading…</div>;

  return (
    <AttendanceRegister
      arms={arms}
      loadRows={(classId, date) => getAttendanceForDate(classId, date)}
      onSave={(rows, date) => saveAttendance(rows, date)}
    />
  );
}
