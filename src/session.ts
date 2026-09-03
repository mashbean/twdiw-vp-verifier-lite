// One short-lived OpenID4VP presentation session. The request and response
// travel over HTTP, while the Worker's calls into this Durable Object use RPC.

import { DurableObject } from "cloudflare:workers";
import { verifySdJwtVc } from "./verify";
import { verifyModaVpToken } from "./moda";
import { verifyMoicaVpToken } from "./moica";
import { validatePresentationSubmission } from "./presentation-submission";
import {
  claimLabel,
  evaluateProfile,
  getProfile,
  getVariant,
  resolvedCredentialType,
  selectedClaims,
  type CredentialSource,
  type VerificationDecision,
} from "./profiles";
import {
  resolveGovernmentIssuerTrust,
  unverifiedGovernmentIssuer,
  type IssuerTrustEvidence,
} from "./trust";

interface SessionState {
  nonce: string;
  state: string;
  resultKey: string;
  clientId: string;
  responseUri: string;
  profileId: string;
  credentialSource: CredentialSource;
  requestedClaims: string[];
  credentialType?: string;
  status: "pending" | "verified" | "failed";
  reason?: string;
  claims?: Record<string, unknown>;
  decision?: VerificationDecision;
  trust?: IssuerTrustEvidence;
  credentialStatus?: string;
  createdAt: number;
}

export interface SessionInit {
  clientId: string;
  responseUri: string;
  resultKey: string;
  profileId: string;
  credentialSource: CredentialSource;
}

