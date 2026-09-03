// End-to-end tests for the SD-JWT-VC verifier.
//
// The README's honest caveat is that `verify.ts` was written to spec but never run
// against a credential. These tests close that gap without needing moda: they mint
// a credential with a *controlled* issuer + holder key (so the expected answer is
// known), then assert the verifier accepts the good one and rejects each way it can
// be wrong — bad nonce, wrong audience, a key-binding proof from the wrong holder,
// an untrusted issuer, and a revoked status-list entry. The zero-disclosure case
// guards the `sd_hash` reconstruction fix.
//
// All personal-looking values here are throwaway test strings, never real data.

import { describe, it, expect, vi, afterEach } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { verifySdJwtVc } from "../src/verify";

const ISSUER = "https://issuer.test";
const STATUS_URI = `${ISSUER}/statuslists/1`;
const CLIENT_ID = "https://verifier.test/api/response/abc";
const NONCE = "test-nonce-0123456789";
const STATUS_IDX = 5;

const enc = new TextEncoder();

function b64urlBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256b64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return b64urlBytes(new Uint8Array(digest));
}

/** A single SD-JWT disclosure: base64url(JSON([salt, name, value])). */
function disclosure(salt: string, name: string, value: unknown): string {
  return b64urlBytes(enc.encode(JSON.stringify([salt, name, value])));
}

/** zlib (RFC1950) compress — the format the Status List `lst` uses. */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  const stream = new Response(bytes).body!.pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const stream = new Response(bytes).body!.pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function standardBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

interface MintOpts {
  /** If set, the credential carries a status_list ref and this value is written at STATUS_IDX. */
  status?: number;
  /** Bits per status list entry. Must be >= 2 to represent status 2 (suspended). */
  statusBits?: number;
  /** TWDIW's StatusList2021 profile: 0 active, 1 revoked. */
  twdiwStatus?: number;
  omitDisclosures?: boolean;
  /** Sign the key-binding JWT with a key other than the credential's `cnf` key. */
  holderMismatch?: boolean;
  wrongNonce?: boolean;
}

async function mint(opts: MintOpts = {}) {
  const issuer = await generateKeyPair("ES256", { extractable: true });
  const holder = await generateKeyPair("ES256", { extractable: true });
  const issuerPubJwk = { ...(await exportJWK(issuer.publicKey)), kid: "k1" };
  const holderPubJwk = await exportJWK(holder.publicKey);

  const discs = opts.omitDisclosures
    ? []
    : [disclosure("salt-a", "name", "測試用戶"), disclosure("salt-b", "id_number", "A123456789")];
  const digests = await Promise.all(discs.map(sha256b64url));

  const payload: Record<string, unknown> = {
    vct: "https://twdiw.test/NationalID",
    iss: ISSUER,
    cnf: { jwk: holderPubJwk },
    _sd_alg: "sha-256",
    ...(digests.length ? { _sd: digests } : {}),
    ...(opts.status !== undefined ? { status: { status_list: { idx: STATUS_IDX, uri: STATUS_URI } } } : {}),
    ...(opts.twdiwStatus !== undefined ? {
      vc: {
        type: ["VerifiableCredential", "TestCredential"],
        credentialStatus: {
          type: "StatusList2021Entry",
          statusPurpose: "revocation",
          statusListIndex: String(STATUS_IDX),
          statusListCredential: STATUS_URI,
        },
      },
    } : {}),
  };
  const issuerJwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", typ: "vc+sd-jwt", kid: "k1" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(issuer.privateKey);

  // Presentation = issuer JWT + each disclosure + a trailing tilde, no KB-JWT.
  const presentation = issuerJwt + "~" + discs.map((d) => d + "~").join("");
  const sdHash = await sha256b64url(presentation);
  const kbSigner = opts.holderMismatch
    ? (await generateKeyPair("ES256", { extractable: true })).privateKey
    : holder.privateKey;
  const kbJwt = await new SignJWT({ nonce: opts.wrongNonce ? "not-the-nonce" : NONCE, sd_hash: sdHash })
    .setProtectedHeader({ alg: "ES256", typ: "kb+jwt" })
    .setIssuedAt()
    .setAudience(CLIENT_ID)
    .sign(kbSigner);

  const token = presentation + kbJwt;

  let statusListJwt: string | undefined;
  if (opts.status !== undefined) {
    const bits = opts.statusBits ?? 1;
    const perByte = 8 / bits;
    const lst = new Uint8Array(Math.floor(STATUS_IDX / perByte) + 1);
    lst[Math.floor(STATUS_IDX / perByte)] |= (opts.status & ((1 << bits) - 1)) << ((STATUS_IDX % perByte) * bits); // LSB-first packing
    statusListJwt = await new SignJWT({ iss: ISSUER, sub: STATUS_URI, status_list: { bits, lst: b64urlBytes(await deflate(lst)) } })
      .setProtectedHeader({ alg: "ES256", typ: "statuslist+jwt", kid: "k1" })
      .setIssuedAt()
      .sign(issuer.privateKey);
  } else if (opts.twdiwStatus !== undefined) {
    const list = new Uint8Array(Math.floor(STATUS_IDX / 8) + 1);
    if (opts.twdiwStatus === 1) list[Math.floor(STATUS_IDX / 8)] |= 0x80 >> (STATUS_IDX % 8);
    statusListJwt = await new SignJWT({
      iss: ISSUER,
      sub: STATUS_URI,
      vc: {
        type: ["VerifiableCredential", "StatusList2021Credential"],
        credentialSubject: { statusPurpose: "revocation", encodedList: standardBase64(await gzip(list)) },
      },
    })
      .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: "k1" })
      .setNotBefore(Math.floor(Date.now() / 1000) - 1)
      .setExpirationTime("1h")
      .sign(issuer.privateKey);
  }

  return { token, issuerPubJwk, statusListJwt };
}

