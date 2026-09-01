// Verification for the 有備而來 self-issued MyData / national-ID envelope.
//
// The OIDC4VP request and outer holder proof are standard. The inner
// `vc+moica` document is an explicit project extension and is deliberately not
// labelled `jwt_vc`: it carries the exact VC bytes, a per-card DID JWS over those
// same bytes, and a MOICA citizen-certificate signature over their digest.

import "reflect-metadata";
import { X509Certificate, cryptoProvider } from "@peculiar/x509";
import {
  calculateJwkThumbprint,
  compactVerify,
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
  type JWK,
} from "jose";
import { resolveDidKeyToJwk } from "./didkey";
import type { VerifyResult } from "./verify";

const TBS_CONSTRUCTION = "bonds-tw-credential-v1/payload-sha256-hex/RSASSA-PKCS1-v1_5-SHA256";
const TBS_PREFIX = "bonds-tw-credential-v1:";
const MOICA_G3_SHA256 = "ed793fd0d50a2a398049d598982cf01e75f873b532066caec238f800a06ca9da";

// Government-published MOICA-G3 DER. Its provenance and the independently
// checked fingerprint are recorded beside the same bytes in the iOS project.
const MOICA_G3_BASE64 = "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";

interface MoicaVerifyOptions {
  expectedNonce: string;
  expectedAudience: string;
  now?: Date;
  /** Test seam; production always uses the pinned government certificate. */
  trustAnchorBase64?: string;
  expectedTrustAnchorSHA256?: string;
}

interface Envelope {
  payload: string;
  proof: { tbsConstruction: string; certificate: string; signature: string };
  issuerJWS?: string;
  disclosures?: string[];
}

const enc = new TextEncoder();

function b64urlBytes(value: string): Uint8Array {
  const pad = value.length % 4 ? "=".repeat(4 - (value.length % 4)) : "";
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function base64Bytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json<T>(bytes: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let different = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    different |= left[index]! ^ right[index]!;
  }
  return different === 0;
}

function expectedKid(did: string): string {
  if (!did.startsWith("did:key:") || did.length === "did:key:".length) throw new Error("credential issuer is not a did:key");
  return `${did}#${did.slice("did:key:".length)}`;
}

function parseDisclosures(envelope: Envelope): Record<string, unknown> {
  const claims: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const disclosure of envelope.disclosures ?? []) {
    const decoded = json<unknown[]>(b64urlBytes(disclosure));
    if (decoded.length !== 3 || decoded.some((v) => typeof v !== "string")) {
      throw new Error("malformed self-issued disclosure");
    }
    const name = decoded[1] as string;
    if (!name || seen.has(name)) throw new Error("duplicate or empty self-issued disclosure");
    seen.add(name);
    claims[name] = decoded[2];
  }
  return claims;
}

async function verifyDisclosureCommitments(envelope: Envelope, credential: Record<string, unknown>): Promise<Record<string, unknown>> {
  const committed = new Set(Array.isArray(credential._sd) ? credential._sd.map(String) : []);
  const claims = parseDisclosures(envelope);
  for (const disclosure of envelope.disclosures ?? []) {
    const digest = hex(await crypto.subtle.digest("SHA-256", enc.encode(disclosure)));
    const digestBytes = Uint8Array.from(digest.match(/../g)!.map((x) => Number.parseInt(x, 16)));
    let binary = "";
    for (const byte of digestBytes) binary += String.fromCharCode(byte);
    const b64url = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (!committed.has(b64url)) throw new Error("self-issued disclosure was not committed by the signed credential");
  }
  return claims;
}

