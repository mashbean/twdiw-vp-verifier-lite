// OIDC4VP verifier (VP host) — Worker entry.
//
// Flow (OpenID4VP 1.0, cross-device, direct_post):
//   1. front-end  POST /api/presentations  → mint a session (Durable Object),
//      return the openid4vp:// QR payload.
//   2. wallet scans → GET /api/request/:id  → the Authorization Request object.
//   3. wallet      POST /api/response/:id    → the vp_token (direct_post); we verify.
//   4. front-end   GET /api/result/:id       → the verdict + disclosed claims.
//
// Phase-1 uses the unauthenticated `redirect_uri` client_id scheme (client_id ==
// response_uri) — demo-grade. Production needs the verifier trust scheme moda's
// wallet requires (x509_san_dns / a registered client_id); see README.

import { PresentationSession } from "./session";
import { FRONTEND_HTML } from "./frontend";

export { PresentationSession };

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
      const clientId = responseUri; // redirect_uri scheme
      await session(env, id).call("/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, responseUri, vct: body.vct ?? undefined }),
      });
      const requestUri = `${base}/api/request/${id}`;
      const qr = `openid4vp://?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`;
      return Response.json({ id, qr, requestUri, responseUri });
    }

    // 2. The Authorization Request object the wallet fetches.
    const reqMatch = path.match(/^\/api\/request\/([0-9a-f-]{36})$/);
    if (req.method === "GET" && reqMatch) {
      return session(env, reqMatch[1]).call("/request");
    }

    // 3. direct_post from the wallet.
    const resMatch = path.match(/^\/api\/response\/([0-9a-f-]{36})$/);
    if (req.method === "POST" && resMatch) {
      // Forward the form body to the session for verification.
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
