// csv.ts — tiny dependency-free CSV builder + browser download.

export interface CsvColumn<T> { key: keyof T | string; header: string; get?: (row: T) => unknown; }

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, any>>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => cell(c.header)).join(",");
  const body = rows.map((r) =>
    columns.map((c) => cell(c.get ? c.get(r) : r[c.key as string])).join(",")
  );
  return [head, ...body].join("\n");
}

/**
 * Parse CSV text into a grid of string cells. Dependency-free; handles quoted
 * fields ("a,b"), escaped quotes (""), CRLF/LF line endings and a leading BOM.
 * The delimiter is sniffed from the first line (comma, semicolon or tab) so
 * spreadsheet exports from any locale load correctly.
 */
export function parseCsv(text: string): string[][] {
  let s = text.replace(/^﻿/, "");          // strip BOM
  if (!s.trim()) return [];
  const firstLine = s.slice(0, (s.search(/\r?\n/) + 1 || s.length + 1) - 1);
  const counts = { ",": (firstLine.match(/,/g) || []).length, ";": (firstLine.match(/;/g) || []).length, "\t": (firstLine.match(/\t/g) || []).length };
  const delim = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",") as string;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;          // CRLF
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  row.push(field);
  rows.push(row);
  // Drop fully-empty trailing rows (e.g. a blank final newline).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" }); // BOM → Excel-friendly
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
