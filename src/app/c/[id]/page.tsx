"use client";

import React from "react";
import { useParams } from "next/navigation";
import SourcingDashboard from "@/components/SourcingDashboard";

export default function SessionPage() {
  const params = useParams();
  const id = params?.id as string;
  
  return <SourcingDashboard initialSessionId={id} />;
}