export async function verifyMoicaVpToken(vpToken: string, opts: MoicaVerifyOptions): Promise<VerifyResult> {
  try {
    cryptoProvider.set(crypto as never);
    const now = opts.now ?? new Date();

    // 1. Challenge-bound holder proof.
    const outerHeader = decodeProtectedHeader(vpToken) as { alg?: string; jwk?: JWK };
    if (!outerHeader.jwk) return { ok: false, reason: "vp_token header has no holder jwk" };
    const outerKey = await importJWK(outerHeader.jwk, outerHeader.alg ?? "ES256");
    const { payload: outer } = await jwtVerify(vpToken, outerKey as never, {
      audience: opts.expectedAudience,
      algorithms: ["ES256"],
    });
    if (outer.nonce !== opts.expectedNonce) return { ok: false, reason: "vp_token nonce mismatch" };

    const vp = outer.vp as { verifiableCredential?: unknown } | undefined;
    const list = vp?.verifiableCredential;
    const serialized = Array.isArray(list) ? list[0] : list;
    if (typeof serialized !== "string" || !serialized) return { ok: false, reason: "vp_token carries no verifiableCredential" };
    const envelope = JSON.parse(serialized) as Envelope;
    if (!envelope.payload || !envelope.proof || !envelope.issuerJWS) {
      return { ok: false, reason: "self-issued credential is missing one of its two signatures" };
    }

    const payloadBytes = b64urlBytes(envelope.payload);
    const credential = json<Record<string, unknown>>(payloadBytes);
    const subject = credential.credentialSubject as Record<string, unknown> | undefined;
    const holderDid = typeof subject?.id === "string" ? subject.id : "";
    const issuerDid = typeof credential.issuer === "string" ? credential.issuer : "";
    const types = Array.isArray(credential.type) ? credential.type.map(String) : [];
    if (!holderDid || issuerDid !== holderDid || !types.includes("NationalIDCredential")) {
      return { ok: false, reason: "self-issued credential issuer, subject or type is invalid" };
    }
    const validFrom = typeof credential.validFrom === "string" ? new Date(credential.validFrom) : null;
    const validUntil = typeof credential.validUntil === "string" ? new Date(credential.validUntil) : null;
    if ((validFrom && (!Number.isFinite(validFrom.getTime()) || now < validFrom))
        || (validUntil && (!Number.isFinite(validUntil.getTime()) || now >= validUntil))) {
      return { ok: false, reason: "self-issued credential is outside its validity window" };
    }
    if (outer.iss !== holderDid || outer.sub !== holderDid) {
      return { ok: false, reason: "presentation holder does not match the credential subject" };
    }
    const didJwk = resolveDidKeyToJwk(holderDid);
    if (!didJwk) return { ok: false, reason: "unsupported holder did:key" };
    const [didThumb, outerThumb] = await Promise.all([
      calculateJwkThumbprint(didJwk),
      calculateJwkThumbprint(outerHeader.jwk),
    ]);
    if (didThumb !== outerThumb) return { ok: false, reason: "presentation key does not match the self-issued card DID" };

    // 2. Per-card did:key signature over exactly the payload the citizen card signed.
    const issuerHeader = decodeProtectedHeader(envelope.issuerJWS) as { alg?: string; typ?: string; cty?: string; kid?: string };
    if (issuerHeader.alg !== "ES256" || issuerHeader.typ !== "vc+jwt" || issuerHeader.cty !== "vc"
        || issuerHeader.kid !== expectedKid(issuerDid)) {
      return { ok: false, reason: "self-issued card DID signature header is invalid" };
    }
    const issuerKey = await importJWK(didJwk, "ES256");
    const verifiedIssuer = await compactVerify(envelope.issuerJWS, issuerKey as never, { algorithms: ["ES256"] });
    if (!bytesEqual(verifiedIssuer.payload, payloadBytes)) {
      return { ok: false, reason: "self-issued card DID signature covers different credential bytes" };
    }

    // 3. Pinned MOICA-G3 certificate chain and citizen-card signature.
    const anchorBase64 = opts.trustAnchorBase64 ?? MOICA_G3_BASE64;
    const expectedAnchor = opts.expectedTrustAnchorSHA256 ?? MOICA_G3_SHA256;
    const anchorBytes = base64Bytes(anchorBase64);
    if (hex(await crypto.subtle.digest("SHA-256", anchorBytes)) !== expectedAnchor) {
      return { ok: false, reason: "MOICA trust anchor fingerprint mismatch" };
    }
    const anchor = new X509Certificate(anchorBytes);
    const holderCertificate = new X509Certificate(base64Bytes(envelope.proof.certificate));
    if (now < anchor.notBefore || now > anchor.notAfter || now < holderCertificate.notBefore || now > holderCertificate.notAfter) {
      return { ok: false, reason: "MOICA or holder certificate is outside its validity window" };
    }
    if (holderCertificate.issuer !== anchor.subject
        || !(await holderCertificate.verify({ publicKey: anchor.publicKey, signatureOnly: true }))) {
      return { ok: false, reason: "holder certificate was not signed by pinned MOICA-G3" };
    }
    if (envelope.proof.tbsConstruction !== TBS_CONSTRUCTION) {
      return { ok: false, reason: "unsupported citizen-card signature construction" };
    }
    const cardSignature = base64Bytes(envelope.proof.signature);
    if (cardSignature.byteLength !== 256) return { ok: false, reason: "citizen-card signature has the wrong size" };
    const payloadDigest = hex(await crypto.subtle.digest("SHA-256", payloadBytes));
    const holderKey = await holderCertificate.publicKey.export();
    const holderAlgorithm = holderKey.algorithm as unknown as {
      name?: string;
      modulusLength?: number;
      hash?: { name?: string };
    };
    if (holderAlgorithm.name !== "RSASSA-PKCS1-v1_5"
        || holderAlgorithm.modulusLength !== 2048
        || holderAlgorithm.hash?.name !== "SHA-256") {
      return { ok: false, reason: "citizen certificate does not use the required RSA-2048 SHA-256 key" };
    }
    const cardSignatureValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      holderKey,
      cardSignature,
      enc.encode(TBS_PREFIX + payloadDigest),
    );
    if (!cardSignatureValid) return { ok: false, reason: "citizen-card signature is invalid" };

    // 4. Open only disclosures whose digests are in the twice-signed payload.
    const claims = await verifyDisclosureCommitments(envelope, credential);
    const certificateName = holderCertificate.subjectName.getField("CN")[0];
    if (typeof claims.name === "string" && certificateName
        && claims.name.normalize("NFC") !== certificateName.normalize("NFC")) {
      return { ok: false, reason: "disclosed name differs from the citizen certificate" };
    }

    return {
      ok: true,
      vct: "NationalIDCredential",
      issuer: issuerDid,
      claims,
      keyBound: true,
      // No online MOICA revocation statement is claimed by this verifier yet.
      status: "unknown",
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "self-issued credential verification error" };
  }
}
