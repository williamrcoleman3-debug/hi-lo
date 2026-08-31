import { useThemeTokens } from "../themes/ThemeContext";

// Signed-in only, same pattern as RemoveAdsBanner -- advertises the
// existing referral reward rather than introducing a second place lifeline
// math happens. Per supabase/schema.sql's finalize_session(): the REFERRER
// earns 10 lifelines once a friend they referred signs up and completes
// their first game (bust or bank, either counts) -- that's what "qualified"
// means (qualified_referral_count). Tapping navigates to the Referrals tab,
// where the player's actual invite link/code lives (ReferralScreen.jsx).
export function ReferralBanner({ onViewReferrals }) {
  const C = useThemeTokens();

  return (
    <div
      className="w-full max-w-4xl rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3 text-sm"
      style={{ border: `1px solid ${C.accent}`, background: C.accentSoft, color: C.textPrimary }}
    >
      <button className="flex-1 text-left" onClick={onViewReferrals}>
        Qualified referrals earn 10 lifelines — invite a friend.
      </button>
    </div>
  );
}
