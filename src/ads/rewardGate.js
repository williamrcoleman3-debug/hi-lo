const GRANT_TIMEOUT_MS = 4000;

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("bonus grant timed out")), ms))]);
}

// Drives the "Watch an ad for 20 more games today" Unlocks action. Only
// ever calls grantBonus() when showRewardedAd() (src/ads/admob.js) reports
// "rewarded" -- its own contract is that this only ever comes from the
// AdMob SDK's actual earn-reward callback, never a plain dismiss, so a
// closed-early or failed-to-load ad can't grant anything here. No
// once-per-day cap of its own: each full watch calls grantBonus() again,
// and the server-side RPC (grant_daily_bonus_games, see schema.sql) is
// itself uncapped per day by design.
//
// The grant RPC is wrapped in its own timeout/catch, separate from
// showRewardedAd's own error handling -- a flaky network on this specific
// call reports "grant-failed" rather than leaving the caller hanging, even
// though the player did watch a real ad.
export async function runRewardedBonusFlow({ showRewardedAd, grantBonus }) {
  const outcome = await showRewardedAd();
  if (outcome !== "rewarded") {
    return { status: outcome, bonusGamesToday: null };
  }

  try {
    const bonusGamesToday = await withTimeout(grantBonus(), GRANT_TIMEOUT_MS);
    return { status: "granted", bonusGamesToday };
  } catch {
    return { status: "grant-failed", bonusGamesToday: null };
  }
}
