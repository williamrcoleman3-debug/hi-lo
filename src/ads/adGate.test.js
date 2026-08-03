import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPregameAdStateForTesting, runHandAdGate, runPregameAdGate } from "./adGate.js";

beforeEach(() => {
  vi.useFakeTimers();
  resetPregameAdStateForTesting();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runPregameAdGate", () => {
  it("shows the interstitial when the server says to", async () => {
    const checkPregameAd = vi.fn().mockResolvedValue(true);
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runPregameAdGate({ checkPregameAd, showInterstitial });

    expect(checkPregameAd).toHaveBeenCalledTimes(1);
    expect(showInterstitial).toHaveBeenCalledTimes(1);
  });

  it("does not show an ad when the server says not to (e.g. still in the 60-minute cooldown)", async () => {
    const checkPregameAd = vi.fn().mockResolvedValue(false);
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runPregameAdGate({ checkPregameAd, showInterstitial });

    expect(showInterstitial).not.toHaveBeenCalled();
  });

  it("only checks once per app launch, even across multiple games started in the same session", async () => {
    const checkPregameAd = vi.fn().mockResolvedValue(true);
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runPregameAdGate({ checkPregameAd, showInterstitial });
    await runPregameAdGate({ checkPregameAd, showInterstitial });
    await runPregameAdGate({ checkPregameAd, showInterstitial });

    expect(checkPregameAd).toHaveBeenCalledTimes(1);
    expect(showInterstitial).toHaveBeenCalledTimes(1);
  });

  it("checks again after a fresh app launch (state reset)", async () => {
    const checkPregameAd = vi.fn().mockResolvedValue(true);
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runPregameAdGate({ checkPregameAd, showInterstitial });
    resetPregameAdStateForTesting();
    await runPregameAdGate({ checkPregameAd, showInterstitial });

    expect(checkPregameAd).toHaveBeenCalledTimes(2);
  });

  it("fails open (lets the game start, never shows an ad) if the eligibility check errors -- e.g. offline", async () => {
    const checkPregameAd = vi.fn().mockRejectedValue(new Error("network error"));
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await expect(runPregameAdGate({ checkPregameAd, showInterstitial })).resolves.toBeUndefined();
    expect(showInterstitial).not.toHaveBeenCalled();
  });

  it("fails open and does not retry the eligibility check again this launch after an error", async () => {
    const checkPregameAd = vi.fn().mockRejectedValue(new Error("network error"));
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runPregameAdGate({ checkPregameAd, showInterstitial });
    await runPregameAdGate({ checkPregameAd, showInterstitial });

    expect(checkPregameAd).toHaveBeenCalledTimes(1);
  });

  it("fails open (does not block gameplay) if the eligibility check never resolves", async () => {
    const checkPregameAd = vi.fn(() => new Promise(() => {}));
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    const pending = runPregameAdGate({ checkPregameAd, showInterstitial });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toBeUndefined();
    expect(showInterstitial).not.toHaveBeenCalled();
  });

  it("fails open (does not block gameplay) if the ad itself fails to load -- e.g. no network for the creative", async () => {
    const checkPregameAd = vi.fn().mockResolvedValue(true);
    const showInterstitial = vi.fn().mockRejectedValue(new Error("ad failed to load"));

    await expect(runPregameAdGate({ checkPregameAd, showInterstitial })).resolves.toBeUndefined();
  });

  it("fails open (does not block gameplay) if showing the ad hangs", async () => {
    const checkPregameAd = vi.fn().mockResolvedValue(true);
    const showInterstitial = vi.fn(() => new Promise(() => {}));

    const pending = runPregameAdGate({ checkPregameAd, showInterstitial });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toBeUndefined();
  });
});

describe("runHandAdGate", () => {
  it("shows the interstitial when the 30-hand counter rolls over", async () => {
    const recordHandForAdGate = vi.fn().mockResolvedValue(true);
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runHandAdGate({ recordHandForAdGate, showInterstitial });

    expect(showInterstitial).toHaveBeenCalledTimes(1);
  });

  it("does not show an ad on hands that don't hit the 30-hand mark", async () => {
    const recordHandForAdGate = vi.fn().mockResolvedValue(false);
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runHandAdGate({ recordHandForAdGate, showInterstitial });

    expect(showInterstitial).not.toHaveBeenCalled();
  });

  it("checks every single hand -- unlike the pre-game gate, there is no once-per-launch limit", async () => {
    const recordHandForAdGate = vi.fn().mockResolvedValue(false);
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await runHandAdGate({ recordHandForAdGate, showInterstitial });
    await runHandAdGate({ recordHandForAdGate, showInterstitial });
    await runHandAdGate({ recordHandForAdGate, showInterstitial });

    expect(recordHandForAdGate).toHaveBeenCalledTimes(3);
  });

  it("fails open (lets the next hand start) if the counter RPC errors -- e.g. offline", async () => {
    const recordHandForAdGate = vi.fn().mockRejectedValue(new Error("network error"));
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    await expect(runHandAdGate({ recordHandForAdGate, showInterstitial })).resolves.toBeUndefined();
    expect(showInterstitial).not.toHaveBeenCalled();
  });

  it("fails open (lets the next hand start) if the counter RPC never resolves", async () => {
    const recordHandForAdGate = vi.fn(() => new Promise(() => {}));
    const showInterstitial = vi.fn().mockResolvedValue(undefined);

    const pending = runHandAdGate({ recordHandForAdGate, showInterstitial });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toBeUndefined();
  });

  it("fails open (lets the next hand start) if the ad fails to load", async () => {
    const recordHandForAdGate = vi.fn().mockResolvedValue(true);
    const showInterstitial = vi.fn().mockRejectedValue(new Error("ad failed to load"));

    await expect(runHandAdGate({ recordHandForAdGate, showInterstitial })).resolves.toBeUndefined();
  });
});
