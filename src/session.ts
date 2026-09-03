// One short-lived OpenID4VP presentation session. The request and response
// travel over HTTP, while the Worker's calls into this Durable Object use RPC.

import { DurableObject } from "cloudflare:workers";
import { verifySdJwtVc } from "./verify";
import { verifyModaVpToken } from "./moda";
import { verifyMoicaVpToken } from "./moica";
import { presentationDescriptorIds, validatePresentationSubmission } from "./presentation-submission";
import {
  claimLabel,
  credentialDeclaresType,
  evaluateProfile,
  getProfile,
  getVariant,
  resolvedCredentialType,
  selectedClaims,
  type CredentialSource,
  type WalletFamily,
  type VerificationDecision,
} from "./profiles";
import { buildRequestPayload, expectedDescriptorIds } from "./request";
import { isAuthorizedResultSocket, parseResultSubscription, resultKeysEqual } from "./result-channel";
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
  /** Optional only so sessions opened immediately before a deployment can finish. */
  walletFamily?: WalletFamily;
  credentialSource: CredentialSource;
  requestedClaims: string[];
  credentialType?: string;
  credentialAlternatives?: import("./profiles").CredentialAlternative[];
  profileLabel?: string;
  resultQuestion?: string;
  createdAt: number;
}

export interface SessionInit {
  clientId: string;
  responseUri: string;
  resultKey: string;
  profileId: string;
  walletFamily: WalletFamily;
  credentialSource: CredentialSource;
}

export interface SessionResult {
  status: "pending" | "verified" | "failed" | "gone";
  reason?: string;
  profileId?: string;
  walletFamily?: WalletFamily;
  credentialSource?: CredentialSource;
  requestedClaims?: Array<{ name: string; label: string }>;
  credentialType?: string;
  claims?: Record<string, unknown>;
  decision?: VerificationDecision;
  trust?: IssuerTrustEvidence;
  credentialStatus?: string;
  credentialStatusReason?: string;
  timingMs?: { trust: number; credential: number; total: number };
}

const TTL_MS = 10 * 60 * 1000;
const MAX_RESPONSE_CHARS = 512_000;
const enc = new TextEncoder();
const MAX_RESULT_SOCKETS = 4;

function walletFor(session: SessionState): WalletFamily {
  return session.walletFamily ?? (session.credentialSource === "selfIssued" ? "bonds" : "twdiw");
}

