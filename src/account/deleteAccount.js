import { supabase } from "../supabase/client.js";

// Calls the delete-account Supabase Edge Function (supabase/functions/
// delete-account) -- a Supabase Edge Function rather than a Netlify
// Function like verify-iap-receipt/app-store-notifications, since this
// doesn't touch Apple's Deno-incompatible verification library and belongs
// next to the database it's deleting from. functions.invoke() attaches the
// current session's access token automatically. Throws on any failure --
// the caller (DeleteAccountScreen) decides what to show, this only ever
// identifies whether the call succeeded.
export async function deleteAccount() {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) throw error;
}
