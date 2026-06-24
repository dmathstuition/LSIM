"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { searchLearners, type LearnerSearchResult } from "@/lib/learner-queries";

const INK = "#576074", FAINT = "#8B92A4", BORDER = "#E1E5EF", BRAND = "#5B43F0";

export default function LearnerSearch({ block = false }: { block?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LearnerSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K opens; Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); else { setQ(""); setResults([]); } }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const h = setTimeout(() => {
      const term = q.trim();
      if (term.length < 2) { setResults([]); return; }
      setBusy(true);
      searchLearners(term).then(setResults).catch(() => setResults([])).finally(() => setBusy(false));
    }, 180);
    return () => clearTimeout(h);
  }, [q, open]);

  function go(id: string) { setOpen(false); router.push(`/learners/${id}`); }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Search learners" className="nav-link"
        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 11px", borderRadius: 9,
          border: `1px solid ${BORDER}`, background: "#fff", color: FAINT, cursor: "pointer",
          fontSize: 13, fontWeight: 600, width: block ? "100%" : undefined, justifyContent: block ? "flex-start" : undefined }}>
        <Search size={15} /> Search{block ? " learners" : ""}
      </button>

      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(8,11,20,.45)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "12vh 16px 16px" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "min(520px, 100%)", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 16px 48px rgba(8,11,20,.28)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${BORDER}` }}>
              <Search size={17} color={FAINT} />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or admission number…"
                style={{ flex: 1, border: "none", outline: "none", fontSize: 15, color: "#13182B", background: "transparent" }} />
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ border: "none", background: "transparent", color: FAINT, cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {q.trim().length < 2 ? <Hint>Type at least 2 characters.</Hint>
                : busy && results.length === 0 ? <Hint>Searching…</Hint>
                : results.length === 0 ? <Hint>No learners found.</Hint>
                : results.map((r) => (
                  <button key={r.id} onClick={() => go(r.id)} className="row-hover"
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", borderTop: `1px solid #F2F4F8` }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: "#ECE9FF", color: BRAND, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>
                      {r.fullname.slice(0, 1).toUpperCase()}
                    </span>
                    <span style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#13182B" }}>{r.fullname}</div>
                      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: FAINT }}>{r.admission_number}{r.class_label ? ` · ${r.class_label}` : ""}</div>
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "18px 14px", fontSize: 13, color: INK, textAlign: "center" }}>{children}</div>;
}
