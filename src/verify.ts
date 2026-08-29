// SD-JWT-VC verification for the OIDC4VP verifier.
//
// A TWDIW credential arrives as an SD-JWT-VC compact serialization:
//     <issuer-signed JWT>~<disclosure>~…~<disclosure>~<key-binding JWT>
//
// This verifies, in order:
//   1. the issuer JWT's signature, against the issuer's published JWKS;
//   2. the disclosures, by re-hashing each and matching it into the `_sd` digests
//      (flat and nested objects, and `...` array-element digests);
//   3. the key-binding JWT, against the credential's `cnf` key, including its
//      `nonce` (== the nonce we issued) and `aud` (== our client_id) and `sd_hash`;
//   4. revocation, via the credential's Token Status List reference.
// `exp` / `nbf` are enforced inside each `jwtVerify`.
//
// Web Crypto + jose only — everything here runs on Cloudflare Workers. It is
// written to the SD-JWT (RFC 9901) + SD-JWT-VC (draft) shape; it MUST be tested
// against a real moda-issued credential before a result is trusted, and the
// issuer trust anchor (whose JWKS is fetched) pinned to moda in production.

import {
  createRemoteJWKSet,
  jwtVerify,
  decodeProtectedHeader,
  decodeJwt,
  importJWK,
  type JWK,
} from "jose";

export interface VerifyOptions {
  expectedNonce: string;
  expectedAudience: string;
  trustedIssuers: string[]; // empty = accept any resolvable issuer (demo only)
}

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

type RevocationStatus = "valid" | "revoked" | "suspended" | "unknown";

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

