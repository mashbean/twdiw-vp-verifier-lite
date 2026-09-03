import type { CredentialSource } from "./profiles";

export interface RequestSession {
  clientId: string;
  responseUri: string;
  nonce: string;
  state: string;
  credentialSource: CredentialSource;
  requestedClaims: string[];
  credentialType?: string;
}

/** Build the signed request payload consumed by TWDIW-compatible wallets. */
export function buildRequestPayload(session: RequestSession): Record<string, unknown> {
  const selfIssued = session.credentialSource === "selfIssued";
  return {
    client_id: session.clientId,
    response_type: "vp_token",
    response_mode: "direct_post",
    response_uri: session.responseUri,
    nonce: session.nonce,
    state: session.state,
    presentation_definition: {
      id: "mashbean-vp",
      input_descriptors: [{
        id: "credential",
        format: selfIssued
          ? { "vc+moica": { alg: ["RS256", "ES256"] } }
          : { "vc+sd-jwt": { "sd-jwt_alg_values": ["ES256"], "kb-jwt_alg_values": ["ES256"] } },
        constraints: {
          fields: [
            ...(session.credentialType
              ? [{ path: ["$.type"], filter: { type: "array", contains: { const: session.credentialType } } }]
              : []),
            ...session.requestedClaims.map((claim) => ({ path: [`$.credentialSubject.${claim}`] })),
          ],
        },
      }],
    },
    // OID4VP 1.0 Final uses DCQL. Keeping it beside Presentation Exchange is a
    // deliberate TWDIW compatibility profile: current Taiwan wallets consume
    // the definition while newer wallets can inspect the equivalent query.
    ...(selfIssued ? {} : {
      dcql_query: {
        credentials: [{
          id: "credential",
          format: "dc+sd-jwt",
          ...(session.credentialType ? { meta: { vct_values: [session.credentialType] } } : {}),
          claims: session.requestedClaims.map((claim) => ({ path: ["vc", "credentialSubject", claim] })),
        }],
      },
    }),
  };
}
