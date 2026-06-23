// score-queries.ts — load roster + existing marks, and bulk-upsert.
// The unique (learner_id, subject_id, term, session) constraint makes the
// save a single idempotent upsert: re-saving edits the same rows, never dupes.

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface EntryRow {
  learner_id: string;
  adm: string;
  name: string;
  first_ca: number;
  second_ca: number;
  exam: number;
}

/** Roster for one arm, pre-filled with any marks already entered. */
export async function getEntryRows(
  classId: string, subjectId: string, term: string, session: string
): Promise<EntryRow[]> {
  const { data: learners, error: le } = await supabase
    .from("learners")
    .select("id, admission_number, fullname")
    .eq("class_id", classId)
    .order("fullname");
  if (le) throw le;

  const { data: scores, error: se } = await supabase
    .from("scores")
    .select("learner_id, first_ca, second_ca, exam")
    .eq("subject_id", subjectId).eq("term", term).eq("session", session);
  if (se) throw se;

  const byLearner = new Map(scores?.map((s) => [s.learner_id, s]));
  return (learners ?? []).map((l: any) => {
    const s = byLearner.get(l.id);
    return {
      learner_id: l.id, adm: l.admission_number, name: l.fullname,
      first_ca: s?.first_ca ?? 0, second_ca: s?.second_ca ?? 0, exam: s?.exam ?? 0,
    };
  });
}

/** Bulk save. RLS guarantees a teacher can only write their own learners' rows. */
export async function saveScores(
  rows: EntryRow[], subjectId: string, term: string, session: string
) {
  const payload = rows.map((r) => ({
    learner_id: r.learner_id, subject_id: subjectId, term, session,
    first_ca: r.first_ca, second_ca: r.second_ca, exam: r.exam,
  }));
  const { error } = await supabase
    .from("scores")
    .upsert(payload, { onConflict: "learner_id,subject_id,term,session" });
  if (error) throw error;
}
