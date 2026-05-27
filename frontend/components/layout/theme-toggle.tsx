"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { tr } from "@/lib/i18n/tr";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const label = !mounted
    ? tr.themeSystem
    : theme === "light"
      ? tr.themeLight
      : theme === "dark"
        ? tr.themeDark
        : tr.themeSystem;

  const icon = !mounted ? (
    <Monitor className="h-4 w-4" />
  ) : theme === "dark" ? (
    <Moon className="h-4 w-4" />
  ) : theme === "light" ? (
    <Sun className="h-4 w-4" />
  ) : (
    <Monitor className="h-4 w-4" />
  );

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-start gap-2"
      onClick={cycle}
      type="button"
      suppressHydrationWarning
    >
      {icon}
      <span className="truncate" suppressHydrationWarning>
        {label}
      </span>
    </Button>
  );
}
