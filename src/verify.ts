// SD-JWT-VC verification for the OIDC4VP verifier.
//
// A TWDIW credential arrives as an SD-JWT-VC compact serialization:
//     <issuer-signed JWT>~<disclosure>~…~<disclosure>~<key-binding JWT>
//
// The issuer-signed part is verified the same way no matter how the holder proves
// possession, so that half lives in `verifyIssuerCredential` and is shared by:
//   * `verifySdJwtVc` — the standards path, where the holder binding is a KB-JWT
//     appended to the SD-JWT-VC;
//   * `verifyModaVpToken` (src/moda.ts) — the TWDIW/有備而來 path, where the
//     holder binding is an *outer* VerifiablePresentation JWT and the inner
//     credential carries no KB-JWT.
//
// `verifyIssuerCredential`, in order: issuer JWT signature against the issuer's
// `.well-known/jwt-vc-issuer` JWKS → disclosures re-hashed and matched into `_sd`
// (flat, nested, and `...` array digests; values decoded as UTF-8 so Chinese names
// survive) → revocation via the Token Status List. `exp`/`nbf` are enforced inside
// `jwtVerify`.
//
// Web Crypto + jose only — everything here runs on Cloudflare Workers.

import {
  createRemoteJWKSet,
  jwtVerify,
  decodeProtectedHeader,
  decodeJwt,
  importJWK,
  type JWK,
} from "jose";
import { resolveDidKeyToJwk } from "./didkey";

export interface VerifyOptions {
  expectedNonce: string;
  expectedAudience: string;
  trustedIssuers: string[]; // empty = accept any resolvable issuer (demo only)
}

export type RevocationStatus = "valid" | "revoked" | "suspended" | "unknown";

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  vct?: string;
  issuer?: string;
  claims?: Record<string, unknown>;
  keyBound?: boolean;
  /** "valid" / "revoked" / "suspended" / "unknown" — the Token Status List check. */
  status?: RevocationStatus;
}

/** The issuer-signed half, plus the holder key the issuer bound it to (`cnf`). */
export interface IssuerCredentialResult {
  ok: boolean;
  reason?: string;
  vct?: string;
  issuer?: string;
  claims?: Record<string, unknown>;
  /** The `cnf.jwk` the credential is bound to — what a holder proof must match. */
  cnf?: JWK;
  status?: RevocationStatus;
}

const enc = new TextEncoder();

async function sha256b64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return b64url(new Uint8Array(digest));
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

/** base64url → raw bytes (the binary string from atob is per-byte, so charCodeAt is safe). */
function b64urlToBytes(s: string): Uint8Array {
  return Uint8Array.from(b64urlDecode(s), (c) => c.charCodeAt(0));
}

/** base64url → UTF-8 text. Disclosures hold names/addresses in Chinese; decoding via
 *  `atob` alone would mojibake every multi-byte character. */
function b64urlToText(s: string): string {
  return new TextDecoder().decode(b64urlToBytes(s));
}

/** Resolve the issuer's verifying key. TWDIW/moda issuers name themselves with a
 *  `did:key` that embeds the key (no network); other issuers publish it at
 *  `.well-known/jwt-vc-issuer`. */
async function issuerKeySet(iss: string) {
  // did:key issuer — the key is inside the identifier, self-certifying.
  if (iss.startsWith("did:key:")) {
    const jwk = resolveDidKeyToJwk(iss);
    if (!jwk) throw new Error(`unsupported did:key issuer: ${iss.slice(0, 24)}…`);
    return async (header: { kid?: string; alg?: string }) => importJWK(jwk, header.alg ?? "ES256");
  }
  const u = new URL(iss);
  const metadataUrl = `${u.origin}/.well-known/jwt-vc-issuer${u.pathname}`;
  const res = await fetch(metadataUrl, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`issuer metadata ${res.status} at ${metadataUrl}`);
  const meta = (await res.json()) as { jwks?: { keys: JWK[] }; jwks_uri?: string };
  if (meta.jwks?.keys?.length) {
    return async (header: { kid?: string; alg?: string }) => {
      const jwk = meta.jwks!.keys.find((k) => !header.kid || (k as { kid?: string }).kid === header.kid) ?? meta.jwks!.keys[0];
      return importJWK(jwk, header.alg ?? "ES256");
    };
  }
  if (meta.jwks_uri) {
    const remote = createRemoteJWKSet(new URL(meta.jwks_uri));
    return async (header: { kid?: string; alg?: string }) => remote({ kid: header.kid, alg: header.alg } as never);
  }
  throw new Error("issuer metadata has neither jwks nor jwks_uri");
}

