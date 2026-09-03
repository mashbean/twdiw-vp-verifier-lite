# 整合到既有服務

TWDIW VP Verifier Lite 可以作為獨立查驗頁，也可以由既有服務呼叫 API。基於 clickjacking 與查驗畫面完整性考量，預設 CSP 設為 `frame-ancestors 'none'`，不支援 iframe。

## 三種整合方式

### 固定情境連結

把使用者導向部署好的 verifier，並在 query string 指定情境與來源：

```text
https://verify.example.com/?wallet=twdiw&profile=identity-name&source=government
https://verify.example.com/?wallet=bonds&profile=telecom-pickup&source=government
```

這是最少程式碼的做法。查驗頁仍會在建立 QR 前顯示要求欄位與判斷限制。

### 同源前端整合

把 Worker 掛在既有服務的同一個 origin 或反向代理路徑。前端先讀取情境，再建立 presentation：

```js
const profiles = await fetch("/api/profiles").then((response) => response.json());

const presentation = await fetch("/api/presentations", {
  method: "POST",
  headers: { "content-type": "application/json", "accept": "application/json" },
  body: JSON.stringify({
    profileId: "identity-name",
    walletFamily: "twdiw",
    credentialSource: "government"
  })
}).then((response) => response.json());

// 將 presentation.qrSvg 顯示給持卡人掃描。
// presentation.resultKey 只能留在記憶體，不可放進 QR、URL、analytics 或 client log。
```

在顯示 QR 前連接一次性結果通道：

```js
const result = await new Promise((resolve, reject) => {
  const socket = new WebSocket(presentation.eventsUrl);
  socket.onopen = () => socket.send(JSON.stringify({
    type: "subscribe",
    resultKey: presentation.resultKey
  }));
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.status !== "ready") resolve(message);
  };
  socket.onerror = () => reject(new Error("result channel failed"));
});
```

驗證完成時只送出一次 `verified` 或 `failed`，內容包含密碼學證據、信任來源、要求範圍內的揭露 claims 及情境判斷。沒有輪詢 endpoint，也沒有查驗結果資料庫。

### 後端整合

既有服務也可由後端呼叫 verifier API，並自行代理一次性 WebSocket。不得把 WebSocket 收到的 claims 寫入 session store、analytics 或 application log；若業務確實需要留存，應脫離本專案的「零持久化」範圍另做法遵、告知與保存期限設計。

## 安全邊界

- QR 是 `openid4vp://` Authorization Request 入口，只帶 verifier `client_id` 與 `request_uri`。
- `resultKey` 是訂閱結果的 bearer capability，只經 WebSocket message 傳送，不會放進 URL、QR 或 signed request。
- Durable Object 只存 nonce、state、capability、profile、欄位名稱等非揭露內容；完成後立即刪除，未完成 session 在 10 分鐘後由 alarm 刪除。
- presentation、credential、揭露 claims 與結果只存在於單次請求記憶體及已授權 WebSocket，不寫入 Cloudflare storage。
- 不要把 presentation response、SD-JWT disclosure 或完整 API response 傳給第三方 analytics。
- 自訂頁面仍應在掃碼前顯示要求欄位、發卡來源與判斷限制。
- 更新既有部署時應保留 identity Durable Object namespace，否則會產生新的 verifier `did:key`。

## 自訂情境

驗證情境定義在 `src/profiles.ts`。每個 variant 指定 wallet family、credential source、必要 claims 與可選 credential type。調整情境前先從去識別化 schema 確認卡片真正存在的欄位；OIDC4VP 查詢要求任何不存在的必填欄位時，錢包會拒絕出示整張卡。

有備而來舊版自發證件沒有逐欄揭露能力。若只要求 `unifiedNo`、`nationality` 或 `over18AtIssuance`，舊卡會拒絕出示；應由持卡人以目前版本重新建立證件，不要把 verifier 改成要求整張身分資料。

加入情境後，至少測試：

1. `GET /api/profiles` 只公開必要設定。
2. signed request 的 Presentation Exchange 與 DCQL 查詢一致。
3. 回應未揭露未要求 claims。
4. 正確卡片可出示，缺欄位、錯 issuer、過期或撤銷卡片會失敗。
5. 測試資料與真實跨裝置驗收分開記錄。
