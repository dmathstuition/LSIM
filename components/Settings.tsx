"use client";

import React, { useEffect, useState } from "react";
import { UserCog, KeyRound, Check, AlertCircle } from "lucide-react";
import { C, card, inp, btn, Wrap, PageHead, Empty, Chip } from "@/components/ui";
import { getProfile, updateProfile, updatePassword, type Profile } from "@/lib/profile";

const ROLE_COLOR: Record<string, string> = { teacher: C.brand, supervisor: "#1FA97A", admin: "#E0701E" };

export default function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullname, setFullname] = useState("");
  const [department, setDepartment] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [savingP, setSavingP] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      setFullname(p?.fullname ?? "");
      setDepartment(p?.department ?? "");
    }).catch((e) => setMsg({ kind: "err", text: e.message }));
  }, []);

  async function saveProfile() {
    if (!fullname.trim()) { setMsg({ kind: "err", text: "Name can't be empty." }); return; }
    setSavingP(true); setMsg(null);
    try { await updateProfile({ fullname: fullname.trim(), department: department.trim() || null }); setMsg({ kind: "ok", text: "Profile updated." }); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); } finally { setSavingP(false); }
  }
  async function savePassword() {
    if (pw.length < 6) { setMsg({ kind: "err", text: "Password must be at least 6 characters." }); return; }
    if (pw !== pw2) { setMsg({ kind: "err", text: "Passwords don't match." }); return; }
    setSavingPw(true); setMsg(null);
    try { await updatePassword(pw); setPw(""); setPw2(""); setMsg({ kind: "ok", text: "Password changed." }); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); } finally { setSavingPw(false); }
  }

  if (!profile) return <Wrap max={620}><Empty>Loading…</Empty></Wrap>;

  return (
    <Wrap max={620}>
      <PageHead title="Settings" sub="Manage your account." />
      {msg && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, fontSize: 13, color: msg.kind === "err" ? C.bad : C.good }}>
          {msg.kind === "err" ? <AlertCircle size={15} /> : <Check size={15} />}{msg.text}
        </div>
      )}

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, marginBottom: 14 }}>
          <UserCog size={17} color={C.brand} /> Profile
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Email"><div style={{ fontSize: 14, color: C.inkSoft }}>{profile.email}</div></Field>
          <Field label="Role"><Chip label={profile.role} color={ROLE_COLOR[profile.role] ?? C.inkFaint} /></Field>
          <Field label="Full name"><input value={fullname} onChange={(e) => setFullname(e.target.value)} style={{ ...inp, width: "100%" }} /></Field>
          <Field label="Department"><input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Mathematics" style={{ ...inp, width: "100%" }} /></Field>
          <button onClick={saveProfile} disabled={savingP} className="btn-press" style={{ ...btn, justifyContent: "center" }}>
            <Check size={15} /> {savingP ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, marginBottom: 14 }}>
          <KeyRound size={17} color={C.brand} /> Change password
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="New password"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ ...inp, width: "100%" }} /></Field>
          <Field label="Confirm password"><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={{ ...inp, width: "100%" }} /></Field>
          <button onClick={savePassword} disabled={savingPw} className="btn-press" style={{ ...btn, justifyContent: "center" }}>
            <KeyRound size={15} /> {savingPw ? "Updating…" : "Update password"}
          </button>
        </div>
      </div>
    </Wrap>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: C.inkFaint }}>{label}</span>
      {children}
    </label>
  );
}
