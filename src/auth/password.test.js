import { describe, expect, it } from "vitest";
import { isValidPassword, passwordsMatch, PASSWORD_MIN_LENGTH } from "./password.js";

describe("isValidPassword", () => {
  it("rejects a password shorter than the minimum length", () => {
    expect(isValidPassword("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe(false);
  });

  it("accepts a password exactly at the minimum length", () => {
    expect(isValidPassword("a".repeat(PASSWORD_MIN_LENGTH))).toBe(true);
  });

  it("accepts a password longer than the minimum length", () => {
    expect(isValidPassword("a".repeat(PASSWORD_MIN_LENGTH + 10))).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidPassword("")).toBe(false);
  });

  it("rejects non-string input instead of throwing", () => {
    expect(isValidPassword(undefined)).toBe(false);
    expect(isValidPassword(null)).toBe(false);
    expect(isValidPassword(12345678)).toBe(false);
  });
});

describe("passwordsMatch", () => {
  it("is true for identical passwords", () => {
    expect(passwordsMatch("correct-horse", "correct-horse")).toBe(true);
  });

  it("is false for different passwords", () => {
    expect(passwordsMatch("correct-horse", "wrong-horse")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(passwordsMatch("Password1", "password1")).toBe(false);
  });

  it("treats two empty strings as matching", () => {
    expect(passwordsMatch("", "")).toBe(true);
  });
});
