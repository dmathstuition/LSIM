import { describe, it, expect } from "vitest";
import {
  gradeFor, performanceCategory, bandOf, riskScore, riskLevel, computeKpis, isoWeek,
} from "./grading";

describe("gradeFor — boundaries", () => {
  it("maps band edges", () => {
    expect(gradeFor(80)).toBe("A");
    expect(gradeFor(79)).toBe("B");
    expect(gradeFor(70)).toBe("B");
    expect(gradeFor(60)).toBe("C");
    expect(gradeFor(50)).toBe("D");
    expect(gradeFor(40)).toBe("E");
    expect(gradeFor(39)).toBe("F");
    expect(gradeFor(0)).toBe("F");
  });
});

describe("performanceCategory", () => {
  it("labels by band", () => {
    expect(performanceCategory(85)).toBe("Outstanding");
    expect(performanceCategory(50)).toBe("Fair");
    expect(performanceCategory(40)).toBe("Needs Improvement");
    expect(performanceCategory(39)).toBe("At Risk");
  });
});

describe("bandOf", () => {
  it("returns the matching band at edges", () => {
    expect(bandOf(80).name).toBe("Outstanding");
    expect(bandOf(49).name).toBe("Needs Improv.");
    expect(bandOf(0).name).toBe("At Risk");
  });
});

describe("riskScore + riskLevel", () => {
  it("is Low when everything is healthy", () => {
    const s = riskScore({ avg: 75, attendancePct: 95, missing: 0, delta: 0 });
    expect(s).toBe(0);
    expect(riskLevel(s)).toBe("Low");
  });
  it("stacks the four signals", () => {
    // avg<40 (3) + attendance<60 (2) + missing>=3 (2) + delta<=-10 (2) = 9
    const s = riskScore({ avg: 30, attendancePct: 40, missing: 5, delta: -12 });
    expect(s).toBe(9);
    expect(riskLevel(s)).toBe("Critical");
  });
  it("counts a moderate decline", () => {
    // avg 55 (0) + attendance 80 (0) + missing 0 (0) + delta -6 (1) = 1 → Low
    expect(riskScore({ avg: 55, attendancePct: 80, missing: 0, delta: -6 })).toBe(1);
    // delta -5 is the threshold for 1 point
    expect(riskScore({ avg: 55, attendancePct: 80, missing: 0, delta: -5 })).toBe(1);
    expect(riskScore({ avg: 55, attendancePct: 80, missing: 0, delta: -4 })).toBe(0);
  });
  it("buckets borderline scores", () => {
    expect(riskLevel(2)).toBe("Medium");
    expect(riskLevel(4)).toBe("High");
    expect(riskLevel(6)).toBe("Critical");
  });
});

describe("computeKpis", () => {
  it("averages and rates over the roster", () => {
    const rows = [
      { avg: 80, attendance: 100, missing: 0, level: "Low" as const },
      { avg: 40, attendance: 50, missing: 4, level: "Critical" as const },
    ];
    const k = computeKpis(rows);
    expect(k.n).toBe(2);
    expect(k.avg).toBe(60);
    expect(k.att).toBe(75);
    expect(k.pass).toBe(50); // one of two >= 50
    expect(k.atRisk).toBe(1); // one Critical
    // submission: (8-0 + 8-4) / (2*8) * 100 = 12/16*100 = 75
    expect(k.sub).toBe(75);
  });
  it("does not divide by zero on an empty roster", () => {
    const k = computeKpis([]);
    expect(k.n).toBe(0);
    expect(Number.isNaN(k.avg)).toBe(false);
  });
});

describe("isoWeek", () => {
  it("zero-pads the week number", () => {
    expect(isoWeek(new Date("2025-01-06"))).toBe("W02");
    expect(/^W\d{2}$/.test(isoWeek(new Date("2025-09-15")))).toBe(true);
  });
});
