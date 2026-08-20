import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "../supabase/client.js";

const PENDING_REFERRAL_KEY = "hilo:pendingReferral";

// Shared by the web query-string path (capturePendingReferral, below) and
// the native Universal Link path (initReferralDeepLinkCapture) -- both hand
// this a full URL and it pulls ?ref= out the same way.
function parseRefFromUrl(url) {
  try {
    return new URL(url).searchParams.get("ref");
  } catch {
    return null;
  }
}

// Captures ?ref=username from the URL into localStorage (not sessionStorage —
// this needs to survive the OTP email round-trip, which can land back in a
// different tab/session than the one that first opened the link).
export function capturePendingReferral() {
  const ref = parseRefFromUrl(window.location.href);
  if (ref) localStorage.setItem(PENDING_REFERRAL_KEY, ref);
}

// The AASA file matches every hi-lo-game.com URL ("/": "/*"), so a
// Supabase magic-link email -- which also redirects to hi-lo-game.com,
// via emailRedirectTo in useAuth.js's sendCode() -- opens the app through
// this SAME Universal Link mechanism instead of loading in Safari.
// appUrlOpen only ever hands the listener the URL as data; it never
// actually navigates the WKWebView there, so supabase-js's own
// detectSessionInUrl (which normally does the real session exchange when
// a page loads with these params, exactly like it does on the website)
// never gets a chance to run. This tells the two cases apart so the auth
// case can be handled below.
//
// supabase-js is on flowType "pkce" (see src/supabase/client.js), so a
// magic-link redirect lands as a plain ?code=... query param rather than
// #access_token=... hash tokens. That's what makes completeAuthCallback()
// below possible at all: a code string can be exchanged for a session with
// a direct network call (supabase.auth.exchangeCodeForSession), no page
// load required -- unlike hash tokens, which had no equivalent "apply
// these manually" API and needed detectSessionInUrl's page-load hook to
// ever get consumed. Hash tokens (#access_token=.../#error=...) and
// token_hash= are still recognized by isAuthCallbackUrl below, both as a
// defensive fallback and because expired/invalid links surface as
// #error=... even under PKCE. None of these ever appear on a referral
// link (?ref=username, a plain query string with no hash) since
// emailRedirectTo is fixed to window.location.origin with no ref param --
// so this only ever matches an actual Supabase redirect, never a referral
// tap.
export function isAuthCallbackUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  if (hashParams.has("access_token") || hashParams.has("error")) return true;
  return parsed.searchParams.has("code") || parsed.searchParams.has("token_hash");
}

// Fired on the auth-callback branch of appUrlOpen below -- lets a mounted
// component (the Sign Up flow's Instructions screen, in AuthWidget) react
// live to a confirmation-link tap while it's still on screen. Purely a UX
// nicety: nothing in the actual sign-in flow depends on anyone listening
// for this.
export const EMAIL_LINK_CONFIRMED_EVENT = "hilo:email-link-confirmed";

// Registers a listener for Universal Link opens, so a referral link tapped
// while the iOS app is already installed attributes correctly. The app's
// own WKWebView never carries a query string -- capacitor.config.json
// points it at a fixed https://hi-lo-game.com with no ?ref= -- so
// capturePendingReferral() above never has anything to read once inside the
// app; this is what actually captures it there instead. Requires the
// Associated Domains entitlement (ios/App/App/App.entitlements) and the
// apple-app-site-association file (public/.well-known/apple-app-site-
// association) to both be in place, plus the capability enabled on the App
// ID in Xcode/the developer portal. It cannot recover a referral for
// someone who taps the link, gets sent to the App Store, and installs
// fresh -- nothing on iOS carries a value through that detour without a
// third-party attribution SDK -- see setPendingReferral() below for that
// path instead, wired up as the manual "Invite code" field in AuthWidget.
//
// A previous version of this handler tried to complete the Supabase session
// directly here, via `window.location.href = url` on the auth-callback
// branch (see isAuthCallbackUrl above) -- appUrlOpen firing was confirmed
// reliable on a real device, but that approach relied on forcing a page
// navigation so the implicit flow's detectSessionInUrl would pick up the
// hash tokens, and that navigation was not reliable, and this couldn't be
// debugged live (no console access on this remote-build setup).
//
// exchangeCodeForSession() (below) is a different mechanism, not a retry of
// that same approach -- it needs no navigation at all, just the code string,
// so it isn't exposed to whatever made the navigation-based attempt
// unreliable. If it fails for any reason (expired code, the code's
// PKCE verifier missing from local storage -- e.g. a different
// device/browser than the one that requested the email, storage cleared
// between request and tap -- or any other exchange error), this only logs
// and falls through to dispatching EMAIL_LINK_CONFIRMED_EVENT same as
// before: no session gets set, so AuthWidget's existing "I confirmed my
// email" -> code-screen path (which never depended on this listener) is
// still exactly how sign-up finishes. That path is the safety net, not a
// leftover -- keep it working unchanged.
async function completeAuthCallback(url) {
  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("exchangeCodeForSession failed:", error.message);
  }
  // Fires whether the exchange above succeeded, failed, or never ran (a
  // hash-token/error link) -- AuthWidget's Instructions screen only uses
  // this for a cosmetic live-update ("Confirmed -- tap below to continue"),
  // and a session having just been established makes that screen unmount
  // anyway (see AuthWidget's `user && !loading && !profile` branch, which
  // takes over on its own the moment `session` changes).
  window.dispatchEvent(new Event(EMAIL_LINK_CONFIRMED_EVENT));
}

export function initReferralDeepLinkCapture() {
  if (!Capacitor.isNativePlatform()) return;
  App.addListener("appUrlOpen", ({ url }) => {
    if (isAuthCallbackUrl(url)) {
      completeAuthCallback(url);
      return;
    }
    const ref = parseRefFromUrl(url);
    if (ref) localStorage.setItem(PENDING_REFERRAL_KEY, ref);
  });
}

// Reads the pending referral without clearing it -- used to pre-fill the
// manual invite-code field at signup (AuthWidget) so a value already
// captured via the query string or a Universal Link shows up automatically,
// while still leaving the player free to edit or clear it.
export function peekPendingReferral() {
  return localStorage.getItem(PENDING_REFERRAL_KEY);
}

// Lets the manual invite-code field (AuthWidget) set the pending referral
// directly, overriding whatever (if anything) was captured automatically.
// Called right before signup so the field is always the single source of
// truth for what consumePendingReferral() reads next.
export function setPendingReferral(username) {
  const trimmed = username?.trim();
  if (trimmed) localStorage.setItem(PENDING_REFERRAL_KEY, trimmed);
  else localStorage.removeItem(PENDING_REFERRAL_KEY);
}

// Reads and clears the pending referral in one step — attribution is
// attempted at most once per signup, regardless of whether it succeeds.
export function consumePendingReferral() {
  const ref = localStorage.getItem(PENDING_REFERRAL_KEY);
  localStorage.removeItem(PENDING_REFERRAL_KEY);
  return ref;
}
