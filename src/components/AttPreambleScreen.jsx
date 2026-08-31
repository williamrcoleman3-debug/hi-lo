import { useThemeTokens } from "../themes/ThemeContext";

// Shown once, immediately before Apple's own ATT system dialog fires --
// see App.jsx's userId effect, which only ever sets this up when
// shouldShowAttPreamble() (src/ads/attPrompt.js) has already confirmed
// getStatus() is "notDetermined", i.e. this account has never been asked.
// One neutral "Continue" button, deliberately not styled or worded as an
// Allow/Don't Allow choice -- the actual tracking decision happens in
// Apple's own dialog immediately after this, never here. Tapping
// Continue is what calls requestAttPermission(); this screen itself
// makes no decision and gates nothing -- declining the real dialog that
// follows leads to the exact same app and the exact same features, just
// non-personalized ads (see admob.js's getAttStatus/npa handling).
//
// Rendered with a higher z-index than AuthWidget's own profile-setup
// modal (z-[60]) -- both can become eligible at the same instant right
// after a brand-new signup (userId turns truthy before a profile exists),
// so this needs to layer on top and get its one tap out of the way first,
// not fight the other modal for which one's visible.
export function AttPreambleScreen({ onContinue }) {
  const C = useThemeTokens();

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" style={{ background: "rgba(11,14,20,0.94)" }}>
      <div
        className="w-full max-w-sm rounded-lg p-6 flex flex-col gap-4"
        style={{ background: C.panel, border: `1px solid ${C.border}` }}
      >
        <p className="text-sm" style={{ color: C.textPrimary }}>
          Hi-Lo shows ads to keep the game free to play. Allowing tracking helps us show ads that are more relevant
          to you.
        </p>
        <button
          onClick={onContinue}
          className="w-full rounded-lg font-semibold py-3 transition-transform active:scale-95"
          style={{ background: C.accent, color: C.cardInk }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
