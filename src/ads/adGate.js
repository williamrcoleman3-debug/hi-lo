const AD_TIMEOUT_MS = 4000;

// Every ad-related network call (the eligibility RPC, showing the actual
// interstitial) is wrapped in this -- if the device is offline, the RPC
// hangs, or the ad creative never loads, this fails open by rejecting
// after AD_TIMEOUT_MS rather than leaving the caller waiting. Gameplay
// must never block on an ad.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("ad gate timed out")), ms)),
  ]);
}

// Runs the single ad-eligibility check before every game start. Replaces
// the old two-mechanism system (a once-per-app-launch pre-game gate plus
// an unbounded 30-hand counter) with one rolling-hour-window rule, paced
// entirely server-side -- see supabase/schema.sql's
// should_show_ad_for_new_game(): an ad shows on the first game of a new
// 60-minute window, and again on every 21st game within that same window.
// No client-side state at all (unlike the old pregameAdResolvedThisLaunch
// flag) -- every call goes to the server, which is the only source of
// truth for the window, so this is safe to call before every single game,
// not just the first one of a launch. Same fail-open contract as before:
// never blocks the next game from dealing.
export async function runGameStartAdGate({ checkAd, showInterstitial }) {
  try {
    const shouldShow = await withTimeout(checkAd(), AD_TIMEOUT_MS);
    if (!shouldShow) return;
    await withTimeout(showInterstitial(), AD_TIMEOUT_MS);
  } catch {
    // Fail open -- offline, RPC error, ad failed to load, or timed out.
  }
}
