import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "@/lib/auth/tokens";
import type { ApiError, Paginated, TokenPair } from "@/lib/api/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type RequestOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
};

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const url = new URL(path.startsWith("http") ? path : `${API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const res = await fetch(buildUrl("/auth/token/refresh/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = (await res.json()) as { access: string };
  setAccessToken(data.access);
  return true;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, skipAuth, headers, ...rest } = options;
  const url = buildUrl(path, params);

  const doFetch = async () => {
    const hdrs = new Headers(headers);
    if (!hdrs.has("Content-Type") && rest.body) {
      hdrs.set("Content-Type", "application/json");
    }
    if (!skipAuth) {
      const token = getAccessToken();
      if (token) hdrs.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, { ...rest, headers: hdrs });
  };

  let res = await doFetch();
  if (res.status === 401 && !skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await doFetch();
  }

  if (res.status === 401 && !skipAuth) {
    clearTokens();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    let err: ApiError = {};
    try {
      err = (await res.json()) as ApiError;
    } catch {
      err = { detail: res.statusText };
    }
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(username: string, password: string) {
  const data = await apiRequest<TokenPair>("/auth/token/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    skipAuth: true,
  });
  setAccessToken(data.access);
  setRefreshToken(data.refresh);
  return data;
}

export async function fetchMe() {
  return apiRequest<import("@/lib/api/types").MeResponse>("/auth/me/");
}

export async function updateMe(data: {
  display_name?: string;
  phone?: string;
  locale?: string;
  current_password?: string;
  new_password?: string;
}) {
  return apiRequest<import("@/lib/api/types").MeResponse>("/auth/me/", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchPaginated<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  return apiRequest<Paginated<T>>(path, { params });
}

export function projectPath(projectId: string, resource: string) {
  return `/projects/${projectId}/${resource}/`;
}
