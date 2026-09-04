# 階段收尾註記（2026-09-04）

「請出示皮夾」已完成第一階段的開源、部署與示範站建置。本文件是目前狀態的檢查點，不代表 OIDC4VP 相容性、所有卡片或所有實機組合均已驗收完成。

## 本階段完成

- 以 GPL-3.0-only 公開原始碼，提供 Cloudflare 一鍵部署、部署 skill、整合 prompt 與 API 文件。
- 建立 [verifier.mashbean.net](https://verifier.mashbean.net/) 示範站，並加入 mashbean.net 作品集與研究／開發報告。
- 將數位發展部「數位憑證皮夾」與「有備而來」分成明確的皮夾選項，依各自支援的 request dialect 產生 OIDC4VP 要求。
- 建立姓名、成年、超商取貨、駕照種類、統一編號與國籍等最小揭露情境，並針對政府卡、自發證件與電信卡型別維護欄位對照。
- 驗證 issuer、credential signature、SD-JWT disclosure、holder binding、nonce、audience 與憑證狀態；密碼學結果和業務條件分開呈現。
- 加入個資告知與確認模組。presentation、credential、揭露值與驗證結果只在單次 Worker 執行記憶體中處理，不寫入 Durable Object；交換完成後刪除 session metadata。
- 完成 2026-09-03 資安檢查及主要修正，並補上首頁連結縮覽圖與社群分享 metadata。

## 已取得的驗證證據

- 收尾時自動化測試為 88 項通過，TypeScript 型別檢查、production dependency audit 與 Cloudflare dry-run 通過。
- 示範站、作品頁、開發報告與縮覽圖均已由正式網址取得 HTTP 200，並以瀏覽器確認主要頁面內容。
- 官方數位憑證皮夾的電信卡超商取貨情境曾以實機完成出示；此結果證明該次卡片、要求與查驗端可以完成交換，不延伸宣稱其他卡型或欄位已全數通過。

## 尚待下一階段驗收

- 官方數位憑證皮夾的「只核對姓名」情境在最後一次回報曾出現 `unknown error [1]`。程式已補上具體卡型要求，仍需以同一張電信卡重新實測後才能結案。
- 有備而來新版自發國民身分證的姓名、成年、國籍與統一編號，需要重新建立卡片後逐項驗收。
- MyData 自發證件的 holder／credential subject 相容修正已進入程式，仍需跑完整真實匯入與出示流程。
- 駕照卡若撤銷狀態為 `unknown`，只能確認簽章、holder binding、issuer 與卡型，不能顯示「駕照仍有效」。
- 線上／離線、iPhone／iPad、政府卡／自發證件、OIDC4VP／ZKP 的完整測試矩陣與秒數報告尚未全部完成。
- 零知識證明的收卡後證明建立與完整查驗流程不在目前 v0.2 範圍內。
- 本專案採 TWDIW 相容的 Presentation Exchange 加 DCQL 混合 request，尚未宣稱通過 OpenID Foundation OIDC4VP 1.0 Final conformance suite。

## 維運界線

- 示範站是依公開原始碼建立的互通實驗，不是數位發展部官方服務，也不等於取得官方驗證者資格。
- 伺服器零持久化不能消除查驗端螢幕、瀏覽器擴充功能、截圖、錄影或部署者自行開啟日誌造成的風險。正式服務仍須依用途完成個資告知、權限、留存與事件應變設計。
- 後續變更應繼續區分自動化測試、部署成功、單次實機成功與完整驗收，避免用其中一項代替其他證據。

