import { useEffect, useState } from "react";
import { useThemeTokens, ThemeProvider } from "./themes/ThemeContext";
import { useAuth } from "./hooks/useAuth";
import { useProgress } from "./hooks/useProgress";
import { useSiteMessages } from "./hooks/useSiteMessages";
import { capturePendingReferral } from "./referral/referral.js";
import { TabNav } from "./components/TabNav";
import { AuthWidget } from "./components/AuthWidget";
import { SiteBanner } from "./components/SiteBanner";
import { GameScreen } from "./components/GameScreen";
import { LeaderboardScreen } from "./components/LeaderboardScreen";
import { UnlocksScreen } from "./components/UnlocksScreen";
import { RulesScreen } from "./components/RulesScreen";
import { StatsScreen } from "./components/StatsScreen";
import { ReferralScreen } from "./components/ReferralScreen";
import { LifelinesScreen } from "./components/LifelinesScreen";
import { FeedbackScreen } from "./components/FeedbackScreen";

// Single source of truth for auth + progress, resolved once here so the
// equipped theme is known before anything inside ThemeProvider renders.
// Everything below reads it via props (GameScreen, UnlocksScreen) or via
// useThemeTokens() (for the actual color/style values).
export default function App() {
  // Captures ?ref=username (if present) into localStorage on first load, so
  // it survives the OTP email round-trip — see src/referral/referral.js and
  // useAuth.js#createProfile, which consumes it at signup time.
  useEffect(() => {
    capturePendingReferral();
  }, []);

  const { user, profile, refreshProfile } = useAuth();
  const userId = user?.id ?? null;
  const {
    selectedDeckConfig,
    unlockedDecks,
    deckProgress,
    equippedTheme,
    unlockedThemeIds,
    recordCorrectCall,
    refreshDeckProgress,
    selectDeck,
    setEquippedTheme,
  } = useProgress(userId);
  const { messages } = useSiteMessages();

  return (
    <ThemeProvider themeId={equippedTheme}>
      <AppShell
        userId={userId}
        profile={profile}
        refreshProfile={refreshProfile}
        selectedDeckConfig={selectedDeckConfig}
        unlockedDecks={unlockedDecks}
        deckProgress={deckProgress}
        equippedTheme={equippedTheme}
        unlockedThemeIds={unlockedThemeIds}
        recordCorrectCall={recordCorrectCall}
        refreshDeckProgress={refreshDeckProgress}
        selectDeck={selectDeck}
        setEquippedTheme={setEquippedTheme}
        messages={messages}
      />
    </ThemeProvider>
  );
}

function AppShell({
  userId,
  profile,
  refreshProfile,
  selectedDeckConfig,
  unlockedDecks,
  deckProgress,
  equippedTheme,
  unlockedThemeIds,
  recordCorrectCall,
  refreshDeckProgress,
  selectDeck,
  setEquippedTheme,
  messages,
}) {
  const C = useThemeTokens();
  const [tab, setTab] = useState("game");

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center px-4 py-8"
      style={{ background: C.bg, color: C.textPrimary, fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <div className="w-full max-w-4xl flex items-center justify-between mb-6">
        <TabNav active={tab} onChange={setTab} />
        <AuthWidget />
      </div>
      <SiteBanner userId={userId} messages={messages} />
      {/* All three screens stay mounted so switching tabs doesn't silently
          discard an in-progress game just for checking the leaderboard. */}
      <div className="w-full flex flex-col items-center" style={{ display: tab === "game" ? "flex" : "none" }}>
        <GameScreen
          userId={userId}
          profile={profile}
          refreshProfile={refreshProfile}
          selectedDeckConfig={selectedDeckConfig}
          unlockedDecks={unlockedDecks}
          deckProgress={deckProgress}
          recordCorrectCall={recordCorrectCall}
          refreshDeckProgress={refreshDeckProgress}
          selectDeck={selectDeck}
          tagline={messages.tagline?.content}
          onViewFullLeaderboard={() => setTab("leaderboard")}
        />
      </div>
      <div className="w-full flex flex-col items-center" style={{ display: tab === "leaderboard" ? "flex" : "none" }}>
        <LeaderboardScreen />
      </div>
      <div className="w-full flex flex-col items-center" style={{ display: tab === "unlocks" ? "flex" : "none" }}>
        <UnlocksScreen
          unlockedThemeIds={unlockedThemeIds}
          equippedTheme={equippedTheme}
          setEquippedTheme={setEquippedTheme}
        />
      </div>
      <div className="w-full flex flex-col items-center" style={{ display: tab === "stats" ? "flex" : "none" }}>
        <StatsScreen userId={userId} />
      </div>
      <div className="w-full flex flex-col items-center" style={{ display: tab === "referrals" ? "flex" : "none" }}>
        <ReferralScreen userId={userId} profile={profile} />
      </div>
      <div className="w-full flex flex-col items-center" style={{ display: tab === "lifelines" ? "flex" : "none" }}>
        <LifelinesScreen
          userId={userId}
          profile={profile}
          refreshProfile={refreshProfile}
          onViewReferrals={() => setTab("referrals")}
        />
      </div>
      <div className="w-full flex flex-col items-center" style={{ display: tab === "rules" ? "flex" : "none" }}>
        <RulesScreen />
      </div>
      <div className="w-full flex flex-col items-center" style={{ display: tab === "feedback" ? "flex" : "none" }}>
        <FeedbackScreen userId={userId} />
      </div>
    </div>
  );
}
