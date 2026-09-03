import qrcode from "qrcode-generator";
import { PresentationSession } from "./session";
import { VerifierIdentity } from "./identity";
import { FRONTEND_CSS, FRONTEND_HTML, FRONTEND_JS } from "./frontend";
import { getProfile, getVariant, publicProfiles, type CredentialSource, type WalletFamily } from "./profiles";
import { PRIVACY_NOTICE, privacyCategoriesForClaims } from "./privacy-notice";

export { PresentationSession, VerifierIdentity };

const MAX_CREATE_BODY = 8_192;
const MAX_PRESENTATION_BODY = 512_000;

function publicOrigin(request: Request, env: Env): string {
  const configured = env.VERIFIER_ORIGIN?.trim();
  return configured ? configured.replace(/\/$/, "") : new URL(request.url).origin;
}

function securityHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {
    "content-security-policy": "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
    "cross-origin-opener-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
  if (new URL(request.url).protocol === "https:") headers["strict-transport-security"] = "max-age=31536000; includeSubDomains";
  return headers;
}

function respond(request: Request, body: BodyInit | null, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(securityHeaders(request))) headers.set(name, value);
  return new Response(body, { ...init, headers });
}

function json(request: Request, value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return respond(request, JSON.stringify(value), { ...init, headers });
}

function staticAsset(request: Request, body: string, type: string): Response {
  return respond(request, body, {
    headers: { "content-type": `${type}; charset=utf-8`, "cache-control": "public, max-age=300" },
  });
}

function qrSvg(payload: string): string {
  const code = qrcode(0, "M");
  code.addData(payload);
  code.make();
  return code.createSvgTag(5, 8);
}

function validSessionId(value: string): boolean {
  return /^[0-9a-f-]{36}$/.test(value);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && (path === "/" || path === "/index.html")) {
      return staticAsset(request, FRONTEND_HTML, "text/html");
    }
    if (request.method === "GET" && path === "/app.css") return staticAsset(request, FRONTEND_CSS, "text/css");
    if (request.method === "GET" && path === "/app.js") return staticAsset(request, FRONTEND_JS, "text/javascript");

    if (request.method === "GET" && path === "/api/profiles") {
      const profiles = publicProfiles();
      return json(request, {
        protocolProfile: "TWDIW Presentation Exchange + OIDC4VP 1.0 DCQL compatibility",
        profiles,
        privacyNotice: PRIVACY_NOTICE,
        privacyCategories: Object.fromEntries(
          profiles.flatMap((profile) => profile.variants).map((variant) => [
            variant.claims.join("|"),
            privacyCategoriesForClaims(variant.claims),
          ]),
        ),
      });
    }

    if (request.method === "GET" && path === "/api/verifier") {
      const identity = await env.IDENTITY.getByName("verifier").identity();
      return json(request, {
        didKey: identity.didKey,
        origin: publicOrigin(request, env),
        officialTrustRegistry: env.OFFICIAL_TRUST_REGISTRY_URL,
      });
    }

    if (request.method === "POST" && path === "/api/presentations") {
      const declaredLength = Number(request.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_CREATE_BODY) return json(request, { error: "request body is too large" }, { status: 413 });
      const raw = await request.text();
      if (raw.length > MAX_CREATE_BODY) return json(request, { error: "request body is too large" }, { status: 413 });
      let body: { profileId?: unknown; credentialSource?: unknown; walletFamily?: unknown };
      try { body = raw ? JSON.parse(raw) as typeof body : {}; }
      catch { return json(request, { error: "request body must be JSON" }, { status: 400 }); }
      const profile = getProfile(typeof body.profileId === "string" ? body.profileId : "adult-18");
      const source = body.credentialSource as CredentialSource;
      const wallet = (body.walletFamily ?? (source === "selfIssued" ? "bonds" : "twdiw")) as WalletFamily;
      if (!profile || !["government", "selfIssued"].includes(source)
          || !["twdiw", "bonds"].includes(wallet) || !getVariant(profile, source, wallet)) {
        return json(request, { error: "unsupported profile, wallet or credential source" }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const resultKey = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const origin = publicOrigin(request, env);
      const responseUri = `${origin}/api/response/${id}`;
      const identity = await env.IDENTITY.getByName("verifier").identity();
      await env.SESSIONS.getByName(id).init({
        clientId: identity.didKey,
        responseUri,
        resultKey,
        profileId: profile.id,
        walletFamily: wallet,
        credentialSource: source,
      });
      const requestUri = `${origin}/api/request/${id}`;
      const eventsUrl = `${origin.replace(/^http/, "ws")}/api/events/${id}`;
      const qr = `openid4vp://?client_id=${encodeURIComponent(identity.didKey)}&request_uri=${encodeURIComponent(requestUri)}`;
      return json(request, { id, resultKey, eventsUrl, qr, qrSvg: qrSvg(qr), requestUri, responseUri, clientId: identity.didKey });
    }

    const requestMatch = path.match(/^\/api\/request\/([0-9a-f-]{36})$/);
    if (request.method === "GET" && requestMatch && validSessionId(requestMatch[1])) {
      const object = await env.SESSIONS.getByName(requestMatch[1]).requestObject();
      if (!object) return respond(request, "gone", { status: 404, headers: { "cache-control": "no-store" } });
      return respond(request, object, {
        headers: { "content-type": "application/oauth-authz-req+jwt", "cache-control": "no-store" },
      });
    }

    const responseMatch = path.match(/^\/api\/response\/([0-9a-f-]{36})$/);
    if (request.method === "POST" && responseMatch && validSessionId(responseMatch[1])) {
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
        return json(request, { status: "failed", reason: "content type must be application/x-www-form-urlencoded" }, { status: 415 });
      }
      const declaredLength = Number(request.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_PRESENTATION_BODY) return json(request, { status: "failed", reason: "presentation response is too large" }, { status: 413 });
      const body = await request.text();
      if (body.length > MAX_PRESENTATION_BODY) return json(request, { status: "failed", reason: "presentation response is too large" }, { status: 413 });
      const result = await env.SESSIONS.getByName(responseMatch[1]).submit(body);
      return json(request, result, { status: result.status === "failed" ? 400 : result.status === "gone" ? 404 : 200 });
    }

    const eventsMatch = path.match(/^\/api\/events\/([0-9a-f-]{36})$/);
    if (request.method === "GET" && eventsMatch && validSessionId(eventsMatch[1])) {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return respond(request, "expected websocket", { status: 426, headers: { "cache-control": "no-store" } });
      }
      return env.SESSIONS.getByName(eventsMatch[1]).fetch(request);
    }

    return respond(request, "not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  },
} satisfies ExportedHandler<Env>;
