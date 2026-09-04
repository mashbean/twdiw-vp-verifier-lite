export const ZKP_HTML = /* html */ `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="用有備而來皮夾建立零知識年齡證明：只證明已滿 N 歲，不揭露出生日期，並與 SD-JWT-VC 出示比較耗時。">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="請出示皮夾">
  <meta property="og:title" content="零知識證明年齡查驗｜請出示皮夾">
  <meta property="og:description" content="皮夾只證明「已滿 N 歲」，查驗方不會收到出生日期。實驗性功能，需要有備而來 App。">
  <meta property="og:url" content="https://verifier.mashbean.net/zkp">
  <title>零知識證明年齡查驗｜請出示皮夾</title>
  <link rel="stylesheet" href="/app.css">
  <link rel="stylesheet" href="/zkp.css">
  <script src="/zkp.js" defer></script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="請出示皮夾首頁">
      <span class="brand-mark" aria-hidden="true">✓</span>
      <span>請出示皮夾</span>
    </a>
    <nav class="site-nav" aria-label="主要導覽">
      <a href="/">SD-JWT-VC 查驗</a>
      <a href="#zkp-try">立即測試</a>
      <a href="#zkp-compare">耗時比較</a>
      <a href="https://github.com/mashbean/twdiw-vp-verifier-lite">GitHub</a>
    </nav>
  </header>

  <main>
    <section class="hero zkp-hero">
      <p class="eyebrow">ZERO-KNOWLEDGE AGE PROOF · EXPERIMENTAL</p>
      <h1>零知識證明年齡查驗</h1>
      <p class="lede hero-subtitle">只證明「已滿 N 歲」，不揭露出生日期</p>
      <p class="hero-supporting">皮夾在手機上證明「出生日期不晚於 <span id="hero-cutoff">截止日</span>」（即已滿 <span id="hero-age">18</span> 歲），來源是政府卡片或有備而來自發的 MyData 國民身分證。本頁只會知道「是」或「否」，不會收到出生日期或任何欄位。</p>
      <ul class="proof-points" aria-label="流程特點">
        <li>不揭露出生日期</li>
        <li>綁定一次性 nonce</li>
        <li>與 SD-JWT-VC 出示並排計時</li>
      </ul>
    </section>

    <aside class="experiment-notice" aria-labelledby="zkp-notice-title">
      <div class="experiment-mark" aria-hidden="true">實驗</div>
      <div>
        <h2 id="zkp-notice-title">實驗性功能</h2>
        <p>需要「有備而來」App 的零知識證明版本，並非數位發展部官方「數位憑證皮夾」支援的流程。證明在手機上建立需要數十秒；驗證由獨立的原生後端（<code>openac-age-verifier</code>）執行，因為 Prepare 電路的 verifying key 有 432 MB，Cloudflare Worker 放不下。本站只轉送證明並回報是非與耗時。</p>
      </div>
    </aside>

    <aside id="backend-notice" class="backend-notice hidden" role="status">ZKP 驗證後端尚未設定（<code>ZKP_VERIFIER_URL</code> 為空）。這個部署目前無法建立零知識證明查驗請求；首頁的 SD-JWT-VC 出示流程不受影響。</aside>

    <section id="zkp-try" class="try-section" aria-labelledby="zkp-try-title">
      <div class="intro-heading">
        <p class="eyebrow">TRY THE AGE PROOF</p>
        <h2 id="zkp-try-title">建立一筆零知識年齡查驗</h2>
        <p>查驗方只決定「至少幾歲」；皮夾用電路證明出生日期在截止日之前，不透露實際日期。</p>
      </div>

      <div class="builder" aria-labelledby="zkp-builder-title">
        <div class="section-heading">
          <span class="step">1</span>
          <div><h3 id="zkp-builder-title">選擇證明來源</h3><p>兩種來源用同一套電路，但簽署出生日期的人不同，信任關係也不同。</p></div>
        </div>
        <div class="source-grid">
          <button id="source-government" class="source" type="button" aria-pressed="true"><strong>政府卡片</strong><small>有備而來收到的 TWDIW 卡片；issuer 需在官方 DID API 為啟用狀態</small></button>
          <button id="source-selfIssued" class="source" type="button" aria-pressed="false"><strong>有備而來自發身分證（MyData）</strong><small>持卡人以自然人憑證派生的每卡金鑰自行簽署；自發、非政府背書</small></button>
        </div>

        <div class="section-heading profile-heading">
          <span class="step">2</span>
          <div><h3>年齡門檻與目的</h3><p>截止日以臺北時間的今天往前推 N 年計算；目的會顯示在皮夾的同意畫面。</p></div>
        </div>
        <div class="age-grid">
          <label class="field"><span>至少幾歲</span><input id="minimum-age" type="number" inputmode="numeric" min="1" max="120" step="1" value="18"><small>1 到 120 的整數</small></label>
          <label class="field"><span>查驗目的</span><input id="purpose" type="text" maxlength="100" value="年齡門檻查驗（零知識證明測試）" autocomplete="off"><small>1 到 100 字，不可含控制字元</small></label>
        </div>

        <aside id="statement" class="statement-box" aria-live="polite">
          <h3>這次會要求證明的述詞</h3>
          <strong class="predicate">出生日期 ≤ <span id="statement-cutoff">…</span>（即已滿 <span id="statement-age">18</span> 歲）</strong>
          <p>皮夾會回傳：Prepare 與 Show 兩個證明、發卡者 did:key、述詞 metadata（欄位名稱、日期格式、截止日、門檻）與手機端建證耗時。</p>
          <p>皮夾不會回傳：出生日期、姓名、統一編號或任何卡片欄位。</p>
        </aside>

        <section class="privacy-module" aria-labelledby="zkp-privacy-title">
          <div class="privacy-heading">
            <div><p class="card-kicker">PRIVACY BY DESIGN</p><h3 id="zkp-privacy-title">個人資料蒐集、處理及利用告知</h3></div>
            <span class="privacy-badge">只收到證明與是非結果</span>
          </div>
          <p id="privacy-purpose" class="privacy-purpose"></p>
          <div id="privacy-summary" class="privacy-summary"></div>
          <details class="privacy-details">
            <summary>完整告知事項與個資法依據</summary>
            <dl id="privacy-full-notice"></dl>
            <p id="privacy-boundary" class="privacy-boundary"></p>
            <p id="privacy-legal-links" class="privacy-legal-links"></p>
          </details>
          <label class="privacy-ack"><input id="privacy-ack" type="checkbox"> <span>我已確認本次查驗的目的、述詞與利用方式，並會在請持卡人掃碼前提供本告知內容。</span></label>
        </section>
        <button id="create" class="primary" type="button" disabled>建立一次性 ZKP 查驗 QR Code</button>
        <p id="create-error" class="error" role="alert"></p>
      </div>
    </section>

    <section id="presentation" class="presentation hidden" aria-labelledby="presentation-title">
      <div class="section-heading compact">
        <span class="step">3</span>
        <div><h2 id="presentation-title">請用有備而來掃描</h2><p>此請求 <span id="countdown" class="countdown">5:00</span> 後失效；失效且尚未收到證明時會自動建立新的請求。</p></div>
      </div>
      <div class="qr-shell"><div id="qr" class="qr" aria-label="零知識證明查驗請求 QR Code"></div></div>
      <p id="presentation-statement" class="deep-link-note"></p>
      <p id="waiting" class="waiting"><span aria-hidden="true"></span>等待皮夾建立證明（手機上需要數十秒）</p>
      <div class="presentation-actions">
        <button id="renew" class="text-button" type="button">建立新的請求</button>
        <button id="cancel" class="text-button" type="button">取消這次查驗</button>
      </div>
    </section>

    <section id="result" class="result hidden" aria-live="polite"></section>

    <section id="zkp-compare" class="compare" aria-labelledby="compare-title">
      <p class="card-kicker">TIMING</p>
      <h2 id="compare-title">與 SD-JWT-VC 出示比較</h2>
      <p>同一個分頁內最近一次的兩種流程並排；紀錄只含毫秒數與來源，不含任何欄位值，關閉分頁即消失。目前來源：<strong id="compare-source">政府卡片（TWDIW）</strong></p>
      <div id="compare-body"></div>
      <div class="compare-actions"><button id="clear-compare" class="text-button" type="button">清除比較紀錄</button></div>
    </section>

    <section class="trust-strip" aria-label="驗證範圍">
      <div><strong>查驗的證據</strong><span>nonce 綁定、述詞 public input、Prepare／Show 證明連結、issuer 金鑰（政府卡另查官方 DID API）</span></div>
      <div><strong>資料保存</strong><span>證明只在單次請求記憶體中轉送給原生後端；Worker 與 Durable Object 不保存證明，也不記錄持卡人資料</span></div>
      <div><strong>後端邊界</strong><span>原生後端只收到證明與述詞，不收到任何欄位；它只記錄是非、耗時與 nonce 的雜湊前綴</span></div>
    </section>

    <section class="faq" aria-labelledby="zkp-faq-title">
      <div class="intro-heading">
        <p class="eyebrow">Q&amp;A</p>
        <h2 id="zkp-faq-title">關於這個實驗</h2>
      </div>
      <div class="faq-list">
        <details>
          <summary>這和首頁的「已滿 18 歲」情境有什麼不同？</summary>
          <p>首頁的成年情境是選擇性揭露：卡片本身要有已簽署的年齡述詞，或直接揭露生日再由 verifier 計算。這一頁是零知識證明：皮夾用電路證明「隱藏的出生日期不晚於截止日」，verifier 只拿到證明與是非。</p>
        </details>
        <details>
          <summary>自發身分證的結果算政府背書嗎？</summary>
          <p>不算。MyData 自發身分證由持卡人以自然人憑證派生的每卡金鑰簽署，證明只說明「持卡人自己簽署的出生日期」符合述詞。結果頁會標示為自發、非政府背書。</p>
        </details>
        <details>
          <summary>為什麼要數十秒，而且還需要另一個後端？</summary>
          <p>手機要為 ES256 簽章與日期比較各建一個證明並互相連結。驗證端需要 Prepare 電路 432 MB 的 verifying key，超出 Cloudflare Worker 的限制，因此由獨立的 Rust 原生服務載入金鑰驗證，Worker 只轉送與計時。</p>
        </details>
        <details>
          <summary>驗證方會拿到什麼？</summary>
          <p>兩個證明物件、發卡者 did:key、述詞 metadata 與是非結果。沒有出生日期、姓名、統一編號或其他欄位；本頁也不顯示 did:key。</p>
        </details>
      </div>
    </section>
  </main>

  <footer>
    <span>TWDIW VP Verifier Lite · GPL-3.0-only</span>
    <span>Maintained by <a href="https://github.com/mashbean">mashbean</a></span>
  </footer>
</body>
</html>`;

