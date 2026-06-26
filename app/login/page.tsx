"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Optional shared invite code (set NEXT_PUBLIC_SIGNUP_CODE in env). When set, it's
// required to create an account, so strangers with the link can't self-register.
const SIGNUP_CODE = (process.env.NEXT_PUBLIC_SIGNUP_CODE || "").trim();

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
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

  async function signUp() {
    if (!fullname.trim()) return setError("Enter your full name.");
    if (SIGNUP_CODE && invite.trim() !== SIGNUP_CODE) return setError("That invite code isn't valid. Ask your admin for it.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true); setError(null); setNotice(null);
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { fullname: fullname.trim() } },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (!data.session) {   // email confirmation is on → no session yet
      setMode("signin");
      return setNotice("Account created. Check your email to confirm it, then sign in.");
    }
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

  const isSignup = mode === "signup";
  function swap(next: "signin" | "signup") { setMode(next); setError(null); setNotice(null); }

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
          {isSignup ? "Create your teacher account to start tracking your classes." : "We create solutions for your success. Sign in to your teacher account."}
        </p>
        {isSignup && (
          <input placeholder="Full name" value={fullname} onChange={(e) => setFullname(e.target.value)} style={inp} />
        )}
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp} />
        <input placeholder="Password" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} style={inp} />
        {isSignup && SIGNUP_CODE && (
          <input placeholder="Invite code" value={invite} onChange={(e) => setInvite(e.target.value)} style={inp} />
        )}
        {error && <div style={{ color: "#D2353A", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {notice && <div style={{ color: "#1FA97A", fontSize: 12, marginBottom: 10 }}>{notice}</div>}
        <button onClick={isSignup ? signUp : signIn} disabled={busy}
          style={{ width: "100%", padding: 12, borderRadius: 999, border: "none",
            background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 700, fontSize: 15, cursor: "pointer",
            opacity: busy ? 0.6 : 1 }}>
          {busy ? (isSignup ? "Creating…" : "Signing in…") : (isSignup ? "Create account" : "Sign in")}
        </button>
        {!isSignup && (
          <button onClick={resetPassword} type="button"
            style={{ width: "100%", marginTop: 10, padding: 6, background: "transparent", border: "none",
              color: "var(--ink-faint)", fontSize: 12, cursor: "pointer" }}>
            Forgot password?
          </button>
        )}
        <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, color: "var(--ink-soft)" }}>
          {isSignup ? "Already have an account? " : "New here? "}
          <button onClick={() => swap(isSignup ? "signin" : "signup")} type="button"
            style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}>
            {isSignup ? "Sign in" : "Create an account"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: 11, marginBottom: 11, borderRadius: 10,
  border: "1px solid var(--border)", fontSize: 14, boxSizing: "border-box",
  background: "var(--surface)", color: "var(--ink)",
};
