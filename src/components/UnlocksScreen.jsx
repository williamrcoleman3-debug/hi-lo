import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { THEMES } from "../themes/registry";
import { BADGES } from "../badges/registry";
import { UnlockCard } from "./UnlockCard";
import { ThemePreviewOverlay } from "./ThemePreviewOverlay";
import { AvatarPicker } from "./AvatarPicker";
import { UsernameField } from "./UsernameField";

function ComingSoon({ label, C }) {
  return (
    <div className="rounded-xl p-4 text-sm" style={{ border: `1px dashed ${C.border}`, color: C.textMuted }}>
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
          className="rounded-xl p-4 flex items-center gap-4"
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
        className="rounded-xl p-4 flex flex-col gap-3"
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
            style={{ background: C.gold, color: "#14161f" }}
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

export function UnlocksScreen({ profile, checkUsernameAvailable, updateUsername, updateAvatar, unlockedThemeIds, equippedTheme, setEquippedTheme }) {
  const C = useThemeTokens();
  const [previewThemeId, setPreviewThemeId] = useState(null);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          Unlocks
        </h1>
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

      <section className="w-full max-w-4xl mb-8">
        <h2 className="text-sm uppercase tracking-widest mb-3" style={{ color: C.textMuted }}>
          Themes
        </h2>
        <div className="flex flex-col gap-2">
          {THEMES.map((theme) => {
            const unlocked = unlockedThemeIds.includes(theme.id);
            return (
              <UnlockCard
                key={theme.id}
                name={theme.name}
                previewColors={theme.preview.colors}
                locked={!unlocked}
                conditionText={theme.unlockDescription}
                equipped={unlocked && theme.id === equippedTheme}
                onEquip={unlocked ? () => setEquippedTheme(theme.id) : undefined}
                onPreview={!unlocked ? () => setPreviewThemeId(theme.id) : undefined}
              />
            );
          })}
        </div>
      </section>

      <section className="w-full max-w-4xl">
        <h2 className="text-sm uppercase tracking-widest mb-3" style={{ color: C.textMuted }}>
          Badges
        </h2>
        {BADGES.length === 0 ? <ComingSoon label="Coming soon." C={C} /> : <div className="flex flex-col gap-2" />}
      </section>

      {previewThemeId && <ThemePreviewOverlay themeId={previewThemeId} onClose={() => setPreviewThemeId(null)} />}
    </div>
  );
}
