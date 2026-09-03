// Verifying the TWDIW / 有備而來 presentation dialect.
//
// Unlike a standards SD-JWT-VC presentation (where the holder binding is a KB-JWT
// on the credential), the 有備而來 wallet — matching the official moda app — wraps
// the credential in an *outer* VerifiablePresentation JWT and does the holder
// binding there. The `vp_token` it posts is that VP JWT:
//
//   header:  { typ:"JWT", alg:"ES256", jwk:<holder P-256 key> }
//   payload: { iss, sub:<holder did>, aud:<verifier did:key>, nonce, nbf, exp,
//              vp:{ context:[…v1], type:["VerifiablePresentation"],
//                   verifiableCredential:[ "<issuer-jwt>~<disc>~…~" ] } }
//
// The inner credential carries **no KB-JWT** (it ends with `~`); possession is
// proved by the outer signature instead. So verification is:
//   1. outer VP JWT signature against its header `jwk`, plus `aud` == our client_id
//      and `nonce` == the nonce we issued (replay protection);
//   2. the inner SD-JWT-VC — issuer signature, disclosures, revocation — via the
//      shared `verifyIssuerCredential`;
//   3. **the binding**: the credential's `cnf` key must equal the outer signing
//      key, or anyone could wrap someone else's credential in their own VP.

import { calculateJwkThumbprint, decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";
import { verifyIssuerCredential, type VerifyResult } from "./verify";

interface ModaVerifyOptions {
  expectedNonce: string;
  expectedAudience: string; // our did:key client_id
  trustedIssuers: string[];
}

export async function verifyModaVpToken(
  vpToken: string,
  opts: ModaVerifyOptions,
): Promise<VerifyResult & { holderBound?: boolean }> {
  try {
    // 1. Outer VP JWT: verify against the holder key carried in its own header.
    const header = decodeProtectedHeader(vpToken) as { alg?: string; jwk?: JWK };
    if (!header.jwk) return { ok: false, reason: "vp_token header has no holder jwk" };
    if (header.alg !== "ES256") return { ok: false, reason: "vp_token must use ES256" };
    const holderKey = await importJWK(header.jwk, header.alg ?? "ES256");
    const { payload } = await jwtVerify(vpToken, holderKey as never, {
      audience: opts.expectedAudience,
      algorithms: ["ES256"],
    }); // checks signature, aud, exp, nbf
    if (payload.nonce !== opts.expectedNonce) {
      return { ok: false, reason: "vp_token nonce mismatch" };
    }

    // 2. Pull the inner credential out of the presentation.
    const vp = payload.vp as { verifiableCredential?: unknown } | undefined;
    const list = vp?.verifiableCredential;
    const inner = Array.isArray(list) ? list[0] : list;
    if (typeof inner !== "string" || !inner) {
      return { ok: false, reason: "vp_token carries no verifiableCredential" };
    }
    const parts = inner.split("~");
    const issuerJwt = parts[0];
    const disclosures = parts.slice(1).filter(Boolean); // trailing "~" leaves an empty tail

    const base = await verifyIssuerCredential(issuerJwt, disclosures, opts.trustedIssuers);
    if (!base.ok) return { ok: false, reason: base.reason, vct: base.vct, issuer: base.issuer, status: base.status };

    // 3. The binding: the presented credential must be bound (its `cnf`) to the key
    // that signed the presentation. Compared by JWK thumbprint so member order and
    // representation differences never matter.
    if (!base.cnf) return { ok: false, reason: "credential has no cnf to bind the presentation to" };
    const [cnfThumb, holderThumb] = await Promise.all([
      calculateJwkThumbprint(base.cnf as JWK),
      calculateJwkThumbprint(header.jwk),
    ]);
    if (cnfThumb !== holderThumb) {
      return { ok: false, reason: "presentation key does not match the credential's cnf" };
    }

    return { ok: true, vct: base.vct, issuer: base.issuer, claims: base.claims, keyBound: true, holderBound: true, status: base.status };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "vp_token verification error" };
  }
}
