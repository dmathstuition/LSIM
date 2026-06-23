"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, ClipboardList, Users, LogOut } from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scores", label: "Score entry", icon: ClipboardList },
  { href: "/classes", label: "Classes & learners", icon: Users },
];

export default function NavBar() {
  const path = usePathname();
  const router = useRouter();
  const supabase = createClient();
  if (path?.startsWith("/login")) return null;

  async function signOut() { await supabase.auth.signOut(); router.push("/login"); }

  return (
    <nav style={{ background: "#fff", borderBottom: "1px solid #E1E5EF", padding: "0 20px",
      display: "flex", alignItems: "center", gap: 6, height: 54, position: "sticky", top: 0, zIndex: 50,
      fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, marginRight: 14 }}>
        d<span style={{ color: "#5B43F0" }}>maths</span>
      </div>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const on = path?.startsWith(href);
        return (
          <Link key={href} href={href} style={{ display: "inline-flex", alignItems: "center", gap: 7,
            padding: "8px 12px", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none",
            color: on ? "#5B43F0" : "#576074", background: on ? "#ECE9FF" : "transparent" }}>
            <Icon size={16} /> {label}
          </Link>
        );
      })}
      <button onClick={signOut} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center",
        gap: 6, padding: "8px 12px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
        border: "1px solid #E1E5EF", background: "#fff", color: "#576074" }}>
        <LogOut size={15} /> Sign out
      </button>
    </nav>
  );
}
