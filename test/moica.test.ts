// End-to-end verification of the self-issued `vc+moica` OIDC4VP extension.
// All names, keys and certificates are generated throwaway fixtures.

import "reflect-metadata";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { CompactSign, SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { describe, expect, it } from "vitest";
import { jwkJcsPubDidKey, p256DidKey } from "../src/didkey";
import { verifyMoicaVpToken } from "../src/moica";

const VERIFIER_DID = "did:key:zVerifierClientIdForMoicaTest";
const NONCE = "moica-nonce-123";
const enc = new TextEncoder();

function binary(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function b64(bytes: Uint8Array): string { return btoa(binary(bytes)); }
function b64url(bytes: Uint8Array): string {
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function digestDisclosure(value: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
}

interface MintOptions {
  badDisclosure?: boolean;
  badCardSignature?: boolean;
  wrongNonce?: boolean;
  presentationDid?: "same" | "equivalent" | "unsupported";
}

async function mint(options: MintOptions = {}) {
  cryptoProvider.set(crypto as never);
  const rsa = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
    publicExponent: new Uint8Array([1, 0, 1]),
    modulusLength: 2048,
  };
  const [caKeys, citizenKeys, holderKeys] = await Promise.all([
    crypto.subtle.generateKey(rsa, true, ["sign", "verify"]),
    crypto.subtle.generateKey(rsa, true, ["sign", "verify"]),
    generateKeyPair("ES256", { extractable: true }),
  ]);
  const notBefore = new Date("2025-01-01T00:00:00Z");
  const notAfter = new Date("2030-01-01T00:00:00Z");
  const anchor = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=Throwaway MOICA Test CA",
    notBefore,
    notAfter,
    signingAlgorithm: rsa,
    keys: caKeys,
  });
  const citizen = await X509CertificateGenerator.create({
    serialNumber: "02",
    subject: "CN=測試持有人",
    issuer: anchor.subjectName,
    notBefore,
    notAfter,
    publicKey: citizenKeys.publicKey,
    signingKey: caKeys.privateKey,
    signingAlgorithm: rsa,
  });
  const anchorBase64 = anchor.toString("base64");
  const expectedTrustAnchorSHA256 = hex(await crypto.subtle.digest("SHA-256", fromB64(anchorBase64)));

  const holderJwk = await exportJWK(holderKeys.publicKey) as JWK & { x: string; y: string };
  const holderDid = p256DidKey(holderJwk);
  const presentationDid = options.presentationDid === "equivalent"
    ? jwkJcsPubDidKey(holderJwk)
    : options.presentationDid === "unsupported"
      ? "did:key:zUnsupportedHolder"
      : holderDid;
  const nameDisclosure = b64url(enc.encode(JSON.stringify(["salt-1", "name", "測試持有人"])));
  const birthdayDisclosure = b64url(enc.encode(JSON.stringify(["salt-2", "birthdate", "民國083年03月06日"])));
  const credential = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "NationalIDCredential"],
    issuer: holderDid,
    validFrom: "2026-01-01T00:00:00Z",
    credentialSubject: { id: holderDid },
    _sd: [await digestDisclosure(nameDisclosure), await digestDisclosure(birthdayDisclosure)].sort(),
  };
  const payloadBytes = enc.encode(JSON.stringify(credential));
  const payload = b64url(payloadBytes);
  const issuerJWS = await new CompactSign(payloadBytes)
    .setProtectedHeader({ alg: "ES256", typ: "vc+jwt", cty: "vc", kid: `${holderDid}#${holderDid.slice(8)}` })
    .sign(holderKeys.privateKey);
  const payloadHash = hex(await crypto.subtle.digest("SHA-256", payloadBytes));
  let citizenSignature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    citizenKeys.privateKey,
    enc.encode("bonds-tw-credential-v1:" + payloadHash),
  ));
  if (options.badCardSignature) citizenSignature[0] ^= 0xff;
  const disclosures = options.badDisclosure
    ? [b64url(enc.encode(JSON.stringify(["salt-1", "name", "另一個人"]))), birthdayDisclosure]
    : [nameDisclosure, birthdayDisclosure];
  const envelope = JSON.stringify({
    payload,
    proof: {
      tbsConstruction: "bonds-tw-credential-v1/payload-sha256-hex/RSASSA-PKCS1-v1_5-SHA256",
      certificate: citizen.toString("base64"),
      signature: b64(citizenSignature),
    },
    issuerJWS,
    disclosures,
  });
  const vpToken = await new SignJWT({
    iss: presentationDid,
    sub: presentationDid,
    nonce: options.wrongNonce ? "wrong" : NONCE,
    vp: {
      context: ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiablePresentation"],
      verifiableCredential: [envelope],
    },
  })
    .setProtectedHeader({ alg: "ES256", typ: "JWT", jwk: holderJwk })
    .setAudience(VERIFIER_DID)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(holderKeys.privateKey);

  return {
    vpToken,
    options: {
      expectedNonce: NONCE,
      expectedAudience: VERIFIER_DID,
      now: new Date("2026-09-01T00:00:00Z"),
      trustAnchorBase64: anchorBase64,
      expectedTrustAnchorSHA256,
    },
  };
}

describe("verifyMoicaVpToken", () => {
  it("verifies both signatures, holder binding, and selective disclosures", async () => {
    const fixture = await mint();
    const result = await verifyMoicaVpToken(fixture.vpToken, fixture.options);
    expect(result.ok).toBe(true);
    expect(result.keyBound).toBe(true);
    expect(result.vct).toBe("NationalIDCredential");
    expect(result.claims).toEqual({ name: "測試持有人", birthdate: "民國083年03月06日" });
  }, 15_000);

  it("accepts equivalent p256-pub and jwk_jcs-pub spellings of the same holder key", async () => {
    const fixture = await mint({ presentationDid: "equivalent" });
    const result = await verifyMoicaVpToken(fixture.vpToken, fixture.options);
    expect(result.ok).toBe(true);
    expect(result.keyBound).toBe(true);
  }, 15_000);

  it("rejects a presentation holder DID that cannot resolve to the card key", async () => {
    const fixture = await mint({ presentationDid: "unsupported" });
    const result = await verifyMoicaVpToken(fixture.vpToken, fixture.options);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/presentation holder/);
  }, 15_000);

  it("rejects a disclosure not committed by the twice-signed payload", async () => {
    const fixture = await mint({ badDisclosure: true });
    const result = await verifyMoicaVpToken(fixture.vpToken, fixture.options);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not committed/);
  }, 15_000);

  it("rejects a bad citizen-card signature", async () => {
    const fixture = await mint({ badCardSignature: true });
    const result = await verifyMoicaVpToken(fixture.vpToken, fixture.options);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/citizen-card signature/);
  }, 15_000);

  it("rejects replay under another nonce", async () => {
    const fixture = await mint({ wrongNonce: true });
    const result = await verifyMoicaVpToken(fixture.vpToken, fixture.options);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/nonce/);
  }, 15_000);
});
