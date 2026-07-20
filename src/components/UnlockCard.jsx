import { useThemeTokens } from "../themes/ThemeContext";

// Shared row shape for Themes/Avatars/Badges — one component renders all
// three sections' entries so adding real avatars/badges later needs no
// component rework, just data.
export function UnlockCard({ name, previewColors, locked, conditionText, equipped, onEquip, onPreview }) {
  const C = useThemeTokens();
  return (
    <div
      className="rounded-xl p-4 flex items-center gap-4"
      style={{
        border: `2px solid ${equipped ? C.gold : C.border}`,
        background: equipped ? C.goldSoft : "transparent",
        opacity: locked ? 0.7 : 1,
      }}
    >
      <div
        className="w-12 h-12 rounded-lg flex-shrink-0"
        style={{
          background:
            previewColors.length > 1
              ? `linear-gradient(135deg, ${previewColors.join(", ")})`
              : previewColors[0],
          border: `1px solid ${C.border}`,
        }}
      />
      <div className="flex-1">
        <div className="font-semibold text-sm" style={{ color: C.textPrimary }}>
          {name}
        </div>
        {locked && conditionText && (
          <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>
            {conditionText}
          </div>
        )}
      </div>
      {!locked && !equipped && onEquip && (
        <button
          onClick={onEquip}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95"
          style={{ background: C.gold, color: "#14161f" }}
        >
          Equip
        </button>
      )}
      {!locked && equipped && (
        <span className="text-xs font-semibold" style={{ color: C.gold }}>
          Equipped
        </span>
      )}
      {locked && onPreview && (
        <button
          onClick={onPreview}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95"
          style={{ border: `2px solid ${C.border}`, color: C.textPrimary, background: "transparent" }}
        >
          Preview
        </button>
      )}
    </div>
  );
}
