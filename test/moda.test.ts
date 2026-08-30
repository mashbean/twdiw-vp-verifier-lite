// End-to-end tests for the TWDIW / 有備而來 presentation dialect: an outer
// VerifiablePresentation JWT (holder-signed, carrying the holder key in its header)
// wrapping an inner SD-JWT-VC that has no KB-JWT. The controlled keys make the
// expected answer known, so the good path and every rejection can be asserted.
//
// All personal-looking values are throwaway test strings, never real data.

import { describe, it, expect, vi, afterEach } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { verifyModaVpToken } from "../src/moda";
import { p256DidKey } from "../src/didkey";

const ISSUER = "https://issuer.test";
const VERIFIER_DID = "did:key:zVerifierClientIdForTest";
const NONCE = "moda-test-nonce-123";

const enc = new TextEncoder();

function b64urlBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256b64url(input: string): Promise<string> {
  return b64urlBytes(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(input))));
}
function disclosure(salt: string, name: string, value: unknown): string {
  return b64urlBytes(enc.encode(JSON.stringify([salt, name, value])));
}

interface MintOpts {
  /** Sign the outer VP with a different holder than the credential's cnf. */
  cnfMismatch?: boolean;
  wrongNonce?: boolean;
  wrongAudience?: boolean;
}

async function mint(opts: MintOpts = {}) {
  const issuer = await generateKeyPair("ES256", { extractable: true });
  const holder = await generateKeyPair("ES256", { extractable: true });
  const attacker = await generateKeyPair("ES256", { extractable: true });
  const issuerPubJwk = { ...(await exportJWK(issuer.publicKey)), kid: "k1" };
  const holderPubJwk = await exportJWK(holder.publicKey);

  const discs = [disclosure("s1", "name", "測試持有人"), disclosure("s2", "id_number", "A123456789")];
  const digests = await Promise.all(discs.map(sha256b64url));

  // Inner SD-JWT-VC: bound to the *holder* key via cnf, no KB-JWT.
  const issuerJwt = await new SignJWT({
    vct: "https://twdiw.test/DriverLicense",
    iss: ISSUER,
    cnf: { jwk: holderPubJwk },
    _sd_alg: "sha-256",
    _sd: digests,
  })
    .setProtectedHeader({ alg: "ES256", typ: "vc+sd-jwt", kid: "k1" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(issuer.privateKey);
  const inner = issuerJwt + "~" + discs.map((d) => d + "~").join(""); // trailing ~, no KB

  // Outer VP JWT: the holder (or, for the mismatch case, an attacker) signs it and
  // carries their own key in the header.
  const vpSigner = opts.cnfMismatch ? attacker : holder;
  const vpSignerPubJwk = await exportJWK((opts.cnfMismatch ? attacker : holder).publicKey);
  const vpToken = await new SignJWT({
    iss: "did:key:zHolder",
    sub: "did:key:zHolder",
    nonce: opts.wrongNonce ? "not-the-nonce" : NONCE,
    vp: {
      context: ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiablePresentation"],
      verifiableCredential: [inner],
    },
  })
    .setProtectedHeader({ alg: "ES256", typ: "JWT", jwk: vpSignerPubJwk })
    .setAudience(opts.wrongAudience ? "did:key:zSomeoneElse" : VERIFIER_DID)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(vpSigner.privateKey);

  return { vpToken, issuerPubJwk };
}

function mockFetch(issuerPubJwk: unknown) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const u = String(input instanceof Request ? input.url : input);
    if (u.includes("/.well-known/jwt-vc-issuer")) {
      return new Response(JSON.stringify({ jwks: { keys: [issuerPubJwk] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

const OK = { expectedNonce: NONCE, expectedAudience: VERIFIER_DID, trustedIssuers: [] as string[] };

afterEach(() => vi.restoreAllMocks());

describe("verifyModaVpToken", () => {
  it("accepts a well-formed VP JWT and reveals the disclosed claims", async () => {
    const { vpToken, issuerPubJwk } = await mint();
    mockFetch(issuerPubJwk);
    const r = await verifyModaVpToken(vpToken, OK);
    expect(r.ok).toBe(true);
    expect(r.holderBound).toBe(true);
    expect(r.issuer).toBe(ISSUER);
    expect(r.vct).toBe("https://twdiw.test/DriverLicense");
    expect(r.claims?.name).toBe("測試持有人");
    expect(r.claims?.id_number).toBe("A123456789");
  });

  it("rejects a presentation signed by a key other than the credential's cnf", async () => {
    const { vpToken, issuerPubJwk } = await mint({ cnfMismatch: true });
    mockFetch(issuerPubJwk);
    const r = await verifyModaVpToken(vpToken, OK);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/cnf/);
  });

  it("rejects a replayed nonce", async () => {
    const { vpToken, issuerPubJwk } = await mint({ wrongNonce: true });
    mockFetch(issuerPubJwk);
    const r = await verifyModaVpToken(vpToken, OK);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/nonce/);
  });

  it("rejects a presentation bound to the wrong audience", async () => {
    const { vpToken, issuerPubJwk } = await mint({ wrongAudience: true });
    mockFetch(issuerPubJwk);
    const r = await verifyModaVpToken(vpToken, OK);
    expect(r.ok).toBe(false);
  });

  it("rejects an issuer not in the trust list", async () => {
    const { vpToken, issuerPubJwk } = await mint();
    mockFetch(issuerPubJwk);
    const r = await verifyModaVpToken(vpToken, { ...OK, trustedIssuers: ["https://not.this.one"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/trust list/);
  });
});

describe("p256DidKey", () => {
  it("produces a p256-pub did:key and is stable for the same key", async () => {
    const kp = await generateKeyPair("ES256", { extractable: true });
    const jwk = (await exportJWK(kp.publicKey)) as JWK & { x: string; y: string };
    const did = p256DidKey(jwk);
    expect(did.startsWith("did:key:z")).toBe(true);
    expect(p256DidKey(jwk)).toBe(did); // deterministic
    // p256-pub did:keys are ~57 chars; allow a little slack for base58 length variance.
    expect(did.length).toBeGreaterThan(50);
    expect(did.length).toBeLessThan(64);
  });
});
