// Pure text-building logic, kept separate from the DOM/share-sheet
// mechanics below so the copy can be reasoned about (and eventually tested)
// without a browser.
export function buildShareText({ status, amount, deckName, dailyStreak, isNewPeak }) {
  const wasBanked = status === "cashed";

  if (isNewPeak) {
    return wasBanked
      ? `New peak: ${amount.toLocaleString()} points on ${deckName} in Higher · Lower · Same — think you can top it?`
      : `New peak: ${amount.toLocaleString()} points on ${deckName} before busting — think you can top it?`;
  }

  if (wasBanked) {
    return dailyStreak > 1
      ? `Day ${dailyStreak} streak — just banked ${amount.toLocaleString()} on ${deckName}. Beat it?`
      : `Just banked ${amount.toLocaleString()} on ${deckName} in Higher · Lower · Same. Beat it?`;
  }

  return `Busted at ${amount.toLocaleString()} on ${deckName} — think you can do better?`;
}

// `username` is only present for signed-in players — the ref tag is a hook
// for future share-attribution, not wired up to any tracking yet.
export function buildShareUrl(username) {
  const url = new URL(window.location.origin);
  if (username) url.searchParams.set("ref", username);
  return url.toString();
}

// Prefers the native share sheet; falls back to clipboard where Web Share
// isn't available (most desktop browsers). Returns a tag describing what
// actually happened, so the caller can show the right feedback.
export async function shareResult(text, url) {
  const shareData = { title: "Higher · Lower · Same", text, url };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (err) {
      if (err.name === "AbortError") return "cancelled";
      // fall through to clipboard on any other failure
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  }

  return "unsupported";
}
