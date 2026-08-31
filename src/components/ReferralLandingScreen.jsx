import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { FONT_STACK, FONT_TABULAR } from "../themes/registry.js";

const APP_STORE_URL = "https://apps.apple.com/us/app/hi-lo-same/id6797107646";

// Shown instead of the normal app when a referral link (?ref=username) is
// opened on a mobile browser without the app installed -- the Universal
// Link falls through to plain Safari in that case (see referral.js), and
// without this, the visitor just landed on the website with nothing
// pointing them at the App Store. Displays the code plainly rather than
// trying to carry it across the App Store detour automatically (an
// earlier version of this screen did that via the clipboard, but that
// meant every new signup silently read the clipboard and could trigger
// iOS's "Pasted from" banner even for non-referred installs -- reverted
// in favor of the visitor just typing the code in themselves, same as the
// existing manual invite-code field in AuthWidget already supported).
//
// The tap-to-copy button below is unrelated to that reverted feature --
// this only ever writes the plain code (no HILO-REF: prefix) on a direct
// tap of this button, nothing automatic on page load, so it doesn't carry
// any of the gesture-timing or "Pasted from" issues that came from reading
// the clipboard silently on the app's own first launch.
export function ReferralLandingScreen({ username }) {
  const C = useThemeTokens();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(username);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write can fail (permissions, non-secure context) -- the
      // code is still right there to copy by hand either way.
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 text-center"
      style={{ background: C.bg, color: C.textPrimary, fontFamily: FONT_STACK }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-4">
        <span className="text-4xl" aria-hidden="true">
          🃏
        </span>
        <h1 className="text-2xl font-bold tracking-tight">You've been invited to Hi-Lo</h1>
        <p className="text-sm" style={{ color: C.textSecondary }}>
          {username} plays Higher · Lower · Same — get the app to join them.
        </p>

        <div className="w-full flex flex-col gap-1">
          <span className="text-xs" style={{ color: C.textMuted }}>
            Your referral code
          </span>
          <button
            onClick={handleCopyCode}
            className="w-full rounded-lg px-3 py-2 text-lg font-semibold transition-transform active:scale-95"
            style={{ border: `1px solid ${C.border}`, color: C.accent, ...FONT_TABULAR }}
          >
            {copied ? "Copied!" : username}
          </button>
          <span className="text-xs" style={{ color: C.textMuted }}>
            Tap to copy — enter it when you sign up in the app.
          </span>
        </div>

        <a
          href={APP_STORE_URL}
          className="block no-underline w-full rounded-lg font-semibold py-3 mt-2 transition-transform active:scale-95"
          style={{ background: C.accent, color: C.cardInk }}
        >
          Continue to the App Store
        </a>
      </div>
    </div>
  );
}
