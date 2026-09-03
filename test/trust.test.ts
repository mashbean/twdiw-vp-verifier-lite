import { describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { jwkJcsPubDidKey } from "../src/didkey";
import { resolveGovernmentIssuerTrust, unverifiedGovernmentIssuer } from "../src/trust";

async function governmentVp(): Promise<{ token: string; issuer: string }> {
  const issuerKeys = await generateKeyPair("ES256", { extractable: true });
  const holderKeys = await generateKeyPair("ES256", { extractable: true });
  const issuer = jwkJcsPubDidKey(await exportJWK(issuerKeys.publicKey) as never);
  const inner = await new SignJWT({ iss: issuer })
    .setProtectedHeader({ alg: "ES256" })
    .sign(issuerKeys.privateKey);
  const token = await new SignJWT({ vp: { verifiableCredential: [`${inner}~`] } })
    .setProtectedHeader({ alg: "ES256" })
    .sign(holderKeys.privateKey);
  return { token, issuer };
}

describe("government issuer trust", () => {
  it("extracts a DID only to select the record later verified by signature", async () => {
    const { token, issuer } = await governmentVp();
    expect(unverifiedGovernmentIssuer(token)).toBe(issuer);
  });

  it("accepts an active exact API record and reports active chain evidence", async () => {
    const issuer = "did:key:zIssuer";
    const fetcher = vi.fn(async () => Response.json({
      code: "0",
      data: {
        id: issuer,
        status: 1,
        org: { name: "測試機關" },
        onChainHistory: [{ net: "arbitrum", scAddress: "0xabc", txHash: "0xdef", status: 1 }],
      },
    })) as typeof fetch;
    const result = await resolveGovernmentIssuerTrust(issuer, { fetcher });
    expect(result).toMatchObject({ trusted: true, source: "official-api", organization: "測試機關", onChain: true });
  });

  it("fails closed when the API returns a different or inactive DID", async () => {
    const fetcher = vi.fn(async () => Response.json({ code: "0", data: { id: "did:key:zOther", status: 1 } })) as typeof fetch;
    const result = await resolveGovernmentIssuerTrust("did:key:zIssuer", { fetcher });
    expect(result.trusted).toBe(false);
  });

  it("does not provide an unreviewed environment-variable trust bypass", async () => {
    const fetcher = vi.fn(async () => Response.json({ code: "1", data: null })) as typeof fetch;
    const result = await resolveGovernmentIssuerTrust("did:key:zLocal", { fetcher });
    expect(result.trusted).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
