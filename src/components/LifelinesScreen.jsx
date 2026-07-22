import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { redeemLifeline, LIFELINE_COST_TOKENS } from "../lifelines/lifelines.js";

export function LifelinesScreen({ userId, profile, refreshProfile, onViewReferrals }) {
  const C = useThemeTokens();
  const [notice, setNotice] = useState(null);

  const handleRedeem = async () => {
    const result = await redeemLifeline();
    if (result.success) {
      refreshProfile?.();
      setNotice("Lifeline redeemed!");
    } else {
      setNotice(`Need ${LIFELINE_COST_TOKENS.toLocaleString()} tokens to redeem a lifeline.`);
    }
    setTimeout(() => setNotice(null), 2500);
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          Lifelines
        </h1>
        <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
          🛟 Save the Game — when you're about to bust, spend a lifeline to forgive that one wrong call. Your win
          streak just holds (it doesn't reset, but it doesn't climb either), and you keep playing. Up to 2 per game.
        </p>
      </div>

      {!userId ? (
        <div className="w-full max-w-4xl rounded-xl p-6 text-sm text-center" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>
          Sign in to track your lifelines.
        </div>
      ) : (
        <>
          <div className="w-full max-w-4xl rounded-xl p-4 mb-6 text-center" style={{ border: `1px solid ${C.gold}`, background: C.goldSoft }}>
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: C.textMuted }}>
              Your balance
            </div>
            <div className="text-3xl font-semibold" style={{ color: C.gold }}>
              {(profile?.lifeline_balance ?? 0).toLocaleString()}
            </div>
          </div>

          <div className="w-full max-w-4xl flex flex-col gap-3">
            <div className="rounded-xl p-4" style={{ border: `1px solid ${C.border}` }}>
              <div className="text-sm font-semibold mb-1" style={{ color: C.textPrimary }}>
                New account bonus
              </div>
              <p className="text-xs" style={{ color: C.textMuted }}>
                Every account starts with 1 free lifeline, automatically.
              </p>
            </div>

            <div className="rounded-xl p-4" style={{ border: `1px solid ${C.border}` }}>
              <div className="text-sm font-semibold mb-1" style={{ color: C.textPrimary }}>
                Refer a friend — +5
              </div>
              <p className="text-xs mb-2" style={{ color: C.textMuted }}>
                Share your invite link. As soon as a friend signs up with it and plays their first game — win or
                bust, either counts — you get 5 lifelines.
              </p>
              {onViewReferrals && (
                <button onClick={onViewReferrals} className="text-xs underline" style={{ color: C.gold }}>
                  Go to Referrals
                </button>
              )}
            </div>

            <div className="rounded-xl p-4" style={{ border: `1px solid ${C.border}` }}>
              <div className="text-sm font-semibold mb-1" style={{ color: C.textPrimary }}>
                Redeem tokens — +1
              </div>
              <p className="text-xs mb-2" style={{ color: C.textMuted }}>
                Trade {LIFELINE_COST_TOKENS.toLocaleString()} spendable tokens (earned by banking) for 1 lifeline.
                You have {(profile?.spendable_tokens ?? 0).toLocaleString()} right now.
              </p>
              <button
                onClick={handleRedeem}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-transform active:scale-95"
                style={{ border: `2px solid ${C.teal}`, color: C.teal, background: "transparent" }}
              >
                Redeem
              </button>
              {notice && (
                <div className="text-xs mt-2" style={{ color: C.textMuted }}>
                  {notice}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
