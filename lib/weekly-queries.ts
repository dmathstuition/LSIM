// weekly-queries.ts — weekly accountability tracker + evidence files.
// Evidence lives in the PRIVATE 'evidence' Storage bucket; paths start with the
// teacher's auth uid so the storage RLS policy (migration_evidence_storage.sql)
// scopes each file to its owner.

import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

export interface WeeklyEntry {
  id?: string;
  class_id: string;
  subject_id: string | null;
  week_number: number;
  topic: string | null;
  objectives: string | null;
  class_activity: string | null;
  homework: string | null;
  participation: string | null;
  reflection: string | null;
  term: string;
  session: string;
}

export interface EvidenceFile {
  id: string;
  storage_path: string;
  file_type: string | null;
  uploaded_at: string;
  name: string; // last path segment, for display
}

export async function getWeeklyEntries(classId: string, term: string, session: string): Promise<WeeklyEntry[]> {
  const { data, error } = await supabase
    .from("weekly_tracker")
    .select("id, class_id, subject_id, week_number, topic, objectives, class_activity, homework, participation, reflection, term, session")
    .eq("class_id", classId).eq("term", term).eq("session", session)
    .order("week_number");
  if (error) throw error;
  return (data ?? []) as WeeklyEntry[];
}

export async function upsertWeeklyEntry(entry: WeeklyEntry): Promise<WeeklyEntry> {
  const row = {
    class_id: entry.class_id, subject_id: entry.subject_id || null, week_number: entry.week_number,
    topic: entry.topic, objectives: entry.objectives, class_activity: entry.class_activity,
    homework: entry.homework, participation: entry.participation, reflection: entry.reflection,
    term: entry.term, session: entry.session,
  };
  const q = entry.id
    ? supabase.from("weekly_tracker").update(row).eq("id", entry.id)
    : supabase.from("weekly_tracker").insert(row);
  const { data, error } = await q.select("id, class_id, subject_id, week_number, topic, objectives, class_activity, homework, participation, reflection, term, session").single();
  if (error) throw error;
  return data as WeeklyEntry;
}

export async function listEvidence(trackerId: string): Promise<EvidenceFile[]> {
  const { data, error } = await supabase
    .from("evidence")
    .select("id, storage_path, file_type, uploaded_at")
    .eq("weekly_tracker_id", trackerId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e: any) => ({ ...e, name: e.storage_path.split("/").pop() ?? e.storage_path }));
}

export async function uploadEvidence(trackerId: string, file: File) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  // Path MUST start with the uid for the storage policy to allow it.
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${user.id}/${trackerId}/${Date.now()}_${safe}`;
  const up = await supabase.storage.from("evidence").upload(path, file, { upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase.from("evidence").insert({
    weekly_tracker_id: trackerId, storage_path: path, file_type: file.type || null,
  });
  if (error) throw error;
}

/** Short-lived signed URL for viewing/downloading a private evidence file. */
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("evidence").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteEvidence(id: string, path: string) {
  await supabase.storage.from("evidence").remove([path]);
  const { error } = await supabase.from("evidence").delete().eq("id", id);
  if (error) throw error;
}
