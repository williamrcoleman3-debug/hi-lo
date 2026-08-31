import { REMOVE_ADS_PRODUCT_ID, verifyNestedTransaction, verifyNotificationPayload } from "./_shared/appleClient.mjs";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin.mjs";

const REFUND_NOTIFICATION_TYPES = new Set([
  "REFUND", // customer-initiated or Apple-initiated refund
  "REVOKE", // Family Sharing access revoked -- same effect as a refund for a non-consumable
]);

// Public endpoint -- Apple posts here directly, there is no Supabase (or
// any) user session on this request. Register this function's URL as the
// App Store Server Notifications V2 endpoint in App Store Connect. Every
// notification is verified against Apple's own signature before anything
// in the payload is trusted; unverified or unrelated-product payloads are
// acknowledged (200) and otherwise ignored, never used to look anything
// up.
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let signedPayload;
  try {
    ({ signedPayload } = await req.json());
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }
  if (!signedPayload) {
    return Response.json({ error: "signedPayload is required" }, { status: 400 });
  }

  let notification;
  try {
    notification = await verifyNotificationPayload(signedPayload);
  } catch (err) {
    console.error("app-store-notifications: signature verification failed", err);
    return Response.json({ error: "could not verify payload" }, { status: 400 });
  }

  if (!REFUND_NOTIFICATION_TYPES.has(notification.notificationType)) {
    return Response.json({ received: true });
  }

  const nestedSignedTransaction = notification.data?.signedTransactionInfo;
  if (!nestedSignedTransaction) {
    return Response.json({ received: true });
  }

  let transaction;
  try {
    transaction = await verifyNestedTransaction(nestedSignedTransaction);
  } catch (err) {
    console.error("app-store-notifications: nested transaction verification failed", err);
    return Response.json({ error: "could not verify transaction" }, { status: 400 });
  }

  if (transaction.productId !== REMOVE_ADS_PRODUCT_ID) {
    return Response.json({ received: true });
  }

  const admin = getSupabaseAdmin();

  const { data: existing, error: lookupError } = await admin
    .from("iap_transactions")
    .select("user_id")
    .eq("original_transaction_id", transaction.originalTransactionId)
    .maybeSingle();

  if (lookupError) {
    console.error("app-store-notifications: iap_transactions lookup failed", lookupError);
    return Response.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!existing) {
    // No matching purchase on file -- nothing to revoke. Still acknowledge
    // so Apple doesn't keep retrying a notification we can't act on.
    return Response.json({ received: true });
  }

  const { error: transactionUpdateError } = await admin
    .from("iap_transactions")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("original_transaction_id", transaction.originalTransactionId);

  if (transactionUpdateError) {
    console.error("app-store-notifications: iap_transactions update failed", transactionUpdateError);
    return Response.json({ error: "failed to record refund" }, { status: 500 });
  }

  // Reappear the Remove Ads banner (see src/components/RemoveAdsBanner.jsx)
  // immediately now that ads are back on for this account -- null, not
  // just an old timestamp outside the 24-hour cooldown, so a refund is
  // never left waiting out whatever's left of a stale pre-refund dismiss.
  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({ ads_disabled: false, remove_ads_banner_dismissed_at: null })
    .eq("id", existing.user_id);

  if (profileUpdateError) {
    console.error("app-store-notifications: profiles update failed", profileUpdateError);
    return Response.json({ error: "failed to update account" }, { status: 500 });
  }

  return Response.json({ received: true });
};
