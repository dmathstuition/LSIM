import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

const ASSIGNMENTS_PER_TERM = 8;
export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export interface LearnerRow {
  id: string; adm: string; name: string;
  avg: number; attendance: number; missing: number; level: RiskLevel; declining: boolean;
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
  if (ids.length) {
    const { data: ls } = await supabase.from("learners").select("id, admission_number").in("id", ids);
    (ls ?? []).forEach((l: any) => admMap.set(l.id, l.admission_number));
  }
  return (data ?? []).map((r: any) => ({
    id: r.learner_id, adm: admMap.get(r.learner_id) ?? "", name: r.fullname,
    avg: Math.round(r.avg_total ?? 0), attendance: Math.round(r.attendance_pct ?? 0),
    missing: r.missing_assignments ?? 0, level: (r.risk_level ?? "Low") as RiskLevel,
    declining: (r.score_delta ?? 0) <= -5,
  }));
}

export function getKpis(rows: LearnerRow[]) {
  const n = rows.length || 1;
  const avg = rows.reduce((s, l) => s + l.avg, 0) / n;
  const att = rows.reduce((s, l) => s + l.attendance, 0) / n;
  const sub = (rows.reduce((s, l) => s + (ASSIGNMENTS_PER_TERM - l.missing), 0) / (n * ASSIGNMENTS_PER_TERM)) * 100;
  const pass = (rows.filter((l) => l.avg >= 50).length / n) * 100;
  const atRisk = rows.filter((l) => l.level === "High" || l.level === "Critical").length;
  return { n: rows.length, avg, att, sub, pass, atRisk };
}

export async function getScoreTrend(classId?: string) {
  let q = supabase.from("score_report").select("term, total, class_id");
  if (classId) q = q.eq("class_id", classId);
  const { data, error } = await q;
  if (error) throw error;
  const byTerm: Record<string, { sum: number; n: number }> = {};
  for (const r of data ?? []) { const b = (byTerm[r.term] ??= { sum: 0, n: 0 }); b.sum += r.total; b.n += 1; }
  return Object.entries(byTerm).map(([term, b]) => ({ term, avg: +(b.sum / b.n).toFixed(1) }))
    .sort((a, b) => a.term.localeCompare(b.term));
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

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((date.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  return `W${String(wk).padStart(2, "0")}`;
}
