import { createClient } from "@/lib/supabase/client";
import { computeKpis, isoWeek, componentPct, type RiskLevel, type ScoreComponent } from "@/lib/grading";
const supabase = createClient();

export type { RiskLevel };
/** Per-learner average for each assessment component, as a % of its max. */
export type ComponentPct = Record<ScoreComponent, number>;
export interface LearnerRow {
  id: string; adm: string; name: string; gender: string | null;
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

// Whole-child early-warning fields for one learner (from learner_risk_level).
export interface RawLearner {
  id: string; name: string; adm: string; gender: string | null;
  avg_total: number; attendance_pct: number; missing: number; level: RiskLevel; declining: boolean;
}
// One score_report row (component marks per subject/term/session).
export interface RawScore {
  learner_id: string; subject_id: string; term: string; session: string;
  first_ca: number; second_ca: number; exam: number; total: number;
}
/** Everything the dashboard needs for one arm — fetched ONCE, then filtered by
 *  subject/term/session entirely in the browser (no refetch per dropdown). */
export interface DashboardRaw { learners: RawLearner[]; scores: RawScore[]; }

/**
 * Fetch the dashboard's raw data for an arm (or all arms) in three parallel
 * queries. The per-subject/term/session views are derived client-side from this
 * by computeLearners / computeScoreTrend, so changing a filter never hits the DB.
 */
export async function getDashboardRaw(classId?: string): Promise<DashboardRaw> {
  let riskQ = supabase.from("learner_risk_level")
    .select("learner_id, fullname, avg_total, attendance_pct, missing_assignments, risk_level, score_delta");
  let learnersQ = supabase.from("learners").select("id, admission_number, gender");
  let scoresQ = supabase.from("score_report").select("learner_id, subject_id, term, session, first_ca, second_ca, exam, total");
  if (classId) { riskQ = riskQ.eq("class_id", classId); learnersQ = learnersQ.eq("class_id", classId); scoresQ = scoresQ.eq("class_id", classId); }

  const [riskRes, lRes, sRes] = await Promise.all([riskQ, learnersQ, scoresQ]);
  if (riskRes.error) throw riskRes.error;
  if (lRes.error) throw lRes.error;
  if (sRes.error) throw sRes.error;

  const admMap = new Map<string, string>();
  const genderMap = new Map<string, string | null>();
  (lRes.data ?? []).forEach((l: any) => { admMap.set(l.id, l.admission_number); genderMap.set(l.id, l.gender ?? null); });

  const learners: RawLearner[] = (riskRes.data ?? []).map((r: any) => ({
    id: r.learner_id, name: r.fullname, adm: admMap.get(r.learner_id) ?? "", gender: genderMap.get(r.learner_id) ?? null,
    avg_total: r.avg_total ?? 0, attendance_pct: r.attendance_pct ?? 0, missing: r.missing_assignments ?? 0,
    level: (r.risk_level ?? "Low") as RiskLevel, declining: (r.score_delta ?? 0) <= -5,
  }));
  const scores: RawScore[] = (sRes.data ?? []).map((s: any) => ({
    learner_id: s.learner_id, subject_id: s.subject_id, term: s.term, session: s.session,
    first_ca: s.first_ca, second_ca: s.second_ca, exam: s.exam, total: s.total,
  }));
  return { learners, scores };
}

/** Per-learner rows for the current scope — pure, derived from DashboardRaw.
 *  When a subject/term/session is selected, `avg`/`comp`/`hasScore` come from the
 *  matching score rows; otherwise from the learner's all-time `avg_total`. The
 *  whole-child fields (attendance/missing/level/declining) are always all-time. */
export function computeLearners(raw: DashboardRaw, scope: ScoreScope = {}): LearnerRow[] {
  const { subjectId, term, session } = scope;
  const academicScoped = Boolean(subjectId || term || session);
  const byLearner = new Map<string, RawScore[]>();
  for (const s of raw.scores) {
    if (subjectId && s.subject_id !== subjectId) continue;
    if (term && s.term !== term) continue;
    if (session && s.session !== session) continue;
    const arr = byLearner.get(s.learner_id);
    if (arr) arr.push(s); else byLearner.set(s.learner_id, [s]);
  }
  const emptyComp: ComponentPct = { total: 0, first_ca: 0, second_ca: 0, exam: 0 };
  return raw.learners.map((l) => {
    const rows = byLearner.get(l.id) ?? [];
    const avg = academicScoped
      ? (rows.length ? Math.round(rows.reduce((a, r) => a + r.total, 0) / rows.length) : 0)
      : Math.round(l.avg_total);
    return {
      id: l.id, adm: l.adm, name: l.name, gender: l.gender,
      avg, attendance: Math.round(l.attendance_pct), missing: l.missing,
      level: l.level, declining: l.declining,
      comp: rows.length ? componentAverages(rows) : emptyComp,
      hasScore: rows.length > 0,
    };
  });
}

export function getKpis(rows: LearnerRow[]) {
  return computeKpis(rows);
}

export interface TrendPoint { term: string; total: number; first_ca: number; second_ca: number; exam: number; }

// The trend deliberately spans terms (that's its point), so `term` is ignored
// here; a selected `session` still narrows it to one academic year. Pure: derived
// from the already-fetched DashboardRaw scores.
export function computeScoreTrend(scores: RawScore[], scope: ScoreScope = {}): TrendPoint[] {
  const { subjectId, session } = scope;
  type Acc = { total: number; first_ca: number; second_ca: number; exam: number; n: number };
  const byTerm: Record<string, Acc> = {};
  for (const r of scores) {
    if (subjectId && r.subject_id !== subjectId) continue;
    if (session && r.session !== session) continue;
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