/** Walk `_sd` digests, replacing matched ones with the disclosed claim. */
function insertDisclosures(node: unknown, digestMap: Map<string, [string, string, unknown]>, arrayDigestMap: Map<string, unknown>): unknown {
  if (Array.isArray(node)) {
    const out: unknown[] = [];
    for (const el of node) {
      if (el && typeof el === "object" && "..." in (el as object)) {
        const d = (el as { "...": string })["..."];
        if (arrayDigestMap.has(d)) out.push(insertDisclosures(arrayDigestMap.get(d), digestMap, arrayDigestMap));
      } else {
        out.push(insertDisclosures(el, digestMap, arrayDigestMap));
      }
    }
    return out;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "_sd" && Array.isArray(v)) {
        for (const digest of v as string[]) {
          const disc = digestMap.get(digest);
          if (disc) out[disc[1]] = insertDisclosures(disc[2], digestMap, arrayDigestMap);
        }
      } else if (k === "_sd_alg") {
        // consumed; not part of the claim set
      } else {
        out[k] = insertDisclosures(v, digestMap, arrayDigestMap);
      }
    }
    return out;
  }
  return node;
}

/** RFC1950 (zlib) inflate — the compression the Status List spec mandates for `lst`. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate");
  const stream = new Response(bytes).body!.pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Token Status List revocation check (draft-ietf-oauth-status-list). Returns
 * "unknown" (never throws) when the credential carries no status claim or the list
 * can't be reached/verified — the caller decides whether "unknown" blocks.
 */
async function checkRevocation(payload: Record<string, unknown>): Promise<{ status: RevocationStatus; reason?: string }> {
  const ref = (payload.status as { status_list?: { idx?: number; uri?: string } } | undefined)?.status_list;
  if (!ref || typeof ref.idx !== "number" || typeof ref.uri !== "string") {
    return { status: "unknown", reason: "no status_list reference" };
  }
  try {
    const res = await fetch(ref.uri, { headers: { accept: "application/statuslist+jwt" } });
    if (!res.ok) return { status: "unknown", reason: `status list ${res.status}` };
    const token = (await res.text()).trim();
    const stHeader = decodeProtectedHeader(token) as { alg?: string; kid?: string; typ?: string };
    const stPayload = decodeJwt(token) as Record<string, unknown>;
    const stIss = String(stPayload.iss ?? "");
    if (!stIss) return { status: "unknown", reason: "status list has no iss" };
    const getKey = await issuerKeySet(stIss);
    await jwtVerify(token, (await getKey(stHeader)) as never);
    if (stPayload.sub && String(stPayload.sub) !== ref.uri) {
      return { status: "unknown", reason: "status list sub != uri" };
    }
    const list = stPayload.status_list as { bits?: number; lst?: string } | undefined;
    if (!list?.lst) return { status: "unknown", reason: "status list has no lst" };
    const bits = list.bits ?? 1;
    const bytes = await inflate(b64urlToBytes(list.lst));
    const perByte = 8 / bits;
    const byte = bytes[Math.floor(ref.idx / perByte)] ?? 0;
    const shift = (ref.idx % perByte) * bits;
    const value = (byte >> shift) & ((1 << bits) - 1);
    if (value === 1) return { status: "revoked" };
    if (value === 2) return { status: "suspended" };
    return { status: "valid" };
  } catch (e) {
    return { status: "unknown", reason: e instanceof Error ? e.message : "status check error" };
  }
}

/**
 * Verifies the issuer-signed half of an SD-JWT-VC: issuer signature, disclosures,
 * and revocation. Does NOT verify holder binding — the caller does that with either
 * a KB-JWT or an outer VP JWT. Returns the disclosed claims and the credential's
 * `cnf` key so the caller can bind the holder proof to it.
 */
