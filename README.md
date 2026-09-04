# 請出示皮夾｜TWDIW VP Verifier Lite

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mashbean/twdiw-vp-verifier-lite)
[![CI](https://github.com/mashbean/twdiw-vp-verifier-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/mashbean/twdiw-vp-verifier-lite/actions/workflows/ci.yml)

輕量化查驗證件，支援數位皮夾。這個專案把台灣數位憑證的查驗端縮成一個 Cloudflare Worker。按下部署按鈕後，Cloudflare 會建立 Worker、兩個 Durable Object binding 與 verifier 自己的 P-256 `did:key`，不需要另架資料庫或 Java 服務。

示範站：<https://verifier.mashbean.net>

這個專案同時服務兩種使用者：持卡人可直接跑一次真實出示流程；業者可一鍵部署獨立查驗站，或透過 API 接進既有服務。

查驗頁預設使用數位發展部「數位憑證皮夾」；「有備而來」尚未公開上架，因此以次要選項直接切換。兩邊共用同一份目的清單，當前皮夾不支援的目的會保留並顯示為停用，不會因切換而改變版面位置。

支援的持卡端：

- 數位發展部「數位憑證皮夾」所發行或保存的 TWDIW SD-JWT 卡片
- 「有備而來」收到的 TWDIW 卡片
- 「有備而來」以 MyData 與自然人憑證建立的 `vc+moica` 自發證件

本專案不發卡，也不代替政府信任清單。它負責產生查驗要求、接收 presentation、驗證密碼學證據，最後依指定情境做最小限度的業務判斷。

## 直接部署

1. 按 README 上方的 **Deploy to Cloudflare**。
2. 選擇 Cloudflare 帳號與新的 GitHub repository 名稱。
3. 等待 Workers Builds 完成。
4. 開啟新的 `workers.dev` 網址即可建立查驗 QR Code。

這四步不需要填 `trusted issuer ID`。通用部署固定使用數位憑證皮夾官方 DID API；專案已移除容易誤設成信任繞道的自訂 issuer 環境變數。若未來要驗證自己的非官方發卡端，應在 fork 中明確增加信任政策、測試與稽核，不應把陌生 DID 貼進部署表單。

Cloudflare 會依 `wrangler.jsonc` 自動建立 Durable Objects。部署完成後第一次開啟，`VerifierIdentity` 會在自己的 Durable Object 內產生 P-256 金鑰；私鑰不會出現在 repository、設定檔或前端回應。

若要使用自己的網域，將它加到 Worker 的 Custom Domains，再把 `VERIFIER_ORIGIN` 設成完整 HTTPS origin。留空時會使用當前請求的 origin。

也可以把 [部署 skill](skills/deploy-twdiw-vp-verifier-lite/SKILL.md) 安裝給 coding agent，或直接使用 [部署／內嵌 prompt](prompts/deploy-or-embed.md)。既有服務整合方式見 [docs/embedding.md](docs/embedding.md)。

一鍵部署只建立獨立的開源查驗器，不會讓部署者成為數位發展部的註冊驗證者。正式申請須另走[數位憑證皮夾發行者／驗證者申請流程](https://www.wallet.gov.tw/apply/applyIssuerVerifier.html)；本專案與該註冊程序無關。

## 內建驗證情境

| 情境 | 最少欄位 | 可用卡片 | 判斷邊界 |
|---|---|---|---|
| 已滿 18 歲 | `over18AtIssuance` | 有備而來自發身分證 | 只揭露簽署的成年述詞；目前不向缺少生日欄位的政府駕照卡提出無法完成的要求 |
| 核對姓名 | `name` | 政府卡、自發身分證 | 姓名相同不等於同一人，高風險流程仍要第二因素 |
| 超商取貨 | `name` + `phonel5` | 已實測的三種電信卡型別 | 證明 issuer 簽署內容與 holder key 綁定，不等於 SIM 此刻仍由本人控制 |
| 駕照種類 | `license_type` | `driverlicense` / `drivinglicense` 卡型 | 簽章、holder binding 與 issuer 信任通過後，撤銷狀態仍可能是 `unknown`；介面會顯示警告，不會把它誤寫成仍有效 |
| 統一編號 | `id_number` / `unifiedNo` | 政府卡、自發身分證 | 會收到完整號碼，並檢查格式及檢查碼；不可直接推論當前國籍或戶籍 |
| 國籍欄位 | `nationality` | 自發身分證 | 這是持卡人用自然人憑證簽署的 MyData 衍生欄位，不冒充政府機關直接出具的國籍證明 |

固定入口可以用 query string 建立，例如：

```text
https://your-worker.example/?profile=adult-18&source=selfIssued
https://your-worker.example/?profile=telecom-pickup&source=government
```

可加上 `wallet=twdiw` 或 `wallet=bonds`；未指定時預設 `twdiw`。有備而來自發證件的逐欄情境需要以目前版本重新建立卡片。舊版卡片只能完整出示，App 會拒絕最小揭露要求；這不是 verifier 可以在伺服器端安全繞過的限制。

機器可讀的完整清單在 `GET /api/profiles`。

## API

建立一筆查驗：

```bash
curl -X POST https://your-worker.example/api/presentations \
  -H 'content-type: application/json' \
  --data '{"profileId":"identity-name","walletFamily":"twdiw","credentialSource":"government"}'
```

回應包含：

- `qr`：跨裝置掃描的查驗 deep link；官方皮夾使用 `modadigitalwallet://authorize`，有備而來相容層使用 `openid4vp://`
- `qrSvg`：可直接嵌入頁面的 QR SVG
- `requestUri`：錢包取得 signed Authorization Request 的位置
- `eventsUrl`：同源一次性 WebSocket；瀏覽器須連線後以第一個 message 提交 `resultKey`
- `resultKey`：訂閱結果需要的 256-bit capability；不會放進 URL、QR 或 request object

前端在顯示 QR 前連上 `eventsUrl`，送出 `{"type":"subscribe","resultKey":"…"}`。驗證結果只經這條已授權的 WebSocket 傳回，不提供輪詢 endpoint。

Durable Object 只暫存 nonce、state、結果 capability、驗證情境與要求的「欄位名稱」，不保存 presentation、credential、揭露值、姓名、電話或統一編號。收到回應後，Worker 在單次請求記憶體內完成驗證並送出結果，隨即刪除 session metadata；未完成的 session 最長 10 分鐘後由 alarm 刪除。

## 驗證內容

政府卡的查驗順序：

1. 從 presentation 找到 issuer DID，只用來查信任來源。
2. 要求官方 DID API 回傳同一個、狀態為啟用的 issuer；通用版本沒有環境變數 allowlist 繞道。
3. 用 `did:key` 內嵌公鑰驗證 credential signature。
4. 重新計算每個 SD-JWT disclosure digest，只開啟 request 指定的欄位。
5. 驗證 holder proof 的 signature、`nonce`、`aud` 與 credential `cnf.jwk` 綁定。
6. 驗證 OAuth Status List 或 TWDIW StatusList2021。TWDIW 路徑會驗證狀態清單 JWT、有效期、gzip bitstring 與 MSB-first 索引。
7. 套用情境規則，將「密碼學驗證通過」與「業務條件成立」分開呈現。

官方 API 記錄若同時帶有效的 Arbitrum transaction，UI 會顯示「官方 API ＋ 鏈上紀錄」；只有 API 記錄時仍會標明較低層級。API 無法確認、issuer 已停用或回傳不同 DID 時一律 fail closed。

自發證件另外驗證：

- presentation 的 per-card `did:key` holder proof
- 同一把 per-card key 對 credential payload 的 JWS
- MOICA G3 憑證鏈與自然人憑證 RSA-2048/SHA-256 簽章
- disclosure commitment 與憑證有效期

## 零知識證明年齡查驗（/zkp，實驗）

`/zkp` 讓「有備而來」皮夾建立零知識**年齡述詞證明**：皮夾證明「出生日期不晚於截止日」（即已滿 N 歲），查驗端只得到是或否，不會收到出生日期或任何欄位。來源可以是政府 TWDIW 卡片（issuer 另查官方 DID API），或有備而來自發的 MyData 國民身分證（結果標示為自發、非政府背書）。頁面同時把耗時與 SD-JWT-VC 出示流程並排比較。官方數位憑證皮夾不支援這個流程。

流程：頁面建立 session 並顯示請求 QR（compact JSON，含一次性 nonce、截止日、門檻、回應 URL；5 分鐘後失效並自動更新）→ 皮夾在手機上建立 Prepare 與 Show 兩個證明（數十秒）→ `POST /api/zkp/response/:id` → Worker 比對述詞、解析 issuer `did:key`、查政府 issuer 信任，再把證明轉送原生後端驗證 → 結果經一次性 WebSocket 回到頁面，session metadata 立即刪除。

原生後端在 `native/openac-age-verifier`（Rust axum 服務），因為 Prepare 電路的 verifying key 有 432 MB，Worker 放不下；它的金鑰釘在 bonds-tw/backupTW-iOS 的 `openac-age-v1` release。Worker 只轉送證明，不保存也不記錄；後端只回覆是非與耗時。

API：

- `GET /api/zkp/config`：`configured`、請求存活時間、預設門檻與目的、來源與欄位標籤、個資告知。
- `POST /api/zkp/sessions`：`{"credentialSource":"government"|"selfIssued","minimumAge":18,"purpose":"…"}` → `id`、`resultKey`、`eventsUrl`、`request`（QR 內容）、`qrSvg`、`cutoffDate`、`expiresAt`、`lifetimeMs`。後端未設定時回 503。
- `GET /api/zkp/events/:id`：與 `/api/events/:id` 相同的一次性訂閱協定。
- `POST /api/zkp/response/:id`：皮夾回傳 `AgePredicateProofPackage`；200 通過、400 失敗、404 session 已不存在、502 後端無法連線。

驗證後端有兩種：示範站用 Cloudflare Container（宣告在 `wrangler.mashbean.jsonc`，需 Workers Paid），開發時可用 `wrangler secret put ZKP_VERIFIER_URL` 指向自己機器上的服務並覆蓋容器。兩者皆無時 `/zkp` 只顯示說明。`GET /api/zkp/config` 的 `backend` 欄位會說明目前是哪一種。Wire contract、驗證順序、隱私邊界與耗時欄位的完整說明見 [docs/zkp-age-proof.md](docs/zkp-age-proof.md)。

## OIDC4VP 相容範圍

OIDC4VP 1.0 Final 以 DCQL 表達 credential query。台灣現行 TWDIW 實作與兩套目標皮夾仍以 DIF Presentation Exchange 為主要請求格式，回應也是 `jwt_vp` 外層包住 TWDIW SD-JWT credential。

本專案因此採 **TWDIW 相容 profile**：signed request object 同時放入 `presentation_definition` 與等價的 `dcql_query`。前者供現行台灣皮夾使用，後者保留朝 Final 規格遷移的接口。這個混合 request 不是「嚴格的 OIDC4VP 1.0 Final conformance」；若產品需要跨國、mdoc 或 Digital Credentials API 相容，應另建純 DCQL profile 並跑 OpenID Foundation conformance suite。

更完整的協定說明見 [docs/protocol-and-trust.md](docs/protocol-and-trust.md)。

### iPhone 同機開啟的限制

本站依頁面選擇產生不同入口。官方數位憑證皮夾使用其正式服務採用的 `modadigitalwallet://authorize`；有備而來相容測試使用 `openid4vp://`。後者是共用的自訂 URL scheme，iOS 裝有多個註冊相同 scheme 的皮夾時，網頁無法指定由哪一款 App 接收，建議直接用目標皮夾掃描 QR Code。

示範站因此以跨裝置掃描 QR Code 為主要流程。同機開啟只在數位憑證皮夾模式提供，點擊前會提示此限制；有備而來模式需從 App 內掃描另一個螢幕上的 QR Code。若未來官方 App 提供專屬 Universal Link 或 Digital Credentials API 介接，才適合改為可明確指定皮夾的同機流程。

## 本機開發

需要 Node.js 22 以上。

```bash
npm install
npm test
npm run typecheck
npm run dev
```

Cloudflare 建置檢查：

```bash
npm run cf-typegen
npx wrangler deploy --dry-run
```

一般部署使用 repository 根目錄的通用 `wrangler.jsonc`。`wrangler.mashbean.jsonc` 只用來更新示範站，不應複製到自己的部署流程。示範站設定刻意保留改名前的 Worker 名稱，避免重建 Durable Object namespace 與 verifier `did:key`。

## 設定

| 變數 | 預設值 | 說明 |
|---|---|---|
| `VERIFIER_ORIGIN` | 空白 | request/response 的公開 HTTPS origin；空白時取目前 origin |
| `OFFICIAL_TRUST_REGISTRY_URL` | `https://frontend.wallet.gov.tw/api/did` | 以 `/{issuerDid}` 查詢的官方 DID API base URL；查不到時拒絕 |
| `ZKP_VERIFIER_URL`（secret） | 未設定 | 零知識年齡證明原生後端（`native/openac-age-verifier`）的 base URL；未設定時 `/zkp` 停用建立請求 |
| `ZKP_VERIFIER_TOKEN` | （secret） | 呼叫原生後端 `/verify` 的 bearer token，以 `wrangler secret put ZKP_VERIFIER_TOKEN` 設定，不寫進設定檔 |

## 安全與隱私限制

- session UUID 與獨立 `resultKey` 分離；拿到 QR 的錢包不會自動取得 browser 查驗結果的 capability。capability 經 WebSocket message 傳送，不進 URL。
- response body 上限 512 KB。presentation、credential、揭露值與結果不寫入 Durable Object；完成後立即清除 metadata，未完成 session 10 分鐘自動清除。
- 網頁採同源 CSP，不載入第三方 script、字型或 analytics。
- `wrangler.jsonc` 預設停用 Workers Logs、invocation logs 與 traces 持久化。部署者若自行開啟平台或外部日誌，須維持不記錄 body、credential、capability 與個資的界線。
- credential 內指定的遠端狀態文件只允許公共 HTTPS hostname，拒絕 credentials、literal IP、localhost、redirect、逾時與過大回應，降低 SSRF 與資源耗盡風險。
- verifier identity 是單一部署的持久識別。更換 Durable Object namespace 會產生新的 `did:key`，既有整合需重新信任。
- 自發證件格式 `vc+moica` 是「有備而來」的明示 extension，不宣稱為標準 SD-JWT VC。
- `/zkp` 的證明封包上限 6,000,000 字元、每個證明 2,000,000 bytes；證明與 issuer DID 只在單次請求記憶體中轉送給原生後端，不寫入 Durable Object，未完成 session 6 分鐘後刪除。原生後端只記錄是非、耗時與 nonce 雜湊前綴。

弱點請依 [SECURITY.md](SECURITY.md) 私下回報，不要把真實 credential、QR、presentation 或個資貼到公開 issue。

2026-09-03 的 Cloudflare/Workers 資安檢查、修正與剩餘風險見 [docs/security-audit-2026-09-03.md](docs/security-audit-2026-09-03.md)。

第一階段已完成的範圍、已取得的證據及尚待實機確認項目，整理於[階段收尾註記（2026-09-04）](docs/project-status-2026-09-04.md)。

建立 QR 前會顯示隨 requested claims 更新的個資蒐集、處理及利用告知，並要求使用者確認已閱讀。法規對照、資料類別 mapping、自行部署必改項目與零持久化限制見 [docs/privacy-compliance.md](docs/privacy-compliance.md)。這個模組協助落實告知與資料最少化，不構成法律意見或自動合規認證。

## 相關連結

- [有備而來](https://bonds.tw)
- [數位發展部數位憑證皮夾](https://wallet.gov.tw/)
- [官方發行者／驗證者申請流程](https://www.wallet.gov.tw/apply/applyIssuerVerifier.html)
- [TWDIW official app 原始碼](https://github.com/moda-gov-tw/TWDIW-official-app)
- [TWDIW 官方文件](https://github.com/moda-gov-tw/TWDIW-official-app/tree/main/Docs)
- [OpenID for Verifiable Presentations 1.0](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)

## 授權

本專案採 [GNU General Public License v3.0 only](LICENSE) 授權。專案名稱與介面不得解讀為數位發展部、發卡機關或電信業者的背書。

Maintained by [mashbean](https://github.com/mashbean).
