import type { MeResponse, MembershipSummary } from "@/lib/api/types";
import type { RoleCode } from "@/lib/i18n/tr";

export function getProjectRole(
  memberships: MembershipSummary[],
  projectId: string
): RoleCode | null {
  const m = memberships.find((x) => x.project.id === projectId && x.is_active);
  return (m?.role.code as RoleCode) ?? null;
}

export function canWriteProject(role: RoleCode | null) {
  return role === "ADMIN" || role === "CONTRACTOR";
}

export function canAdminProject(role: RoleCode | null) {
  return role === "ADMIN";
}

export function isOwnerReadOnly(role: RoleCode | null) {
  return role === "OWNER";
}

export function canCreateProject(me: MeResponse | null) {
  if (!me) return false;
  return me.memberships.some(
    (m) => m.is_active && (m.role.code === "ADMIN" || m.role.code === "CONTRACTOR")
  );
}
