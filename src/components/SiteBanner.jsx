import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { isDismissed, dismiss } from "../siteMessages/siteMessages.js";

// Signed-in only -- the signed-out equivalent is SignedOutTutorialOverlay
// now (a full-screen overlay, not a small inline banner), since a
// first-time visitor needs the contest/mechanics explainer to be
// impossible to miss, not blended into the page layout.
export function SiteBanner({ messages }) {
  const C = useThemeTokens();
  const slot = "banner_signed_in";
  const message = messages[slot];
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  if (!message?.content || dismissedThisSession || isDismissed(slot, message.updatedAt)) return null;

  return (
    <div
      className="w-full max-w-4xl rounded-xl px-4 py-3 mb-4 flex items-start justify-between gap-3 text-sm"
      style={{ border: `1px solid ${C.gold}`, background: C.goldSoft, color: C.textPrimary }}
    >
      <span className="flex-1">{message.content}</span>
      <button
        onClick={() => {
          dismiss(slot, message.updatedAt);
          setDismissedThisSession(true);
        }}
        style={{ color: C.textMuted }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
