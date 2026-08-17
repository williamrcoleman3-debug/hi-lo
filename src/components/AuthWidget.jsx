import { useEffect, useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { FONT_TABULAR } from "../themes/registry.js";
import { useAuth } from "../hooks/useAuth";
import { AvatarPicker } from "./AvatarPicker";
import { UsernameField } from "./UsernameField";
import { DEFAULT_AVATAR } from "../avatars/registry";
import { IconFlame } from "./icons.jsx";
import { peekPendingReferral, setPendingReferral, EMAIL_LINK_CONFIRMED_EVENT } from "../referral/referral.js";
import { isValidPassword, passwordsMatch, PASSWORD_MIN_LENGTH } from "../auth/password.js";

function Modal({ title, onClose, children }) {
  const C = useThemeTokens();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: "rgba(11,14,20,0.94)" }}>
      <div
        className="w-full max-w-sm rounded-lg p-6"
        style={{ background: C.panel, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: C.textPrimary }}>
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
  const C = useThemeTokens();
  const inputStyle = { border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary };
  const {
    isSupabaseConfigured,
    user,
    profile,
    loading,
    signUpWithEmail,
    requestSignInCode,
    verifyCode,
    signInWithPassword,
    setPassword,
    createProfile,
    checkUsernameAvailable,
    signOut,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("signup"); // "signup" | "signin"
  // Sign Up: "signup-email" | "signup-instructions"
  // Sign In: "signin" (email + password-or-code choice) | "signin-code"
  const [step, setStep] = useState("signup-email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [usernameSubmittable, setUsernameSubmittable] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  // Pre-fills the invite-code field from whatever's already pending (the
  // ?ref= query string on web, or a Universal Link tap on iOS -- see
  // src/referral/referral.js) the moment the profile-setup modal appears.
  // Reading it here rather than in useState's initializer matters: this
  // component mounts once at app start, well before either capture path has
  // necessarily run, but this effect re-fires each time the modal opens, by
  // which point they have. `current || …` never clobbers a value the player
  // already typed themselves. Kept above the isSupabaseConfigured early
  // return below, same as every other hook here -- hooks can't follow a
  // conditional return.
  useEffect(() => {
    if (user && !loading && !profile) {
      setInviteCode((current) => current || peekPendingReferral() || "");
    }
  }, [user, loading, profile]);

  // Nice-to-have: while the Sign Up Instructions screen is showing, react
  // live if the confirmation link gets tapped (see referral.js -- appUrlOpen
  // dispatches this on the auth-callback branch, but deliberately no longer
  // tries to establish a session itself, since that was confirmed unreliable
  // on-device). Purely cosmetic -- the flow works fine with the static
  // instructions text even if this never fires.
  useEffect(() => {
    if (step !== "signup-instructions") return;
    const onConfirmed = () => setEmailConfirmed(true);
    window.addEventListener(EMAIL_LINK_CONFIRMED_EVENT, onConfirmed);
    return () => window.removeEventListener(EMAIL_LINK_CONFIRMED_EVENT, onConfirmed);
  }, [step]);

  if (!isSupabaseConfigured) return null;

  const reset = () => {
    setOpen(false);
    setStep("signup-email");
    setEmail("");
    setCode("");
    setSignInPassword("");
    setEmailConfirmed(false);
    setUsername("");
    setAvatar(DEFAULT_AVATAR);
    setUsernameSubmittable(false);
    setNewPassword("");
    setConfirmNewPassword("");
    setError(null);
    setInviteCode("");
  };

  const openSignUp = () => {
    setMode("signup");
    setStep("signup-email");
    setError(null);
    setOpen(true);
  };

  const openSignIn = () => {
    setMode("signin");
    setStep("signin");
    setError(null);
    setOpen(true);
  };

  const handleSignUpEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signUpWithEmail(email);
    setBusy(false);
    if (error) setError(error.message);
    else setStep("signup-instructions");
  };

  const handleSignInWithPassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signInWithPassword(email, signInPassword);
    setBusy(false);
    // No step transition needed on success: signing in flips `user` truthy,
    // and the post-auth branches below take over before this modal is ever
    // reached again on the next render.
    if (error) setError(error.message);
  };

  const handleRequestSignInCode = async () => {
    setBusy(true);
    setError(null);
    const { error } = await requestSignInCode(email);
    setBusy(false);
    if (error) setError(error.message);
    else setStep("signin-code");
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await verifyCode(email, code);
    setBusy(false);
    if (error) setError(error.message);
  };

  const handleCreateProfileAndPassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Syncs whatever's currently in the field -- auto-filled, edited, typed
    // from scratch, or cleared -- into the pending-referral slot that
    // createProfile()/consumePendingReferral() reads right after this.
    setPendingReferral(inviteCode);
    const { error: profileError } = await createProfile(username, avatar);
    if (profileError) {
      setBusy(false);
      setError(profileError.message);
      return;
    }
    const { error: passwordError } = await setPassword(newPassword);
    setBusy(false);
    // If this fails, the profile still exists (created just above) -- there
    // is no separate forced step to fall back into, so just surface the
    // error and let the player retry from here.
    if (passwordError) setError(passwordError.message);
    else reset();
  };

  const passwordFieldsValid = isValidPassword(newPassword) && passwordsMatch(newPassword, confirmNewPassword);
  const passwordMismatch = newPassword.length > 0 && confirmNewPassword.length > 0 && !passwordsMatch(newPassword, confirmNewPassword);

  // Signed in, but no profile row yet — a modal, not an easy-to-miss corner
  // form, so a fresh sign-in can't land the player on this step without
  // noticing it. Username, invite code, and password are all required
  // together here — nobody finishes signup without a password anymore.
  if (user && !loading && !profile) {
    const canSubmit = !busy && usernameSubmittable && passwordFieldsValid;
    return (
      <Modal title="Welcome — set up your profile">
        <form onSubmit={handleCreateProfileAndPassword} className="flex flex-col gap-3">
          <UsernameField
            value={username}
            onChange={setUsername}
            checkUsernameAvailable={checkUsernameAvailable}
            onSubmittableChange={setUsernameSubmittable}
            autoFocus
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="invite-code-field" className="text-xs" style={{ color: C.textMuted }}>
              Invite code (optional)
            </label>
            <input
              id="invite-code-field"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="a friend's username"
              maxLength={16}
              className="rounded-lg px-3 py-2 text-base"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="new-password-field" className="text-xs" style={{ color: C.textMuted }}>
              Password
            </label>
            <input
              id="new-password-field"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`at least ${PASSWORD_MIN_LENGTH} characters`}
              minLength={PASSWORD_MIN_LENGTH}
              required
              className="rounded-lg px-3 py-2 text-base"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-password-field" className="text-xs" style={{ color: C.textMuted }}>
              Confirm password
            </label>
            <input
              id="confirm-password-field"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              className="rounded-lg px-3 py-2 text-base"
              style={inputStyle}
            />
            {passwordMismatch && (
              <span className="text-xs" style={{ color: C.lose }}>
                Passwords don't match.
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: C.textMuted }}>
              Pick an avatar
            </span>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: C.accent, color: C.cardInk }}
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

  if (user && !loading && profile) {
    return (
      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
        <span aria-hidden="true">{profile.avatar}</span>
        <span style={{ color: C.textSecondary }}>{profile.username}</span>
        {profile.current_streak > 0 && (
          <span style={{ color: C.accent, ...FONT_TABULAR }} title={`${profile.current_streak}-day banking streak`}>
<IconFlame />{profile.current_streak}
          </span>
        )}
        <button onClick={() => signOut()} style={{ color: C.textMuted }} className="underline">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={openSignUp}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold"
          style={{ background: C.accent, color: C.cardInk }}
        >
          Sign up
        </button>
        <button
          onClick={openSignIn}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold"
          style={{ border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }}
        >
          Sign in
        </button>
      </div>

      {open && (
        <Modal title={mode === "signup" ? "Sign up" : "Sign in"} onClose={reset}>
          {step === "signup-email" && (
            <form onSubmit={handleSignUpEmail} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="rounded-lg px-3 py-2 text-base"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ background: C.accent, color: C.cardInk }}
              >
                Send confirmation link
              </button>
              {error && <span style={{ color: C.lose }} className="text-xs">{error}</span>}
              <button
                type="button"
                onClick={openSignIn}
                style={{ color: C.textMuted }}
                className="text-xs underline self-center"
              >
                Already have an account? Sign in instead
              </button>
            </form>
          )}

          {step === "signup-instructions" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm" style={{ color: C.textPrimary }}>
                We sent a confirmation link to <strong>{email}</strong>.
              </p>
              {emailConfirmed ? (
                <p className="text-sm" style={{ color: C.win }}>
                  ✓ Confirmed — close this and tap Sign in to finish.
                </p>
              ) : (
                <p className="text-xs" style={{ color: C.textMuted }}>
                  Open your email, tap the link, then come back here and close this.
                </p>
              )}
              <button
                type="button"
                onClick={reset}
                className="rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ background: C.accent, color: C.cardInk }}
              >
                Close
              </button>
            </div>
          )}

          {step === "signin" && (
            <form onSubmit={handleSignInWithPassword} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="rounded-lg px-3 py-2 text-base"
                style={inputStyle}
              />
              <input
                type="password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                placeholder="password"
                className="rounded-lg px-3 py-2 text-base"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={busy || !signInPassword}
                className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: C.accent, color: C.cardInk }}
              >
                Sign in with password
              </button>
              <div className="flex items-center gap-2 text-xs" style={{ color: C.textMuted }}>
                <span className="flex-1 h-px" style={{ background: C.border }} />
                or
                <span className="flex-1 h-px" style={{ background: C.border }} />
              </div>
              <button
                type="button"
                onClick={handleRequestSignInCode}
                disabled={busy || !email}
                className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }}
              >
                Email me a one-time code
              </button>
              {error && <span style={{ color: C.lose }} className="text-xs">{error}</span>}
              <button
                type="button"
                onClick={openSignUp}
                style={{ color: C.textMuted }}
                className="text-xs underline self-center"
              >
                New here? Sign up instead
              </button>
            </form>
          )}

          {step === "signin-code" && (
            <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
              <p style={{ color: C.textMuted }} className="text-xs">
                Code sent to {email} — or tap the magic link in that email instead.
              </p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                required
                autoFocus
                className="rounded-lg px-3 py-2 text-base"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ background: C.accent, color: C.cardInk }}
              >
                Verify
              </button>
              {error && <span style={{ color: C.lose }} className="text-xs">{error}</span>}
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
