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
        Draft — pending attorney review. Nothing on this page is final legal contest terms; it covers the
        fraud-enforcement policy only.
      </div>

      <div
        className="w-full max-w-4xl rounded-xl p-4 text-sm"
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
    </div>
  );
}
