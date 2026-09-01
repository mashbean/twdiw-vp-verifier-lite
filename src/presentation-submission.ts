// The Presentation Exchange map is not decoration: it states which requested
// descriptor the vp_token answers and where the credential is located. Keep the
// accepted shape deliberately narrow because this verifier issues exactly one
// descriptor and one credential per session.

interface DescriptorMap {
  id?: unknown;
  format?: unknown;
  path?: unknown;
  path_nested?: {
    id?: unknown;
    format?: unknown;
    path?: unknown;
  };
}

interface Submission {
  definition_id?: unknown;
  descriptor_map?: unknown;
}

export function validatePresentationSubmission(
  serialized: string,
  credentialSource: "government" | "selfIssued",
): string | null {
  if (!serialized) return "presentation_submission is missing";

  let submission: Submission;
  try {
    submission = JSON.parse(serialized) as Submission;
  } catch {
    return "presentation_submission is not JSON";
  }
  if (submission.definition_id !== "bonds-vp") {
    return "presentation_submission definition_id mismatch";
  }
  if (!Array.isArray(submission.descriptor_map) || submission.descriptor_map.length !== 1) {
    return "presentation_submission must map exactly one credential";
  }

  const descriptor = submission.descriptor_map[0] as DescriptorMap;
  const nested = descriptor.path_nested;
  const expectedInnerFormat = credentialSource === "selfIssued" ? "vc+moica" : "jwt_vc";
  if (descriptor.id !== "cred"
      || descriptor.format !== "jwt_vp"
      || descriptor.path !== "$"
      || nested?.id !== "cred"
      || nested.format !== expectedInnerFormat
      || nested.path !== "$.vp.verifiableCredential[0]") {
    return "presentation_submission descriptor map does not match this request";
  }
  return null;
}
