import { createClient } from "@/lib/supabase/client";
import { computeKpis, isoWeek, componentPct, type RiskLevel, type ScoreComponent } from "@/lib/grading";
const supabase = createClient();

export type { RiskLevel };
/** Per-learner average for each assessment component, as a % of its max. */
export type ComponentPct = Record<ScoreComponent, number>;
export interface LearnerRow {
  id: string; adm: string; name: string;
  avg: number; attendance: number; missing: number; level: RiskLevel; declining: boolean;
  comp: ComponentPct;
}

/** Average each component across a learner's score rows, expressed as % of its max. */
function componentAverages(rows: { first_ca: number; second_ca: number; exam: number; total: number }[]): ComponentPct {
  const empty: ComponentPct = { total: 0, first_ca: 0, second_ca: 0, exam: 0 };
  if (!rows.length) return empty;
  const sum = rows.reduce((a, r) => ({
    total: a.total + r.total, first_ca: a.first_ca + r.first_ca,
    second_ca: a.second_ca + r.second_ca, exam: a.exam + r.exam,
  }), { ...empty });
  return {
    total: Math.round(componentPct("total", sum.total / rows.length)),
    first_ca: Math.round(componentPct("first_ca", sum.first_ca / rows.length)),
    second_ca: Math.round(componentPct("second_ca", sum.second_ca / rows.length)),
    exam: Math.round(componentPct("exam", sum.exam / rows.length)),
  };
}

/** All of the teacher's learners (RLS-scoped), optionally one class. */
export async function getLearners(classId?: string): Promise<LearnerRow[]> {
  let q = supabase.from("learner_risk_level")
    .select("learner_id, fullname, class_id, avg_total, attendance_pct, missing_assignments, risk_level, score_delta");
  if (classId) q = q.eq("class_id", classId);
  const { data, error } = await q;
  if (error) throw error;

  const ids = (data ?? []).map((r: any) => r.learner_id);
  const admMap = new Map<string, string>();
  const compMap = new Map<string, ComponentPct>();
  if (ids.length) {
    const { data: ls } = await supabase.from("learners").select("id, admission_number").in("id", ids);
    (ls ?? []).forEach((l: any) => admMap.set(l.id, l.admission_number));

    // Per-component averages come from the raw component marks in score_report.
    let sq = supabase.from("score_report").select("learner_id, first_ca, second_ca, exam, total, class_id");
    if (classId) sq = sq.eq("class_id", classId);
    const { data: sr } = await sq;
    const byLearner = new Map<string, any[]>();
    (sr ?? []).forEach((r: any) => {
      const arr = byLearner.get(r.learner_id) ?? [];
      arr.push(r); byLearner.set(r.learner_id, arr);
    });
    byLearner.forEach((rows, lid) => compMap.set(lid, componentAverages(rows)));
  }
  const emptyComp: ComponentPct = { total: 0, first_ca: 0, second_ca: 0, exam: 0 };
  return (data ?? []).map((r: any) => ({
    id: r.learner_id, adm: admMap.get(r.learner_id) ?? "", name: r.fullname,
    avg: Math.round(r.avg_total ?? 0), attendance: Math.round(r.attendance_pct ?? 0),
    missing: r.missing_assignments ?? 0, level: (r.risk_level ?? "Low") as RiskLevel,
    declining: (r.score_delta ?? 0) <= -5,
    comp: compMap.get(r.learner_id) ?? emptyComp,
  }));
}

export function getKpis(rows: LearnerRow[]) {
  return computeKpis(rows);
}

export interface TrendPoint { term: string; total: number; first_ca: number; second_ca: number; exam: number; }

export async function getScoreTrend(classId?: string): Promise<TrendPoint[]> {
  let q = supabase.from("score_report").select("term, first_ca, second_ca, exam, total, class_id");
  if (classId) q = q.eq("class_id", classId);
  const { data, error } = await q;
  if (error) throw error;
  type Acc = { total: number; first_ca: number; second_ca: number; exam: number; n: number };
  const byTerm: Record<string, Acc> = {};
  for (const r of data ?? []) {
    const b = (byTerm[r.term] ??= { total: 0, first_ca: 0, second_ca: 0, exam: 0, n: 0 });
    b.total += r.total; b.first_ca += r.first_ca; b.second_ca += r.second_ca; b.exam += r.exam; b.n += 1;
  }
  return Object.entries(byTerm).map(([term, b]) => ({
    term,
    total: +componentPct("total", b.total / b.n).toFixed(1),
    first_ca: +componentPct("first_ca", b.first_ca / b.n).toFixed(1),
    second_ca: +componentPct("second_ca", b.second_ca / b.n).toFixed(1),
    exam: +componentPct("exam", b.exam / b.n).toFixed(1),
  })).sort((a, b) => a.term.localeCompare(b.term));
}

export async function getAttendanceTrend(classId?: string) {
  let q = supabase.from("attendance").select("date, status, learners!inner(class_id)");
  if (classId) q = q.eq("learners.class_id", classId);
  const { data, error } = await q;
  if (error) throw error;
  const byWeek: Record<string, { present: number; total: number }> = {};
  for (const r of data ?? []) {
    const wk = isoWeek(new Date(r.date));
    const b = (byWeek[wk] ??= { present: 0, total: 0 });
    b.total += 1; if (r.status === "Present") b.present += 1;
  }
  return Object.entries(byWeek).map(([w, b]) => ({ w, v: Math.round((b.present / b.total) * 100) }))
    .sort((a, b) => a.w.localeCompare(b.w));
}
