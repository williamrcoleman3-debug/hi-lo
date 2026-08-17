import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useThemeTokens } from "../themes/ThemeContext";
import { BADGES } from "../badges/registry";
import { AvatarPicker } from "./AvatarPicker";
import { UsernameField } from "./UsernameField";
import { isMuted, setMuted } from "../audio/sound.js";
import { purchaseRemoveAds } from "../iap/purchases.js";
import { hasPendingConfirmation } from "../iap/purchaseQueue.js";

function ComingSoon({ label, C }) {
  return (
    <div className="rounded-lg p-4 text-sm" style={{ border: `1px dashed ${C.border}`, color: C.textMuted }}>
      {label}
    </div>
  );
}

// Username + avatar, editable any time -- not a Themes/Badges-style earned
// unlock (no lock condition, nothing to earn), but this tab is the closest
// existing home for "customize how you appear," so it lives here rather
// than a whole new tab. Reuses the exact same UsernameField/AvatarPicker as
// the signup step for identical validation behavior.
function ProfileSection({ profile, checkUsernameAvailable, updateUsername, updateAvatar }) {
  const C = useThemeTokens();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? "");
  const [usernameSubmittable, setUsernameSubmittable] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  const startEditing = () => {
    setUsername(profile.username);
    setAvatar(profile.avatar);
    setError(null);
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const usernameChanged = username !== profile.username;
    const avatarChanged = avatar !== profile.avatar;
    if (usernameChanged) {
      const { error } = await updateUsername(username);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
    }
    if (avatarChanged) {
      const { error } = await updateAvatar(avatar);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
    }
    setBusy(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <section className="w-full max-w-4xl mb-8">
        <h2 className="text-sm uppercase tracking-widest mb-3" style={{ color: C.textMuted }}>
          Profile
        </h2>
        <div
          className="rounded-lg p-4 flex items-center gap-4"
          style={{ border: `1px solid ${C.border}` }}
        >
          <span className="text-2xl" aria-hidden="true">{profile.avatar}</span>
          <span className="flex-1 font-semibold text-sm" style={{ color: C.textPrimary }}>
            {profile.username}
          </span>
          <button
            onClick={startEditing}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95"
            style={{ border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }}
          >
            Edit
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-4xl mb-8">
      <h2 className="text-sm uppercase tracking-widest mb-3" style={{ color: C.textMuted }}>
        Profile
      </h2>
      <form
        onSubmit={handleSave}
        className="rounded-lg p-4 flex flex-col gap-3"
        style={{ border: `1px solid ${C.border}` }}
      >
        <UsernameField
          value={username}
          onChange={setUsername}
          checkUsernameAvailable={checkUsernameAvailable}
          currentUsername={profile.username}
          onSubmittableChange={setUsernameSubmittable}
        />
        <AvatarPicker value={avatar} onChange={setAvatar} />
        {error && <span style={{ color: C.lose }} className="text-xs">{error}</span>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || !usernameSubmittable}
            className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: C.accent, color: C.cardInk }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

// Bank/Speed preference -- available to everyone, no unlock condition
// (unlike Themes below). Takes effect on the *next* game only; changing it
// mid-game never affects the game already in progress (see
// useServerGame.js/useGame.js's speedModeRef for why).
function GameModeSection({ gameMode, setGameMode }) {
  const C = useThemeTokens();
  const optionStyle = (active) =>
    active
      ? { border: `2px solid ${C.accent}`, background: C.accentSoft, color: C.accent }
      : { border: `2px solid ${C.border}`, color: C.textMuted, background: "transparent" };

  return (
    <section className="w-full max-w-4xl mb-8">
      <h2 className="text-sm uppercase tracking-widest mb-3" style={{ color: C.textMuted }}>
        Game Mode
      </h2>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={() => setGameMode("bank")}
          className="rounded-lg px-3 py-3 text-left transition-transform active:scale-95"
          style={optionStyle(gameMode !== "speed")}
        >
          <div className="text-sm font-semibold">Bank Mode</div>
          <div className="text-xs mt-0.5" style={{ opacity: 0.85 }}>
            Bank anytime. A short pause after each win.
          </div>
        </button>
        <button
          onClick={() => setGameMode("speed")}
          className="rounded-lg px-3 py-3 text-left transition-transform active:scale-95"
          style={optionStyle(gameMode === "speed")}
        >
          <div className="text-sm font-semibold">Speed Mode</div>
          <div className="text-xs mt-0.5" style={{ opacity: 0.85 }}>
            No pause, no banking — bust or clear the whole deck.
          </div>
        </button>
      </div>
      <p className="text-xs" style={{ color: C.textMuted }}>
        Takes effect on your next game — never changes a game already in progress.
      </p>
    </section>
  );
}

// Local device preference, not synced to an account -- see audio/sound.js.
function SoundSection() {
  const C = useThemeTokens();
  const [muted, setMutedState] = useState(() => isMuted());

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <section className="w-full max-w-4xl mb-8">
      <h2 className="text-sm uppercase tracking-widest mb-3" style={{ color: C.textMuted }}>
        Sound
      </h2>
      <div
        className="rounded-lg p-4 flex items-center justify-between"
        style={{ border: `1px solid ${C.border}` }}
      >
        <span className="text-sm" style={{ color: C.textPrimary }}>
          Sound effects
        </span>
        <button
          onClick={toggle}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95"
          style={
            muted
              ? { border: `2px solid ${C.border}`, color: C.textMuted, background: "transparent" }
              : { background: C.accent, color: C.cardInk }
          }
        >
          {muted ? "Off" : "On"}
        </button>
      </div>
    </section>
  );
}

