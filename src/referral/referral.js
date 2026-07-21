const PENDING_REFERRAL_KEY = "hilo:pendingReferral";

// Captures ?ref=username from the URL into localStorage (not sessionStorage —
// this needs to survive the OTP email round-trip, which can land back in a
// different tab/session than the one that first opened the link).
export function capturePendingReferral() {
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (ref) localStorage.setItem(PENDING_REFERRAL_KEY, ref);
}

// Reads and clears the pending referral in one step — attribution is
// attempted at most once per signup, regardless of whether it succeeds.
export function consumePendingReferral() {
  const ref = localStorage.getItem(PENDING_REFERRAL_KEY);
  localStorage.removeItem(PENDING_REFERRAL_KEY);
  return ref;
}
