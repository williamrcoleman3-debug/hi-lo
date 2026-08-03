import { BUNDLE_ID, REMOVE_ADS_PRODUCT_ID, fetchAndVerifyTransaction } from "./_shared/appleClient.mjs";
import { getSupabaseAdmin, getUserFromAuthHeader } from "./_shared/supabaseAdmin.mjs";

// Called by the client (src/iap/purchaseQueue.js) right after StoreKit
// hands back a "Remove Ads" transaction, and again on every background
// retry if that first attempt failed. The client only ever sends a
// transactionId -- everything about the purchase (product, bundle,
// whether it's genuine, whether it's been revoked) is re-derived here
// from Apple's own App Store Server API, never trusted from the request
// body. On any failure this just returns a non-2xx response; the client's
// retry queue (exponential backoff, no ceiling) is what handles retrying,
// not this function -- there is deliberately no internal retry here.
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let transactionId;
  try {
    ({ transactionId } = await req.json());
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }
  if (!transactionId || typeof transactionId !== "string") {
    return Response.json({ error: "transactionId is required" }, { status: 400 });
  }

  let decoded, raw;
  try {
    ({ decoded, raw } = await fetchAndVerifyTransaction(transactionId));
  } catch (err) {
    console.error("verify-iap-receipt: Apple verification failed", err);
    return Response.json({ error: "verification failed" }, { status: 502 });
  }

  if (decoded.bundleId !== BUNDLE_ID || decoded.productId !== REMOVE_ADS_PRODUCT_ID) {
    return Response.json({ error: "transaction is not for this product" }, { status: 422 });
  }
  if (decoded.revocationDate) {
    return Response.json({ error: "transaction has already been revoked" }, { status: 422 });
  }

  const admin = getSupabaseAdmin();

  const { error: upsertError } = await admin
    .from("iap_transactions")
    .upsert(
      {
        user_id: user.id,
        product_id: decoded.productId,
        original_transaction_id: decoded.originalTransactionId,
        transaction_id: decoded.transactionId,
        signed_transaction_info: raw,
        status: "verified",
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "original_transaction_id" }
    );

  if (upsertError) {
    console.error("verify-iap-receipt: iap_transactions upsert failed", upsertError);
    return Response.json({ error: "failed to record transaction" }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").update({ ads_disabled: true }).eq("id", user.id);

  if (profileError) {
    console.error("verify-iap-receipt: profiles update failed", profileError);
    return Response.json({ error: "failed to update account" }, { status: 500 });
  }

  return Response.json({ success: true, adsDisabled: true });
};
