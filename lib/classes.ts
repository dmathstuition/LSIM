import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

export interface ClassRow { id: string; grade_level: string; arm: string; class_name: string; academic_year: string; }
export interface SubjectRow { id: string; subject_name: string; }
export interface LearnerBasic { id: string; admission_number: string; fullname: string; gender: string | null; }

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

export async function getSubjects(): Promise<SubjectRow[]> {
  const { data, error } = await supabase.from("subjects").select("id, subject_name").order("subject_name");
  if (error) throw error;
  return data ?? [];
}

export async function getLearnersBasic(classId: string): Promise<LearnerBasic[]> {
  const { data, error } = await supabase.from("learners")
    .select("id, admission_number, fullname, gender").eq("class_id", classId).order("fullname");
  if (error) throw error;
  return data ?? [];
}

export async function bulkAddLearners(
  classId: string,
  rows: { admission_number: string; fullname: string; gender?: string | null }[]
) {
  const payload = rows.map((r) => ({
    class_id: classId, admission_number: r.admission_number,
    fullname: r.fullname, gender: r.gender ?? null,
  }));
  const { error } = await supabase.from("learners")
    .upsert(payload, { onConflict: "class_id,admission_number" });
  if (error) throw error;
}
