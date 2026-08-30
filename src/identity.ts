// The verifier's own signing identity.
//
// The 有備而來 wallet requires the Authorization Request to be a JWT signed by the
// key named in `client_id` (a `did:key`). So the verifier needs a stable P-256
// keypair: its public half becomes the `client_id` DID the QR carries, and its
// private half signs the request object.
//
// A singleton Durable Object (addressed by a fixed name) holds it: generated once
// on first use, persisted in DO storage, never written to the repo or the config.
// Web Crypto ECDSA/P-256 signatures are raw `r‖s` — exactly what the wallet's
// `P256.Signing.ECDSASignature(rawRepresentation:)` and JOSE ES256 both expect.

import { p256DidKey } from "./didkey";

export class VerifierIdentity {
  private state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async ensure(): Promise<{ priv: JsonWebKey; pub: JsonWebKey; didKey: string }> {
    const storedPriv = await this.state.storage.get<JsonWebKey>("privateJwk");
    const storedPub = await this.state.storage.get<JsonWebKey>("publicJwk");
    const storedDid = await this.state.storage.get<string>("didKey");
    if (storedPriv && storedPub && storedDid) {
      return { priv: storedPriv, pub: storedPub, didKey: storedDid };
    }
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const priv = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
    const pub = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
    const didKey = p256DidKey({ x: pub.x!, y: pub.y! });
    await this.state.storage.put({ privateJwk: priv, publicJwk: pub, didKey });
    return { priv, pub, didKey };
  }

  async fetch(req: Request): Promise<Response> {
    const op = new URL(req.url).pathname;
    const { priv, pub, didKey } = await this.ensure();

    if (op === "/identity") {
      return Response.json({ didKey, publicJwk: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } });
    }

    if (op === "/sign") {
      const { input } = (await req.json()) as { input: string };
      const key = await crypto.subtle.importKey(
        "jwk",
        priv,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
      );
      const raw = new Uint8Array(
        await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input)),
      );
      let s = "";
      for (const b of raw) s += String.fromCharCode(b);
      const signature = btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      return Response.json({ signature });
    }

    return new Response("not found", { status: 404 });
  }
}
