import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";

const DISMISS_KEY = "hilo:referralBannerDismissed";

// Signed-in only, same pattern as RemoveAdsBanner -- advertises the
// existing referral reward rather than introducing a second place lifeline
// math happens. Per supabase/schema.sql's finalize_session(): the REFERRER
// earns 10 lifelines once a friend they referred signs up and completes
// their first game (bust or bank, either counts) -- that's what "qualified"
// means (qualified_referral_count). Tapping the text navigates to the
// Referrals tab, where the player's actual invite link/code lives
// (ReferralScreen.jsx).
//
// Dismiss is a plain localStorage flag, not a server-persisted column like
// RemoveAdsBanner's remove_ads_banner_dismissed -- this is a one-time
// nudge toward a feature the player can always find again under Referrals,
// not a purchase upsell that needs to reappear after a refund. No schema
// change needed; a device-local dismiss is enough.
export function ReferralBanner({ onViewReferrals }) {
  const C = useThemeTokens();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
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
