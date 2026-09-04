// Bindings `wrangler types` cannot see: secrets are set with
// `wrangler secret put`, never written to wrangler.jsonc.
interface Env {
  /** Bearer token for the native openac-age-verifier (`wrangler secret put ZKP_VERIFIER_TOKEN`). */
  ZKP_VERIFIER_TOKEN?: string;
}
