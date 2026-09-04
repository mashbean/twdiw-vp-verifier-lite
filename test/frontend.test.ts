import { describe, expect, it } from "vitest";
import { FRONTEND_HTML, FRONTEND_JS } from "../src/frontend";
import { ZKP_CSS, ZKP_HTML, ZKP_JS } from "../src/zkp-frontend";

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

  it("publishes a large link preview", () => {
    expect(FRONTEND_HTML).toContain('property="og:image" content="https://mashbean.net/images/works/twdiw-vp-verifier-lite.jpg"');
    expect(FRONTEND_HTML).toContain('name="twitter:card" content="summary_large_image"');
    expect(FRONTEND_HTML).toContain('property="og:url" content="https://verifier.mashbean.net/"');
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

  it("clears disclosed results and releases the result capability", () => {
    expect(FRONTEND_JS).toContain("立即清除查驗結果");
    expect(FRONTEND_JS).toContain("setTimeout(clearResult,120000)");
    expect(FRONTEND_JS).toContain("releaseResultSocket(socket)");
    expect(FRONTEND_JS).toContain("socket.onmessage=null");
    expect(FRONTEND_JS).toContain("window.addEventListener('pagehide'");
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

  it("routes the official selection through its dedicated iOS URL scheme", () => {
    expect(FRONTEND_HTML).toContain("在本機嘗試開啟");
    expect(FRONTEND_HTML).not.toContain("在同一台裝置開啟皮夾");
    expect(FRONTEND_JS).toContain("官方數位憑證皮夾的專用入口");
    expect(FRONTEND_JS).toContain("有備而來請從 App 內掃描上方 QR Code");
  });
});

describe("landing page → zero-knowledge test page", () => {
  it("links the /zkp page and records only timing numbers for the comparison", () => {
    expect(FRONTEND_HTML).toContain('href="/zkp"');
    expect(FRONTEND_HTML).toContain("零知識證明測試");
    expect(FRONTEND_JS).toContain("bonds-verifier-timings");
    expect(FRONTEND_JS).toContain("flow:'sd-jwt-vc'");
    expect(FRONTEND_JS).not.toMatch(/recordTiming\(\{[^}]*claims/);
  });
});

describe("zero-knowledge age proof page", () => {
  it("loads its own script and stylesheet on top of the shared ones", () => {
    expect(ZKP_HTML).toContain('<link rel="stylesheet" href="/app.css">');
    expect(ZKP_HTML).toContain('<link rel="stylesheet" href="/zkp.css">');
    expect(ZKP_HTML).toContain('<script src="/zkp.js" defer></script>');
    expect(ZKP_CSS).toContain(".timing-table");
  });

  it("keeps the element ids the script drives", () => {
    for (const id of [
      "source-government", "source-selfIssued", "minimum-age", "purpose", "statement-cutoff", "privacy-ack", "create",
      "create-error", "presentation", "qr", "countdown", "renew", "cancel", "result", "compare-body", "clear-compare", "backend-notice",
    ]) {
      expect(ZKP_HTML).toContain(`id="${id}"`);
    }
  });

  it("explains the experimental boundary and the self-asserted source", () => {
    expect(ZKP_HTML).toContain("有備而來");
    expect(ZKP_HTML).toContain("432 MB");
    expect(ZKP_HTML).toContain("並非數位發展部官方「數位憑證皮夾」支援的流程");
    expect(ZKP_HTML).toContain("自發、非政府背書");
    expect(ZKP_HTML).toContain("只收到證明與是非結果");
    expect(ZKP_JS).toContain("不收到出生日期或任何欄位");
  });

  it("receives one-time results, renews on expiry and clears the comparison record", () => {
    expect(ZKP_JS).toContain("new WebSocket(url)");
    expect(ZKP_JS).not.toContain("/api/result/");
    expect(ZKP_JS).not.toContain("setInterval");
    expect(ZKP_JS).toContain("renew(true)");
    expect(ZKP_JS).toContain("bonds-verifier-timings");
    expect(ZKP_JS).toContain("flow:'zkp'");
    expect(ZKP_JS).toContain("sessionStorage.removeItem(TIMINGS_KEY)");
    expect(ZKP_JS).toContain("setTimeout(clearResult,120000)");
    expect(ZKP_JS).toContain("window.addEventListener('pagehide'");
  });

  it("disables creation when the native backend is not configured", () => {
    expect(ZKP_JS).toContain("!configured");
    expect(ZKP_HTML).toContain("ZKP_VERIFIER_URL");
  });
});
