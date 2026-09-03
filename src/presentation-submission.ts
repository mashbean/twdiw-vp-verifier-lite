// The Presentation Exchange map is not decoration: it states which requested
// descriptor the vp_token answers and where the credential is located. Keep the
// accepted shape deliberately narrow. Most sessions map one credential; the
// telecom profile maps the same credential twice because the official TWDIW
// request dialect puts name and phone-last-five in separate `pick` groups.

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
  definitionId = "bonds-vp",
  descriptorIds: string | string[] = "cred",
  expectedCount = 1,
): string | null {
  if (!serialized) return "presentation_submission is missing";

  let submission: Submission;
  try {
    submission = JSON.parse(serialized) as Submission;
  } catch {
    return "presentation_submission is not JSON";
  }
  if (submission.definition_id !== definitionId) {
    return "presentation_submission definition_id mismatch";
  }
  if (!Array.isArray(submission.descriptor_map) || submission.descriptor_map.length !== expectedCount) {
    return `presentation_submission must map exactly ${expectedCount} credential${expectedCount === 1 ? "" : "s"}`;
  }

  const allowedIds = new Set(Array.isArray(descriptorIds) ? descriptorIds : [descriptorIds]);
  const seenIds = new Set<string>();
  const expectedInnerFormat = credentialSource === "selfIssued" ? "vc+moica" : "jwt_vc";
  for (const [index, value] of submission.descriptor_map.entries()) {
    const descriptor = value as DescriptorMap;
    const nested = descriptor.path_nested;
    const id = typeof descriptor.id === "string" ? descriptor.id : "";
    if (!allowedIds.has(id) || seenIds.has(id)
        || descriptor.format !== "jwt_vp"
        || descriptor.path !== "$"
        || nested?.id !== id
        || nested.format !== expectedInnerFormat
        || nested.path !== `$.vp.verifiableCredential[${index}]`) {
      return "presentation_submission descriptor map does not match this request";
    }
    seenIds.add(id);
  }
  return null;
}

export function presentationDescriptorIds(serialized: string): string[] {
  try {
    const submission = JSON.parse(serialized) as Submission;
    if (!Array.isArray(submission.descriptor_map)) return [];
    return submission.descriptor_map.flatMap((value) => {
      const id = (value as DescriptorMap).id;
      return typeof id === "string" ? [id] : [];
    });
  } catch {
    return [];
  }
}
