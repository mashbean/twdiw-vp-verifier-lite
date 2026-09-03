export const FRONTEND_HTML = /* html */ `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="支援數位發展部數位憑證皮夾的一鍵部署 OIDC4VP 驗證服務">
  <title>請出示皮夾｜輕量化數位皮夾查驗</title>
  <link rel="stylesheet" href="/app.css">
  <script src="/app.js" defer></script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="請出示皮夾首頁">
      <span class="brand-mark" aria-hidden="true">✓</span>
      <span>請出示皮夾</span>
    </a>
    <nav class="site-nav" aria-label="主要導覽">
      <a href="#try">立即測試</a>
      <a href="#developers">免費部署</a>
      <a href="#questions">Q&amp;A</a>
      <a href="https://github.com/mashbean/twdiw-vp-verifier-lite">GitHub</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <p class="eyebrow">OPEN-SOURCE OIDC4VP VERIFIER</p>
      <h1>請出示皮夾</h1>
      <p class="lede hero-subtitle">輕量化查驗證件，支援數位皮夾</p>
      <p class="hero-supporting">支援數位發展部「數位憑證皮夾」，讓你可以一鍵建立自己的驗證服務</p>
      <div class="hero-actions">
        <a class="cta primary-link" href="#try">我是民眾，開始測試</a>
        <a class="cta secondary-link" href="#developers">我想建立驗證服務</a>
      </div>
      <ul class="proof-points" aria-label="服務特點">
        <li>選擇性揭露</li>
        <li>Cloudflare 一鍵部署</li>
        <li>GPL-3.0 開源</li>
      </ul>
    </section>

    <aside class="experiment-notice" aria-labelledby="experiment-notice-title">
      <div class="experiment-mark" aria-hidden="true">原始碼</div>
      <div>
        <h2 id="experiment-notice-title">公開原始碼實驗站</h2>
        <p>本服務依數位發展部公開的<a href="https://github.com/moda-gov-tw/TWDIW-official-app">數位憑證皮夾原始碼</a>與技術文件建置，用於互通性研究、開發測試及功能示範。本站由 mashbean 獨立維護，並非數位發展部官方服務，也不代表官方認證或核可。高風險業務不應只依賴本站的示範結果作成決定。</p>
      </div>
    </aside>

    <section class="audiences" aria-label="使用方式">
      <article class="audience-card citizen-card">
        <p class="card-kicker">給皮夾使用者</p>
        <h2>用真實流程測試你的卡片</h2>
        <p>先看到查驗方要求哪些欄位，再由數位憑證皮夾或有備而來掃描、同意並出示。結果會區分密碼學驗證與情境判斷。</p>
        <a href="#try">前往示範查驗 <span aria-hidden="true">→</span></a>
      </article>
      <article class="audience-card business-card">
        <p class="card-kicker">給服務提供者</p>
        <h2>用自己的網域建立驗證服務</h2>
        <p>從 Cloudflare 免費方案開始，部署獨立 verifier、持久的 did:key 與一次性查驗流程，也能透過 API 接進既有服務。</p>
        <a href="#developers">查看部署與整合方式 <span aria-hidden="true">→</span></a>
      </article>
    </section>

    <section id="try" class="try-section" aria-labelledby="try-title">
      <div class="intro-heading">
        <p class="eyebrow">TRY THE VERIFIER</p>
        <h2 id="try-title">建立一筆示範查驗</h2>
        <p>每個情境都先列出必要欄位。卡片若缺少其中一欄，皮夾會拒絕出示，不會用相近欄位代替。</p>
      </div>

      <div class="builder" aria-labelledby="builder-title">
        <div class="section-heading">
          <span class="step">1</span>
          <div><h3>選擇要測試的皮夾</h3><p>預設使用已公開下載的數位憑證皮夾；有備而來目前列為開發測試相容層。</p></div>
        </div>
        <div class="wallet-picker">
          <button id="wallet-twdiw" class="wallet-choice" type="button" aria-pressed="true"><strong>數位憑證皮夾</strong><small>數位發展部公開版本 · 預設</small></button>
          <button id="wallet-bonds" class="wallet-choice" type="button" aria-pressed="false"><strong>有備而來</strong><small>開發測試相容 · 點此切換</small></button>
        </div>

        <div class="section-heading profile-heading">
          <span class="step">2</span>
          <div><h3 id="builder-title">選擇驗證目的</h3><p>使用情境決定資料需求，不從欄位清單倒推用途。</p></div>
        </div>
        <div id="profiles" class="profile-grid" aria-live="polite"></div>

        <div id="source-heading" class="section-heading source-heading">
          <span class="step">3</span>
          <div><h3>選擇可接受的卡片來源</h3><p>同一個欄位由不同卡片簽署，代表的信任關係並不相同。</p></div>
        </div>
        <div id="sources" class="source-grid"></div>

        <aside id="disclosure" class="disclosure" aria-live="polite"></aside>
        <section class="privacy-module" aria-labelledby="privacy-notice-title">
          <div class="privacy-heading">
            <div><p class="card-kicker">PRIVACY BY DESIGN</p><h3 id="privacy-notice-title">個人資料蒐集、處理及利用告知</h3></div>
            <span class="privacy-badge">不留存查驗資料</span>
          </div>
          <p id="privacy-purpose" class="privacy-purpose"></p>
          <div id="privacy-summary" class="privacy-summary"></div>
          <details class="privacy-details">
            <summary>完整告知事項與個資法依據</summary>
            <dl id="privacy-full-notice"></dl>
            <p id="privacy-boundary" class="privacy-boundary"></p>
            <p id="privacy-legal-links" class="privacy-legal-links"></p>
          </details>
          <label class="privacy-ack"><input id="privacy-ack" type="checkbox"> <span>我已確認本次查驗的目的、欄位與利用方式，並會在請持卡人掃碼前提供本告知內容。</span></label>
        </section>
        <button id="create" class="primary" type="button" disabled>建立一次性查驗 QR Code</button>
        <p id="create-error" class="error" role="alert"></p>
      </div>
    </section>

    <section id="presentation" class="presentation hidden" aria-labelledby="presentation-title">
      <div class="section-heading compact">
        <span class="step">4</span>
        <div><h2 id="presentation-title">請用皮夾掃描</h2><p>此查驗請求 10 分鐘後自動刪除。</p></div>
      </div>
      <div class="qr-shell"><div id="qr" class="qr" aria-label="OIDC4VP 查驗 QR Code"></div></div>
      <a id="deep-link" class="secondary" href="#">在本機嘗試開啟</a>
      <p id="deep-link-note" class="deep-link-note"></p>
      <p id="waiting" class="waiting"><span aria-hidden="true"></span>等待持卡人同意並出示</p>
      <button id="cancel" class="text-button" type="button">取消這次查驗</button>
    </section>

    <section id="result" class="result hidden" aria-live="polite"></section>

    <section class="trust-strip" aria-label="驗證範圍">
      <div><strong>查驗的證據</strong><span>簽章、nonce、audience、holder binding、issuer 信任與憑證狀態</span></div>
      <div><strong>資料保存</strong><span>presentation 與揭露欄位只在單次請求的記憶體中處理，不寫入 Durable Object、log 或 analytics</span></div>
      <div><strong>標準範圍</strong><span>TWDIW Presentation Exchange 加 OIDC4VP 1.0 DCQL 相容層</span></div>
    </section>

    <section id="developers" class="implementation" aria-labelledby="implementation-title">
      <p class="eyebrow">FOR DEVELOPERS</p>
      <h2 id="implementation-title">部署一套，或接進你原本的服務</h2>
      <p class="developer-lede">公開 repo 已經包含 Cloudflare Worker、Durable Objects、驗證情境 API、部署 skill 與可直接交給 coding agent 的 prompt。第一次啟動時會在自己的 Durable Object 產生 P-256 <code>did:key</code>。</p>

      <div class="developer-grid">
        <article class="developer-card featured">
          <p class="card-kicker">ONE-CLICK DEPLOY</p>
          <h3>建立獨立查驗站</h3>
          <p>按下後只要連接 GitHub、選 Cloudflare 帳號並開始部署。預設直接使用官方信任清單，不需要填 trusted issuer ID；自訂網域可在部署成功後再設定。</p>
          <a class="developer-action" href="https://deploy.workers.cloudflare.com/?url=https://github.com/mashbean/twdiw-vp-verifier-lite">Deploy to Cloudflare <span aria-hidden="true">↗</span></a>
        </article>
        <article class="developer-card">
          <p class="card-kicker">AGENT SKILL</p>
          <h3>交給開發代理部署</h3>
          <p>Skill 會先確認新部署或既有服務整合，再處理自訂網域、信任設定、測試與真機驗收邊界。</p>
          <a href="https://github.com/mashbean/twdiw-vp-verifier-lite/tree/main/skills/deploy-twdiw-vp-verifier-lite">開啟部署 skill <span aria-hidden="true">↗</span></a>
        </article>
        <article class="developer-card">
          <p class="card-kicker">EMBED WITH API</p>
          <h3>接進既有網站或流程</h3>
          <p>讀取 <code>GET /api/profiles</code>，以 <code>POST /api/presentations</code> 建立 QR，再由一次性 WebSocket 接收結果。揭露資料不寫入 Cloudflare 儲存。</p>
          <a href="https://github.com/mashbean/twdiw-vp-verifier-lite/blob/main/docs/embedding.md">閱讀內嵌指南 <span aria-hidden="true">↗</span></a>
        </article>
        <article class="developer-card">
          <p class="card-kicker">PRIVACY COMPLIANCE</p>
          <h3>套用個資告知模組</h3>
          <p>查驗前依目的列出資料類別、利用期間／地區／對象／方式、當事人權利與拒絕影響。自行部署時必須換成實際營運者資料。</p>
          <a href="https://github.com/mashbean/twdiw-vp-verifier-lite/blob/main/docs/privacy-compliance.md">閱讀合規實作指南 <span aria-hidden="true">↗</span></a>
        </article>
      </div>

      <aside class="official-registration" aria-labelledby="official-registration-title">
        <div>
          <p class="card-kicker">OFFICIAL REGISTRATION</p>
          <h3 id="official-registration-title">成為官方註冊驗證者</h3>
          <p>部署這套開源查驗器只會建立技術服務，不會取得官方驗證者身分。若要正式介接數位憑證皮夾生態系，仍須另向數位發展部提出申請；本專案不代辦，也不代表申請已獲核可。</p>
        </div>
        <a href="https://www.wallet.gov.tw/apply/applyIssuerVerifier.html">前往官方申請流程 <span aria-hidden="true">↗</span></a>
      </aside>

      <div class="prompt-block">
        <div>
          <p class="card-kicker">COPYABLE PROMPT</p>
          <h3>直接交給 coding agent</h3>
        </div>
        <button id="copy-prompt" class="copy-button" type="button" data-default="複製 prompt">複製 prompt</button>
        <pre id="deploy-prompt">請使用 https://github.com/mashbean/twdiw-vp-verifier-lite，幫我把「請出示皮夾」部署到 Cloudflare Workers。先使用官方 DID 信任清單，不新增自訂 trusted issuer。保留 Durable Object 內的 verifier did:key；presentation 與揭露欄位只能在單次請求記憶體中處理，不可寫入 Durable Object、log 或 analytics。完成測試、typecheck、dry-run 與公開網址檢查，並把官方數位憑證皮夾的真實跨裝置驗收列為獨立步驟。</pre>
        <a class="prompt-link" href="https://github.com/mashbean/twdiw-vp-verifier-lite/blob/main/prompts/deploy-or-embed.md">開啟完整 prompt 與可填參數</a>
      </div>

      <details class="protocol-details">
        <summary>標準與台灣相容層</summary>
        <p>OIDC4VP 1.0 Final 使用 DCQL。台灣現行皮夾仍以 Presentation Exchange 為主要請求格式，因此這個版本同時送出兩者，並標示為 TWDIW 相容模式。這不代表已通過 OpenID Foundation conformance certification。</p>
      </details>
    </section>

    <section id="questions" class="faq" aria-labelledby="faq-title">
      <div class="intro-heading">
        <p class="eyebrow">Q&amp;A</p>
        <h2 id="faq-title">開始前常見的問題</h2>
      </div>
      <div class="faq-list">
        <details>
          <summary>民眾可以在這裡測試什麼？</summary>
          <p>你可以建立一筆示範查驗，觀察皮夾能否讀取請求、顯示正確欄位、完成同意與出示。不同發卡者的欄位名稱可能不同，卡片缺少必要欄位時不會出示。</p>
        </details>
        <details>
          <summary>資料會被保存或拿去分析嗎？</summary>
          <p>應用程式不保存。Worker 只在收到 presentation 的那次請求中完成驗證，再經已驗證 capability 的 WebSocket 把結果交給建立查驗的瀏覽器。credential、presentation、揭露欄位與結果不寫入 Durable Object；查驗完成後連 session metadata 也立即刪除。此部署同時停用 Workers Logs 持久化，頁面不載入第三方 analytics。Cloudflare 仍是 HTTPS 流量處理者；部署者若另開 Logpush、代理或錯誤追蹤，需自行維持相同界線。</p>
        </details>
        <details>
          <summary>不保存資料，為什麼仍要顯示個資告知？</summary>
          <p>個資法所稱「蒐集」包含以任何方式取得個人資料，不以寫進資料庫為前提。查驗器會在記憶體中接收並判讀持卡人出示的欄位，因此仍在建立 QR 前列出告知事項。零持久化降低後續風險，但不能取代合法事由、目的限制與明確告知。</p>
        </details>
        <details>
          <summary>業者真的可以免費建立服務嗎？</summary>
          <p>程式碼以 GPL-3.0-only 開源，可從 Cloudflare Workers 免費方案開始。實際是否產生費用取決於流量、用量與 Cloudflare 當期方案。</p>
        </details>
        <details>
          <summary>可以直接用 iframe 放進網站嗎？</summary>
          <p>示範站基於安全考量禁止 iframe。既有服務可使用 API 建立查驗、呈現 QR 或導向固定情境連結，並自行設計結果頁。</p>
        </details>
        <details>
          <summary>已滿 18 歲就是零知識證明嗎？</summary>
          <p>不一定。只有卡片直接提供年齡述詞時，才能只揭露該述詞；以生日在 verifier 端計算年齡仍屬選擇性揭露，不是零知識證明。</p>
        </details>
        <details>
          <summary>這是數位發展部的官方服務嗎？</summary>
          <p>不是。這是獨立維護的開源實作，用於研究、測試與快速建立查驗服務，與數位發展部及各發卡機關沒有隸屬關係。</p>
        </details>
      </div>
    </section>

    <section class="resources" aria-labelledby="resources-title">
      <div>
        <p class="eyebrow">ECOSYSTEM</p>
        <h2 id="resources-title">相關服務與技術資料</h2>
      </div>
      <div class="resource-links">
        <a href="https://bonds.tw"><strong>有備而來</strong><span>bonds.tw</span></a>
        <a href="https://wallet.gov.tw/"><strong>數位憑證皮夾</strong><span>官方網站</span></a>
        <a href="https://github.com/moda-gov-tw/TWDIW-official-app"><strong>TWDIW official app</strong><span>官方原始碼</span></a>
        <a href="https://github.com/moda-gov-tw/TWDIW-official-app/tree/main/Docs"><strong>TWDIW 文件</strong><span>官方規格與 API 文件</span></a>
        <a href="https://www.wallet.gov.tw/apply/applyIssuerVerifier.html"><strong>官方發行者／驗證者申請</strong><span>正式介接流程</span></a>
        <a href="https://openid.net/specs/openid-4-verifiable-presentations-1_0.html"><strong>OpenID4VP 1.0</strong><span>標準規格</span></a>
        <a href="https://github.com/mashbean/twdiw-vp-verifier-lite"><strong>Verifier Lite</strong><span>原始碼與部署說明</span></a>
        <a href="https://github.com/mashbean/twdiw-vp-verifier-lite/blob/main/docs/privacy-compliance.md"><strong>個資合規模組</strong><span>告知範本與部署檢核</span></a>
      </div>
    </section>
  </main>

  <footer>
    <span>TWDIW VP Verifier Lite · GPL-3.0-only</span>
    <span>Maintained by <a href="https://github.com/mashbean">mashbean</a></span>
  </footer>
</body>
</html>`;

