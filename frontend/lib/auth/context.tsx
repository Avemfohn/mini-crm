"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchMe, login as apiLogin } from "@/lib/api/client";
import type { MeResponse } from "@/lib/api/types";
import { clearTokens, getRefreshToken, setAccessToken } from "@/lib/auth/tokens";
import { getEffectiveRole } from "@/lib/auth/permissions";
import type { RoleCode } from "@/lib/i18n/tr";

interface AuthContextValue {
  me: MeResponse | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  getRole: (projectId: string) => RoleCode | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const data = await fetchMe();
    setMe(data);
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!getRefreshToken()) {
        setLoading(false);
        return;
      }
      try {
        await refreshMe();
      } catch {
        clearTokens();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [refreshMe]);

  const login = useCallback(
    async (username: string, password: string) => {
      await apiLogin(username, password);
      await refreshMe();
    },
    [refreshMe]
  );

  const logout = useCallback(() => {
    clearTokens();
    setAccessToken(null);
    setMe(null);
    window.location.href = "/login";
  }, []);

  const getRole = useCallback(
    (projectId: string) => getEffectiveRole(me?.memberships ?? [], projectId, me),
    [me]
  );

  const value = useMemo(
    () => ({ me, loading, login, logout, refreshMe, getRole }),
    [me, loading, login, logout, refreshMe, getRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useProjectRole(projectId: string) {
  const { getRole } = useAuth();
  return getRole(projectId);
}
