"use client";

import { useEffect, useState } from "react";
import Interventions from "@/components/Interventions";
import { getClasses } from "@/lib/classes";
import { getRiskList, getInterventions, createIntervention, updateIntervention } from "@/lib/intervention-queries";
import type { Opt } from "@/components/ui";

export default function InterventionsPage() {
  const [arms, setArms] = useState<Opt[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const cs = await getClasses();
      setArms(cs.map((c) => ({ id: c.id, label: `${c.grade_level} ${c.arm}` })));
      setReady(true);
    })().catch(console.error);
  }, []);

  if (!ready) return <div style={{ padding: 40, textAlign: "center", color: "#8B92A4" }}>Loading…</div>;

  return (
    <Interventions
      arms={arms}
      loadRisk={(classId) => getRiskList(classId)}
      loadInterventions={(classId) => getInterventions(classId)}
      onCreate={(i) => createIntervention(i)}
      onUpdate={(id, patch) => updateIntervention(id, patch)}
    />
  );
}