export const FRONTEND_CSS = /* css */ `
:root{color-scheme:light;--ink:#10241c;--ink-soft:#1d3a2e;--muted:#5c7067;--paper:#f5f7f2;--card:#fff;--line:#dbe5de;--green:#087451;--green-2:#d9f5e8;--blue:#315fe8;--blue-2:#e9eeff;--amber:#b66600;--red:#a82828;--shadow:0 24px 70px rgba(16,52,38,.1)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif}button,a{font:inherit}button{color:inherit}a{color:inherit;text-underline-offset:4px}.site-header{height:76px;display:flex;align-items:center;justify-content:space-between;max-width:1180px;margin:auto;padding:0 28px}.brand{display:flex;align-items:center;gap:11px;font-weight:850;text-decoration:none}.brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--ink);color:white}.site-nav{display:flex;align-items:center;gap:24px}.site-nav a{color:var(--muted);font-size:.92rem;text-decoration:none}.site-nav a:hover{color:var(--ink)}main{max-width:1180px;margin:auto;padding:76px 28px 120px}.hero{max-width:990px;padding:34px 0 68px}.eyebrow,.card-kicker{margin:0 0 12px;color:var(--green);font-size:.76rem;font-weight:850;letter-spacing:.14em}.hero h1{max-width:960px;margin:0;font-size:clamp(3rem,7.2vw,6rem);line-height:1.02;letter-spacing:-.06em}.lede{max-width:830px;margin:28px 0 0;color:var(--muted);font-size:clamp(1.15rem,2.3vw,1.55rem);line-height:1.55}.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px}.cta{display:inline-flex;align-items:center;justify-content:center;min-height:54px;padding:0 22px;border-radius:15px;font-weight:780;text-decoration:none}.primary-link{background:var(--ink);color:white}.secondary-link{border:1px solid var(--ink);background:transparent}.proof-points{display:flex;flex-wrap:wrap;gap:10px 24px;margin:28px 0 0;padding:0;color:var(--muted);font-size:.9rem;list-style:none}.proof-points li::before{content:"✓";margin-right:7px;color:var(--green);font-weight:900}.audiences{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:100px}.audience-card{min-height:290px;padding:36px;border-radius:26px;border:1px solid var(--line);display:flex;flex-direction:column}.citizen-card{background:var(--card)}.business-card{background:var(--ink);color:white}.business-card .card-kicker{color:#7ce5ba}.business-card p:not(.card-kicker){color:#c7d6cf}.audience-card h2{max-width:420px;margin:4px 0 10px;font-size:clamp(1.65rem,3vw,2.35rem);line-height:1.2}.audience-card>p:not(.card-kicker){max-width:500px;margin:0;color:var(--muted)}.audience-card a{margin-top:auto;padding-top:28px;font-weight:780}.try-section{scroll-margin-top:24px}.intro-heading{max-width:760px;margin:0 0 30px}.intro-heading h2{margin:0;font-size:clamp(2.1rem,4.8vw,3.9rem);line-height:1.1;letter-spacing:-.04em}.intro-heading>p:last-child{margin:15px 0 0;color:var(--muted);font-size:1.05rem}.builder,.presentation,.result{background:var(--card);border:1px solid var(--line);border-radius:28px;padding:clamp(24px,5vw,52px);box-shadow:var(--shadow)}.section-heading{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px}.section-heading h2,.section-heading h3{margin:-5px 0 2px;font-size:1.55rem;line-height:1.35}.section-heading p{margin:0;color:var(--muted)}.section-heading.compact{margin-bottom:12px}.step{display:grid;place-items:center;flex:0 0 34px;height:34px;border-radius:50%;background:var(--green-2);color:var(--green);font-weight:850}.profile-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.profile,.source{appearance:none;border:1px solid var(--line);border-radius:16px;background:white;padding:18px;text-align:left;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s}.profile:hover,.source:hover{transform:translateY(-2px);border-color:#a7b8ad}.profile[aria-pressed=true],.source[aria-pressed=true]{border-color:var(--green);box-shadow:inset 0 0 0 1px var(--green);background:#fbfffd}.profile strong,.source strong{display:block;font-size:1.03rem}.profile small,.source small{display:block;margin-top:5px;color:var(--muted);line-height:1.45}.source-heading{margin-top:42px}.source-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.disclosure{margin:28px 0 22px;padding:20px 22px;border-radius:18px;background:#f0f4f1}.disclosure h3{margin:0 0 8px;font-size:1rem}.claim-list{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.claim{padding:5px 10px;border-radius:999px;background:white;border:1px solid var(--line);font-size:.88rem}.disclosure p{margin:8px 0 0;color:var(--muted);font-size:.92rem}.primary,.secondary{display:flex;width:100%;min-height:54px;align-items:center;justify-content:center;border-radius:14px;font-weight:780;text-decoration:none}.primary{border:0;background:var(--ink);color:#fff;cursor:pointer}.primary:hover{background:var(--ink-soft)}.primary:disabled{opacity:.55;cursor:wait}.secondary{border:1px solid var(--ink);color:var(--ink);background:white}.error{color:var(--red);min-height:1.5em;margin:8px 0 0}.presentation,.result{margin-top:24px}.presentation{max-width:650px;margin-inline:auto;text-align:center}.presentation .section-heading{text-align:left}.qr-shell{max-width:430px;margin:22px auto;padding:20px;background:#fff;border:1px solid var(--line);border-radius:22px}.qr svg{display:block;width:100%;height:auto}.waiting{display:flex;align-items:center;justify-content:center;gap:9px;color:var(--muted)}.waiting span{width:9px;height:9px;background:var(--green);border-radius:50%;animation:pulse 1.3s infinite}.text-button{border:0;background:transparent;color:var(--muted);text-decoration:underline;cursor:pointer}.result{max-width:760px;margin-inline:auto}.result-top{display:flex;align-items:center;gap:14px}.result-icon{display:grid;place-items:center;width:54px;height:54px;border-radius:18px;background:var(--green-2);color:var(--green);font-size:1.7rem;font-weight:900}.result.not-established .result-icon{background:#fff0d6;color:#8b5700}.result.failed .result-icon{background:#fae2e2;color:var(--red)}.result h2{margin:0;font-size:1.65rem}.result-summary{margin:4px 0 0;color:var(--muted)}.evidence{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:24px 0}.evidence-card{padding:15px;border:1px solid var(--line);border-radius:15px}.evidence-card strong{display:block}.evidence-card small{color:var(--muted)}.claims{width:100%;border-collapse:collapse;margin-top:18px}.claims th,.claims td{text-align:left;padding:12px 4px;border-bottom:1px solid var(--line);vertical-align:top}.claims th{color:var(--muted);font-weight:500;width:42%}.policy{margin-top:20px;padding:15px 17px;border-left:4px solid var(--green);background:#f0f4f1;color:var(--muted)}.again{margin-top:20px}.trust-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin:84px 0;background:var(--line);border:1px solid var(--line);border-radius:22px;overflow:hidden}.trust-strip div{display:flex;flex-direction:column;gap:5px;padding:24px;background:var(--card)}.trust-strip strong{font-size:.9rem}.trust-strip span{color:var(--muted);font-size:.87rem}.implementation{scroll-margin-top:24px;padding:clamp(30px,6vw,64px);border-radius:30px;background:var(--ink);color:white}.implementation>.eyebrow{color:#7ce5ba}.implementation>h2{max-width:780px;margin:0;font-size:clamp(2.25rem,5.5vw,4.5rem);line-height:1.05;letter-spacing:-.045em}.developer-lede{max-width:820px;margin:22px 0 34px;color:#c7d6cf;font-size:1.05rem}.implementation code{color:#b5f1d8}.developer-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.developer-card{display:flex;flex-direction:column;min-height:300px;padding:25px;border:1px solid #395246;border-radius:20px;background:#173026}.developer-card.featured{background:white;color:var(--ink)}.developer-card.featured p:not(.card-kicker){color:var(--muted)}.developer-card h3{margin:2px 0 9px;font-size:1.4rem;line-height:1.25}.developer-card>p:not(.card-kicker){margin:0;color:#c7d6cf}.developer-card>a{margin-top:auto;padding-top:24px;color:#b5f1d8;font-weight:780}.developer-card.featured>a{color:var(--green)}.prompt-block{display:grid;grid-template-columns:1fr auto;gap:18px;margin-top:16px;padding:28px;border:1px solid #395246;border-radius:20px;background:#0c1d16}.prompt-block h3{margin:0;font-size:1.4rem}.prompt-block pre{grid-column:1/-1;max-height:230px;margin:0;padding:18px;border-radius:14px;background:#07130e;color:#d7e8df;white-space:pre-wrap;overflow:auto;font:13px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace}.copy-button{align-self:start;border:1px solid #61776d;border-radius:10px;background:transparent;color:white;padding:9px 13px;cursor:pointer}.copy-button:hover{background:#173026}.prompt-link{grid-column:1/-1;color:#b5f1d8}.protocol-details{margin-top:20px;padding:19px 0;border-top:1px solid #395246;color:#c7d6cf}.protocol-details summary{cursor:pointer;color:white;font-weight:780}.faq{scroll-margin-top:24px;margin-top:100px}.faq-list{border-top:1px solid var(--line)}.faq details{border-bottom:1px solid var(--line);padding:0 4px}.faq summary{cursor:pointer;padding:22px 46px 22px 0;font-size:1.12rem;font-weight:780;list-style:none;position:relative}.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:"+";position:absolute;right:4px;top:17px;color:var(--green);font-size:1.7rem;font-weight:400}.faq details[open] summary::after{content:"−"}.faq details p{max-width:850px;margin:-4px 0 24px;color:var(--muted)}.resources{display:grid;grid-template-columns:minmax(220px,.65fr) 1.35fr;gap:48px;margin-top:100px}.resources h2{margin:0;font-size:clamp(1.8rem,3.5vw,2.7rem);line-height:1.15}.resource-links{display:grid;grid-template-columns:1fr 1fr;gap:10px}.resource-links a{display:flex;flex-direction:column;padding:17px 19px;border:1px solid var(--line);border-radius:15px;background:var(--card);text-decoration:none}.resource-links a:hover{border-color:#9eb2a7}.resource-links span{color:var(--muted);font-size:.86rem}footer{max-width:1180px;margin:auto;padding:0 28px 54px;display:flex;justify-content:space-between;gap:20px;color:var(--muted);font-size:.9rem}.hidden{display:none!important}@keyframes pulse{50%{opacity:.25;transform:scale(.7)}}
.hero .lede{color:var(--ink);font-size:clamp(1.35rem,2.8vw,2rem);font-weight:760;line-height:1.4}.hero-supporting{max-width:830px;margin:9px 0 0;color:var(--muted);font-size:1.05rem}.experiment-notice{display:grid;grid-template-columns:auto 1fr;gap:20px;margin:-20px 0 40px;padding:22px 24px;border:1px solid #d7b66e;border-radius:20px;background:#fff8e9}.experiment-mark{align-self:start;padding:5px 10px;border-radius:999px;background:#7b5000;color:white;font-size:.76rem;font-weight:850}.experiment-notice h2{margin:-4px 0 3px;font-size:1.18rem}.experiment-notice p{margin:0;color:#654f24}.experiment-notice a{font-weight:750}.deep-link-note{max-width:540px;margin:10px auto 0;color:var(--muted);font-size:.88rem;text-align:left}.wallet-picker{display:grid;grid-template-columns:1fr 1fr;gap:12px}.wallet-choice{appearance:none;width:100%;border:1px solid var(--line);border-radius:16px;background:white;padding:18px;text-align:left;cursor:pointer}.wallet-choice strong,.wallet-choice small{display:block}.wallet-choice small{margin-top:5px;color:var(--muted)}.wallet-choice[aria-pressed=true]{border-color:var(--green);box-shadow:inset 0 0 0 1px var(--green);background:#fbfffd}.profile-heading{margin-top:42px}.profile:disabled{cursor:not-allowed;opacity:.5;background:#eef1ee;border-style:dashed}.profile:disabled:hover{transform:none;border-color:var(--line)}.profile .unavailable{color:var(--amber);font-weight:700}.privacy-module{margin:28px 0 18px;padding:22px;border:1px solid #b8d8c9;border-radius:20px;background:#f8fffb}.privacy-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.privacy-heading h3{margin:0;font-size:1.13rem}.privacy-heading .card-kicker{margin-bottom:4px}.privacy-badge{flex:0 0 auto;border-radius:999px;background:var(--green-2);color:var(--green);padding:5px 10px;font-size:.78rem;font-weight:800}.privacy-purpose{margin:14px 0;color:var(--ink)}.privacy-summary{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.privacy-summary div{padding:12px 14px;border-radius:13px;background:white;border:1px solid var(--line)}.privacy-summary strong,.privacy-summary small{display:block}.privacy-summary small{color:var(--muted)}.privacy-details{margin-top:14px;border-top:1px solid var(--line);padding-top:13px}.privacy-details summary{cursor:pointer;font-weight:750}.privacy-details dl{display:grid;grid-template-columns:minmax(125px,.35fr) 1fr;gap:8px 18px;margin:16px 0}.privacy-details dt{font-weight:750}.privacy-details dd{margin:0;color:var(--muted)}.privacy-boundary{padding:12px 14px;border-left:4px solid var(--amber);background:#fff7ea;color:#6d4a13}.privacy-legal-links a{margin-right:14px;color:var(--green)}.privacy-ack{display:flex;align-items:flex-start;gap:9px;margin-top:17px;padding:14px;border-radius:13px;background:white;border:1px solid var(--line);cursor:pointer}.privacy-ack input{margin-top:6px;accent-color:var(--green)}.result.warning .result-icon{background:#fff0d6;color:#8b5700}.result.warning .policy{border-left-color:var(--amber)}
.official-registration{display:grid;grid-template-columns:1fr auto;align-items:center;gap:28px;margin-top:16px;padding:28px;border:1px solid #6b8f7d;border-radius:20px;background:#132a20}.official-registration .card-kicker{margin-bottom:5px;color:#7ce5ba}.official-registration h3{margin:0;font-size:1.65rem}.official-registration p:not(.card-kicker){max-width:760px;margin:8px 0 0;color:#c7d6cf}.official-registration>a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 17px;border-radius:12px;background:#b5f1d8;color:#10241c;font-weight:800;text-decoration:none;white-space:nowrap}
.developer-grid{grid-template-columns:repeat(2,1fr)}
.primary:disabled{cursor:not-allowed}
@media(max-width:900px){.site-nav a:not(:last-child){display:none}.developer-grid,.trust-strip{grid-template-columns:1fr}.developer-card{min-height:0}.resources{grid-template-columns:1fr}.audiences{grid-template-columns:1fr}.audience-card{min-height:260px}}
@media(max-width:760px){main{padding-top:34px}.profile-grid{grid-template-columns:1fr 1fr}.source-grid{grid-template-columns:1fr}.builder,.presentation,.result{border-radius:20px}.evidence,.privacy-summary{grid-template-columns:1fr}.privacy-heading{display:block}.privacy-badge{display:inline-block;margin-top:10px}.privacy-details dl{grid-template-columns:1fr;gap:3px}.privacy-details dd{margin-bottom:9px}.resource-links{grid-template-columns:1fr}.implementation{border-radius:22px}.prompt-block,.official-registration{grid-template-columns:1fr}.official-registration>a{justify-self:start}.copy-button{justify-self:start}.hero{padding-top:22px}.experiment-notice{grid-template-columns:1fr}footer{flex-direction:column}}
@media(max-width:480px){.profile-grid{grid-template-columns:1fr}.hero h1{font-size:3rem}.site-header{height:66px;padding-inline:18px}.brand{font-size:.88rem}.brand-mark{width:30px;height:30px}.site-nav{gap:0}.site-nav a{font-size:.86rem}main{padding-inline:18px}.builder{padding:22px 18px}.audience-card{padding:27px}.hero-actions{flex-direction:column}.cta{width:100%}.proof-points{display:grid;gap:8px}.implementation{padding:28px 20px}.prompt-block{padding:20px}}
@media(max-width:760px){.wallet-picker{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--ink:#edf6f1;--ink-soft:#d6e8df;--muted:#adbbb4;--paper:#0d1511;--card:#142019;--line:#304239;--green:#75ddb2;--green-2:#183c2d;--shadow:none}.brand-mark,.primary,.primary-link{background:#edf6f1;color:#132019}.profile,.source,.secondary,.wallet-choice{background:#142019}.profile[aria-pressed=true],.source[aria-pressed=true],.wallet-choice[aria-pressed=true]{background:#192c23}.profile:disabled{background:#101713}.disclosure,.policy{background:#1b2b23}.privacy-module{background:#102019;border-color:#365b49}.privacy-summary div,.privacy-ack{background:#142019}.privacy-boundary{background:#2b2418;color:#e7c98f}.claim{background:#25372e}.qr-shell{background:white}.business-card,.implementation{background:#08110d}.citizen-card,.resource-links a,.trust-strip div{background:#142019}.developer-card{background:#14271e}.developer-card.featured{background:#edf6f1;color:#132019}.secondary-link{border-color:#edf6f1}.prompt-block{background:#0a1711}.prompt-block pre{background:#050c09}}
`;

