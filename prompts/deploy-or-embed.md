# TWDIW VP Verifier Lite 部署／整合 prompt

把下列 prompt 交給能操作程式碼、GitHub 與 Cloudflare 的 coding agent。請先填入方括號中的資訊；不確定的項目可保留，讓 agent 在執行前詢問。

```text
請使用 https://github.com/mashbean/twdiw-vp-verifier-lite，替我建立 TWDIW OIDC4VP 驗證服務。

目標
- 模式：[新建獨立查驗站／整合到既有服務]
- 公開 HTTPS 網址：[例如 https://verify.example.com]
- 要支援的皮夾：[數位發展部「數位憑證皮夾」／有備而來／兩者]
- 驗證目的：[例如核對姓名、門號末五碼、成年資格、駕照資格]
- 可接受的發卡者：[官方信任清單／另列自有 issuer DID]

實作要求
1. 先讀取 repository 的 README、docs/embedding.md 與 skills/deploy-twdiw-vp-verifier-lite/SKILL.md。
2. 新部署使用 repository 根目錄的 wrangler.jsonc；不要複製 wrangler.mashbean.jsonc。
3. 使用 Cloudflare Workers 與 Durable Objects。設定 VERIFIER_ORIGIN 為實際公開 HTTPS origin。
4. 既有部署更新時保留 Worker、Durable Object namespace 與 verifier did:key；不得為了改名重建 identity。
5. 只要求業務目的真正需要的 claims。卡片實際欄位不明時，先取得去識別化 schema 或在測試環境確認，不猜欄位名稱。
6. 官方卡預設以官方 DID API 驗證 issuer。新增 TRUSTED_ISSUERS 前，先說明信任與風險影響並取得確認。
7. 不把 credential、presentation、QR payload、resultKey、姓名、證號、電話或 disclosure 寫入 application log、analytics 或錯誤追蹤。
8. 不以 iframe 內嵌查驗頁。整合既有服務時使用同源 API、後端呼叫，或導向帶 profile/source query string 的查驗頁。
9. 不宣稱已通過 OpenID Foundation conformance certification。標示目前為 TWDIW Presentation Exchange 加 OIDC4VP 1.0 DCQL 相容層。

驗收要求
- npm test
- npm run typecheck
- npm run cf-typegen
- npx wrangler deploy --dry-run
- 部署後確認首頁與 /api/profiles 回傳 HTTP 200
- 建立查驗，確認 QR 只包含 client_id 與 request_uri，resultKey 沒有進入 QR 或 signed request
- 記錄部署版本、公開網址與 verifier did:key 是否保持不變
- 將真實皮夾、真實卡片與跨裝置出示列成獨立實機驗收，不把 fixture 或本機測試當成完成證據

最後請回報已完成、尚未完成與實機驗收步驟。不要輸出任何 secret 或真實個資。
```

