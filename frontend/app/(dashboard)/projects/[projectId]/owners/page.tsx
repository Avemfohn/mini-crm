"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { Owner } from "@/lib/api/types";
import { ResourcePage } from "@/components/data-table/resource-page";
import { ownersApi } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/context";
import { canAdminProject, canWriteProject } from "@/lib/auth/permissions";
import { tr } from "@/lib/i18n/tr";

export default function OwnersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { getRole } = useAuth();
  const role = getRole(projectId);
  const api = ownersApi(projectId);

  return (
    <ResourcePage<Owner>
      title={tr.owners}
      queryKey={["owners", projectId]}
      canWrite={canWriteProject(role)}
      canAdmin={canAdminProject(role)}
      columns={[
        {
          key: "full_name",
          label: tr.fullName,
          render: (row) => (
            <Link
              href={`/projects/${projectId}/owners/${row.id}`}
              className="font-medium text-primary hover:underline"
            >
              {row.full_name}
            </Link>
          ),
        },
        { key: "email", label: tr.email },
        { key: "phone", label: tr.phone },
      ]}
      fields={[
        { name: "full_name", label: tr.fullName, required: true },
        { name: "email", label: tr.email },
        { name: "phone", label: tr.phone },
        { name: "national_id", label: tr.nationalId },
        { name: "notes", label: tr.notes, type: "textarea" },
      ]}
      fetchList={(params) => api.list(params)}
      createItem={(data) => api.create(data)}
      updateItem={(id, data) => api.update(id, data)}
      deleteItem={(id) => api.remove(id)}
      restoreItem={(id) => api.restore!(id)}
      getInitialValues={(row) => ({
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        national_id: row.national_id,
        notes: row.notes,
      })}
    />
  );
}