export const FRONTEND_JS = /* js */ `
const state={profiles:[],profile:null,source:null,wallet:'twdiw',socket:null,resultReceived:false,privacyNotice:null,privacyCategories:{},busy:false,deepLink:null};
const $=(id)=>document.getElementById(id);
const params=new URLSearchParams(location.search);

function text(tag,value,className){const node=document.createElement(tag);if(className)node.className=className;node.textContent=value;return node}
function clear(node){while(node.firstChild)node.firstChild.remove()}
function variantsFor(profile){return profile.variants.filter((variant)=>variant.wallets.includes(state.wallet))}
function resetAcknowledgement(){$('privacy-ack').checked=false;syncCreateButton()}
function syncCreateButton(){const button=$('create');button.disabled=state.busy||!$('privacy-ack').checked;button.setAttribute('aria-busy',String(state.busy))}

function chooseWallet(wallet){
  state.wallet=wallet;
  if(!variantsFor(state.profile).length)state.profile=state.profiles.find((item)=>item.id==='identity-name')||state.profiles[0];
  const variants=variantsFor(state.profile);
  if(!variants.some((item)=>item.source===state.source))state.source=variants[0].source;
  resetAcknowledgement();syncURL();renderAll();
}
function renderWallets(){
  $('wallet-twdiw').setAttribute('aria-pressed',String(state.wallet==='twdiw'));
  $('wallet-bonds').setAttribute('aria-pressed',String(state.wallet==='bonds'));
  const link=$('deep-link');const note=$('deep-link-note');const supportsGenericDeepLink=state.wallet==='twdiw';
  link.classList.toggle('hidden',!supportsGenericDeepLink);
  note.textContent=supportsGenericDeepLink
    ?'iPhone 會把 openid4vp 交給系統選定的已安裝皮夾。若開到其他皮夾，請返回並改用目標皮夾掃描上方 QR Code。'
    :'有備而來請從 App 內掃描上方 QR Code。若 QR 顯示在同一支手機，請改在另一個螢幕建立查驗。';
}

function renderProfiles(){
  const host=$('profiles');clear(host);
  state.profiles.forEach((profile)=>{
    const variants=variantsFor(profile);const unavailable=!variants.length;
    const button=text('button','', 'profile');button.type='button';button.disabled=unavailable;button.setAttribute('aria-disabled',String(unavailable));button.setAttribute('aria-pressed',String(!unavailable&&profile.id===state.profile.id));
    button.append(text('strong',profile.label),text('small',profile.description));
    if(unavailable)button.append(text('small','目前只支援有備而來新版自發證件','unavailable'));
    button.onclick=()=>{state.profile=profile;state.source=variants[0].source;resetAcknowledgement();syncURL();renderAll()};host.append(button);
  });
}
function renderSources(){
  const host=$('sources');clear(host);
  const variants=variantsFor(state.profile);
  $('source-heading').classList.toggle('hidden',variants.length===1);
  host.classList.toggle('hidden',variants.length===1);
  variants.forEach((variant)=>{
    const button=text('button','', 'source');button.type='button';button.setAttribute('aria-pressed',String(variant.source===state.source));
    button.append(text('strong',variant.source==='government'?'收到的政府／機構卡片':'MyData 自發證件'),text('small',variant.sourceLabel));
    button.onclick=()=>{state.source=variant.source;resetAcknowledgement();syncURL();renderAll()};host.append(button);
  });
}
function renderDisclosure(){
  const variant=variantsFor(state.profile).find((item)=>item.source===state.source);const host=$('disclosure');clear(host);
  host.append(text('h3','這次會要求的欄位'));
  const list=document.createElement('div');list.className='claim-list';
  variant.claims.forEach((name)=>list.append(text('span',variant.claimLabels[name]||name,'claim')));host.append(list);
  host.append(text('p',state.profile.privacyNote),text('p',state.profile.policyNote));
  if(variant.compatibilityNote)host.append(text('p','有備而來相容性：'+variant.compatibilityNote,'compatibility-note'));
}
function noticeRow(term,description,host){host.append(text('dt',term),text('dd',description))}
function renderPrivacy(){
  const notice=state.privacyNotice;const variant=variantsFor(state.profile).find((item)=>item.source===state.source);if(!notice||!variant)return;
  const purpose='為完成「'+state.profile.label+'」的一次性技術查驗，回答「'+state.profile.resultQuestion+'」';
  $('privacy-purpose').textContent=purpose;
  const categories=state.privacyCategories[variant.claims.join('|')]||[];
  const summary=$('privacy-summary');clear(summary);
  const categoryCard=document.createElement('div');categoryCard.append(text('strong','資料類別'),text('small',categories.map((item)=>item.code+' '+item.examples).join('；')));summary.append(categoryCard);
  const periodCard=document.createElement('div');periodCard.append(text('strong','保存期間'),text('small','查驗結果不寫入伺服器；未完成的 session metadata 最長 10 分鐘'));summary.append(periodCard);
  const full=$('privacy-full-notice');clear(full);
  noticeRow('蒐集者',notice.controller+'｜'+notice.contact,full);
  noticeRow('特定目的',purpose,full);
  noticeRow('資料類別',categories.map((item)=>item.code+' '+item.label+'（'+item.examples+'）').join('；'),full);
  noticeRow('合法事由與同意',notice.lawfulBasis,full);
  noticeRow('期間',notice.period,full);
  noticeRow('地區',notice.region,full);
  noticeRow('對象',notice.recipients,full);
  noticeRow('方式',notice.method,full);
  noticeRow('當事人權利',notice.rights,full);
  noticeRow('不提供的影響',notice.refusalEffect,full);
  $('privacy-boundary').textContent=notice.processorBoundary;
  const links=$('privacy-legal-links');clear(links);links.append(text('strong','法規來源　'));
  notice.legalReferences.forEach((item)=>{const link=text('a',item.label);link.href=item.url;link.target='_blank';link.rel='noreferrer';links.append(link)});
}
function renderAll(){renderWallets();renderProfiles();renderSources();renderDisclosure();renderPrivacy();syncCreateButton()}
function syncURL(){const url=new URL(location.href);url.searchParams.set('wallet',state.wallet);url.searchParams.set('profile',state.profile.id);url.searchParams.set('source',state.source);history.replaceState(null,'',url)}

async function load(){
  const response=await fetch('/api/profiles',{headers:{accept:'application/json'}});if(!response.ok)throw new Error('無法載入驗證情境');
  const body=await response.json();state.profiles=body.profiles;state.privacyNotice=body.privacyNotice;state.privacyCategories=body.privacyCategories||{};
  state.wallet=params.get('wallet')==='bonds'?'bonds':'twdiw';
  const available=state.profiles.filter((profile)=>variantsFor(profile).length);
  state.profile=available.find((item)=>item.id===params.get('profile'))||available.find((item)=>item.id==='identity-name')||available[0];
  const variants=variantsFor(state.profile);
  state.source=variants.some((item)=>item.source===params.get('source'))?params.get('source'):variants[0].source;
  renderAll();
}

async function createPresentation(){
  if(!$('privacy-ack').checked){$('create-error').textContent='請先閱讀並確認本次個資利用告知';return}
  if(state.socket)state.socket.close();state.socket=null;state.resultReceived=false;state.busy=true;syncCreateButton();$('create-error').textContent='';
  try{
    const response=await fetch('/api/presentations',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({profileId:state.profile.id,walletFamily:state.wallet,credentialSource:state.source})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'建立查驗失敗');
    state.deepLink=data.qr;$('qr').innerHTML=data.qrSvg;$('deep-link').href=data.qr;$('presentation').classList.remove('hidden');$('result').className='result hidden';renderWallets();
    $('privacy-ack').checked=false;
    $('presentation').scrollIntoView({behavior:'smooth',block:'start'});
    openResultChannel(data.eventsUrl,data.resultKey);
  }catch(error){$('create-error').textContent=error instanceof Error?error.message:'建立查驗失敗'}finally{state.busy=false;syncCreateButton()}
}

function openResultChannel(url,key){
  const socket=new WebSocket(url);state.socket=socket;
  socket.onopen=()=>socket.send(JSON.stringify({type:'subscribe',resultKey:key}));
  socket.onmessage=(event)=>{
    let data;try{data=JSON.parse(event.data)}catch{return}
    if(data.status==='ready')return;
    state.resultReceived=true;renderResult(data);
  };
  socket.onclose=()=>{if(!state.resultReceived&&!$('presentation').classList.contains('hidden'))renderFailure('一次性結果通道已中斷，請重新建立查驗')};
  socket.onerror=()=>{};
}

function evidenceCard(title,detail){const card=document.createElement('div');card.className='evidence-card';card.append(text('strong',title),text('small',detail));return card}
function statusDetail(data){
  if(data.credentialStatus==='valid')return '狀態清單確認為有效';
  const reason=data.credentialStatusReason==='no supported status-list reference'?'卡片沒有附上目前支援的撤銷狀態清單':data.credentialStatusReason;
  return '狀態為 '+(data.credentialStatus||'unknown')+(reason?'（'+reason+'）':'')+'，請依服務風險決定是否接受';
}
function renderResult(data){
  $('presentation').classList.add('hidden');const host=$('result');clear(host);
  if(data.status!=='verified'){renderFailure(data.reason||'驗證未通過');return}
  const decisionStatus=data.decision?.status||'not-established';const passed=decisionStatus==='pass';const warning=decisionStatus==='warning';host.className='result '+(warning?'warning':passed?'':'not-established');
  const top=document.createElement('div');top.className='result-top';top.append(text('div',passed?'✓':warning?'!':'×', 'result-icon'));
  const heading=document.createElement('div');heading.append(text('h2',data.decision?.title||'密碼學驗證通過'),text('p',data.decision?.detail||'', 'result-summary'));top.append(heading);host.append(top);
  const evidence=document.createElement('div');evidence.className='evidence';
  evidence.append(evidenceCard('簽章與持有人綁定','已驗證 nonce、audience、credential signature 與 holder key'));
  if(data.credentialSource==='government'){
    const trust=data.trust||{};evidence.append(evidenceCard(trust.onChain?'官方 API ＋ 鏈上紀錄':'官方 API 紀錄',trust.organization||'issuer 已啟用'));
    evidence.append(evidenceCard('憑證狀態',statusDetail(data)));
  }else evidence.append(evidenceCard('自然人憑證簽章','MOICA G3 憑證鏈與每張卡 did:key 已驗證'));
  if(data.timingMs)evidence.append(evidenceCard('查驗耗時',data.timingMs.total+' ms（信任清單 '+data.timingMs.trust+' ms、憑證與狀態 '+data.timingMs.credential+' ms）'));
  host.append(evidence);
  const profile=state.profiles.find((item)=>item.id===data.profileId);const labels={};(profile?.variants||[]).forEach((v)=>Object.assign(labels,v.claimLabels||{}));
  const table=document.createElement('table');table.className='claims';
  Object.entries(data.claims||{}).forEach(([name,value])=>{const row=document.createElement('tr');row.append(text('th',labels[name]||name),text('td',String(value)));table.append(row)});host.append(table);
  if(profile)host.append(text('p',profile.policyNote,'policy'));
  const again=text('button','建立另一筆查驗','primary again');again.type='button';again.onclick=()=>{host.className='result hidden';window.scrollTo({top:$('builder-title').offsetTop-40,behavior:'smooth'})};host.append(again);
  host.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderFailure(reason){
  $('presentation').classList.add('hidden');const host=$('result');clear(host);host.className='result failed';
  const top=document.createElement('div');top.className='result-top';top.append(text('div','×','result-icon'));
  const heading=document.createElement('div');heading.append(text('h2','驗證未通過'),text('p',reason,'result-summary'));top.append(heading);host.append(top);
  const again=text('button','重新建立查驗','primary again');again.type='button';again.onclick=createPresentation;host.append(again);host.scrollIntoView({behavior:'smooth',block:'start'});
}

$('wallet-twdiw').onclick=()=>chooseWallet('twdiw');$('wallet-bonds').onclick=()=>chooseWallet('bonds');
$('deep-link').onclick=(event)=>{event.preventDefault();if(!state.deepLink)return;const proceed=window.confirm('iOS 無法指定要開啟哪一個註冊 openid4vp 的皮夾。若開到其他皮夾，請返回並改用目標皮夾掃描 QR Code。仍要在本機嘗試開啟嗎？');if(proceed)location.href=state.deepLink};
$('privacy-ack').onchange=()=>{syncCreateButton();$('create-error').textContent=''};
$('create').onclick=createPresentation;$('cancel').onclick=()=>{if(state.socket)state.socket.close();state.socket=null;$('presentation').classList.add('hidden')};
$('copy-prompt').onclick=async()=>{const button=$('copy-prompt');try{await navigator.clipboard.writeText($('deploy-prompt').textContent);button.textContent='已複製';setTimeout(()=>{button.textContent=button.dataset.default},1800)}catch{button.textContent='請手動選取';}};
load().catch((error)=>{$('create-error').textContent=error instanceof Error?error.message:'載入失敗'});
`;
