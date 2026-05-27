import { cn } from "@/lib/utils";

export function TableScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("lux-table -mx-1 rounded-xl border shadow-sm sm:mx-0", className)}>
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="min-w-[36rem]">{children}</div>
      </div>
    </div>
  );
}
