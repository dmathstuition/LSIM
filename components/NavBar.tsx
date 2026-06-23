"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getRole, isSupervisor } from "@/lib/role";
import {
  LayoutDashboard, ClipboardList, Users, CalendarCheck, ClipboardCheck,
  HeartPulse, FileText, Shield, LogOut,
} from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scores", label: "Scores", icon: ClipboardList },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/assignments", label: "Assignments", icon: ClipboardCheck },
  { href: "/interventions", label: "Interventions", icon: HeartPulse },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/classes", label: "Classes", icon: Users },
];

export default function NavBar() {
  const path = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [supervisor, setSupervisor] = useState(false);

  useEffect(() => {
    getRole().then((r) => setSupervisor(isSupervisor(r))).catch(() => {});
  }, [path]);

  if (path?.startsWith("/login")) return null;

  async function signOut() { await supabase.auth.signOut(); router.push("/login"); }

  const links = [...LINKS, ...(supervisor ? [{ href: "/oversight", label: "Oversight", icon: Shield }] : [])];

  return (
    <nav className="no-print" style={{ background: "#fff", borderBottom: "1px solid #E1E5EF", padding: "0 16px",
      display: "flex", alignItems: "center", gap: 4, height: 54, position: "sticky", top: 0, zIndex: 50,
      fontFamily: "system-ui, sans-serif", overflowX: "auto" }}>
      <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, marginRight: 10, whiteSpace: "nowrap" }}>
        d<span style={{ color: "#5B43F0" }}>maths</span>
      </div>
      {links.map(({ href, label, icon: Icon }) => {
        const on = path?.startsWith(href);
        return (
          <Link key={href} href={href} style={{ display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 11px", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none",
            whiteSpace: "nowrap", color: on ? "#5B43F0" : "#576074", background: on ? "#ECE9FF" : "transparent" }}>
            <Icon size={16} /> {label}
          </Link>
        );
      })}
      <button onClick={signOut} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center",
        gap: 6, padding: "8px 12px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
        whiteSpace: "nowrap", border: "1px solid #E1E5EF", background: "#fff", color: "#576074" }}>
        <LogOut size={15} /> Sign out
      </button>
    </nav>
  );
}
