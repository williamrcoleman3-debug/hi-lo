import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../supabase/client.js";
import { consumePendingReferral } from "../referral/referral.js";

const PROFILE_COLUMNS =
  "id, username, avatar, current_streak, longest_streak, last_banked_date, lifeline_balance, spendable_tokens, referred_signups_count, qualified_referral_count";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  // True once the initial supabase.auth.getSession() call has actually
  // resolved -- distinct from `loading` (which tracks the profile fetch and
  // goes false almost immediately for a not-yet-known session). Without
  // this, a visitor who IS signed in would see the signed-out tutorial
  // overlay flash on screen and then disappear the moment the real session
  // resolves, since `userId` is null until then. Consumers that must not
  // show signed-out-only UI during that brief unknown window (see
  // SignedOutTutorialOverlay) should gate on this, not just on `!userId`.
  const [sessionChecked, setSessionChecked] = useState(!isSupabaseConfigured);

  const fetchProfile = useCallback((userId) => {
    return supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
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
    fetchProfile(userId).then(({ data }) => {
      setProfile(data);
      setLoading(false);
    });
  }, [session?.user?.id, fetchProfile]);

  // Server-side state (streak, lifeline balance, etc.) can change without a
  // local action driving it through `session` — e.g. right after a Bank
  // event updates profiles server-side. Call this to pull the latest
  // without a full session round-trip.
  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const { data } = await fetchProfile(userId);
    setProfile(data);
  }, [session?.user?.id, fetchProfile]);

  const sendCode = useCallback(
    (email) =>
      supabase.auth.signInWithOtp({
        email,
        // Without this, Supabase falls back to its dashboard "Site URL"
        // setting for the magic-link redirect — which may not match
        // wherever this build is actually running (localhost in dev,
        // the deployed domain in prod). Always redirect to here instead.
        options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
      }),
    []
  );

  const verifyCode = useCallback(
    (email, token) => supabase.auth.verifyOtp({ email, token, type: "email" }),
    []
  );

  const createProfile = useCallback(
    async (username, avatar) => {
      const userId = session?.user?.id;
      const { data, error } = await supabase
        .from("profiles")
        .insert({ id: userId, username, avatar })
        .select(PROFILE_COLUMNS)
        .single();
      if (!error) {
        setProfile(data);
        // Best-effort — a failed/absent referral attribution shouldn't
        // block signup. Attempted at most once per signup regardless.
        const pendingReferrer = consumePendingReferral();
        if (pendingReferrer) {
          try {
            await supabase.rpc("attribute_referral", { p_referrer_username: pendingReferrer });
          } catch (err) {
            console.error("attribute_referral failed:", err.message);
          }
        }
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

  // Read-only availability hint for the username field -- UX-only, never
  // the actual gate. The real enforcement is the case-insensitive unique
  // index on profiles.username; createProfile/updateUsername below always
  // re-check via that index regardless of what this returns, so a stale or
  // raced result here can never let a duplicate through.
  const checkUsernameAvailable = useCallback(async (username) => {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    return !data;
  }, []);

  // Direct client update, same pattern as equipped_theme -- covered by the
  // existing "users can update their own profile" RLS policy, no RPC
  // needed. The unique index is still the real gate here too.
  const updateUsername = useCallback(
    async (username) => {
      const userId = session?.user?.id;
      const { data, error } = await supabase
        .from("profiles")
        .update({ username })
        .eq("id", userId)
        .select(PROFILE_COLUMNS)
        .single();
      if (!error) {
        setProfile(data);
        return { data, error: null };
      }
      if (error.code === "23505") {
        return { data: null, error: { message: "That username is taken — try another." } };
      }
      return { data: null, error };
    },
    [session?.user?.id]
  );

  const updateAvatar = useCallback(
    async (avatar) => {
      const userId = session?.user?.id;
      const { data, error } = await supabase
        .from("profiles")
        .update({ avatar })
        .eq("id", userId)
        .select(PROFILE_COLUMNS)
        .single();
      if (!error) setProfile(data);
      return { data, error };
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
    sessionChecked,
    sendCode,
    verifyCode,
    createProfile,
    checkUsernameAvailable,
    updateUsername,
    updateAvatar,
    signOut,
    refreshProfile,
  };
}
