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
      background: "#EAEDF4", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div style={{ width: "min(360px, 100%)", background: "#fff", border: "1px solid #E1E5EF",
        borderRadius: 14, padding: "clamp(20px, 5vw, 28px)", boxShadow: "0 4px 24px rgba(19,24,43,.08)" }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          d<span style={{ color: "#5B43F0" }}>maths</span>
        </div>
        <p style={{ fontSize: 13, color: "#8B92A4", marginTop: 0, marginBottom: 18 }}>
          Sign in to your teacher account
        </p>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          style={inp} />
        <input placeholder="Password" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} style={inp} />
        {error && <div style={{ color: "#D2353A", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {notice && <div style={{ color: "#1FA97A", fontSize: 12, marginBottom: 10 }}>{notice}</div>}
        <button onClick={signIn} disabled={busy}
          style={{ width: "100%", padding: 11, borderRadius: 10, border: "none",
            background: "#5B43F0", color: "#fff", fontWeight: 600, cursor: "pointer",
            opacity: busy ? 0.6 : 1 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button onClick={resetPassword} type="button"
          style={{ width: "100%", marginTop: 10, padding: 6, background: "transparent", border: "none",
            color: "#8B92A4", fontSize: 12, cursor: "pointer" }}>
          Forgot password?
        </button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: 11, marginBottom: 11, borderRadius: 10,
  border: "1px solid #E1E5EF", fontSize: 14, boxSizing: "border-box",
};
