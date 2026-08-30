// One presentation session: the nonce and state we issued, the Authorization
// Request we built, and the verification result once the wallet responds. Strong,
// read-after-write consistent (unlike KV), so the nonce minted in one PoP is seen
// by the response that lands in another. Self-expires after 10 minutes.

import { verifySdJwtVc } from "./verify";
import { verifyModaVpToken } from "./moda";

interface SessionState {
  nonce: string;
  state: string;             // echoed by the wallet so we can match its POST
  clientId: string;          // the verifier's did:key — also the vp_token `aud`
  responseUri: string;
  vct?: string;              // the credential type this verifier is asking for
  status: "pending" | "verified" | "failed";
  reason?: string;
  claims?: Record<string, unknown>;
  createdAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const enc = new TextEncoder();

function b64urlJSON(obj: unknown): string {
  const s = JSON.stringify(obj);
  let bin = "";
  for (const b of enc.encode(s)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export class PresentationSession {
  private state: DurableObjectState;
  private env: Env;
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  private async load(): Promise<SessionState | undefined> {
    return this.state.storage.get<SessionState>("s");
  }
  private async put(s: SessionState) {
    await this.state.storage.put("s", s);
  }

  /** Ask the singleton verifier identity to sign a JWS signing-input. */
  private async sign(input: string): Promise<string> {
    const id = this.env.IDENTITY.idFromName("verifier");
    const res = await this.env.IDENTITY.get(id).fetch("https://id/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input }),
    });
    const { signature } = (await res.json()) as { signature: string };
    return signature;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const op = url.pathname;

    if (op === "/init") {
      const { clientId, responseUri, vct } = (await req.json()) as {
        clientId: string;
        responseUri: string;
        vct?: string;
      };
      const nonce = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const state = crypto.randomUUID();
      const s: SessionState = { nonce, state, clientId, responseUri, vct, status: "pending", createdAt: Date.now() };
      await this.put(s);
      await this.state.storage.setAlarm(Date.now() + TTL_MS);
      return Response.json({ nonce, state });
    }

    if (op === "/request") {
      const s = await this.load();
      if (!s) return new Response("gone", { status: 404 });
      // A **signed** Authorization Request (JAR): the 有備而來 wallet requires the
      // request object to be a JWT signed by the key in `client_id`. `dcql_query`
      // is included alongside `presentation_definition` for newer wallets.
      const header = { typ: "oauth-authz-req+jwt", alg: "ES256", kid: "verifier-did" };
      const payload = {
        client_id: s.clientId,
        response_type: "vp_token",
        response_mode: "direct_post",
        response_uri: s.responseUri,
        nonce: s.nonce,
        state: s.state,
        presentation_definition: {
          id: "bonds-vp",
          input_descriptors: [
            {
              id: "cred",
              format: { "vc+sd-jwt": { "sd-jwt_alg_values": ["ES256"], "kb-jwt_alg_values": ["ES256"] } },
              constraints: s.vct
                ? { fields: [{ path: ["$.type"], filter: { type: "string", contains: { const: s.vct } } }] }
                : { fields: [] },
            },
          ],
        },
        dcql_query: {
          credentials: [{ id: "cred", format: "dc+sd-jwt", meta: s.vct ? { vct_values: [s.vct] } : undefined }],
        },
      };
      const signingInput = b64urlJSON(header) + "." + b64urlJSON(payload);
      const signature = await this.sign(signingInput);
      const jws = signingInput + "." + signature;
      return new Response(jws, {
        headers: { "content-type": "application/oauth-authz-req+jwt" },
      });
    }

    if (op === "/response") {
      const s = await this.load();
      if (!s) return new Response("gone", { status: 404 });
      if (s.status !== "pending") return Response.json({ status: s.status });
      const form = await req.formData();
      const vpToken = String(form.get("vp_token") ?? "");
      const postedState = form.get("state");
      if (postedState != null && String(postedState) !== s.state) {
        return Response.json({ status: "failed", reason: "state mismatch" }, { status: 400 });
      }
      if (!vpToken) {
        s.status = "failed";
        s.reason = "no vp_token in response";
        await this.put(s);
        return Response.json({ status: "failed" }, { status: 400 });
      }
      const trustedIssuers = (this.env.TRUSTED_ISSUERS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      // A standards SD-JWT-VC presentation carries `~`; a TWDIW/有備而來 VP JWT does
      // not (it wraps the credential inside `vp.verifiableCredential`).
      const result = vpToken.includes("~")
        ? await verifySdJwtVc(vpToken, { expectedNonce: s.nonce, expectedAudience: s.clientId, trustedIssuers })
        : await verifyModaVpToken(vpToken, { expectedNonce: s.nonce, expectedAudience: s.clientId, trustedIssuers });
      s.status = result.ok ? "verified" : "failed";
      s.reason = result.reason;
      s.claims = result.claims;
      s.vct = result.vct ?? s.vct;
      await this.put(s);
      // direct_post: 200 with an empty body; the front-end polls /result.
      return Response.json({ status: s.status });
    }

    if (op === "/result") {
      const s = await this.load();
      if (!s) return Response.json({ status: "gone" }, { status: 404 });
      return Response.json({
        status: s.status,
        reason: s.reason,
        vct: s.vct,
        claims: s.status === "verified" ? s.claims : undefined,
      });
    }

    return new Response("not found", { status: 404 });
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}
