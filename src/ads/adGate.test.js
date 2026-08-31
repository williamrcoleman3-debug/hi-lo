import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runGameStartAdGate } from "./adGate.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runGameStartAdGate", () => {
  it("shows the interstitial when the server says to", async () => {
    const checkAd = vi.fn().mockResolvedValue(true);
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runGameStartAdGate({ checkAd, showInterstitial });

    expect(checkAd).toHaveBeenCalledTimes(1);
    expect(showInterstitial).toHaveBeenCalledTimes(1);
  });

  it("does not show an ad when the server says not to (e.g. mid-window, not yet the 21st game)", async () => {
    const checkAd = vi.fn().mockResolvedValue(false);
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runGameStartAdGate({ checkAd, showInterstitial });

    expect(showInterstitial).not.toHaveBeenCalled();
  });

  it("checks every single game start -- no once-per-launch limit, unlike the old pre-game gate; the server's rolling window is what paces this now", async () => {
    const checkAd = vi.fn().mockResolvedValue(false);
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runGameStartAdGate({ checkAd, showInterstitial });
    await runGameStartAdGate({ checkAd, showInterstitial });
    await runGameStartAdGate({ checkAd, showInterstitial });

    expect(checkAd).toHaveBeenCalledTimes(3);
  });

  it("fails open (lets the game start, never shows an ad) if the eligibility check errors -- e.g. offline", async () => {
    const checkAd = vi.fn().mockRejectedValue(new Error("network error"));
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await expect(runGameStartAdGate({ checkAd, showInterstitial })).resolves.toBeUndefined();
    expect(showInterstitial).not.toHaveBeenCalled();
  });

  it("fails open (does not block gameplay) if the eligibility check never resolves", async () => {
    const checkAd = vi.fn(() => new Promise(() => {}));
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    const pending = runGameStartAdGate({ checkAd, showInterstitial });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toBeUndefined();
    expect(showInterstitial).not.toHaveBeenCalled();
  });

  it("fails open (does not block gameplay) if the ad itself fails to load -- e.g. no network for the creative", async () => {
    const checkAd = vi.fn().mockResolvedValue(true);
    const showInterstitial = vi.fn().mockRejectedValue(new Error("ad failed to load"));

    await expect(runGameStartAdGate({ checkAd, showInterstitial })).resolves.toBeUndefined();
  });

  it("fails open (does not block gameplay) if showing the ad hangs", async () => {
    const checkAd = vi.fn().mockResolvedValue(true);
    const showInterstitial = vi.fn(() => new Promise(() => {}));

    const pending = runGameStartAdGate({ checkAd, showInterstitial });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toBeUndefined();
  });
});
