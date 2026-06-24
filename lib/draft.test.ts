import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { draftKey, loadDraft, saveDraft, clearDraft, loadSelection, saveSelection, type DraftRow } from "./draft";

// Minimal localStorage shim so the SSR-safe helpers run under the node test env
// (which has no `window`). Mirrors the browser Storage methods the helpers use.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const hadWindow = "window" in globalThis;
(globalThis as any).window = { localStorage: new MemStorage() };
afterAll(() => { if (!hadWindow) delete (globalThis as any).window; });

describe("draftKey", () => {
  it("builds a stable, combo-scoped key", () => {
    expect(draftKey({ arm: "a1", subject: "s1", term: "Term 3", session: "2025/2026" }))
      .toBe("score-draft:a1:s1:Term 3:2025/2026");
  });
  it("differs when any field differs", () => {
    const base = { arm: "a1", subject: "s1", term: "Term 3", session: "2025/2026" };
    expect(draftKey(base)).not.toBe(draftKey({ ...base, term: "Term 2" }));
    expect(draftKey(base)).not.toBe(draftKey({ ...base, subject: "s2" }));
  });
});

describe("draft + selection round-trip", () => {
  beforeEach(() => { (globalThis as any).window.localStorage.clear(); });

  it("saves, loads and clears a draft", () => {
    const key = draftKey({ arm: "a", subject: "s", term: "Term 1", session: "2024/2025" });
    const rows: DraftRow[] = [{ learner_id: "L1", first_ca: 12, second_ca: 9, exam: 40 }];
    expect(loadDraft(key)).toBeNull();
    saveDraft(key, rows);
    expect(loadDraft(key)).toEqual(rows);
    clearDraft(key);
    expect(loadDraft(key)).toBeNull();
  });

  it("round-trips the selection", () => {
    expect(loadSelection()).toBeNull();
    const sel = { arm: "a", subject: "s", term: "Term 2", session: "2025/2026" };
    saveSelection(sel);
    expect(loadSelection()).toEqual(sel);
  });
});
