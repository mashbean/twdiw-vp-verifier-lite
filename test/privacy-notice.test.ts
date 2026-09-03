import { describe, expect, it } from "vitest";
import { PRIVACY_NOTICE, privacyCategoriesForClaims } from "../src/privacy-notice";

describe("personal-data notice module", () => {
  it("contains every Article 8 notice dimension used by the verifier", () => {
    expect(PRIVACY_NOTICE.controller).toBeTruthy();
    expect(PRIVACY_NOTICE.contact).toBeTruthy();
    expect(PRIVACY_NOTICE.period).toMatch(/10 分鐘/);
    expect(PRIVACY_NOTICE.region).toMatch(/境外/);
    expect(PRIVACY_NOTICE.recipients).toMatch(/Cloudflare/);
    expect(PRIVACY_NOTICE.rights).toMatch(/查詢.*刪除/);
    expect(PRIVACY_NOTICE.refusalEffect).toMatch(/無法完成/);
  });

  it("maps only requested claims plus technical verification evidence", () => {
    expect(privacyCategoriesForClaims(["name", "phonel5"])).toEqual([
      expect.objectContaining({ code: "C001" }),
    ]);
    expect(privacyCategoriesForClaims(["id_number"])).toEqual([
      expect.objectContaining({ code: "C001" }),
      expect.objectContaining({ code: "C003" }),
    ]);
    expect(privacyCategoriesForClaims(["nationality"])).toEqual([
      expect.objectContaining({ code: "C001" }),
      expect.objectContaining({ code: "C011" }),
    ]);
  });
});
