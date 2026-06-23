// oversight-queries.ts — supervisor/admin cross-teacher rollup.
// Reads across all teachers because the "supervisor read" RLS policies
// (migration_laims.sql) grant SELECT to supervisor/admin profiles.

import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

export interface OversightRow {
  class_id: string;
  class_label: string;
  teacher_name: string;
  learners: number;
  avg: number;
  atRisk: number;
  openInterventions: number;
}

export interface OversightSummary {
  rows: OversightRow[];
  totals: { teachers: number; classes: number; learners: number; atRisk: number; openInterventions: number };
  riskMix: { Low: number; Medium: number; High: number; Critical: number };
}

export async function getOversight(): Promise<OversightSummary> {
  const [classesRes, riskRes, intRes] = await Promise.all([
    supabase.from("classes").select("id, grade_level, arm, teacher_id, profiles!inner(fullname, email)"),
    supabase.from("learner_risk_level").select("learner_id, class_id, avg_total, risk_level"),
    supabase.from("interventions").select("status, learners!inner(class_id)"),
  ]);
  if (classesRes.error) throw classesRes.error;
  if (riskRes.error) throw riskRes.error;
  if (intRes.error) throw intRes.error;

  const risk = riskRes.data ?? [];
  const openByClass = new Map<string, number>();
  for (const i of intRes.data ?? []) {
    if (i.status === "Improved") continue; // closed/resolved
    const cid = (i as any).learners?.class_id;
    if (cid) openByClass.set(cid, (openByClass.get(cid) ?? 0) + 1);
  }

  const riskMix = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  for (const r of risk) riskMix[(r.risk_level ?? "Low") as keyof typeof riskMix]++;

  const rows: OversightRow[] = (classesRes.data ?? []).map((c: any) => {
    const mine = risk.filter((r: any) => r.class_id === c.id);
    const n = mine.length;
    const avg = n ? mine.reduce((s: number, r: any) => s + (r.avg_total ?? 0), 0) / n : 0;
    const atRisk = mine.filter((r: any) => r.risk_level === "High" || r.risk_level === "Critical").length;
    return {
      class_id: c.id, class_label: `${c.grade_level ?? ""} ${c.arm ?? ""}`.trim(),
      teacher_name: c.profiles?.fullname || c.profiles?.email || "—",
      learners: n, avg: Math.round(avg), atRisk, openInterventions: openByClass.get(c.id) ?? 0,
    };
  }).sort((a, b) => b.atRisk - a.atRisk || a.class_label.localeCompare(b.class_label));

  const teachers = new Set((classesRes.data ?? []).map((c: any) => c.teacher_id)).size;
  return {
    rows,
    totals: {
      teachers,
      classes: rows.length,
      learners: risk.length,
      atRisk: rows.reduce((s, r) => s + r.atRisk, 0),
      openInterventions: rows.reduce((s, r) => s + r.openInterventions, 0),
    },
    riskMix,
  };
}
