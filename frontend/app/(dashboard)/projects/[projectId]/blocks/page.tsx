"use client";

import { useParams } from "next/navigation";
import type { Block } from "@/lib/api/types";
import { ResourcePage } from "@/components/data-table/resource-page";
import { blocksApi } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/context";
import { canAdminProject, canWriteProject } from "@/lib/auth/permissions";
import { tr } from "@/lib/i18n/tr";

export default function BlocksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { getRole } = useAuth();
  const role = getRole(projectId);
  const api = blocksApi(projectId);

  return (
    <ResourcePage<Block>
      title={tr.blocks}
      queryKey={["blocks", projectId]}
      canWrite={canWriteProject(role)}
      canAdmin={canAdminProject(role)}
      columns={[
        { key: "name", label: tr.name },
        { key: "code", label: tr.code },
        { key: "sort_order", label: tr.sortOrder },
      ]}
      fields={[
        { name: "name", label: tr.name, required: true },
        { name: "code", label: tr.code, required: true },
        { name: "sort_order", label: tr.sortOrder, type: "number" },
      ]}
      fetchList={(params) => api.list(params)}
      createItem={(data) => api.create(data)}
      updateItem={(id, data) => api.update(id, data)}
      deleteItem={(id) => api.remove(id)}
      restoreItem={(id) => api.restore!(id)}
      getInitialValues={(row) => ({
        name: row.name,
        code: row.code,
        sort_order: row.sort_order,
      })}
    />
  );
}
