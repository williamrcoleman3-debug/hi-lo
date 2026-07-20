import { C } from "../theme";
import { LEVELS, UNLOCK_REQUIREMENTS } from "../engine";

export function LevelSwitcher({ selectedLevel, unlockedLevels, levelProgress, onSelect }) {
  return (
    <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
      {LEVELS.map((level) => {
        const unlocked = unlockedLevels.includes(level.id);
        const selected = level.id === selectedLevel;
        const requirement = UNLOCK_REQUIREMENTS[level.id];

        const style = selected
          ? { border: `2px solid ${C.gold}`, background: C.goldSoft, color: C.gold }
          : unlocked
          ? { border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }
          : { border: `2px solid ${C.border}`, color: C.textMuted, background: "transparent", opacity: 0.55 };

        return (
          <button
            key={level.id}
            onClick={() => unlocked && onSelect(level.id)}
            disabled={!unlocked}
            title={!unlocked ? requirement?.description : undefined}
            className="rounded-xl px-3 py-2 text-left transition-transform active:scale-95 disabled:cursor-not-allowed"
            style={style}
          >
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{level.name}</span>
              {!unlocked && <span aria-hidden="true">🔒</span>}
            </div>
            <div className="text-[10px]" style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.85 }}>
              ante {level.ante.toLocaleString()}
            </div>
            {!unlocked && requirement && (
              <div className="text-[10px] mt-1 leading-snug" style={{ color: C.textMuted }}>
                {requirement.description}
                {" — "}
                {levelProgress[LEVELS[LEVELS.findIndex((l) => l.id === level.id) - 1].id].bestStreak}/10 best streak
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
