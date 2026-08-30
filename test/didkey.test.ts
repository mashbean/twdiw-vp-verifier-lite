// did:key resolution — the fix for the live test's "Invalid URL: null/.well-known…"
// error, which showed moda's issuers name themselves with a did:key that embeds
// their key rather than an https URL.

import { describe, it, expect } from "vitest";
import { generateKeyPair, exportJWK, type JWK } from "jose";
import { p256DidKey, jwkJcsPubDidKey, resolveDidKeyToJwk } from "../src/didkey";

describe("resolveDidKeyToJwk", () => {
  it("resolves the real moda issuer did:key (jwk_jcs-pub) from the live test", () => {
    // The exact `iss` the 有備而來 government card carried, from the 2026-08-30 run.
    const did =
      "did:key:z2dmzD81cgPx8Vki7JbuuMmFYrWPgYoytykUZ3eyqht1j9Kbptwspp6uLnxpQQwn6TjHDw31q6bpSprrhMuKSkozn8R25MLf5g5H64FpiFmhCxKiU7JpU5dgBx3UbiSunqJ2a1athYQ88y4gYigJJefB1mybvtAssdMu2BUS3MwFe6pg4C";
    const jwk = resolveDidKeyToJwk(did);
    expect(jwk).not.toBeNull();
    expect(jwk!.kty).toBe("EC");
    expect(jwk!.crv).toBe("P-256");
    // 32-byte coordinates → 43-char unpadded base64url.
    expect((jwk!.x as string).length).toBe(43);
    expect((jwk!.y as string).length).toBe(43);
  });

  it("round-trips a jwk_jcs-pub did:key built from a fresh key", async () => {
    const kp = await generateKeyPair("ES256", { extractable: true });
    const pub = (await exportJWK(kp.publicKey)) as JWK & { kty: string; crv: string; x: string; y: string };
    const did = jwkJcsPubDidKey(pub);
    expect(did.startsWith("did:key:z2dmz") || did.startsWith("did:key:z")).toBe(true);
    const resolved = resolveDidKeyToJwk(did)!;
    expect(resolved.x).toBe(pub.x);
    expect(resolved.y).toBe(pub.y);
  });

  it("round-trips a p256-pub did:key (compressed point → decompressed JWK)", async () => {
    const kp = await generateKeyPair("ES256", { extractable: true });
    const pub = (await exportJWK(kp.publicKey)) as JWK & { x: string; y: string };
    const did = p256DidKey(pub);
    const resolved = resolveDidKeyToJwk(did)!;
    expect(resolved.kty).toBe("EC");
    expect(resolved.crv).toBe("P-256");
    // Decompression must recover the exact affine coordinates.
    expect(resolved.x).toBe(pub.x);
    expect(resolved.y).toBe(pub.y);
  });

  it("returns null for a non-did:key string", () => {
    expect(resolveDidKeyToJwk("https://issuer.test")).toBeNull();
  });
});
