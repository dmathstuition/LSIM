// report-queries.ts — class broadsheet: every learner × subject for one
// arm/term/session, read from the score_report view (grade/position derived in SQL).

import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

export interface BroadsheetData {
  subjects: { id: string; name: string }[];
  rows: {
    learner_id: string;
    adm: string;
    name: string;
    marks: Record<string, { total: number; grade: string }>; // keyed by subject_id
    avg: number;
  }[];
}

export async function getBroadsheet(classId: string, term: string, session: string): Promise<BroadsheetData> {
  const [learnersRes, scoresRes, subjectsRes] = await Promise.all([
    supabase.from("learners").select("id, admission_number, fullname").eq("class_id", classId).order("fullname"),
    supabase.from("score_report")
      .select("learner_id, subject_id, total, grade")
      .eq("class_id", classId).eq("term", term).eq("session", session),
    supabase.from("subjects").select("id, subject_name").order("subject_name"),
  ]);
  if (learnersRes.error) throw learnersRes.error;
  if (scoresRes.error) throw scoresRes.error;

  const scores = scoresRes.data ?? [];
  // Only show subjects that actually have marks for this arm/term/session.
  const usedSubjectIds = new Set(scores.map((s: any) => s.subject_id));
  const subjects = (subjectsRes.data ?? [])
    .filter((s: any) => usedSubjectIds.has(s.id))
    .map((s: any) => ({ id: s.id, name: s.subject_name }));

  const byLearner = new Map<string, Record<string, { total: number; grade: string }>>();
  for (const s of scores) {
    const m = byLearner.get(s.learner_id) ?? {};
    m[s.subject_id] = { total: Math.round(s.total), grade: s.grade };
    byLearner.set(s.learner_id, m);
  }

  const rows = (learnersRes.data ?? []).map((l: any) => {
    const marks = byLearner.get(l.id) ?? {};
    const vals = Object.values(marks);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b.total, 0) / vals.length) : 0;
    return { learner_id: l.id, adm: l.admission_number, name: l.fullname, marks, avg };
  });

  return { subjects, rows };
}
