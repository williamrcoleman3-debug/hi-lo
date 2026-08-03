import { Capacitor } from "@capacitor/core";
import { AppTrackingTransparency } from "capacitor-plugin-app-tracking-transparency";

// Requests the iOS App Tracking Transparency permission at most once ever
// per device (the OS itself remembers the answer -- getStatus() only ever
// returns "notDetermined" before the very first prompt). Called from
// src/ads/admob.js right before the first ad request that could be
// personalized. Declining is a permanent, legitimate choice: the caller
// falls back to a non-personalized ad request (npa: true) -- this never
// blocks the app or gameplay either way. No-ops on web/Android, where
// there is no ATT prompt at all.
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
