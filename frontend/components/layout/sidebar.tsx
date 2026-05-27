"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh max-h-dvh w-64 shrink-0 flex-col self-start overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <SidebarNav />
    </aside>
  );
}
