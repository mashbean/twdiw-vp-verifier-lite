import { describe, expect, it } from "vitest";
import { FRONTEND_HTML, FRONTEND_JS } from "../src/frontend";

describe("landing page", () => {
  it("presents the citizen and service-provider paths", () => {
    expect(FRONTEND_HTML).toContain("數位皮夾出示證件示範區");
    expect(FRONTEND_HTML).toContain("支援數位發展部「數位憑證皮夾」，讓你可以一鍵建立自己的驗證服務");
    expect(FRONTEND_HTML).toContain("我是民眾，開始測試");
    expect(FRONTEND_HTML).toContain("我是業者，免費建立服務");
    expect(FRONTEND_HTML).toContain("開始前常見的問題");
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
});
