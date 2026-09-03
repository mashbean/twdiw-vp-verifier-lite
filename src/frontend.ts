export const FRONTEND_HTML = /* html */ `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="支援數位發展部數位憑證皮夾的一鍵部署 OIDC4VP 驗證服務">
  <title>數位皮夾出示證件示範區｜TWDIW VP Verifier Lite</title>
  <link rel="stylesheet" href="/app.css">
  <script src="/app.js" defer></script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="數位皮夾出示證件示範區首頁">
      <span class="brand-mark" aria-hidden="true">✓</span>
      <span>TWDIW VP Verifier Lite</span>
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
      <h1>數位皮夾出示證件示範區</h1>
      <p class="lede">支援數位發展部「數位憑證皮夾」，讓你可以一鍵建立自己的驗證服務</p>
      <div class="hero-actions">
        <a class="cta primary-link" href="#try">我是民眾，開始測試</a>
        <a class="cta secondary-link" href="#developers">我是業者，免費建立服務</a>
      </div>
      <ul class="proof-points" aria-label="服務特點">
        <li>選擇性揭露</li>
        <li>Cloudflare 一鍵部署</li>
        <li>GPL-3.0 開源</li>
      </ul>
    </section>

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
          <div><h3 id="builder-title">選擇驗證目的</h3><p>使用情境決定資料需求，不從欄位清單倒推用途。</p></div>
        </div>
        <div id="profiles" class="profile-grid" aria-live="polite"></div>

        <div class="section-heading source-heading">
          <span class="step">2</span>
          <div><h3>選擇可接受的卡片來源</h3><p>同一個欄位由不同卡片簽署，代表的信任關係並不相同。</p></div>
        </div>
        <div id="sources" class="source-grid"></div>

        <aside id="disclosure" class="disclosure" aria-live="polite"></aside>
        <button id="create" class="primary" type="button">建立一次性查驗 QR Code</button>
        <p id="create-error" class="error" role="alert"></p>
      </div>
    </section>

    <section id="presentation" class="presentation hidden" aria-labelledby="presentation-title">
      <div class="section-heading compact">
        <span class="step">3</span>
        <div><h2 id="presentation-title">請用皮夾掃描</h2><p>此查驗請求 10 分鐘後自動刪除。</p></div>
      </div>
      <div class="qr-shell"><div id="qr" class="qr" aria-label="OIDC4VP 查驗 QR Code"></div></div>
      <a id="deep-link" class="secondary" href="#">在同一台裝置開啟皮夾</a>
      <p id="waiting" class="waiting"><span aria-hidden="true"></span>等待持卡人同意並出示</p>
      <button id="cancel" class="text-button" type="button">取消這次查驗</button>
    </section>

    <section id="result" class="result hidden" aria-live="polite"></section>

    <section class="trust-strip" aria-label="驗證範圍">
      <div><strong>查驗的證據</strong><span>簽章、nonce、audience、holder binding、issuer 信任與憑證狀態</span></div>
      <div><strong>資料保存</strong><span>查驗 session 10 分鐘後刪除，頁面不載入第三方分析工具</span></div>
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
          <p>Cloudflare 會 fork 公開 repo、建立 Worker 與 Durable Objects，再部署到你的帳號。可先用免費方案，超出用量時依 Cloudflare 當期方案計價。</p>
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
          <p>讀取 <code>GET /api/profiles</code>，以 <code>POST /api/presentations</code> 建立 QR，再用獨立的 <code>resultKey</code> 查詢結果。</p>
          <a href="https://github.com/mashbean/twdiw-vp-verifier-lite/blob/main/docs/embedding.md">閱讀內嵌指南 <span aria-hidden="true">↗</span></a>
        </article>
      </div>

      <div class="prompt-block">
        <div>
          <p class="card-kicker">COPYABLE PROMPT</p>
          <h3>直接交給 coding agent</h3>
        </div>
        <button id="copy-prompt" class="copy-button" type="button" data-default="複製 prompt">複製 prompt</button>
        <pre id="deploy-prompt">請使用 https://github.com/mashbean/twdiw-vp-verifier-lite，幫我把 TWDIW OIDC4VP verifier 部署到 Cloudflare Workers。先確認我要新部署或整合既有服務，再設定公開 HTTPS origin、驗證情境與 issuer 信任政策。保留 Durable Object 內的 verifier did:key，不把 credential、presentation、resultKey 或個資寫入 log。完成測試、typecheck、dry-run 與公開網址檢查，並把真實皮夾跨裝置驗收列為獨立步驟。</pre>
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
          <p>示範站只處理所選情境要求的欄位，session 會在 10 分鐘後刪除，前端不載入第三方 analytics。正式部署者仍應檢查自己的 Cloudflare logging 與資料留存設定。</p>
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
        <a href="https://openid.net/specs/openid-4-verifiable-presentations-1_0.html"><strong>OpenID4VP 1.0</strong><span>標準規格</span></a>
        <a href="https://github.com/mashbean/twdiw-vp-verifier-lite"><strong>Verifier Lite</strong><span>原始碼與部署說明</span></a>
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
@media(max-width:900px){.site-nav a:not(:last-child){display:none}.developer-grid,.trust-strip{grid-template-columns:1fr}.developer-card{min-height:0}.resources{grid-template-columns:1fr}.audiences{grid-template-columns:1fr}.audience-card{min-height:260px}}
@media(max-width:760px){main{padding-top:34px}.profile-grid{grid-template-columns:1fr 1fr}.source-grid{grid-template-columns:1fr}.builder,.presentation,.result{border-radius:20px}.evidence{grid-template-columns:1fr}.resource-links{grid-template-columns:1fr}.implementation{border-radius:22px}.prompt-block{grid-template-columns:1fr}.copy-button{justify-self:start}.hero{padding-top:22px}footer{flex-direction:column}}
@media(max-width:480px){.profile-grid{grid-template-columns:1fr}.hero h1{font-size:3rem}.site-header{height:66px;padding-inline:18px}.brand{font-size:.88rem}.brand-mark{width:30px;height:30px}.site-nav{gap:0}.site-nav a{font-size:.86rem}main{padding-inline:18px}.builder{padding:22px 18px}.audience-card{padding:27px}.hero-actions{flex-direction:column}.cta{width:100%}.proof-points{display:grid;gap:8px}.implementation{padding:28px 20px}.prompt-block{padding:20px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--ink:#edf6f1;--ink-soft:#d6e8df;--muted:#adbbb4;--paper:#0d1511;--card:#142019;--line:#304239;--green:#75ddb2;--green-2:#183c2d;--shadow:none}.brand-mark,.primary,.primary-link{background:#edf6f1;color:#132019}.profile,.source,.secondary{background:#142019}.profile[aria-pressed=true],.source[aria-pressed=true]{background:#192c23}.disclosure,.policy{background:#1b2b23}.claim{background:#25372e}.qr-shell{background:white}.business-card,.implementation{background:#08110d}.citizen-card,.resource-links a,.trust-strip div{background:#142019}.developer-card{background:#14271e}.developer-card.featured{background:#edf6f1;color:#132019}.secondary-link{border-color:#edf6f1}.prompt-block{background:#0a1711}.prompt-block pre{background:#050c09}}
`;

