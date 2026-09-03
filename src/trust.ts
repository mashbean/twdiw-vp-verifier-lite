import { decodeJwt } from "jose";

export type TrustSource = "official-api";

export interface IssuerTrustEvidence {
  trusted: boolean;
  source?: TrustSource;
  issuer?: string;
  organization?: string;
  registryURL?: string;
  onChain: boolean;
  network?: string;
  contract?: string;
  transactionHash?: string;
  reason?: string;
}

interface OfficialDidRecord {
  id?: unknown;
  status?: unknown;
  org?: { name?: unknown };
  onChainHistory?: Array<{
    net?: unknown;
    scAddress?: unknown;
    txHash?: unknown;
    status?: unknown;
  }>;
}

interface OfficialDidResponse {
  code?: unknown;
  data?: OfficialDidRecord;
}

export const DEFAULT_OFFICIAL_TRUST_REGISTRY = "https://frontend.wallet.gov.tw/api/did";

function innerGovernmentCredential(vpToken: string): string | undefined {
  if (vpToken.includes("~")) return vpToken.split("~", 1)[0];
  try {
    const outer = decodeJwt(vpToken) as Record<string, unknown>;
    const vp = outer.vp as { verifiableCredential?: unknown } | undefined;
    const credential = Array.isArray(vp?.verifiableCredential)
      ? vp?.verifiableCredential[0]
      : vp?.verifiableCredential;
    return typeof credential === "string" ? credential.split("~", 1)[0] : undefined;
  } catch {
    return undefined;
  }
}

/** Decode only enough untrusted input to choose a trust record. The returned DID
 * is never accepted on this parse alone; the caller still verifies the issuer JWT. */
export function unverifiedGovernmentIssuer(vpToken: string): string | undefined {
  const jwt = innerGovernmentCredential(vpToken);
  if (!jwt || jwt.length > 64_000) return undefined;
  try {
    const issuer = decodeJwt(jwt).iss;
    return typeof issuer === "string" && issuer.startsWith("did:key:") && issuer.length <= 1_024
      ? issuer
      : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveGovernmentIssuerTrust(
  issuer: string,
  options: {
    officialRegistryURL?: string;
    fetcher?: typeof fetch;
  } = {},
): Promise<IssuerTrustEvidence> {
  const base = (options.officialRegistryURL ?? DEFAULT_OFFICIAL_TRUST_REGISTRY).replace(/\/$/, "");
  if (!base) return { trusted: false, issuer, onChain: false, reason: "沒有設定可用的 issuer 信任來源" };
  const registryURL = `${base}/${encodeURIComponent(issuer)}`;
  try {
    const response = await (options.fetcher ?? fetch)(registryURL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return { trusted: false, issuer, registryURL, onChain: false, reason: `官方信任 API 回應 ${response.status}` };
    }
    const envelope = await response.json() as OfficialDidResponse;
    const record = envelope.data;
    if (String(envelope.code) !== "0" || record?.id !== issuer || Number(record.status) !== 1) {
      return { trusted: false, issuer, registryURL, onChain: false, reason: "官方信任 API 沒有這筆啟用中的 issuer" };
    }
    const chain = record.onChainHistory?.find((item) => Number(item.status) === 1
      && typeof item.txHash === "string" && typeof item.scAddress === "string");
    return {
      trusted: true,
      source: "official-api",
      issuer,
      organization: typeof record.org?.name === "string" ? record.org.name : undefined,
      registryURL,
      onChain: Boolean(chain),
      network: typeof chain?.net === "string" ? chain.net : undefined,
      contract: typeof chain?.scAddress === "string" ? chain.scAddress : undefined,
      transactionHash: typeof chain?.txHash === "string" ? chain.txHash : undefined,
    };
  } catch (error) {
    return {
      trusted: false,
      issuer,
      registryURL,
      onChain: false,
      reason: error instanceof Error ? `官方信任 API 無法確認：${error.message}` : "官方信任 API 無法確認",
    };
  }
}
