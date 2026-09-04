// One short-lived zero-knowledge age-proof session. The page shows the request
// JSON as a QR, the 有備而來 wallet builds the proof pair on the phone and posts
// the package to this Worker; this object validates the statement, resolves
// issuer trust, forwards the proofs to the native verifier and publishes the
// verdict once over the same one-time result channel PresentationSession uses.
//
// Storage holds only the nonce, the statement and the result capability. The
// proofs pass through request memory, are never written here and never logged.

import { DurableObject } from "cloudflare:workers";
import { isAuthorizedResultSocket, parseResultSubscription, resultKeysEqual } from "./result-channel";
import { ZKP_CONTAINER_ORIGIN, zkpContainerFetcher } from "./zkp-container";
import { resolveGovernmentIssuerTrust, type IssuerTrustEvidence } from "./trust";
import {
  appResultOf,
  buildNativeRequest,
  buildRequestJson,
  cutoffDateFor,
  issuerP256Coordinates,
  NATIVE_UNAVAILABLE_REASON,
  parseProofPackage,
  randomNonce,
  randomServiceId,
  REQUEST_GRACE_MS,
  REQUEST_LIFETIME_MS,
  validateProofPackage,
  verifyWithNativeService,
  type ZkpAppResult,
  type ZkpClaimFormat,
  type ZkpCredentialSource,
  type ZkpPageResult,
  type ZkpStatement,
  type ZkpTimingMs,
  chooseZkpBackend,
} from "./zkp-statement";

interface ZkpSessionState {
  nonce: string;
  serviceId: string;
  resultKey: string;
  credentialSource: ZkpCredentialSource;
  minimumAge: number;
  cutoffDate: string;
  purpose: string;
  responseUrl: string;
  createdAt: number;
}

export interface ZkpSessionInit {
  resultKey: string;
  credentialSource: ZkpCredentialSource;
  minimumAge: number;
  purpose: string;
  responseUrl: string;
}

export interface ZkpSessionCreated {
  /** The exact string the QR carries and the wallet decodes. */
  request: string;
  cutoffDate: string;
  minimumAge: number;
  credentialSource: ZkpCredentialSource;
  purpose: string;
  createdAt: number;
  expiresAt: number;
  lifetimeMs: number;
}

export type ZkpSubmitOutcome =
  | { httpStatus: 200 | 400 | 502; body: ZkpAppResult }
  | { httpStatus: 404; body: { status: "gone"; reason: string } };

const MAX_RESULT_SOCKETS = 4;

export class ZkpSession extends DurableObject<Env> {
  private async load(): Promise<ZkpSessionState | undefined> {
    return this.ctx.storage.get<ZkpSessionState>("session");
  }

  private async put(session: ZkpSessionState): Promise<void> {
    await this.ctx.storage.put("session", session);
  }

