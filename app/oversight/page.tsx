"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Oversight from "@/components/Oversight";
import { getRole, isSupervisor } from "@/lib/role";
import { getOversight, type OversightSummary } from "@/lib/oversight-queries";

export default function OversightPage() {
  const router = useRouter();
  const [data, setData] = useState<OversightSummary | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const role = await getRole();
      if (!isSupervisor(role)) { setDenied(true); router.replace("/dashboard"); return; }
      setData(await getOversight());
    })().catch(console.error);
  }, [router]);

  if (denied) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>Supervisors only — redirecting…</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>Loading…</div>;
  return <Oversight data={data} />;
}
