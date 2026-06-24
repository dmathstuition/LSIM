// score-import.ts — map a parsed CSV onto the current score roster.
// Pure (no Supabase): the grid keeps one Row per learner; we fill CA1/CA2/Exam
// from the file by matching learner name (admission number as a fallback), and
// report what matched, what didn't, and any out-of-range cells.

export interface ImportRow { learner_id: string; adm: string; name: string; first_ca: number; second_ca: number; exam: number; }
export interface ImportCaps { first_ca: number; second_ca: number; exam: number; }
export interface ImportResult {
  rows: ImportRow[];
  matched: number;
  unmatched: string[];   // CSV name/key values with no roster match (incl. ambiguous)
  missing: string[];     // roster learners absent from the file (left unchanged)
  overCap: number;       // cells whose value exceeds its cap
}

// Header alias sets, compared after normalization (lowercase, alphanumerics only).
const ALIASES: Record<"name" | "first_ca" | "second_ca" | "exam" | "adm", string[]> = {
  name: ["name", "fullname", "learner", "learnername", "student", "studentname"],
  first_ca: ["ca1", "firstca", "1stca", "ca1score", "test1", "firstcat", "cat1"],
  second_ca: ["ca2", "secondca", "2ndca", "ca2score", "test2", "secondcat", "cat2"],
  exam: ["exam", "examscore", "examination", "exams"],
  adm: ["admissionnumber", "admno", "adm", "admissionno", "regno", "regnumber"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function resolveColumns(header: string[]): Partial<Record<keyof typeof ALIASES, number>> {
  const out: Partial<Record<keyof typeof ALIASES, number>> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    (Object.keys(ALIASES) as (keyof typeof ALIASES)[]).forEach((key) => {
      if (out[key] === undefined && ALIASES[key].includes(n)) out[key] = i;
    });
  });
  return out;
}

/** NaN-safe coercion, matching the grid's input handling. */
function num(raw: string | undefined): number {
  const n = Number((raw ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function applyCsvScores(parsed: string[][], roster: ImportRow[], caps: ImportCaps): ImportResult {
  const empty: ImportResult = { rows: roster, matched: 0, unmatched: [], missing: [], overCap: 0 };
  if (parsed.length < 2) return empty;   // need a header + at least one data row

  const cols = resolveColumns(parsed[0]);
  if (cols.name === undefined && cols.adm === undefined) return empty;   // nothing to match on

  // Build lookup tables; flag names that occur on >1 learner as ambiguous.
  const byName = new Map<string, ImportRow>();
  const ambiguous = new Set<string>();
  const byAdm = new Map<string, ImportRow>();
  for (const r of roster) {
    const nk = norm(r.name);
    if (byName.has(nk)) ambiguous.add(nk); else byName.set(nk, r);
    if (r.adm) byAdm.set(norm(r.adm), r);
  }

  const updates = new Map<string, { first_ca: number; second_ca: number; exam: number }>();
  const unmatched: string[] = [];
  let overCap = 0;

  for (let i = 1; i < parsed.length; i++) {
    const line = parsed[i];
    const admKey = cols.adm !== undefined ? norm(line[cols.adm] ?? "") : "";
    const nameKey = cols.name !== undefined ? norm(line[cols.name] ?? "") : "";
    const label = (cols.name !== undefined ? line[cols.name] : line[cols.adm!])?.trim() || `row ${i + 1}`;

    let learner = admKey ? byAdm.get(admKey) : undefined;
    if (!learner && nameKey) {
      if (ambiguous.has(nameKey)) { unmatched.push(`${label} (duplicate name)`); continue; }
      learner = byName.get(nameKey);
    }
    if (!learner) { unmatched.push(label); continue; }

    const first_ca = cols.first_ca !== undefined ? num(line[cols.first_ca]) : learner.first_ca;
    const second_ca = cols.second_ca !== undefined ? num(line[cols.second_ca]) : learner.second_ca;
    const exam = cols.exam !== undefined ? num(line[cols.exam]) : learner.exam;
    if (first_ca > caps.first_ca || first_ca < 0) overCap++;
    if (second_ca > caps.second_ca || second_ca < 0) overCap++;
    if (exam > caps.exam || exam < 0) overCap++;
    updates.set(learner.learner_id, { first_ca, second_ca, exam });
  }

  const rows = roster.map((r) => {
    const u = updates.get(r.learner_id);
    return u ? { ...r, ...u } : r;
  });
  const missing = roster.filter((r) => !updates.has(r.learner_id)).map((r) => r.name);

  return { rows, matched: updates.size, unmatched, missing, overCap };
}
