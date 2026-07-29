import { useThemeTokens } from "../themes/ThemeContext";

function Section({ title, children }) {
  const C = useThemeTokens();
  return (
    <div
      className="w-full max-w-4xl rounded-lg p-4 text-sm mb-4"
      style={{ border: `1px solid ${C.border}`, background: C.panel, color: C.textSecondary }}
    >
      {title && (
        <h2 className="text-sm font-semibold mb-2" style={{ color: C.textPrimary }}>
          {title}
        </h2>
      )}
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function ContestRulesScreen() {
  const C = useThemeTokens();
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Official Contest Rules</h1>
      </div>

      <div
        className="w-full max-w-4xl rounded-lg px-4 py-3 mb-6 text-xs"
        style={{ border: `1px solid ${C.caution}`, background: C.cautionSoft, color: C.textSecondary }}
      >
        Draft — pending attorney review. Items in brackets are unresolved and not yet finalized. This page will be
        updated once final legal review is complete.
      </div>

      <Section>
        <p>
          <strong style={{ color: C.textPrimary }}>NO PURCHASE NECESSARY TO ENTER OR WIN.</strong> Tokens have no
          cash value and cannot be purchased with real money, directly or indirectly, under any circumstance.
        </p>
        <p>
          <strong style={{ color: C.textPrimary }}>NATURE OF CONTEST:</strong> This is a contest of skill, not a game
          of chance. Success requires the player to track and recall previously-dealt cards (commonly known as card
          counting) in order to identify hands where the true remaining odds differ from the displayed price, and to
          apply that knowledge consistently across many consecutive hands to build a Win Streak. Card visibility is
          limited to the current hand only — players cannot see upcoming cards, and gameplay cannot be reversed or
          replayed once a hand is dealt — so success depends on the player's own skill and memory, not on any element
          the game withholds or randomizes beyond the natural shuffle of the cards themselves.
        </p>
      </Section>

      <Section title="1. Sponsor">
        <p>
          Halifax Water Co., DBA Hi-Lo-Stakes (fictitious name registration confirmed complete and filed with the
          state). [Add business address once ready to publish.] Referred to as "Hi-Lo-Stakes" throughout these rules.
        </p>
      </Section>

      <Section title="1A. Platform Disclaimer">
        <p>This contest is in no way sponsored, endorsed, administered by, or associated with Apple Inc. or Google LLC.</p>
      </Section>

      <Section title="2. Contest Period">
        <p>
          Begins [TBD — start date, to be confirmed] and ends March 31, 2027 at 11:59 PM ET ("Contest Period"),
          unless claimed earlier per Section 5. If unclaimed by the end of the Contest Period, a new contest period
          may begin thereafter under separate rules.
        </p>
      </Section>

      <Section title="3. Eligibility">
        <p>
          Open to legal residents of the United States who are at least 18 years old at time of entry, EXCEPT
          residents of New York and Rhode Island, who are NOT eligible to participate in or win this contest.
          Employees, contractors, and immediate family members of Hi-Lo-Stakes are not eligible. Void where
          prohibited by law.
        </p>
      </Section>

      <Section title="4. How to Enter">
        <p>
          Create a free account and play the Single Deck game. No purchase, payment, or fee of any kind is required
          to enter, play, or win. Entry is limited to one account per person; use of multiple accounts by one
          individual to gain additional entries or attempts is prohibited (see Section 8).
        </p>
      </Section>

      <Section title="5. How to Win / Prize">
        <p>
          <strong style={{ color: C.textPrimary }}>GRAND PRIZE:</strong> $25,000 USD, awarded via one of two paths:
        </p>
        <p>
          <strong style={{ color: C.textPrimary }}>(a) FULL CLEAR:</strong> The first eligible player to achieve a
          Win Streak of 51 consecutive correct hands on the Single Deck game (i.e. correctly calling every hand
          through a full 52-card shoe) during the Contest Period, subject to the verification process in Section 7.
          Upon a verified win under this path, the Contest Period concludes and no further attempts count toward this
          Grand Prize (a new contest may begin thereafter under separate rules).
        </p>
        <p>
          <strong style={{ color: C.textPrimary }}>(b) HIGHEST STREAK AT DEADLINE:</strong> If no eligible player
          achieves a full clear under path (a) by the end of the Contest Period, the Grand Prize will instead be
          awarded to whichever eligible player(s) achieved the single highest Win Streak on the Single Deck game at
          any point during the Contest Period, subject to the same verification process in Section 7.
        </p>
        <p>
          <strong style={{ color: C.textPrimary }}>TIES:</strong> If multiple eligible players are tied for the
          qualifying win under either path (a) or (b) — including simultaneous full clears, or multiple players tied
          for the highest Win Streak under path (b) — the $25,000 Grand Prize will be divided equally among the tied
          winners, each subject to independent verification under Section 7.
        </p>
        <p>
          Odds of winning depend on skill and the number of eligible entries/attempts during the Contest Period.
          [Optional but recommended: include a good-faith odds disclosure here once the daily play limit is
          finalized, since that number directly affects the real odds calculation.]
        </p>
      </Section>

      <Section title="6. Taxes">
        <p>
          The Grand Prize winner is solely responsible for all applicable federal, state, and local taxes.
          Hi-Lo-Stakes will issue IRS Form 1099-MISC as required by law (required for prizes valued at $600 or
          more). Federal withholding may apply to prizes exceeding $5,000, consistent with IRS requirements at the
          time of payout — Hi-Lo-Stakes should confirm current withholding obligations with a tax professional before
          any payout, as this affects the net amount actually delivered to the winner. Tax treatment and reporting
          obligations apply based on the full $25,000 USD value of the prize regardless of which payment method under
          Section 6A is chosen.
        </p>
      </Section>

      <Section title="6A. Prize Disbursement">
        <p>
          Upon successful verification under Section 7, the winner may choose to receive the $25,000 prize via one
          of the following methods:
        </p>
        <p>
          (a) Cashier's check, mailed to a verified address provided by the winner;
          <br />
          (b) Wire transfer, to a bank account in the winner's verified legal name;
          <br />
          (c) Bitcoin (BTC), sent to a wallet address provided by the winner.
        </p>
        <p>
          If Bitcoin is chosen, the prize remains a fixed $25,000 USD value; the BTC amount transferred will be
          calculated using the BTC/USD exchange rate at the time of actual transfer (not at the time the win was
          achieved or verified), based on the Coinbase BTC/USD rate at the time of transfer. Hi-Lo-Stakes is not
          responsible for errors in a wallet address provided by the winner, for delays or losses caused by network
          conditions outside Hi-Lo-Stakes's control, or for the winner's handling, custody, or security of BTC after
          transfer is completed. Once a valid transfer is sent to the wallet address provided by the winner,
          Hi-Lo-Stakes's payment obligation is satisfied.
        </p>
        <p>
          Hi-Lo-Stakes may require reasonable additional time to arrange payment via any of these methods and may
          require additional identity/tax documentation (e.g. a completed Form W-9) before releasing payment via any
          method.
        </p>
      </Section>

      <Section title="7. Winner Verification and Manual Review">
        <p>
          Any account that achieves a qualifying Win Streak under Section 5 (whether via a full clear or as the
          highest streak at the end of the Contest Period) is subject to manual review before any prize is awarded.
          This review will confirm the winner is at least 18 years of age and may include analysis of gameplay
          patterns, timing data, account history, referral activity, and any other information relevant to
          confirming the win was achieved through legitimate human play consistent with these rules. Prize payout may
          be delayed pending this review.
        </p>
        <p>
          <strong style={{ color: C.textPrimary }}>CLAIM DEADLINE:</strong> A potential winner will be notified using
          the email address associated with their account and must respond to claim the prize within 30 days of the
          date notification is sent. Failure to respond within 30 days is treated the same as a failed review under
          this Section.
        </p>
        <p>
          Failure to cooperate with a review request, failure to respond within the 30-day claim deadline, or
          discovery of a rules violation during review, will result in forfeiture of that player's prize. If
          forfeiture occurs under Section 5(a) prior to the end of the Contest Period, the contest continues and
          remains open to other eligible players; if the Contest Period has already ended, the Grand Prize will
          instead be determined under Section 5(b). If forfeiture occurs under Section 5(b), the Grand Prize passes
          to the player(s) with the next-highest verified Win Streak, subject to the same review process and 30-day
          claim deadline. Winner is responsible for maintaining accurate, monitored contact information;
          Hi-Lo-Stakes is not responsible for failure to receive notification due to an outdated or inaccessible
          email address.
        </p>
      </Section>

      <Section title="8. Prohibited Conduct">
        <p>
          The following will result in disqualification from the contest and forfeiture of any prize, at
          Hi-Lo-Stakes's sole discretion:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>
            Use of bots, scripts, automated tools, or any non-human-operated software to play the game — including
            tools that only use information legitimately visible during normal play. Simulating human play through
            automated means is prohibited on its own, regardless of whether such automation violates any technical
            security measure.
          </li>
          <li>Creating multiple or duplicate accounts to gain additional entries, attempts, or referral rewards.</li>
          <li>
            Creating fake or duplicate accounts/emails to generate fraudulent referrals for the purpose of farming
            additional lifelines or other in-game advantages.
          </li>
          <li>
            Any other attempt to interfere with, manipulate, or gain unfair advantage in the contest outside of
            legitimate gameplay skill.
          </li>
        </ul>
      </Section>

      <Section title="9. General Conditions">
        <p>
          Hi-Lo-Stakes reserves the right to disqualify any entrant found to be tampering with the entry process or
          violating these rules. Hi-Lo-Stakes reserves the right to cancel, suspend, or modify the contest if fraud,
          technical failure, or any factor beyond Hi-Lo-Stakes's control impairs the integrity of the contest, as
          determined by Hi-Lo-Stakes in its sole discretion.
        </p>
        <p>
          By entering, participants agree to be bound by these Official Rules and the decisions of Hi-Lo-Stakes,
          which are final in all matters relating to the contest.
        </p>
      </Section>

      <Section title="10. Governing Law">
        <p>Florida.</p>
      </Section>

      <Section title="11. Publicity / Winner Anonymity">
        <p>
          The winner has the right to remain anonymous. Hi-Lo-Stakes will not use the winner's name, likeness,
          username, or any identifying information for promotional or marketing purposes without the winner's express
          written consent, EXCEPT where disclosure of winner information is required by the law of the winner's state
          of residence (for example, states that require a sponsor to maintain or provide a winner list upon
          request). In such cases, Hi-Lo-Stakes will disclose only what is legally required and no more.
        </p>
      </Section>
    </div>
  );
}
