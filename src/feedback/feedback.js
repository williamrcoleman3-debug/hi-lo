import { supabase } from "../supabase/client.js";

// Insert-only from the client — the "users can submit their own feedback"
// RLS policy is the only gate (auth.uid() = user_id), no RPC needed since
// there's no arithmetic to race on. There's deliberately no select policy:
// submissions are read back only through the Supabase table editor.
export async function submitFeedback(userId, type, message) {
  const { error } = await supabase.from("feedback_submissions").insert({ user_id: userId, type, message });
  if (error) throw error;
}
