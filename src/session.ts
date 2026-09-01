// One presentation session: the nonce and state we issued, the Authorization
// Request we built, and the verification result once the wallet responds. Strong,
// read-after-write consistent (unlike KV), so the nonce minted in one PoP is seen
// by the response that lands in another. Self-expires after 10 minutes.

import { verifySdJwtVc } from "./verify";
import { verifyModaVpToken } from "./moda";
import { verifyMoicaVpToken } from "./moica";
import { isAdultFromClaims } from "./age";
import { validatePresentationSubmission } from "./presentation-submission";

const ADULT_AGE = 18;

interface SessionState {
  nonce: string;
  state: string;             // echoed by the wallet so we can match its POST
  clientId: string;          // the verifier's did:key — also the vp_token `aud`
  responseUri: string;
  vct?: string;              // the credential type this verifier is asking for
  /** "age" asks only for proof of adulthood (one field: the birthday). */
  mode?: "age" | "general";
  credentialSource: "government" | "selfIssued";
  status: "pending" | "verified" | "failed";
  reason?: string;
  claims?: Record<string, unknown>;
  /** For age mode: whether the holder is at least 18 (null = no birthday disclosed). */
  adult?: boolean | null;
  createdAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const enc = new TextEncoder();

export function requestedClaimNames(
  credentialSource: "government" | "selfIssued",
  mode: "age" | "general",
): string[] {
  const birthdayClaim = credentialSource === "selfIssued" ? "birthdate" : "roc_birthday";
  if (mode === "age") return [birthdayClaim];

  // A telecom card and a driving-licence card both carry `name`, but a telecom
  // card deliberately carries no birthday. The previous general request asked
  // every government card for both fields, so a real phone-number card could
  // never answer even the non-age scenario. A general check now asks for the
  // common field; the age scenario remains the explicit birthday-only path.
  return credentialSource === "government" ? ["name"] : ["name", birthdayClaim];
}

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
      const { clientId, responseUri, vct, mode, credentialSource } = (await req.json()) as {
        clientId: string;
        responseUri: string;
        vct?: string;
        mode?: "age" | "general";
        credentialSource?: "government" | "selfIssued";
      };
      const nonce = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const state = crypto.randomUUID();
      const s: SessionState = {
        nonce,
        state,
        clientId,
        responseUri,
        vct,
        mode: mode ?? "general",
        credentialSource: credentialSource ?? "government",
        status: "pending",
        createdAt: Date.now(),
      };
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
      const isSelfIssued = s.credentialSource === "selfIssued";
      const credentialType = isSelfIssued ? "NationalIDCredential" : s.vct;
      const requestedClaims = requestedClaimNames(s.credentialSource, s.mode ?? "general");
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
              format: isSelfIssued
                ? { "vc+moica": { alg: ["RS256", "ES256"] } }
                : { "vc+sd-jwt": { "sd-jwt_alg_values": ["ES256"], "kb-jwt_alg_values": ["ES256"] } },
              // Age mode asks for the birthday and nothing else — the verifier turns
              // it into a yes/no answer, so it never sees name, ID number or address.
              // A general government check asks only for `name`, the field shared by
              // the measured driving-licence and telecom-card paths. Self-issued
              // national IDs can answer both name and birthdate.
              constraints: {
                fields: [
                  ...(credentialType ? [{ path: ["$.type"], filter: { type: "string", contains: { const: credentialType } } }] : []),
                  ...requestedClaims.map((claim) => ({ path: [`$.credentialSubject.${claim}`] })),
                ],
              },
            },
          ],
        },
        dcql_query: isSelfIssued ? undefined : {
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
      const submissionError = validatePresentationSubmission(
        String(form.get("presentation_submission") ?? ""),
        s.credentialSource,
      );
      if (submissionError) {
        s.status = "failed";
        s.reason = submissionError;
        await this.put(s);
        return Response.json({ status: "failed", reason: submissionError }, { status: 400 });
      }
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
      if (s.credentialSource === "government" && trustedIssuers.length === 0) {
        s.status = "failed";
        s.reason = "verifier has no trusted government issuers configured";
        await this.put(s);
        return Response.json({ status: "failed", reason: s.reason }, { status: 503 });
      }
      // Dispatch from the request we issued, never by guessing from attacker-
      // controlled token punctuation. A self-issued session accepts only the
      // explicit `vc+moica` verifier; a government session keeps the two
      // standards/TWDIW SD-JWT holder-binding dialects.
      const result = s.credentialSource === "selfIssued"
        ? await verifyMoicaVpToken(vpToken, { expectedNonce: s.nonce, expectedAudience: s.clientId })
        : vpToken.includes("~")
          ? await verifySdJwtVc(vpToken, { expectedNonce: s.nonce, expectedAudience: s.clientId, trustedIssuers })
          : await verifyModaVpToken(vpToken, { expectedNonce: s.nonce, expectedAudience: s.clientId, trustedIssuers });
      s.status = result.ok ? "verified" : "failed";
      s.reason = result.reason;
      s.claims = result.claims;
      s.vct = result.vct ?? s.vct;
      // Age mode: reduce the disclosed birthday to a single yes/no, computed here so
      // the front-end never needs the birthday itself.
      if (result.ok && s.mode === "age") {
        s.adult = isAdultFromClaims(result.claims, ADULT_AGE, Date.now());
        if (s.adult === null) {
          s.status = "failed";
          s.reason = "no birthday was disclosed to check age against";
        }
      }
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
        mode: s.mode,
        credentialSource: s.credentialSource,
        vct: s.vct,
        adult: s.mode === "age" ? s.adult ?? undefined : undefined,
        adultAge: ADULT_AGE,
        // In age mode the only field the verifier holds is the birthday; general
        // mode returns whatever was disclosed.
        claims: s.status === "verified" ? s.claims : undefined,
      });
    }

    return new Response("not found", { status: 404 });
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}
