import { describe, it, expect } from "vitest";
import { parseRocDate, isAtLeastAge, isAdultFromClaims, findClaim } from "../src/age";

// 2026-08-30, as a fixed clock so the tests are deterministic.
const NOW = Date.UTC(2026, 7, 30);

describe("parseRocDate", () => {
  it("parses a 3-digit ROC year (民國57-06-05)", () => {
    expect(parseRocDate("0570605")).toEqual({ year: 1968, month: 6, day: 5 });
  });
  it("parses 民國102-07-01", () => {
    expect(parseRocDate("1020701")).toEqual({ year: 2013, month: 7, day: 1 });
  });
  it("parses a 2-digit ROC year without leading zero", () => {
    expect(parseRocDate("570605")).toEqual({ year: 1968, month: 6, day: 5 });
  });
  it("rejects junk", () => {
    expect(parseRocDate("nope")).toBeNull();
    expect(parseRocDate("")).toBeNull();
    expect(parseRocDate("0571301")).toBeNull(); // month 13
  });
});

describe("isAtLeastAge", () => {
  it("is true for someone born decades ago", () => {
    expect(isAtLeastAge({ year: 1968, month: 6, day: 5 }, 18, NOW)).toBe(true);
  });
  it("is false for a minor", () => {
    expect(isAtLeastAge({ year: 2015, month: 1, day: 1 }, 18, NOW)).toBe(false);
  });
  it("handles the birthday-not-yet-reached edge (turns 18 later this year)", () => {
    // Born 2008-12-31: on 2026-08-30 they are still 17.
    expect(isAtLeastAge({ year: 2008, month: 12, day: 31 }, 18, NOW)).toBe(false);
    // Born 2008-08-30: exactly 18 today.
    expect(isAtLeastAge({ year: 2008, month: 8, day: 30 }, 18, NOW)).toBe(true);
  });
});

describe("findClaim / isAdultFromClaims", () => {
  it("finds roc_birthday nested under vc.credentialSubject (the TWDIW shape)", () => {
    const claims = { iss: "did:key:z…", vc: { credentialSubject: { roc_birthday: "0570605" } } };
    expect(findClaim(claims, "roc_birthday")).toBe("0570605");
    expect(isAdultFromClaims(claims, 18, NOW)).toBe(true);
  });
  it("finds a flat roc_birthday too", () => {
    expect(isAdultFromClaims({ roc_birthday: "1150101" }, 18, NOW)).toBe(false); // 民國115 = 2026
  });
  it("returns null when no birthday was disclosed", () => {
    expect(isAdultFromClaims({ name: "X" }, 18, NOW)).toBeNull();
  });
});
