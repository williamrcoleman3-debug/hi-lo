import { Capacitor } from "@capacitor/core";
import { AppTrackingTransparency } from "capacitor-plugin-app-tracking-transparency";

// Whether the ATT pre-permission screen (src/components/
// AttPreambleScreen.jsx) should show right now -- true only the very
// first time ever on this device, mirroring getStatus()'s own
// "notDetermined" semantics: the OS itself remembers the real answer
// once given, so this can never return true again after Apple's actual
// dialog has been answered once, on its own, with no extra flag needed
// here. Read-only -- never prompts, never mutates anything. Called once,
// right after a session is first established -- see src/App.jsx's userId
// effect, which covers every sign-in path (OTP code, password, magic-
// link/PKCE instant sign-in) plus a returning already-signed-in user's
// app launch, since they all funnel through the same shared `user` state.
export async function shouldShowAttPreamble() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { status } = await AppTrackingTransparency.getStatus();
    return status === "notDetermined";
  } catch {
    return false;
  }
}

// Actually triggers Apple's own native ATT system dialog -- only ever
// called from AttPreambleScreen's "Continue" tap (App.jsx), never
// automatically and never from the ad-display path (see getAttStatus
// below) -- that used to be where this fired, but that meant the prompt
// was delayed however long it took a player to reach their first ad,
// which after the pre-game ad's own 10-completed-games threshold was
// added meant an App Store reviewer could easily never see it at all.
// Declining is a permanent, legitimate choice: ads fall back to a
// non-personalized request (see admob.js's getAttStatus/npa handling) --
// this never blocks the app or gameplay either way.
export async function requestAttPermission() {
  if (!Capacitor.isNativePlatform()) return "authorized";
  try {
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
