import type { MeResponse, MembershipSummary } from "@/lib/api/types";
import type { RoleCode } from "@/lib/i18n/tr";

export function getProjectRole(
  memberships: MembershipSummary[],
  projectId: string
): RoleCode | null {
  const m = memberships.find((x) => x.project.id === projectId && x.is_active);
  return (m?.role.code as RoleCode) ?? null;
}

/**
 * Family app: any logged-in user can edit any project (backend SHARED_PROJECT_ACCESS).
 * Malik (OWNER) stays read-only when explicitly assigned.
 */
export function getEffectiveRole(
  memberships: MembershipSummary[],
  projectId: string,
  me: MeResponse | null
): RoleCode | null {
  if (!me) return null;
  if (me.user.is_superuser) return "ADMIN";
  const stored = getProjectRole(memberships, projectId);
  if (stored === "OWNER") return "OWNER";
  return "CONTRACTOR";
}

export function isSuperuser(me: MeResponse | null) {
  return Boolean(me?.user.is_superuser);
}

export function canWriteProject(role: RoleCode | null, me?: MeResponse | null) {
  if (isSuperuser(me ?? null)) return true;
  return role === "CONTRACTOR" || role === "ADMIN";
}

export function canAdminProject(role: RoleCode | null, me?: MeResponse | null) {
  if (isSuperuser(me ?? null)) return true;
  return role === "CONTRACTOR" || role === "ADMIN";
}

/** Any logged-in user can create a project (creator gets Müteahhit on that project). */
export function canCreateProject(me: MeResponse | null) {
  return Boolean(me);
}

export function isOwnerReadOnly(role: RoleCode | null, me?: MeResponse | null) {
  if (isSuperuser(me ?? null)) return false;
  return role === "OWNER";
}

export function canManageProjectsList(me: MeResponse | null) {
  return Boolean(me);
}
