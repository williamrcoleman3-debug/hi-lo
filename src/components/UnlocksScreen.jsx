import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { THEMES } from "../themes/registry";
import { AVATARS } from "../avatars/registry";
import { BADGES } from "../badges/registry";
import { UnlockCard } from "./UnlockCard";
import { ThemePreviewOverlay } from "./ThemePreviewOverlay";

function ComingSoon({ label, C }) {
  return (
    <div className="rounded-xl p-4 text-sm" style={{ border: `1px dashed ${C.border}`, color: C.textMuted }}>
      {label}
    </div>
  );
}

export function UnlocksScreen({ unlockedThemeIds, equippedTheme, setEquippedTheme }) {
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

      <section className="w-full max-w-4xl mb-8">
        <h2 className="text-sm uppercase tracking-widest mb-3" style={{ color: C.textMuted }}>
          Avatars
        </h2>
        {AVATARS.length === 0 ? <ComingSoon label="Coming soon." C={C} /> : <div className="flex flex-col gap-2" />}
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
