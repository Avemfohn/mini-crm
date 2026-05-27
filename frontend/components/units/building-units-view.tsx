"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Unit } from "@/lib/api/types";
import { statusLabels, tr } from "@/lib/i18n/tr";
import {
  groupUnitsForBuilding,
  type BuildingFloorRow,
} from "@/lib/units/building-layout";

const statusTone: Record<string, string> = {
  AVAILABLE:
    "border-muted-foreground/30 bg-muted/40 hover:bg-muted/60",
  ASSIGNED:
    "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20",
  DELIVERED:
    "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20",
};

function UnitCell({
  unit,
  projectId,
}: {
  unit: Unit | null;
  projectId: string;
}) {
  if (!unit) {
    return (
      <div
        className="flex min-h-11 flex-1 items-center justify-center rounded-md border border-dashed border-muted-foreground/25 bg-muted/20 px-2 py-3 text-xs text-muted-foreground"
        aria-hidden
      >
        {tr.emptyUnit}
      </div>
    );
  }

  const tone = statusTone[unit.status] ?? statusTone.AVAILABLE;

  return (
    <Link
      href={`/projects/${projectId}/units/${unit.id}`}
      className={cn(
        "flex min-h-11 flex-1 flex-col items-center justify-center rounded-md border px-2 py-3 text-center transition-colors",
        tone,
      )}
    >
      <span className="text-sm font-semibold">
        {tr.unitNumber} {unit.unit_number}
      </span>
      <span className="mt-0.5 text-xs text-muted-foreground">
        {statusLabels[unit.status] ?? unit.status}
      </span>
    </Link>
  );
}

function FloorRow({
  row,
  projectId,
}: {
  row: BuildingFloorRow;
  projectId: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[4.5rem_1fr] gap-2 sm:grid-cols-[5.5rem_1fr]",
        row.isRoof && "relative",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-end pr-1 text-right text-xs font-medium text-muted-foreground sm:text-sm",
          row.isRoof && "pt-2",
        )}
      >
        {row.label}
      </div>
      <div
        className={cn(
          "flex gap-2",
          row.isRoof &&
            "relative rounded-t-md border border-b-0 border-border bg-card px-2 pt-3 pb-2",
        )}
        style={
          row.isRoof
            ? {
                clipPath:
                  "polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)",
              }
            : undefined
        }
      >
        <UnitCell unit={row.slots[0]} projectId={projectId} />
        <UnitCell unit={row.slots[1]} projectId={projectId} />
      </div>
    </div>
  );
}

type BuildingUnitsViewProps = {
  projectId: string;
  units: Unit[];
  blockName?: string;
  isLoading?: boolean;
};

export function BuildingUnitsView({
  projectId,
  units,
  blockName,
  isLoading,
}: BuildingUnitsViewProps) {
  const floors = groupUnitsForBuilding(units);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{tr.loading}</p>;
  }

  if (floors.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <p>{tr.noBuildingUnits}</p>
        <p className="text-xs">{tr.configureBuildingHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {blockName && (
        <p className="text-sm text-muted-foreground">
          {tr.blocks}: {blockName}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3">
        {floors.map((row) => (
          <FloorRow key={row.floor} row={row} projectId={projectId} />
        ))}
      </div>
    </div>
  );
}
