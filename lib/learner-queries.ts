// learner-queries.ts — 360° per-learner bundle for the profile / report-card page.

import { createClient } from "@/lib/supabase/client";
import type { InterventionRow, ProgressStatus } from "@/lib/intervention-queries";
const supabase = createClient();

export interface ScoreLine {
  subject_id: string;
  subject_name: string;
  term: string;
  session: string;
  first_ca: number;
  second_ca: number;
  exam: number;
  total: number;
  grade: string;
  category: string;
  position: number | null;
}
export interface AttRecent { date: string; status: string; }
export interface SubLine { title: string; due_date: string | null; status: string; }

export interface LearnerProfileData {
  learner: {
    id: string; admission_number: string; fullname: string; gender: string | null;
    class_label: string; guardian_name: string | null; guardian_phone: string | null;
    joined_session: string | null; joined_term: string | null;
  };
  risk: { avg: number; attendance: number; missing: number; level: string };
  scores: ScoreLine[];
  attendance: { present: number; absent: number; late: number; total: number; pct: number; recent: AttRecent[]; all: AttRecent[] };
  submissions: SubLine[];
  interventions: InterventionRow[];
}

export async function getLearnerProfile(id: string): Promise<LearnerProfileData> {
  const { data: l, error: le } = await supabase
    .from("learners")
    .select("id, admission_number, fullname, gender, guardian_name, guardian_phone, joined_session, joined_term, class_id, classes!inner(grade_level, arm)")
    .eq("id", id)
    .single();
  if (le) throw le;

  const [scoresRes, subjectsRes, riskRes, attRes, subsRes, intRes] = await Promise.all([
    supabase.from("score_report")
      .select("subject_id, term, session, first_ca, second_ca, exam, total, grade, category, position")
      .eq("learner_id", id),
    supabase.from("subjects").select("id, subject_name"),
    supabase.from("learner_risk_level")
      .select("avg_total, attendance_pct, missing_assignments, risk_level")
      .eq("learner_id", id).maybeSingle(),
    supabase.from("attendance").select("date, status").eq("learner_id", id).order("date", { ascending: false }),
    supabase.from("submissions")
      .select("status, assignments!inner(title, due_date)")
      .eq("learner_id", id),
    supabase.from("interventions")
      .select("id, learner_id, issue, date_identified, strategy, expected_outcome, actual_outcome, follow_up_date, status")
      .eq("learner_id", id).order("date_identified", { ascending: false }),
  ]);
  if (scoresRes.error) throw scoresRes.error;

  const subjName = new Map<string, string>((subjectsRes.data ?? []).map((s: any) => [s.id, s.subject_name]));
  const scores: ScoreLine[] = (scoresRes.data ?? []).map((s: any) => ({
    subject_id: s.subject_id, subject_name: subjName.get(s.subject_id) ?? "—",
    term: s.term, session: s.session, first_ca: s.first_ca, second_ca: s.second_ca,
    exam: s.exam, total: s.total, grade: s.grade, category: s.category, position: s.position,
  })).sort((a, b) => a.session.localeCompare(b.session) || a.term.localeCompare(b.term) || a.subject_name.localeCompare(b.subject_name));

  const att = attRes.data ?? [];
  const present = att.filter((a: any) => a.status === "Present").length;
  const absent = att.filter((a: any) => a.status === "Absent").length;
  const late = att.filter((a: any) => a.status === "Late").length;
  const total = att.length;

  const submissions: SubLine[] = (subsRes.data ?? []).map((s: any) => ({
    title: s.assignments?.title ?? "—", due_date: s.assignments?.due_date ?? null, status: s.status,
  }));

  const interventions: InterventionRow[] = (intRes.data ?? []).map((r: any) => ({
    id: r.id, learner_id: r.learner_id, learner_name: (l as any).fullname, class_id: (l as any).class_id,
    issue: r.issue, date_identified: r.date_identified, strategy: r.strategy,
    expected_outcome: r.expected_outcome, actual_outcome: r.actual_outcome,
    follow_up_date: r.follow_up_date, status: r.status as ProgressStatus,
  }));

  const cls = (l as any).classes;
  return {
    learner: {
      id: (l as any).id, admission_number: (l as any).admission_number, fullname: (l as any).fullname,
      gender: (l as any).gender, class_label: `${cls?.grade_level ?? ""} ${cls?.arm ?? ""}`.trim(),
      guardian_name: (l as any).guardian_name, guardian_phone: (l as any).guardian_phone,
      joined_session: (l as any).joined_session ?? null, joined_term: (l as any).joined_term ?? null,
    },
    risk: {
      avg: Math.round(riskRes.data?.avg_total ?? 0), attendance: Math.round(riskRes.data?.attendance_pct ?? 0),
      missing: riskRes.data?.missing_assignments ?? 0, level: riskRes.data?.risk_level ?? "Low",
    },
    scores,
    attendance: { present, absent, late, total, pct: total ? Math.round((present / total) * 100) : 0, recent: att.slice(0, 10), all: att },
    submissions,
    interventions,
  };
}

export interface LearnerSearchResult { id: string; fullname: string; admission_number: string; class_label: string; }

/** Search the teacher's learners by name or admission number (RLS-scoped). */
export async function searchLearners(query: string): Promise<LearnerSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const safe = q.replace(/[%,]/g, " ");
  const { data, error } = await supabase
    .from("learners")
    .select("id, fullname, admission_number, classes(grade_level, arm)")
    .or(`fullname.ilike.%${safe}%,admission_number.ilike.%${safe}%`)
    .order("fullname")
    .limit(8);
  if (error) throw error;
  return (data ?? []).map((l: any) => ({
    id: l.id, fullname: l.fullname, admission_number: l.admission_number,
    class_label: `${l.classes?.grade_level ?? ""} ${l.classes?.arm ?? ""}`.trim(),
  }));
}
