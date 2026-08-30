// Bindings from wrangler.toml. `npx wrangler types` regenerates a fuller version.
interface Env {
  SESSIONS: DurableObjectNamespace;
  IDENTITY: DurableObjectNamespace;
  VERIFIER_ORIGIN: string;
  TRUSTED_ISSUERS: string;
}