export const FRONTEND_JS = /* js */ `
const state={profiles:[],profile:null,source:null,poll:null};
const $=(id)=>document.getElementById(id);
const params=new URLSearchParams(location.search);

function text(tag,value,className){const node=document.createElement(tag);if(className)node.className=className;node.textContent=value;return node}
function clear(node){while(node.firstChild)node.firstChild.remove()}

function renderProfiles(){
  const host=$('profiles');clear(host);
  state.profiles.forEach((profile)=>{
    const button=text('button','', 'profile');button.type='button';button.setAttribute('aria-pressed',String(profile.id===state.profile.id));
    button.append(text('strong',profile.label),text('small',profile.description));
    button.onclick=()=>{state.profile=profile;state.source=profile.variants[0].source;syncURL();renderAll()};host.append(button);
  });
}
function renderSources(){
  const host=$('sources');clear(host);
  state.profile.variants.forEach((variant)=>{
    const button=text('button','', 'source');button.type='button';button.setAttribute('aria-pressed',String(variant.source===state.source));
    button.append(text('strong',variant.source==='government'?'政府／機構發行卡':'持卡人自發證件'),text('small',variant.sourceLabel));
    button.onclick=()=>{state.source=variant.source;syncURL();renderAll()};host.append(button);
  });
}
function renderDisclosure(){
  const variant=state.profile.variants.find((item)=>item.source===state.source);const host=$('disclosure');clear(host);
  host.append(text('h3','這次會要求的欄位'));
  const list=document.createElement('div');list.className='claim-list';
  variant.claims.forEach((name)=>list.append(text('span',variant.claimLabels[name]||name,'claim')));host.append(list);
  host.append(text('p',state.profile.privacyNote),text('p',state.profile.policyNote));
}
function renderAll(){renderProfiles();renderSources();renderDisclosure()}
function syncURL(){const url=new URL(location.href);url.searchParams.set('profile',state.profile.id);url.searchParams.set('source',state.source);history.replaceState(null,'',url)}

async function load(){
  const response=await fetch('/api/profiles',{headers:{accept:'application/json'}});if(!response.ok)throw new Error('無法載入驗證情境');
  const body=await response.json();state.profiles=body.profiles;
  state.profile=state.profiles.find((item)=>item.id===params.get('profile'))||state.profiles.find((item)=>item.id==='identity-name')||state.profiles[0];
  state.source=state.profile.variants.some((item)=>item.source===params.get('source'))?params.get('source'):state.profile.variants[0].source;
  renderAll();
}

async function createPresentation(){
  clearInterval(state.poll);$('create').disabled=true;$('create-error').textContent='';
  try{
    const response=await fetch('/api/presentations',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({profileId:state.profile.id,credentialSource:state.source})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'建立查驗失敗');
    $('qr').innerHTML=data.qrSvg;$('deep-link').href=data.qr;$('presentation').classList.remove('hidden');$('result').className='result hidden';
    $('presentation').scrollIntoView({behavior:'smooth',block:'start'});
    state.poll=setInterval(()=>poll(data.id,data.resultKey),1200);
  }catch(error){$('create-error').textContent=error instanceof Error?error.message:'建立查驗失敗'}finally{$('create').disabled=false}
}

async function poll(id,key){
  try{
    const response=await fetch('/api/result/'+encodeURIComponent(id)+'?key='+encodeURIComponent(key),{headers:{accept:'application/json'}});
    if(response.status===404){clearInterval(state.poll);renderFailure('查驗已過期或結果憑證不符');return}
    const result=await response.json();if(result.status==='pending')return;clearInterval(state.poll);renderResult(result);
  }catch(error){clearInterval(state.poll);renderFailure(error instanceof Error?error.message:'無法讀取查驗結果')}
}

function evidenceCard(title,detail){const card=document.createElement('div');card.className='evidence-card';card.append(text('strong',title),text('small',detail));return card}
function renderResult(data){
  $('presentation').classList.add('hidden');const host=$('result');clear(host);
  if(data.status!=='verified'){renderFailure(data.reason||'驗證未通過');return}
  const passed=data.decision&&data.decision.status==='pass';host.className='result '+(passed?'':'not-established');
  const top=document.createElement('div');top.className='result-top';top.append(text('div',passed?'✓':'!', 'result-icon'));
  const heading=document.createElement('div');heading.append(text('h2',data.decision?.title||'密碼學驗證通過'),text('p',data.decision?.detail||'', 'result-summary'));top.append(heading);host.append(top);
  const evidence=document.createElement('div');evidence.className='evidence';
  evidence.append(evidenceCard('簽章與持有人綁定','已驗證 nonce、audience、credential signature 與 holder key'));
  if(data.credentialSource==='government'){
    const trust=data.trust||{};evidence.append(evidenceCard(trust.onChain?'官方 API ＋ 鏈上紀錄':'官方 API 紀錄',trust.organization||(trust.source==='allowlist'?'部署者 allowlist':'issuer 已啟用')));
    evidence.append(evidenceCard('憑證狀態',data.credentialStatus==='valid'?'狀態清單確認為有效':'狀態為 '+(data.credentialStatus||'unknown')+'，請依服務風險決定是否接受'));
  }else evidence.append(evidenceCard('自然人憑證簽章','MOICA G3 憑證鏈與每張卡 did:key 已驗證'));
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

$('create').onclick=createPresentation;$('cancel').onclick=()=>{clearInterval(state.poll);$('presentation').classList.add('hidden')};
$('copy-prompt').onclick=async()=>{const button=$('copy-prompt');try{await navigator.clipboard.writeText($('deploy-prompt').textContent);button.textContent='已複製';setTimeout(()=>{button.textContent=button.dataset.default},1800)}catch{button.textContent='請手動選取';}};
load().catch((error)=>{$('create-error').textContent=error instanceof Error?error.message:'載入失敗'});
`;
