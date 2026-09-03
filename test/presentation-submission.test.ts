import { describe, expect, it } from "vitest";
import { validatePresentationSubmission } from "../src/presentation-submission";

function submission(innerFormat: string): string {
  return JSON.stringify({
    id: "submission-state",
    definition_id: "bonds-vp",
    descriptor_map: [{
      id: "cred",
      format: "jwt_vp",
      path: "$",
      path_nested: {
        id: "cred",
        format: innerFormat,
        path: "$.vp.verifiableCredential[0]",
      },
    }],
  });
}

function groupedSubmission(): string {
  return JSON.stringify({
    id: "submission-state",
    definition_id: "mashbean-vp",
    descriptor_map: ["carrier_1", "carrier_4"].map((id, index) => ({
      id,
      format: "jwt_vp",
      path: "$",
      path_nested: { id, format: "jwt_vc", path: `$.vp.verifiableCredential[${index}]` },
    })),
  });
}

describe("presentation_submission", () => {
  it("accepts the government-wallet compatibility mapping", () => {
    expect(validatePresentationSubmission(submission("jwt_vc"), "government")).toBeNull();
  });

  it("accepts the explicitly named self-issued envelope", () => {
    expect(validatePresentationSubmission(submission("vc+moica"), "selfIssued")).toBeNull();
  });

  it("does not let a session change credential family through the map", () => {
    expect(validatePresentationSubmission(submission("jwt_vc"), "selfIssued")).toMatch(/does not match/);
  });

  it("fails closed when the map is absent or malformed", () => {
    expect(validatePresentationSubmission("", "government")).toMatch(/missing/);
    expect(validatePresentationSubmission("{}", "government")).toMatch(/definition_id/);
  });

  it("accepts the official grouped telecom mapping", () => {
    expect(validatePresentationSubmission(
      groupedSubmission(), "government", "mashbean-vp",
      ["carrier_1", "carrier_2", "carrier_3", "carrier_4", "carrier_5", "carrier_6"], 2,
    )).toBeNull();
  });

  it("rejects duplicate grouped mappings", () => {
    const duplicate = groupedSubmission().replaceAll("carrier_4", "carrier_1");
    expect(validatePresentationSubmission(
      duplicate, "government", "mashbean-vp", ["carrier_1", "carrier_4"], 2,
    )).toMatch(/does not match/);
  });
});
