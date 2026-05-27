import type { Unit } from "@/lib/api/types";

/** Sort key for units on the roof level when kat no is not entered. */
export const ROOF_FLOOR = 99;

export type BuildingFloorRow = {
  floor: number;
  label: string;
  isRoof: boolean;
  slots: [Unit | null, Unit | null];
};

export function defaultFloorLabel(
  unit: Pick<Unit, "floor" | "floor_label" | "is_roof_level">,
): string {
  const custom = unit.floor_label?.trim();
  if (custom) return custom;
  if (unit.is_roof_level) return "Çatı katı";
  const f = unit.floor ?? 0;
  if (f === -1) return "Bodrum kat";
  if (f === 0) return "Giriş kat";
  return `${f}. kat`;
}

export function resolveUnitFloor(data: {
  floor?: unknown;
  is_roof_level?: boolean;
}): number | null {
  if (data.is_roof_level) {
    if (data.floor === "" || data.floor === undefined || data.floor === null) {
      return ROOF_FLOOR;
    }
    const n = Number(data.floor);
    return Number.isFinite(n) ? n : ROOF_FLOOR;
  }
  if (data.floor === "" || data.floor === undefined || data.floor === null) {
    return null;
  }
  const n = Number(data.floor);
  return Number.isFinite(n) ? n : null;
}

function unitSlotOrder(unit: Unit): number {
  if (unit.position_on_floor === 1 || unit.position_on_floor === 2) {
    return unit.position_on_floor;
  }
  const n = Number.parseInt(unit.unit_number, 10);
  return Number.isFinite(n) ? n : 999;
}

function assignSlots(units: Unit[]): [Unit | null, Unit | null] {
  const slots: [Unit | null, Unit | null] = [null, null];
  const sorted = [...units].sort((a, b) => unitSlotOrder(a) - unitSlotOrder(b));

  for (const unit of sorted) {
    if (unit.position_on_floor === 1) {
      slots[0] = unit;
    } else if (unit.position_on_floor === 2) {
      slots[1] = unit;
    } else if (!slots[0]) {
      slots[0] = unit;
    } else if (!slots[1]) {
      slots[1] = unit;
    }
  }

  return slots;
}

/** Groups units into floor rows for the building diagram (lowest floor first). */
export function groupUnitsForBuilding(units: Unit[]): BuildingFloorRow[] {
  const byFloor = new Map<number, Unit[]>();

  for (const unit of units) {
    const floor = unit.floor ?? 0;
    const list = byFloor.get(floor) ?? [];
    list.push(unit);
    byFloor.set(floor, list);
  }

  return [...byFloor.keys()]
    .sort((a, b) => a - b)
    .map((floor) => {
      const floorUnits = byFloor.get(floor)!;
      const reference = floorUnits[0];
      return {
        floor,
        label: defaultFloorLabel(reference),
        isRoof: floorUnits.some((u) => u.is_roof_level),
        slots: assignSlots(floorUnits),
      };
    });
}
