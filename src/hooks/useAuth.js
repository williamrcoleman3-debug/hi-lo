import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../supabase/client.js";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [session?.user?.id]);

  const sendCode = useCallback(
    (email) => supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }),
    []
  );

  const verifyCode = useCallback(
    (email, token) => supabase.auth.verifyOtp({ email, token, type: "email" }),
    []
  );

  const createProfile = useCallback(
    async (username) => {
      const userId = session?.user?.id;
      const { data, error } = await supabase
        .from("profiles")
        .insert({ id: userId, username })
        .select("id, username")
        .single();
      if (!error) {
        setProfile(data);
        return { data, error: null };
      }
      // 23505 = unique_violation (the case-insensitive index on username) —
      // surface a plain-English message instead of the raw constraint error.
      if (error.code === "23505") {
        return { data: null, error: { message: "That username is taken — try another." } };
      }
      return { data: null, error };
    },
    [session?.user?.id]
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  return {
    isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    loading,
    sendCode,
    verifyCode,
    createProfile,
    signOut,
  };
}