export const ZKP_CSS = /* css */ `
.zkp-hero{padding-bottom:44px}.zkp-hero h1{font-size:clamp(2.4rem,6vw,4.6rem)}
.backend-notice{margin:-10px 0 36px;padding:18px 22px;border:1px solid #d99a9a;border-radius:18px;background:#fff1f1;color:#7a2323}.backend-notice code{font-weight:750}
.age-grid{display:grid;grid-template-columns:minmax(160px,.4fr) 1fr;gap:12px}.field{display:flex;flex-direction:column;gap:6px}.field span{font-weight:750;font-size:.92rem}.field input{min-height:48px;padding:0 14px;border:1px solid var(--line);border-radius:13px;background:white;color:var(--ink);font:inherit}.field input:focus{outline:2px solid var(--green);outline-offset:1px}.field small{color:var(--muted)}
.statement-box{margin:26px 0 0;padding:20px 22px;border-radius:18px;background:#f0f4f1}.statement-box h3{margin:0 0 6px;font-size:1rem}.statement-box .predicate{display:block;margin:4px 0 8px;font-size:1.12rem}.statement-box p{margin:6px 0 0;color:var(--muted);font-size:.92rem}
.countdown{font-variant-numeric:tabular-nums;font-weight:800;color:var(--ink)}
.presentation-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 24px;margin-top:6px}
.timing-table{width:100%;border-collapse:collapse;margin-top:18px}.timing-table th,.timing-table td{text-align:left;padding:11px 4px;border-bottom:1px solid var(--line);vertical-align:top;font-size:.95rem}.timing-table tbody th{color:var(--muted);font-weight:500;width:42%}.timing-table thead th{color:var(--ink);font-weight:750}.timing-table td.num{font-variant-numeric:tabular-nums}.timing-table td.num small{display:block;color:var(--muted)}
.compare{margin-top:36px;padding:clamp(24px,5vw,52px);border:1px solid var(--line);border-radius:28px;background:var(--card);box-shadow:var(--shadow)}.compare h2{margin:0 0 8px;font-size:1.55rem}.compare>p{margin:0;color:var(--muted)}.compare-empty{margin:18px 0 0;padding:16px 18px;border-radius:14px;background:#f0f4f1;color:var(--muted)}.compare-hint{margin:14px 0 0;color:var(--muted)}.compare-hint a{font-weight:750;color:var(--green)}.compare-actions{margin-top:16px}
.result .secondary.again{margin-top:20px}
@media(max-width:760px){.age-grid{grid-template-columns:1fr}.compare{border-radius:20px}}
@media(prefers-color-scheme:dark){.backend-notice{background:#2b1818;border-color:#7a3b3b;color:#f2c9c9}.statement-box,.compare-empty{background:#1b2b23}.field input{background:#142019}.compare{background:#142019}}
`;