export interface SessionResult {
  status: "pending" | "verified" | "failed" | "gone";
  reason?: string;
  profileId?: string;
  credentialSource?: CredentialSource;
  requestedClaims?: Array<{ name: string; label: string }>;
  credentialType?: string;
  claims?: Record<string, unknown>;
  decision?: VerificationDecision;
  trust?: IssuerTrustEvidence;
  credentialStatus?: string;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_RESPONSE_CHARS = 512_000;
const enc = new TextEncoder();

function b64urlJSON(object: unknown): string {
  let binary = "";
  for (const byte of enc.encode(JSON.stringify(object))) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildRequestPayload(session: Pick<SessionState,
  "clientId" | "responseUri" | "nonce" | "state" | "credentialSource" | "requestedClaims" | "credentialType"
>): Record<string, unknown> {
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
              ? [{ path: ["$.type"], filter: { type: "string", contains: { const: session.credentialType } } }]
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

export class PresentationSession extends DurableObject<Env> {
  private async load(): Promise<SessionState | undefined> {
    return this.ctx.storage.get<SessionState>("session");
  }

  private async put(session: SessionState): Promise<void> {
    await this.ctx.storage.put("session", session);
  }

  async init(input: SessionInit): Promise<{ nonce: string; state: string }> {
    const profile = getProfile(input.profileId);
    const variant = profile && getVariant(profile, input.credentialSource);
    if (!profile || !variant) throw new Error("unsupported profile or credential source");
    const nonce = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const state = crypto.randomUUID();
    await this.put({
      nonce,
      state,
      resultKey: input.resultKey,
      clientId: input.clientId,
      responseUri: input.responseUri,
      profileId: profile.id,
      credentialSource: input.credentialSource,
      requestedClaims: variant.claims,
      credentialType: variant.credentialType,
      status: "pending",
      createdAt: Date.now(),
    });
    await this.ctx.storage.setAlarm(Date.now() + TTL_MS);
    return { nonce, state };
  }

  async requestObject(): Promise<string | null> {
    const session = await this.load();
    if (!session) return null;
    const header = {
      typ: "oauth-authz-req+jwt",
      alg: "ES256",
      kid: `${session.clientId}#${session.clientId.slice("did:key:".length)}`,
    };
    const signingInput = `${b64urlJSON(header)}.${b64urlJSON(buildRequestPayload(session))}`;
    const identity = this.env.IDENTITY.getByName("verifier");
    return `${signingInput}.${await identity.sign(signingInput)}`;
  }

  async submit(serializedForm: string): Promise<{ status: string; reason?: string }> {
    const session = await this.load();
    if (!session) return { status: "gone", reason: "session expired" };
    if (session.status !== "pending") return { status: session.status, reason: session.reason };
    if (serializedForm.length > MAX_RESPONSE_CHARS) {
      session.status = "failed";
      session.reason = "presentation response is too large";
      await this.put(session);
      return { status: "failed", reason: session.reason };
    }

    const form = new URLSearchParams(serializedForm);
    const vpToken = form.get("vp_token") ?? "";
    const submissionError = validatePresentationSubmission(
      form.get("presentation_submission") ?? "",
      session.credentialSource,
      "mashbean-vp",
      "credential",
    );
    if (submissionError) {
      session.status = "failed";
      session.reason = submissionError;
      await this.put(session);
      return { status: "failed", reason: submissionError };
    }
    const postedState = form.get("state");
    if (postedState !== session.state) {
      session.status = "failed";
      session.reason = "state mismatch";
      await this.put(session);
      return { status: "failed", reason: session.reason };
    }
    if (!vpToken) {
      session.status = "failed";
      session.reason = "no vp_token in response";
      await this.put(session);
      return { status: "failed", reason: session.reason };
    }

    let trustedIssuers: string[] = [];
    if (session.credentialSource === "government") {
      const issuer = unverifiedGovernmentIssuer(vpToken);
      if (!issuer) {
        session.status = "failed";
        session.reason = "cannot identify the government credential issuer";
        await this.put(session);
        return { status: "failed", reason: session.reason };
      }
      session.trust = await resolveGovernmentIssuerTrust(issuer, {
        allowlist: this.env.TRUSTED_ISSUERS,
        officialRegistryURL: this.env.OFFICIAL_TRUST_REGISTRY_URL,
      });
      if (!session.trust.trusted) {
        session.status = "failed";
        session.reason = session.trust.reason ?? "government credential issuer is not trusted";
        await this.put(session);
        return { status: "failed", reason: session.reason };
      }
      trustedIssuers = [issuer];
    }

    const result = session.credentialSource === "selfIssued"
      ? await verifyMoicaVpToken(vpToken, { expectedNonce: session.nonce, expectedAudience: session.clientId })
      : vpToken.includes("~")
        ? await verifySdJwtVc(vpToken, { expectedNonce: session.nonce, expectedAudience: session.clientId, trustedIssuers })
        : await verifyModaVpToken(vpToken, { expectedNonce: session.nonce, expectedAudience: session.clientId, trustedIssuers });

    session.status = result.ok ? "verified" : "failed";
    session.reason = result.reason;
    session.credentialStatus = result.status;
    const credentialType = resolvedCredentialType(result.claims, result.vct ?? session.credentialType);
    session.credentialType = credentialType;
    if (result.ok) {
      session.claims = selectedClaims(result.claims, session.requestedClaims);
      session.decision = evaluateProfile(
        session.profileId,
        session.credentialSource,
        session.claims,
        credentialType,
        result.status,
      );
    }
    await this.put(session);
    return { status: session.status, reason: session.reason };
  }

  async result(resultKey: string): Promise<SessionResult | null> {
    const session = await this.load();
    if (!session || resultKey.length !== session.resultKey.length
        || !crypto.subtle.timingSafeEqual(enc.encode(resultKey), enc.encode(session.resultKey))) return null;
    return {
      status: session.status,
      reason: session.reason,
      profileId: session.profileId,
      credentialSource: session.credentialSource,
      requestedClaims: session.requestedClaims.map((name) => ({ name, label: claimLabel(name) })),
      credentialType: session.credentialType,
      claims: session.status === "verified" ? session.claims : undefined,
      decision: session.status === "verified" ? session.decision : undefined,
      trust: session.trust,
      credentialStatus: session.credentialStatus,
    };
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
