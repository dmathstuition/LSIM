import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("emits a header row and values", () => {
    const csv = toCsv([{ a: 1, b: "x" }], [
      { key: "a", header: "A" }, { key: "b", header: "B" },
    ]);
    expect(csv).toBe("A,B\n1,x");
  });

  it("quotes/escapes commas, quotes and newlines", () => {
    const csv = toCsv([{ name: 'Doe, "Jane"', note: "line1\nline2" }], [
      { key: "name", header: "Name" }, { key: "note", header: "Note" },
    ]);
    expect(csv).toBe('Name,Note\n"Doe, ""Jane""","line1\nline2"');
  });

  it("renders null/undefined as empty and supports get()", () => {
    const csv = toCsv([{ x: null as any, y: undefined as any }], [
      { key: "x", header: "X" },
      { key: "y", header: "Y", get: (r) => (r.y ? "yes" : "") },
    ]);
    expect(csv).toBe("X,Y\n,");
  });
});
