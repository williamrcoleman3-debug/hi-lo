import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../supabase/client.js";
import { consumePendingReferral } from "../referral/referral.js";

const PROFILE_COLUMNS =
  "id, username, avatar, current_streak, longest_streak, last_banked_date, lifeline_balance, spendable_tokens, referred_signups_count, qualified_referral_count, ads_disabled, remove_ads_banner_dismissed";

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

  // Sign Up only -- creates the (unconfirmed) auth account if none exists
  // yet, and sends the confirmation email (which carries both a magic link
  // and the same 6-digit code used everywhere else in this file). See
  // AuthWidget's Sign Up flow: this is followed by a static Instructions
  // screen, not the code-entry step -- completing a session directly from
  // the confirmation-link tap was tried and confirmed unreliable on-device
  // (see src/referral/referral.js), so Sign Up no longer tries to establish
  // a session at all. The account only ever actually signs in later,
  // through Sign In below.
  const signUpWithEmail = useCallback(
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

  // Sign In only -- shouldCreateUser: false means this never silently
  // creates an account for a mistyped or not-yet-registered email; the
  // separate Sign Up entry point is the only path that creates one. GoTrue
  // returns error.code "otp_disabled" for exactly this case (documented in
  // @supabase/auth-js's ErrorCode union) -- rewritten here into a plain
  // message pointing at Sign Up instead of leaking the raw API wording.
  const requestSignInCode = useCallback(async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    if (error?.code === "otp_disabled") {
      return { error: { message: "No account found for that email — try Sign Up instead." } };
    }
    return { error };
  }, []);

  const verifyCode = useCallback(
    (email, token) => supabase.auth.verifyOtp({ email, token, type: "email" }),
    []
  );

  // The other Sign In option, for anyone who's already set a password (see
  // setPassword below). Supabase deliberately returns the same generic
  // "invalid credentials" error whether the password is wrong or the
  // account doesn't exist at all -- that's correct, standard behavior (not
  // a bug to work around), since confirming or denying account existence
  // from a password attempt would leak who has an account.
  const signInWithPassword = useCallback(
    (email, password) => supabase.auth.signInWithPassword({ email, password }),
    []
  );

  // Sets/replaces the signed-in user's password -- used only by the Sign Up
  // flow's profile-setup modal (username + password + invite code, all
  // together). There is no retroactive "set a password" step for accounts
  // that predate this -- those simply keep using one-time-code sign-in
  // until their owner handles them directly outside the app.
  const setPassword = useCallback((password) => supabase.auth.updateUser({ password }), []);

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

  // Direct client update, same pattern as equipped_theme -- this is just a
  // dismiss preference, not server-owned state (unlike ads_disabled, which
  // is column-revoked from direct client writes, see schema.sql). The
  // Remove Ads banner (src/components/RemoveAdsBanner.jsx) reads this to
  // decide whether to render at all.
  const dismissRemoveAdsBanner = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const { data, error } = await supabase
      .from("profiles")
      .update({ remove_ads_banner_dismissed: true })
      .eq("id", userId)
      .select(PROFILE_COLUMNS)
      .single();
    if (!error) setProfile(data);
  }, [session?.user?.id]);

  return {
    isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    loading,
    sessionChecked,
    signUpWithEmail,
    requestSignInCode,
    verifyCode,
    signInWithPassword,
    setPassword,
    createProfile,
    checkUsernameAvailable,
    updateUsername,
    updateAvatar,
    signOut,
    refreshProfile,
    dismissRemoveAdsBanner,
  };
}
