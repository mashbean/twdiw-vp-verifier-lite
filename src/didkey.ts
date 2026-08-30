// did:key for a P-256 public key, in the `p256-pub` spelling (multicodec 0x1200,
// payload a 33-byte compressed point, base58btc, ~57 chars):
//
//     did:key:zDnae…
//
// This is the spelling the 有備而來 wallet's `DIDKey` produces and can resolve
// (`DIDKey.p256PublicKey(fromDID:)`). The wallet tries the TWDIW `jwk_jcs-pub`
// codec first and falls back to this one, so a `p256-pub` DID resolves fine — and
// it is far simpler to build here than canonical-JSON-in-base58. The verifier uses
// it as its `client_id`, and the wallet takes the request-signing key from it.

import type { JWK } from "jose";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < B58.length; i++) m[B58[i]] = i;
  return m;
})();

function base58btcEncode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (let k = 0; k < zeros; k++) out += "1";
  for (let q = digits.length - 1; q >= 0; q--) out += B58[digits[q]];
  return out;
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function base58btcDecode(s: string): Uint8Array {
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < s.length; i++) {
    let carry = B58_MAP[s[i]];
    if (carry === undefined) throw new Error("invalid base58 character");
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let k = 0; k < bytes.length; k++) out[zeros + bytes.length - 1 - k] = bytes[k];
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// P-256 field prime, and the curve's `b`. `a = -3`. p ≡ 3 (mod 4), so a square
// root is `v^((p+1)/4) mod p` — no general Tonelli–Shanks needed.
const P256_P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const P256_B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

/** Decompress a 33-byte SEC1 compressed P-256 point into a public JWK. */
function decompressP256(compressed: Uint8Array): JWK {
  if (compressed.length !== 33 || (compressed[0] !== 0x02 && compressed[0] !== 0x03)) {
    throw new Error("bad compressed P-256 point");
  }
  let x = 0n;
  for (let i = 1; i < 33; i++) x = (x << 8n) | BigInt(compressed[i]);
  const rhs = (x * x * x - 3n * x + P256_B) % P256_P; // y^2 = x^3 - 3x + b
  let y = modPow((rhs + P256_P) % P256_P, (P256_P + 1n) / 4n, P256_P);
  const wantOdd = compressed[0] === 0x03;
  if ((y & 1n) === 1n !== wantOdd) y = P256_P - y;
  const toBytes = (n: bigint) => {
    const out = new Uint8Array(32);
    for (let i = 31; i >= 0; i--) { out[i] = Number(n & 0xffn); n >>= 8n; }
    return out;
  };
  return { kty: "EC", crv: "P-256", x: bytesToB64url(compressed.slice(1)), y: bytesToB64url(toBytes(y)) };
}

/**
 * Resolve a `did:key` to the public JWK it carries — locally, no network.
 * Handles both spellings the TWDIW ecosystem uses:
 *   - `jwk_jcs-pub` (multicodec 0xEB51, varint `D1 D6 03`): the payload IS the JWK
 *     as JSON — moda's issuers and the 有備而來 holder use this;
 *   - `p256-pub` (multicodec 0x1200, varint `80 24`): a 33-byte compressed point.
 * Returns null for anything else, so the caller can fall back to metadata fetch.
 */
export function resolveDidKeyToJwk(did: string): JWK | null {
  const prefix = "did:key:z";
  if (!did.startsWith(prefix)) return null;
  let bytes: Uint8Array;
  try {
    bytes = base58btcDecode(did.slice(prefix.length));
  } catch {
    return null;
  }
  if (bytes[0] === 0xd1 && bytes[1] === 0xd6 && bytes[2] === 0x03) {
    try {
      return JSON.parse(new TextDecoder().decode(bytes.slice(3))) as JWK;
    } catch {
      return null;
    }
  }
  if (bytes[0] === 0x80 && bytes[1] === 0x24) {
    try {
      return decompressP256(bytes.slice(2));
    } catch {
      return null;
    }
  }
  return null;
}

/** `did:key:z…` (p256-pub) for a P-256 public JWK (`x`, `y` are base64url, 32 bytes each). */
export function p256DidKey(publicJwk: { x: string; y: string }): string {
  const x = b64urlToBytes(publicJwk.x);
  const y = b64urlToBytes(publicJwk.y);
  if (x.length !== 32 || y.length !== 32) throw new Error("bad P-256 coordinate length");
  // Compressed point: 0x02 if Y is even, 0x03 if odd, then X.
  const compressed = new Uint8Array(33);
  compressed[0] = (y[31] & 1) === 0 ? 0x02 : 0x03;
  compressed.set(x, 1);
  // multicodec p256-pub (0x1200) as the LEB128 varint 0x80 0x24.
  const full = new Uint8Array(2 + compressed.length);
  full[0] = 0x80;
  full[1] = 0x24;
  full.set(compressed, 2);
  return "did:key:z" + base58btcEncode(full);
}

/** `did:key:z2dmz…` (jwk_jcs-pub) for an EC public JWK — the spelling moda's
 *  issuers and the 有備而來 holder use. The payload is the JWK as JCS JSON. */
export function jwkJcsPubDidKey(jwk: { kty: string; crv: string; x: string; y: string }): string {
  // JCS orders members by code unit: crv < kty < x < y.
  const jcs = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  const payload = new TextEncoder().encode(jcs);
  const full = new Uint8Array(3 + payload.length);
  full[0] = 0xd1;
  full[1] = 0xd6;
  full[2] = 0x03; // multicodec jwk_jcs-pub (0xEB51) as a varint
  full.set(payload, 3);
  return "did:key:z" + base58btcEncode(full);
}
