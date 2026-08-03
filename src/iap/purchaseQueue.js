// Local retry queue for IAP receipt verification. A purchase's first
// verification attempt always happens inline, right after StoreKit hands
// back the transaction -- this queue only exists for what happens if that
// attempt fails or times out: the transaction is enqueued here (or, on the
// next app launch, StoreKit hands back the same unfinished transaction and
// it's enqueued again) and drainPendingVerifications retries it in the
// background with exponential backoff until it succeeds. There is
// deliberately no retry ceiling and no "give up, ask the user to
// re-purchase" path -- the user already paid; this keeps trying forever.
const STORAGE_KEY = "hilo:pendingIapVerification";
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60 * 1000;

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// Adds a transaction to the queue, due for its first verification attempt
// immediately. No-op if this transaction id is already queued -- re-adding
// it (e.g. StoreKit handing back the same unfinished transaction on a
// later launch) must not reset backoff progress already made.
export function enqueuePendingVerification(transaction, now = Date.now()) {
  const queue = readQueue();
  if (queue.some((e) => e.transactionId === transaction.transactionId)) return;
  queue.push({ ...transaction, attempts: 0, nextAttemptAt: now });
  writeQueue(queue);
}

export function listPendingVerifications() {
  return readQueue();
}

export function removePendingVerification(transactionId) {
  writeQueue(readQueue().filter((e) => e.transactionId !== transactionId));
}

// attempts=0 -> 2s, 1 -> 4s, 2 -> 8s, ... capped at 5 minutes so a
// long-failing verification doesn't back off into effective silence.
export function nextRetryDelayMs(attempts) {
  return Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
}

export function isDueForRetry(entry, now = Date.now()) {
  return now >= entry.nextAttemptAt;
}

// Bumps the attempt count and schedules the next attempt via the backoff
// above -- persisted, so backoff progress survives an app restart mid-retry.
export function recordFailedAttempt(transactionId, now = Date.now()) {
  const queue = readQueue();
  const entry = queue.find((e) => e.transactionId === transactionId);
  if (!entry) return;
  const delay = nextRetryDelayMs(entry.attempts);
  entry.attempts += 1;
  entry.nextAttemptAt = now + delay;
  writeQueue(queue);
}

// True once a transaction has failed at least one verification attempt
// and is still pending -- the UI shows a neutral "Confirming your
// purchase..." state only from this point, per spec ("if still pending
// after the first attempt"), not the instant the purchase completes.
export function hasPendingConfirmation() {
  return readQueue().some((e) => e.attempts >= 1);
}

// Attempts verification for every due entry via the injected `verify`
// function, sequentially (not in parallel, so a burst of pending
// transactions doesn't hammer the Edge Function at once). Removes an
// entry on success; on failure, records the attempt and leaves it queued
// for its next backoff window.
export async function drainPendingVerifications(verify, now = Date.now()) {
  const queue = readQueue();
  for (const entry of queue) {
    if (!isDueForRetry(entry, now)) continue;
    try {
      await verify(entry);
      removePendingVerification(entry.transactionId);
    } catch {
      recordFailedAttempt(entry.transactionId, now);
    }
  }
}
