"use client";

import { useEffect, useState } from "react";
import Assignments from "@/components/Assignments";
import { getClasses, getSubjects } from "@/lib/classes";
import { getAssignments, createAssignment, getSubmissions, saveSubmissions } from "@/lib/assignment-queries";
import type { Opt } from "@/components/ui";

export default function AssignmentsPage() {
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

  if (!ready) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>Loading…</div>;

  return (
    <Assignments
      arms={arms}
      subjects={subjects}
      loadAssignments={(classId) => getAssignments(classId)}
      onCreate={(classId, a) => createAssignment(classId, a)}
      loadSubmissions={(assignmentId, classId) => getSubmissions(assignmentId, classId)}
      onSaveSubmissions={(assignmentId, rows) => saveSubmissions(assignmentId, rows)}
    />
  );
}
