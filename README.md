# TWDIW VP Verifier Lite｜數位皮夾出示證件示範區

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mashbean/twdiw-vp-verifier-lite)
[![CI](https://github.com/mashbean/twdiw-vp-verifier-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/mashbean/twdiw-vp-verifier-lite/actions/workflows/ci.yml)

把台灣數位憑證的查驗端縮成一個 Cloudflare Worker。按下部署按鈕後，Cloudflare 會建立 Worker、兩個 Durable Object binding 與 verifier 自己的 P-256 `did:key`，不需要另架資料庫或 Java 服務。

示範站：<https://verifier.mashbean.net>

這個專案同時服務兩種使用者：持卡人可直接跑一次真實出示流程；業者可一鍵部署獨立查驗站，或透過 API 接進既有服務。

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

Cloudflare 會依 `wrangler.jsonc` 自動建立 Durable Objects。部署完成後第一次開啟，`VerifierIdentity` 會在自己的 Durable Object 內產生 P-256 金鑰；私鑰不會出現在 repository、設定檔或前端回應。

若要使用自己的網域，將它加到 Worker 的 Custom Domains，再把 `VERIFIER_ORIGIN` 設成完整 HTTPS origin。留空時會使用當前請求的 origin。

也可以把 [部署 skill](skills/deploy-twdiw-vp-verifier-lite/SKILL.md) 安裝給 coding agent，或直接使用 [部署／內嵌 prompt](prompts/deploy-or-embed.md)。既有服務整合方式見 [docs/embedding.md](docs/embedding.md)。

## 內建驗證情境

| 情境 | 最少欄位 | 可用卡片 | 判斷邊界 |
|---|---|---|---|
| 已滿 18 歲 | 政府卡 `roc_birthday`；自發證件 `over18AtIssuance` | 駕照、含生日的政府卡、自發身分證 | 政府卡會讓查驗端看到生日；自發證件只揭露發證時已成年述詞 |
| 核對姓名 | `name` | 政府卡、自發身分證 | 姓名相同不等於同一人，高風險流程仍要第二因素 |
| 超商取貨 | `name` + `phonel5` | 已實測的三種電信卡型別 | 證明 issuer 簽署內容與 holder key 綁定，不等於 SIM 此刻仍由本人控制 |
| 駕照資格 | `type` | `driverlicense` / `drivinglicense` 卡型 | 同時驗證憑證有效期與狀態；不要求姓名、統一編號、生日或管轄編號 |
| 統一編號 | `id_number` / `unifiedNo` | 政府卡、自發身分證 | 會收到完整號碼，並檢查格式及檢查碼；不可直接推論當前國籍或戶籍 |
| 國籍欄位 | `nationality` | 自發身分證 | 這是持卡人用自然人憑證簽署的 MyData 衍生欄位，不冒充政府機關直接出具的國籍證明 |

固定入口可以用 query string 建立，例如：

```text
https://your-worker.example/?profile=adult-18&source=government
https://your-worker.example/?profile=telecom-pickup&source=government
```

機器可讀的完整清單在 `GET /api/profiles`。

## API

建立一筆查驗：

```bash
curl -X POST https://your-worker.example/api/presentations \
  -H 'content-type: application/json' \
  --data '{"profileId":"adult-18","credentialSource":"government"}'
```

回應包含：

- `qr`：跨裝置掃描的 `openid4vp://` deep link
- `qrSvg`：可直接嵌入頁面的 QR SVG
- `requestUri`：錢包取得 signed Authorization Request 的位置
- `resultKey`：查詢結果需要的 256-bit capability；不會放進 QR 或 request object

查詢結果：

```text
GET /api/result/{id}?key={resultKey}
```

Presentation session 保存 10 分鐘後由 Durable Object alarm 刪除。結果只保留情境要求的欄位，不保存未要求的 SD-JWT claims。

## 驗證內容

政府卡的查驗順序：

1. 從 presentation 找到 issuer DID，只用來查信任來源。
2. 要求官方 DID API 回傳同一個、狀態為啟用的 issuer；若部署者另設 `TRUSTED_ISSUERS`，精確相符者也可通過。
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

## OIDC4VP 相容範圍

OIDC4VP 1.0 Final 以 DCQL 表達 credential query。台灣現行 TWDIW 實作與兩套目標皮夾仍以 DIF Presentation Exchange 為主要請求格式，回應也是 `jwt_vp` 外層包住 TWDIW SD-JWT credential。

本專案因此採 **TWDIW 相容 profile**：signed request object 同時放入 `presentation_definition` 與等價的 `dcql_query`。前者供現行台灣皮夾使用，後者保留朝 Final 規格遷移的接口。這個混合 request 不是「嚴格的 OIDC4VP 1.0 Final conformance」；若產品需要跨國、mdoc 或 Digital Credentials API 相容，應另建純 DCQL profile 並跑 OpenID Foundation conformance suite。

更完整的協定說明見 [docs/protocol-and-trust.md](docs/protocol-and-trust.md)。

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
| `TRUSTED_ISSUERS` | 空白 | 逗號分隔的額外精確 allowlist，適合自有發卡端或測試環境 |

`TRUSTED_ISSUERS` 是信任決策，不是一般相容性開關。加入 DID 前應確認組織身分、金鑰管理、撤銷流程與事故回應方式。

## 安全與隱私限制

- session UUID 與獨立 `resultKey` 分離；拿到 QR 的錢包不會自動取得 browser 查詢結果的 capability。
- response body 上限 512 KB，session 10 分鐘自動清除，所有動態 API 回應設定 `no-store`。
- 網頁採同源 CSP，不載入第三方 script、字型或 analytics。
- 部署者仍可能在 Cloudflare 平台層啟用 request log。正式服務應關閉會保存 body、query string 或完整路徑的外部日誌，並訂定資料留存政策。
- verifier identity 是單一部署的持久識別。更換 Durable Object namespace 會產生新的 `did:key`，既有整合需重新信任。
- 自發證件格式 `vc+moica` 是「有備而來」的明示 extension，不宣稱為標準 SD-JWT VC。

弱點請依 [SECURITY.md](SECURITY.md) 私下回報，不要把真實 credential、QR、presentation 或個資貼到公開 issue。

## 相關連結

- [有備而來](https://bonds.tw)
- [數位發展部數位憑證皮夾](https://wallet.gov.tw/)
- [TWDIW official app 原始碼](https://github.com/moda-gov-tw/TWDIW-official-app)
- [TWDIW 官方文件](https://github.com/moda-gov-tw/TWDIW-official-app/tree/main/Docs)
- [OpenID for Verifiable Presentations 1.0](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)

## 授權

本專案採 [GNU General Public License v3.0 only](LICENSE) 授權。專案名稱與介面不得解讀為數位發展部、發卡機關或電信業者的背書。

Maintained by [mashbean](https://github.com/mashbean).
