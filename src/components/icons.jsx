// Flat, single-stroke icon set matching the crosshair mark on card backs
// (see Card.jsx) -- 2px round-capped strokes, no fill, inherits color via
// currentColor so each call site's existing text/background color still
// drives it. Replaces emoji that were standing in for these as UI icons
// (lock, lifeline, streak, trophy, playing card) -- see DESIGN.md's craft
// floor: icons are drawn, not Unicode glyphs.
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
// Tailwind preflight sets `svg { display: block }`, which would drop these
// onto their own line whenever they sit inline next to text -- inline-block
// here overrides that so every call site can just drop <IconX /> into copy.
const inlineStyle = (verticalAlign, style) => ({ display: "inline-block", verticalAlign, ...style });

export function IconLock({ size = 14, style, ...props }) {
  return (
    <svg width={size} height={size} style={inlineStyle("-2px", style)} aria-hidden="true" {...base} {...props}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function IconLifebuoy({ size = 16, style, ...props }) {
  return (
    <svg width={size} height={size} style={inlineStyle("-3px", style)} aria-hidden="true" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M6.3 6.3l3.2 3.2M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5" />
    </svg>
  );
}

export function IconFlame({ size = 14, style, ...props }) {
  return (
    <svg width={size} height={size} style={inlineStyle("-2px", style)} aria-hidden="true" {...base} {...props}>
      <path d="M12 2c1 3-3 4-3 7a3 3 0 0 0 6 0c1.5 1 2 3 2 4.5A5 5 0 0 1 7 13.5C7 8 12 6 12 2z" />
    </svg>
  );
}

export function IconTrophy({ size = 18, style, ...props }) {
  return (
    <svg width={size} height={size} style={inlineStyle("-4px", style)} aria-hidden="true" {...base} {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
      <path d="M12 13v4M9 21h6M9 21c0-2 1-3 3-3s3 1 3 3" />
    </svg>
  );
}

export function IconCards({ size = 18, style, ...props }) {
  return (
    <svg width={size} height={size} style={inlineStyle("-4px", style)} aria-hidden="true" {...base} {...props}>
      <rect x="3" y="6" width="12" height="16" rx="2" />
      <path d="M9.5 3.5l9 3.2-5.3 15L9.5 20" />
    </svg>
  );
}
