export const FRONTEND_HTML = /* html */ `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="一鍵部署的台灣數位憑證 OIDC4VP 查驗器">
  <title>自由查驗｜OIDC4VP</title>
  <link rel="stylesheet" href="/app.css">
  <script src="/app.js" defer></script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="自由查驗首頁">
      <span class="brand-mark" aria-hidden="true">✓</span>
      <span>自由查驗</span>
    </a>
    <a class="github-link" href="https://github.com/mashbean/mashbean-vp-verifier">GitHub</a>
  </header>

  <main>
    <section class="hero">
      <p class="eyebrow">OIDC4VP VERIFIER FOR TAIWAN</p>
      <h1>先決定要確認什麼，<br>再請對方出示最少資料。</h1>
      <p class="lede">支援數位發展部「數位憑證皮夾」與「有備而來」。查驗要求、實際揭露欄位與判斷限制都會在掃碼前列出。</p>
    </section>

    <section class="builder" aria-labelledby="builder-title">
      <div class="section-heading">
        <span class="step">1</span>
        <div><h2 id="builder-title">選擇驗證目的</h2><p>使用情境決定資料需求，不從欄位清單倒推用途。</p></div>
      </div>
      <div id="profiles" class="profile-grid" aria-live="polite"></div>

      <div class="section-heading source-heading">
        <span class="step">2</span>
        <div><h2>選擇可接受的卡片來源</h2><p>同一個欄位由不同卡片簽署，代表的信任關係並不相同。</p></div>
      </div>
      <div id="sources" class="source-grid"></div>

      <aside id="disclosure" class="disclosure" aria-live="polite"></aside>
      <button id="create" class="primary" type="button">建立一次性查驗 QR Code</button>
      <p id="create-error" class="error" role="alert"></p>
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

    <section class="implementation" aria-labelledby="implementation-title">
      <p class="eyebrow">FOR DEVELOPERS</p>
      <h2 id="implementation-title">部署後就有情境 API 與完整查驗流程</h2>
      <p>公開設定由 <code>GET /api/profiles</code> 取得，建立查驗使用 <code>POST /api/presentations</code>。Verifier 的 P-256 <code>did:key</code> 在 Cloudflare Durable Object 內第一次啟動時產生。</p>
      <details>
        <summary>標準與台灣相容層</summary>
        <p>OIDC4VP 1.0 Final 使用 DCQL。台灣現行皮夾仍以 Presentation Exchange 為主要請求格式，因此這個版本同時送出兩者，並將其標示為 TWDIW 相容模式。簽章、nonce、audience、holder binding、選擇性揭露與憑證狀態仍逐項驗證。</p>
      </details>
    </section>
  </main>

  <footer>開源研究工具，與數位發展部及各發卡機關無隸屬關係。</footer>
</body>
</html>`;

