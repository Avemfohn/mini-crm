"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import type { UnitOwnership } from "@/lib/api/types";
import { ResourcePage } from "@/components/data-table/resource-page";
import { ownersApi, ownershipsApi, unitsApi } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/context";
import { canAdminProject, canWriteProject } from "@/lib/auth/permissions";
import { tr } from "@/lib/i18n/tr";

export default function OwnershipsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { getRole } = useAuth();
  const role = getRole(projectId);
  const api = ownershipsApi(projectId);

  const { data: units } = useQuery({
    queryKey: ["units", projectId, "all"],
    queryFn: () => unitsApi(projectId).list(),
  });
  const { data: owners } = useQuery({
    queryKey: ["owners", projectId, "all"],
    queryFn: () => ownersApi(projectId).list(),
  });

  return (
    <ResourcePage<UnitOwnership>
      title={tr.ownerships}
      queryKey={["ownerships", projectId]}
      canWrite={canWriteProject(role)}
      canAdmin={canAdminProject(role)}
      softDelete={false}
      columns={[
        {
          key: "owner",
          label: tr.owner,
          render: (row) => row.owner.full_name,
        },
        { key: "unit", label: tr.unit },
        { key: "effective_from", label: tr.effectiveFrom },
        { key: "effective_to", label: tr.effectiveTo },
        { key: "ownership_share", label: tr.ownershipShare },
      ]}
      fields={[
        {
          name: "unit_id",
          label: tr.unit,
          type: "select",
          required: true,
          options:
            units?.results.map((u) => ({
              value: u.id,
              label: u.unit_number,
            })) ?? [],
        },
        {
          name: "owner_id",
          label: tr.owner,
          type: "select",
          required: true,
          options:
            owners?.results.map((o) => ({
              value: o.id,
              label: o.full_name,
            })) ?? [],
        },
        { name: "effective_from", label: tr.effectiveFrom, type: "date", required: true },
        { name: "effective_to", label: tr.effectiveTo, type: "date" },
        { name: "ownership_share", label: tr.ownershipShare, required: true },
        { name: "is_primary_contact", label: tr.primaryContact, type: "checkbox" },
      ]}
      fetchList={(params) => api.list(params)}
      createItem={(data) => api.create(data)}
      updateItem={(id, data) => api.update(id, data)}
      deleteItem={(id) => api.remove(id)}
      getInitialValues={(row) => ({
        unit_id: row.unit,
        owner_id: row.owner.id,
        effective_from: row.effective_from,
        effective_to: row.effective_to ?? "",
        ownership_share: row.ownership_share,
        is_primary_contact: row.is_primary_contact,
      })}
    />
  );
}
