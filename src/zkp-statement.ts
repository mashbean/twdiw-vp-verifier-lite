// Zero-knowledge age-predicate proof: the statement the verifier chooses, the
// request the 有備而來 wallet scans, and the proof package it posts back.
//
// This module is pure — no Cloudflare bindings — so vitest exercises it
// directly; the `ZkpSession` Durable Object in zkp.ts orchestrates it. The wire
// shapes mirror `AgePredicateProofRequest` / `AgePredicateProofPackage` in
// bonds-tw/backupTW-iOS (backupTW/Presentation/AgePredicateProof.swift) and the
// `/verify` contract of native/openac-age-verifier. The verifier never sees a
// birth date: it learns only whether the hidden date is at or before the
// cutoff it asked for.

import { resolveDidKeyToJwk } from "./didkey";
import type { IssuerTrustEvidence } from "./trust";

export type ZkpCredentialSource = "government" | "selfIssued";
export type ZkpSourceLetter = "g" | "s";
export type ZkpClaimFormat = 2 | 3;

/** `AgePredicateProofRequest.lifetime` = `VerifierSession.pendingRequestLifetime`
 *  = `OfflineVerifier.maximumPresentationAge` = 5 minutes. The app refuses a
 *  request older than this, or one minted more than 60 s in the future. */
export const REQUEST_LIFETIME_MS = 5 * 60 * 1000;
/** The session outlives the request by this much so a proof that took a while
 *  to build on the phone still lands. Matches the app's clock-skew tolerance. */
export const REQUEST_GRACE_MS = 60 * 1000;
export const REQUEST_VERSION = 1;
export const PACKAGE_VERSION = 1;
export const DEFAULT_MINIMUM_AGE = 18;
export const MIN_MINIMUM_AGE = 1;
export const MAX_MINIMUM_AGE = 120;
export const DEFAULT_PURPOSE = "年齡門檻查驗（零知識證明測試）";
/** `PresentationRequest.maximumPurposeLength`, counted in characters. */
export const MAX_PURPOSE_CHARS = 100;
/** Upper bound on the posted package text (two ~400 KB proofs base64 fit easily). */
export const MAX_PACKAGE_CHARS = 6_000_000;
/** `AgePredicateProofPackage.maximumArtifactBytes`, decoded bytes per proof. */
export const MAX_PROOF_BYTES = 2_000_000;
export const MAX_ISSUER_DID_BYTES = 300;
export const MAX_CLAIM_NAME_BYTES = 31;
export const NONCE_BYTES = 32;
export const ROC_YEAR_OFFSET = 1911;
export const NATIVE_TIMEOUT_MS = 60_000;
export const NATIVE_UNAVAILABLE_REASON = "驗證後端無法連線";
export const SUPPORTED_CLAIM_NAMES = [
  "roc_birthday",
  "birthdate",
  "birthday",
  "date_of_birth",
  "birth_date",
  "出生日期",
] as const;

export const CLAIM_LABELS: Record<string, string> = {
  roc_birthday: "民國出生日期（roc_birthday）",
  birthdate: "出生日期（birthdate）",
  birthday: "出生日期（birthday）",
  date_of_birth: "出生日期（date_of_birth）",
  birth_date: "出生日期（birth_date）",
  出生日期: "出生日期",
};

export const SOURCE_LABELS: Record<ZkpCredentialSource, string> = {
  government: "政府卡片（TWDIW）",
  selfIssued: "有備而來自發身分證（MyData）",
};

const enc = new TextEncoder();

export function isZkpCredentialSource(value: unknown): value is ZkpCredentialSource {
  return value === "government" || value === "selfIssued";
}

/** `PresentationCredentialSource` raw values: government/TWDIW = "g", selfIssued = "s". */
export function sourceLetter(source: ZkpCredentialSource): ZkpSourceLetter {
  return source === "government" ? "g" : "s";
}

export function isSupportedClaimName(name: string): name is (typeof SUPPORTED_CLAIM_NAMES)[number] {
  return (SUPPORTED_CLAIM_NAMES as readonly string[]).includes(name);
}

