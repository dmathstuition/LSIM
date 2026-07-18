import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

export interface ClassRow { id: string; grade_level: string; arm: string; class_name: string; academic_year: string; }
export interface SubjectRow { id: string; subject_name: string; }
export interface LearnerBasic {
  id: string; admission_number: string; fullname: string; gender: string | null;
  joined_session: string | null; joined_term: string | null;
  sen: boolean; residency: string | null; origin: string | null;
}

/** Safety net in case the SQL backfill wasn't run: make the profile row. */
export async function ensureProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").upsert(
    { id: user.id, email: user.email, fullname: user.email }, { onConflict: "id" }
  );
}

export async function getClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase.from("classes")
    .select("id, grade_level, arm, class_name, academic_year").order("grade_level").order("arm");
  if (error) throw error;
  return data ?? [];
}

export async function createClass(grade_level: string, arm: string, academic_year: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const class_name = `${grade_level} ${arm}`.trim();
  const { error } = await supabase.from("classes")
    .insert({ teacher_id: user.id, grade_level, arm, class_name, academic_year });
  if (error) throw error;
}

/** Delete an arm. Cascades to its learners and all their scores/attendance/etc. */
export async function deleteClass(id: string) {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw error;
}

/** Delete a learner. Cascades to their scores/attendance/submissions/interventions. */
export async function deleteLearner(id: string) {
  const { error } = await supabase.from("learners").delete().eq("id", id);
  if (error) throw error;
}

export async function getSubjects(): Promise<SubjectRow[]> {
  const { data, error } = await supabase.from("subjects").select("id, subject_name").order("subject_name");
  if (error) throw error;
  return data ?? [];
}

export async function createSubject(subject_name: string) {
  const { error } = await supabase.from("subjects").insert({ subject_name });
  if (error) throw error;
}

export async function renameSubject(id: string, subject_name: string) {
  const { error } = await supabase.from("subjects").update({ subject_name }).eq("id", id);
  if (error) throw error;
}

/** Delete a subject. Fails (FK restrict) if any scores still reference it. */
export async function deleteSubject(id: string) {
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") throw new Error("This subject still has scores — reassign or remove them first.");
    throw error;
  }
}

export async function getLearnersBasic(classId: string): Promise<LearnerBasic[]> {
  const { data, error } = await supabase.from("learners")
    .select("id, admission_number, fullname, gender, joined_session, joined_term, sen, residency, origin")
    .eq("class_id", classId).order("fullname");
  if (error) throw error;
  return (data ?? []).map((l: any) => ({ ...l, sen: l.sen ?? false }));
}

export interface NewLearner {
  admission_number: string; fullname: string; gender?: string | null;
  joined_session?: string | null; joined_term?: string | null;
  sen?: boolean; residency?: string | null; origin?: string | null;
}

export async function bulkAddLearners(classId: string, rows: NewLearner[]) {
  const payload = rows.map((r) => ({
    class_id: classId, admission_number: r.admission_number,
    fullname: r.fullname, gender: r.gender ?? null,
    joined_session: r.joined_session || null, joined_term: r.joined_term || null,
    sen: r.sen ?? false, residency: r.residency || null, origin: r.origin || null,
  }));
  const { error } = await supabase.from("learners")
    .upsert(payload, { onConflict: "class_id,admission_number" });
  if (error) throw error;
}

/** Set the term a learner joined (NULLs = present from Term 1). Hides them from
 *  earlier-term score entry and ranking. */
export async function updateLearnerJoin(id: string, joined_session: string | null, joined_term: string | null) {
  const { error } = await supabase.from("learners")
    .update({ joined_session: joined_session || null, joined_term: joined_term || null }).eq("id", id);
  if (error) throw error;
}

/** Update a learner's group attributes (gender / SEND / residency / origin). */
export async function updateLearnerAttrs(
  id: string, patch: Partial<{ gender: string | null; sen: boolean; residency: string | null; origin: string | null }>
) {
  const { error } = await supabase.from("learners").update(patch).eq("id", id);
  if (error) throw error;
}
