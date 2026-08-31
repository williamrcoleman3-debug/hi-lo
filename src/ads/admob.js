import { AdMob } from "@capacitor-community/admob";
import { Capacitor } from "@capacitor/core";
import { getAttStatus } from "./attPrompt.js";

// import.meta.env.DEV is Vite's own dev/production build flag -- true for
// `npm run dev`, false for `npm run build` (what release/TestFlight/App
// Store builds ship). This is the "build flag" the spec asks for, reusing
// the toolchain's own signal rather than inventing a separate one.
const IS_DEV_BUILD = import.meta.env.DEV;

const GOOGLE_TEST_INTERSTITIAL_ID = "ca-app-pub-3940256099942544/4411468910";

const GOOGLE_TEST_REWARDED_ID = "ca-app-pub-3940256099942544/1712485313";

const AD_UNITS = {
  pregame: {
    production: "ca-app-pub-8443495216903243/3903394016",
    test: GOOGLE_TEST_INTERSTITIAL_ID,
  },
  thirtyHand: {
    production: "ca-app-pub-8443495216903243/7651067339",
    test: GOOGLE_TEST_INTERSTITIAL_ID,
  },
  bonusGames: {
    production: "ca-app-pub-8443495216903243/1417329884",
    test: GOOGLE_TEST_REWARDED_ID,
  },
};

function adUnitIdFor(placement) {
  return IS_DEV_BUILD ? AD_UNITS[placement].test : AD_UNITS[placement].production;
}

let initialized = false;

async function ensureInitialized() {
  if (initialized) return;
  await AdMob.initialize({ initializeForTesting: IS_DEV_BUILD });
  initialized = true;
}

// Loads and shows one interstitial for the given placement ('pregame' or
// 'thirtyHand'), resolving once the ad is dismissed. Never rejects and
// never hangs waiting for a network that isn't there -- any failure to
// initialize, load, or show just resolves immediately with nothing shown.
// The caller (src/ads/adGate.js) also wraps this in its own timeout as a
// second layer of the same "never block gameplay" guarantee. No-op
// outside the native iOS shell.
export async function showInterstitial(placement) {
  if (!Capacitor.isNativePlatform()) return;

  await ensureInitialized();

  // Reads whatever ATT status the OS already has on file -- see
  // src/App.jsx's userId effect for where the actual permission request
  // now happens, right after sign-in. Never prompts from here: if no
  // sign-in has ever happened on this device, status is "notDetermined",
  // which the check below already treats as non-personalized, same as an
  // explicit decline.
  const attStatus = await getAttStatus();
  const npa = attStatus !== "authorized";

  try {
    await AdMob.prepareInterstitial({ adId: adUnitIdFor(placement), isTesting: IS_DEV_BUILD, npa });
  } catch {
    return;
  }

  await new Promise((resolve) => {
    let dismissedHandle;
    let failedHandle;
    const settle = () => {
      dismissedHandle?.remove();
      failedHandle?.remove();
      resolve();
    };
    AdMob.addListener("interstitialAdDismissed", settle).then((h) => (dismissedHandle = h));
    AdMob.addListener("interstitialAdFailedToShow", settle).then((h) => (failedHandle = h));
    AdMob.showInterstitial().catch(settle);
  });
}

// Loads and shows a rewarded video ad for the "Watch an ad for 20 more
// games today" Unlocks action. Returns "rewarded" only if the player
// actually watched to completion, "closed" if they dismissed it early,
// "failed" if it couldn't be loaded/shown at all, or "unavailable" outside
// the native iOS shell -- never throws. The caller (src/ads/rewardGate.js)
// only ever grants the bonus on "rewarded".
//
// AdMob.showRewardVideoAd()'s own promise (per the plugin's iOS/Android
// source) resolves *only* from the SDK's actual earn-reward callback -- if
// the player closes the ad before earning it, that promise never settles
// at all. So this can't just await it the way showInterstitial awaits
// AdMob.showInterstitial() above; it has to race it against the
// Dismissed/FailedToShow events too, same "whichever fires first wins"
// pattern, with a separate Reward listener flipping a flag rather than
// resolving directly (both the reward event and the dismiss event fire
// after a real earned watch, in that order, so the flag is already set by
// the time either settle() trigger runs).
export async function showRewardedAd() {
  if (!Capacitor.isNativePlatform()) return "unavailable";

  await ensureInitialized();

  const attStatus = await getAttStatus();
  const npa = attStatus !== "authorized";

  try {
    await AdMob.prepareRewardVideoAd({ adId: adUnitIdFor("bonusGames"), isTesting: IS_DEV_BUILD, npa });
  } catch {
    return "failed";
  }

  return new Promise((resolve) => {
    let rewarded = false;
    let rewardHandle;
    let dismissedHandle;
    let failedHandle;
    const settle = () => {
      rewardHandle?.remove();
      dismissedHandle?.remove();
      failedHandle?.remove();
      resolve(rewarded ? "rewarded" : "closed");
    };
    AdMob.addListener("onRewardedVideoAdReward", () => {
      rewarded = true;
    }).then((h) => (rewardHandle = h));
    AdMob.addListener("onRewardedVideoAdDismissed", settle).then((h) => (dismissedHandle = h));
    AdMob.addListener("onRewardedVideoAdFailedToShow", settle).then((h) => (failedHandle = h));
    AdMob.showRewardVideoAd().then(settle).catch(settle);
  });
}
