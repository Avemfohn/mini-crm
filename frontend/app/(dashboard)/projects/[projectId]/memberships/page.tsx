"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { ProjectMembership } from "@/lib/api/types";
import { ResourcePage } from "@/components/data-table/resource-page";
import { membershipsApi } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/context";
import { canAdminProject } from "@/lib/auth/permissions";
import { roleLabels, tr } from "@/lib/i18n/tr";
import type { RoleCode } from "@/lib/i18n/tr";

export default function MembershipsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { getRole, me } = useAuth();
  const role = getRole(projectId);
  const api = membershipsApi(projectId);

  useEffect(() => {
    if (role && !canAdminProject(role)) {
      router.replace(`/projects/${projectId}`);
    }
  }, [role, projectId, router]);

  const roleOptions = useMemo(() => {
    const seen = new Map<number, RoleCode>();
    me?.memberships.forEach((m) => {
      seen.set(m.role.id, m.role.code as RoleCode);
    });
    if (seen.size === 0) {
      (["ADMIN", "CONTRACTOR", "OWNER"] as RoleCode[]).forEach((code, i) => {
        seen.set(i + 1, code);
      });
    }
    return Array.from(seen.entries()).map(([id, code]) => ({
      value: String(id),
      label: roleLabels[code],
    }));
  }, [me]);

  if (!canAdminProject(role)) {
    return <p>{tr.accessDenied}</p>;
  }

  return (
    <ResourcePage<ProjectMembership>
      title={tr.memberships}
      queryKey={["memberships", projectId]}
      canWrite
      canAdmin
      softDelete={false}
      columns={[
        { key: "user", label: tr.username, render: (row) => row.user.username },
        {
          key: "role",
          label: tr.role,
          render: (row) => roleLabels[row.role.code as RoleCode] ?? row.role.name,
        },
        {
          key: "is_active",
          label: tr.isActive,
          render: (row) => (row.is_active ? tr.active : "Pasif"),
        },
      ]}
      fields={[
        { name: "user_id", label: tr.userId, type: "number", required: true },
        {
          name: "role_id",
          label: tr.role,
          type: "select",
          required: true,
          options: roleOptions,
        },
        { name: "is_active", label: tr.isActive, type: "checkbox" },
      ]}
      fetchList={(params) => api.list(params)}
      createItem={(data) =>
        api.create({
          user_id: Number(data.user_id),
          role_id: Number(data.role_id),
          is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        } as Record<string, unknown>)
      }
      updateItem={(id, data) =>
        api.update(id, {
          role_id: data.role_id ? Number(data.role_id) : undefined,
          is_active:
            data.is_active !== undefined ? Boolean(data.is_active) : undefined,
        })
      }
      deleteItem={(id) => api.remove(id)}
      getInitialValues={(row) => ({
        user_id: row.user.id,
        role_id: row.role.id,
        is_active: row.is_active,
      })}
    />
  );
}
