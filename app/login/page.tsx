"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true); setError(null); setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/dashboard");
  }

  async function resetPassword() {
    setError(null); setNotice(null);
    if (!email) return setError("Enter your email first, then click reset.");
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return setError(error.message);
    setNotice("Check your email for a password reset link.");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--bg)", color: "var(--ink)", fontFamily: "var(--font-sans), system-ui, sans-serif", padding: 16 }}>
      <div style={{ width: "min(360px, 100%)", background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "clamp(20px, 5vw, 28px)", boxShadow: "var(--card-shadow)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="13" r="7.4" stroke="var(--brand)" strokeWidth="2.4" />
            <circle cx="18.5" cy="6" r="2.6" fill="var(--accent)" />
          </svg>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: ".06em", color: "var(--ink)" }}>D-MATHS</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 0, marginBottom: 18 }}>
          We create solutions for your success. Sign in to your teacher account.
        </p>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          style={inp} />
        <input placeholder="Password" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} style={inp} />
        {error && <div style={{ color: "#D2353A", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {notice && <div style={{ color: "#1FA97A", fontSize: 12, marginBottom: 10 }}>{notice}</div>}
        <button onClick={signIn} disabled={busy}
          style={{ width: "100%", padding: 12, borderRadius: 999, border: "none",
            background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 700, fontSize: 15, cursor: "pointer",
            opacity: busy ? 0.6 : 1 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button onClick={resetPassword} type="button"
          style={{ width: "100%", marginTop: 10, padding: 6, background: "transparent", border: "none",
            color: "var(--ink-faint)", fontSize: 12, cursor: "pointer" }}>
          Forgot password?
        </button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: 11, marginBottom: 11, borderRadius: 10,
  border: "1px solid var(--border)", fontSize: 14, boxSizing: "border-box",
  background: "var(--surface)", color: "var(--ink)",
};
