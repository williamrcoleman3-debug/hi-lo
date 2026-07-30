import { useThemeTokens } from "../themes/ThemeContext";

function Section({ title, children }) {
  const C = useThemeTokens();
  return (
    <div
      className="w-full max-w-4xl rounded-lg p-4 text-sm mb-4"
      style={{ border: `1px solid ${C.border}`, background: C.panel, color: C.textSecondary }}
    >
      <h2 className="text-sm font-semibold mb-2" style={{ color: C.textPrimary }}>
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function PrivacyPolicyScreen() {
  const C = useThemeTokens();
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Privacy Policy</h1>
      </div>
      <div className="w-full max-w-4xl mb-6 text-sm" style={{ color: C.textMuted }}>
        <p>Hi-Lo — Halifax Water Co., d/b/a Hi-Lo-Stakes</p>
        <p>Last updated: [DATE]</p>
      </div>

      <Section title="1. Who We Are">
        <p>
          Hi-Lo is operated by Halifax Water Co., doing business as Hi-Lo-Stakes, based in Florida. This policy
          explains what information we collect when you use Hi-Lo, how we use it, and what choices you have.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p>When you create an account or play Hi-Lo, we collect:</p>
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>
            <strong style={{ color: C.textPrimary }}>Account information:</strong> email address, username, and
            avatar selection.
          </li>
          <li>
            <strong style={{ color: C.textPrimary }}>Gameplay data:</strong> game history, win streak, lifelines
            used, referral activity, and leaderboard rank.
          </li>
          <li>
            <strong style={{ color: C.textPrimary }}>Device and usage data:</strong> general technical information
            such as browser type and how you interact with the app, collected automatically.
          </li>
          <li>
            <strong style={{ color: C.textPrimary }}>Contest-related information:</strong> if you qualify as a
            contest winner, we collect additional information necessary to verify eligibility and process a prize
            payout, as described in the Contest Rules.
          </li>
        </ul>
        <p>
          We do not collect payment card information, since Hi-Lo has no purchases of any kind — tokens cannot be
          bought with real money under any circumstance.
        </p>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use the information above to:</p>
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>Operate the game and track your progress, streaks, and lifelines.</li>
          <li>Determine contest eligibility and process a prize if you win.</li>
          <li>
            Send account-related and contest-related emails (for example, a notification if you qualify for prize
            review).
          </li>
          <li>Maintain the fairness and security of the game, including detecting unusual account activity.</li>
          <li>Improve the app based on how it's used.</li>
        </ul>
      </Section>

      <Section title="4. Third-Party Services">
        <p>
          We use third-party service providers to operate Hi-Lo, including hosting, database, and email-delivery
          providers. These providers process data on our behalf and are not permitted to use it for their own
          purposes. We do not sell your personal information to anyone.
        </p>
      </Section>

      <Section title="5. Children's Privacy">
        <p>
          Hi-Lo is restricted to users 18 years of age or older, consistent with the Contest Rules. We do not
          knowingly collect information from anyone under 18.
        </p>
      </Section>

      <Section title="6. Your Choices and Rights">
        <p>
          You can request access to, correction of, or deletion of your account information by contacting us at{" "}
          <a href="mailto:help@hi-lo-game.com" style={{ color: C.accent }}>
            help@hi-lo-game.com
          </a>
          . Deleting your account may affect your eligibility for the contest if a request is made before a win is
          verified.
        </p>
      </Section>

      <Section title="7. Data Security">
        <p>
          We use reasonable technical safeguards to protect your information, including server-side security
          measures already documented in Hi-Lo's architecture. No system is perfectly secure, and we can't guarantee
          absolute security.
        </p>
      </Section>

      <Section title="8. Changes to This Policy">
        <p>
          We may update this policy from time to time. Material changes will be reflected by an updated "Last
          updated" date at the top of this page.
        </p>
      </Section>

      <Section title="9. Contact Us">
        <p>
          Questions about this policy can be sent to{" "}
          <a href="mailto:help@hi-lo-game.com" style={{ color: C.accent }}>
            help@hi-lo-game.com
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
