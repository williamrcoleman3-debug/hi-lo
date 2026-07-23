import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { isDismissed, dismiss } from "../siteMessages/siteMessages.js";

const PAGES = [
  {
    title: "🏆 $25,000 Prize Contest",
    body: (C) => (
      <ul className="flex flex-col gap-2 text-sm" style={{ color: C.textSecondary }}>
        <li>
          <strong style={{ color: C.gold }}>$25,000</strong> is up for grabs — awarded to the first player to clear a
          full <strong>51-hand Win Streak</strong> on Single Deck.
        </li>
        <li>
          If nobody clears the full streak by March 31, 2027, the prize doesn't go unclaimed — it goes to whoever
          holds the single highest Win Streak record at that point instead.
        </li>
        <li>You must be signed in for a game to count — anonymous play never records toward the leaderboard.</li>
        <li>No purchase necessary to enter or play.</li>
        <li>Must be 18+ and located in the U.S. (NY and RI excluded).</li>
        <li style={{ color: C.textMuted }}>
          This is the quick version — the full Official Rules are in the Rules tab.
        </li>
      </ul>
    ),
  },
  {
    title: "🃏 How The Game Works",
    body: (C) => (
      <ul className="flex flex-col gap-2 text-sm" style={{ color: C.textSecondary }}>
        <li>Each hand, call Higher, Lower, Same, Red, or Black against the current card.</li>
        <li>Only the current card is ever visible — no seeing ahead, no replaying past hands.</li>
        <li>
          Payouts are priced off a static baseline, not the true live odds — tracking which cards have already been
          dealt can reveal calls that are better than they look.
        </li>
      </ul>
    ),
  },
];

// Signed-out visitors only -- a true full-screen overlay (not a page-layout
// banner), the first thing a fresh visitor sees, impossible to miss. Once
// signed in, this never shows again (see App.jsx -- only mounted when
// !userId), on the assumption a signed-in player already saw this before
// signing up or is otherwise already familiar.
//
// Dismiss-by-version logic is the exact same mechanism the old signed-out
// banner used (isDismissed/dismiss, keyed on the site_messages
// 'banner_signed_out' row's updated_at) -- only how it renders and what it
// contains changed. The actual copy below is hardcoded, not pulled from
// that row's `content` column: this is legal/mechanical fact content (prize
// amount, eligibility, game mechanics), closer in nature to the Rules tab
// than to freeform admin copy. The DB row still drives WHEN this resurfaces
// -- bump its updated_at (e.g. a trivial `update ... set updated_at =
// now()`) after any future wording change here to force it back in front
// of everyone who already dismissed the old version.
export function SignedOutTutorialOverlay({ messages }) {
  const C = useThemeTokens();
  const [page, setPage] = useState(0);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const updatedAt = messages.banner_signed_out?.updatedAt;

  if (dismissedThisSession || isDismissed("banner_signed_out", updatedAt)) return null;

  const handleDismiss = () => {
    dismiss("banner_signed_out", updatedAt);
    setDismissedThisSession(true);
  };

  const isLastPage = page === PAGES.length - 1;
  const current = PAGES[page];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div
        className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: C.panel, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: C.textPrimary }}>
            {current.title}
          </h2>
          <button onClick={handleDismiss} style={{ color: C.textMuted }} aria-label="Close">
            ✕
          </button>
        </div>

        {current.body(C)}

        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-1.5">
            {PAGES.map((_, i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: i === page ? C.gold : C.border }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {page > 0 && (
              <button
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold"
                style={{ border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }}
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLastPage ? handleDismiss() : setPage((p) => p + 1))}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold"
              style={{ background: C.gold, color: "#14161f" }}
            >
              {isLastPage ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
