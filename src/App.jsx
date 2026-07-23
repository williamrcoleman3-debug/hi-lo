import { lazy, Suspense, useEffect, useState } from "react";
import { useThemeTokens, ThemeProvider } from "./themes/ThemeContext";
import { useAuth } from "./hooks/useAuth";
import { useProgress } from "./hooks/useProgress";
import { useSiteMessages } from "./hooks/useSiteMessages";
import { capturePendingReferral } from "./referral/referral.js";
import { TabNav } from "./components/TabNav";
import { AuthWidget } from "./components/AuthWidget";
import { SiteBanner } from "./components/SiteBanner";
import { SignedOutTutorialOverlay } from "./components/SignedOutTutorialOverlay";
import { GameScreen } from "./components/GameScreen";

// Every tab besides Game is code-split -- its chunk is only fetched the
// first time a visitor actually opens that tab, not bundled into the
// initial load. Each named export is wrapped in a default-export shim
// since these modules only export named components, not defaults.
const LeaderboardScreen = lazy(() =>
  import("./components/LeaderboardScreen").then((m) => ({ default: m.LeaderboardScreen }))
);
const UnlocksScreen = lazy(() => import("./components/UnlocksScreen").then((m) => ({ default: m.UnlocksScreen })));
const StatsScreen = lazy(() => import("./components/StatsScreen").then((m) => ({ default: m.StatsScreen })));
const ReferralScreen = lazy(() => import("./components/ReferralScreen").then((m) => ({ default: m.ReferralScreen })));
const LifelinesScreen = lazy(() =>
  import("./components/LifelinesScreen").then((m) => ({ default: m.LifelinesScreen }))
);
const RulesScreen = lazy(() => import("./components/RulesScreen").then((m) => ({ default: m.RulesScreen })));
const FeedbackScreen = lazy(() => import("./components/FeedbackScreen").then((m) => ({ default: m.FeedbackScreen })));

function TabLoadingFallback() {
  const C = useThemeTokens();
  return (
    <div className="w-full flex items-center justify-center py-16 text-sm" style={{ color: C.textMuted }}>
      Loading…
    </div>
  );
}

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

  const { user, profile, refreshProfile, sessionChecked, checkUsernameAvailable, updateUsername, updateAvatar } = useAuth();
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
        sessionChecked={sessionChecked}
        checkUsernameAvailable={checkUsernameAvailable}
        updateUsername={updateUsername}
        updateAvatar={updateAvatar}
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
  sessionChecked,
  checkUsernameAvailable,
  updateUsername,
  updateAvatar,
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
  // Which tabs have ever been opened -- a lazy tab's chunk only fetches
  // (and the tab only mounts) the first time it's added here. Once added,
  // it's never removed, so switching away and back stays instant and
  // keeps whatever in-progress state that screen had, exactly like before
  // this change (see the comment below on the always-mounted screens).
  const [openedTabs, setOpenedTabs] = useState(() => new Set(["game"]));

  const goToTab = (nextTab) => {
    setTab(nextTab);
    setOpenedTabs((prev) => (prev.has(nextTab) ? prev : new Set(prev).add(nextTab)));
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center px-4 py-8"
      style={{ background: C.bg, color: C.textPrimary, fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <div className="w-full max-w-4xl flex items-center justify-between mb-6">
        <TabNav active={tab} onChange={goToTab} />
        <AuthWidget />
      </div>
      {userId ? (
        <SiteBanner messages={messages} />
      ) : (
        sessionChecked && <SignedOutTutorialOverlay messages={messages} />
      )}
      {/* Game stays eager (it's the landing experience for every visitor).
          Every other tab below only mounts once opened (see openedTabs
          above) and then stays mounted/hidden via display:none from then
          on, same "don't lose an in-progress game/state just for checking
          another tab" behavior as before -- the only change is WHEN each
          one first mounts, not whether it stays mounted after. */}
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
          onViewFullLeaderboard={() => goToTab("leaderboard")}
        />
      </div>
      <Suspense fallback={<TabLoadingFallback />}>
        {openedTabs.has("leaderboard") && (
          <div className="w-full flex flex-col items-center" style={{ display: tab === "leaderboard" ? "flex" : "none" }}>
            <LeaderboardScreen />
          </div>
        )}
        {openedTabs.has("unlocks") && (
          <div className="w-full flex flex-col items-center" style={{ display: tab === "unlocks" ? "flex" : "none" }}>
            <UnlocksScreen
              profile={profile}
              checkUsernameAvailable={checkUsernameAvailable}
              updateUsername={updateUsername}
              updateAvatar={updateAvatar}
              unlockedThemeIds={unlockedThemeIds}
              equippedTheme={equippedTheme}
              setEquippedTheme={setEquippedTheme}
            />
          </div>
        )}
        {openedTabs.has("stats") && (
          <div className="w-full flex flex-col items-center" style={{ display: tab === "stats" ? "flex" : "none" }}>
            <StatsScreen userId={userId} />
          </div>
        )}
        {openedTabs.has("referrals") && (
          <div className="w-full flex flex-col items-center" style={{ display: tab === "referrals" ? "flex" : "none" }}>
            <ReferralScreen userId={userId} profile={profile} />
          </div>
        )}
        {openedTabs.has("lifelines") && (
          <div className="w-full flex flex-col items-center" style={{ display: tab === "lifelines" ? "flex" : "none" }}>
            <LifelinesScreen
              userId={userId}
              profile={profile}
              refreshProfile={refreshProfile}
              onViewReferrals={() => goToTab("referrals")}
            />
          </div>
        )}
        {openedTabs.has("rules") && (
          <div className="w-full flex flex-col items-center" style={{ display: tab === "rules" ? "flex" : "none" }}>
            <RulesScreen />
          </div>
        )}
        {openedTabs.has("feedback") && (
          <div className="w-full flex flex-col items-center" style={{ display: tab === "feedback" ? "flex" : "none" }}>
            <FeedbackScreen userId={userId} />
          </div>
        )}
      </Suspense>
    </div>
  );
}
