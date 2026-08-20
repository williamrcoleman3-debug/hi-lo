import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Permanently deletes the caller's own account. Apple Guideline 5.1.1v --
// there must be an in-app way to fully delete an account, not just sign
// out or deactivate.
//
// Deletion strategy: call the Auth Admin API to delete auth.users, and let
// Postgres's own "on delete cascade" foreign keys (see schema.sql) do the
// rest. Every table in schema.sql that stores per-user data --
// deck_progress, leaderboard_scores, daily_activity, feedback_submissions,
// game_sessions, rate_limit_state, daily_game_starts, iap_transactions --
// references profiles.id with ON DELETE CASCADE, and profiles.id itself
// references auth.users.id the same way, so deleting the auth user cascades
// through all of it automatically in one transaction. That list was
// produced by grepping schema.sql for every "references public.profiles"
// and "references auth.users" -- re-check there if a new user-owned table
// is ever added, since it needs the same ON DELETE CASCADE to be covered
// here without further changes to this function.
//
// Two relationships in schema.sql do NOT cascade, deliberately, so they're
// cleaned up explicitly below, before the admin delete:
//   - contest_review.session_id -> game_sessions.id has no ON DELETE
//     CASCADE (a flagged session's review record shouldn't just vanish on
//     its own). Left as-is, deleting a user's game_sessions would hit this
//     foreign key and fail -- so their contest_review rows are deleted
//     first, only for their own sessions.
//   - profiles.referred_by -> profiles.id has no ON DELETE CASCADE either.
//     If this account referred anyone, their referred_by is nulled out
//     first -- NOT a cascade delete of their account, just removing the
//     now-dangling reference to an account that's about to stop existing.
//     referred_signups_count/qualified_referral_count on other accounts
//     are left untouched -- those are historical counts, not foreign keys,
//     and this deletion doesn't retroactively rewrite anyone else's stats.
//
// auth.users itself, and Supabase's own internal auth-schema bookkeeping
// (sessions, refresh tokens, linked identities), is handled by
// admin.deleteUser() -- deliberately not reimplemented here with raw SQL
// against the `auth` schema, since that's exactly what the Admin API exists
// for.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
  // for every Supabase Edge Function -- unlike Netlify Functions elsewhere
  // in this repo, nothing needs to be configured by hand for these two.
  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  const userId = userData.user.id;

  const { data: sessions, error: sessionsError } = await admin
    .from("game_sessions")
    .select("id")
    .eq("user_id", userId);
  if (sessionsError) {
    console.error("delete-account: failed to list game_sessions", sessionsError);
    return jsonResponse({ error: "failed to prepare deletion" }, 500);
  }

  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length > 0) {
    const { error: reviewError } = await admin.from("contest_review").delete().in("session_id", sessionIds);
    if (reviewError) {
      console.error("delete-account: failed to clear contest_review", reviewError);
      return jsonResponse({ error: "failed to prepare deletion" }, 500);
    }
  }

  const { error: referredByError } = await admin
    .from("profiles")
    .update({ referred_by: null })
    .eq("referred_by", userId);
  if (referredByError) {
    console.error("delete-account: failed to clear referred_by", referredByError);
    return jsonResponse({ error: "failed to prepare deletion" }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("delete-account: auth.admin.deleteUser failed", deleteError);
    return jsonResponse({ error: "failed to delete account" }, 500);
  }

  return jsonResponse({ success: true });
});
