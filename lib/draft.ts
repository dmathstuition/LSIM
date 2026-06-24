// draft.ts — SSR-safe localStorage helpers so in-progress edits survive a
// refresh/crash. Score entry persists the marks being typed (before they are
// saved to the DB) plus the last-used Arm/Subject/Term/Session selection, so a
// reload returns to the same view instead of resetting to stale defaults.

export interface DraftRow { learner_id: string; first_ca: number; second_ca: number; exam: number; }
export interface ScoreSelection { arm: string; subject: string; term: string; session: string; }

const SELECTION_KEY = "score-entry-selection";

/** Per-(arm,subject,term,session) key for an in-progress grid of marks. */
export function draftKey(m: ScoreSelection): string {
  return `score-draft:${m.arm}:${m.subject}:${m.term}:${m.session}`;
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private mode */ }
}

export function loadDraft(key: string): DraftRow[] | null { return read<DraftRow[]>(key); }
export function saveDraft(key: string, rows: DraftRow[]): void { write(key, rows); }
export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

export function loadSelection(): ScoreSelection | null { return read<ScoreSelection>(SELECTION_KEY); }
export function saveSelection(sel: ScoreSelection): void { write(SELECTION_KEY, sel); }
