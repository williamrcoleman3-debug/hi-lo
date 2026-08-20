import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { deleteAccount } from "../account/deleteAccount.js";

// Apple Guideline 5.1.1v -- an in-app path to fully delete an account, not
// just sign out. Requires being signed in; a plain "are you sure" confirm
// step is enough per the actual requirement (no phone/email-only process).
// The real deletion work -- every table tied to this user id, then the
// auth.users record itself -- happens server-side in the delete-account
// Edge Function; this component only confirms intent and reports the
// result.
export function DeleteAccountScreen({ userId, signOut }) {
  const C = useThemeTokens();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!userId) {
    return (
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Delete Account</h1>
        <p className="text-sm mt-2" style={{ color: C.textSecondary }}>
          Sign in to delete your account.
        </p>
      </div>
    );
  }

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      // Local Supabase session is otherwise unaffected by the server-side
      // delete -- this is what actually drops the app back to its
      // signed-out state.
      await signOut();
    } catch {
      setBusy(false);
      setError("Couldn't delete your account — try again in a moment.");
    }
  };

  return (
    <div className="w-full max-w-4xl flex flex-col items-start gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Delete Account</h1>
        <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
          Permanently deletes your profile, game history, leaderboard standing, referrals, and purchase
          records. This cannot be undone.
        </p>
      </div>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: C.lose, color: "#fff" }}
        >
          Delete my account
        </button>
      ) : (
        <div className="w-full rounded-lg p-4 flex flex-col gap-3" style={{ border: `1px solid ${C.lose}`, background: C.loseSoft }}>
          <p className="text-sm font-semibold" style={{ color: C.lose }}>
            Are you sure? This permanently deletes your account and everything tied to it. There's no
            undo.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: C.lose, color: "#fff" }}
            >
              {busy ? "Deleting…" : "Yes, permanently delete"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <span className="text-xs" style={{ color: C.lose }}>
          {error}
        </span>
      )}
    </div>
  );
}
