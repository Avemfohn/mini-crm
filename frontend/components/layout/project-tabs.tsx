"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tr } from "@/lib/i18n/tr";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "", label: tr.overview },
  { href: "/units", label: tr.units },
  { href: "/owners", label: tr.owners },
  { href: "/transactions", label: tr.transactions },
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <div className="flex flex-wrap gap-1 border-b border-border/60 pb-2">
      {tabs.map((tab) => {
        const href = `${base}${tab.href}`;
        const active =
          tab.href === ""
            ? pathname === base
            : tab.href === "/units"
              ? pathname.includes("/units")
              : tab.href === "/owners"
                ? pathname.includes("/owners")
                : pathname.startsWith(href);
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-muted",
              active &&
                "bg-primary/10 font-medium text-primary ring-1 ring-primary/20"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
