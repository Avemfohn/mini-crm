"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { tr } from "@/lib/i18n/tr";

export function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur supports-[padding:max(0px)]:pt-[max(0.625rem,env(safe-area-inset-top))] md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="outline" size="icon" aria-label={tr.menu}>
              <Menu className="h-5 w-5" />
            </Button>
          }
        />
        <SheetContent
          side="left"
          showCloseButton
          className="flex w-[min(280px,88vw)] flex-col gap-0 border-r bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{tr.menu}</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <BrandLogo variant="sidebar" className="max-h-10 min-w-0 flex-1" linked />
    </header>
  );
}
