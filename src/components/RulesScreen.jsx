import { useThemeTokens } from "../themes/ThemeContext";

export function RulesScreen() {
  const C = useThemeTokens();
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          Rules
        </h1>
      </div>

      <div
        className="w-full max-w-4xl rounded-xl px-4 py-3 mb-6 text-xs"
        style={{ border: `1px solid ${C.emberBorder}`, background: "rgba(122,43,40,0.12)", color: C.textSecondary }}
      >
        Draft — pending attorney review. Nothing on this page is final legal contest terms; it covers
        fraud-enforcement, anti-bot, and manual-review policy only.
      </div>

      <div
        className="w-full max-w-4xl rounded-xl p-4 text-sm mb-4"
        style={{ border: `1px solid ${C.border}`, background: C.panel, color: C.textSecondary }}
      >
        <h2 className="text-sm font-semibold mb-2" style={{ color: C.textPrimary }}>
          Referral &amp; contest fraud
        </h2>
        <p>
          Players found creating fake or duplicate accounts or email addresses to generate fraudulent referrals for
          the purpose of farming additional lifelines will be banned from the contest specifically — this affects
          eligibility for the Hands Won in a Row (Single Deck) leaderboard only. It does not restrict the rest of
          your account; you can keep playing normally.
        </p>
      </div>

      <div
        className="w-full max-w-4xl rounded-xl p-4 text-sm mb-4"
        style={{ border: `1px solid ${C.border}`, background: C.panel, color: C.textSecondary }}
      >
        <h2 className="text-sm font-semibold mb-2" style={{ color: C.textPrimary }}>
          Bots &amp; automation
        </h2>
        <p>
          Use of bots, scripts, automated tools, or any non-human-operated software to play the game — including
          tools that only use information legitimately visible during normal play — is strictly prohibited for
          purposes of contest eligibility. This applies regardless of whether such automation violates any technical
          security measure; simulating human play through automated means is prohibited on its own. Any account
          found, in our sole discretion, to have used such automation will be disqualified from the contest and
          ineligible for any prize, regardless of whether a qualifying Win Streak was otherwise achieved.
        </p>
      </div>

      <div
        className="w-full max-w-4xl rounded-xl p-4 text-sm"
        style={{ border: `1px solid ${C.border}`, background: C.panel, color: C.textSecondary }}
      >
        <h2 className="text-sm font-semibold mb-2" style={{ color: C.textPrimary }}>
          Manual review before payout
        </h2>
        <p>
          Any account that achieves a qualifying Win Streak is subject to manual review before any prize is awarded.
          This review may include, at our discretion, analysis of gameplay patterns, timing data, account history,
          and any other information relevant to confirming the win was achieved through legitimate human play
          consistent with these rules. Prize payout may be delayed pending this review. Failure to cooperate with a
          review request, or discovery of a rules violation during review, may result in forfeiture of the prize.
        </p>
      </div>
    </div>
  );
}
