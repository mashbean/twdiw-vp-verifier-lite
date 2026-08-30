// One presentation session: the nonce we issued, the Authorization Request we
// built, and the verification result once the wallet responds. Strong,
// read-after-write consistent (unlike KV), so the nonce minted in one PoP is seen
// by the response that lands in another. Self-expires after 10 minutes.

import { verifySdJwtVc } from "./verify";

interface SessionState {
  nonce: string;
  clientId: string;
  responseUri: string;
  vct?: string;              // the credential type this verifier is asking for
  status: "pending" | "verified" | "failed";
  reason?: string;
  claims?: Record<string, unknown>;
  createdAt: number;
}

const TTL_MS = 10 * 60 * 1000;

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
      const s: SessionState = { nonce, clientId, responseUri, vct, status: "pending", createdAt: Date.now() };
      await this.put(s);
      await this.state.storage.setAlarm(Date.now() + TTL_MS);
      return Response.json({ nonce });
    }

    if (op === "/request") {
      const s = await this.load();
      if (!s) return new Response("gone", { status: 404 });
      // The OpenID4VP Authorization Request (unsigned Phase-1). Both query languages
      // are offered so either generation of wallet can present: newer ones read
      // `dcql_query`, while `presentation_definition` (DIF PE) is what the wider
      // installed base — including presentation_submission wallets like TWDIW — still
      // uses. A wallet that understands both is expected to prefer `dcql_query`.
      return Response.json({
        client_id: s.clientId,
        response_type: "vp_token",
        response_mode: "direct_post",
        response_uri: s.responseUri,
        nonce: s.nonce,
        dcql_query: {
          credentials: [
            {
              id: "cred",
              format: "dc+sd-jwt",
              meta: s.vct ? { vct_values: [s.vct] } : undefined,
            },
          ],
        },
        presentation_definition: {
          id: "bonds-vp",
          input_descriptors: [
            {
              id: "cred",
              format: {
                "vc+sd-jwt": {
                  "sd-jwt_alg_values": ["ES256", "ES384"],
                  "kb-jwt_alg_values": ["ES256", "ES384"],
                },
              },
              // Constrain by credential type when one was asked for, so the wallet
              // offers the right card; otherwise leave it open.
              constraints: s.vct
                ? { fields: [{ path: ["$.vct"], filter: { type: "string", const: s.vct } }] }
                : { fields: [] },
            },
          ],
        },
      });
    }

    if (op === "/response") {
      const s = await this.load();
      if (!s) return new Response("gone", { status: 404 });
      if (s.status !== "pending") return Response.json({ status: s.status });
      const form = await req.formData();
      const vpToken = String(form.get("vp_token") ?? "");
      if (!vpToken) {
        s.status = "failed";
        s.reason = "no vp_token in response";
        await this.put(s);
        return Response.json({ status: "failed" }, { status: 400 });
      }
      const result = await verifySdJwtVc(vpToken, {
        expectedNonce: s.nonce,
        expectedAudience: s.clientId,
        trustedIssuers: (this.env.TRUSTED_ISSUERS ?? "").split(",").map((x) => x.trim()).filter(Boolean),
      });
      s.status = result.ok ? "verified" : "failed";
      s.reason = result.reason;
      s.claims = result.claims;
      s.vct = result.vct ?? s.vct;
      await this.put(s);
      // direct_post returns 200 with an empty (or redirect) body; the front-end
      // polls /result. Newer flows may return a redirect_uri here.
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
