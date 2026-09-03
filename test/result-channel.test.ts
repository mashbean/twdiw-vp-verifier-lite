import { describe, expect, it } from "vitest";
import { parseResultSubscription, resultKeysEqual } from "../src/result-channel";

describe("one-time result channel", () => {
  const resultKey = "a".repeat(64);

  it("accepts only the small, exact subscription envelope", () => {
    expect(parseResultSubscription(JSON.stringify({ type: "subscribe", resultKey }))).toEqual({
      type: "subscribe",
      resultKey,
    });
    expect(parseResultSubscription(JSON.stringify({ type: "subscribe", resultKey: "short" }))).toBeNull();
    expect(parseResultSubscription("not json")).toBeNull();
    expect(parseResultSubscription("x".repeat(257))).toBeNull();
  });

  it("compares capabilities without early byte exits", () => {
    expect(resultKeysEqual(resultKey, resultKey)).toBe(true);
    expect(resultKeysEqual(resultKey, `${"a".repeat(63)}b`)).toBe(false);
    expect(resultKeysEqual(resultKey, "a")).toBe(false);
  });
});
