# mashbean VP verifier

An **OIDC4VP verifier (VP host)** for Taiwan **TWDIW SD-JWT-VC** credentials, running
on **Cloudflare Workers**. It shows a QR the「有備而來 / Bonds」wallet scans, receives
the presentation over `direct_post`, and verifies the SD-JWT-VC (issuer signature +
disclosures + holder key-binding) — all at the edge, no server to run.

This is **Phase 1** from the研究 plan: a working cross-device demo. It is written to
the current specs but has **not been tested against a real moda-issued credential** —
do that (and pin the issuer trust anchor) before trusting any result.

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
(flat, nested, and `...` array digests) → key-binding JWT against the credential's
`cnf` key, checking `nonce` (== ours), `aud` (== our client_id), and `sd_hash` →
`exp`/`nbf`.

## Run it

```bash
npm install
npx wrangler login          # your Cloudflare account
npm run dev                 # http://localhost:8787  — open it, a QR appears
```

Deploy:

```bash
npm run deploy
# then point verifier.mashbean.net at the Worker (Cloudflare dashboard → Workers →
# Custom Domains), or uncomment the `routes` block in wrangler.toml and redeploy.
# Set VERIFIER_ORIGIN=https://verifier.mashbean.net so response_uri is reachable.
```

## Before you trust a result — the real gate

1. **Get a moda TWDIW test setup:** a test wallet, a test SD-JWT-VC credential, and
   the issuer's JWKS / trust anchor. Set `TRUSTED_ISSUERS` (wrangler.toml `[vars]`,
   or `wrangler secret`) to moda's `iss` so any other issuer is rejected. Without a
   pinned issuer this verifies *any* resolvable signature — demo only.
2. **Confirm the `client_id` scheme the TWDIW wallet requires.** Phase 1 uses the
   unauthenticated `redirect_uri` scheme (`client_id == response_uri`). moda may
   require `x509_san_dns` (a signing cert whose SAN is `verifier.mashbean.net`,
   **separate** from Cloudflare's TLS cert, stored in Workers Secrets) or a
   registered `client_id`. That determines whether the wallet will present at all.
3. **Test the whole loop** against the real wallet on a phone: scan → choose fields →
   the result appears here.

## Deferred to later phases (research plan)

- Signed request objects (`request_uri` → JAR) so the request is authenticated.
- **Token Status List** revocation check.
- `direct_post.jwt` (encrypted responses).
- `transaction_data` binding; an audit log (D1).
- **ZK layer** — BBS-2023 / zk-SNARK predicate proofs, likely a separate off-edge
  service behind the same `verify()` interface.

## Notes

- `nodejs_compat` is on for `jose`. All crypto is Web Crypto (ES256 / EdDSA) — native
  on Workers.
- The front-end loads a QR library from jsDelivr; inline it if you want zero external
  requests.
- Not affiliated with 數位發展部 / moda. Verifies credentials that ecosystem issues.
