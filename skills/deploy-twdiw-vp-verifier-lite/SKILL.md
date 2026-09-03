---
name: deploy-twdiw-vp-verifier-lite
description: Deploy or embed mashbean/twdiw-vp-verifier-lite as a Cloudflare Workers OIDC4VP verifier for Taiwan Digital Identity Wallet credentials. Use when configuring a new verifier, adding a custom domain or verification profile, integrating its API into an existing service, or updating a deployment without losing its did:key.
---

# Deploy TWDIW VP Verifier Lite

Deploy or integrate the verifier with explicit privacy, trust, and real-device acceptance boundaries.

## Establish the mode

Determine which outcome is requested:

- New standalone Cloudflare deployment
- Update to an existing deployment
- API integration into an existing service
- A new verification profile

Confirm the public HTTPS origin, desired credential wallets, verification purpose, and claims. The lite deployment uses the official DID registry and intentionally has no environment-variable issuer bypass.

## Read project guidance

Read `README.md` and `docs/embedding.md` before editing. Use the repository root `wrangler.jsonc` for new deployments. `wrangler.mashbean.jsonc` belongs only to the maintained demo deployment.

For current Cloudflare CLI syntax or platform limits, consult official Cloudflare Workers documentation rather than relying on remembered commands.

## Preserve verifier identity

An installation's P-256 verifier key lives in the `VerifierIdentity` Durable Object. When updating an existing service, preserve its Worker and Durable Object namespace. A renamed or newly provisioned namespace creates a different `did:key` and must be treated as a new verifier identity.

Never place private keys in source, configuration, logs, or browser responses.

## Design claims from purpose

Start from the business decision, then request the minimum claims needed for that decision. Inspect a redacted schema or controlled test credential before naming claims. Do not assume that similarly named cards share claim keys.

If any required claim is absent, the wallet may decline to present the credential. Do not silently substitute another field because it looks semantically similar.

Government-issued cards must remain fail-closed against the official DID registry. Supporting a private issuer requires an explicit fork with its own trust policy and review; do not ask a deployer to paste a DID into a generic `trusted issuer` field.

## Integrate safely

Prefer one of these patterns:

1. Link to a fixed `?profile=...&source=...` verifier page.
2. Put the verifier behind the same origin and call its API from the browser.
3. Call the verifier API from the existing service's backend and proxy the one-time result WebSocket without persisting the result.

Do not weaken `frame-ancestors 'none'` merely to support iframe embedding. Do not log credentials, presentations, QR payloads, disclosures, result capabilities, or personal data.

The QR may contain the OIDC4VP `client_id` and `request_uri`. It must not contain `resultKey`. Authenticate the result WebSocket by sending the capability as the first WebSocket message, never in a URL.

Do not persist credential, presentation, disclosed claims, or result objects in Durable Objects, KV, D1, R2, logs, traces, analytics, or an application database. Only pending-session metadata may be stored, and it must be deleted immediately after completion or by the 10-minute alarm.

Keep the pre-presentation privacy notice module. Replace the demo controller, contact, purpose, lawful basis, categories, period, region, recipients, method, rights process, and refusal effect with the operator's real information. Read `docs/privacy-compliance.md`; do not represent the template as legal advice or automatic compliance certification. The notice must update with the selected profile and appear before the QR is created.

## Validate before reporting completion

Run:

```bash
npm test
npm run typecheck
npm run cf-typegen
npx wrangler deploy --dry-run
```

After an authorized deployment, confirm the canonical HTTPS page and `/api/profiles` both return HTTP 200. Create a presentation and inspect that the QR and signed request exclude `resultKey`.

Confirm that switching profiles updates the privacy purpose and data categories, and that QR creation remains disabled until the notice is acknowledged.

Report fixture tests, deployed endpoint checks, and real-wallet acceptance separately. A local pass or deployment does not establish that a real card in both target wallets can complete a cross-device presentation.

Describe interoperability as “TWDIW Presentation Exchange plus OIDC4VP 1.0 DCQL compatibility” unless an applicable conformance suite has actually passed. Do not claim OpenID Foundation certification.

## Handoff

Report:

- Completed implementation and deployment state
- Public origin and repository revision
- Whether the verifier `did:key` was preserved
- Verification profiles and their exact claims
- Remaining real-device cases
- Any logging, retention, legal, or issuer-trust decisions the operator still owns

State clearly that deployment is not official verifier registration. Organizations seeking official status must use https://www.wallet.gov.tw/apply/applyIssuerVerifier.html; this repository is independent of that process.
