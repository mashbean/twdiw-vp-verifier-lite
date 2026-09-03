# 「請出示皮夾」Cloudflare 資安檢查

檢查日期：2026-09-03  
範圍：Cloudflare Worker、Durable Objects、OIDC4VP request/response、政府 issuer 信任、狀態清單、前端結果通道與部署設定。

這份檢查依 Cloudflare Workers 與 Durable Objects 當期文件、Wrangler 4.128.0 config schema、`@cloudflare/workers-types` 5.20260903.1，以及專案測試執行。它是原始碼層級的安全檢查，不是第三方滲透測試或法遵意見。

## 已修正

### 查驗個資曾寫入 Durable Object

舊流程把 `claims`、`decision`、issuer trust 與 credential status 寫回 session，直到十分鐘 alarm 清除。這不符合本專案「一次性查驗、不保存個資」的目標。

現行流程只在 Durable Object 保存待完成交換所需的 nonce、state、result capability、profile、wallet family、credential source、要求欄位名稱與建立時間。presentation、credential、揭露 claims、驗證結果、姓名、電話與統一編號只在收到回應的那次 Worker 執行記憶體中處理。結果經已授權 WebSocket 傳回後，session metadata 立即 `deleteAll()`；未完成交換最長十分鐘後由 alarm 清除。

### Result capability 曾出現在 query string

舊 endpoint 使用 `GET /api/result/{id}?key=...`。query string 容易進入瀏覽歷史、反向代理或平台 invocation metadata。

現行流程刪除輪詢 endpoint。瀏覽器建立同源 WebSocket，於第一個 WebSocket message 送出 256-bit capability；Durable Object 使用固定長度比較驗證後才標記該 socket 可接收結果。capability 不進 URL、QR 或 signed request。每個 session 最多接受四條結果 socket，錯誤 capability 立即關閉。

### Cloudflare observability 預設會持久化 invocation logs

兩份 Wrangler 設定都明確關閉 observability、Workers Logs、invocation logs、logs persistence 與 traces persistence。程式碼沒有 `console.log`，前端沒有第三方 analytics。

Cloudflare 仍是 HTTPS 流量處理者，可能依帳號方案、安全產品與基礎設施政策處理連線 metadata。本專案能保證的是應用程式不把 credential payload 與揭露結果寫入 Cloudflare storage 或 Workers observability。部署者若在 Dashboard、Logpush、Tail Worker、外部代理或錯誤追蹤重新開啟日誌，須自行維持相同邊界。

### 通用 trusted issuer 欄位容易被誤用

已移除 `TRUSTED_ISSUERS` 環境變數與 allowlist bypass。政府／機構卡片固定要求官方 DID API 回傳相同、啟用中的 issuer；API 無法確認時 fail closed。需要私有 issuer 的部署者必須建立明示的 trust-policy fork，不能把陌生 DID 當成一鍵部署參數。

### credential 可指定任意遠端狀態 URL

狀態清單與 web issuer metadata 現在只允許沒有帳密的公共 HTTPS hostname，拒絕 localhost、`.local`、literal IPv4/IPv6、redirect、五秒以上回應與超過一百萬 bytes 的文件。狀態清單 JWT 仍須通過簽章、有效期與 subject/URI 檢查。這降低 SSRF、redirect pivot 與資源耗盡風險。

## 已確認的控制

- OIDC4VP request object 使用 verifier P-256 `did:key` 簽章；nonce 與 state 每次隨機產生。
- presentation 驗證 audience、nonce、holder signature、credential signature 與 `cnf.jwk` 綁定。
- 政府 issuer 必須通過官方 API；鏈上紀錄只提升證據標示，不能取代 API 信任判斷。
- JOSE algorithm 有明確 allowlist，拒絕 `none` 與非預期算法。
- presentation body 上限 512 KB，建立查驗 body 上限 8 KB，動態回應採 `Cache-Control: no-store`。
- CSP 限制同源 script、style、connect 與 form，禁止 iframe、object、camera、microphone、geolocation，並設定 HSTS、COOP、no-referrer 與 nosniff。
- QR 只含 verifier `client_id` 與 `request_uri`，不含 result capability 或查驗結果。
- verifier identity 的私鑰只在既有 `VerifierIdentity` Durable Object namespace；示範站部署保留舊 Worker 名稱，避免換發 DID。

## 尚存風險與營運要求

### 公開建立 session 的資源濫用

`POST /api/presentations` 不需要帳號，攻擊者可大量建立十分鐘 session。程式已有 body 與 socket 上限，但正式高流量服務仍應在 Cloudflare WAF／Rate Limiting 依 IP、ASN 與異常率加限流。不能只靠應用程式內的全域計數，因為 Worker isolate 不提供一致的全域狀態。

### 一次性結果不支援斷線後重取

為了不保存個資，驗證結果只送給查驗開始前已連線且完成 capability 驗證的 WebSocket。瀏覽器若在 presentation 回來的瞬間離線，結果不會被保存，也無法重取，使用者須重新建立查驗。這是刻意選擇的隱私／可用性取捨。

### 官方 API 與狀態清單可用性

官方 issuer API 無法使用時，政府卡 fail closed。卡片未提供支援的狀態清單或狀態端點無法驗證時，狀態為 `unknown`。駕照頁只確認已完成的簽章、holder binding、issuer 與卡型，不把 `unknown` 寫成「仍有效」；高風險服務應拒絕或要求其他查核。

### 自發證件與正式官方流程是不同信任域

`vc+moica` 是有備而來 extension，使用 pinned MOICA G3、自然人憑證簽章與每卡 did:key；它不是官方 TWDIW credential format。舊版自發證件無法逐欄揭露，應重新建立卡片，不能用要求整張身分資料的方式繞過。

一鍵部署也不等於成為官方註冊驗證者。正式介接須另走數位憑證皮夾的發行者／驗證者申請流程。

## 驗證指令

```bash
npm test
npm run typecheck
npm run cf-typegen
npx wrangler deploy --dry-run
```

部署後還要分別檢查首頁、`/api/profiles`、verifier DID、建立 QR、signed request 不含 capability、WebSocket capability 拒絕，以及兩種真實皮夾的跨裝置出示。fixture、CI 或 dry-run 不能代替真實卡片驗收。
