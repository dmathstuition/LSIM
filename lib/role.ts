import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

export type Role = "teacher" | "supervisor" | "admin";

/** The signed-in user's role, read from their profiles row. Defaults to teacher. */
export async function getRole(): Promise<Role> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "teacher";
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const r = (data?.role ?? "teacher") as Role;
  return r === "supervisor" || r === "admin" ? r : "teacher";
}

export const isSupervisor = (r: Role) => r === "supervisor" || r === "admin";
