"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getRole, isSupervisor } from "@/lib/role";
import { useMediaQuery } from "@/lib/use-media-query";
import LearnerSearch from "@/components/LearnerSearch";
import {
  LayoutDashboard, ClipboardList, Users, CalendarCheck, ClipboardCheck,
  HeartPulse, FileText, Shield, LogOut, Menu, X, CalendarRange, Settings, BookMarked,
} from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scores", label: "Scores", icon: ClipboardList },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/assignments", label: "Assignments", icon: ClipboardCheck },
  { href: "/weekly", label: "Weekly", icon: CalendarRange },
  { href: "/interventions", label: "Interventions", icon: HeartPulse },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/classes", label: "Classes", icon: Users },
  { href: "/subjects", label: "Subjects", icon: BookMarked },
  { href: "/settings", label: "Settings", icon: Settings },
];

const BRAND = "#5B43F0", INK = "#576074", ACTIVE_BG = "#ECE9FF";

function Brand() {
  return (
    <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 16, whiteSpace: "nowrap" }}>
      d<span style={{ color: BRAND }}>maths</span>
    </div>
  );
}

export default function NavBar() {
  const path = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [supervisor, setSupervisor] = useState(false);
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 760px)");

  useEffect(() => { getRole().then((r) => setSupervisor(isSupervisor(r))).catch(() => {}); }, [path]);
  useEffect(() => { setOpen(false); }, [path]);              // close drawer on navigate
  useEffect(() => {                                          // lock scroll while drawer open
    if (open) { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }
  }, [open]);

  if (path?.startsWith("/login")) return null;

  async function signOut() { await supabase.auth.signOut(); router.push("/login"); }
  const links = [...LINKS, ...(supervisor ? [{ href: "/oversight", label: "Oversight", icon: Shield }] : [])];
  const isActive = (href: string) => path?.startsWith(href);

  const linkStyle = (on: boolean, block = false): React.CSSProperties => ({
    display: block ? "flex" : "inline-flex", alignItems: "center", gap: 9,
    padding: block ? "12px 14px" : "8px 11px", borderRadius: 9, fontSize: 14, fontWeight: 600,
    textDecoration: "none", whiteSpace: "nowrap",
    color: on ? BRAND : INK, background: on ? ACTIVE_BG : "transparent",
  });

  const bar: React.CSSProperties = {
    background: "#fff", borderBottom: "1px solid #E1E5EF", padding: "0 16px",
    display: "flex", alignItems: "center", gap: 4, height: 56, position: "sticky", top: 0, zIndex: 50,
    boxShadow: "0 1px 3px rgba(19,24,43,.04)",
  };
  const signOutBtn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9,
    fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    border: "1px solid #E1E5EF", background: "#fff", color: INK,
  };

  // ---------- Mobile: brand + hamburger + slide-in drawer ----------
  if (isMobile) {
    return (
      <>
        <nav className="no-print" style={bar}>
          <Brand />
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="icon-btn"
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: 10, border: "1px solid #E1E5EF", background: "#fff", color: INK, cursor: "pointer" }}>
            <Menu size={20} />
          </button>
        </nav>

        {open && (
          <div className="no-print" onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(8,11,20,.45)", zIndex: 100 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 0, left: 0, bottom: 0,
              width: "min(280px, 82vw)", background: "#fff", padding: 14, display: "flex", flexDirection: "column",
              gap: 4, boxShadow: "2px 0 16px rgba(8,11,20,.18)", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 12px" }}>
                <Brand />
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="icon-btn"
                  style={{ display: "inline-flex", padding: 7, borderRadius: 9, border: "none", background: "transparent", color: INK, cursor: "pointer" }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ marginBottom: 8 }}><LearnerSearch block /></div>
              {links.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="nav-link" style={linkStyle(!!isActive(href), true)}>
                  <Icon size={18} /> {label}
                </Link>
              ))}
              <button onClick={signOut} style={{ ...signOutBtn, marginTop: 10, justifyContent: "center", padding: "12px 14px" }}>
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ---------- Desktop: full horizontal bar ----------
  return (
    <nav className="no-print" style={{ ...bar, gap: 4, overflowX: "auto" }}>
      <div style={{ marginRight: 8 }}><Brand /></div>
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="nav-link" style={linkStyle(!!isActive(href))}>
          <Icon size={16} /> {label}
        </Link>
      ))}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        <LearnerSearch />
        <button onClick={signOut} className="btn-press" style={signOutBtn}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </nav>
  );
}
