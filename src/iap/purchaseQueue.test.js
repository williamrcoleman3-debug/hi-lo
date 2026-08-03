import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  drainPendingVerifications,
  enqueuePendingVerification,
  hasPendingConfirmation,
  isDueForRetry,
  listPendingVerifications,
  nextRetryDelayMs,
  recordFailedAttempt,
  removePendingVerification,
} from "./purchaseQueue.js";

const TXN_A = { transactionId: "txn-a", originalTransactionId: "orig-a", productId: "com.halifaxwaterco.hilo.removeads" };
const TXN_B = { transactionId: "txn-b", originalTransactionId: "orig-b", productId: "com.halifaxwaterco.hilo.removeads" };

beforeEach(() => {
  localStorage.clear();
});

describe("enqueuePendingVerification", () => {
  it("adds a new transaction to the queue", () => {
    enqueuePendingVerification(TXN_A);

    const queue = listPendingVerifications();
    expect(queue).toHaveLength(1);
    expect(queue[0].transactionId).toBe("txn-a");
    expect(queue[0].attempts).toBe(0);
  });

  it("is idempotent -- re-enqueuing the same transaction id does not duplicate it", () => {
    enqueuePendingVerification(TXN_A);
    enqueuePendingVerification(TXN_A);

    expect(listPendingVerifications()).toHaveLength(1);
  });

  it("does not reset backoff progress when re-enqueuing an already-failing transaction", () => {
    enqueuePendingVerification(TXN_A, 1_000);
    recordFailedAttempt("txn-a", 1_000);

    enqueuePendingVerification(TXN_A, 5_000);

    const [entry] = listPendingVerifications();
    expect(entry.attempts).toBe(1);
  });

  it("keeps multiple distinct pending transactions independently", () => {
    enqueuePendingVerification(TXN_A);
    enqueuePendingVerification(TXN_B);

    expect(listPendingVerifications().map((e) => e.transactionId).sort()).toEqual(["txn-a", "txn-b"]);
  });
});

describe("removePendingVerification", () => {
  it("removes a transaction from the queue", () => {
    enqueuePendingVerification(TXN_A);
    enqueuePendingVerification(TXN_B);

    removePendingVerification("txn-a");

    expect(listPendingVerifications().map((e) => e.transactionId)).toEqual(["txn-b"]);
  });
});

describe("nextRetryDelayMs", () => {
  it("starts at a 2-second base delay", () => {
    expect(nextRetryDelayMs(0)).toBe(2_000);
  });

  it("doubles with each attempt", () => {
    expect(nextRetryDelayMs(1)).toBe(4_000);
    expect(nextRetryDelayMs(2)).toBe(8_000);
    expect(nextRetryDelayMs(3)).toBe(16_000);
  });

  it("caps at 5 minutes so a long-failing verification doesn't back off forever", () => {
    expect(nextRetryDelayMs(20)).toBe(5 * 60 * 1000);
  });
});

describe("recordFailedAttempt", () => {
  it("increments the attempt count", () => {
    enqueuePendingVerification(TXN_A, 0);
    recordFailedAttempt("txn-a", 0);

    expect(listPendingVerifications()[0].attempts).toBe(1);
  });

  it("schedules the next attempt using the exponential backoff delay", () => {
    enqueuePendingVerification(TXN_A, 0);
    recordFailedAttempt("txn-a", 0);

    expect(listPendingVerifications()[0].nextAttemptAt).toBe(nextRetryDelayMs(0));
  });

  it("keeps backing off further on repeated failures", () => {
    enqueuePendingVerification(TXN_A, 0);
    recordFailedAttempt("txn-a", 0);
    recordFailedAttempt("txn-a", 2_000);

    const entry = listPendingVerifications()[0];
    expect(entry.attempts).toBe(2);
    expect(entry.nextAttemptAt).toBe(2_000 + nextRetryDelayMs(1));
  });
});

describe("isDueForRetry", () => {
  it("is not due before its scheduled retry time", () => {
    const entry = { nextAttemptAt: 10_000 };
    expect(isDueForRetry(entry, 5_000)).toBe(false);
  });

  it("is due once the scheduled retry time has passed", () => {
    const entry = { nextAttemptAt: 10_000 };
    expect(isDueForRetry(entry, 10_000)).toBe(true);
    expect(isDueForRetry(entry, 15_000)).toBe(true);
  });
});

describe("hasPendingConfirmation", () => {
  it("is false when nothing is queued", () => {
    expect(hasPendingConfirmation()).toBe(false);
  });

  it("is false for a transaction that hasn't failed an attempt yet", () => {
    enqueuePendingVerification(TXN_A);
    expect(hasPendingConfirmation()).toBe(false);
  });

  it("is true once a transaction has failed its first verification attempt", () => {
    enqueuePendingVerification(TXN_A, 0);
    recordFailedAttempt("txn-a", 0);

    expect(hasPendingConfirmation()).toBe(true);
  });
});

describe("drainPendingVerifications", () => {
  it("verifies a due entry and removes it from the queue on success", async () => {
    enqueuePendingVerification(TXN_A, 0);
    const verify = vi.fn().mockResolvedValue(undefined);

    await drainPendingVerifications(verify, 0);

    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ transactionId: "txn-a" }));
    expect(listPendingVerifications()).toHaveLength(0);
  });

  it("records a failed attempt and keeps the entry queued on failure", async () => {
    enqueuePendingVerification(TXN_A, 0);
    const verify = vi.fn().mockRejectedValue(new Error("edge function timed out"));

    await drainPendingVerifications(verify, 0);

    const queue = listPendingVerifications();
    expect(queue).toHaveLength(1);
    expect(queue[0].attempts).toBe(1);
  });

  it("does not retry an entry before its backoff window has elapsed", async () => {
    enqueuePendingVerification(TXN_A, 0);
    const verify = vi.fn().mockRejectedValue(new Error("fails"));
    await drainPendingVerifications(verify, 0); // first failure, backs off 2s

    await drainPendingVerifications(verify, 500); // still within the 2s window

    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("retries an entry again once its backoff window has elapsed", async () => {
    enqueuePendingVerification(TXN_A, 0);
    const verify = vi.fn().mockRejectedValue(new Error("fails"));
    await drainPendingVerifications(verify, 0);

    await drainPendingVerifications(verify, nextRetryDelayMs(0));

    expect(verify).toHaveBeenCalledTimes(2);
  });

  it("processes multiple due entries independently, one failure not blocking another's success", async () => {
    enqueuePendingVerification(TXN_A, 0);
    enqueuePendingVerification(TXN_B, 0);
    const verify = vi.fn((entry) =>
      entry.transactionId === "txn-a" ? Promise.reject(new Error("fails")) : Promise.resolve()
    );

    await drainPendingVerifications(verify, 0);

    const remaining = listPendingVerifications().map((e) => e.transactionId);
    expect(remaining).toEqual(["txn-a"]);
  });
});
