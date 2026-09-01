# mashbean VP verifier

An **OIDC4VP verifier (VP host)** for Taiwan **TWDIW SD-JWT-VC** credentials, running
on **Cloudflare Workers**. It shows a QR the「有備而來 / Bonds」wallet scans, receives
the presentation over `direct_post`, and verifies the SD-JWT-VC (issuer signature +
disclosures + holder key-binding) — all at the edge, no server to run.

This is **Phase 1** from the研究 plan: a working cross-device demo. The verification
logic is now **tested end-to-end** against a self-minted credential (`npm test`,
below) — the good path plus every rejection (bad nonce, wrong audience, wrong holder
key, untrusted issuer, revoked/suspended status). It has **not yet been tested against
a real moda-issued credential**; do that — and pin the issuer trust anchor, and
confirm the `client_id` scheme moda's wallet requires — before trusting any result.

## Architecture

```
verifier.mashbean.net
├── Worker (src/index.ts)         routing + the OIDC4VP flow
│    GET  /                       front-end (QR + result poll)
│    POST /api/presentations      mint a session → openid4vp:// QR payload
│    GET  /api/request/:id        the Authorization Request object (wallet fetches)
│    POST /api/response/:id       direct_post: receive vp_token → verify
│    GET  /api/result/:id         the verdict + disclosed claims (front-end polls)
├── Durable Object (src/session.ts)   per-session nonce + result, strong consistency, 10-min alarm
└── src/verify.ts                 SD-JWT-VC verification (jose + Web Crypto)
```

Verification (`src/verify.ts`), in order: issuer JWT signature against the issuer's
`.well-known/jwt-vc-issuer` JWKS → disclosures re-hashed and matched into `_sd`
(flat, nested, and `...` array digests; values decoded as UTF-8 so Chinese names and
addresses survive) → key-binding JWT against the credential's `cnf` key, checking
`nonce` (== ours), `aud` (== our client_id), and `sd_hash` → revocation via the
credential's **Token Status List** reference → `exp`/`nbf`.

Revocation is fail-**open** on "unknown" (no status claim, or the list unreachable):
a definite revoked/suspended blocks the result, but an unreachable list does not.
Production should fail-closed instead — see the note in `checkRevocation`.

## Run it

```bash
npm install
npm test                    # verification suite — no network, no Cloudflare account
npx wrangler login          # your Cloudflare account
npm run dev                 # http://localhost:8787  — open it, a QR appears
```

Deploy:

```bash
npm run deploy
```

**Live now** at **https://verifier.mashbean.net**. Open it in a browser to get a
QR; the OIDC4VP flow — session mint, Authorization Request object,
`presentation_submission`, `direct_post` response and result poll — is hosted on
the Cloudflare Worker + Durable Object deployment. `VERIFIER_ORIGIN` is pinned
to that custom domain, so a request opened through another Worker hostname
cannot silently change the audience or response endpoint.

## Before you trust a result — the real gate

1. **Government issuer pin:** production is pinned to the exact `iss` carried by
   the 2026-08-30 device-test card. The same DID was rechecked against the
   official API and its current, non-revoked Arbitrum registry record on
   2026-09-01. Government sessions fail closed if the configured list is empty;
   adding another issuer requires the same independent check before deploy.
2. **Confirm the `client_id` scheme the TWDIW wallet requires.** Phase 1 uses the
   unauthenticated `redirect_uri` scheme (`client_id == response_uri`). moda may
   require `x509_san_dns` (a signing cert whose SAN is `verifier.mashbean.net`,
   **separate** from Cloudflare's TLS cert, stored in Workers Secrets) or a
   registered `client_id`. That determines whether the wallet will present at all.
3. **Test the whole loop** against the real wallet on a phone: scan → choose fields →
   the result appears here.

## Deferred to later phases (research plan)

- Signed request objects (`request_uri` → JAR) so the request is authenticated.
- `direct_post.jwt` (encrypted responses).
- `transaction_data` binding; an audit log (D1).
- **ZK layer is deliberately not an OIDC `direct_post` response here.** The app's
  verifier-first OpenAC age predicate uses a one-time request and local
  Bluetooth return so its proof can be checked fully offline after public keys
  are prepared.

## Notes

- `nodejs_compat` is on for `jose`. All crypto is Web Crypto (ES256 / EdDSA) — native
  on Workers.
- The front-end loads a QR library from jsDelivr; inline it if you want zero external
  requests.
- Not affiliated with 數位發展部 / moda. Verifies credentials that ecosystem issues.
