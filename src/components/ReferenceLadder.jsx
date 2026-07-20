import { C } from "../theme";
import { AVG_REFERENCE } from "../engine";

export function ReferenceLadder({ streak, justClimbed, ante }) {
  const rungs = Array.from({ length: 8 }, (_, i) => i + 1);
  const scale = ante / 100; // AVG_REFERENCE is tabulated at a 100-point ante; scales proportionally
  return (
    <div className="flex flex-col-reverse gap-1.5">
      {rungs.map((r) => {
        const val = Math.round(AVG_REFERENCE[Math.min(r - 1, AVG_REFERENCE.length - 1)] * scale);
        const lit = r <= streak;
        const isNext = r === streak + 1;
        const isJustLit = r === streak && justClimbed;
        const style = lit
          ? { border: `1px solid ${C.gold}`, background: C.goldSoft, color: C.gold }
          : isNext
          ? { border: `1px solid rgba(212,175,106,0.5)`, color: "rgba(212,175,106,0.8)" }
          : { border: `1px solid ${C.border}`, color: C.textMuted };
        return (
          <div
            key={r}
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all duration-300 ${
              isNext ? "animate-pulse" : ""
            } ${isJustLit ? "rung-pop" : ""}`}
            style={{ ...style, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <span>#{r}</span>
            <span>~{val.toLocaleString()}</span>
          </div>
        );
      })}
      <div className="text-[10px] uppercase tracking-widest text-center pt-1" style={{ color: C.textMuted }}>
        avg. reference — real payout varies by hand
      </div>
    </div>
  );
}