export async function verifyIssuerCredential(
  issuerJwt: string,
  disclosures: string[],
  trustedIssuers: string[],
): Promise<IssuerCredentialResult> {
  const header = decodeProtectedHeader(issuerJwt) as { alg?: string; kid?: string; typ?: string };
  const payload = decodeJwt(issuerJwt) as Record<string, unknown>;
  const iss = String(payload.iss ?? "");
  if (!iss) return { ok: false, reason: "no iss in credential" };
  if (trustedIssuers.length && !trustedIssuers.includes(iss)) {
    return { ok: false, reason: `issuer ${iss} not in the trust list` };
  }
  const getKey = await issuerKeySet(iss);
  const key = await getKey(header);
  await jwtVerify(issuerJwt, key as never); // throws on bad signature / exp / nbf

  const digestMap = new Map<string, [string, string, unknown]>();
  const arrayDigestMap = new Map<string, unknown>();
  for (const d of disclosures) {
    if (!d) continue;
    const digest = await sha256b64url(d);
    const arr = JSON.parse(b64urlToText(d)) as unknown[];
    if (arr.length === 3) digestMap.set(digest, [String(arr[0]), String(arr[1]), arr[2]]);
    else if (arr.length === 2) arrayDigestMap.set(digest, arr[1]);
  }
  const claims = insertDisclosures(payload, digestMap, arrayDigestMap) as Record<string, unknown>;

  const revocation = await checkRevocation(payload);
  if (revocation.status === "revoked" || revocation.status === "suspended") {
    return { ok: false, reason: `credential is ${revocation.status}`, vct: typeof payload.vct === "string" ? payload.vct : undefined, issuer: iss, status: revocation.status };
  }

  return {
    ok: true,
    vct: typeof payload.vct === "string" ? payload.vct : undefined,
    issuer: iss,
    claims,
    cnf: (payload.cnf as { jwk?: JWK } | undefined)?.jwk,
    status: revocation.status,
  };
}

/**
 * Standards path: an SD-JWT-VC whose holder binding is a KB-JWT appended after the
 * disclosures. Splits the compact form, verifies the issuer half via
 * `verifyIssuerCredential`, then checks the KB-JWT against the credential's `cnf`
 * key — its `nonce`, `aud`, and `sd_hash`.
 */
export async function verifySdJwtVc(vpToken: string, opts: VerifyOptions): Promise<VerifyResult> {
  try {
    const parts = vpToken.split("~");
    const issuerJwt = parts[0];
    const endsWithTilde = vpToken.endsWith("~");
    const kbJwt = endsWithTilde ? undefined : parts[parts.length - 1];
    const disclosures = parts.slice(1, parts.length - 1);

    const base = await verifyIssuerCredential(issuerJwt, disclosures, opts.trustedIssuers);
    if (!base.ok) return { ok: false, reason: base.reason, vct: base.vct, issuer: base.issuer, status: base.status };

    let keyBound = false;
    if (kbJwt) {
      if (!base.cnf) return { ok: false, reason: "credential has no cnf key for key binding" };
      const kbHeader = decodeProtectedHeader(kbJwt) as { alg?: string };
      const kbKey = await importJWK(base.cnf, kbHeader.alg ?? "ES256");
      const { payload: kbPayload } = await jwtVerify(kbJwt, kbKey as never, { audience: opts.expectedAudience });
      if (kbPayload.nonce !== opts.expectedNonce) return { ok: false, reason: "key-binding nonce mismatch" };
      // sd_hash is over the presentation up to and including the last `~` before the KB-JWT.
      const presented = vpToken.slice(0, vpToken.lastIndexOf("~") + 1);
      const expectedSdHash = await sha256b64url(presented);
      if (kbPayload.sd_hash && kbPayload.sd_hash !== expectedSdHash) {
        return { ok: false, reason: "key-binding sd_hash mismatch" };
      }
      keyBound = true;
    }

    return { ok: true, vct: base.vct, issuer: base.issuer, claims: base.claims, keyBound, status: base.status };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "verification error" };
  }
}
