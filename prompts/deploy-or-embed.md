# TWDIW VP Verifier Lite 部署／整合 prompt

把下列 prompt 交給能操作程式碼、GitHub 與 Cloudflare 的 coding agent。請先填入方括號中的資訊；不確定的項目可保留，讓 agent 在執行前詢問。

```text
請使用 https://github.com/mashbean/twdiw-vp-verifier-lite，替我建立 TWDIW OIDC4VP 驗證服務。

目標
- 模式：[新建獨立查驗站／整合到既有服務]
- 公開 HTTPS 網址：[例如 https://verify.example.com]
- 要支援的皮夾：[數位發展部「數位憑證皮夾」／有備而來／兩者]
- 驗證目的：[例如核對姓名、門號末五碼、成年資格、駕照資格]
- 發卡者信任：[預設使用官方 DID 信任清單；自有 issuer 需另做 trust-policy fork]

實作要求
1. 先讀取 repository 的 README、docs/embedding.md 與 skills/deploy-twdiw-vp-verifier-lite/SKILL.md。
2. 新部署使用 repository 根目錄的 wrangler.jsonc；不要複製 wrangler.mashbean.jsonc。
3. 使用 Cloudflare Workers 與 Durable Objects。設定 VERIFIER_ORIGIN 為實際公開 HTTPS origin。
4. 既有部署更新時保留 Worker、Durable Object namespace 與 verifier did:key；不得為了改名重建 identity。
5. 只要求業務目的真正需要的 claims。卡片實際欄位不明時，先取得去識別化 schema 或在測試環境確認，不猜欄位名稱。
6. 官方卡以官方 DID API 驗證 issuer。不要建立讓部署者隨手填入 trusted issuer DID 的通用欄位。
7. credential、presentation、揭露 claims 與 result 只能在單次請求記憶體中處理，經 capability 驗證的 WebSocket 傳回後立即丟棄。不得寫入 Durable Object、KV、D1、R2、application log、Workers Logs、analytics 或錯誤追蹤；resultKey 不得進入 URL。
8. 不以 iframe 內嵌查驗頁。整合既有服務時使用同源 API、後端呼叫，或導向帶 profile/source query string 的查驗頁。
9. 不宣稱已通過 OpenID Foundation conformance certification。標示目前為 TWDIW Presentation Exchange 加 OIDC4VP 1.0 DCQL 相容層。
10. 保留建立 QR 前的個資告知模組，並依實際營運者、聯絡方式、特定目的、合法事由、資料類別、期間、地區、對象、方式、權利行使及拒絕影響調整 `src/privacy-notice.ts`。不得把示範站文字直接當成法律意見或合規認證。

驗收要求
- npm test
- npm run typecheck
- npm run cf-typegen
- npx wrangler deploy --dry-run
- 部署後確認首頁與 /api/profiles 回傳 HTTP 200
- 建立查驗，確認 QR 只包含 client_id 與 request_uri，resultKey 沒有進入 QR 或 signed request
- 確認 resultKey 只經第一個 WebSocket message 傳送，presentation、claims 與 result 沒有寫入任何 Cloudflare storage
- 確認切換驗證目的會同步更新個資告知的目的與資料類別，且未確認告知前不能建立 QR
- 記錄部署版本、公開網址與 verifier did:key 是否保持不變
- 將真實皮夾、真實卡片與跨裝置出示列成獨立實機驗收，不把 fixture 或本機測試當成完成證據

最後請回報已完成、尚未完成與實機驗收步驟。不要輸出任何 secret 或真實個資。

一鍵部署與數位發展部的官方驗證者註冊是兩件事。若需要正式註冊，請另外導向 https://www.wallet.gov.tw/apply/applyIssuerVerifier.html，不得宣稱本專案能代辦或完成官方註冊。
```
