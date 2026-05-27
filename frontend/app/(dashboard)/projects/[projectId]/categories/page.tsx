"use client";

import { useParams } from "next/navigation";
import type { TransactionCategory } from "@/lib/api/types";
import { ResourcePage } from "@/components/data-table/resource-page";
import { categoriesApi } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/context";
import { canAdminProject, canWriteProject } from "@/lib/auth/permissions";
import { statusLabels, tr } from "@/lib/i18n/tr";

export default function CategoriesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { getRole } = useAuth();
  const role = getRole(projectId);
  const api = categoriesApi(projectId);

  return (
    <ResourcePage<TransactionCategory>
      title={tr.categories}
      queryKey={["categories", projectId]}
      canWrite={canWriteProject(role)}
      canAdmin={canAdminProject(role)}
      columns={[
        { key: "name", label: tr.name },
        { key: "slug", label: tr.slug },
        {
          key: "direction_hint",
          label: tr.directionHint,
          render: (row) => statusLabels[row.direction_hint] ?? row.direction_hint,
        },
        { key: "sort_order", label: tr.sortOrder },
      ]}
      fields={[
        { name: "name", label: tr.name, required: true },
        { name: "slug", label: tr.slug, required: true },
        {
          name: "direction_hint",
          label: tr.directionHint,
          type: "select",
          options: [
            { value: "INFLOW", label: tr.inflow },
            { value: "OUTFLOW", label: tr.outflow },
            { value: "EITHER", label: statusLabels.EITHER },
          ],
        },
        { name: "sort_order", label: tr.sortOrder, type: "number" },
        { name: "is_active", label: tr.active, type: "checkbox" },
      ]}
      fetchList={(params) => api.list(params)}
      createItem={(data) => api.create(data)}
      updateItem={(id, data) => api.update(id, data)}
      deleteItem={(id) => api.remove(id)}
      restoreItem={(id) => api.restore!(id)}
      getInitialValues={(row) => ({
        name: row.name,
        slug: row.slug,
        direction_hint: row.direction_hint,
        sort_order: row.sort_order,
        is_active: row.is_active,
      })}
    />
  );
}
