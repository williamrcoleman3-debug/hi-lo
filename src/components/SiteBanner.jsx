import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { isDismissed, dismiss } from "../siteMessages/siteMessages.js";

export function SiteBanner({ userId, messages }) {
  const C = useThemeTokens();
  const slot = userId ? "banner_signed_in" : "banner_signed_out";
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
