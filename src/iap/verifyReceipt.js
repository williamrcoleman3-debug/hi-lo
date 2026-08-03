import { supabase } from "../supabase/client.js";

// Same origin as the app itself -- capacitor.config.json points the
// native shell at the live site (hi-lo-game.com), which is also what
// serves these Netlify Functions, so a relative path here needs no CORS
// configuration on either side.
const VERIFY_URL = "/.netlify/functions/verify-iap-receipt";

// Sends a StoreKit transactionId to verify-iap-receipt, which independently
// re-derives everything about the purchase from Apple's own App Store
// Server API -- nothing here is trusted client-side, this call only ever
// identifies which transaction to check. Throws on any failure (network,
// timeout, Apple rejects it) -- the caller (src/iap/purchases.js) is what
// decides to queue a retry, not this function.
export async function verifyReceipt(transactionId) {
  if (!supabase) throw new Error("Supabase is not configured");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("not signed in");

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ transactionId }),
  });

  if (!res.ok) {
    throw new Error(`verify-iap-receipt failed (${res.status})`);
  }
  return res.json();
}
