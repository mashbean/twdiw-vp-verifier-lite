// OIDC4VP verifier (VP host) — Worker entry.
//
// Flow (OpenID4VP 1.0, cross-device, direct_post):
//   1. front-end  POST /api/presentations  → mint a session (Durable Object),
//      return the openid4vp:// QR payload (client_id = the verifier's did:key).
//   2. wallet scans → GET /api/request/:id  → a SIGNED Authorization Request (JAR),
//      signed by the key in client_id — which the 有備而來 wallet requires.
//   3. wallet      POST /api/response/:id    → the vp_token (direct_post); we verify.
//      Two dialects accepted: a standards SD-JWT-VC, or a TWDIW VP JWT wrapping one.
//   4. front-end   GET /api/result/:id       → the verdict + disclosed claims.
//
// The verifier's identity (the P-256 key behind its did:key) is a singleton Durable
// Object, generated once and persisted — see src/identity.ts.

import { PresentationSession } from "./session";
import { VerifierIdentity } from "./identity";
import { FRONTEND_HTML } from "./frontend";

export { PresentationSession, VerifierIdentity };

function origin(req: Request, env: Env): string {
  if (env.VERIFIER_ORIGIN) return env.VERIFIER_ORIGIN.replace(/\/$/, "");
  return new URL(req.url).origin;
}

function session(env: Env, id: string) {
  const stub = env.SESSIONS.get(env.SESSIONS.idFromName(id));
  return {
    call: (op: string, init?: RequestInit) => stub.fetch("https://do" + op, init),
  };
}

async function verifierDidKey(env: Env): Promise<string> {
  const stub = env.IDENTITY.get(env.IDENTITY.idFromName("verifier"));
  const res = await stub.fetch("https://id/identity");
  const { didKey } = (await res.json()) as { didKey: string };
  return didKey;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Front-end.
    if (req.method === "GET" && (path === "/" || path === "/index.html")) {
      return new Response(FRONTEND_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // 1. Create a presentation session.
    if (req.method === "POST" && path === "/api/presentations") {
      const body = (await req.json().catch(() => ({}))) as { vct?: string | null };
      const id = crypto.randomUUID();
      const base = origin(req, env);
      const responseUri = `${base}/api/response/${id}`;
      // The wallet takes the request-signing key from client_id, so it must be the
      // verifier's did:key — not the response_uri (that redirect_uri scheme is what
      // the 有備而來 wallet rejects).
      const clientId = await verifierDidKey(env);
      await session(env, id).call("/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, responseUri, vct: body.vct ?? undefined }),
      });
      const requestUri = `${base}/api/request/${id}`;
      const qr = `openid4vp://?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`;
      return Response.json({ id, qr, requestUri, responseUri, clientId });
    }

    // 2. The signed Authorization Request the wallet fetches.
    const reqMatch = path.match(/^\/api\/request\/([0-9a-f-]{36})$/);
    if (req.method === "GET" && reqMatch) {
      return session(env, reqMatch[1]).call("/request");
    }

    // 3. direct_post from the wallet.
    const resMatch = path.match(/^\/api\/response\/([0-9a-f-]{36})$/);
    if (req.method === "POST" && resMatch) {
      return session(env, resMatch[1]).call("/response", {
        method: "POST",
        headers: { "content-type": req.headers.get("content-type") ?? "application/x-www-form-urlencoded" },
        body: await req.arrayBuffer(),
      });
    }

    // 4. The result the front-end polls.
    const resultMatch = path.match(/^\/api\/result\/([0-9a-f-]{36})$/);
    if (req.method === "GET" && resultMatch) {
      return session(env, resultMatch[1]).call("/result");
    }

    return new Response("not found", { status: 404 });
  },
};
