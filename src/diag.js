// TEMPORARY -- diagnostic instrumentation for the instant-sign-in
// investigation (2026-08-20): whether exchangeCodeForSession() is actually
// establishing a session on-device, or failing silently while the manual
// "I confirmed my email" fallback ends up firing instead. No live console
// access on this remote-build setup, so this both logs to console (for
// anyone with Safari Web Inspector attached) and persists to localStorage,
// read by DiagOverlay.jsx so it's visible directly on screen either way.
// Remove this file, DiagOverlay.jsx, its mount in App.jsx, and every
// diagLog() call site once the root cause is confirmed and fixed.
const DIAG_KEY = "hilo:diagLog";

export function diagLog(msg) {
  const line = `${new Date().toISOString().slice(11, 19)} ${msg}`;
  console.log("[DIAG-INSTANT-LOGIN]", line);
  try {
    const existing = JSON.parse(localStorage.getItem(DIAG_KEY) || "[]");
    existing.push(line);
    localStorage.setItem(DIAG_KEY, JSON.stringify(existing.slice(-30)));
  } catch {
    // localStorage can throw (private mode, quota) -- console.log above is
    // the fallback either way.
  }
}

export function readDiagLog() {
  try {
    return JSON.parse(localStorage.getItem(DIAG_KEY) || "[]");
  } catch {
    return [];
  }
}
