# 零知識證明年齡查驗（/zkp）

`/zkp` 讓測試者用「有備而來」（Bonds）iOS 皮夾建立一個零知識**年齡述詞證明**，由本 Worker 查驗，並把耗時與既有的 SD-JWT-VC OIDC4VP 出示流程並排比較。皮夾證明「隱藏的出生日期不晚於截止日」（即已滿 N 歲），查驗端只知道是或否，不會收到出生日期或任何卡片欄位。

這是實驗性功能：官方「數位憑證皮夾」不支援；證明在手機端建立需要數十秒；驗證需要 Prepare 電路 432 MB 的 verifying key，Cloudflare Worker 放不下，因此由獨立的原生服務執行。

## 架構

```text
有備而來 App ──掃描 QR（請求 JSON）──▶ 瀏覽器 /zkp 頁
      │                                    │ POST /api/zkp/sessions
      │                                    │ WebSocket /api/zkp/events/:id（resultKey）
      │ 建立 Prepare + Show 證明（數十秒）      │
      ▼                                    ▼
POST /api/zkp/response/:id ──▶ Worker（ZkpSession Durable Object）
                                   │ 比對述詞 metadata、解析 issuer did:key
                                   │ 政府卡：官方 DID API 信任查詢
                                   │ POST ${ZKP_VERIFIER_URL}/verify（Bearer token，60 s timeout）
                                   ▼
                          native/openac-age-verifier（Rust axum）
                          載入 openac-age-v1 verifying keys，verify_linked，回傳是非與耗時
```

- **皮夾**：掃描請求、從卡片的出生日期欄位建立 Prepare（issuer ES256 簽章）與 Show（nonce ＋ 日期述詞）兩個連結的證明，連同述詞 metadata 與建證耗時 POST 到 `u` 指定的 URL。
- **Worker**：建立 session（nonce、截止日、門檻、來源、目的）、產生 QR、驗證封包與 session 的述詞一致、解析 issuer 金鑰、查政府 issuer 信任、轉送證明、把結果經一次性 WebSocket 送回頁面。
- **原生後端**：`native/openac-age-verifier`。金鑰釘在 bonds-tw/backupTW-iOS 的 `openac-age-v1` release（SHA-256 與大小在啟動時檢查）。只回覆 `accepted`、`reason`、`loadMs`、`verifyMs` 與述詞摘要。

## Wire contracts

### 1. 請求 QR（頁面顯示，App 掃描）

Compact JSON，鍵依字母排序，無空白、不跳脫斜線——與 Swift `JSONEncoder` `[.sortedKeys, .withoutEscapingSlashes]` 一致：

```json
{"a":18,"b":"<UUID 大寫>","c":"<32 bytes base64url 無 padding，43 字元>","d":"YYYY-MM-DD","p":"<目的 1..100 字>","s":"g"|"s","t":<epoch 秒>,"u":"https://<origin>/api/zkp/response/<sessionId>","v":1}
```

| 鍵 | 意義 |
|---|---|
| `a` | 最低年齡（1..120，預設 18） |
| `b` | 隨機 UUID；App 的解碼器要求是 UUID，在離線流程用於藍牙，這裡只是不透明的關聯 id |
| `c` | 一次性 nonce，進入電路成為 public input |
| `d` | 截止日：臺北民用日期的今天減 `a` 年；日大於該月天數時取月底（2 月 29 日 → 2 月 28 日） |
| `p` | 目的，顯示在皮夾同意畫面；不得含控制字元（Cc、Cf、行／段分隔），前後空白會被移除 |
| `s` | `g` = 政府 TWDIW 卡片（`credentialSource: government`）；`s` = 有備而來自發 MyData 身分證（`selfIssued`） |
| `t` | 建立時間（epoch 秒）。App 拒絕超過 `OfflineVerifier.maximumPresentationAge`（5 分鐘）或建立於未來 60 秒以上的請求 |
| `u` | 本 Worker 公開 origin 上的回應 URL |
| `v` | 版本 1 |

頁面倒數 5 分鐘；失效且尚未收到結果時自動建立新請求，也可手動「建立新的請求」。Worker 端的 session 多保留 60 秒（alarm 在 lifetime + 60 s），讓已經在建證的皮夾仍能送達；頁面在自動更新後會把舊的結果通道再保留 60 秒。

