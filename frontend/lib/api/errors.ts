import type { ApiError } from "@/lib/api/types";

function appendField(parts: string[], key: string, value: unknown) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    parts.push(`${key}: ${value.map(String).join(", ")}`);
    return;
  }
  if (typeof value === "string") {
    parts.push(key === "non_field_errors" || key === "detail" ? value : `${key}: ${value}`);
    return;
  }
  if (typeof value === "object") {
    parts.push(`${key}: ${JSON.stringify(value)}`);
  }
}

export function formatApiError(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (!err || typeof err !== "object") {
    return "Bir hata oluştu";
  }
  const e = err as ApiError & Record<string, unknown>;
  if (typeof e.detail === "string") {
    return e.detail;
  }
  if (Array.isArray(e.detail)) {
    return (e.detail as unknown[]).map(String).join(" · ");
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(e)) {
    if (key === "detail") continue;
    appendField(parts, key, value);
  }
  return parts.length > 0 ? parts.join(" · ") : "Bir hata oluştu";
}
