import {
  apiRequest,
  fetchPaginated,
  projectPath,
} from "@/lib/api/client";
import type {
  Block,
  Owner,
  PaymentPlan,
  Project,
  ProjectMembership,
  Role,
  Transaction,
  TransactionCategory,
  Unit,
  UnitOwnership,
} from "@/lib/api/types";

export const rolesApi = {
  list: () => apiRequest<Role[]>("/roles/"),
};

export const projectsApi = {
  list: (params?: Record<string, string | boolean | number | undefined>) =>
    fetchPaginated<Project>("/projects/", params),
  get: (id: string) => apiRequest<Project>(`/projects/${id}/`),
  create: (data: Partial<Project>) =>
    apiRequest<Project>("/projects/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Project>) =>
    apiRequest<Project>(`/projects/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    apiRequest<void>(`/projects/${id}/`, { method: "DELETE" }),
  restore: (id: string) =>
    apiRequest<Project>(`/projects/${id}/restore/`, { method: "POST" }),
};

function crud<T>(projectId: string, resource: string, softDelete = true) {
  const base = projectPath(projectId, resource);
  return {
    list: (params?: Record<string, string | boolean | number | undefined>) =>
      fetchPaginated<T>(base, params),
    create: (data: Record<string, unknown>) =>
      apiRequest<T>(base, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      apiRequest<T>(`${base}${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiRequest<void>(`${base}${id}/`, { method: "DELETE" }),
    restore: softDelete
      ? (id: string) =>
          apiRequest<T>(`${base}${id}/restore/`, { method: "POST" })
      : undefined,
  };
}

export const blocksApi = (projectId: string) => crud<Block>(projectId, "blocks");

export const unitsApi = (projectId: string) => {
  const base = projectPath(projectId, "units");
  const core = crud<Unit>(projectId, "units");
  return {
    ...core,
    get: (id: string) => apiRequest<Unit>(`${base}${id}/`),
    ownersAt: (unitId: string, date?: string) =>
      apiRequest<UnitOwnership[]>(`${base}${unitId}/owners-at/`, {
        params: date ? { date } : undefined,
      }),
    setOwner: (unitId: string, body: { owner_id: string; effective_from?: string }) =>
      apiRequest<UnitOwnership>(`${base}${unitId}/set-owner/`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  };
};

export const ownersApi = (projectId: string) => {
  const base = projectPath(projectId, "owners");
  const core = crud<Owner>(projectId, "owners");
  return {
    ...core,
    get: (id: string) => apiRequest<Owner>(`${base}${id}/`),
  };
};

export const paymentPlansApi = (projectId: string) =>
  crud<PaymentPlan>(projectId, "payment-plans", false);
export const ownershipsApi = (projectId: string) =>
  crud<UnitOwnership>(projectId, "ownerships", false);
export const categoriesApi = (projectId: string) =>
  crud<TransactionCategory>(projectId, "categories");
export const membershipsApi = (projectId: string) =>
  crud<ProjectMembership>(projectId, "memberships", false);

export const transactionsApi = (projectId: string) => ({
  ...crud<Transaction>(projectId, "transactions", false),
  post: (id: string) =>
    apiRequest<Transaction>(`${projectPath(projectId, "transactions")}${id}/post/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  void: (id: string, body: { void_reason?: string; create_reversal?: boolean }) =>
    apiRequest<Transaction>(
      `${projectPath(projectId, "transactions")}${id}/void/`,
      { method: "POST", body: JSON.stringify(body) }
    ),
});
