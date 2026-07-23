// Curated set, not a free-choice picker -- keeps rendering consistent across
// devices and keeps the picker UI to a simple grid. Old/stable Unicode only
// (no skin-tone modifiers, which would need their own picker to be fair).
// Edit this array to add/remove/reorder -- nothing else needs to change,
// AvatarPicker and the signup step both just render whatever's here.
export const AVATARS = [
  "😀", "😎", "🤠", "🥳", "🤖", "👽",
  "🐶", "🐱", "🦊", "🐼", "🦁", "🐯", "🐸", "🐵", "🦉", "🐧", "🦄", "🐲", "🐳", "🦋", "🐝",
  "🦈", "🐊", "🐓",
  "⭐", "🌙", "🔥", "⚡",
  "🎲", "🎯", "🎮", "🃏", "👑", "💎", "🚀", "🍕",
  "🇹🇹",
];

export const DEFAULT_AVATAR = AVATARS[0];
