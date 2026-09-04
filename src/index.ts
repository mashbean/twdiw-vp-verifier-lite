import qrcode from "qrcode-generator";
import { PresentationSession } from "./session";
import { VerifierIdentity } from "./identity";
import { FRONTEND_CSS, FRONTEND_HTML, FRONTEND_JS } from "./frontend";
import { getProfile, getVariant, publicProfiles, type CredentialSource, type WalletFamily } from "./profiles";
import { PRIVACY_NOTICE, privacyCategoriesForClaims } from "./privacy-notice";
import { ZkpSession } from "./zkp";
import { warmZkpContainer, ZkpVerifierContainer } from "./zkp-container";
import { ZKP_CSS, ZKP_HTML, ZKP_JS } from "./zkp-frontend";
import {
  CLAIM_LABELS,
  DEFAULT_MINIMUM_AGE,
  DEFAULT_PURPOSE,
  isZkpCredentialSource,
  MAX_MINIMUM_AGE,
  MAX_PACKAGE_CHARS,
  MAX_PURPOSE_CHARS,
  MIN_MINIMUM_AGE,
  parseMinimumAge,
  REQUEST_GRACE_MS,
  REQUEST_LIFETIME_MS,
  sanitizePurpose,
  SOURCE_LABELS,
  chooseZkpBackend,
} from "./zkp-statement";

export { PresentationSession, VerifierIdentity, ZkpSession, ZkpVerifierContainer };

// The ZKP request carries a zh-Hant purpose. The library's default encoder keeps
// only the low byte of each UTF-16 code unit, so opt into UTF-8 — a no-op for
// the ASCII deep links the OIDC4VP QR carries.
qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

const MAX_CREATE_BODY = 8_192;
const MAX_PRESENTATION_BODY = 512_000;
const MAX_ZKP_BODY = MAX_PACKAGE_CHARS;

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

/** The native age-proof verifier is optional; without it the /zkp page only explains itself. */
function zkpConfigured(env: Env): boolean {
  return chooseZkpBackend(env) !== "none";
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && (path === "/" || path === "/index.html")) {
      return staticAsset(request, FRONTEND_HTML, "text/html");
    }
    if (request.method === "GET" && path === "/app.css") return staticAsset(request, FRONTEND_CSS, "text/css");
    if (request.method === "GET" && path === "/app.js") return staticAsset(request, FRONTEND_JS, "text/javascript");
    if (request.method === "GET" && path === "/zkp") return staticAsset(request, ZKP_HTML, "text/html");
    if (request.method === "GET" && path === "/zkp.css") return staticAsset(request, ZKP_CSS, "text/css");
    if (request.method === "GET" && path === "/zkp.js") return staticAsset(request, ZKP_JS, "text/javascript");

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
      const authorizeBase = wallet === "twdiw" ? "modadigitalwallet://authorize" : "openid4vp://";
      const qr = `${authorizeBase}?client_id=${encodeURIComponent(identity.didKey)}&request_uri=${encodeURIComponent(requestUri)}`;
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

    if (request.method === "GET" && path === "/api/zkp/config") {
      return json(request, {
        configured: zkpConfigured(env),
        backend: chooseZkpBackend(env),
        requestLifetimeMs: REQUEST_LIFETIME_MS,
        sessionGraceMs: REQUEST_GRACE_MS,
        defaultMinimumAge: DEFAULT_MINIMUM_AGE,
        minimumAgeRange: [MIN_MINIMUM_AGE, MAX_MINIMUM_AGE],
        defaultPurpose: DEFAULT_PURPOSE,
        maxPurposeChars: MAX_PURPOSE_CHARS,
        sourceLabels: SOURCE_LABELS,
        claimLabels: CLAIM_LABELS,
        privacyNotice: PRIVACY_NOTICE,
      });
    }

    if (request.method === "POST" && path === "/api/zkp/sessions") {
      if (!zkpConfigured(env)) return json(request, { error: "zkp verifier backend is not configured" }, { status: 503 });
      const declaredLength = Number(request.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_CREATE_BODY) return json(request, { error: "request body is too large" }, { status: 413 });
      const raw = await request.text();
      if (raw.length > MAX_CREATE_BODY) return json(request, { error: "request body is too large" }, { status: 413 });
      let body: { credentialSource?: unknown; minimumAge?: unknown; purpose?: unknown };
      try { body = raw ? JSON.parse(raw) as typeof body : {}; }
      catch { return json(request, { error: "request body must be JSON" }, { status: 400 }); }
      const source = body.credentialSource;
      if (!isZkpCredentialSource(source)) return json(request, { error: "unsupported credential source" }, { status: 400 });
      const minimumAge = parseMinimumAge(body.minimumAge);
      if (minimumAge === null) return json(request, { error: `minimumAge must be an integer between ${MIN_MINIMUM_AGE} and ${MAX_MINIMUM_AGE}` }, { status: 400 });
      const purpose = sanitizePurpose(body.purpose);
      if (purpose === null) return json(request, { error: `purpose must be 1 to ${MAX_PURPOSE_CHARS} characters without control characters` }, { status: 400 });

      const id = crypto.randomUUID();
      const resultKey = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const origin = publicOrigin(request, env);
      const responseUrl = `${origin}/api/zkp/response/${id}`;
      const created = await env.ZKP_SESSIONS.getByName(id).init({
        resultKey,
        credentialSource: source,
        minimumAge,
        purpose,
        responseUrl,
      });
      // Wake the container while the holder is still scanning. Their phone
      // needs about twenty seconds to build the proof pair, which is longer
      // than a cold start, so the boot is free if it begins now.
      ctx.waitUntil(warmZkpContainer(env));
      const eventsUrl = `${origin.replace(/^http/, "ws")}/api/zkp/events/${id}`;
      return json(request, {
        id,
        resultKey,
        eventsUrl,
        request: created.request,
        qrSvg: qrSvg(created.request),
        responseUrl,
        cutoffDate: created.cutoffDate,
        minimumAge: created.minimumAge,
        credentialSource: created.credentialSource,
        purpose: created.purpose,
        expiresAt: created.expiresAt,
        lifetimeMs: created.lifetimeMs,
      });
    }

    const zkpResponseMatch = path.match(/^\/api\/zkp\/response\/([0-9a-f-]{36})$/);
    if (request.method === "POST" && zkpResponseMatch && validSessionId(zkpResponseMatch[1])) {
      const contentType = request.headers.get("content-type");
      if (contentType && !contentType.toLowerCase().startsWith("application/json")) {
        return json(request, { status: "failed", reason: "content type must be application/json" }, { status: 415 });
      }
      const declaredLength = Number(request.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_ZKP_BODY) return json(request, { status: "failed", reason: "proof package is too large" }, { status: 413 });
      const body = await request.text();
      if (body.length > MAX_ZKP_BODY) return json(request, { status: "failed", reason: "proof package is too large" }, { status: 413 });
      const outcome = await env.ZKP_SESSIONS.getByName(zkpResponseMatch[1]).submit(body);
      return json(request, outcome.body, { status: outcome.httpStatus });
    }

    const zkpEventsMatch = path.match(/^\/api\/zkp\/events\/([0-9a-f-]{36})$/);
    if (request.method === "GET" && zkpEventsMatch && validSessionId(zkpEventsMatch[1])) {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return respond(request, "expected websocket", { status: 426, headers: { "cache-control": "no-store" } });
      }
      return env.ZKP_SESSIONS.getByName(zkpEventsMatch[1]).fetch(request);
    }

    return respond(request, "not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  },
} satisfies ExportedHandler<Env>;
