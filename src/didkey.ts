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

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

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
