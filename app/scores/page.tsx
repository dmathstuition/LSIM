"use client";

import { useEffect, useState } from "react";
import ScoreEntry, { type Opt } from "@/components/ScoreEntry";
import { getClasses, getSubjects } from "@/lib/classes";
import { getEntryRows, saveScores } from "@/lib/score-queries";

export default function ScoresPage() {
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

  return (
    <ScoreEntry
      arms={arms}
      subjects={subjects}
      loadRows={(classId, subjectId, term, session) => getEntryRows(classId, subjectId, term, session)}
      onSave={(rows, m) => saveScores(rows, m.subjectId, m.term, m.session)}
    />
  );
}
