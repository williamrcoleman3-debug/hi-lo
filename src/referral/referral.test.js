import { beforeEach, describe, expect, it } from "vitest";
import {
  capturePendingReferral,
  consumePendingReferral,
  initReferralDeepLinkCapture,
  peekPendingReferral,
  setPendingReferral,
} from "./referral.js";

const PENDING_REFERRAL_KEY = "hilo:pendingReferral";

function setUrl(urlOrPath) {
  window.history.pushState({}, "", urlOrPath);
}

beforeEach(() => {
  localStorage.clear();
  setUrl("/");
});

describe("capturePendingReferral", () => {
  it("captures ?ref= from the current URL into localStorage", () => {
    setUrl("/?ref=alice");

    capturePendingReferral();

    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBe("alice");
  });

  it("does nothing when there is no ?ref= param", () => {
    setUrl("/?utm_source=twitter");

    capturePendingReferral();

    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBeNull();
  });

  it("does not clear an existing pending referral when the current URL has no ?ref=", () => {
    localStorage.setItem(PENDING_REFERRAL_KEY, "bob");
    setUrl("/");

    capturePendingReferral();

    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBe("bob");
  });

  it("overwrites a previously pending referral with a new one from the URL", () => {
    localStorage.setItem(PENDING_REFERRAL_KEY, "bob");
    setUrl("/?ref=carol");

    capturePendingReferral();

    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBe("carol");
  });
});

describe("peekPendingReferral", () => {
  it("returns null when nothing is pending", () => {
    expect(peekPendingReferral()).toBeNull();
  });

  it("returns the pending referral without clearing it", () => {
    localStorage.setItem(PENDING_REFERRAL_KEY, "dave");

    expect(peekPendingReferral()).toBe("dave");
    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBe("dave");
  });
});

describe("setPendingReferral", () => {
  it("stores a trimmed username", () => {
    setPendingReferral("  erin  ");

    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBe("erin");
  });

  it("overwrites whatever was previously pending", () => {
    localStorage.setItem(PENDING_REFERRAL_KEY, "frank");

    setPendingReferral("grace");

    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBe("grace");
  });

  it("clears the pending referral when given an empty string", () => {
    localStorage.setItem(PENDING_REFERRAL_KEY, "henry");

    setPendingReferral("");

    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBeNull();
  });

  it("clears the pending referral when given only whitespace", () => {
    localStorage.setItem(PENDING_REFERRAL_KEY, "henry");

    setPendingReferral("   ");

    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBeNull();
  });

  it("clears the pending referral when given null or undefined", () => {
    localStorage.setItem(PENDING_REFERRAL_KEY, "henry");

    setPendingReferral(undefined);

    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBeNull();
  });
});

describe("consumePendingReferral", () => {
  it("returns null when nothing is pending", () => {
    expect(consumePendingReferral()).toBeNull();
  });

  it("returns and clears the pending referral in one step", () => {
    localStorage.setItem(PENDING_REFERRAL_KEY, "iris");

    expect(consumePendingReferral()).toBe("iris");
    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBeNull();
  });

  it("is idempotent -- a second call finds nothing left to consume", () => {
    localStorage.setItem(PENDING_REFERRAL_KEY, "jack");
    consumePendingReferral();

    expect(consumePendingReferral()).toBeNull();
  });
});

describe("initReferralDeepLinkCapture", () => {
  it("is a no-op on the web (not a native platform) -- never throws, never touches storage", () => {
    expect(() => initReferralDeepLinkCapture()).not.toThrow();
    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBeNull();
  });
});
