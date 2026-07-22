import { useState } from "react";
import { useGame } from "../hooks/useGame";
import { useServerGame } from "../hooks/useServerGame";
import { buildShareText, buildShareUrl, shareResult } from "../share/share";
import { redeemLifeline, LIFELINE_COST_TOKENS } from "../lifelines/lifelines.js";
import { GameScreenView } from "./GameScreenView";

// Dispatches to one of two hooks depending on whether anyone's signed in --
// GameScreenView (pure presentation) doesn't know or care which one backed
// it. Anonymous play never touches the server (useGame, the original local
// engine, unchanged). Signed-in play is fully server-authoritative
// (useServerGame, see supabase/schema.sql's game_sessions/make_call/etc and
// src/session/gameSession.js) -- the client never sees more than the
// current compare card.
export function GameScreen(props) {
  return props.userId ? <SignedInGameScreen {...props} /> : <AnonymousGameScreen {...props} />;
}

function useShareAndRedeem({ profile, refreshProfile, banked, status, startNewGame, resetIsNewPeak, isNewPeak, deckName }) {
  const [shareNotice, setShareNotice] = useState(null);
  const [lifelineNotice, setLifelineNotice] = useState(null);

  const handleStartNewGame = () => {
    resetIsNewPeak?.();
    setShareNotice(null);
    startNewGame();
  };

  const handleRedeemLifeline = async () => {
    const result = await redeemLifeline();
    if (result.success) {
      refreshProfile();
      setLifelineNotice("Lifeline redeemed!");
    } else {
      setLifelineNotice(`Need ${LIFELINE_COST_TOKENS.toLocaleString()} tokens to redeem a lifeline.`);
    }
    setTimeout(() => setLifelineNotice(null), 2500);
  };

  const handleShare = async () => {
    const text = buildShareText({
      status,
      amount: banked,
      deckName,
      dailyStreak: profile?.current_streak ?? 0,
      isNewPeak,
    });
    const url = buildShareUrl(profile?.username);
    const result = await shareResult(text, url);
    if (result === "copied") {
      setShareNotice("Copied to clipboard!");
      setTimeout(() => setShareNotice(null), 2000);
    } else if (result === "unsupported") {
      setShareNotice("Sharing isn't supported in this browser.");
      setTimeout(() => setShareNotice(null), 2500);
    }
  };

  return { shareNotice, lifelineNotice, handleShare, handleRedeemLifeline, handleStartNewGame };
}

function AnonymousGameScreen(props) {
  const { selectedDeckConfig, recordCorrectCall } = props;

  const game = useGame(selectedDeckConfig, {
    onCorrectCall: recordCorrectCall,
    onGameEnd: undefined, // anonymous play never touches the server
    lifelineBalance: 0,
    onUseLifeline: undefined,
  });

  const glue = useShareAndRedeem({
    profile: props.profile,
    refreshProfile: props.refreshProfile,
    banked: game.banked,
    status: game.status,
    startNewGame: game.startNewGame,
    isNewPeak: false,
    deckName: selectedDeckConfig.name,
  });

  return <GameScreenView {...props} {...game} cardsLeft={game.deck.length} {...glue} />;
}

function SignedInGameScreen(props) {
  const { selectedDeckConfig, profile, refreshProfile, refreshDeckProgress } = props;
  const [isNewPeak, setIsNewPeak] = useState(false);

  const game = useServerGame(selectedDeckConfig, {
    lifelineBalance: profile?.lifeline_balance ?? 0,
    onGameEnd: (_deckId, { wasBanked, isNewPeak: newPeak }) => {
      setIsNewPeak(newPeak);
      // A Bank may have just advanced the daily streak / lifeline reward
      // server-side, and best_win_streak/hands_won always just changed --
      // pull both fresh rather than reconstructing them client-side.
      if (wasBanked) refreshProfile();
      refreshDeckProgress();
    },
  });

  const glue = useShareAndRedeem({
    profile,
    refreshProfile,
    banked: game.banked,
    status: game.status,
    startNewGame: game.startNewGame,
    resetIsNewPeak: () => setIsNewPeak(false),
    isNewPeak,
    deckName: selectedDeckConfig.name,
  });

  return <GameScreenView {...props} {...game} {...glue} />;
}
