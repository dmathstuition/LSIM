"use client";

// Shared inline-style primitives for the LAIMS screens. Mirrors the palette and
// card/inp/btn conventions already used in app/classes/page.tsx and ScoreEntry.tsx
// so every new screen matches the existing look without re-declaring constants.

import React from "react";

// Palette is driven by CSS variables (see app/globals.css) so it follows the
// global light/dark theme. These resolve at render time in inline styles.
export const C = {
  brand: "var(--brand)", brandSoft: "var(--brand-soft)",
  ink: "var(--ink)", inkSoft: "var(--ink-soft)", inkFaint: "var(--ink-faint)",
  bg: "var(--bg)", surface: "var(--surface)", surface2: "var(--surface2)", border: "var(--border)",
  good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)",
};

export const RISK: Record<string, string> = { Low: "#1FA97A", Medium: "#C9A227", High: "#E0701E", Critical: "#D2353A" };
export const BANDS = [
  { name: "Outstanding", min: 80, color: "#1FA97A" }, { name: "Very Good", min: 70, color: "#5BB04A" },
  { name: "Good", min: 60, color: "#C9A227" }, { name: "Fair", min: 50, color: "#E08A1E" },
  { name: "Needs Improv.", min: 40, color: "#DB6334" }, { name: "At Risk", min: 0, color: "#D2353A" },
];
export const bandColor = (t: number) => (BANDS.find((b) => t >= b.min) ?? BANDS[BANDS.length - 1]).color;

export const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, boxShadow: "var(--card-shadow)" };
export const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, boxSizing: "border-box", background: C.surface, color: C.ink };
export const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, border: "none", background: C.brand, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" };

export function Wrap({ children, max = 1040 }: { children: React.ReactNode; max?: number }) {
  return <div className="page-pad" style={{ maxWidth: max, margin: "0 auto", fontFamily: "system-ui, sans-serif", color: C.ink }}>{children}</div>;
}
export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <div>
        <h1 className="h-page" style={{ margin: 0 }}>{title}</h1>
        {sub && <p style={{ fontSize: 13, color: C.inkFaint, margin: "3px 0 0" }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 14, padding: 32, textAlign: "center", color: C.inkFaint, fontSize: 14 }}>{children}</div>;
}
export function Sel({ label, value, set, opts }: { label: string; value: string; set: (v: string) => void; opts: { id: string; label: string }[] }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: C.inkFaint }}>{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)} style={{ padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, background: C.surface, cursor: "pointer", color: C.ink }}>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}
export function Chip({ label, color }: { label: string; color: string }) {
  // color-mix keeps the tint working whether `color` is a hex literal or a CSS var.
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>{label}</span>;
}
export interface Opt { id: string; label: string; }
