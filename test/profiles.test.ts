import { describe, expect, it } from "vitest";
import { evaluateProfile, getProfile, getVariant, selectedClaims } from "../src/profiles";

describe("verification profiles", () => {
  it("asks a telecom card only for the two measured pickup claims", () => {
    const profile = getProfile("telecom-pickup")!;
    expect(getVariant(profile, "government")?.claims).toEqual(["name", "phonel5"]);
    expect(getVariant(profile, "selfIssued")).toBeUndefined();
  });

  it("uses the signed self-issued age predicate instead of disclosing birthdate", () => {
    const profile = getProfile("adult-18")!;
    expect(getVariant(profile, "selfIssued")?.claims).toEqual(["over18AtIssuance"]);
    expect(evaluateProfile("adult-18", "selfIssued", { over18AtIssuance: "true" }, "NationalIDCredential").status).toBe("pass");
  });

  it("does not call a false historical age predicate proof of current minority", () => {
    const decision = evaluateProfile("adult-18", "selfIssued", { over18AtIssuance: "false" }, "NationalIDCredential");
    expect(decision.status).toBe("not-established");
    expect(decision.detail).toMatch(/不應解讀為目前仍未成年/);
  });

  it("recognises the measured Taiwan Mobile production card type", () => {
    const decision = evaluateProfile(
      "telecom-pickup",
      "government",
      { name: "測試者", phonel5: "12345" },
      "97176270_twmdiwvc_postpaid",
    );
    expect(decision.status).toBe("pass");
  });

  it("requires a recognised driving-licence credential type", () => {
    expect(evaluateProfile("driving-entitlement", "government", { type: "普通小型車" }, "2-16-886-101_driverlicense_car", "valid").status).toBe("pass");
    expect(evaluateProfile("driving-entitlement", "government", { type: "普通小型車" }, "student_card", "valid").status).toBe("not-established");
    expect(evaluateProfile("driving-entitlement", "government", { type: "普通小型車" }, "2-16-886-101_driverlicense_car", "unknown").title).toMatch(/無法確認/);
  });

  it("returns only the fields the verifier requested", () => {
    const claims = { iss: "did:key:z…", vc: { credentialSubject: { name: "測試者", id_number: "A123456789" } } };
    expect(selectedClaims(claims, ["name"])).toEqual({ name: "測試者" });
  });
});
