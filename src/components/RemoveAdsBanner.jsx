import { useThemeTokens } from "../themes/ThemeContext";

const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Signed-in only -- ads_disabled/remove_ads_banner_dismissed_at both live
// on profiles. ads_disabled (purchased, and not since refunded)
// permanently and unconditionally suppresses this, independent of the
// dismiss timestamp -- checked first, short-circuits before the cooldown
// math even runs. remove_ads_banner_dismissed_at is a cooldown, not a
// permanent dismiss: null (never dismissed) or more than 24 hours old
// both mean "eligible to show again." A refund resets BOTH ads_disabled
// and remove_ads_banner_dismissed_at server-side (see
// netlify/functions/app-store-notifications.mjs) so a refund doesn't
// have to wait out whatever's left of a stale pre-refund cooldown.
export function RemoveAdsBanner({ profile, onDismiss, onViewRemoveAds }) {
  const C = useThemeTokens();

  if (!profile || profile.ads_disabled) return null;

  const dismissedAt = profile.remove_ads_banner_dismissed_at;
  if (dismissedAt && Date.now() - new Date(dismissedAt).getTime() < DISMISS_COOLDOWN_MS) return null;

  return (
    <div
      className="w-full max-w-4xl rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3 text-sm"
      style={{ border: `1px solid ${C.accent}`, background: C.accentSoft, color: C.textPrimary }}
    >
      <button className="flex-1 text-left" onClick={onViewRemoveAds}>
        Remove ads for $4.99, one time — tap to learn more.
      </button>
      <button onClick={onDismiss} style={{ color: C.textMuted }} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
