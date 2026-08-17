import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

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
// never gets a chance to run, and the login silently goes nowhere. This
// tells the two cases apart so the auth case can be handled below.
//
// supabase-js is on its default flowType ("implicit" -- see
// src/supabase/client.js, which doesn't override it), so a magic-link
// redirect lands as hash-fragment tokens (#access_token=...&type=
// magiclink, or #error=... for an expired/invalid link). code=/token_hash=
// query params are also checked in case that ever changes (PKCE-style
// flows use those instead). None of these ever appear on a referral link
// (?ref=username, a plain query string with no hash) since emailRedirectTo
// is fixed to window.location.origin with no ref param -- so this only
// ever matches an actual Supabase redirect, never a referral tap.
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
// Also handles the auth-callback case (see isAuthCallbackUrl above): rather
// than re-implementing Supabase's token parsing here, hand the URL to the
// WKWebView's own navigation so supabase-js's built-in session detection
// does the real work on page load, exactly like it already does on the
// website.
export function initReferralDeepLinkCapture() {
  if (!Capacitor.isNativePlatform()) return;
  App.addListener("appUrlOpen", ({ url }) => {
    if (isAuthCallbackUrl(url)) {
      window.location.href = url;
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