function b64urlJSON(object: unknown): string {
  let binary = "";
  for (const byte of enc.encode(JSON.stringify(object))) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
    const variant = profile && getVariant(profile, input.credentialSource, input.walletFamily);
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
      walletFamily: input.walletFamily,
      credentialSource: input.credentialSource,
      requestedClaims: variant.claims,
      credentialType: variant.credentialType,
      credentialAlternatives: variant.credentialAlternatives,
      profileLabel: profile.label,
      resultQuestion: profile.resultQuestion,
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
    const signingInput = `${b64urlJSON(header)}.${b64urlJSON(buildRequestPayload({
      ...session,
      purpose: {
        client: "請出示皮夾",
        termsUri: `${new URL(session.responseUri).origin}/#privacy-notice-title`,
        scenario: session.profileLabel ?? "數位憑證查驗",
        purpose: session.resultQuestion ?? "一次性數位憑證查驗",
      },
      expiresAtEpochSeconds: Math.floor((session.createdAt + TTL_MS) / 1000),
    }))}`;
    const identity = this.env.IDENTITY.getByName("verifier");
    return `${signingInput}.${await identity.sign(signingInput)}`;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    if (!await this.load()) return new Response("gone", { status: 404 });
    if (this.ctx.getWebSockets().length >= MAX_RESULT_SOCKETS) {
      return new Response("too many result subscribers", { status: 429 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    server.serializeAttachment({ authorized: false });
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
      socket.close(1003, "text messages only");
      return;
    }
    const subscription = parseResultSubscription(message);
    const session = await this.load();
    if (!subscription || !session || !resultKeysEqual(subscription.resultKey, session.resultKey)) {
      socket.close(1008, "invalid result capability");
      return;
    }
    socket.serializeAttachment({ authorized: true });
    socket.send(JSON.stringify({ status: "ready" }));
  }

  private async publish(result: SessionResult): Promise<void> {
    const serialized = JSON.stringify(result);
    for (const socket of this.ctx.getWebSockets()) {
      if (!isAuthorizedResultSocket(socket) || socket.readyState !== WebSocket.OPEN) continue;
      socket.send(serialized);
      socket.close(1000, "verification complete");
    }
    // Deliberately remove the nonce, capability and request metadata immediately.
    // Disclosed claims and the presentation response were never written here.
    await this.ctx.storage.deleteAll();
  }

  private async fail(session: SessionState, reason: string, startedAt: number): Promise<{ status: string; reason: string }> {
    await this.publish({
      status: "failed",
      reason,
      profileId: session.profileId,
      walletFamily: walletFor(session),
      credentialSource: session.credentialSource,
      timingMs: { trust: 0, credential: 0, total: Math.round(performance.now() - startedAt) },
    });
    return { status: "failed", reason };
  }

  async submit(serializedForm: string): Promise<{ status: string; reason?: string }> {
    const startedAt = performance.now();
    const session = await this.load();
    if (!session) return { status: "gone", reason: "session expired" };
    if (serializedForm.length > MAX_RESPONSE_CHARS) {
      return this.fail(session, "presentation response is too large", startedAt);
    }

    const form = new URLSearchParams(serializedForm);
    const vpToken = form.get("vp_token") ?? "";
    const serializedSubmission = form.get("presentation_submission") ?? "";
    const allowedDescriptorIds = expectedDescriptorIds(session);
    const expectedDescriptorCount = session.credentialAlternatives?.length
      ? session.requestedClaims.length
      : 1;
    const submissionError = validatePresentationSubmission(
      serializedSubmission,
      session.credentialSource,
      "mashbean-vp",
      allowedDescriptorIds,
      expectedDescriptorCount,
    );
    if (submissionError) {
      return this.fail(session, submissionError, startedAt);
    }
    const postedState = form.get("state");
    if (postedState !== session.state) {
      return this.fail(session, "state mismatch", startedAt);
    }
    if (!vpToken) {
      return this.fail(session, "no vp_token in response", startedAt);
    }

    let trustedIssuers: string[] = [];
    let trust: IssuerTrustEvidence | undefined;
    let trustMs = 0;
    if (session.credentialSource === "government") {
      const issuer = unverifiedGovernmentIssuer(vpToken);
      if (!issuer) {
        return this.fail(session, "cannot identify the government credential issuer", startedAt);
      }
      const trustStarted = performance.now();
      trust = await resolveGovernmentIssuerTrust(issuer, {
        officialRegistryURL: this.env.OFFICIAL_TRUST_REGISTRY_URL,
      });
      trustMs = Math.round(performance.now() - trustStarted);
      if (!trust.trusted) {
        return this.fail(session, trust.reason ?? "government credential issuer is not trusted", startedAt);
      }
      trustedIssuers = [issuer];
    }

    const credentialStarted = performance.now();
    const result = session.credentialSource === "selfIssued"
      ? await verifyMoicaVpToken(vpToken, { expectedNonce: session.nonce, expectedAudience: session.clientId })
      : vpToken.includes("~")
        ? await verifySdJwtVc(vpToken, { expectedNonce: session.nonce, expectedAudience: session.clientId, trustedIssuers })
        : await verifyModaVpToken(vpToken, { expectedNonce: session.nonce, expectedAudience: session.clientId, trustedIssuers });
    const credentialMs = Math.round(performance.now() - credentialStarted);
    let credentialType = resolvedCredentialType(result.claims, result.vct ?? session.credentialType);
    if (!result.ok) {
      return this.fail(session, result.reason ?? "credential verification failed", startedAt);
    }
    if (session.credentialAlternatives?.length) {
      const descriptorIds = presentationDescriptorIds(serializedSubmission);
      const alternative = session.credentialAlternatives.find((candidate) =>
        descriptorIds.every((id) => id.startsWith(`${candidate.credentialType}_`)));
      if (!alternative || !credentialDeclaresType(result.claims, alternative.credentialType)) {
        return this.fail(session, "presentation descriptor does not match the presented credential type", startedAt);
      }
      credentialType = alternative.credentialType;
    }
    const claims = selectedClaims(result.claims, session.requestedClaims);
    const decision = evaluateProfile(
      session.profileId,
      session.credentialSource,
      claims,
      credentialType,
      result.status,
    );
    await this.publish({
      status: "verified",
      profileId: session.profileId,
      walletFamily: walletFor(session),
      credentialSource: session.credentialSource,
      requestedClaims: session.requestedClaims.map((name) => ({ name, label: claimLabel(name) })),
      credentialType,
      claims,
      decision,
      trust,
      credentialStatus: result.status,
      credentialStatusReason: result.statusReason,
      timingMs: {
        trust: trustMs,
        credential: credentialMs,
        total: Math.round(performance.now() - startedAt),
      },
    });
    return { status: "verified" };
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
