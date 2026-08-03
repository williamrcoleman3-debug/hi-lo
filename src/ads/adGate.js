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

// True once this app process has already resolved the pre-game ad check
// (shown or skipped, doesn't matter) -- only reset by a fresh app launch,
// never by playing another game in the same session.
let pregameAdResolvedThisLaunch = false;

export function resetPregameAdStateForTesting() {
  pregameAdResolvedThisLaunch = false;
}

// Runs the pre-game ad check + display exactly once per app launch --
// safe to call before every game start; a no-op after the first
// resolution, whether that resolution was a shown ad, a server "not yet"
// (still in the 60-minute cooldown, or ads_disabled), or a failure.
// Never throws and never blocks gameplay: any error or timeout at any
// step fails open (resolves having shown nothing).
export async function runPregameAdGate({ checkPregameAd, showInterstitial }) {
  if (pregameAdResolvedThisLaunch) return;
  pregameAdResolvedThisLaunch = true;
  try {
    const shouldShow = await withTimeout(checkPregameAd(), AD_TIMEOUT_MS);
    if (!shouldShow) return;
    await withTimeout(showInterstitial(), AD_TIMEOUT_MS);
  } catch {
    // Fail open -- offline, RPC error, ad failed to load, or timed out.
  }
}

// Runs after every resolved hand (no once-per-launch limit, unlike the
// pre-game gate above -- the server's 30-hand counter is what actually
// paces this). Same fail-open contract: never blocks the next hand from
// starting.
export async function runHandAdGate({ recordHandForAdGate, showInterstitial }) {
  try {
    const shouldShow = await withTimeout(recordHandForAdGate(), AD_TIMEOUT_MS);
    if (!shouldShow) return;
    await withTimeout(showInterstitial(), AD_TIMEOUT_MS);
  } catch {
    // Fail open.
  }
}
