import type { MeResponse, MembershipSummary } from "@/lib/api/types";
import type { RoleCode } from "@/lib/i18n/tr";

export function getProjectRole(
  memberships: MembershipSummary[],
  projectId: string
): RoleCode | null {
  const m = memberships.find((x) => x.project.id === projectId && x.is_active);
  return (m?.role.code as RoleCode) ?? null;
}

export function isSuperuser(me: MeResponse | null) {
  return Boolean(me?.user.is_superuser);
}

export function canWriteProject(role: RoleCode | null, me?: MeResponse | null) {
  if (isSuperuser(me ?? null)) return true;
  return role === "ADMIN" || role === "CONTRACTOR";
}

export function canAdminProject(role: RoleCode | null, me?: MeResponse | null) {
  if (isSuperuser(me ?? null)) return true;
  return role === "ADMIN";
}

export function isOwnerReadOnly(role: RoleCode | null, me?: MeResponse | null) {
  if (isSuperuser(me ?? null)) return false;
  return role === "OWNER";
}

export function canCreateProject(me: MeResponse | null) {
  if (!me) return false;
  if (isSuperuser(me)) return true;
  return me.memberships.some(
    (m) => m.is_active && (m.role.code === "ADMIN" || m.role.code === "CONTRACTOR")
  );
}
