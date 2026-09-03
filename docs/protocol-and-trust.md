# 協定與信任模型

## 一筆查驗怎麼走

```text
Verifier browser           Cloudflare Worker / DO                 Wallet
      | POST /presentations        |                                |
      |--------------------------->| 建 session、nonce、state       |
      |  openid4vp QR + resultKey  |                                |
      |<---------------------------|                                |
      |                            |<--- scan QR --------------------|
      |                            |--- signed request object ------>|
      |                            |<--- direct_post vp_token -------|
      |                            | trust + signature + status      |
      | GET /result + resultKey    |                                |
      |--------------------------->|                                |
      | decision + selected claims |                                |
      |<---------------------------|                                |
```

QR 只攜帶 verifier `did:key` 與 `request_uri`。個人資料不在 QR 裡。錢包取得 signed request object 後，才知道 verifier 要求哪些卡片欄位；持卡人同意後，由錢包以 `direct_post` 把 presentation 送到 session 專用的 `response_uri`。

## Request profile

台灣現行 TWDIW 使用 DIF Presentation Exchange：

```json
{
  "presentation_definition": {
    "id": "mashbean-vp",
    "input_descriptors": [{
      "id": "credential",
      "constraints": {
        "fields": [{ "path": ["$.credentialSubject.name"] }]
      }
    }]
  }
}
```

OIDC4VP 1.0 Final 的等價方向是 DCQL：

```json
{
  "dcql_query": {
    "credentials": [{
      "id": "credential",
      "format": "dc+sd-jwt",
      "claims": [{ "path": ["vc", "credentialSubject", "name"] }]
    }]
  }
}
```

本專案在同一個 request object 中保留兩者。這是為了服務已部署的台灣皮夾，不是 Final conformance 的宣稱。未來若 TWDIW 完成 DCQL 遷移，應移除 Presentation Exchange compatibility branch，並將 credential format 與 claim path 一併改成標準 SD-JWT VC profile。

## 三層結果

查驗頁不把所有成功條件壓成一個綠勾：

1. **Issuer trust**：DID 必須在官方 API 啟用。通用版不提供環境變數 allowlist；若 API 記錄另帶有效鏈上交易，作為第二份可稽核證據顯示。
2. **Cryptographic verification**：credential、disclosure、holder proof、nonce、audience、`cnf` 與 status list 均符合。
3. **Policy decision**：例如生日換算後已滿 18 歲，或 credential type 確實屬於駕照。

第三層不成立時，前兩層仍可能成功。UI 會顯示「未能建立條件」，不會把它改寫成密碼學失敗，也不會把 unknown 當成 false。

## 欄位不是結論

- 目前量測到的駕照電子卡沒有 `roc_birthday`，驗證器不再對它提出成年查驗。成年情境改用自發身分證的 `over18AtIssuance`。
- `over18AtIssuance=true` 能持續證明現在已成年；`false` 只能表示發證當時尚未成立，不能永久標記為未成年。
- `id_number` 表示 issuer 對該欄位簽章，不能在沒有政策依據時自動擴張成「目前具有中華民國國籍」。
- 門號末五碼可以做取貨核對，不能單獨證明 SIM 即時 possession。
- 駕照 `license_type` 只有在 issuer trust、credential type、有效期與撤銷狀態都通過後，才形成可用的駕駛資格判斷。

## Trust registry

預設信任來源是：

```text
GET https://frontend.wallet.gov.tw/api/did/{url-encoded issuer DID}
```

程式要求 HTTP 成功、`code == "0"`、`data.id` 與 credential issuer 完全相同，且 `data.status == 1`。`onChainHistory` 只在 entry `status == 1` 且同時有 contract address 與 transaction hash 時顯示為鏈上證據。

目前未在 Worker 內自行執行 Arbitrum RPC 或重播合約狀態。UI 的「API ＋鏈上紀錄」表示官方 API 回應同時攜帶鏈上交易資料；若服務要把鏈上查詢當成獨立信任根，應另外加入 RPC quorum、chain ID、contract ABI、block finality 與 replay protection。

## Status list

驗證器支援兩種格式：

- OAuth Token Status List：`status.status_list`、deflate、LSB-first packed value。
- TWDIW StatusList2021：`vc.credentialStatus` 指向一個 JWT；JWT 的 `vc.credentialSubject.encodedList` 是 gzip+base64 bitstring，索引採 MSB-first。

狀態清單 JWT 的 signature、`nbf`、`exp` 與 `sub` 都會檢查。無 reference 或網路失敗會回傳 `unknown`，不會偽裝成 `valid`；業務端可依風險決定是否接受 unknown。
