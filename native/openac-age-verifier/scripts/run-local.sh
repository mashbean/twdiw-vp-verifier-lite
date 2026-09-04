#!/usr/bin/env bash
# Runs the native verifier on loopback and exposes it through a Cloudflare
# quick tunnel (a random *.trycloudflare.com URL, no DNS permission needed),
# then optionally publishes the URL and bearer token to the Worker as
# ZKP_VERIFIER_URL / ZKP_VERIFIER_TOKEN.
#
#   scripts/run-local.sh                # server + tunnel, prints the URL
#   scripts/run-local.sh --publish      # also `wrangler secret put` both values
#
# The token is generated once into .token (git-ignored) and reused so the
# Worker secret only changes when you delete that file.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
worker_dir="$(cd "$here/../.." && pwd)"
publish=0
for arg in "$@"; do [ "$arg" = "--publish" ] && publish=1; done

command -v cloudflared >/dev/null || { echo "cloudflared is required (brew install cloudflared)" >&2; exit 64; }
"$here/scripts/download-keys.sh"
if [ ! -f "$here/.token" ]; then
  LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 48 > "$here/.token"
fi
token="$(cat "$here/.token")"
bind="${OPENAC_AGE_BIND:-127.0.0.1:8787}"
port="${bind##*:}"
if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $port is already in use (a previous verifier?) — stop it first: pkill -f openac-age-verifier" >&2
  exit 75
fi

(cd "$here" && cargo build --release 2>&1 | tail -1)
OPENAC_AGE_VERIFIER_TOKEN="$token" OPENAC_AGE_BIND="$bind" OPENAC_AGE_KEYS_DIR="$here/keys" \
  "$here/target/release/openac-age-verifier" > "$here/server.log" 2>&1 &
server_pid=$!
trap 'kill $server_pid 2>/dev/null; kill ${tunnel_pid:-0} 2>/dev/null' EXIT

for _ in $(seq 1 60); do
  if curl -sf "http://$bind/healthz" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -sf "http://$bind/healthz" || { echo "server did not come up; see $here/server.log" >&2; exit 70; }
echo

cloudflared tunnel --url "http://$bind" --no-autoupdate > "$here/tunnel.log" 2>&1 &
tunnel_pid=$!
url=""
for _ in $(seq 1 60); do
  url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$here/tunnel.log" | head -1 || true)"
  [ -n "$url" ] && break
  sleep 1
done
[ -n "$url" ] || { echo "tunnel URL not found; see $here/tunnel.log" >&2; exit 70; }
echo "ZKP_VERIFIER_URL=$url"
echo "$url" > "$here/.tunnel-url"

if [ "$publish" = 1 ]; then
  (cd "$worker_dir" \
    && printf '%s' "$url" | npx wrangler secret put ZKP_VERIFIER_URL --config wrangler.mashbean.jsonc \
    && printf '%s' "$token" | npx wrangler secret put ZKP_VERIFIER_TOKEN --config wrangler.mashbean.jsonc)
  echo "published both secrets to the mashbean Worker"
else
  echo "publish with: printf '%s' \"$url\" | npx wrangler secret put ZKP_VERIFIER_URL --config wrangler.mashbean.jsonc"
fi
echo "serving; Ctrl-C stops the server and the tunnel"
wait $server_pid