### 2. App → Worker：`POST /api/zkp/response/:sessionId`

`Content-Type: application/json`，body 是 App 的 `AgePredicateProofPackage`（Swift `JSONEncoder` 鍵名）：

```json
{"claimFormat":2|3,"claimName":"roc_birthday"|"birthdate"|"birthday"|"date_of_birth"|"birth_date"|"出生日期","createdAt":<epoch 毫秒>,"credentialSource":"g"|"s","cutoffDate":"YYYY-MM-DD","issuerDID":"did:key:...","minimumAge":18,"prepareMilliseconds":<int>,"prepareProof":"<base64>","requestNonce":"<nonce c>","showMilliseconds":<int>,"showProof":"<base64>","version":1}
```

上限：body ≤ 6,000,000 字元；每個證明解碼後 ≤ 2,000,000 bytes；`issuerDID` 以 `did:key:` 開頭且 ≤ 300 bytes。

驗證順序（對應 App 的 `AgePredicateProofPackage.validate(answering:)`）：

1. `version === 1`；`requestNonce`、`credentialSource`、`cutoffDate`、`minimumAge` 與 session 完全相同；`claimFormat ∈ {2, 3}`；`claimName` 在上述六個名稱內且 ≤ 31 bytes；證明非空且未超限；截止日可用該格式表示。任何不符 → `failed`、HTTP 400。
2. 以 `resolveDidKeyToJwk` 在本機解析 `issuerDID`（`jwk_jcs-pub` 與 `p256-pub` 兩種拼法皆可），必須是 P-256 公鑰。
3. `credentialSource === "g"`：另外要求 `resolveGovernmentIssuerTrust` 從官方 DID API 回報 `trusted`，否則以其 reason 失敗；證據隨結果送到頁面。`"s"`：沒有登錄簿可查，issuer 就是持卡人自己的每卡金鑰，結果標示為**自發、非政府背書**。
4. 數值截止日：格式 2 → `YYYY*10000+MM*100+DD`；格式 3 → `(YYYY−1911)*10000+MM*100+DD`（民國年必須 > 0）。
5. 呼叫原生後端（第 3 節）。

回應：

```json
{"status":"verified"|"failed","accepted":true|false,"reason"?:"...","minimumAge":18,"credentialSource":"government"|"selfIssued","timingMs":{"holderPrepare":…,"holderShow":…,"transport":…,"verify":…,"nativeLoad":…,"total":…}}
```

HTTP 200 通過；400 驗證／述詞／信任失敗；404 session 不存在或已過期；415 content type 不是 JSON；413 超過大小；502 原生後端無法連線或未設定（`reason: "驗證後端無法連線"`）。

同一個結果物件（加上 `trust` 證據、`trustMs`、`claimName`、`claimFormat`、`cutoffDate`、`cutoff`、`proofBytes`、`assetRelease`；不含 `issuerDID`）經 session 的 WebSocket 送給頁面，之後 Durable Object 立即 `deleteAll()`。

### 3. Worker → 原生後端：`POST ${ZKP_VERIFIER_URL}/verify`

Header `Authorization: Bearer ${ZKP_VERIFIER_TOKEN}`，`AbortSignal.timeout(60_000)`：

```json
{"prepareProof":"<base64 原樣>","showProof":"<base64 原樣>","nonce":"<session nonce>","claimName":"...","claimFormat":2|3,"cutoff":<數值截止日>,"issuerKeyX":"<base64url>","issuerKeyY":"<base64url>"}
```

- 200：`{"accepted":bool,"reason":string|null,"loadMs":int,"verifyMs":int,"prepareProofBytes":int,"showProofBytes":int,"statement":{...},"assetRelease":"openac-age-v1"}`。
- 400：`{"error":"..."}` → `failed`，reason 為「驗證後端拒絕這組證明：…」。
- 401、5xx、逾時或網路錯誤 → 502「驗證後端無法連線」。

述詞（nonce、欄位名稱、格式、截止日）全部來自 Worker session，issuer 金鑰來自 Worker 自行解析的 did:key；封包內的副本只用來比對，不被信任為政策。

