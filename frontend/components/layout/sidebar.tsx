"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/lib/auth/context";
import { tr } from "@/lib/i18n/tr";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { me, logout } = useAuth();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-center border-b border-sidebar-border px-3 py-4">
        <BrandLogo variant="sidebar" className="max-h-16 w-full" />
      </div>
      <nav className="flex-1 space-y-1 p-3">
        <Link
          href="/projects"
          className={cn(
            "block rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent",
            pathname === "/projects" || pathname.startsWith("/projects/")
              ? "bg-sidebar-primary/15 font-medium text-sidebar-primary ring-1 ring-sidebar-primary/25"
              : "text-sidebar-foreground/90"
          )}
        >
          {tr.projects}
        </Link>
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent",
            pathname === "/settings"
              ? "bg-sidebar-primary/15 font-medium text-sidebar-primary ring-1 ring-sidebar-primary/25"
              : "text-sidebar-foreground/90"
          )}
        >
          <Settings className="h-4 w-4" />
          {tr.settings}
        </Link>
      </nav>
      <div className="space-y-2 border-t border-sidebar-border p-3">
        <ThemeToggle />
        <p className="truncate px-1 text-sm text-sidebar-foreground/70">
          {me?.profile?.display_name || me?.user.username}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {tr.logout}
        </Button>
      </div>
    </aside>
  );
}
