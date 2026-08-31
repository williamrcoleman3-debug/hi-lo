import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";

const DISMISS_KEY = "hilo:referralBannerDismissedAt";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function isDismissedRecently() {
  try {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (!stored) return false;
    const dismissedAt = Number(stored);
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

// Signed-in only, same pattern as RemoveAdsBanner -- advertises the
// existing referral reward rather than introducing a second place lifeline
// math happens. Per supabase/schema.sql's finalize_session(): the REFERRER
// earns 10 lifelines once a friend they referred signs up and completes
// their first game (bust or bank, either counts) -- that's what "qualified"
// means (qualified_referral_count). Tapping the text navigates to the
// Referrals tab, where the player's actual invite link/code lives
// (ReferralScreen.jsx).
//
// Dismiss is a plain localStorage timestamp, not a server-persisted column
// like RemoveAdsBanner's -- this is a repeating nudge toward a feature the
// player can always find again under Referrals, not a purchase upsell tied
// to refund state, so a device-local 24-hour cooldown is enough; no schema
// change needed.
export function ReferralBanner({ onViewReferrals }) {
  const C = useThemeTokens();
  const [dismissed, setDismissed] = useState(isDismissedRecently);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage can throw (private browsing, disabled storage) -- the
      // dismiss still applies for the rest of this session either way.
    }
    setDismissed(true);
  };

  return (
    <div
      className="w-full max-w-4xl rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3 text-sm"
      style={{ border: `1px solid ${C.accent}`, background: C.accentSoft, color: C.textPrimary }}
    >
      <button className="flex-1 text-left" onClick={onViewReferrals}>
        Qualified referrals earn 10 lifelines — invite a friend.
      </button>
      <button onClick={handleDismiss} style={{ color: C.textMuted }} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
