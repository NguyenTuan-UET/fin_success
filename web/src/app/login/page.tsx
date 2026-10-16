"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { useFcc } from "@/lib/session";
import { ROLES, roleOfOrgType } from "@/lib/roles";

export default function LoginPage() {
  const { status, org } = useFcc();
  const router = useRouter();
  useEffect(() => {
    if (status === "ready" && org) router.replace(ROLES[roleOfOrgType(org.type)].home);
  }, [status, org, router]);
  if (status === "loading") return <div className="auth-wrap muted">Đang tải…</div>;
  return <AuthGate />;
}
