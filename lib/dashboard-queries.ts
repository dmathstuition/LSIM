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
  /** True if the learner has ≥1 score row in the current scope (the selected
   *  subject, or any subject when none is selected). Academic panels filter on it. */
  hasScore: boolean;
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

/** Scope filters for the academic (score-derived) panels. */
export interface ScoreScope { subjectId?: string; term?: string; session?: string; }

/** Distinct sessions and terms present in the teacher's scores, for the filters. */
export async function getScorePeriods(): Promise<{ sessions: string[]; terms: string[] }> {
  const { data, error } = await supabase.from("score_report").select("term, session");
  if (error) throw error;
  const sessions = [...new Set((data ?? []).map((r: any) => r.session).filter(Boolean))].sort().reverse();
  const terms = [...new Set((data ?? []).map((r: any) => r.term).filter(Boolean))].sort();
  return { sessions, terms };
}

/**
 * All of the teacher's learners (RLS-scoped), optionally narrowed to one class.
 *
 * `scope` re-scopes only the academic fields: when a subject, term or session is
 * given, each learner's `avg` and `comp` come from the matching `score_report`
 * rows (and `hasScore` is true only for learners with marks in that scope). The
 * whole-child early-warning fields — `attendance`, `missing`, `level`,
 * `declining` — always come from `learner_risk_level`, which is computed across
 * all subjects/terms (attendance & assignments are not term-scoped in the schema).
 */
export async function getLearners(classId?: string, scope: ScoreScope = {}): Promise<LearnerRow[]> {
  const { subjectId, term, session } = scope;
  const academicScoped = Boolean(subjectId || term || session);
  let q = supabase.from("learner_risk_level")
    .select("learner_id, fullname, class_id, avg_total, attendance_pct, missing_assignments, risk_level, score_delta");
  if (classId) q = q.eq("class_id", classId);
  const { data, error } = await q;
  if (error) throw error;

  const ids = (data ?? []).map((r: any) => r.learner_id);
  const admMap = new Map<string, string>();
  const compMap = new Map<string, ComponentPct>();
  const scopedAvg = new Map<string, number>();   // mean total within the scope
  if (ids.length) {
    const { data: ls } = await supabase.from("learners").select("id, admission_number").in("id", ids);
    (ls ?? []).forEach((l: any) => admMap.set(l.id, l.admission_number));

    // Per-component averages come from the raw component marks in score_report,
    // optionally narrowed to a subject / term / session.
    let sq = supabase.from("score_report").select("learner_id, first_ca, second_ca, exam, total, class_id");
    if (classId) sq = sq.eq("class_id", classId);
    if (subjectId) sq = sq.eq("subject_id", subjectId);
    if (term) sq = sq.eq("term", term);
    if (session) sq = sq.eq("session", session);
    const { data: sr } = await sq;
    const byLearner = new Map<string, any[]>();
    (sr ?? []).forEach((r: any) => {
      const arr = byLearner.get(r.learner_id) ?? [];
      arr.push(r); byLearner.set(r.learner_id, arr);
    });
    byLearner.forEach((rows, lid) => {
      compMap.set(lid, componentAverages(rows));
      scopedAvg.set(lid, rows.reduce((s, r) => s + r.total, 0) / rows.length);
    });
  }
  const emptyComp: ComponentPct = { total: 0, first_ca: 0, second_ca: 0, exam: 0 };
  return (data ?? []).map((r: any) => {
    const hasScore = compMap.has(r.learner_id);
    // Within a scope the academic average is that scope's mean total (max = 100,
    // so already a %); otherwise the all-time avg from the early-warning view.
    const avg = academicScoped
      ? Math.round(scopedAvg.get(r.learner_id) ?? 0)
      : Math.round(r.avg_total ?? 0);
    return {
      id: r.learner_id, adm: admMap.get(r.learner_id) ?? "", name: r.fullname,
      avg, attendance: Math.round(r.attendance_pct ?? 0),
      missing: r.missing_assignments ?? 0, level: (r.risk_level ?? "Low") as RiskLevel,
      declining: (r.score_delta ?? 0) <= -5,
      comp: compMap.get(r.learner_id) ?? emptyComp,
      hasScore,
    };
  });
}

export function getKpis(rows: LearnerRow[]) {
  return computeKpis(rows);
}

export interface TrendPoint { term: string; total: number; first_ca: number; second_ca: number; exam: number; }

// The trend deliberately spans terms (that's its point), so `term` is ignored
// here; a selected `session` still narrows it to one academic year.
export async function getScoreTrend(classId?: string, scope: ScoreScope = {}): Promise<TrendPoint[]> {
  const { subjectId, session } = scope;
  let q = supabase.from("score_report").select("term, first_ca, second_ca, exam, total, class_id");
  if (classId) q = q.eq("class_id", classId);
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (session) q = q.eq("session", session);
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
