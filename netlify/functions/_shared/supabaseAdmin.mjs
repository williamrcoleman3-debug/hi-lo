import { createClient } from "@supabase/supabase-js";

// Service-role client -- bypasses RLS entirely, which is required here:
// there's no signed-in browser session in either of these functions
// (verify-iap-receipt only has a bearer JWT to identify the caller with,
// app-store-notifications has no user context at all, it's Apple calling
// directly). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are Netlify
// environment variables -- unlike Supabase's own Edge Functions, Netlify
// Functions don't get these injected automatically, so both must be set
// under Site configuration -> Environment variables.
export function getSupabaseAdmin() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
}

// Identifies the calling user from a bearer JWT (the client's own Supabase
// session token, passed in the Authorization header) -- getUser() validates
// the token against Supabase Auth regardless of which key the client was
// constructed with, so it's safe to reuse the service-role admin client
// here rather than standing up a second client just for this check.
export async function getUserFromAuthHeader(authHeader) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
