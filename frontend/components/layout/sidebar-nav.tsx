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

type SidebarNavProps = {
  onNavigate?: () => void;
  showLogo?: boolean;
};

export function SidebarNav({ onNavigate, showLogo = true }: SidebarNavProps) {
  const pathname = usePathname();
  const { me, logout } = useAuth();

  const linkClass = (active: boolean) =>
    cn(
      "block rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent",
      active
        ? "bg-sidebar-primary/15 font-medium text-sidebar-primary ring-1 ring-sidebar-primary/25"
        : "text-sidebar-foreground/90"
    );

  return (
    <>
      {showLogo && (
        <div className="flex items-center justify-center border-b border-sidebar-border px-3 py-4">
          <BrandLogo variant="sidebar" className="max-h-14 w-full md:max-h-16" />
        </div>
      )}
      <nav className="flex-1 space-y-1 p-3">
        <Link
          href="/projects"
          onClick={onNavigate}
          className={linkClass(
            pathname === "/projects" || pathname.startsWith("/projects/")
          )}
        >
          {tr.projects}
        </Link>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            linkClass(pathname === "/settings"),
            "flex items-center gap-2"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
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
          onClick={() => {
            onNavigate?.();
            logout();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {tr.logout}
        </Button>
      </div>
    </>
  );
}
