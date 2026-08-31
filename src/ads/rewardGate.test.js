import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runRewardedBonusFlow } from "./rewardGate.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runRewardedBonusFlow", () => {
  it("grants the bonus when the ad was actually watched to completion", async () => {
    const showRewardedAd = vi.fn().mockResolvedValue("rewarded");
    const grantBonus = vi.fn().mockResolvedValue(40);

    const result = await runRewardedBonusFlow({ showRewardedAd, grantBonus });

    expect(grantBonus).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "granted", bonusGamesToday: 40 });
  });

  it("never grants when the ad is closed early without finishing", async () => {
    const showRewardedAd = vi.fn().mockResolvedValue("closed");
    const grantBonus = vi.fn().mockResolvedValue(20);

    const result = await runRewardedBonusFlow({ showRewardedAd, grantBonus });

    expect(grantBonus).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "closed", bonusGamesToday: null });
  });

  it("never grants when the ad fails to load", async () => {
    const showRewardedAd = vi.fn().mockResolvedValue("failed");
    const grantBonus = vi.fn().mockResolvedValue(20);

    const result = await runRewardedBonusFlow({ showRewardedAd, grantBonus });

    expect(grantBonus).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "failed", bonusGamesToday: null });
  });

  it("never grants outside the native app", async () => {
    const showRewardedAd = vi.fn().mockResolvedValue("unavailable");
    const grantBonus = vi.fn().mockResolvedValue(20);

    const result = await runRewardedBonusFlow({ showRewardedAd, grantBonus });

    expect(grantBonus).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "unavailable", bonusGamesToday: null });
  });

  it("reports grant-failed (not a crash, not a false success) if the grant RPC errors after a real watch", async () => {
    const showRewardedAd = vi.fn().mockResolvedValue("rewarded");
    const grantBonus = vi.fn().mockRejectedValue(new Error("network error"));

    const result = await runRewardedBonusFlow({ showRewardedAd, grantBonus });

    expect(result).toEqual({ status: "grant-failed", bonusGamesToday: null });
  });

  it("reports grant-failed if the grant RPC hangs, rather than leaving the caller stuck forever", async () => {
    const showRewardedAd = vi.fn().mockResolvedValue("rewarded");
    const grantBonus = vi.fn(() => new Promise(() => {}));

    const pending = runRewardedBonusFlow({ showRewardedAd, grantBonus });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toEqual({ status: "grant-failed", bonusGamesToday: null });
  });

  it("has no cap on repeat use -- each watched ad grants again", async () => {
    const showRewardedAd = vi.fn().mockResolvedValue("rewarded");
    const grantBonus = vi.fn().mockResolvedValueOnce(20).mockResolvedValueOnce(40).mockResolvedValueOnce(60);

    const first = await runRewardedBonusFlow({ showRewardedAd, grantBonus });
    const second = await runRewardedBonusFlow({ showRewardedAd, grantBonus });
    const third = await runRewardedBonusFlow({ showRewardedAd, grantBonus });

    expect(grantBonus).toHaveBeenCalledTimes(3);
    expect([first.bonusGamesToday, second.bonusGamesToday, third.bonusGamesToday]).toEqual([20, 40, 60]);
  });
});
