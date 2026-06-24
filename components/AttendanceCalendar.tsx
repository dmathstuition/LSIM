"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C } from "@/components/ui";

const STATUS_COLOR: Record<string, string> = { Present: C.good, Late: C.warn, Absent: C.bad };
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month calendar tinting each day by attendance status. `byDate` keys are ISO yyyy-mm-dd. */
export default function AttendanceCalendar({ byDate }: { byDate: Map<string, string> }) {
  // Start on the most recent month that has data, else current month.
  const initial = useMemo(() => {
    const keys = [...byDate.keys()].sort();
    const d = keys.length ? new Date(keys[keys.length - 1] + "T00:00:00") : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [byDate]);
  const [{ y, m }, setYm] = useState(initial);

  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Mon=0
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = first.toLocaleString("en", { month: "long", year: "numeric" });

  const iso = (day: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const shift = (delta: number) => setYm(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month" style={navBtn}><ChevronLeft size={16} /></button>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{monthLabel}</span>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month" style={navBtn}><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {DOW.map((d) => <div key={d} style={{ fontSize: 10, fontWeight: 600, textAlign: "center", color: C.inkFaint, padding: "2px 0" }}>{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const st = byDate.get(iso(day));
          const color = st ? STATUS_COLOR[st] : undefined;
          return (
            <div key={day} title={st ? `${iso(day)} · ${st}` : iso(day)}
              style={{ aspectRatio: "1 / 1", display: "grid", placeItems: "center", borderRadius: 8, fontSize: 12,
                fontFamily: "ui-monospace, monospace", border: `1px solid ${C.border}`,
                background: color ? color + "22" : "#fff", color: color ?? C.inkFaint, fontWeight: color ? 700 : 400 }}>
              {day}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 12 }}>
        {Object.entries(STATUS_COLOR).map(([k, c]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />{k}
          </span>
        ))}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = { display: "inline-flex", padding: 5, border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", color: C.inkSoft, cursor: "pointer" };
