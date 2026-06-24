import { describe, it, expect } from "vitest";
import { applyCsvScores, type ImportRow } from "./score-import";

const CAPS = { first_ca: 20, second_ca: 20, exam: 60 };
const roster = (): ImportRow[] => [
  { learner_id: "L1", adm: "A001", name: "Jane Doe", first_ca: 0, second_ca: 0, exam: 0 },
  { learner_id: "L2", adm: "A002", name: "John Roe", first_ca: 5, second_ca: 5, exam: 5 },
];

describe("applyCsvScores", () => {
  it("fills marks matched by name (case/space-insensitive)", () => {
    const parsed = [["Name", "CA1", "CA2", "Exam"], ["  jane   doe ", "12", "15", "40"]];
    const res = applyCsvScores(parsed, roster(), CAPS);
    expect(res.matched).toBe(1);
    expect(res.rows.find((r) => r.learner_id === "L1")).toMatchObject({ first_ca: 12, second_ca: 15, exam: 40 });
    expect(res.missing).toEqual(["John Roe"]);            // not in the file → untouched
    expect(res.rows.find((r) => r.learner_id === "L2")).toMatchObject({ first_ca: 5, exam: 5 });
  });

  it("recognises header aliases and admission-number fallback", () => {
    const parsed = [["Adm No", "1st CA", "2nd CA", "Examination"], ["A002", "10", "11", "50"]];
    const res = applyCsvScores(parsed, roster(), CAPS);
    expect(res.matched).toBe(1);
    expect(res.rows.find((r) => r.learner_id === "L2")).toMatchObject({ first_ca: 10, second_ca: 11, exam: 50 });
  });

  it("reports unmatched names and counts over-cap / coerces bad numbers", () => {
    const parsed = [["Name", "CA1", "CA2", "Exam"], ["Ghost Pupil", "1", "2", "3"], ["Jane Doe", "25", "abc", "40"]];
    const res = applyCsvScores(parsed, roster(), CAPS);
    expect(res.unmatched).toEqual(["Ghost Pupil"]);
    expect(res.matched).toBe(1);
    expect(res.overCap).toBe(1);                          // CA1 25 > 20
    expect(res.rows.find((r) => r.learner_id === "L1")).toMatchObject({ first_ca: 25, second_ca: 0, exam: 40 });
  });

  it("skips ambiguous duplicate roster names instead of guessing", () => {
    const dup: ImportRow[] = [
      { learner_id: "L1", adm: "A1", name: "Sam Tay", first_ca: 0, second_ca: 0, exam: 0 },
      { learner_id: "L2", adm: "A2", name: "Sam Tay", first_ca: 0, second_ca: 0, exam: 0 },
    ];
    const res = applyCsvScores([["Name", "CA1", "CA2", "Exam"], ["Sam Tay", "10", "10", "10"]], dup, CAPS);
    expect(res.matched).toBe(0);
    expect(res.unmatched[0]).toContain("duplicate name");
  });

  it("returns the roster unchanged when there is no usable header", () => {
    const res = applyCsvScores([["Foo", "Bar"], ["x", "y"]], roster(), CAPS);
    expect(res.matched).toBe(0);
    expect(res.rows).toEqual(roster());
  });
});
