import { useState } from "react";
import { C } from "../theme";
import { useAuth } from "../hooks/useAuth";

const inputStyle = {
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: C.textPrimary,
};

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: C.panel, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: C.textPrimary }}>
            {title}
          </h2>
          {onClose && (
            <button onClick={onClose} style={{ color: C.textMuted }} aria-label="Close">
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function AuthWidget() {
  const { isSupabaseConfigured, user, profile, loading, sendCode, verifyCode, createProfile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("email"); // "email" | "code" | null (mid-verify)
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured) return null;

  const reset = () => {
    setOpen(false);
    setStep("email");
    setEmail("");
    setCode("");
    setUsername("");
    setError(null);
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sendCode(email);
    setBusy(false);
    if (error) setError(error.message);
    else setStep("code");
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await verifyCode(email, code);
    setBusy(false);
    if (error) setError(error.message);
    // No step transition needed here: verifying flips `user` truthy, and the
    // forced-username-modal branch below takes over once the profile fetch
    // resolves. Just drop the code form so it doesn't linger in the meantime.
    else setStep(null);
  };

  const handleCreateUsername = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createProfile(username);
    setBusy(false);
    if (error) setError(error.message);
    else reset();
  };

  if (user && !loading && profile) {
    return (
      <div className="flex items-center gap-3 text-sm" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        <span style={{ color: C.textSecondary }}>{profile.username}</span>
        <button onClick={() => signOut()} style={{ color: C.textMuted }} className="underline">
          Sign out
        </button>
      </div>
    );
  }

  // Signed in, but no profile row yet — a modal, not an easy-to-miss corner
  // form, so a fresh magic-link sign-in can't land the player on this step
  // without noticing it.
  if (user && !loading && !profile) {
    return (
      <Modal title="Welcome — choose a username">
        <form onSubmit={handleCreateUsername} className="flex flex-col gap-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            minLength={2}
            maxLength={24}
            required
            autoFocus
            className="rounded-lg px-3 py-2 text-sm"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: C.gold, color: "#14161f" }}
          >
            Save and continue
          </button>
          {error && <span style={{ color: C.lose }} className="text-xs">{error}</span>}
          <button
            type="button"
            onClick={() => signOut()}
            style={{ color: C.textMuted }}
            className="text-xs underline self-center"
          >
            sign out instead
          </button>
        </form>
      </Modal>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg px-3 py-1.5 text-sm font-semibold"
        style={{ border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }}
      >
        Sign in
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg px-3 py-1.5 text-sm font-semibold"
        style={{ border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }}
      >
        Sign in
      </button>
      <Modal title="Sign in" onClose={reset}>
        {step === "email" && (
          <form onSubmit={handleSendCode} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ background: C.gold, color: "#14161f" }}
            >
              Send code
            </button>
          </form>
        )}
        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
            <p style={{ color: C.textMuted }} className="text-xs">
              Code sent to {email} — or click the magic link in that email instead.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              required
              autoFocus
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ background: C.gold, color: "#14161f" }}
            >
              Verify
            </button>
          </form>
        )}
        {error && <span style={{ color: C.lose }} className="text-xs">{error}</span>}
      </Modal>
    </>
  );
}
