// intervention-queries.ts — the core LAIMS feature: log issues per learner,
// assign strategies, track status + follow-up + outcome.

import { createClient } from "@/lib/supabase/client";
import { postJoinRisk } from "@/lib/grading";
const supabase = createClient();

export type ProgressStatus = "Not Started" | "Ongoing" | "Improved" | "Needs Further Support";
export const PROGRESS_STATUSES: ProgressStatus[] = ["Not Started", "Ongoing", "Improved", "Needs Further Support"];

export interface InterventionRow {
  id: string;
  learner_id: string;
  learner_name: string;
  class_id: string;
  issue: string;
  date_identified: string;
  strategy: string | null;
  expected_outcome: string | null;
  actual_outcome: string | null;
  follow_up_date: string | null;
  status: ProgressStatus;
}

export interface RiskItem {
  learner_id: string;
  name: string;
  class_id: string;
  avg: number;
  attendance: number;
  missing: number;
  level: "Low" | "Medium" | "High" | "Critical";
}

/** All interventions for the teacher's learners (RLS-scoped), optionally one arm. */
export async function getInterventions(classId?: string): Promise<InterventionRow[]> {
  const { data, error } = await supabase
    .from("interventions")
    .select("id, learner_id, issue, date_identified, strategy, expected_outcome, actual_outcome, follow_up_date, status, learners!inner(fullname, class_id)")
    .order("date_identified", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => ({
      id: r.id, learner_id: r.learner_id, learner_name: r.learners?.fullname ?? "",
      class_id: r.learners?.class_id ?? "", issue: r.issue, date_identified: r.date_identified,
      strategy: r.strategy, expected_outcome: r.expected_outcome, actual_outcome: r.actual_outcome,
      follow_up_date: r.follow_up_date, status: r.status as ProgressStatus,
    }))
    .filter((r: InterventionRow) => !classId || r.class_id === classId);
}

export async function createIntervention(i: {
  learner_id: string;
  issue: string;
  strategy?: string | null;
  expected_outcome?: string | null;
  follow_up_date?: string | null;
}) {
  const { error } = await supabase.from("interventions").insert({
    learner_id: i.learner_id, issue: i.issue, strategy: i.strategy || null,
    expected_outcome: i.expected_outcome || null, follow_up_date: i.follow_up_date || null,
  });
  if (error) throw error;
}

export async function updateIntervention(
  id: string,
  patch: Partial<Pick<InterventionRow, "status" | "actual_outcome" | "follow_up_date" | "strategy">>
) {
  const { error } = await supabase.from("interventions").update(patch).eq("id", id);
  if (error) throw error;
}

export interface OverdueFollowup {
  id: string;
  learner_id: string;
  learner_name: string;
  class_id: string;
  issue: string;
  follow_up_date: string;
  status: ProgressStatus;
}

/** Interventions whose follow-up date has passed and are not yet resolved. */
export async function getOverdueFollowups(classId?: string): Promise<OverdueFollowup[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("interventions")
    .select("id, learner_id, issue, follow_up_date, status, learners!inner(fullname, class_id)")
    .lt("follow_up_date", today)
    .neq("status", "Improved")
    .order("follow_up_date");
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => ({
      id: r.id, learner_id: r.learner_id, learner_name: r.learners?.fullname ?? "",
      class_id: r.learners?.class_id ?? "", issue: r.issue,
      follow_up_date: r.follow_up_date, status: r.status as ProgressStatus,
    }))
    .filter((r: OverdueFollowup) => !classId || r.class_id === classId);
}

/** Early-warning feed for the "who needs an intervention" panel. The average and
 *  risk level are recomputed from each learner's POST-JOIN scores, so a learner
 *  who joined in Term 2/3 is never flagged on terms they weren't there for (works
 *  without the database exemption migration). attendance/missing come from the
 *  view (these have no pre-join rows for a joiner). */
export async function getRiskList(classId?: string): Promise<RiskItem[]> {
  let rq = supabase.from("learner_risk_level").select("learner_id, fullname, class_id, attendance_pct, missing_assignments");
  let lq = supabase.from("learners").select("id, joined_session, joined_term");
  let sq = supabase.from("score_report").select("learner_id, total, term, session");
  if (classId) { rq = rq.eq("class_id", classId); lq = lq.eq("class_id", classId); sq = sq.eq("class_id", classId); }
  const [rRes, lRes, sRes] = await Promise.all([rq, lq, sq]);
  if (rRes.error) throw rRes.error;
  if (lRes.error) throw lRes.error;
  if (sRes.error) throw sRes.error;

  const joinById = new Map<string, { s: string | null; t: string | null }>();
  (lRes.data ?? []).forEach((l: any) => joinById.set(l.id, { s: l.joined_session ?? null, t: l.joined_term ?? null }));
  const scoresByLearner = new Map<string, { total: number; term: string; session: string }[]>();
  (sRes.data ?? []).forEach((s: any) => {
    const arr = scoresByLearner.get(s.learner_id) ?? [];
    arr.push({ total: s.total, term: s.term, session: s.session }); scoresByLearner.set(s.learner_id, arr);
  });

  return (rRes.data ?? []).map((r: any) => {
    const j = joinById.get(r.learner_id);
    const risk = postJoinRisk({
      scores: scoresByLearner.get(r.learner_id) ?? [], joinedSession: j?.s ?? null, joinedTerm: j?.t ?? null,
      attendancePct: r.attendance_pct ?? null, missing: r.missing_assignments ?? 0,
    });
    return {
      learner_id: r.learner_id, name: r.fullname, class_id: r.class_id,
      avg: risk.avg, attendance: Math.round(r.attendance_pct ?? 0),
      missing: r.missing_assignments ?? 0, level: risk.level,
    };
  });
}
