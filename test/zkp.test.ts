// The zero-knowledge age-predicate statement: what the page asks, what the
// wallet answers, and what the Worker forwards to the native verifier. The
// wire shapes here are fixed by the iOS side (AgePredicateProof.swift) and by
// native/openac-age-verifier; a change in either must show up in these tests.

import { describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, type JWK } from "jose";
import { jwkJcsPubDidKey, p256DidKey } from "../src/didkey";
import {
  appResultOf,
  base64DecodedLength,
  buildNativeRequest,
  buildRequestJson,
  cutoffDateFor,
  DEFAULT_PURPOSE,
  issuerP256Coordinates,
  MAX_PROOF_BYTES,
  numericCutoff,
  parseCivilDate,
  parseMinimumAge,
  parseProofPackage,
  randomNonce,
  randomServiceId,
  REQUEST_LIFETIME_MS,
  sanitizePurpose,
  validateProofPackage,
  verifyWithNativeService,
  type ZkpPageResult,
  type ZkpProofPackage,
  type ZkpStatement,
} from "../src/zkp-statement";

// The exact `iss` the 有備而來 government card carried in the 2026-08-30 live run.
const MODA_ISSUER_DID =
  "did:key:z2dmzD81cgPx8Vki7JbuuMmFYrWPgYoytykUZ3eyqht1j9Kbptwspp6uLnxpQQwn6TjHDw31q6bpSprrhMuKSkozn8R25MLf5g5H64FpiFmhCxKiU7JpU5dgBx3UbiSunqJ2a1athYQ88y4gYigJJefB1mybvtAssdMu2BUS3MwFe6pg4C";

const NUL = String.fromCharCode(0);
const LF = String.fromCharCode(10);
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
const BACKSLASH = String.fromCharCode(92);

const STATEMENT: ZkpStatement = {
  nonce: "c".repeat(43),
  source: "government",
  cutoffDate: "2008-09-04",
  minimumAge: 18,
};

function packageJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    claimFormat: 2,
    claimName: "birthdate",
    createdAt: 1757000000000,
    credentialSource: "g",
    cutoffDate: STATEMENT.cutoffDate,
    issuerDID: MODA_ISSUER_DID,
    minimumAge: 18,
    prepareMilliseconds: 41230,
    prepareProof: "AQID",
    requestNonce: STATEMENT.nonce,
    showMilliseconds: 12045,
    showProof: "BAUG",
    version: 1,
    ...overrides,
  });
}

function parsed(overrides: Record<string, unknown> = {}): ZkpProofPackage {
  const result = parseProofPackage(packageJson(overrides));
  if (!result.ok) throw new Error(result.reason);
  return result.pkg;
}

describe("cutoff date in Asia/Taipei", () => {
  it("subtracts the minimum age from today's Taipei civil date", () => {
    expect(cutoffDateFor(Date.UTC(2026, 8, 4, 3, 0, 0), 18)).toBe("2008-09-04");
  });

  it("uses the Taipei day, not the UTC day, near midnight", () => {
    // 16:30Z is 00:30 the next day in Taipei.
    expect(cutoffDateFor(Date.UTC(2026, 8, 4, 16, 30, 0), 18)).toBe("2008-09-05");
    expect(cutoffDateFor(Date.UTC(2026, 8, 4, 15, 30, 0), 18)).toBe("2008-09-04");
  });

  it("clamps Feb 29 to Feb 28 when the target year is not a leap year", () => {
    const leapNoon = Date.UTC(2028, 1, 29, 4, 0, 0);
    expect(cutoffDateFor(leapNoon, 18)).toBe("2010-02-28");
    expect(cutoffDateFor(leapNoon, 4)).toBe("2024-02-29");
  });

  it("packs the cutoff for ISO and ROC claim formats", () => {
    expect(numericCutoff("2008-09-01", 2)).toBe(20_080_901);
    expect(numericCutoff("2008-09-01", 3)).toBe(970_901);
    expect(numericCutoff("1911-12-31", 3)).toBeNull();
    expect(numericCutoff("2008-02-31", 2)).toBeNull();
    expect(parseCivilDate("2008-9-1")).toBeNull();
  });
});

