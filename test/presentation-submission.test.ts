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
});
