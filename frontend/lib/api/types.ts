export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  currency: string;
}

export interface Project extends ProjectSummary {
  address: string;
  description: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipSummary {
  id: string;
  project: ProjectSummary;
  role: Role;
  is_active: boolean;
}

export interface MeResponse {
  user: User;
  profile: { display_name: string; phone: string; locale: string } | null;
  memberships: MembershipSummary[];
}

export interface SoftDeleteFields {
  is_deleted: boolean;
  deleted_at: string | null;
}

export interface Block extends SoftDeleteFields {
  id: string;
  project: string;
  name: string;
  code: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Unit extends SoftDeleteFields {
  id: string;
  project: string;
  block: string | null;
  unit_number: string;
  floor: number | null;
  gross_area_m2: string | null;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Owner extends SoftDeleteFields {
  id: string;
  full_name: string;
  national_id: string;
  phone: string;
  email: string;
  user: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface UnitOwnership {
  id: string;
  unit: string;
  owner: Owner;
  effective_from: string;
  effective_to: string | null;
  ownership_share: string;
  is_primary_contact: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionCategory extends SoftDeleteFields {
  id: string;
  project: string;
  name: string;
  slug: string;
  direction_hint: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  project: string;
  unit: string | null;
  owner: string | null;
  category: string;
  transaction_date: string;
  amount: string;
  direction: string;
  description: string;
  reference_no: string;
  metadata: Record<string, unknown>;
  status: string;
  entry_type: string;
  reverses: string | null;
  voided_at: string | null;
  voided_by: number | null;
  void_reason: string;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstallmentRow {
  installment: number;
  due_date: string;
  expected: string;
  paid: string;
  remaining: string;
}

export interface PaymentPlan {
  id: string;
  project: string;
  unit: Unit;
  owner: Owner;
  total_amount: string;
  installment_count: number;
  start_date: string;
  notes: string;
  monthly_amount: string;
  schedule: InstallmentRow[];
  created_at: string;
  updated_at: string;
}

export interface ProjectMembership {
  id: string;
  user: User;
  project: ProjectSummary;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export type ApiError = {
  detail?: string;
  [key: string]: unknown;
};
