"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LearnerProfile from "@/components/LearnerProfile";
import { getLearnerProfile, type LearnerProfileData } from "@/lib/learner-queries";

export default function LearnerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<LearnerProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getLearnerProfile(id).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div style={{ padding: 40, textAlign: "center", color: "#D2353A" }}>{error}</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "#8B92A4" }}>Loading…</div>;
  return <LearnerProfile data={data} />;
}
