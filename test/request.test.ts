import { describe, expect, it } from "vitest";
import { getProfile, getVariant, type CredentialSource } from "../src/profiles";
import { buildRequestPayload } from "../src/request";

const KNOWN_CARD_SCHEMAS = {
  driver: new Set([
    "name",
    "id_number",
    "address",
    "license_type",
    "license_conditions",
    "driver_effect_date",
    "issued_date",
  ]),
  telecom: new Set(["name", "phonel3", "phonel5"]),
  selfIssuedNationalId: new Set([
    "name",
    "birthdate",
    "unifiedNo",
    "nationality",
    "over18AtIssuance",
  ]),
};

function requestFor(profileId: string, source: CredentialSource) {
  const profile = getProfile(profileId)!;
  const variant = getVariant(profile, source)!;
  return buildRequestPayload({
    clientId: "did:key:zVerifier",
    responseUri: "https://verifier.example/response",
    nonce: "nonce",
    state: "state",
    credentialSource: source,
    requestedClaims: variant.claims,
    credentialType: variant.credentialType,
  }) as any;
}

describe("known 有備而來 card compatibility", () => {
  it("does not advertise an adult government-card path without a matching measured claim", () => {
    expect(getVariant(getProfile("adult-18")!, "government")).toBeUndefined();
    expect(getVariant(getProfile("adult-18")!, "selfIssued")?.claims.every((claim) =>
      KNOWN_CARD_SCHEMAS.selfIssuedNationalId.has(claim))).toBe(true);
  });

  it("keeps every government profile within a measured card schema", () => {
    const compatibleSchema = {
      "identity-name": KNOWN_CARD_SCHEMAS.driver,
      "telecom-pickup": KNOWN_CARD_SCHEMAS.telecom,
      "driving-entitlement": KNOWN_CARD_SCHEMAS.driver,
      "national-id-number": KNOWN_CARD_SCHEMAS.driver,
    } as const;

    for (const [profileId, schema] of Object.entries(compatibleSchema)) {
      const claims = getVariant(getProfile(profileId)!, "government")!.claims;
      expect(claims.every((claim) => schema.has(claim)), profileId).toBe(true);
    }
  });

  it("asks the driver card for license_type in both request dialects", () => {
    const request = requestFor("driving-entitlement", "government");
    expect(request.presentation_definition.input_descriptors[0].constraints.fields).toEqual([
      { path: ["$.credentialSubject.license_type"] },
    ]);
    expect(request.dcql_query.credentials[0].claims).toEqual([
      { path: ["vc", "credentialSubject", "license_type"] },
    ]);
  });

  it("asks the telecom card only for name and phonel5", () => {
    const request = requestFor("telecom-pickup", "government");
    expect(request.presentation_definition.input_descriptors[0].constraints.fields).toEqual([
      { path: ["$.credentialSubject.name"] },
      { path: ["$.credentialSubject.phonel5"] },
    ]);
  });

  it("uses an array type filter for the self-issued NationalIDCredential", () => {
    const request = requestFor("adult-18", "selfIssued");
    expect(request.presentation_definition.input_descriptors[0].constraints.fields).toEqual([
      { path: ["$.type"], filter: { type: "array", contains: { const: "NationalIDCredential" } } },
      { path: ["$.credentialSubject.over18AtIssuance"] },
    ]);
    expect(request.dcql_query).toBeUndefined();
  });
});
