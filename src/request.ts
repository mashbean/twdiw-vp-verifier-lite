import { claimLabel, type CredentialAlternative, type CredentialSource, type WalletFamily } from "./profiles";

export interface RequestSession {
  clientId: string;
  responseUri: string;
  nonce: string;
  state: string;
  credentialSource: CredentialSource;
  walletFamily?: WalletFamily;
  requestedClaims: string[];
  credentialType?: string;
  credentialAlternatives?: CredentialAlternative[];
  purpose?: {
    client: string;
    termsUri: string;
    scenario: string;
    purpose: string;
  };
  expiresAtEpochSeconds?: number;
}

export function expectedDescriptorIds(session: RequestSession): string[] {
  const alternatives = session.credentialAlternatives ?? [];
  if (!alternatives.length) return ["credential"];
  return session.requestedClaims.flatMap((_, claimIndex) =>
    alternatives.map((alternative, alternativeIndex) =>
      `${alternative.credentialType}_${claimIndex * alternatives.length + alternativeIndex + 1}`));
}

/** Build the signed request payload consumed by TWDIW-compatible wallets. */
export function buildRequestPayload(session: RequestSession): Record<string, unknown> {
  const selfIssued = session.credentialSource === "selfIssued";
  const alternatives = session.credentialAlternatives ?? [];
  const descriptorFormat = selfIssued
    ? { "vc+moica": { alg: ["RS256", "ES256"] } }
    : { "vc+sd-jwt": { "sd-jwt_alg_values": ["ES256"], "kb-jwt_alg_values": ["ES256"] } };
  const inputDescriptors = alternatives.length
    ? session.requestedClaims.flatMap((claim, claimIndex) => alternatives.map((alternative, alternativeIndex) => ({
      id: `${alternative.credentialType}_${claimIndex * alternatives.length + alternativeIndex + 1}`,
      name: JSON.stringify({ org_tw_name: alternative.issuerName, vc_name: alternative.credentialName }),
      group: [`Group_${claimIndex + 1}`],
      constraints: {
        fields: [
          { path: ["$.type"], filter: { type: "array", contains: { const: alternative.credentialType } } },
          { path: [`$.credentialSubject.${claim}`] },
        ],
        limit_disclosure: "required",
      },
    })))
    : [{
      id: "credential",
      format: descriptorFormat,
      constraints: {
        fields: [
          ...(session.credentialType
            ? [{ path: ["$.type"], filter: { type: "array", contains: { const: session.credentialType } } }]
            : []),
          ...session.requestedClaims.map((claim) => ({ path: [`$.credentialSubject.${claim}`] })),
        ],
        limit_disclosure: "required",
      },
    }];
  return {
    client_id: session.clientId,
    iss: session.clientId,
    aud: session.clientId,
    ...(session.expiresAtEpochSeconds ? { exp: session.expiresAtEpochSeconds } : {}),
    response_type: "vp_token",
    response_mode: "direct_post",
    response_uri: session.responseUri,
    nonce: session.nonce,
    state: session.state,
    presentation_definition: {
      id: "mashbean-vp",
      ...(session.purpose ? { purpose: JSON.stringify({
        client: session.purpose.client,
        terms_uri: session.purpose.termsUri,
        scenario: session.purpose.scenario,
        purpose: session.purpose.purpose,
      }) } : {}),
      ...(alternatives.length ? {
        submission_requirements: session.requestedClaims.map((claim, index) => ({
          name: claim === "phonel5" ? "末五碼" : claimLabel(claim),
          rule: "pick",
          max: 1,
          from: `Group_${index + 1}`,
        })),
      } : {}),
      input_descriptors: inputDescriptors,
    },
    client_metadata: {
      vp_formats: {
        jwt_vc: { alg: ["ES256"] },
        jwt_vp: { alg: ["ES256"] },
      },
      response_types: ["vp_token"],
    },
    // OID4VP 1.0 Final uses DCQL. Keeping it beside Presentation Exchange is a
    // deliberate TWDIW compatibility profile: current Taiwan wallets consume
    // the definition while newer wallets can inspect the equivalent query.
    ...(!selfIssued && session.walletFamily !== "twdiw" ? {
      dcql_query: {
        credentials: [{
          id: "credential",
          format: "dc+sd-jwt",
          ...(session.credentialType || alternatives.length ? {
            meta: { vct_values: session.credentialType ? [session.credentialType] : alternatives.map((item) => item.credentialType) },
          } : {}),
          claims: session.requestedClaims.map((claim) => ({ path: ["vc", "credentialSubject", claim] })),
        }],
      },
    } : {}),
  };
}
