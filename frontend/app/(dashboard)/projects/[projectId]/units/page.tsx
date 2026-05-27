"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import type { Unit } from "@/lib/api/types";
import { ResourcePage } from "@/components/data-table/resource-page";
import { blocksApi, unitsApi } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/context";
import { canAdminProject, canWriteProject } from "@/lib/auth/permissions";
import { statusLabels, tr } from "@/lib/i18n/tr";

export default function UnitsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { getRole } = useAuth();
  const role = getRole(projectId);
  const api = unitsApi(projectId);

  const { data: blocks } = useQuery({
    queryKey: ["blocks", projectId, "all"],
    queryFn: () => blocksApi(projectId).list({ page: 1 }),
  });

  const singleBlock = blocks?.results.length === 1 ? blocks.results[0] : null;

  const fields = useMemo(() => {
    const base = [
      { name: "unit_number", label: tr.unitNumber, required: true },
      { name: "floor", label: tr.floor, type: "number" as const },
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
    if (!singleBlock) {
      return [
        ...base.slice(0, 2),
        {
          name: "block",
          label: tr.blocks,
          type: "select" as const,
          options:
            blocks?.results.map((b) => ({ value: b.id, label: b.name })) ?? [],
        },
        ...base.slice(2),
      ];
    }
    return base;
  }, [blocks, singleBlock]);

  return (
    <ResourcePage<Unit>
      title={tr.units}
      queryKey={["units", projectId]}
      canWrite={canWriteProject(role)}
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
        { key: "floor", label: tr.floor },
        {
          key: "status",
          label: tr.status,
          render: (row) => statusLabels[row.status] ?? row.status,
        },
      ]}
      fields={fields}
      fetchList={(params) => api.list(params)}
      createItem={(data) =>
        api.create({
          ...data,
          block: singleBlock ? singleBlock.id : data.block || null,
        })
      }
      updateItem={(id, data) =>
        api.update(id, {
          ...data,
          block: singleBlock ? singleBlock.id : data.block || null,
        })
      }
      deleteItem={(id) => api.remove(id)}
      restoreItem={(id) => api.restore!(id)}
      getInitialValues={(row) => ({
        unit_number: row.unit_number,
        floor: row.floor,
        block: row.block ?? "",
        status: row.status,
        gross_area_m2: row.gross_area_m2,
        notes: row.notes,
      })}
    />
  );
}
