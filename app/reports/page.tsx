"use client";

import { useEffect, useState } from "react";
import Broadsheet from "@/components/Broadsheet";
import { getClasses } from "@/lib/classes";
import { getBroadsheet } from "@/lib/report-queries";
import type { Opt } from "@/components/ui";

export default function ReportsPage() {
  const [arms, setArms] = useState<Opt[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const cs = await getClasses();
      setArms(cs.map((c) => ({ id: c.id, label: `${c.grade_level} ${c.arm}` })));
      setReady(true);
    })().catch(console.error);
  }, []);

  if (!ready) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>Loading…</div>;

  return <Broadsheet arms={arms} load={(classId, term, session) => getBroadsheet(classId, term, session)} />;
}
