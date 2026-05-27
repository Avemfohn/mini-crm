"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { Unit } from "@/lib/api/types";
import {
  ResourcePage,
  type ResourcePageHandle,
} from "@/components/data-table/resource-page";
import { BuildingUnitsView } from "@/components/units/building-units-view";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { blocksApi, unitsApi } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/context";
import { canAdminProject, canWriteProject } from "@/lib/auth/permissions";
import {
  defaultFloorLabel,
  getOccupiedPositions,
  resolveUnitFloor,
} from "@/lib/units/building-layout";
import { statusLabels, tr } from "@/lib/i18n/tr";

export default function UnitsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { getRole } = useAuth();
  const role = getRole(projectId);
  const api = unitsApi(projectId);
  const resourceRef = useRef<ResourcePageHandle>(null);
  const [tab, setTab] = useState("building");
  const canWrite = canWriteProject(role);

  const { data: blocks } = useQuery({
    queryKey: ["blocks", projectId, "all"],
    queryFn: () => blocksApi(projectId).list({ page: 1 }),
  });

  const primaryBlock = useMemo(() => {
    if (!blocks?.results.length) return null;
    if (blocks.results.length === 1) return blocks.results[0];
    return [...blocks.results].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "tr"),
    )[0];
  }, [blocks]);

  const { data: allUnits, isLoading: unitsLoading } = useQuery({
    queryKey: ["units", projectId],
    queryFn: () => api.list({ page: 1, page_size: 200 }),
  });

  const buildingUnits = useMemo(() => {
    if (!primaryBlock || !allUnits?.results) return [];
    return allUnits.results.filter(
      (u) => u.block === primaryBlock.id && !u.is_deleted,
    );
  }, [allUnits, primaryBlock]);

  const unitList = allUnits?.results ?? [];

  const positionOptionsFor = useMemo(
    () =>
      (form: Record<string, unknown>, ctx: { editingId?: string }) => {
        const is_roof_level = Boolean(form.is_roof_level);
        const floor = resolveUnitFloor({
          floor: form.floor,
          is_roof_level,
        });
        const blockId = String(primaryBlock?.id ?? form.block ?? "");
        const base = [{ value: "", label: "—" }];

        if (!blockId) {
          return [
            ...base,
            { value: "1", label: tr.leftSlot },
            { value: "2", label: tr.rightSlot },
          ];
        }

        if (floor === null && !is_roof_level) {
          return [
            ...base,
            { value: "1", label: tr.leftSlot },
            { value: "2", label: tr.rightSlot },
          ];
        }

        const occupied = getOccupiedPositions(
          unitList,
          blockId,
          floor,
          is_roof_level,
          ctx.editingId,
        );

        if (!occupied.has(1)) base.push({ value: "1", label: tr.leftSlot });
        if (!occupied.has(2)) base.push({ value: "2", label: tr.rightSlot });
        return base;
      },
    [unitList, primaryBlock],
  );

  const fields = useMemo(() => {
    const base = [
      { name: "unit_number", label: tr.unitNumber, required: true },
      {
        name: "is_roof_level",
        label: `${tr.roofLevel} — ${tr.roofLevelHint}`,
        type: "checkbox" as const,
        checkboxDefault: false,
        clearFieldsWhenChecked: ["floor", "position_on_floor"],
      },
      {
        name: "floor",
        label: `${tr.floor} (${tr.floorHint})`,
        type: "number" as const,
        hidden: (form: Record<string, unknown>) => Boolean(form.is_roof_level),
      },
      {
        name: "position_on_floor",
        label: tr.positionOnFloor,
        type: "select" as const,
        getOptions: positionOptionsFor,
      },
      {
        name: "status",
        label: tr.status,
        type: "select" as const,
        options: [
          { value: "AVAILABLE", label: statusLabels.AVAILABLE },
          { value: "ASSIGNED", label: statusLabels.ASSIGNED },
          { value: "DELIVERED", label: statusLabels.DELIVERED },
        ],
      },
      { name: "gross_area_m2", label: tr.area },
      { name: "notes", label: tr.notes, type: "textarea" as const },
    ];
    if (!primaryBlock || blocks?.results.length !== 1) {
      return [
        base[0],
        {
          name: "block",
          label: tr.blocks,
          type: "select" as const,
          options:
            blocks?.results.map((b) => ({ value: b.id, label: b.name })) ?? [],
        },
        ...base.slice(1),
      ];
    }
    return base;
  }, [blocks, primaryBlock, positionOptionsFor]);

  const validateForm = (
    form: Record<string, unknown>,
    ctx: { editingId?: string },
  ) => {
    const is_roof_level = Boolean(form.is_roof_level);
    const floor = resolveUnitFloor({ floor: form.floor, is_roof_level });
    const blockId = String(primaryBlock?.id ?? form.block ?? "");
    if (!blockId) return null;
    if (floor === null && !is_roof_level) return null;

    const occupied = getOccupiedPositions(
      unitList,
      blockId,
      floor,
      is_roof_level,
      ctx.editingId,
    );

    const posRaw = form.position_on_floor;
    const pos =
      posRaw === "" || posRaw === undefined || posRaw === null
        ? null
        : Number(posRaw);

    if (pos === 1 || pos === 2) {
      if (occupied.has(pos)) return tr.positionTaken;
      return null;
    }

    if (occupied.size >= 2) return tr.floorFull;
    return null;
  };

  const normalizePayload = (data: Record<string, unknown>) => {
    const position = data.position_on_floor;
    const is_roof_level = Boolean(data.is_roof_level);
    return {
      ...data,
      block: primaryBlock ? primaryBlock.id : data.block || null,
      floor: resolveUnitFloor({ floor: data.floor, is_roof_level }),
      floor_label: "",
      position_on_floor:
        position === "" || position === undefined || position === null
          ? null
          : Number(position),
      is_roof_level,
    };
  };

  const openCreate = () => resourceRef.current?.openCreate();

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">{tr.units}</h2>
        {canWrite && (
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            {tr.create}
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="building" className="flex-1 sm:flex-none">
            {tr.buildingView}
          </TabsTrigger>
          <TabsTrigger value="list" className="flex-1 sm:flex-none">
            {tr.listView}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="building">
          <BuildingUnitsView
            projectId={projectId}
            units={buildingUnits}
            blockName={primaryBlock?.name}
            isLoading={unitsLoading}
          />
          {!primaryBlock && !unitsLoading && (
            <p className="mt-2 text-sm text-muted-foreground">{tr.empty}</p>
          )}
        </TabsContent>

        <TabsContent value="list" />
      </Tabs>

      <div className={tab === "list" ? undefined : "hidden"}>
        <ResourcePage<Unit>
          ref={resourceRef}
          title={tr.units}
          hideTitle
          hideCreateButton
          queryKey={["units", projectId]}
          canWrite={canWrite}
          canAdmin={canAdminProject(role)}
          columns={[
            {
              key: "unit_number",
              label: tr.unitNumber,
              render: (row) => (
                <Link
                  href={`/projects/${projectId}/units/${row.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.unit_number}
                </Link>
              ),
            },
            {
              key: "floor",
              label: tr.floor,
              render: (row) => defaultFloorLabel(row),
            },
            {
              key: "status",
              label: tr.status,
              render: (row) => statusLabels[row.status] ?? row.status,
            },
          ]}
          fields={fields}
          validateForm={validateForm}
          fetchList={(params) => api.list(params)}
          createItem={(data) => api.create(normalizePayload(data))}
          updateItem={(id, data) => api.update(id, normalizePayload(data))}
          deleteItem={(id) => api.remove(id)}
          restoreItem={(id) => api.restore!(id)}
          getInitialValues={(row) => ({
            unit_number: row.unit_number,
            floor: row.is_roof_level ? "" : row.floor,
            position_on_floor:
              row.position_on_floor != null ? String(row.position_on_floor) : "",
            is_roof_level: row.is_roof_level,
            block: row.block ?? "",
            status: row.status,
            gross_area_m2: row.gross_area_m2,
            notes: row.notes,
          })}
        />
      </div>
    </div>
  );
}
