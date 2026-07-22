import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { submitFeedback } from "../feedback/feedback.js";

export function FeedbackScreen({ userId }) {
  const C = useThemeTokens();
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // "sent" | "error" | null

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      await submitFeedback(userId, type, message.trim());
      setMessage("");
      setResult("sent");
    } catch (err) {
      console.error("submitFeedback failed:", err.message);
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          Feedback
        </h1>
        <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
          Found a bug, or have an idea? Tell us here.
        </p>
      </div>

      {!userId ? (
        <div className="w-full max-w-4xl rounded-xl p-6 text-sm text-center" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>
          Sign in to submit feedback.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-4xl flex flex-col gap-4">
          <div className="flex gap-2">
            {[
              { id: "bug", label: "Bug" },
              { id: "suggestion", label: "Suggestion" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-transform active:scale-95"
                style={
                  type === t.id
                    ? { border: `2px solid ${C.gold}`, color: C.gold, background: C.goldSoft }
                    : { border: `2px solid ${C.border}`, color: C.textMuted, background: "transparent" }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={6}
            placeholder={type === "bug" ? "What happened? What did you expect instead?" : "What should we add or change?"}
            className="w-full rounded-xl p-4 text-sm resize-none"
            style={{ border: `1px solid ${C.border}`, background: "transparent", color: C.textPrimary }}
          />

          <p className="text-xs" style={{ color: C.textMuted }}>
            Good suggestions may get you rewarded — no promises, no formula, just noticed.
          </p>

          <button
            type="submit"
            disabled={!message.trim() || submitting}
            className="w-full rounded-xl font-semibold py-3 transition-transform active:scale-95 disabled:opacity-50"
            style={{ border: `2px solid ${C.gold}`, color: C.gold, background: C.goldSoft }}
          >
            {submitting ? "Sending…" : "Submit"}
          </button>

          {result === "sent" && (
            <p className="text-sm text-center" style={{ color: C.gold }}>
              Thanks — got it.
            </p>
          )}
          {result === "error" && (
            <p className="text-sm text-center" style={{ color: C.lose }}>
              Couldn't send that — try again in a moment.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
