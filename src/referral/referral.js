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
export function initReferralDeepLinkCapture() {
  if (!Capacitor.isNativePlatform()) return;
  App.addListener("appUrlOpen", ({ url }) => {
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
