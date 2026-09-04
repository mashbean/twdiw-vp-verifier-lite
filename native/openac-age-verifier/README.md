# openac-age-verifier

Native verifier for the 有備而來 (Bonds) **OpenAC age-predicate proof**: a
Spartan2/Hyrax `Prepare` proof over an ES256 SD-JWT issuer signature plus a
linked `Show` proof over the verifier's nonce and the predicate
「hidden birth date ≤ cutoff」. The Cloudflare Worker at `verifier.mashbean.net`
(`/zkp`) cannot hold the 432 MB Prepare verifying key, so it forwards each proof
package here and learns only the verdict and timings.

The proof system, circuits and key files are the ones the iOS binding was built
from: `ethereum/zkID` at commit `b395e09c225ff45b003f0087c28e2e208e22f944`
(`Native/OpenACAge/` in `bonds-tw/backupTW-iOS`), Spartan2 `openac-sdk`
branch at `d687dbb6`, keys from the immutable `openac-age-v1` release. The
statement layout in `src/main.rs` mirrors `predicate.rs` in that overlay; the
two must change together.

## Run

```sh
scripts/download-keys.sh                       # pinned gzip + installed SHA-256
OPENAC_AGE_VERIFIER_TOKEN=$(openssl rand -hex 24) \
OPENAC_AGE_KEYS_DIR=keys cargo run --release   # listens on 127.0.0.1:8787
```

`scripts/run-local.sh [--publish]` does the same, opens a Cloudflare quick
tunnel (`*.trycloudflare.com`, no DNS permission required) and, with
`--publish`, stores the tunnel URL and token in the Worker as the
`ZKP_VERIFIER_URL` / `ZKP_VERIFIER_TOKEN` secrets. Quick-tunnel URLs change on
every start; a named tunnel with a DNS route is the durable option.

The service refuses to start unless both verifying keys match the release
pins, and refuses every request without the bearer token unless
`OPENAC_AGE_ALLOW_UNAUTHENTICATED=1` (loopback experiments only).

## API

`GET /healthz` → `{ok, assetRelease, prepareVerifyingKeySha256, showVerifyingKeySha256, uptimeSeconds, authRequired}`

`POST /verify` (`Authorization: Bearer …`, JSON, ≤ 8 MB)

```json
{"prepareProof":"<base64>","showProof":"<base64>","nonce":"…","claimName":"roc_birthday",
 "claimFormat":3,"cutoff":970904,"issuerKeyX":"<base64url>","issuerKeyY":"<base64url>"}
```

→ `200 {accepted, reason, loadMs, verifyMs, prepareProofBytes, showProofBytes, statement:{nonceSha256Prefix, claimName, claimFormat, cutoff, publicValueCount}, assetRelease}`;
`400 {error}` for malformed statements or proofs that do not deserialise;
`401` without the token.

`claimFormat` 2 = ISO `YYYYMMDD`, 3 = ROC `YYYMMDD`; `cutoff` is the packed
date in the same format. The expected public values are rebuilt from the
verifier-chosen nonce, claim name, format, cutoff and the independently
resolved issuer key — nothing inside the proof package is trusted as policy.

## What it logs

Verdict, timings, claim name/format/cutoff and the first 8 bytes of the nonce's
SHA-256. Never the proofs, the nonce itself, or an issuer key.