export const ZKP_JS = /* js */ `
const TIMINGS_KEY='bonds-verifier-timings';
const state={config:null,source:'government',session:null,socket:null,graceSockets:[],countdownTimer:null,resultReceived:false,busy:false,resultClearTimer:null,compareSource:null};
const $=(id)=>document.getElementById(id);
const params=new URLSearchParams(location.search);

function text(tag,value,className){const node=document.createElement(tag);if(className)node.className=className;node.textContent=value;return node}
function clear(node){while(node.firstChild)node.firstChild.remove()}
function sourceLabel(source){return (state.config&&state.config.sourceLabels&&state.config.sourceLabels[source])||source}
function claimLabel(name){return (state.config&&state.config.claimLabels&&state.config.claimLabels[name])||name||'出生日期'}
function ms(value){return typeof value==='number'?value.toLocaleString('zh-Hant')+' ms':'—'}
function kb(bytes){return typeof bytes==='number'?Math.round(bytes/1024)+' KB':'—'}
function when(at){return typeof at==='number'?new Date(at).toLocaleTimeString('zh-Hant',{hour12:false}):'—'}

function taipeiToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const pick=(type)=>Number(parts.find((part)=>part.type===type).value);return {year:pick('year'),month:pick('month'),day:pick('day')}}
function previewCutoff(age){const today=taipeiToday();const year=today.year-age;const day=Math.min(today.day,new Date(Date.UTC(year,today.month,0)).getUTCDate());return String(year).padStart(4,'0')+'-'+String(today.month).padStart(2,'0')+'-'+String(day).padStart(2,'0')}
function currentAge(){const value=Number($('minimum-age').value);return Number.isInteger(value)&&value>=1&&value<=120?value:null}
function currentPurpose(){const value=$('purpose').value.trim();return value||(state.config&&state.config.defaultPurpose)||''}

function clearResult(){
  if(state.resultClearTimer)clearTimeout(state.resultClearTimer);state.resultClearTimer=null;
  const host=$('result');clear(host);host.className='result hidden';state.resultReceived=false;
}
function scheduleResultClear(){
  if(state.resultClearTimer)clearTimeout(state.resultClearTimer);
  state.resultClearTimer=setTimeout(clearResult,120000);
}
function releaseResultSocket(socket){
  socket.onopen=null;socket.onmessage=null;socket.onclose=null;socket.onerror=null;
  if(state.socket===socket)state.socket=null;
}
function closeAllSockets(){
  if(state.socket){const socket=state.socket;releaseResultSocket(socket);socket.close()}
  state.graceSockets.forEach((socket)=>{releaseResultSocket(socket);socket.close()});state.graceSockets=[];
}
function stopCountdown(){if(state.countdownTimer)clearTimeout(state.countdownTimer);state.countdownTimer=null}

function resetAcknowledgement(){$('privacy-ack').checked=false;syncCreateButton()}
function syncCreateButton(){
  const configured=Boolean(state.config&&state.config.configured);const button=$('create');
  button.disabled=state.busy||!configured||!$('privacy-ack').checked||!currentAge();button.setAttribute('aria-busy',String(state.busy));
}
function renderSources(){
  $('source-government').setAttribute('aria-pressed',String(state.source==='government'));
  $('source-selfIssued').setAttribute('aria-pressed',String(state.source==='selfIssued'));
}
function renderStatement(){
  const age=currentAge();const cutoff=age?previewCutoff(age):'（請輸入 1 到 120 的整數）';
  $('statement-age').textContent=age?String(age):'?';$('statement-cutoff').textContent=cutoff;
  $('hero-age').textContent=age?String(age):'N';$('hero-cutoff').textContent=age?cutoff:'截止日';
}
function noticeRow(term,description,host){host.append(text('dt',term),text('dd',description))}
function renderPrivacy(){
  const notice=state.config&&state.config.privacyNotice;if(!notice)return;const age=currentAge()||18;
  const purpose='為完成「已滿 '+age+' 歲」的一次性零知識證明查驗，回答「持卡人是否已滿 '+age+' 歲」';
  const categories='C011 個人描述（是否已滿 '+age+' 歲的是非結果）；C001 辨識個人者（零知識證明物件、發卡者 did:key 與本次驗證紀錄）。只收到證明與是非結果，不收到出生日期或任何欄位。';
  $('privacy-purpose').textContent=purpose;
  const summary=$('privacy-summary');clear(summary);
  const categoryCard=document.createElement('div');categoryCard.append(text('strong','資料類別'),text('small',categories));summary.append(categoryCard);
  const periodCard=document.createElement('div');periodCard.append(text('strong','保存期間'),text('small','證明只在單次請求記憶體中轉送給原生後端後丟棄；結果不寫入伺服器；未完成的 session metadata 最長 6 分鐘'));summary.append(periodCard);
  const full=$('privacy-full-notice');clear(full);
  noticeRow('蒐集者',notice.controller+'｜'+notice.contact,full);
  noticeRow('特定目的',purpose,full);
  noticeRow('資料類別',categories,full);
  noticeRow('合法事由與同意',notice.lawfulBasis,full);
  noticeRow('期間','證明物件只存在於單次查驗的執行記憶體，轉送原生後端驗證後立即丟棄；結果只送到建立查驗的瀏覽器並於 2 分鐘後自動清除；未完成 session 的非揭露 metadata（nonce、述詞、capability）最長保留 6 分鐘。',full);
  noticeRow('地區',notice.region+' 原生驗證後端由本站營運者自行架設。',full);
  noticeRow('對象','本示範站營運者、受託處理 HTTPS 與 Worker 執行的 Cloudflare，以及執行證明驗證的原生後端主機；後端只收到證明物件與述詞，不收到任何欄位。資料不提供行銷、廣告、側寫或其他第三人使用。',full);
  noticeRow('方式','透過有備而來 App 掃描一次性請求，皮夾在手機端建立零知識證明並回傳；Worker 比對述詞 metadata、查詢 issuer 信任、把證明轉送原生後端驗證，只取得是非與耗時，不建立個人資料檔案。',full);
  noticeRow('當事人權利',notice.rights,full);
  noticeRow('不提供的影響',notice.refusalEffect,full);
  $('privacy-boundary').textContent=notice.processorBoundary;
  const links=$('privacy-legal-links');clear(links);links.append(text('strong','法規來源　'));
  (notice.legalReferences||[]).forEach((item)=>{const link=text('a',item.label);link.href=item.url;link.target='_blank';link.rel='noreferrer';links.append(link)});
}
function renderAll(){renderSources();renderStatement();renderPrivacy();renderCompare();syncCreateButton()}
function syncURL(){const url=new URL(location.href);url.searchParams.set('source',state.source);const age=currentAge();if(age)url.searchParams.set('age',String(age));history.replaceState(null,'',url)}
function chooseSource(source){state.source=source;state.compareSource=null;resetAcknowledgement();syncURL();renderAll()}

async function load(){
  const response=await fetch('/api/zkp/config',{headers:{accept:'application/json'}});if(!response.ok)throw new Error('無法載入零知識證明設定');
  state.config=await response.json();
  $('backend-notice').classList.toggle('hidden',Boolean(state.config.configured));
  if(params.get('source')==='selfIssued')state.source='selfIssued';
  const age=Number(params.get('age'));if(Number.isInteger(age)&&age>=1&&age<=120)$('minimum-age').value=String(age);
  if(!$('purpose').value)$('purpose').value=state.config.defaultPurpose||'';
  renderAll();
}

async function createSession(options){
  const opts=options||{};
  if(!state.config||!state.config.configured){$('create-error').textContent='ZKP 驗證後端尚未設定，無法建立請求';return}
  if(!opts.renew&&!$('privacy-ack').checked){$('create-error').textContent='請先閱讀並確認本次個資利用告知';return}
  const minimumAge=opts.renew?opts.minimumAge:currentAge();if(!minimumAge){$('create-error').textContent='年齡門檻必須是 1 到 120 的整數';return}
  const purpose=opts.renew?opts.purpose:currentPurpose();const source=opts.renew?opts.source:state.source;
  if(!opts.renew){closeAllSockets();clearResult()}
  stopCountdown();state.busy=true;syncCreateButton();$('create-error').textContent='';
  try{
    const response=await fetch('/api/zkp/sessions',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({credentialSource:source,minimumAge:minimumAge,purpose:purpose})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'建立查驗失敗');
    state.session={id:data.id,source:data.credentialSource,minimumAge:data.minimumAge,purpose:data.purpose,cutoffDate:data.cutoffDate,expiresAt:Date.now()+data.lifetimeMs};
    state.compareSource=data.credentialSource;
    $('qr').innerHTML=data.qrSvg;
    $('presentation-statement').textContent='述詞：出生日期 ≤ '+data.cutoffDate+'（已滿 '+data.minimumAge+' 歲）· 來源：'+sourceLabel(data.credentialSource)+' · 目的：'+data.purpose;
    $('presentation').classList.remove('hidden');$('result').className='result hidden';
    openResultChannel(data.eventsUrl,data.resultKey);tickCountdown();renderCompare();
    if(!opts.auto)$('presentation').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){
    $('create-error').textContent=error instanceof Error?error.message:'建立查驗失敗';
    if(opts.renew){$('presentation').classList.add('hidden');state.session=null}
  }finally{state.busy=false;syncCreateButton()}
}

function formatRemaining(msLeft){const seconds=Math.max(0,Math.ceil(msLeft/1000));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')}
function tickCountdown(){
  stopCountdown();const session=state.session;if(!session)return;
  const remaining=session.expiresAt-Date.now();$('countdown').textContent=formatRemaining(remaining);
  if(remaining<=0){if(!state.resultReceived&&!$('presentation').classList.contains('hidden'))renew(true);return}
  state.countdownTimer=setTimeout(tickCountdown,Math.max(200,remaining%1000||1000));
}
function renew(auto){
  const session=state.session;if(!session)return;
  if(state.socket){
    // The Worker keeps the old session for one more minute, so a proof that was
    // already being built can still arrive on the old channel.
    const grace=state.socket;grace.onclose=null;state.graceSockets.push(grace);state.socket=null;
    setTimeout(()=>{const index=state.graceSockets.indexOf(grace);if(index>=0){state.graceSockets.splice(index,1);releaseResultSocket(grace);grace.close()}},60000);
  }
  createSession({renew:true,auto:auto,source:session.source,minimumAge:session.minimumAge,purpose:session.purpose});
}

function openResultChannel(url,key){
  const socket=new WebSocket(url);state.socket=socket;
  socket.onopen=()=>socket.send(JSON.stringify({type:'subscribe',resultKey:key}));
  socket.onmessage=(event)=>{
    let data;try{data=JSON.parse(event.data)}catch{return}
    if(data.status==='ready')return;
    handleResult(data);
  };
  socket.onclose=()=>{if(state.socket===socket&&!state.resultReceived&&!$('presentation').classList.contains('hidden'))renderFailure('一次性結果通道已中斷，請重新建立查驗')};
  socket.onerror=()=>{};
}
function handleResult(data){
  if(state.resultReceived)return;
  state.resultReceived=true;stopCountdown();closeAllSockets();state.session=null;renderResult(data);
}

function evidenceCard(title,detail){const card=document.createElement('div');card.className='evidence-card';card.append(text('strong',title),text('small',detail));return card}
function timingRow(table,label,value,note){const row=document.createElement('tr');row.append(text('th',label));const cell=text('td',value,'num');if(note)cell.append(text('small',note));row.append(cell);table.append(row)}
function renderResult(data){
  $('presentation').classList.add('hidden');const host=$('result');clear(host);
  const verified=data.status==='verified'&&data.accepted===true;host.className='result '+(verified?'':'failed');
  const top=document.createElement('div');top.className='result-top';top.append(text('div',verified?'✓':'×','result-icon'));
  const heading=document.createElement('div');
  heading.append(text('h2',verified?'已證明持有人至少 '+data.minimumAge+' 歲':'未通過'),text('p',verified?'皮夾以零知識證明回答了述詞；本頁沒有收到出生日期或任何卡片欄位。':(data.reason||'零知識證明未通過驗證'),'result-summary'));
  top.append(heading);host.append(top);
  const evidence=document.createElement('div');evidence.className='evidence';
  evidence.append(evidenceCard('證明來源',sourceLabel(data.credentialSource)));
  if(data.credentialSource==='government'){
    const trust=data.trust||{};
    evidence.append(evidenceCard(trust.trusted?(trust.onChain?'官方 API ＋ 鏈上紀錄':'官方 API 紀錄'):'issuer 信任未確認',trust.organization||trust.reason||(trust.trusted?'issuer 已啟用':'未取得信任證據')));
  }else evidence.append(evidenceCard('自發、非政府背書','持卡人以自然人憑證派生的每卡金鑰簽署 MyData 身分證；這不是政府機關出具的年齡證明'));
  if(data.cutoffDate)evidence.append(evidenceCard('證明的述詞',claimLabel(data.claimName)+' ≤ '+data.cutoffDate+'（'+(data.claimFormat===3?'民國日期格式':'ISO 日期格式')+'，即已滿 '+data.minimumAge+' 歲）'));
  if(data.proofBytes)evidence.append(evidenceCard('證明大小','Prepare '+kb(data.proofBytes.prepare)+'、Show '+kb(data.proofBytes.show)+(data.assetRelease?'；金鑰版本 '+data.assetRelease:'')));
  host.append(evidence);
  const timing=data.timingMs;
  if(timing){
    const table=document.createElement('table');table.className='timing-table';
    const thead=document.createElement('thead');const head=document.createElement('tr');head.append(text('th','耗時'),text('th','毫秒'));thead.append(head);table.append(thead);
    const body=document.createElement('tbody');
    timingRow(body,'皮夾建立證明 Prepare',ms(timing.holderPrepare),'手機端回報');
    timingRow(body,'皮夾建立證明 Show',ms(timing.holderShow),'手機端回報');
    timingRow(body,'傳輸（建立請求→收到回應）',ms(timing.transport),'含掃碼、同意與建證時間');
    if(data.credentialSource==='government'&&typeof data.trustMs==='number')timingRow(body,'官方 DID API 信任查詢',ms(data.trustMs));
    timingRow(body,'後端載入證明 load',ms(timing.nativeLoad),'原生後端');
    timingRow(body,'後端驗證 verify',ms(timing.verify),'原生後端');
    timingRow(body,'Worker 全程 total',ms(timing.total),'含信任查詢與後端來回');
    table.append(body);host.append(table);
  }
  host.append(text('p','結果會在 2 分鐘後自動從這個頁面清除；耗時數字已記入本分頁的比較紀錄。','result-retention'));
  const again=text('button','再建立一次相同的查驗','secondary again');again.type='button';
  again.onclick=()=>{clearResult();createSession({renew:true,source:data.credentialSource,minimumAge:data.minimumAge,purpose:currentPurpose()})};host.append(again);
  const clearNow=text('button','立即清除查驗結果','primary again');clearNow.type='button';
  clearNow.onclick=()=>{clearResult();window.scrollTo({top:$('zkp-try').offsetTop-40,behavior:'smooth'})};host.append(clearNow);
  if(verified&&timing)recordTiming({flow:'zkp',source:data.credentialSource,at:Date.now(),totalMs:timing.total,verifyMs:timing.verify,trustMs:data.trustMs,holderPrepareMs:timing.holderPrepare,holderShowMs:timing.holderShow,transportMs:timing.transport});
  state.compareSource=data.credentialSource;renderCompare();
  scheduleResultClear();host.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderFailure(reason){
  $('presentation').classList.add('hidden');stopCountdown();const host=$('result');clear(host);host.className='result failed';
  const top=document.createElement('div');top.className='result-top';top.append(text('div','×','result-icon'));
  const heading=document.createElement('div');heading.append(text('h2','驗證未通過'),text('p',reason,'result-summary'));top.append(heading);host.append(top);
  const again=text('button','重新建立查驗','primary again');again.type='button';again.onclick=()=>{clearResult();createSession()};host.append(again);
  scheduleResultClear();host.scrollIntoView({behavior:'smooth',block:'start'});
}

function readTimings(){try{const stored=JSON.parse(sessionStorage.getItem(TIMINGS_KEY)||'[]');return Array.isArray(stored)?stored:[]}catch{return []}}
function recordTiming(entry){try{const list=readTimings().concat([entry]).slice(-20);sessionStorage.setItem(TIMINGS_KEY,JSON.stringify(list))}catch{}}
function clearTimings(){try{sessionStorage.removeItem(TIMINGS_KEY)}catch{}renderCompare()}
function latestEntry(list,flow,source){for(let index=list.length-1;index>=0;index-=1){const entry=list[index];if(entry&&entry.flow===flow&&entry.source===source)return entry}return null}
function compareRow(table,label,left,right){const row=document.createElement('tr');row.append(text('th',label),text('td',left,'num'),text('td',right,'num'));table.append(row)}
function renderCompare(){
  const source=state.compareSource||state.source;$('compare-source').textContent=sourceLabel(source);
  const host=$('compare-body');clear(host);
  const list=readTimings();const sd=latestEntry(list,'sd-jwt-vc',source);const zkp=latestEntry(list,'zkp',source);
  if(!sd&&!zkp){
    host.append(text('p','這個分頁還沒有這個來源的計時紀錄。完成一次 ZKP 查驗，再到首頁用同一來源跑一次 SD-JWT-VC 出示，就能在這裡並排比較。','compare-empty'));
  }else{
    const table=document.createElement('table');table.className='timing-table compare-table';
    const thead=document.createElement('thead');const head=document.createElement('tr');head.append(text('th','項目'),text('th','SD-JWT-VC 出示'),text('th','ZKP 年齡證明'));thead.append(head);table.append(thead);
    const body=document.createElement('tbody');
    compareRow(body,'皮夾端建立證明（Prepare + Show）','不需要（選擇性揭露）',zkp?ms((zkp.holderPrepareMs||0)+(zkp.holderShowMs||0)):'—');
    compareRow(body,'傳輸（建立請求→收到回應）','未量測',zkp?ms(zkp.transportMs):'—');
    compareRow(body,'issuer 信任查詢',sd?ms(sd.trustMs):'—',zkp?ms(zkp.trustMs):'—');
    compareRow(body,'憑證／證明驗證',sd?ms(sd.credentialMs):'—',zkp?ms(zkp.verifyMs):'—');
    compareRow(body,'Worker 全程',sd?ms(sd.totalMs):'—',zkp?ms(zkp.totalMs):'—');
    compareRow(body,'紀錄時間',sd?when(sd.at)+(sd.profileId?'（'+sd.profileId+'）':''):'—',zkp?when(zkp.at):'—');
    table.append(body);host.append(table);
  }
  if(!sd){
    const hint=text('p','','compare-hint');const link=text('a','到首頁用同一來源跑一次 SD-JWT-VC 出示 →');
    link.href='/?wallet=bonds&profile='+(source==='selfIssued'?'adult-18':'identity-name')+'&source='+source;hint.append(link);host.append(hint);
  }
  if(sd&&!zkp)host.append(text('p','還沒有這個來源的 ZKP 紀錄，完成上方查驗後會自動加入。','compare-hint'));
}

$('source-government').onclick=()=>chooseSource('government');$('source-selfIssued').onclick=()=>chooseSource('selfIssued');
$('minimum-age').oninput=()=>{resetAcknowledgement();syncURL();renderStatement();renderPrivacy();syncCreateButton()};
$('purpose').oninput=()=>{$('create-error').textContent=''};
$('privacy-ack').onchange=()=>{syncCreateButton();$('create-error').textContent=''};
$('create').onclick=()=>createSession();
$('renew').onclick=()=>renew(false);
$('cancel').onclick=()=>{closeAllSockets();stopCountdown();state.session=null;$('presentation').classList.add('hidden');$('qr').replaceChildren()};
$('clear-compare').onclick=clearTimings;
window.addEventListener('pagehide',()=>{closeAllSockets();stopCountdown();if(state.resultClearTimer)clearTimeout(state.resultClearTimer)});
load().catch((error)=>{$('create-error').textContent=error instanceof Error?error.message:'載入失敗'});
`;
