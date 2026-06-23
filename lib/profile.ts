import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

export interface Profile {
  id: string;
  fullname: string;
  email: string;
  department: string | null;
  role: string;
}

export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles").select("id, fullname, email, department, role").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (data) return data as Profile;
  // Fallback if the profiles row is missing (trigger not run): synthesise from auth.
  return { id: user.id, fullname: user.email ?? "", email: user.email ?? "", department: null, role: "teacher" };
}

export async function updateProfile(patch: { fullname: string; department: string | null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("profiles")
    .upsert({ id: user.id, email: user.email, fullname: patch.fullname, department: patch.department }, { onConflict: "id" });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
