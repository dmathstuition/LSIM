import { createClient } from "@/lib/supabase/client";
import { computeKpis, isoWeek, componentPct, joinedAfter, postJoinRisk, type RiskLevel, type ScoreComponent } from "@/lib/grading";
const supabase = createClient();

export type { RiskLevel };
/** Per-learner average for each assessment component, as a % of its max. */
export type ComponentPct = Record<ScoreComponent, number>;
export interface LearnerRow {
  id: string; adm: string; name: string;
  gender: string | null; sen: boolean; residency: string | null; origin: string | null;
  /** The school's manually-assigned achiever band: "HPA" | "LPA" | null (not determined). */
  school_band: string | null;
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

// Whole-child early-warning inputs for one learner. attendance_pct is kept
// NULLABLE (no attendance record → null → no risk penalty, mirroring the SQL);
// the academic average, risk level and trend are recomputed from POST-JOIN scores
// in computeLearners, so a mid-term joiner's earlier terms never count even if the
// database exemption migration hasn't been applied.
export interface RawLearner {
  id: string; name: string; adm: string;
  gender: string | null; sen: boolean; residency: string | null; origin: string | null;
  school_band: string | null;
  attendance_pct: number | null; missing: number;
  joined_session: string | null; joined_term: string | null;
}

/** True if the learner joined AFTER the selected term — so they weren't in the
 *  class yet and must be excluded from that term's view entirely (a Term-2 joiner
 *  must not appear in any Term-1 analysis). Compared by term only (see
 *  grading.joinedAfter); NULL join term = present from the start. */
function joinedAfterScope(_js: string | null, jt: string | null, scope: ScoreScope): boolean {
  if (!jt || !scope.term) return false;
  return jt > scope.term;
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
  // attendance % and missing-work come from the view (these have no pre-join rows
  // for a joiner); scores + join term come from the tables so we can recompute the
  // average/risk excluding pre-join terms in the app.
  let riskQ = supabase.from("learner_risk_level")
    .select("learner_id, fullname, attendance_pct, missing_assignments");
  let learnersQ = supabase.from("learners").select("id, admission_number, gender, joined_session, joined_term, sen, residency, origin, school_band");
  let scoresQ = supabase.from("score_report").select("learner_id, subject_id, term, session, first_ca, second_ca, exam, total");
  if (classId) { riskQ = riskQ.eq("class_id", classId); learnersQ = learnersQ.eq("class_id", classId); scoresQ = scoresQ.eq("class_id", classId); }

  const [riskRes, lRes, sRes] = await Promise.all([riskQ, learnersQ, scoresQ]);
  if (riskRes.error) throw riskRes.error;
  if (lRes.error) throw lRes.error;
  if (sRes.error) throw sRes.error;

  const attrMap = new Map<string, any>();
  (lRes.data ?? []).forEach((l: any) => attrMap.set(l.id, l));

  const learners: RawLearner[] = (riskRes.data ?? []).map((r: any) => {
    const a = attrMap.get(r.learner_id) ?? {};
    return {
      id: r.learner_id, name: r.fullname, adm: a.admission_number ?? "",
      gender: a.gender ?? null, sen: a.sen ?? false, residency: a.residency ?? null, origin: a.origin ?? null,
      school_band: a.school_band ?? null,
      attendance_pct: r.attendance_pct ?? null, missing: r.missing_assignments ?? 0,
      joined_session: a.joined_session ?? null, joined_term: a.joined_term ?? null,
    };
  });
  const scores: RawScore[] = (sRes.data ?? []).map((s: any) => ({
    learner_id: s.learner_id, subject_id: s.subject_id, term: s.term, session: s.session,
    first_ca: s.first_ca, second_ca: s.second_ca, exam: s.exam, total: s.total,
  }));
  return { learners, scores };
}

/** Drop any score row from a term BEFORE that learner joined — they have no
 *  records for it, so it must never be analysed (mirrors the SQL exemption, but
 *  in the app so it works without the migration). */
export function eligibleScores(raw: DashboardRaw): RawScore[] {
  const join = new Map(raw.learners.map((l) => [l.id, l]));
  return raw.scores.filter((s) => {
    const l = join.get(s.learner_id);
    return !l || !joinedAfter(l.joined_session, l.joined_term, s.session, s.term);
  });
}

/** Per-learner rows for the current scope — pure, derived from DashboardRaw.
 *  Academic `avg`/`comp`/`hasScore` come from the in-scope score rows; the
 *  whole-child risk `level`/`declining` are RECOMPUTED from the learner's
 *  post-join scores (so a mid-term joiner is never flagged on earlier terms,
 *  whether or not the DB migration is applied). */
export function computeLearners(raw: DashboardRaw, scope: ScoreScope = {}): LearnerRow[] {
  const { subjectId, term, session } = scope;
  const academicScoped = Boolean(subjectId || term || session);
  const elig = eligibleScores(raw);                      // pre-join rows already removed
  const scopedByLearner = new Map<string, RawScore[]>();
  const allByLearner = new Map<string, RawScore[]>();
  for (const s of elig) {
    (allByLearner.get(s.learner_id) ?? allByLearner.set(s.learner_id, []).get(s.learner_id)!).push(s);
    if (subjectId && s.subject_id !== subjectId) continue;
    if (term && s.term !== term) continue;
    if (session && s.session !== session) continue;
    (scopedByLearner.get(s.learner_id) ?? scopedByLearner.set(s.learner_id, []).get(s.learner_id)!).push(s);
  }
  const emptyComp: ComponentPct = { total: 0, first_ca: 0, second_ca: 0, exam: 0 };
  return raw.learners
    // Drop learners who joined after the selected term/session — not in the class
    // yet, so excluded from that view entirely (incl. the "needs attention" panels).
    .filter((l) => !joinedAfterScope(l.joined_session, l.joined_term, scope))
    .map((l) => {
      const rows = scopedByLearner.get(l.id) ?? [];
      const risk = postJoinRisk({
        scores: allByLearner.get(l.id) ?? [], joinedSession: l.joined_session, joinedTerm: l.joined_term,
        attendancePct: l.attendance_pct, missing: l.missing,
      });
      const avg = academicScoped
        ? (rows.length ? Math.round(rows.reduce((a, r) => a + r.total, 0) / rows.length) : 0)
        : risk.avg;
      return {
        id: l.id, adm: l.adm, name: l.name,
        gender: l.gender, sen: l.sen, residency: l.residency, origin: l.origin, school_band: l.school_band,
        avg, attendance: Math.round(l.attendance_pct ?? 0), missing: l.missing,
        level: risk.level, declining: risk.declining,
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
// from the already-fetched DashboardRaw scores, with pre-join terms excluded.
export function computeScoreTrend(raw: DashboardRaw, scope: ScoreScope = {}): TrendPoint[] {
  const { subjectId, session } = scope;
  type Acc = { total: number; first_ca: number; second_ca: number; exam: number; n: number };
  const byTerm: Record<string, Acc> = {};
  for (const r of eligibleScores(raw)) {
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

/** Per-term average total for the two school-judgement cohorts: learners the
 *  school HAS categorised (school_band set to HPA/LPA) vs those it has NOT.
 *  Drives the "determined vs not-determined progress" comparison. Pure, derived
 *  from the already-fetched raw scores (pre-join terms excluded). Each cohort's
 *  point is null in a term where that cohort has no marks. */
export interface CohortTrendPoint { term: string; determined: number | null; notDetermined: number | null; }
export function computeDeterminedTrend(raw: DashboardRaw, scope: ScoreScope = {}): CohortTrendPoint[] {
  const { subjectId, session } = scope;
  const isDetermined = new Map<string, boolean>(raw.learners.map((l) => [l.id, Boolean(l.school_band)]));
  const byTerm: Record<string, { dSum: number; dN: number; nSum: number; nN: number }> = {};
  for (const r of eligibleScores(raw)) {
    if (subjectId && r.subject_id !== subjectId) continue;
    if (session && r.session !== session) continue;
    const b = (byTerm[r.term] ??= { dSum: 0, dN: 0, nSum: 0, nN: 0 });
    if (isDetermined.get(r.learner_id)) { b.dSum += r.total; b.dN += 1; }
    else { b.nSum += r.total; b.nN += 1; }
  }
  return Object.entries(byTerm).map(([term, b]) => ({
    term,
    determined: b.dN ? Math.round(b.dSum / b.dN) : null,
    notDetermined: b.nN ? Math.round(b.nSum / b.nN) : null,
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