### 4. 頁面 API

- `GET /api/zkp/config` → `{configured, requestLifetimeMs, sessionGraceMs, defaultMinimumAge, minimumAgeRange, defaultPurpose, maxPurposeChars, sourceLabels, claimLabels, privacyNotice}`。`configured` 為 false 時頁面顯示後端未設定並停用建立。
- `POST /api/zkp/sessions`（body ≤ 8 KB）`{"credentialSource":"government"|"selfIssued","minimumAge":18,"purpose":"..."}` → `{id, resultKey, eventsUrl, request, qrSvg, responseUrl, cutoffDate, minimumAge, credentialSource, purpose, expiresAt, lifetimeMs}`；未設定後端時 503 `{"error":"zkp verifier backend is not configured"}`。
- `GET /api/zkp/events/:id`：WebSocket，第一則 message 送 `{"type":"subscribe","resultKey":"…"}`，回 `{"status":"ready"}`，之後只送一次結果。最多 4 個 socket。

Durable Object class：`ZkpSession`（binding `ZKP_SESSIONS`，migration `v3`）。

## 隱私邊界

- Worker／Durable Object 只保存 nonce、serviceId、resultKey、來源、門檻、截止日、目的與建立時間，直到結果送出或 alarm（lifetime + 60 s）刪除。
- 證明與 issuer DID 只存在於單次 `submit` 的記憶體，轉送原生後端後丟棄；不寫入 storage、不 log。頁面結果不含 issuer DID。
- 原生後端只記錄是非、耗時、欄位名稱、格式、數值截止日與 nonce 的 SHA-256 前 8 bytes（hex）；它從未收到任何卡片欄位。
- 瀏覽器端的比較紀錄 `sessionStorage['bonds-verifier-timings']` 只含流程、來源、profileId 與毫秒數，關閉分頁即消失，可按「清除比較紀錄」立即清除。
- 自發身分證（MyData）的通過結果只表示「持卡人以自然人憑證派生金鑰自行簽署的出生日期」符合述詞，不是政府機關的年齡證明。

## 耗時欄位與比較怎麼讀

| 欄位 | 量測者 | 意義 |
|---|---|---|
| `holderPrepare` | 皮夾 | 建立 Prepare 證明（含 reblind） |
| `holderShow` | 皮夾 | 建立 Show 證明（含 reblind） |
| `transport` | Worker | 建立 session → 收到 POST；包含掃碼、同意畫面與整個建證時間 |
| `nativeLoad` | 原生後端 | 反序列化兩個證明 |
| `verify` | 原生後端 | `verify_linked` 與述詞比對 |
| `trustMs`（頁面） | Worker | 官方 DID API 查詢（政府卡） |
| `total` | Worker | `submit` 的全程 wall time，含信任查詢與後端來回 |

比較面板讀 `sessionStorage['bonds-verifier-timings']`（JSON 陣列、最新在後、最多 20 筆）。首頁在 SD-JWT-VC 結果後寫入 `{flow:"sd-jwt-vc", source, profileId, at, totalMs, verifyMs, credentialMs, trustMs}`；`/zkp` 在通過後寫入 `{flow:"zkp", source, at, totalMs, verifyMs, trustMs, holderPrepareMs, holderShowMs, transportMs}`。面板顯示同一來源最近一筆的兩種流程：SD-JWT-VC 沒有皮夾端建證與傳輸量測，ZKP 的 `verify` 是原生後端的驗證時間，兩者的 `total` 都是 Worker 全程。缺少 SD-JWT-VC 紀錄時會給連到首頁同一來源情境的連結。

## 設定

| 名稱 | 類型 | 說明 |
|---|---|---|
| `ZKP_VERIFIER_URL` | secret（`wrangler secret put`；不可同時是 var） | 原生後端 base URL，例如 `https://zkp-native.example`；未設定時 `/zkp` 只說明、不能建立請求 |
| `ZKP_VERIFIER_TOKEN` | secret（`wrangler secret put ZKP_VERIFIER_TOKEN`） | 對應後端 `OPENAC_AGE_VERIFIER_TOKEN` 的 bearer token |

原生後端的啟動方式、金鑰下載與釘住規則見 `native/openac-age-verifier`。
