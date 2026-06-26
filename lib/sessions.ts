// sessions.ts — academic-session helpers. Sessions roll forward automatically
// (a new academic year starts in September), so old sessions drop off the
// pickers and upcoming ones appear without anyone editing code.

/** The academic session covering a date, e.g. June 2026 → "2025/2026",
 *  September 2026 → "2026/2027". (Sept = month index 8 starts a new session.) */
export function currentSession(d: Date = new Date()): string {
  const y = d.getFullYear();
  const start = d.getMonth() >= 8 ? y : y - 1;
  return `${start}/${start + 1}`;
}

/** Options for a session picker: the current session plus `forward` upcoming ones
 *  (so next year's session is always selectable). Any `extra` sessions — e.g. one
 *  already selected, or found in existing data — are merged in so nothing a user
 *  has already chosen disappears. Sorted oldest→newest. */
export function sessionOptions(extra: string[] = [], forward = 2): { id: string; label: string }[] {
  const start = Number(currentSession().split("/")[0]);
  const gen: string[] = [];
  for (let i = 0; i <= forward; i++) gen.push(`${start + i}/${start + i + 1}`);
  const all = Array.from(new Set([...gen, ...extra.filter(Boolean)])).sort();
  return all.map((s) => ({ id: s, label: s }));
}