// ---------------------------------------------------------------------------
// Which backend checks the proof
//
// Pure, and kept out of zkp-container.ts, because that module imports
// `@cloudflare/containers` and therefore `cloudflare:workers`, which vitest
// cannot load. The same split as the rest of this file.

/** Whether this deployment has a container to verify with. */
export function hasZkpContainer(env: Env): boolean {
  return Boolean(env.ZKP_CONTAINER);
}

export type ZkpBackend = "container" | "external" | "none";

/**
 * Which backend answers, in one place, so the page's `/api/zkp/config`, the
 * readiness check and the session all agree.
 *
 * The external URL wins when both exist. That is the debugging order: a laptop
 * behind a tunnel is set deliberately and temporarily, and while it is set it
 * should be what the site uses — a request that silently went to the container
 * instead would be measured against the wrong machine.
 */
export function chooseZkpBackend(env: Env): ZkpBackend {
  if (env.ZKP_VERIFIER_URL?.trim()) return "external";
  return hasZkpContainer(env) ? "container" : "none";
}

// ---------------------------------------------------------------------------
// Civil dates in Asia/Taipei

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

const TAIPEI_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Taipei civil date at `nowMs`, the calendar the app's `ROCDate.taipeiCalendar` uses. */
export function taipeiCivilDate(nowMs: number): CivilDate {
  const parts = TAIPEI_DATE.formatToParts(new Date(nowMs));
  const pick = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function formatCivilDate(date: CivilDate): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(date.year).padStart(4, "0")}-${pad(date.month)}-${pad(date.day)}`;
}

/** Strict `YYYY-MM-DD` that names a real day; `2008-02-31` is refused rather than normalised. */
export function parseCivilDate(value: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (date.year < 1 || date.month < 1 || date.month > 12 || date.day < 1 || date.day > daysInMonth(date.year, date.month)) return null;
  return date;
}

/** Today in Taipei minus `minimumAge` years, day clamped to the month (Feb 29 → Feb 28),
 *  the same answer `Calendar.date(byAdding: .year, value: -minimumAge)` gives the app. */
export function cutoffDateFor(nowMs: number, minimumAge: number): string {
  const today = taipeiCivilDate(nowMs);
  const year = today.year - minimumAge;
  return formatCivilDate({ year, month: today.month, day: Math.min(today.day, daysInMonth(year, today.month)) });
}

/** The circuit literal for the cutoff: ISO (2) packs the Gregorian date as
 *  YYYYMMDD, ROC (3) packs the 民國 year the same way and must stay positive. */
export function numericCutoff(cutoffDate: string, claimFormat: ZkpClaimFormat): number | null {
  const date = parseCivilDate(cutoffDate);
  if (!date) return null;
  if (claimFormat === 2) return date.year * 10_000 + date.month * 100 + date.day;
  const rocYear = date.year - ROC_YEAR_OFFSET;
  if (rocYear <= 0) return null;
  return rocYear * 10_000 + date.month * 100 + date.day;
}

// ---------------------------------------------------------------------------
// Request the page shows and the wallet scans

// `UntrustedText.unsafeScalars` in the app: Cc and Cf plus the separators.
// The app replaces these and then requires the cleaned text to equal the
// original, so a purpose carrying any of them is refused outright.
const UNSAFE_PURPOSE_SCALARS = /[\p{Cc}\p{Cf}\u2028\u2029]/gu;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** `undefined`/`null` → the default purpose; a string is stripped of control
 *  characters and trimmed and must then be 1..100 characters; anything else → null. */
export function sanitizePurpose(raw: unknown): string | null {
  if (raw === undefined || raw === null) return DEFAULT_PURPOSE;
  if (typeof raw !== "string") return null;
  const text = raw.replace(UNSAFE_PURPOSE_SCALARS, "").replace(LONE_SURROGATE, "").trim();
  const length = Array.from(text).length;
  if (length < 1 || length > MAX_PURPOSE_CHARS) return null;
  return text;
}

export function parseMinimumAge(raw: unknown): number | null {
  if (raw === undefined || raw === null) return DEFAULT_MINIMUM_AGE;
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
  return raw >= MIN_MINIMUM_AGE && raw <= MAX_MINIMUM_AGE ? raw : null;
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 32 random bytes, base64url without padding (43 chars) — the app checks the decoded length. */
export function randomNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToB64url(bytes);
}

/** The app decodes `b` as a `UUID`; it only matters for Bluetooth in the offline
 *  flow and is an opaque correlation id here. Upper case is `UUID.uuidString`. */
export function randomServiceId(): string {
  return crypto.randomUUID().toUpperCase();
}

export interface ZkpRequestFields {
  minimumAge: number;
  serviceId: string;
  nonce: string;
  cutoffDate: string;
  purpose: string;
  source: ZkpCredentialSource;
  createdAtSeconds: number;
  responseUrl: string;
}

/** The QR payload: sorted single-letter keys, no whitespace, no escaped
 *  slashes — what Swift's `JSONEncoder` with `[.sortedKeys, .withoutEscapingSlashes]`
 *  produces, plus `u`, the HTTPS response URL the online wallet posts to. */
export function buildRequestJson(fields: ZkpRequestFields): string {
  return JSON.stringify({
    a: fields.minimumAge,
    b: fields.serviceId,
    c: fields.nonce,
    d: fields.cutoffDate,
    p: fields.purpose,
    s: sourceLetter(fields.source),
    t: fields.createdAtSeconds,
    u: fields.responseUrl,
    v: REQUEST_VERSION,
  });
}

// ---------------------------------------------------------------------------
// Proof package the wallet posts back

export interface ZkpProofPackage {
  version: number;
  requestNonce: string;
  credentialSource: string;
  claimName: string;
  claimFormat: number;
  cutoffDate: string;
  minimumAge: number;
  issuerDID: string;
  /** Base64 as received; forwarded verbatim to the native verifier, never decoded here. */
  prepareProof: string;
  showProof: string;
  prepareMilliseconds: number;
  showMilliseconds: number;
  createdAt: number;
}

export type ZkpPackageParse = { ok: true; pkg: ZkpProofPackage } | { ok: false; reason: string };

/** Decoded byte length of a standard or url-safe base64 string, or null when
 *  the alphabet is wrong. Computed arithmetically so a 2 MB proof is not
 *  decoded just to be measured. */
export function base64DecodedLength(value: string): number | null {
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(value)) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const body = value.length - padding;
  if (body % 4 === 1) return null;
  return Math.floor((body * 3) / 4);
}

export function parseProofPackage(raw: string): ZkpPackageParse {
  if (raw.length > MAX_PACKAGE_CHARS) return { ok: false, reason: "證明回應超過大小上限" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "證明回應不是 JSON" };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, reason: "證明回應格式不正確" };
  const object = value as Record<string, unknown>;
  const str = (key: string): string | undefined => (typeof object[key] === "string" ? (object[key] as string) : undefined);
  const num = (key: string): number | undefined =>
    typeof object[key] === "number" && Number.isFinite(object[key] as number) ? (object[key] as number) : undefined;
  const requestNonce = str("requestNonce");
  const credentialSource = str("credentialSource");
  const claimName = str("claimName");
  const cutoffDate = str("cutoffDate");
  const issuerDID = str("issuerDID");
  const prepareProof = str("prepareProof");
  const showProof = str("showProof");
  const version = num("version");
  const claimFormat = num("claimFormat");
  const minimumAge = num("minimumAge");
  const prepareMilliseconds = num("prepareMilliseconds");
  const showMilliseconds = num("showMilliseconds");
  if (
    requestNonce === undefined || credentialSource === undefined || claimName === undefined || cutoffDate === undefined
    || issuerDID === undefined || prepareProof === undefined || showProof === undefined || version === undefined
    || claimFormat === undefined || minimumAge === undefined || prepareMilliseconds === undefined || showMilliseconds === undefined
  ) {
    return { ok: false, reason: "證明回應缺少必要欄位" };
  }
  return {
    ok: true,
    pkg: {
      version,
      requestNonce,
      credentialSource,
      claimName,
      claimFormat,
      cutoffDate,
      minimumAge,
      issuerDID,
      prepareProof,
      showProof,
      prepareMilliseconds: Math.max(0, Math.round(prepareMilliseconds)),
      showMilliseconds: Math.max(0, Math.round(showMilliseconds)),
      createdAt: num("createdAt") ?? 0,
    },
  };
}

/** What the verifier fixed when it minted the request. Only these values, never
 *  the package's copies, feed the statement sent to the native verifier. */
export interface ZkpStatement {
  nonce: string;
  source: ZkpCredentialSource;
  cutoffDate: string;
  minimumAge: number;
}

/** Mirrors `AgePredicateProofPackage.validate(answering:)`; returns the reason or null. */
export function validateProofPackage(pkg: ZkpProofPackage, statement: ZkpStatement): string | null {
  if (pkg.version !== PACKAGE_VERSION) return "不支援的證明封包版本";
  if (pkg.requestNonce !== statement.nonce) return "證明回答的 nonce 與這次請求不符";
  if (pkg.credentialSource !== sourceLetter(statement.source)) return "證明的卡片來源與這次請求不符";
  if (pkg.cutoffDate !== statement.cutoffDate) return "證明的截止日期與這次請求不符";
  if (pkg.minimumAge !== statement.minimumAge) return "證明的年齡門檻與這次請求不符";
  if (pkg.claimFormat !== 2 && pkg.claimFormat !== 3) return "不支援的出生日期欄位格式";
  if (!isSupportedClaimName(pkg.claimName) || enc.encode(pkg.claimName).length > MAX_CLAIM_NAME_BYTES) {
    return "證明的欄位不是支援的出生日期欄位";
  }
  if (!pkg.issuerDID.startsWith("did:key:") || enc.encode(pkg.issuerDID).length > MAX_ISSUER_DID_BYTES) {
    return "發卡者識別不是 did:key";
  }
  const prepareBytes = base64DecodedLength(pkg.prepareProof);
  const showBytes = base64DecodedLength(pkg.showProof);
  if (
    prepareBytes === null || showBytes === null || prepareBytes === 0 || showBytes === 0
    || prepareBytes > MAX_PROOF_BYTES || showBytes > MAX_PROOF_BYTES
  ) {
    return "證明物件為空、損毀或超過大小上限";
  }
  if (numericCutoff(statement.cutoffDate, pkg.claimFormat) === null) return "截止日期無法以該欄位格式表示";
  return null;
}

/** The issuer's P-256 coordinates from its did:key (either TWDIW spelling),
 *  resolved locally — the holder's copy of the key is never trusted. */
export function issuerP256Coordinates(did: string): { x: string; y: string } | null {
  const jwk = resolveDidKeyToJwk(did);
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || typeof jwk.x !== "string" || typeof jwk.y !== "string") return null;
  try {
    if (b64urlToBytes(jwk.x).length !== 32 || b64urlToBytes(jwk.y).length !== 32) return null;
  } catch {
    return null;
  }
  return { x: jwk.x, y: jwk.y };
}

// ---------------------------------------------------------------------------
// Native verifier (native/openac-age-verifier) contract

export interface NativeVerifyRequest {
  prepareProof: string;
  showProof: string;
  nonce: string;
  claimName: string;
  claimFormat: ZkpClaimFormat;
  cutoff: number;
  issuerKeyX: string;
  issuerKeyY: string;
}

export interface NativeVerifyResponse {
  accepted: boolean;
  reason: string | null;
  loadMs: number;
  verifyMs: number;
  prepareProofBytes: number;
  showProofBytes: number;
  statement?: Record<string, unknown>;
  assetRelease?: string;
}

export type NativeVerifyOutcome =
  | { kind: "verdict"; verdict: NativeVerifyResponse }
  | { kind: "refused"; reason: string }
  | { kind: "unavailable"; reason: string };

/** Call only after `validateProofPackage` passed; the statement values come
 *  from the session, the issuer key from local did:key resolution. */
export function buildNativeRequest(
  pkg: ZkpProofPackage,
  statement: ZkpStatement,
  issuerKey: { x: string; y: string },
): NativeVerifyRequest | null {
  if (pkg.claimFormat !== 2 && pkg.claimFormat !== 3) return null;
  const cutoff = numericCutoff(statement.cutoffDate, pkg.claimFormat);
  if (cutoff === null) return null;
  return {
    prepareProof: pkg.prepareProof,
    showProof: pkg.showProof,
    nonce: statement.nonce,
    claimName: pkg.claimName,
    claimFormat: pkg.claimFormat,
    cutoff,
    issuerKeyX: issuerKey.x,
    issuerKeyY: issuerKey.y,
  };
}

function isNativeVerdict(value: unknown): value is NativeVerifyResponse {
  if (!value || typeof value !== "object") return false;
  const verdict = value as Record<string, unknown>;
  return typeof verdict.accepted === "boolean"
    && (verdict.reason === null || verdict.reason === undefined || typeof verdict.reason === "string")
    && typeof verdict.loadMs === "number"
    && typeof verdict.verifyMs === "number";
}

export async function verifyWithNativeService(
  body: NativeVerifyRequest,
  options: { baseUrl?: string; token?: string; fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<NativeVerifyOutcome> {
  const base = (options.baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!base) return { kind: "unavailable", reason: "zkp verifier backend is not configured" };
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(`${base}/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? NATIVE_TIMEOUT_MS),
    });
  } catch (error) {
    return { kind: "unavailable", reason: error instanceof Error ? error.message : "network error" };
  }
  if (response.status === 400) {
    let reason: string | undefined;
    try {
      const refusal = await response.json() as { error?: unknown };
      if (typeof refusal.error === "string" && refusal.error) reason = refusal.error;
    } catch {
      // A 400 without a readable body is still a refusal of this package.
    }
    return { kind: "refused", reason: reason ? `驗證後端拒絕這組證明：${reason}` : "驗證後端拒絕這組證明" };
  }
  if (!response.ok) return { kind: "unavailable", reason: `verifier backend responded ${response.status}` };
  let verdict: unknown;
  try {
    verdict = await response.json();
  } catch {
    return { kind: "unavailable", reason: "verifier backend returned malformed JSON" };
  }
  if (!isNativeVerdict(verdict)) return { kind: "unavailable", reason: "verifier backend returned an unexpected shape" };
  return {
    kind: "verdict",
    verdict: {
      accepted: verdict.accepted,
      reason: verdict.reason ?? null,
      loadMs: Math.round(verdict.loadMs),
      verifyMs: Math.round(verdict.verifyMs),
      prepareProofBytes: typeof verdict.prepareProofBytes === "number" ? verdict.prepareProofBytes : 0,
      showProofBytes: typeof verdict.showProofBytes === "number" ? verdict.showProofBytes : 0,
      statement: verdict.statement,
      assetRelease: typeof verdict.assetRelease === "string" ? verdict.assetRelease : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Results

export interface ZkpTimingMs {
  /** Reported by the wallet: building the Prepare proof (plus reblinding). */
  holderPrepare: number;
  /** Reported by the wallet: building the Show proof (plus reblinding). */
  holderShow: number;
  /** Session creation → receipt of the package on this Worker. */
  transport: number;
  /** Native `verify_linked` plus statement comparison. */
  verify: number;
  /** Native proof deserialisation. */
  nativeLoad: number;
  /** Worker wall time for the submit, trust lookup and native round trip included. */
  total: number;
}

/** What the wallet receives in the HTTP response. */
export interface ZkpAppResult {
  status: "verified" | "failed";
  accepted: boolean;
  reason?: string;
  minimumAge: number;
  credentialSource: ZkpCredentialSource;
  timingMs: ZkpTimingMs;
}

/** What the page receives over the one-time WebSocket: the app result plus
 *  trust evidence and the statement. Never the issuer DID or the proofs. */
export interface ZkpPageResult extends ZkpAppResult {
  trust?: IssuerTrustEvidence;
  trustMs?: number;
  claimName?: string;
  claimFormat?: ZkpClaimFormat;
  cutoffDate?: string;
  cutoff?: number;
  proofBytes?: { prepare: number; show: number };
  assetRelease?: string;
}

export function appResultOf(result: ZkpPageResult): ZkpAppResult {
  const app: ZkpAppResult = {
    status: result.status,
    accepted: result.accepted,
    minimumAge: result.minimumAge,
    credentialSource: result.credentialSource,
    timingMs: result.timingMs,
  };
  if (result.reason !== undefined) app.reason = result.reason;
  return app;
}
