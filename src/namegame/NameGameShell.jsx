import { useEffect, useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { AuthWidget } from "../components/AuthWidget";
import TeammateGame from "./TeammateGame.jsx";

import { PrivacyPolicyScreen } from "../components/PrivacyPolicyScreen";
import { DeleteAccountScreen } from "../components/DeleteAccountScreen";

// Home page while the on/off switch (siteMode.js) is set to The Name Game.
// Hi-Lo's welcome overlay, signed-in banner and tagline are deliberately
// not rendered here -- their code and Supabase rows are untouched, so they
// return as-is when the switch goes back to Hi-Lo. `messages` is accepted
// only so callers don't need to special-case this shell.
// eslint-disable-next-line no-unused-vars
export function NameGameShell({ userId, profile, signOut, messages, authProps = {} }) {
  const C = useThemeTokens();
  const [view, setView] = useState("game"); // game | privacy | delete-account

  useEffect(() => {
    document.title = "The Name Game";
  }, []);

  return (
    <div className="ng-page">
      <div className="ng-top">
        <div className="ng-top-in">
          <button type="button" className="ng-brand" onClick={() => setView("game")} aria-label="The Name Game home">
            <small>NFL teammates</small>
            <span>The Name Game</span>
          </button>
          <AuthWidget {...authProps} showBankingStreak={false} />
        </div>
      </div>

      <main className="ng-main">
        {view === "game" ? (
          <TeammateGame userId={userId} profile={profile} />
        ) : (
          <div className="ng-panel" style={{ background: C.bg, color: C.textPrimary }}>
            <button type="button" className="ng-back" onClick={() => setView("game")}>
              ← Back to The Name Game
            </button>
            {view === "privacy" && <PrivacyPolicyScreen />}
            {view === "delete-account" && <DeleteAccountScreen userId={userId} signOut={signOut} />}
          </div>
        )}
      </main>

      <footer className="ng-foot">
        <button type="button" onClick={() => setView("privacy")}>Privacy Policy</button>
        <button type="button" onClick={() => setView("delete-account")}>Delete Account</button>
        <a href="mailto:help@hi-lo-game.com">help@hi-lo-game.com</a>
      </footer>
    </div>
  );
}