describe("request the wallet scans", () => {
  it("serialises sorted single-letter keys without whitespace or escaped slashes", () => {
    const json = buildRequestJson({
      minimumAge: 18,
      serviceId: "3F2504E0-4F89-11D3-9A0C-0305E82C3301",
      nonce: "n".repeat(43),
      cutoffDate: "2008-09-04",
      purpose: DEFAULT_PURPOSE,
      source: "government",
      createdAtSeconds: 1757000000,
      responseUrl: "https://verifier.example/api/zkp/response/0f0e0d0c-0b0a-4908-8706-050403020100",
    });
    expect(json).toBe(
      '{"a":18,"b":"3F2504E0-4F89-11D3-9A0C-0305E82C3301","c":"' + "n".repeat(43) + '","d":"2008-09-04",'
      + '"p":"年齡門檻查驗（零知識證明測試）","s":"g","t":1757000000,'
      + '"u":"https://verifier.example/api/zkp/response/0f0e0d0c-0b0a-4908-8706-050403020100","v":1}',
    );
    expect(json).not.toContain(BACKSLASH + "/");
    expect(Object.keys(JSON.parse(json))).toEqual(["a", "b", "c", "d", "p", "s", "t", "u", "v"]);
  });

  it("maps the self-issued source to the app's letter", () => {
    const json = buildRequestJson({
      minimumAge: 20,
      serviceId: randomServiceId(),
      nonce: randomNonce(),
      cutoffDate: "2006-09-04",
      purpose: "確認年齡",
      source: "selfIssued",
      createdAtSeconds: 1757000000,
      responseUrl: "https://verifier.example/api/zkp/response/x",
    });
    const decoded = JSON.parse(json) as Record<string, unknown>;
    expect(decoded.s).toBe("s");
    expect(decoded.a).toBe(20);
    expect(decoded.v).toBe(1);
    expect(decoded.b).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
    expect(decoded.c).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("keeps the request lifetime the app enforces", () => {
    expect(REQUEST_LIFETIME_MS).toBe(5 * 60 * 1000);
  });

  it("sanitises the purpose the way the app's UntrustedText would refuse it", () => {
    expect(sanitizePurpose(undefined)).toBe(DEFAULT_PURPOSE);
    expect(sanitizePurpose("  超商確認" + NUL + "已滿 18 歲" + LF + " ")).toBe("超商確認已滿 18 歲");
    expect(sanitizePurpose("a" + ZERO_WIDTH_SPACE + "b c")).toBe("ab c");
    expect(sanitizePurpose("x".repeat(100))).toBe("x".repeat(100));
    expect(sanitizePurpose("x".repeat(101))).toBeNull();
    expect(sanitizePurpose("")).toBeNull();
    expect(sanitizePurpose(42)).toBeNull();
  });

  it("bounds the minimum age like the app", () => {
    expect(parseMinimumAge(undefined)).toBe(18);
    expect(parseMinimumAge(1)).toBe(1);
    expect(parseMinimumAge(120)).toBe(120);
    expect(parseMinimumAge(0)).toBeNull();
    expect(parseMinimumAge(121)).toBeNull();
    expect(parseMinimumAge(17.5)).toBeNull();
    expect(parseMinimumAge("18")).toBeNull();
  });
});

describe("proof package validation", () => {
  it("accepts a package that answers the exact statement", () => {
    expect(validateProofPackage(parsed(), STATEMENT)).toBeNull();
    expect(validateProofPackage(parsed({ claimFormat: 3, claimName: "roc_birthday" }), STATEMENT)).toBeNull();
  });

  it("rejects a nonce that does not match the session", () => {
    expect(validateProofPackage(parsed({ requestNonce: "d".repeat(43) }), STATEMENT)).toMatch(/nonce/);
  });

  it("rejects a credential source that does not match the session", () => {
    expect(validateProofPackage(parsed({ credentialSource: "s" }), STATEMENT)).toMatch(/來源/);
    expect(validateProofPackage(parsed({ credentialSource: "s" }), { ...STATEMENT, source: "selfIssued" })).toBeNull();
  });

  it("rejects a different cutoff date or minimum age", () => {
    expect(validateProofPackage(parsed({ cutoffDate: "2008-09-03" }), STATEMENT)).toMatch(/截止日期/);
    expect(validateProofPackage(parsed({ minimumAge: 20 }), STATEMENT)).toMatch(/年齡門檻/);
  });

  it("rejects claim format 4 and an arbitrary date field relabelled as a birthday", () => {
    expect(validateProofPackage(parsed({ claimFormat: 4 }), STATEMENT)).toMatch(/格式/);
    expect(validateProofPackage(parsed({ claimName: "membership_started_at" }), STATEMENT)).toMatch(/欄位/);
  });

  it("rejects an oversize, empty or malformed proof before anything is forwarded", () => {
    // 2,000,001 bytes is 666,667 full base64 groups.
    const tooLarge = "A".repeat(2_666_668);
    expect(base64DecodedLength(tooLarge)).toBe(MAX_PROOF_BYTES + 1);
    expect(validateProofPackage(parsed({ prepareProof: tooLarge }), STATEMENT)).toMatch(/大小上限/);
    const exactLimit = "A".repeat(2_666_667) + "=";
    expect(base64DecodedLength(exactLimit)).toBe(MAX_PROOF_BYTES);
    expect(validateProofPackage(parsed({ showProof: exactLimit }), STATEMENT)).toBeNull();
    expect(validateProofPackage(parsed({ showProof: "" }), STATEMENT)).toMatch(/為空/);
    expect(validateProofPackage(parsed({ prepareProof: "not base64!" }), STATEMENT)).toMatch(/損毀/);
  });

  it("rejects the wrong package version and a non did:key issuer", () => {
    expect(validateProofPackage(parsed({ version: 2 }), STATEMENT)).toMatch(/版本/);
    expect(validateProofPackage(parsed({ issuerDID: "https://issuer.test" }), STATEMENT)).toMatch(/did:key/);
  });

  it("refuses a package missing fields or too large to parse", () => {
    expect(parseProofPackage("{}")).toMatchObject({ ok: false });
    expect(parseProofPackage("not json")).toMatchObject({ ok: false });
    expect(parseProofPackage("[]")).toMatchObject({ ok: false });
    expect(parseProofPackage("x".repeat(6_000_001))).toMatchObject({ ok: false, reason: expect.stringMatching(/上限/) });
  });

  it("refuses a ROC-format claim when the cutoff has no positive ROC year", () => {
    const early = { ...STATEMENT, cutoffDate: "1911-06-05" };
    expect(validateProofPackage(parsed({ claimFormat: 3, cutoffDate: early.cutoffDate }), early)).toMatch(/格式表示/);
  });
});

describe("statement forwarded to the native verifier", () => {
  it("carries the issuer coordinates resolved from a p256-pub did:key", async () => {
    const keys = await generateKeyPair("ES256", { extractable: true });
    const pub = (await exportJWK(keys.publicKey)) as JWK & { x: string; y: string };
    const did = p256DidKey(pub);
    const coordinates = issuerP256Coordinates(did);
    expect(coordinates).toEqual({ x: pub.x, y: pub.y });
    const body = buildNativeRequest(parsed({ issuerDID: did }), STATEMENT, coordinates!);
    expect(body).toEqual({
      prepareProof: "AQID",
      showProof: "BAUG",
      nonce: STATEMENT.nonce,
      claimName: "birthdate",
      claimFormat: 2,
      cutoff: 20_080_904,
      issuerKeyX: pub.x,
      issuerKeyY: pub.y,
    });
  });

  it("resolves the jwk_jcs-pub spelling moda's issuers use", async () => {
    const coordinates = issuerP256Coordinates(MODA_ISSUER_DID);
    expect(coordinates?.x).toHaveLength(43);
    expect(coordinates?.y).toHaveLength(43);
    const keys = await generateKeyPair("ES256", { extractable: true });
    const pub = (await exportJWK(keys.publicKey)) as JWK & { kty: string; crv: string; x: string; y: string };
    expect(issuerP256Coordinates(jwkJcsPubDidKey(pub))).toEqual({ x: pub.x, y: pub.y });
    expect(issuerP256Coordinates("did:web:issuer.test")).toBeNull();
  });

  it("uses the ROC packing when the wallet proved from a ROC-formatted field", () => {
    const body = buildNativeRequest(parsed({ claimFormat: 3, claimName: "roc_birthday" }), STATEMENT, { x: "x", y: "y" });
    expect(body?.cutoff).toBe(970_904);
    expect(body?.claimName).toBe("roc_birthday");
  });
});

describe("native verifier client", () => {
  const body = buildNativeRequest(parsed(), STATEMENT, { x: "x".repeat(43), y: "y".repeat(43) })!;

  it("posts the statement with the bearer token and returns the verdict", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://zkp.example/verify");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer secret");
      expect(JSON.parse(String(init?.body))).toEqual(body);
      return Response.json({
        accepted: true,
        reason: null,
        loadMs: 210,
        verifyMs: 1840,
        prepareProofBytes: 401_000,
        showProofBytes: 39_000,
        statement: { nonceSha256Prefix: "abcd" },
        assetRelease: "openac-age-v1",
      });
    }) as unknown as typeof fetch;
    const outcome = await verifyWithNativeService(body, { baseUrl: "https://zkp.example/", token: "secret", fetcher });
    expect(outcome).toMatchObject({ kind: "verdict", verdict: { accepted: true, verifyMs: 1840, loadMs: 210, assetRelease: "openac-age-v1" } });
  });

  it("treats a 400 as a refusal carrying the backend's reason", async () => {
    const fetcher = vi.fn(async () => Response.json({ error: "claim is not a supported birth-date field" }, { status: 400 })) as unknown as typeof fetch;
    const outcome = await verifyWithNativeService(body, { baseUrl: "https://zkp.example", fetcher });
    expect(outcome).toEqual({ kind: "refused", reason: "驗證後端拒絕這組證明：claim is not a supported birth-date field" });
  });

  it("reports 401, 5xx, network failures and a missing URL as unavailable", async () => {
    const unauthorized = vi.fn(async () => Response.json({ error: "unauthorized" }, { status: 401 })) as unknown as typeof fetch;
    expect((await verifyWithNativeService(body, { baseUrl: "https://zkp.example", fetcher: unauthorized })).kind).toBe("unavailable");
    const crashed = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    expect((await verifyWithNativeService(body, { baseUrl: "https://zkp.example", fetcher: crashed })).kind).toBe("unavailable");
    const offline = vi.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect((await verifyWithNativeService(body, { baseUrl: "https://zkp.example", fetcher: offline })).kind).toBe("unavailable");
    const never = vi.fn() as unknown as typeof fetch;
    expect((await verifyWithNativeService(body, { baseUrl: "", fetcher: never })).kind).toBe("unavailable");
    expect(never).not.toHaveBeenCalled();
  });
});

describe("result shaping", () => {
  it("keeps only the app-facing fields in the HTTP response", () => {
    const page: ZkpPageResult = {
      status: "verified",
      accepted: true,
      minimumAge: 18,
      credentialSource: "government",
      timingMs: { holderPrepare: 41230, holderShow: 12045, transport: 61000, verify: 1840, nativeLoad: 210, total: 2400 },
      trust: { trusted: true, onChain: true, organization: "測試機關" },
      trustMs: 120,
      claimName: "birthdate",
      claimFormat: 2,
      cutoffDate: "2008-09-04",
      cutoff: 20_080_904,
    };
    expect(appResultOf(page)).toEqual({
      status: "verified",
      accepted: true,
      minimumAge: 18,
      credentialSource: "government",
      timingMs: page.timingMs,
    });
    expect(appResultOf({ ...page, status: "failed", accepted: false, reason: "x" })).toMatchObject({ reason: "x" });
  });
});
