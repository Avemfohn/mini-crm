import { cn } from "@/lib/utils";

export function TableScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mobile-card-table lux-table rounded-xl border border-border/70 bg-card shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