/** Resolve the issuer's JWKS the SD-JWT-VC way (`.well-known/jwt-vc-issuer`). */
async function issuerKeySet(iss: string) {
  // Per draft-ietf-oauth-sd-jwt-vc: the JWT VC issuer metadata lives at
  // <iss-origin>/.well-known/jwt-vc-issuer<iss-path>, and carries either `jwks`
  // inline or a `jwks_uri`.
  const u = new URL(iss);
  const metadataUrl = `${u.origin}/.well-known/jwt-vc-issuer${u.pathname}`;
  const res = await fetch(metadataUrl, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`issuer metadata ${res.status} at ${metadataUrl}`);
  const meta = (await res.json()) as { jwks?: { keys: JWK[] }; jwks_uri?: string };
  if (meta.jwks?.keys?.length) {
    // Return a local resolver over the inline keys.
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
        // an unmatched `...` is a decoy; drop it.
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
 * Token Status List revocation check (draft-ietf-oauth-status-list).
 *
 * A credential that can be revoked carries `status.status_list = { idx, uri }`.
 * The verifier fetches the status list token at `uri` (a signed JWT whose payload
 * holds `status_list = { bits, lst }`), verifies its signature the same way it
 * verifies the credential issuer, inflates the `lst` bitstring, and reads the
 * `bits`-wide value at `idx`: 0 = valid, 1 = revoked, 2 = suspended.
 *
 * Returns "unknown" (never throws) when the credential carries no status claim or
 * the list can't be reached/verified — the caller decides whether "unknown" blocks.
 * A definite 1/2 is authoritative and does block.
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
    // Same issuer-key resolution as the credential; a bad signature or a mismatched
    // `sub` (which must equal the list's own URI) means we don't trust the list.
    const getKey = await issuerKeySet(stIss);
    await jwtVerify(token, (await getKey(stHeader)) as never);
    if (stPayload.sub && String(stPayload.sub) !== ref.uri) {
      return { status: "unknown", reason: "status list sub != uri" };
    }
    const list = stPayload.status_list as { bits?: number; lst?: string } | undefined;
    if (!list?.lst) return { status: "unknown", reason: "status list has no lst" };
    const bits = list.bits ?? 1;
    const bytes = await inflate(b64urlToBytes(list.lst));
    const perByte = 8 / bits;                     // statuses packed least-significant-first
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

export async function verifySdJwtVc(vpToken: string, opts: VerifyOptions): Promise<VerifyResult> {
  try {
    const parts = vpToken.split("~");
    const issuerJwt = parts[0];
    const endsWithTilde = vpToken.endsWith("~");
    const kbJwt = endsWithTilde ? undefined : parts[parts.length - 1];
    const disclosures = parts.slice(1, endsWithTilde ? parts.length - 1 : parts.length - 1);

    // 1. Issuer JWT signature.
    const header = decodeProtectedHeader(issuerJwt) as { alg?: string; kid?: string; typ?: string };
    const payload = decodeJwt(issuerJwt) as Record<string, unknown>;
    const iss = String(payload.iss ?? "");
    if (!iss) return { ok: false, reason: "no iss in credential" };
    if (opts.trustedIssuers.length && !opts.trustedIssuers.includes(iss)) {
      return { ok: false, reason: `issuer ${iss} not in the trust list` };
    }
    const getKey = await issuerKeySet(iss);
    const key = await getKey(header);
    await jwtVerify(issuerJwt, key as never); // throws on bad signature / exp / nbf

    // 2. Disclosures → matched into `_sd`.
    const digestMap = new Map<string, [string, string, unknown]>(); // digest -> [salt, name, value]
    const arrayDigestMap = new Map<string, unknown>();               // digest -> value
    for (const d of disclosures) {
      if (!d) continue;
      const digest = await sha256b64url(d);
      const arr = JSON.parse(b64urlToText(d)) as unknown[];
      if (arr.length === 3) digestMap.set(digest, [String(arr[0]), String(arr[1]), arr[2]]);
      else if (arr.length === 2) arrayDigestMap.set(digest, arr[1]);
    }
    const claims = insertDisclosures(payload, digestMap, arrayDigestMap) as Record<string, unknown>;

    // 3. Key-binding JWT (holder proof).
    let keyBound = false;
    if (kbJwt) {
      const cnf = (payload.cnf as { jwk?: JWK } | undefined)?.jwk;
      if (!cnf) return { ok: false, reason: "credential has no cnf key for key binding" };
      const kbHeader = decodeProtectedHeader(kbJwt) as { alg?: string };
      const kbKey = await importJWK(cnf, kbHeader.alg ?? "ES256");
      const { payload: kbPayload } = await jwtVerify(kbJwt, kbKey as never, {
        audience: opts.expectedAudience,
      });
      if (kbPayload.nonce !== opts.expectedNonce) return { ok: false, reason: "key-binding nonce mismatch" };
      // sd_hash binds the KB-JWT to exactly these issuer JWT + disclosures. Its
      // input is the presentation up to and including the last `~` before the
      // KB-JWT — i.e. the whole token minus the KB-JWT. Reconstructing it from the
      // token (rather than re-joining parts) keeps it correct when there are zero
      // disclosures, where a re-join would wrongly yield `<jwt>~~`.
      const presented = vpToken.slice(0, vpToken.lastIndexOf("~") + 1);
      const expectedSdHash = await sha256b64url(presented);
      if (kbPayload.sd_hash && kbPayload.sd_hash !== expectedSdHash) {
        return { ok: false, reason: "key-binding sd_hash mismatch" };
      }
      keyBound = true;
    }

    // 4. Revocation (Token Status List). A definite revoked/suspended blocks the
    // result; "unknown" (no status claim, or the list unreachable) does not — this
    // is a demo verifier, and production would fail-closed on "unknown" instead.
    const revocation = await checkRevocation(payload);
    if (revocation.status === "revoked" || revocation.status === "suspended") {
      return { ok: false, reason: `credential is ${revocation.status}`, vct: typeof payload.vct === "string" ? payload.vct : undefined, issuer: iss, status: revocation.status };
    }

    return {
      ok: true,
      vct: typeof payload.vct === "string" ? payload.vct : undefined,
      issuer: iss,
      claims,
      keyBound,
      status: revocation.status,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "verification error" };
  }
}
