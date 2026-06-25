// grading.ts — pure, dependency-free scoring/banding rules.
// Mirrors the SQL truth (grade_for, performance_category, learner_risk view) so
// the front end never duplicates the rules divergently. No supabase import →
// safe to unit-test in isolation.

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export const ASSIGNMENTS_PER_TERM = 8;

/** Assessment components and their maximum marks (CA1 & CA2 /20, Exam /60, Total /100). */
export const COMPONENT_CAPS = { total: 100, first_ca: 20, second_ca: 20, exam: 60 } as const;
export type ScoreComponent = keyof typeof COMPONENT_CAPS;
export const COMPONENT_LABELS: Record<ScoreComponent, string> = {
  total: "Total", first_ca: "CA1", second_ca: "CA2", exam: "Exam",
};
/** Order for selectors/breakdown: the two tests, the exam, then the total. */
export const COMPONENT_ORDER: ScoreComponent[] = ["first_ca", "second_ca", "exam", "total"];

/** A raw component mark as a percentage of its maximum (0–100). */
export function componentPct(component: ScoreComponent, value: number): number {
  return (value / COMPONENT_CAPS[component]) * 100;
}

export const BANDS = [
  { name: "Outstanding", min: 80, color: "#1FA97A" },
  { name: "Very Good", min: 70, color: "#5BB04A" },
  { name: "Good", min: 60, color: "#C9A227" },
  { name: "Fair", min: 50, color: "#E08A1E" },
  { name: "Needs Improv.", min: 40, color: "#DB6334" },
  { name: "At Risk", min: 0, color: "#D2353A" },
] as const;

/** Letter grade — matches SQL grade_for(). */
export function gradeFor(total: number): "A" | "B" | "C" | "D" | "E" | "F" {
  if (total >= 80) return "A";
  if (total >= 70) return "B";
  if (total >= 60) return "C";
  if (total >= 50) return "D";
  if (total >= 40) return "E";
  return "F";
}

/** Performance category — matches SQL performance_category(). */
export function performanceCategory(total: number): string {
  if (total >= 80) return "Outstanding";
  if (total >= 70) return "Very Good";
  if (total >= 60) return "Good";
  if (total >= 50) return "Fair";
  if (total >= 40) return "Needs Improvement";
  return "At Risk";
}

/** Band (name + color) for a score. */
export function bandOf(total: number) {
  return BANDS.find((b) => total >= b.min) ?? BANDS[BANDS.length - 1];
}

/** Risk score — mirrors the learner_risk SQL view (max 9 incl. decline). */
export function riskScore(i: { avg: number; attendancePct: number; missing: number; delta: number }): number {
  const s1 = i.avg < 40 ? 3 : i.avg < 50 ? 2 : 0;
  const s2 = i.attendancePct < 60 ? 2 : i.attendancePct < 75 ? 1 : 0;
  const s3 = i.missing >= 3 ? 2 : i.missing >= 1 ? 1 : 0;
  const s4 = i.delta <= -10 ? 2 : i.delta <= -5 ? 1 : 0;
  return s1 + s2 + s3 + s4;
}

/** Bucket a risk score — mirrors learner_risk_level. */
export function riskLevel(score: number): RiskLevel {
  if (score >= 6) return "Critical";
  if (score >= 4) return "High";
  if (score >= 2) return "Medium";
  return "Low";
}

/** Did a learner who joined at (js, jt) start AFTER the given (session, term)?
 *  NULL join term = present from the start. Lexical compare ("2024/2025" <
 *  "2025/2026", "Term 1" < "Term 2"), matching the SQL join-term exemption. */
export function joinedAfter(js: string | null, jt: string | null, session: string, term: string): boolean {
  if (!jt) return false;
  if (js) return js > session || (js === session && jt > term);
  return jt > term;
}

export interface RiskScoreRow { total: number; session: string; term: string; }
/**
 * Recompute a learner's early-warning result from their POST-JOIN scores only,
 * mirroring the learner_risk SQL view (and its NULL handling: no scores → no
 * average penalty; no attendance record → no attendance penalty). This lets the
 * app exempt a mid-term joiner's earlier terms from the "needs support" flags
 * even when the database migration hasn't been applied — a Term-2 joiner is never
 * judged on Term 1, whether or not Term-1 rows exist.
 */
export function postJoinRisk(opts: {
  scores: RiskScoreRow[]; joinedSession: string | null; joinedTerm: string | null;
  attendancePct: number | null; missing: number;
}): { avg: number; hasScore: boolean; delta: number; level: RiskLevel; declining: boolean } {
  const elig = opts.scores.filter((s) => !joinedAfter(opts.joinedSession, opts.joinedTerm, s.session, s.term));
  const hasScore = elig.length > 0;
  const avg = hasScore ? elig.reduce((a, s) => a + s.total, 0) / elig.length : 0;

  // term-over-term decline, from post-join term averages (latest minus previous)
  const byTerm = new Map<string, { sum: number; n: number }>();
  for (const s of elig) {
    const k = `${s.session}|${s.term}`;
    const b = byTerm.get(k) ?? { sum: 0, n: 0 };
    b.sum += s.total; b.n += 1; byTerm.set(k, b);
  }
  const terms = [...byTerm.entries()].map(([k, v]) => ({ k, a: v.sum / v.n })).sort((x, y) => y.k.localeCompare(x.k));
  const delta = terms.length >= 2 ? terms[0].a - terms[1].a : 0;

  const s1 = hasScore ? (avg < 40 ? 3 : avg < 50 ? 2 : 0) : 0;
  const s2 = opts.attendancePct == null ? 0 : opts.attendancePct < 60 ? 2 : opts.attendancePct < 75 ? 1 : 0;
  const s3 = opts.missing >= 3 ? 2 : opts.missing >= 1 ? 1 : 0;
  const s4 = delta <= -10 ? 2 : delta <= -5 ? 1 : 0;
  return { avg: Math.round(avg), hasScore, delta, level: riskLevel(s1 + s2 + s3 + s4), declining: delta <= -5 };
}

export interface KpiRow { avg: number; attendance: number; missing: number; level: RiskLevel; }

/** Class KPIs from learner rows. */
export function computeKpis(rows: KpiRow[]) {
  const n = rows.length || 1;
  return {
    n: rows.length,
    avg: rows.reduce((s, l) => s + l.avg, 0) / n,
    att: rows.reduce((s, l) => s + l.attendance, 0) / n,
    sub: (rows.reduce((s, l) => s + (ASSIGNMENTS_PER_TERM - l.missing), 0) / (n * ASSIGNMENTS_PER_TERM)) * 100,
    pass: (rows.filter((l) => l.avg >= 50).length / n) * 100,
    atRisk: rows.filter((l) => l.level === "High" || l.level === "Critical").length,
  };
}

/** ISO week label (e.g. "W07") for an attendance date. */
export function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((date.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  return `W${String(wk).padStart(2, "0")}`;
}
