// assignment-queries.ts — assignments per arm + per-assignment submission grid.

import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

export type SubStatus = "Submitted" | "Not Submitted" | "Late";
export interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  subject_id: string | null;
  created_at: string;
}
export interface SubmissionRow {
  learner_id: string;
  adm: string;
  name: string;
  status: SubStatus;
}

export async function getAssignments(classId: string): Promise<AssignmentRow[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("id, title, description, due_date, subject_id, created_at")
    .eq("class_id", classId)
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAssignment(
  classId: string,
  a: { title: string; description?: string | null; due_date?: string | null; subject_id?: string | null }
): Promise<AssignmentRow> {
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      class_id: classId, title: a.title,
      description: a.description ?? null, due_date: a.due_date || null, subject_id: a.subject_id || null,
    })
    .select("id, title, description, due_date, subject_id, created_at")
    .single();
  if (error) throw error;
  return data as AssignmentRow;
}

/** Roster for the assignment's arm, pre-filled with each learner's submission status. */
export async function getSubmissions(assignmentId: string, classId: string): Promise<SubmissionRow[]> {
  const { data: learners, error: le } = await supabase
    .from("learners")
    .select("id, admission_number, fullname")
    .eq("class_id", classId)
    .order("fullname");
  if (le) throw le;

  const { data: subs, error: se } = await supabase
    .from("submissions")
    .select("learner_id, status")
    .eq("assignment_id", assignmentId);
  if (se) throw se;

  const byLearner = new Map<string, SubStatus>((subs ?? []).map((s: any) => [s.learner_id, s.status]));
  return (learners ?? []).map((l: any) => ({
    learner_id: l.id, adm: l.admission_number, name: l.fullname,
    status: byLearner.get(l.id) ?? "Not Submitted",
  }));
}

/** Bulk upsert the submission grid for one assignment. */
export async function saveSubmissions(assignmentId: string, rows: SubmissionRow[]) {
  const payload = rows.map((r) => ({
    assignment_id: assignmentId,
    learner_id: r.learner_id,
    status: r.status,
    submitted_at: r.status === "Not Submitted" ? null : new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("submissions")
    .upsert(payload, { onConflict: "assignment_id,learner_id" });
  if (error) throw error;
}
