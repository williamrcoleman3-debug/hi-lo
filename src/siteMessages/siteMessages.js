import { supabase, isSupabaseConfigured } from "../supabase/client.js";

const DISMISSAL_KEY_PREFIX = "hilo:dismissed:";

// Resolves to { [slot]: { content, updatedAt } } for all rows. One fetch
// feeds both the signed-out/signed-in banner and the tagline — same
// mechanism, not separate systems per piece of text.
export async function fetchSiteMessages() {
  if (!isSupabaseConfigured) return {};

  const { data, error } = await supabase.from("site_messages").select("slot, content, updated_at");
  if (error) {
    console.error("fetchSiteMessages failed:", error.message);
    return {};
  }

  const bySlot = {};
  for (const row of data) {
    bySlot[row.slot] = { content: row.content, updatedAt: row.updated_at };
  }
  return bySlot;
}

// A slot is dismissed only if the visitor dismissed THIS exact version
// (updatedAt) — editing the row's content bumps updated_at (via the
// touch_site_messages_updated_at trigger), which makes it resurface for
// everyone, including people who already dismissed the old version.
export function isDismissed(slot, updatedAt) {
  if (!updatedAt) return false;
  return sessionStorage.getItem(DISMISSAL_KEY_PREFIX + slot) === updatedAt;
}

export function dismiss(slot, updatedAt) {
  if (!updatedAt) return;
  sessionStorage.setItem(DISMISSAL_KEY_PREFIX + slot, updatedAt);
}
