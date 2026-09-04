// Bindings `wrangler types` cannot see: secrets are set with
// `wrangler secret put`, never written to wrangler.jsonc. Both ZKP values are
// secrets rather than vars because Cloudflare refuses a secret whose name is
// already a var ("Binding name already in use"), and the backend URL changes
// with every quick-tunnel restart — a config edit and redeploy per restart
// would be the wrong shape for it.
interface Env {
  /** The native verifier running as a Cloudflare Container. Present only in
   *  deployments whose wrangler config declares the container (the demo site);
   *  a free-plan deployment has none and uses `ZKP_VERIFIER_URL` instead. */
  ZKP_CONTAINER?: DurableObjectNamespace<import("./zkp-container").ZkpVerifierContainer>;
  /** Base URL of the native openac-age-verifier (`wrangler secret put ZKP_VERIFIER_URL`). Empty/unset disables /zkp. */
  ZKP_VERIFIER_URL?: string;
  /** Bearer token for the native openac-age-verifier (`wrangler secret put ZKP_VERIFIER_TOKEN`). */
  ZKP_VERIFIER_TOKEN?: string;
}
