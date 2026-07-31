"use client";

/*
  Auth context. Holds the current user (resolved from the JWT via /auth/me) and
  exposes login/logout. The token lives in localStorage - simple for a token-auth
  SPA against a separate API. Trade-off vs httpOnly cookies: readable by JS, so
  it's XSS-sensitive; acceptable for this portfolio product and noted in the docs.
*/

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError, clearToken, getToken, setToken } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    // Only a real 401/403 means the token is bad - clear it then. A transient
    // network error must NOT log the user out, so we retry a few times and, if
    // still failing, keep the token so a later attempt can recover.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const me = await api<User>("/auth/me");
        setUser(me);
        setLoading(false);
        return;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearToken();
          setUser(null);
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 400)); // transient - back off & retry
      }
    }
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (token: string) => {
      setToken(token);
      setLoading(true);
      await loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
