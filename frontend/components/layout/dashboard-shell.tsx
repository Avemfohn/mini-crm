"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/lib/auth/context";
import { tr } from "@/lib/i18n/tr";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) {
      router.replace("/login");
    }
  }, [loading, me, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{tr.loading}</p>
      </div>
    );
  }

  if (!me) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="min-w-0 flex-1 overflow-x-hidden bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
