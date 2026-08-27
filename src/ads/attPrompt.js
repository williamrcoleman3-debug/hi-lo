import { Capacitor } from "@capacitor/core";
import { AppTrackingTransparency } from "capacitor-plugin-app-tracking-transparency";

// Requests the iOS App Tracking Transparency permission at most once ever
// per device (the OS itself remembers the answer -- getStatus() only ever
// returns "notDetermined" before the very first prompt). Called once, right
// after a session is first established -- see src/App.jsx's userId effect,
// which covers every sign-in path (OTP code, password, magic-link/PKCE
// instant sign-in) plus a returning already-signed-in user's app launch,
// since they all funnel through the same shared `user` state. Deliberately
// NOT called from the ad-display path (src/ads/admob.js, see getAttStatus
// below) anymore -- it used to be, but that meant the prompt was delayed
// however long it took a player to reach their first ad, which after the
// pre-game ad's own 10-completed-games threshold was added meant an App
// Store reviewer could easily never see it at all. Declining is a
// permanent, legitimate choice: ads fall back to a non-personalized
// request (see admob.js) -- this never blocks the app or gameplay either
// way. No-ops on web/Android, where there is no ATT prompt at all.
export async function ensureAttPrompted() {
  if (!Capacitor.isNativePlatform()) return "authorized";
  try {
    const { status: current } = await AppTrackingTransparency.getStatus();
    if (current !== "notDetermined") return current;
    const { status } = await AppTrackingTransparency.requestPermission();
    return status;
  } catch {
    return "denied";
  }
}

// Read-only status check -- never prompts, just reports whatever the OS
// already has on file. Used by admob.js to decide AdMob's npa flag without
// the ad-display path ever triggering the permission dialog itself. Can
// legitimately still see "notDetermined" here -- e.g. an ad somehow shown
// before any sign-in has ever happened on this device -- in which case the
// caller's own `!== "authorized"` check already treats that the same as an
// explicit decline (npa: true), never the reverse.
export async function getAttStatus() {
  if (!Capacitor.isNativePlatform()) return "authorized";
  try {
    const { status } = await AppTrackingTransparency.getStatus();
    return status;
  } catch {
    return "denied";
  }
}
