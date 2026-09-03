# 整合到既有服務

TWDIW VP Verifier Lite 可以作為獨立查驗頁，也可以由既有服務呼叫 API。基於 clickjacking 與查驗畫面完整性考量，預設 CSP 設為 `frame-ancestors 'none'`，不支援 iframe。

## 三種整合方式

### 固定情境連結

把使用者導向部署好的 verifier，並在 query string 指定情境與來源：

```text
https://verify.example.com/?profile=identity-name&source=government
https://verify.example.com/?profile=telecom-pickup&source=government
```

這是最少程式碼的做法。查驗頁仍會在建立 QR 前顯示要求欄位與判斷限制。

### 同源前端整合

把 Worker 掛在既有服務的同一個 origin 或反向代理路徑。前端先讀取情境，再建立 presentation：

```js
const profiles = await fetch("/api/profiles").then((response) => response.json());

const presentation = await fetch("/api/presentations", {
  method: "POST",
  headers: { "content-type": "application/json", "accept": "application/json" },
  body: JSON.stringify({ profileId: "identity-name", credentialSource: "government" })
}).then((response) => response.json());

// 將 presentation.qrSvg 顯示給持卡人掃描。
// presentation.resultKey 只能留在查驗端，不可放進 QR、URL analytics 或 client log。
```

完成出示後，以建立時取得的 capability 查詢：

```text
GET /api/result/{id}?key={resultKey}
```

待處理時回傳 `pending`；驗證完成時回傳 `verified` 與分開的密碼學證據、信任來源、揭露 claims 及情境判斷。

### 後端整合

既有服務也可由後端呼叫 verifier API，將 `resultKey` 留在 server session，只把 QR 與必要狀態送到瀏覽器。這通常比開放跨來源 CORS 更容易限制資料流與稽核邊界。

## 安全邊界

- QR 是 `openid4vp://` Authorization Request 入口，只帶 verifier `client_id` 與 `request_uri`。
- `resultKey` 是讀取結果的 bearer capability，不會放進 QR 或 signed request。
- presentation session 在 10 分鐘後由 Durable Object alarm 刪除。
- 不要把 presentation response、SD-JWT disclosure 或完整 API response 傳給第三方 analytics。
- 自訂頁面仍應在掃碼前顯示要求欄位、發卡來源與判斷限制。
- 更新既有部署時應保留 identity Durable Object namespace，否則會產生新的 verifier `did:key`。

## 自訂情境

驗證情境定義在 `src/profiles.ts`。每個 variant 指定 credential source、必要 claims 與可選 credential type。調整情境前先從去識別化 schema 確認卡片真正存在的欄位；OIDC4VP 查詢要求任何不存在的必填欄位時，錢包會拒絕出示整張卡。

加入情境後，至少測試：

1. `GET /api/profiles` 只公開必要設定。
2. signed request 的 Presentation Exchange 與 DCQL 查詢一致。
3. 回應未揭露未要求 claims。
4. 正確卡片可出示，缺欄位、錯 issuer、過期或撤銷卡片會失敗。
5. 測試資料與真實跨裝置驗收分開記錄。