export const FRONTEND_CSS = /* css */ `
:root{color-scheme:light;--ink:#14231d;--muted:#5f6f67;--paper:#f5f6f1;--card:#fff;--line:#dce3dd;--green:#096b4b;--green-2:#d9f3e7;--blue:#335eea;--red:#a82828;--shadow:0 22px 60px rgba(18,45,34,.1)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif}button,a{font:inherit}button{color:inherit}.site-header{height:72px;display:flex;align-items:center;justify-content:space-between;max-width:1120px;margin:auto;padding:0 24px}.brand{display:flex;align-items:center;gap:10px;color:var(--ink);font-weight:800;text-decoration:none}.brand-mark{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:var(--ink);color:white}.github-link{color:var(--muted);text-underline-offset:4px}main{max-width:1120px;margin:auto;padding:64px 24px 110px}.hero{max-width:820px;margin-bottom:56px}.eyebrow{margin:0 0 12px;color:var(--green);font-size:.78rem;font-weight:800;letter-spacing:.14em}.hero h1{margin:0;font-size:clamp(2.55rem,7vw,5.8rem);line-height:1.04;letter-spacing:-.055em}.lede{max-width:700px;margin:28px 0 0;color:var(--muted);font-size:1.14rem}.builder,.presentation,.result,.implementation{background:var(--card);border:1px solid var(--line);border-radius:28px;padding:clamp(24px,5vw,52px);box-shadow:var(--shadow)}.section-heading{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px}.section-heading h2{margin:-5px 0 2px;font-size:1.55rem;line-height:1.35}.section-heading p{margin:0;color:var(--muted)}.section-heading.compact{margin-bottom:12px}.step{display:grid;place-items:center;flex:0 0 34px;height:34px;border-radius:50%;background:var(--green-2);color:var(--green);font-weight:800}.profile-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.profile,.source{appearance:none;border:1px solid var(--line);border-radius:16px;background:white;padding:18px;text-align:left;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s}.profile:hover,.source:hover{transform:translateY(-2px);border-color:#a7b8ad}.profile[aria-pressed=true],.source[aria-pressed=true]{border-color:var(--green);box-shadow:inset 0 0 0 1px var(--green);background:#fbfffd}.profile strong,.source strong{display:block;font-size:1.03rem}.profile small,.source small{display:block;margin-top:5px;color:var(--muted);line-height:1.45}.source-heading{margin-top:42px}.source-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.disclosure{margin:28px 0 22px;padding:20px 22px;border-radius:18px;background:#f0f4f1}.disclosure h3{margin:0 0 8px;font-size:1rem}.claim-list{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.claim{padding:5px 10px;border-radius:999px;background:white;border:1px solid var(--line);font-size:.88rem}.disclosure p{margin:8px 0 0;color:var(--muted);font-size:.92rem}.primary,.secondary{display:flex;width:100%;min-height:54px;align-items:center;justify-content:center;border-radius:14px;font-weight:750;text-decoration:none}.primary{border:0;background:var(--ink);color:#fff;cursor:pointer}.primary:hover{background:#213e32}.primary:disabled{opacity:.55;cursor:wait}.secondary{border:1px solid var(--ink);color:var(--ink);background:white}.error{color:var(--red);min-height:1.5em;margin:8px 0 0}.presentation,.result,.implementation{margin-top:24px}.presentation{max-width:650px;margin-inline:auto;text-align:center}.presentation .section-heading{text-align:left}.qr-shell{max-width:430px;margin:22px auto;padding:20px;background:#fff;border:1px solid var(--line);border-radius:22px}.qr svg{display:block;width:100%;height:auto}.waiting{display:flex;align-items:center;justify-content:center;gap:9px;color:var(--muted)}.waiting span{width:9px;height:9px;background:var(--green);border-radius:50%;animation:pulse 1.3s infinite}.text-button{border:0;background:transparent;color:var(--muted);text-decoration:underline;cursor:pointer}.result{max-width:760px;margin-inline:auto}.result-top{display:flex;align-items:center;gap:14px}.result-icon{display:grid;place-items:center;width:54px;height:54px;border-radius:18px;background:var(--green-2);color:var(--green);font-size:1.7rem;font-weight:900}.result.not-established .result-icon{background:#fff0d6;color:#8b5700}.result.failed .result-icon{background:#fae2e2;color:var(--red)}.result h2{margin:0;font-size:1.65rem}.result-summary{margin:4px 0 0;color:var(--muted)}.evidence{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:24px 0}.evidence-card{padding:15px;border:1px solid var(--line);border-radius:15px}.evidence-card strong{display:block}.evidence-card small{color:var(--muted)}.claims{width:100%;border-collapse:collapse;margin-top:18px}.claims th,.claims td{text-align:left;padding:12px 4px;border-bottom:1px solid var(--line);vertical-align:top}.claims th{color:var(--muted);font-weight:500;width:42%}.policy{margin-top:20px;padding:15px 17px;border-left:4px solid var(--green);background:#f0f4f1;color:var(--muted)}.again{margin-top:20px}.implementation{margin-top:70px;background:var(--ink);color:white}.implementation .eyebrow{color:#7be2b8}.implementation h2{max-width:720px;font-size:clamp(1.8rem,4vw,3rem);line-height:1.2}.implementation>p:not(.eyebrow),.implementation details{color:#c6d2cc}.implementation code{color:#b4f0d7}.implementation summary{cursor:pointer;color:white;font-weight:700}footer{max-width:1120px;margin:auto;padding:0 24px 50px;color:var(--muted);font-size:.9rem}.hidden{display:none!important}@keyframes pulse{50%{opacity:.25;transform:scale(.7)}}
@media(max-width:760px){main{padding-top:34px}.profile-grid{grid-template-columns:1fr 1fr}.source-grid{grid-template-columns:1fr}.builder,.presentation,.result,.implementation{border-radius:20px}.evidence{grid-template-columns:1fr}}
@media(max-width:480px){.profile-grid{grid-template-columns:1fr}.hero h1{font-size:2.65rem}.site-header{height:62px}.github-link{font-size:.9rem}.builder{padding:22px 18px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--ink:#edf6f1;--muted:#aebbb4;--paper:#0e1512;--card:#151f1a;--line:#304039;--green:#75ddb2;--green-2:#183c2d;--shadow:none}.brand-mark,.primary{background:#edf6f1;color:#132019}.profile,.source,.secondary{background:#151f1a}.profile[aria-pressed=true],.source[aria-pressed=true]{background:#192a22}.disclosure,.policy{background:#1b2a23}.claim{background:#25362e}.qr-shell{background:white}.implementation{background:#0a0f0d}}
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
  state.profile=state.profiles.find((item)=>item.id===params.get('profile'))||state.profiles[0];
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
load().catch((error)=>{$('create-error').textContent=error instanceof Error?error.message:'載入失敗'});
`;
