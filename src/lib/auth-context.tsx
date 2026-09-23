import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface UserRoleInfo {
  role: AppRole | null;
  branch_id: string | null;
  is_primary_owner?: boolean;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: UserRoleInfo | null;
  loading: boolean;
  unavailable: boolean;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const lastKnownSessionRef = useRef<Session | null>(null);
  const roleRequestRef = useRef(0);

  const loadRole = async (uid: string) => {
    const requestId = ++roleRequestRef.current;
    try {
      let record: { role: AppRole; branch_id: string | null; is_primary_owner: boolean } | null =
        null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role, branch_id, is_primary_owner")
        .eq("user_id", uid)
        .limit(1)
        .abortSignal(AbortSignal.timeout(10_000));

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      record = data?.[0] ?? null;
      if (requestId !== roleRequestRef.current) return;

      if (!record) {
        setRole(null);
        setUnavailable(true);
        return;
      }

      setRole({
        role: record.role,
        branch_id: record.branch_id,
        is_primary_owner: record.is_primary_owner,
      });
      setUnavailable(false);
    } catch {
      if (requestId !== roleRequestRef.current) return;
      setRole({ role: null, branch_id: null });
      setUnavailable(true);
    }
  };

  useEffect(() => {
    let active = true;
    let sessionVersion = 0;
    let roleTimer: number | undefined;
    const startupTimeout = window.setTimeout(() => {
      if (!active) return;
      setUnavailable(true);
      setLoading(false);
    }, 12_000);

    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      const version = ++sessionVersion;
      window.clearTimeout(roleTimer);

      if (!nextSession?.user) {
        roleRequestRef.current += 1;
        queryClient.clear();
        lastKnownSessionRef.current = null;
        setSession(null);
        setUser(null);
        setRole(null);
        setUnavailable(false);
        setLoading(false);
        window.clearTimeout(startupTimeout);
        return;
      }

      const userChanged = lastKnownSessionRef.current?.user.id !== nextSession.user.id;
      if (userChanged) {
        roleRequestRef.current += 1;
        queryClient.clear();
        setRole(null);
        setLoading(true);
      }
      lastKnownSessionRef.current = nextSession;
      setSession(nextSession);
      setUser(nextSession.user);
      // Run outside the auth callback's session lock. Same-user refreshes keep
      // the mounted workspace intact while its permissions are revalidated.
      roleTimer = window.setTimeout(() => {
        void loadRole(nextSession.user.id).finally(() => {
          if (active && version === sessionVersion) {
            window.clearTimeout(startupTimeout);
            setLoading(false);
          }
        });
      }, 0);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;

      applySession(event === "SIGNED_OUT" ? null : s);
    });

    // onAuthStateChange emits INITIAL_SESSION after reading stored credentials;
    // a separate getSession() would duplicate the same startup role request.

    return () => {
      active = false;
      roleRequestRef.current += 1;
      window.clearTimeout(roleTimer);
      window.clearTimeout(startupTimeout);
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        role,
        loading,
        unavailable,
        refreshRole: async () => {
          if (user) await loadRole(user.id);
        },
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

/** Helper: true when the logged-in user is the business owner. */
export function useIsOwner(): boolean {
  const { role } = useAuth();
  return role?.role === "owner";
}

/** Helper: returns the worker's branch id (null for owner). */
export function useBranchId(): string | null {
  const { role } = useAuth();
  if (role?.role === "owner") return null;
  return role?.branch_id ?? null;
}

/** Helper: true when the user is an owner OR has a branch assignment. */
export function useCanOperate(): boolean {
  const { role, loading } = useAuth();
  if (loading) return false;
  return role?.role === "owner" || (!!role?.branch_id && !!role?.role);
}
