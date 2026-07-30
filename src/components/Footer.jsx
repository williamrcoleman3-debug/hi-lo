import { useThemeTokens } from "../themes/ThemeContext";

export function Footer({ onViewContestRules, onViewPrivacyPolicy }) {
  const C = useThemeTokens();
  const linkStyle = { color: C.textMuted };

  return (
    <footer
      className="w-full max-w-4xl mt-10 pt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs"
      style={{ borderTop: `1px solid ${C.border}` }}
    >
      <button onClick={onViewContestRules} className="underline underline-offset-2" style={linkStyle}>
        Contest Rules
      </button>
      <span style={{ color: C.border }}>·</span>
      <button onClick={onViewPrivacyPolicy} className="underline underline-offset-2" style={linkStyle}>
        Privacy Policy
      </button>
      <span style={{ color: C.border }}>·</span>
      <a href="mailto:help@hi-lo-game.com" className="underline underline-offset-2" style={linkStyle}>
        help@hi-lo-game.com
      </a>
    </footer>
  );
}
