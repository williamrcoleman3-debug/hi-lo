import { useThemeTokens } from "../themes/ThemeContext";

// Signed-in only -- ads_disabled/remove_ads_banner_dismissed both live on
// profiles. Hidden once purchased (ads_disabled) or once dismissed
// (remove_ads_banner_dismissed) -- but a refund resets BOTH server-side
// (see netlify/functions/app-store-notifications.mjs), which is the only
// thing that ever brings this back after a dismiss.
export function RemoveAdsBanner({ profile, onDismiss, onViewRemoveAds }) {
  const C = useThemeTokens();

  // TEMP DIAGNOSTIC -- tracking down a report that this banner isn't
  // appearing on-device despite ads_disabled/remove_ads_banner_dismissed
  // both being false in the database. Remove once that's resolved.
  console.log("[DIAG-REMOVE-ADS] RemoveAdsBanner render", {
    hasProfile: !!profile,
    ads_disabled: profile?.ads_disabled,
    remove_ads_banner_dismissed: profile?.remove_ads_banner_dismissed,
    willRenderNull: !profile || profile?.ads_disabled || profile?.remove_ads_banner_dismissed,
  });

  if (!profile || profile.ads_disabled || profile.remove_ads_banner_dismissed) return null;

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
