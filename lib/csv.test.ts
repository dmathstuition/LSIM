import { describe, it, expect } from "vitest";
import { toCsv, parseCsv } from "./csv";

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

describe("parseCsv", () => {
  it("parses a simple grid", () => {
    expect(parseCsv("Name,CA1\nJane,12\nJohn,9")).toEqual([["Name", "CA1"], ["Jane", "12"], ["John", "9"]]);
  });
  it("handles quoted fields, escaped quotes and embedded commas/newlines", () => {
    expect(parseCsv('Name,Note\n"Doe, ""Jane""","a\nb"')).toEqual([["Name", "Note"], ['Doe, "Jane"', "a\nb"]]);
  });
  it("handles CRLF and a leading BOM", () => {
    expect(parseCsv("﻿Name,CA1\r\nJane,12\r\n")).toEqual([["Name", "CA1"], ["Jane", "12"]]);
  });
  it("sniffs a semicolon delimiter", () => {
    expect(parseCsv("Name;CA1\nJane;12")).toEqual([["Name", "CA1"], ["Jane", "12"]]);
  });
  it("drops blank rows and returns [] for empty input", () => {
    expect(parseCsv("\n\n")).toEqual([]);
    expect(parseCsv("Name,CA1\n\nJane,12\n")).toEqual([["Name", "CA1"], ["Jane", "12"]]);
  });
});