  async init(input: ZkpSessionInit): Promise<ZkpSessionCreated> {
    const createdAt = Date.now();
    const session: ZkpSessionState = {
      nonce: randomNonce(),
      serviceId: randomServiceId(),
      resultKey: input.resultKey,
      credentialSource: input.credentialSource,
      minimumAge: input.minimumAge,
      cutoffDate: cutoffDateFor(createdAt, input.minimumAge),
      purpose: input.purpose,
      responseUrl: input.responseUrl,
      createdAt,
    };
    await this.put(session);
    // The wallet refuses the request after REQUEST_LIFETIME_MS; keep the session
    // one clock-skew window longer so a proof that took a while still lands.
    await this.ctx.storage.setAlarm(createdAt + REQUEST_LIFETIME_MS + REQUEST_GRACE_MS);
    return {
      request: buildRequestJson({
        minimumAge: session.minimumAge,
        serviceId: session.serviceId,
        nonce: session.nonce,
        cutoffDate: session.cutoffDate,
        purpose: session.purpose,
        source: session.credentialSource,
        createdAtSeconds: Math.floor(createdAt / 1000),
        responseUrl: session.responseUrl,
      }),
      cutoffDate: session.cutoffDate,
      minimumAge: session.minimumAge,
      credentialSource: session.credentialSource,
      purpose: session.purpose,
      createdAt,
      expiresAt: createdAt + REQUEST_LIFETIME_MS,
      lifetimeMs: REQUEST_LIFETIME_MS,
    };
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

  private async publish(result: ZkpPageResult): Promise<void> {
    const serialized = JSON.stringify(result);
    for (const socket of this.ctx.getWebSockets()) {
      if (!isAuthorizedResultSocket(socket) || socket.readyState !== WebSocket.OPEN) continue;
      socket.send(serialized);
      socket.close(1000, "verification complete");
    }
    // Deliberately remove the nonce, statement and capability immediately. The
    // proofs and the issuer DID were never written here.
    await this.ctx.storage.deleteAll();
  }

  private async fail(
    session: ZkpSessionState,
    reason: string,
    timingMs: ZkpTimingMs,
    extras: Partial<ZkpPageResult> = {},
    httpStatus: 400 | 502 = 400,
  ): Promise<ZkpSubmitOutcome> {
    const result: ZkpPageResult = {
      ...extras,
      status: "failed",
      accepted: false,
      reason,
      minimumAge: session.minimumAge,
      credentialSource: session.credentialSource,
      timingMs,
    };
    await this.publish(result);
    return { httpStatus, body: appResultOf(result) };
  }

  async submit(raw: string): Promise<ZkpSubmitOutcome> {
    const startedAt = performance.now();
    const session = await this.load();
    if (!session) return { httpStatus: 404, body: { status: "gone", reason: "session expired" } };
    const transport = Math.max(0, Date.now() - session.createdAt);
    const statement: ZkpStatement = {
      nonce: session.nonce,
      source: session.credentialSource,
      cutoffDate: session.cutoffDate,
      minimumAge: session.minimumAge,
    };
    const timing = (known: Partial<ZkpTimingMs>): ZkpTimingMs => ({
      holderPrepare: 0,
      holderShow: 0,
      transport,
      verify: 0,
      nativeLoad: 0,
      ...known,
      total: Math.round(performance.now() - startedAt),
    });

    const parsed = parseProofPackage(raw);
    if (!parsed.ok) return this.fail(session, parsed.reason, timing({}));
    const pkg = parsed.pkg;
    const holder = { holderPrepare: pkg.prepareMilliseconds, holderShow: pkg.showMilliseconds };
    const mismatch = validateProofPackage(pkg, statement);
    if (mismatch) return this.fail(session, mismatch, timing(holder));
    // From here on the package's statement copies equal the session's; only the
    // session's values are forwarded.
    const statementExtras: Partial<ZkpPageResult> = {
      claimName: pkg.claimName,
      claimFormat: pkg.claimFormat as ZkpClaimFormat,
      cutoffDate: session.cutoffDate,
    };

    const issuerKey = issuerP256Coordinates(pkg.issuerDID);
    if (!issuerKey) return this.fail(session, "發卡者 did:key 無法解析為 P-256 公鑰", timing(holder), statementExtras);

    let trust: IssuerTrustEvidence | undefined;
    let trustMs = 0;
    if (session.credentialSource === "government") {
      const trustStarted = performance.now();
      trust = await resolveGovernmentIssuerTrust(pkg.issuerDID, {
        officialRegistryURL: this.env.OFFICIAL_TRUST_REGISTRY_URL,
      });
      trustMs = Math.round(performance.now() - trustStarted);
      if (!trust.trusted) {
        return this.fail(
          session,
          trust.reason ?? "government credential issuer is not trusted",
          timing(holder),
          { ...statementExtras, trust, trustMs },
        );
      }
    }
    const evidence: Partial<ZkpPageResult> = { ...statementExtras, trust, trustMs };

    const nativeBody = buildNativeRequest(pkg, statement, issuerKey);
    if (!nativeBody) return this.fail(session, "截止日期無法以該欄位格式表示", timing(holder), evidence);
    // Two backends, one contract. `ZKP_VERIFIER_URL` is the override: a laptop
    // behind a tunnel, which is how a new circuit or a suspected mismatch gets
    // debugged with the service's own log in front of you. With no override the
    // container beside this Worker answers, and nothing leaves Cloudflare.
    const containerFetcher = chooseZkpBackend(this.env) === "container" ? zkpContainerFetcher(this.env) : undefined;
    const outcome = await verifyWithNativeService(nativeBody, {
      baseUrl: containerFetcher ? ZKP_CONTAINER_ORIGIN : this.env.ZKP_VERIFIER_URL,
      token: this.env.ZKP_VERIFIER_TOKEN,
      fetcher: containerFetcher,
    });
    if (outcome.kind === "unavailable") {
      return this.fail(session, NATIVE_UNAVAILABLE_REASON, timing(holder), evidence, 502);
    }
    if (outcome.kind === "refused") return this.fail(session, outcome.reason, timing(holder), evidence);

    const verdict = outcome.verdict;
    const result: ZkpPageResult = {
      ...evidence,
      status: verdict.accepted ? "verified" : "failed",
      accepted: verdict.accepted,
      minimumAge: session.minimumAge,
      credentialSource: session.credentialSource,
      timingMs: timing({ ...holder, verify: verdict.verifyMs, nativeLoad: verdict.loadMs }),
      cutoff: nativeBody.cutoff,
      proofBytes: { prepare: verdict.prepareProofBytes, show: verdict.showProofBytes },
      assetRelease: verdict.assetRelease,
    };
    if (!verdict.accepted) {
      result.reason = verdict.reason ? `零知識證明未通過驗證：${verdict.reason}` : "零知識證明未通過驗證";
    }
    await this.publish(result);
    return { httpStatus: verdict.accepted ? 200 : 400, body: appResultOf(result) };
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
