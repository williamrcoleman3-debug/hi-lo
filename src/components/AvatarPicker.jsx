import { useThemeTokens } from "../themes/ThemeContext";
import { AVATARS } from "../avatars/registry";

// Simple grid over the curated AVATARS list -- no lock states, every entry
// is available to everyone immediately, unlike Themes/Badges. Used both at
// signup (required, before the game) and later from the Unlocks tab's
// Profile section (re-editable any time).
export function AvatarPicker({ value, onChange }) {
  const C = useThemeTokens();
  return (
    <div className="grid grid-cols-8 gap-2">
      {AVATARS.map((emoji) => {
        const selected = emoji === value;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            aria-label={`Choose avatar ${emoji}`}
            aria-pressed={selected}
            className="aspect-square rounded-lg text-xl flex items-center justify-center transition-transform active:scale-95"
            style={{
              border: `2px solid ${selected ? C.gold : C.border}`,
              background: selected ? C.goldSoft : "transparent",
            }}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}
