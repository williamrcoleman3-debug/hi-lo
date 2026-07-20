import { useState } from "react";
import { C } from "./theme";
import { TabNav } from "./components/TabNav";
import { AuthWidget } from "./components/AuthWidget";
import { GameScreen } from "./components/GameScreen";
import { LeaderboardScreen } from "./components/LeaderboardScreen";

export default function App() {
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
      {/* Both screens stay mounted so switching tabs doesn't silently
          discard an in-progress run just for checking the leaderboard. */}
      <div className="w-full flex flex-col items-center" style={{ display: tab === "game" ? "flex" : "none" }}>
        <GameScreen />
      </div>
      <div className="w-full flex flex-col items-center" style={{ display: tab === "leaderboard" ? "flex" : "none" }}>
        <LeaderboardScreen />
      </div>
    </div>
  );
}
