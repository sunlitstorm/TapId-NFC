import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, loadToken, setToken, setUnauthorizedHandler } from "@/src/api";
import { queryClient } from "@/src/query-client";
import type { User } from "@/src/types";

type AuthResponse = { access_token: string; user: User };
export type RegisterInput = { email: string; password: string; full_name: string; student_number: string; program: string };

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          setUser(await api<User>("/auth/me"));
        } catch {
          await setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const accept = useCallback(async (res: AuthResponse) => {
    await setToken(res.access_token);
    queryClient.clear();
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => accept(await api<AuthResponse>("/auth/login", { method: "POST", body: { email: email.trim(), password } })),
      register: async (input) => accept(await api<AuthResponse>("/auth/register", { method: "POST", body: input })),
      logout: async () => {
        await setToken(null);
        queryClient.clear();
        setUser(null);
      },
      refresh: async () => setUser(await api<User>("/auth/me")),
    }),
    [user, loading, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
