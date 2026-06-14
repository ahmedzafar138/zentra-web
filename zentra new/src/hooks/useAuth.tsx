import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/types";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  loadingProfile: boolean;
  hasSupabaseConfig: boolean;
  loadProfile: () => Promise<Profile | null>;
  ensureProfile: (user: User, fallback?: Partial<Profile>) => Promise<Profile>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!hasSupabaseConfig) return null;
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      setProfile((data as Profile | null) ?? null);
      return (data as Profile | null) ?? null;
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const ensureProfile = useCallback(
    async (currentUser: User, fallback: Partial<Profile> = {}): Promise<Profile> => {
      if (!hasSupabaseConfig) {
        const stub: Profile = {
          id: currentUser.id,
          first_name: fallback.first_name ?? currentUser.email?.split("@")[0] ?? "Zentra",
          last_name: fallback.last_name ?? "",
          height_cm: null,
          weight_kg: null,
          steps_goal: 10000,
        };
        setProfile(stub);
        return stub;
      }
      const { data: existing, error: fetchError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (fetchError) throw new Error(`Profile lookup failed: ${fetchError.message}`);
      if (existing) {
        setProfile(existing as Profile);
        return existing as Profile;
      }
      const fallbackName = currentUser.email?.split("@")[0] ?? "Zentra";
      const { data, error } = await supabase
        .from("user_profiles")
        .insert({
          id: currentUser.id,
          first_name: fallback.first_name ?? fallbackName,
          last_name: fallback.last_name ?? "",
          steps_goal: 10000,
        })
        .select("*")
        .single();
      if (error) throw new Error(`Profile creation failed: ${error.message}`);
      setProfile(data as Profile);
      return data as Profile;
    },
    [],
  );

  useEffect(() => {
    let active = true;
    if (!hasSupabaseConfig) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => active && setLoading(false));
      } else {
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        setTimeout(() => {
          if (active) fetchProfile(nextSession.user.id);
        }, 0);
      } else {
        setProfile(null);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user,
      profile,
      loading,
      loadingProfile,
      hasSupabaseConfig,
      loadProfile: async () => (user ? await fetchProfile(user.id) : null),
      ensureProfile,
      refreshProfile: async () => {
        if (user) await fetchProfile(user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, user, profile, loading, loadingProfile, fetchProfile, ensureProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
