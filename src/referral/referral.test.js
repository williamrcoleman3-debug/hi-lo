import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock("@capacitor/app", () => ({
  App: { addListener: vi.fn() },
}));
vi.mock("../supabase/client.js", () => ({
  supabase: { auth: { exchangeCodeForSession: vi.fn(() => Promise.resolve({ error: null })) } },
}));

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "../supabase/client.js";
import {
  capturePendingReferral,
  consumePendingReferral,
  EMAIL_LINK_CONFIRMED_EVENT,
  initReferralDeepLinkCapture,
  isAuthCallbackUrl,
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

describe("isAuthCallbackUrl", () => {
  it("recognizes implicit-flow magic-link hash tokens", () => {
    expect(
      isAuthCallbackUrl("https://hi-lo-game.com/#access_token=abc&refresh_token=def&type=magiclink")
    ).toBe(true);
  });

  it("recognizes an expired/invalid magic-link hash error", () => {
    expect(
      isAuthCallbackUrl("https://hi-lo-game.com/#error=access_denied&error_description=Email+link+is+invalid")
    ).toBe(true);
  });

  it("recognizes a PKCE-style code query param", () => {
    expect(isAuthCallbackUrl("https://hi-lo-game.com/?code=abc123")).toBe(true);
  });

  it("recognizes a token_hash query param", () => {
    expect(isAuthCallbackUrl("https://hi-lo-game.com/?token_hash=abc123&type=magiclink")).toBe(true);
  });

  it("does not treat a referral link as an auth callback", () => {
    expect(isAuthCallbackUrl("https://hi-lo-game.com/?ref=alice")).toBe(false);
  });

  it("does not treat a plain URL as an auth callback", () => {
    expect(isAuthCallbackUrl("https://hi-lo-game.com/")).toBe(false);
  });

  it("returns false for an unparseable URL instead of throwing", () => {
    expect(() => isAuthCallbackUrl("not a url")).not.toThrow();
    expect(isAuthCallbackUrl("not a url")).toBe(false);
  });
});

describe("initReferralDeepLinkCapture -- native platform", () => {
  beforeEach(() => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    App.addListener.mockClear();
    supabase.auth.exchangeCodeForSession.mockClear();
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    Capacitor.isNativePlatform.mockReturnValue(false);
  });

  function getRegisteredHandler() {
    initReferralDeepLinkCapture();
    expect(App.addListener).toHaveBeenCalledWith("appUrlOpen", expect.any(Function));
    return App.addListener.mock.calls[0][1];
  }

  it("registers an appUrlOpen listener when running natively", () => {
    initReferralDeepLinkCapture();
    expect(App.addListener).toHaveBeenCalledWith("appUrlOpen", expect.any(Function));
  });

  it("captures the ref param for a referral-only link, without dispatching the confirm event", () => {
    const handler = getRegisteredHandler();
    const listener = vi.fn();
    window.addEventListener(EMAIL_LINK_CONFIRMED_EVENT, listener);

    handler({ url: "https://hi-lo-game.com/?ref=alice" });

    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBe("alice");
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(EMAIL_LINK_CONFIRMED_EVENT, listener);
  });

  it("dispatches the confirm event for a hash-token auth-callback link, leaving any pending referral untouched and never navigating", () => {
    localStorage.setItem(PENDING_REFERRAL_KEY, "bob");
    const handler = getRegisteredHandler();
    const listener = vi.fn();
    window.addEventListener(EMAIL_LINK_CONFIRMED_EVENT, listener);
    const originalHref = window.location.href;

    handler({ url: "https://hi-lo-game.com/#access_token=abc&type=magiclink" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_REFERRAL_KEY)).toBe("bob");
    expect(window.location.href).toBe(originalHref);
    window.removeEventListener(EMAIL_LINK_CONFIRMED_EVENT, listener);
  });

  it("exchanges a PKCE code for a session on a code-bearing auth-callback link, then dispatches the confirm event", async () => {
    const handler = getRegisteredHandler();
    const listener = vi.fn();
    window.addEventListener(EMAIL_LINK_CONFIRMED_EVENT, listener);

    handler({ url: "https://hi-lo-game.com/?code=abc123" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(EMAIL_LINK_CONFIRMED_EVENT, listener);
  });

  it("still dispatches the confirm event even if the code exchange fails, without throwing", async () => {
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });
    const handler = getRegisteredHandler();
    const listener = vi.fn();
    window.addEventListener(EMAIL_LINK_CONFIRMED_EVENT, listener);

    expect(() => handler({ url: "https://hi-lo-game.com/?code=stale" })).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(EMAIL_LINK_CONFIRMED_EVENT, listener);
  });
});
