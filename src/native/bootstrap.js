import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

// Synchronous and called before the first render (see main.jsx) -- this same
// index.html/CSS bundle also serves the plain website at hi-lo-game.com, so
// the long-press-callout/text-selection suppression in index.css is scoped
// to this class rather than applied blanket, or copy/paste of e.g. the
// Contest Rules or Privacy Policy text would break for ordinary web
// visitors. window.Capacitor is injected by the native bridge before any of
// our own JS runs, so this check is safe to do synchronously with no flash.
export function markNativeShell() {
  if (Capacitor.isNativePlatform()) {
    document.documentElement.classList.add("capacitor-native");
  }
}

// No-ops entirely in the browser (Capacitor.isNativePlatform() is false for
// the plain website) -- everything here only runs inside the native iOS
// shell. capacitor.config.json sets StatusBar.overlaysWebView: true, so the
// web content draws full-screen behind the translucent status bar (its own
// dark background shows through, rather than a separately-colored native
// strip) -- see index.css for the safe-area padding that keeps actual nav/
// buttons clear of the notch and status bar. launchAutoHide: false means the
// splash stays up covering the WKWebView's network fetch of the live site
// until this fires -- called once from main.jsx right after the first
// render, so it never shows a blank flash before the game UI paints.
export async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // Never let status bar styling failures block the app.
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Never let splash-hide failures leave the app stuck behind the splash.
  }
}
