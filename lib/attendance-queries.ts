// attendance-queries.ts — roster + per-date register, single idempotent upsert.
// The unique (learner_id, date) constraint makes re-saving a day edit the same
// rows rather than duplicating them.

import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

export type AttStatus = "Present" | "Absent" | "Late";
export interface AttRow {
  learner_id: string;
  adm: string;
  name: string;
  status: AttStatus;
}

/** Roster for one arm, pre-filled with the marks already saved for `date`. */
export async function getAttendanceForDate(classId: string, date: string): Promise<AttRow[]> {
  const { data: learners, error: le } = await supabase
    .from("learners")
    .select("id, admission_number, fullname")
    .eq("class_id", classId)
    .order("fullname");
  if (le) throw le;

  const ids = (learners ?? []).map((l: any) => l.id);
  const byLearner = new Map<string, AttStatus>();
  if (ids.length) {
    const { data: att, error: ae } = await supabase
      .from("attendance")
      .select("learner_id, status")
      .eq("date", date)
      .in("learner_id", ids);
    if (ae) throw ae;
    (att ?? []).forEach((a: any) => byLearner.set(a.learner_id, a.status));
  }

  return (learners ?? []).map((l: any) => ({
    learner_id: l.id, adm: l.admission_number, name: l.fullname,
    status: byLearner.get(l.id) ?? "Present",
  }));
}

/** Bulk save one day's register. RLS limits writes to the teacher's own learners. */
export async function saveAttendance(rows: AttRow[], date: string) {
  const payload = rows.map((r) => ({ learner_id: r.learner_id, date, status: r.status }));
  const { error } = await supabase
    .from("attendance")
    .upsert(payload, { onConflict: "learner_id,date" });
  if (error) throw error;
}
