import { useEffect, useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";

// English letters only, 2-16 chars -- mirrors the server-side CHECK
// constraint on profiles.username (see schema.sql). Client-side is UX only;
// the server constraint and the unique index are the actual gates.
export const USERNAME_PATTERN = /^[A-Za-z]{2,16}$/;
const CHECK_DEBOUNCE_MS = 400;

// Shared username input + live availability hint -- used both at signup
// (AuthWidget's forced profile-creation modal) and when renaming later
// (UnlocksScreen's Profile section), so the debounce/validation logic only
// lives once. currentUsername (only passed when renaming, not at signup)
// excludes "no actual change" from ever being flagged as taken -- the
// availability check can't otherwise tell your own row apart from a real
// conflict by username alone.
export function UsernameField({ value, onChange, checkUsernameAvailable, currentUsername, onSubmittableChange, autoFocus }) {
  const C = useThemeTokens();
  const [status, setStatus] = useState("idle");
  const valid = USERNAME_PATTERN.test(value);
  const unchanged = currentUsername != null && value.toLowerCase() === currentUsername.toLowerCase();

  useEffect(() => {
    if (unchanged) {
      setStatus("unchanged");
      return;
    }
    if (!valid) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("checking");
    const timer = setTimeout(() => {
      checkUsernameAvailable(value).then((available) => {
        if (!cancelled) setStatus(available ? "available" : "taken");
      });
    }, CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, unchanged, valid]);

  useEffect(() => {
    onSubmittableChange?.(status === "available" || status === "unchanged");
  }, [status, onSubmittableChange]);

  const inputStyle = { border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary };

  return (
    <div className="flex flex-col gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="username"
        minLength={2}
        maxLength={16}
        pattern="[A-Za-z]{2,16}"
        required
        autoFocus={autoFocus}
        className="rounded-lg px-3 py-2 text-sm"
        style={inputStyle}
      />
      <span className="text-xs" style={{ color: status === "taken" ? C.lose : C.textMuted }}>
        {value.length === 0
          ? "2–16 letters, no numbers or symbols."
          : !valid
          ? "2–16 letters only (a-z) — no numbers or symbols."
          : status === "checking"
          ? "Checking availability…"
          : status === "taken"
          ? "That username is taken — try another."
          : status === "available"
          ? "✓ Available"
          : ""}
      </span>
    </div>
  );
}
