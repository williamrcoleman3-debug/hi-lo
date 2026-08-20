import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// flowType: "pkce" -- see src/referral/referral.js's appUrlOpen handler for
// why this matters specifically for the iOS app: it's what makes the
// confirmation-link tap resolvable via exchangeCodeForSession() (a plain
// network call, no page navigation needed), instead of the old implicit-flow
// hash tokens which relied on a page load to auto-complete and never got one
// in the native WKWebView.
export const supabase = isSupabaseConfigured ? createClient(url, anonKey, { auth: { flowType: "pkce" } }) : null;