function mockFetch(issuerPubJwk: unknown, statusListJwt?: string) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/.well-known/jwt-vc-issuer")) {
      return new Response(JSON.stringify({ jwks: { keys: [issuerPubJwk] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (statusListJwt && url === STATUS_URI) {
      return new Response(statusListJwt, { status: 200, headers: { "content-type": "application/statuslist+jwt" } });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

const OK_OPTS = { expectedNonce: NONCE, expectedAudience: CLIENT_ID, trustedIssuers: [] as string[] };

afterEach(() => vi.restoreAllMocks());

describe("verifySdJwtVc", () => {
  it("accepts a well-formed credential and reveals the disclosed claims", async () => {
    const { token, issuerPubJwk } = await mint();
    mockFetch(issuerPubJwk);
    const r = await verifySdJwtVc(token, OK_OPTS);
    expect(r.ok).toBe(true);
    expect(r.keyBound).toBe(true);
    expect(r.issuer).toBe(ISSUER);
    expect(r.claims?.name).toBe("測試用戶");
    expect(r.claims?.id_number).toBe("A123456789");
  });

  it("accepts a credential whose status-list entry is valid (0)", async () => {
    const { token, issuerPubJwk, statusListJwt } = await mint({ status: 0 });
    mockFetch(issuerPubJwk, statusListJwt);
    const r = await verifySdJwtVc(token, OK_OPTS);
    expect(r.ok).toBe(true);
    expect(r.status).toBe("valid");
  });

  it("rejects a revoked credential (status 1)", async () => {
    const { token, issuerPubJwk, statusListJwt } = await mint({ status: 1 });
    mockFetch(issuerPubJwk, statusListJwt);
    const r = await verifySdJwtVc(token, OK_OPTS);
    expect(r.ok).toBe(false);
    expect(r.status).toBe("revoked");
    expect(r.reason).toMatch(/revoked/);
  });

  it("rejects a suspended credential (status 2)", async () => {
    const { token, issuerPubJwk, statusListJwt } = await mint({ status: 2, statusBits: 2 });
    mockFetch(issuerPubJwk, statusListJwt);
    const r = await verifySdJwtVc(token, OK_OPTS);
    expect(r.ok).toBe(false);
    expect(r.status).toBe("suspended");
  });

  it("accepts an active TWDIW StatusList2021 entry", async () => {
    const { token, issuerPubJwk, statusListJwt } = await mint({ twdiwStatus: 0 });
    mockFetch(issuerPubJwk, statusListJwt);
    const result = await verifySdJwtVc(token, OK_OPTS);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("valid");
  });

  it("rejects a revoked TWDIW StatusList2021 entry using its MSB-first bit order", async () => {
    const { token, issuerPubJwk, statusListJwt } = await mint({ twdiwStatus: 1 });
    mockFetch(issuerPubJwk, statusListJwt);
    const result = await verifySdJwtVc(token, OK_OPTS);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("revoked");
  });

  it("rejects a replayed nonce", async () => {
    const { token, issuerPubJwk } = await mint({ wrongNonce: true });
    mockFetch(issuerPubJwk);
    const r = await verifySdJwtVc(token, OK_OPTS);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/nonce/);
  });

  it("rejects a presentation bound to the wrong audience", async () => {
    const { token, issuerPubJwk } = await mint();
    mockFetch(issuerPubJwk);
    const r = await verifySdJwtVc(token, { ...OK_OPTS, expectedAudience: "https://someone.else" });
    expect(r.ok).toBe(false);
  });

  it("rejects a key-binding proof from the wrong holder", async () => {
    const { token, issuerPubJwk } = await mint({ holderMismatch: true });
    mockFetch(issuerPubJwk);
    const r = await verifySdJwtVc(token, OK_OPTS);
    expect(r.ok).toBe(false);
  });

  it("rejects an issuer that is not in the trust list", async () => {
    const { token, issuerPubJwk } = await mint();
    mockFetch(issuerPubJwk);
    const r = await verifySdJwtVc(token, { ...OK_OPTS, trustedIssuers: ["https://not.this.one"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/trust list/);
  });

  it("verifies a credential presented with zero disclosures (sd_hash edge case)", async () => {
    const { token, issuerPubJwk } = await mint({ omitDisclosures: true });
    mockFetch(issuerPubJwk);
    const r = await verifySdJwtVc(token, OK_OPTS);
    expect(r.ok).toBe(true);
    expect(r.keyBound).toBe(true);
  });

  it("rejects a bare SD-JWT credential without holder binding", async () => {
    const { token, issuerPubJwk } = await mint();
    mockFetch(issuerPubJwk);
    const bare = token.slice(0, token.lastIndexOf("~") + 1);
    const result = await verifySdJwtVc(bare, OK_OPTS);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/key-binding/);
  });
});
