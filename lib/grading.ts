// grading.ts — pure, dependency-free scoring/banding rules.
// Mirrors the SQL truth (grade_for, performance_category, learner_risk view) so
// the front end never duplicates the rules divergently. No supabase import →
// safe to unit-test in isolation.

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export const ASSIGNMENTS_PER_TERM = 8;

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
