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
    walletFamily: "twdiw",
    requestedClaims: variant.claims,
    credentialType: variant.credentialType,
    credentialAlternatives: variant.credentialAlternatives,
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

  it("asks the driver card for license_type without adding DCQL to the official-wallet request", () => {
    const request = requestFor("driving-entitlement", "government");
    expect(request.presentation_definition.input_descriptors).toHaveLength(2);
    expect(request.presentation_definition.input_descriptors[0].constraints.fields).toEqual([
      { path: ["$.type"], filter: { type: "array", contains: { const: "2-16-886-101-20003-20008-20082_driverlicense_car_1211" } } },
      { path: ["$.credentialSubject.license_type"] },
    ]);
    expect(request.dcql_query).toBeUndefined();
  });

  it("gives the official name check concrete telecom and driving-card alternatives", () => {
    const request = requestFor("identity-name", "government");
    expect(request.presentation_definition.input_descriptors).toHaveLength(5);
    expect(request.presentation_definition.input_descriptors.map((descriptor: any) =>
      descriptor.constraints.fields[0].filter.contains.const)).toEqual([
      "96979933_name_phonel5_phonel3",
      "97179430_fet_vc_prod",
      "97176270_twmdiwvc_postpaid",
      "2-16-886-101-20003-20008-20082_driverlicense_car_1211",
      "00000000_demo_drivinglicense_202504251418",
    ]);
    expect(request.presentation_definition.input_descriptors.every((descriptor: any) =>
      descriptor.constraints.fields[1].path[0] === "$.credentialSubject.name")).toBe(true);
  });

  it("keeps the newer DCQL query on the Bonds compatibility path", () => {
    const profile = getProfile("driving-entitlement")!;
    const variant = getVariant(profile, "government", "bonds")!;
    const request = buildRequestPayload({
      clientId: "did:key:zVerifier",
      responseUri: "https://verifier.example/response",
      nonce: "nonce",
      state: "state",
      credentialSource: "government",
      walletFamily: "bonds",
      requestedClaims: variant.claims,
    }) as any;
    expect(request.dcql_query.credentials[0].claims).toEqual([
      { path: ["vc", "credentialSubject", "license_type"] },
    ]);
  });

  it("uses the official two-group, three-carrier telecom request shape", () => {
    const request = requestFor("telecom-pickup", "government");
    expect(request.presentation_definition.submission_requirements).toEqual([
      { name: "姓名", rule: "pick", max: 1, from: "Group_1" },
      { name: "末五碼", rule: "pick", max: 1, from: "Group_2" },
    ]);
    expect(request.presentation_definition.input_descriptors).toHaveLength(6);
    expect(request.presentation_definition.input_descriptors[0]).toMatchObject({
      id: "96979933_name_phonel5_phonel3_1",
      group: ["Group_1"],
      constraints: {
        limit_disclosure: "required",
        fields: [
          { path: ["$.type"], filter: { type: "array", contains: { const: "96979933_name_phonel5_phonel3" } } },
          { path: ["$.credentialSubject.name"] },
        ],
      },
    });
    expect(request.presentation_definition.input_descriptors[5]).toMatchObject({
      id: "97176270_twmdiwvc_postpaid_6",
      group: ["Group_2"],
      constraints: { fields: [
        { path: ["$.type"], filter: { type: "array", contains: { const: "97176270_twmdiwvc_postpaid" } } },
        { path: ["$.credentialSubject.phonel5"] },
      ] },
    });
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
