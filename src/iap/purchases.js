import { Capacitor } from "@capacitor/core";
import { Platform, ProductType, store } from "capacitor-plugin-cdv-purchase";
import { drainPendingVerifications, enqueuePendingVerification } from "./purchaseQueue.js";
import { verifyReceipt } from "./verifyReceipt.js";

export const REMOVE_ADS_PRODUCT_ID = "com.halifaxwaterco.hilo.removeads";

const DRAIN_INTERVAL_MS = 15_000;

// transactionId -> native Transaction object, populated from every
// "approved" event this app session sees -- including transactions
// StoreKit redelivers automatically on store.initialize() for anything
// left unfinished from a previous launch. store.finish() needs the real
// Transaction object, not just an id, so a background retry (which only
// has the plain data purchaseQueue.js persisted) looks it back up here
// once verification succeeds.
const pendingTransactions = new Map();

let initialized = false;
let onPurchaseVerified = null;

async function handleApproved(transaction) {
  pendingTransactions.set(transaction.transactionId, transaction);
  try {
    await verifyReceipt(transaction.transactionId);
    onPurchaseVerified?.();
    await store.finish(transaction);
    pendingTransactions.delete(transaction.transactionId);
  } catch {
    // Verification failed or timed out -- deliberately leave the
    // transaction unfinished. StoreKit keeps it pending and redelivers it
    // through this same handler on the next store.initialize() (including
    // a fresh app launch), and the interval below retries it in the
    // background in the meantime -- no error shown, no re-purchase
    // prompt, per spec.
    enqueuePendingVerification({ transactionId: transaction.transactionId });
  }
}

async function retryQueuedVerification(entry) {
  await verifyReceipt(entry.transactionId);
  onPurchaseVerified?.();
  const transaction = pendingTransactions.get(entry.transactionId);
  if (transaction) {
    await store.finish(transaction);
    pendingTransactions.delete(entry.transactionId);
  }
}

// Registers the product, wires the approved-transaction handler, and
// starts the app. Call once, early (see src/native/bootstrap.js). No-op
// outside the native iOS shell -- there is no StoreKit on the web.
// onVerified fires every time a purchase (new or retried) is confirmed,
// so the caller can refresh profile.ads_disabled from Supabase.
export async function initPurchases({ onVerified } = {}) {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;
  onPurchaseVerified = onVerified ?? null;

  store.register([{ id: REMOVE_ADS_PRODUCT_ID, type: ProductType.NON_CONSUMABLE, platform: Platform.APPLE_APPSTORE }]);
  store.when().approved((transaction) => handleApproved(transaction));
  await store.initialize([Platform.APPLE_APPSTORE]);

  setInterval(() => {
    drainPendingVerifications(retryQueuedVerification).catch((err) => {
      console.error("purchases: background verification retry failed", err);
    });
  }, DRAIN_INTERVAL_MS);
}

// Starts the purchase flow -- resolution happens asynchronously via the
// approved handler above, not this call's return value.
export async function purchaseRemoveAds() {
  const product = store.get(REMOVE_ADS_PRODUCT_ID);
  const offer = product?.getOffer();
  if (!offer) throw new Error("Remove Ads is not available right now");
  const error = await offer.order();
  if (error) throw new Error(error.message);
}