// Purchase state, in priority order: purchased (profile.ads_disabled) >
// pending (a verification attempt has already failed once and is
// retrying in the background, see src/iap/purchaseQueue.js) > not
// purchased. Refunds flip ads_disabled back to false server-side (see
// netlify/functions/app-store-notifications.mjs), which naturally
// reopens the buy button here too -- no separate "was refunded" state to
// track.
function RemoveAdsSection({ profile }) {
  const C = useThemeTokens();
  const [pending, setPending] = useState(() => hasPendingConfirmation());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setPending(hasPendingConfirmation()), 3000);
    return () => clearInterval(id);
  }, []);

  if (!profile) return null;

  const purchased = profile.ads_disabled;
  const isNative = Capacitor.isNativePlatform();

  const handleBuy = async () => {
    setBusy(true);
    setError(null);
    try {
      await purchaseRemoveAds();
      setPending(hasPendingConfirmation());
    } catch (err) {
      console.error("purchaseRemoveAds failed:", err.message);
      setError("Couldn't start the purchase — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="w-full max-w-4xl mb-8">
      <h2 className="text-sm uppercase tracking-widest mb-3" style={{ color: C.textMuted }}>
        Remove Ads
      </h2>
      <div className="rounded-lg p-4 flex items-center justify-between gap-4" style={{ border: `1px solid ${C.border}` }}>
        {purchased ? (
          <span className="text-sm font-semibold" style={{ color: C.accent }}>
            ✓ Ads removed — thanks for supporting Hi-Lo.
          </span>
        ) : pending ? (
          <span className="text-sm" style={{ color: C.textMuted }}>
            Confirming your purchase…
          </span>
        ) : (
          <>
            <div>
              <div className="text-sm font-semibold" style={{ color: C.textPrimary }}>
                Remove all ads — $4.99
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>
                One-time purchase. Never affects odds, the deck, or the daily play limit.
              </div>
              {!isNative && (
                <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>
                  Available in the iOS app.
                </div>
              )}
              {error && (
                <div className="text-xs mt-0.5" style={{ color: C.lose }}>
                  {error}
                </div>
              )}
            </div>
            <button
              onClick={handleBuy}
              disabled={busy || !isNative}
              className="rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap disabled:opacity-50 transition-transform active:scale-95"
              style={{ background: C.accent, color: C.cardInk }}
            >
              {busy ? "…" : "Buy $4.99"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export function UnlocksScreen({
  profile,
  checkUsernameAvailable,
  updateUsername,
  updateAvatar,
  gameMode,
  setGameMode,
}) {
  const C = useThemeTokens();

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Unlocks</h1>
        <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
          Cosmetic rewards earned through play — equipping one never affects the odds or payouts.
        </p>
      </div>

      <ProfileSection
        profile={profile}
        checkUsernameAvailable={checkUsernameAvailable}
        updateUsername={updateUsername}
        updateAvatar={updateAvatar}
      />

      <GameModeSection gameMode={gameMode} setGameMode={setGameMode} />

      <RemoveAdsSection profile={profile} />

      <SoundSection />

      <section className="w-full max-w-4xl">
        <h2 className="text-sm uppercase tracking-widest mb-3" style={{ color: C.textMuted }}>
          Badges
        </h2>
        {BADGES.length === 0 ? <ComingSoon label="Coming soon." C={C} /> : <div className="flex flex-col gap-2" />}
      </section>
    </div>
  );
}
