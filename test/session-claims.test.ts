import { describe, expect, it } from "vitest";
import { requestedClaimNames } from "../src/session";

describe("verifier scenario claims", () => {
  it("lets a government telecom card answer the general scenario", () => {
    expect(requestedClaimNames("government", "general")).toEqual(["name"]);
  });

  it("keeps government age verification birthday-only", () => {
    expect(requestedClaimNames("government", "age")).toEqual(["roc_birthday"]);
  });

  it("uses the self-issued national ID claim names", () => {
    expect(requestedClaimNames("selfIssued", "general")).toEqual(["name", "birthdate"]);
    expect(requestedClaimNames("selfIssued", "age")).toEqual(["birthdate"]);
  });
});
