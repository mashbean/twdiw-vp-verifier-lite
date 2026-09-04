// The native age-proof verifier, running as a Cloudflare Container.
//
// # Why this exists at all
//
// A Worker isolate gets 128 MiB. The OpenAC Prepare verifying key is 412 MB on
// its own, because Spartan2/Hyrax needs no trusted setup and pays for that by
// making the verifier evaluate the circuit itself — the "key" is very nearly
// the circuit. So the one step that cannot live in the Worker is the step this
// whole page is about, and it runs beside it in a container instead.
//
// # Why the container is woken before it is needed
//
// A cold start pays for the image plus deserialising 417 MB of key. The page
// creates the session, the holder then scans and their phone spends roughly
// twenty seconds building the proof pair: that gap is the warm-up window, and
// `warm()` is called at session creation to use it. Waking is best-effort —
// a failure there must never stop a request being minted, because the proof
// will start the container on arrival anyway, just more slowly.

import { Container } from "@cloudflare/containers";
import type { DurableObject } from "cloudflare:workers";
import { chooseZkpBackend } from "./zkp-statement";

/** Matches `OPENAC_AGE_BIND` in the image and `EXPOSE` in the Dockerfile. */
export const ZKP_CONTAINER_PORT = 8787;

/** One instance serves every session, so `getByName` uses a fixed name. */
export const ZKP_CONTAINER_NAME = "openac-age-verifier";

export class ZkpVerifierContainer extends Container<Env> {
  defaultPort = ZKP_CONTAINER_PORT;

  // Cloudflare's default. Memory and disk are billed while the container is
  // awake and not at all while it sleeps, so this number is the running cost:
  // at 4 GiB, the Workers Paid allowance of 25 GiB-hours is about six hours of
  // wakefulness a month. Shortening it trades cost for more cold starts.
  sleepAfter = "10m";

  // No outbound network: the keys are baked into the image and the service
  // fetches nothing. Anything that tried to would be a change worth noticing.
  enableInternet = false;

  // Set here rather than as a class field because the base class declares
  // `envVars` as a property and the value depends on `env`.
  //
  // The service refuses to start without a token unless explicitly allowed.
  // Nothing outside this Worker can reach the container, so the unauthenticated
  // path is safe here; the token is still passed when one is configured,
  // because defence in depth costs nothing and the same image runs on a laptop
  // behind a public tunnel.
  // The same `ctx` type the base class takes, spelled the same way.
  constructor(ctx: DurableObject["ctx"], env: Env) {
    super(ctx, env);
    const token = env.ZKP_VERIFIER_TOKEN?.trim();
    this.envVars = token
      ? { OPENAC_AGE_VERIFIER_TOKEN: token }
      : { OPENAC_AGE_ALLOW_UNAUTHENTICATED: "1" };
  }
}

/**
 * Starts the container without waiting for it, so the twenty seconds the phone
 * spends proving are not spent waiting for a boot afterwards. Never throws.
 */
export async function warmZkpContainer(env: Env): Promise<void> {
  if (!env.ZKP_CONTAINER) return;
  try {
    await env.ZKP_CONTAINER.getByName(ZKP_CONTAINER_NAME).start();
  } catch {
    // A container that could not be pre-warmed still starts on the first
    // proof. Reporting this to the page would be noise about an optimisation.
  }
}

/**
 * A `fetch`-shaped function that reaches the container instead of the network.
 *
 * The base URL the caller builds paths against is arbitrary — the container
 * stub routes by path — so `verifyWithNativeService` can use one code path for
 * a laptop behind a tunnel and for this.
 */
export function zkpContainerFetcher(env: Env): typeof fetch | undefined {
  if (!env.ZKP_CONTAINER) return undefined;
  const stub = env.ZKP_CONTAINER.getByName(ZKP_CONTAINER_NAME);
  // Hand the Durable Object a real `Request` and let the `Container` base
  // class proxy it to `defaultPort`. Passing a `RequestInit` as a positional
  // argument to `containerFetch` does not survive the DO RPC boundary — the
  // body and headers arrive empty — so the request is built here and sent
  // through the stub's own `fetch`, which is what the container library
  // documents.
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    stub.fetch(new Request(input as string | URL, init))) as typeof fetch;
}

/** Any absolute origin; only the path reaches the container. */
export const ZKP_CONTAINER_ORIGIN = "http://openac-age-verifier.container";
