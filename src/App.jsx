import { useState } from "react";
import { useThemeTokens, ThemeProvider } from "./themes/ThemeContext";
import { useAuth } from "./hooks/useAuth";
import { useProgress } from "./hooks/useProgress";
import { TabNav } from "./components/TabNav";
import { AuthWidget } from "./components/AuthWidget";
import { GameScreen } from "./components/GameScreen";
import { LeaderboardScreen } from "./components/LeaderboardScreen";
import { UnlocksScreen } from "./components/UnlocksScreen";

// Single source of truth for auth + progress, resolved once here so the
// equipped theme is known before anything inside ThemeProvider renders.
// Everything below reads it via props (GameScreen, UnlocksScreen) or via
// useThemeTokens() (for the actual color/style values).
export default function App() {
  const { user, profile, refreshProfile } = useAuth();
  const userId = user?.id ?? null;
  const {
    selectedLevelConfig,
    unlockedLevels,
    levelProgress,
    equippedTheme,
    unlockedThemeIds,
    recordCorrectCall,
    selectLevel,
    setEquippedTheme,
  } = useProgress(userId);

  return (
    <ThemeProvider themeId={equippedTheme}>
      <AppShell
        userId={userId}
        profile={profile}
        refreshProfile={refreshProfile}
        selectedLevelConfig={selectedLevelConfig}
        unlockedLevels={unlockedLevels}
        levelProgress={levelProgress}
        equippedTheme={equippedTheme}
        unlockedThemeIds={unlockedThemeIds}
        recordCorrectCall={recordCorrectCall}
        selectLevel={selectLevel}
        setEquippedTheme={setEquippedTheme}
      />
    </ThemeProvider>
  );
}

function AppShell({
  userId,
  profile,
  refreshProfile,
  selectedLevelConfig,
  unlockedLevels,
  levelProgress,
  equippedTheme,
  unlockedThemeIds,
  recordCorrectCall,
  selectLevel,
  setEquippedTheme,
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
      {/* All three screens stay mounted so switching tabs doesn't silently
          discard an in-progress run just for checking the leaderboard. */}
      <div className="w-full flex flex-col items-center" style={{ display: tab === "game" ? "flex" : "none" }}>
        <GameScreen
          userId={userId}
          profile={profile}
          refreshProfile={refreshProfile}
          selectedLevelConfig={selectedLevelConfig}
          unlockedLevels={unlockedLevels}
          levelProgress={levelProgress}
          recordCorrectCall={recordCorrectCall}
          selectLevel={selectLevel}
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
    </div>
  );
}
