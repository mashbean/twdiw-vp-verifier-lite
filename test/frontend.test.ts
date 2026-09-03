import { describe, expect, it } from "vitest";
import { FRONTEND_HTML, FRONTEND_JS } from "../src/frontend";

describe("landing page", () => {
  it("presents the citizen and service-provider paths", () => {
    expect(FRONTEND_HTML).toContain("請出示皮夾");
    expect(FRONTEND_HTML).toContain("輕量化查驗證件，支援數位皮夾");
    expect(FRONTEND_HTML).toContain("支援數位發展部「數位憑證皮夾」，讓你可以一鍵建立自己的驗證服務");
    expect(FRONTEND_HTML).toContain("我是民眾，開始測試");
    expect(FRONTEND_HTML).toContain("我想建立驗證服務");
    expect(FRONTEND_HTML).not.toContain("我是業者，免費建立服務");
    expect(FRONTEND_HTML).toContain("開始前常見的問題");
  });

  it("defaults to the official wallet and switches directly to Bonds", () => {
    expect(FRONTEND_HTML).toContain("數位憑證皮夾</strong><small>數位發展部公開版本 · 預設");
    expect(FRONTEND_HTML).toContain("id=\"wallet-bonds\"");
    expect(FRONTEND_HTML).not.toContain("id=\"bonds-picker\"");
    expect(FRONTEND_JS).toContain("wallet:'twdiw'");
  });

  it("keeps wallet-specific purposes visible but disabled", () => {
    expect(FRONTEND_JS).toContain("button.disabled=unavailable");
    expect(FRONTEND_JS).toContain("目前只支援有備而來新版自發證件");
  });

  it("requires an in-context personal-data notice before creating a request", () => {
    expect(FRONTEND_HTML).toContain("個人資料蒐集、處理及利用告知");
    expect(FRONTEND_HTML).toContain("id=\"privacy-ack\"");
    expect(FRONTEND_HTML).toContain("完整告知事項與個資法依據");
    expect(FRONTEND_JS).toContain("state.privacyNotice=body.privacyNotice");
    expect(FRONTEND_JS).toContain("!$('privacy-ack').checked");
  });

  it("receives a one-time result without polling a capability in the URL", () => {
    expect(FRONTEND_JS).toContain("new WebSocket(url)");
    expect(FRONTEND_JS).not.toContain("/api/result/");
    expect(FRONTEND_JS).not.toContain("setInterval");
  });

  it("links the renamed repository and developer resources", () => {
    expect(FRONTEND_HTML).toContain("https://github.com/mashbean/twdiw-vp-verifier-lite");
    expect(FRONTEND_HTML).toContain("skills/deploy-twdiw-vp-verifier-lite");
    expect(FRONTEND_HTML).toContain("prompts/deploy-or-embed.md");
    expect(FRONTEND_HTML).toContain("docs/embedding.md");
    expect(FRONTEND_HTML).toContain("Maintained by");
    expect(FRONTEND_HTML).not.toContain("github.com/mashbean/mashbean-vp-verifier");
  });

  it("supports copying the deployment prompt", () => {
    expect(FRONTEND_JS).toContain("navigator.clipboard.writeText");
  });

  it("shows the experimental-source disclaimer and elevates official registration", () => {
    expect(FRONTEND_HTML).toContain("公開原始碼實驗站");
    expect(FRONTEND_HTML).toContain("並非數位發展部官方服務");
    expect(FRONTEND_HTML).toContain("成為官方註冊驗證者");
    expect(FRONTEND_HTML.indexOf("成為官方註冊驗證者")).toBeGreaterThan(FRONTEND_HTML.indexOf("FOR DEVELOPERS"));
    expect(FRONTEND_HTML.indexOf("成為官方註冊驗證者")).toBeLessThan(FRONTEND_HTML.indexOf("COPYABLE PROMPT"));
  });

  it("does not promise a specific wallet for the generic iOS URL scheme", () => {
    expect(FRONTEND_HTML).toContain("在本機嘗試開啟");
    expect(FRONTEND_HTML).not.toContain("在同一台裝置開啟皮夾");
    expect(FRONTEND_JS).toContain("iOS 無法指定要開啟哪一個註冊 openid4vp 的皮夾");
    expect(FRONTEND_JS).toContain("有備而來請從 App 內掃描上方 QR Code");
  });
});
