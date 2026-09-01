// The verifier's front-end: pick a scenario (general verification, or an
// age-only "are you an adult?" check), show the QR / deep-link the wallet scans,
// and poll for the result. Served by the Worker at `/`. The QR library is loaded
// from a CDN (a Worker-served page has no Artifact CSP).

export const FRONTEND_HTML = /* html */ `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VP Verifier</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 -apple-system, system-ui, "Noto Sans TC", sans-serif; margin: 0; padding: 2rem 1.25rem; max-width: 34rem; margin-inline: auto; }
  h1 { font-size: 1.4rem; margin-bottom: .25rem; }
  .subtitle { color: #666; margin-top: 0; }
  .modes { display: flex; gap: .5rem; margin: 1rem 0; flex-wrap: wrap; }
  .mode { flex: 1; min-width: 12rem; text-align: left; font: inherit; padding: .7rem .9rem; border-radius: 10px; border: 1px solid #8886; background: transparent; cursor: pointer; }
  .mode small { display: block; color: #666; font-size: .82rem; margin-top: .15rem; }
  .mode[aria-pressed="true"] { border-color: #197a3d; box-shadow: inset 0 0 0 1px #197a3d; }
  #qr { display: grid; place-items: center; min-height: 260px; margin: 1.25rem 0; }
  #qr img { image-rendering: pixelated; width: 240px; height: 240px; }
  .muted { color: #666; font-size: .9rem; word-break: break-all; }
  .link { display: inline-block; margin-top: .5rem; }
  .card { border: 1px solid #8883; border-radius: 12px; padding: 1rem 1.25rem; margin-top: 1rem; }
  .ok { color: #197a3d; } .fail { color: #b3261e; }
  .verdict { font-size: 1.8rem; font-weight: 700; margin: .1rem 0 .4rem; }
  .note { color: #666; font-size: .88rem; margin-top: .6rem; line-height: 1.55; }
  table { border-collapse: collapse; width: 100%; margin-top: .5rem; }
  td { padding: .3rem .2rem; border-bottom: 1px solid #8882; vertical-align: top; }
  td:first-child { color: #666; white-space: nowrap; padding-right: 1rem; }
  button { font: inherit; padding: .5rem 1rem; border-radius: 8px; border: 1px solid #8886; background: transparent; }
</style>
</head>
<body>
  <h1>出示證件 · Verify</h1>
  <p class="subtitle">用「有備而來」掃描 QR，選擇要揭露的欄位後出示。</p>

  <div class="modes">
    <button class="mode" id="source-government" aria-pressed="true">
      政府皮夾卡片
      <small>驗證政府卡的 SD-JWT 簽章與持有人綁定</small>
    </button>
    <button class="mode" id="source-self" aria-pressed="false">
      自發 MyData 證件
      <small>驗證 did:key、自然人憑證簽章與揭露承諾</small>
    </button>
  </div>

  <div class="modes">
    <button class="mode" id="mode-general" aria-pressed="true">
      一般驗證
      <small>政府卡只要求姓名；自發證件要求姓名與出生日期</small>
    </button>
    <button class="mode" id="mode-age" aria-pressed="false">
      最少欄位年齡驗證
      <small>只要求出生日期；門號卡不含生日，需使用駕照或自發證件</small>
    </button>
  </div>

  <div id="qr">建立中…</div>
  <a id="deeplink" class="link" href="#">在本機開啟錢包</a>
  <div id="status" class="card">等待出示…</div>
  <button id="again" style="margin-top:1rem; display:none">重新產生</button>

<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
<script>
let pollTimer = null;
let mode = 'general';
let credentialSource = 'government';

function setMode(m) {
  mode = m;
  document.getElementById('mode-general').setAttribute('aria-pressed', String(m === 'general'));
  document.getElementById('mode-age').setAttribute('aria-pressed', String(m === 'age'));
  start();
}

function setSource(source) {
  credentialSource = source;
  document.getElementById('source-government').setAttribute('aria-pressed', String(source === 'government'));
  document.getElementById('source-self').setAttribute('aria-pressed', String(source === 'selfIssued'));
  start();
}

async function start() {
  clearInterval(pollTimer);
  document.getElementById('again').style.display = 'none';
  document.getElementById('status').textContent = '等待出示…';
  document.getElementById('status').className = 'card';
  const r = await fetch('/api/presentations', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ vct: null, mode, credentialSource }) });
  const { id, qr } = await r.json();
  const q = qrcode(0, 'M'); q.addData(qr); q.make();
  document.getElementById('qr').innerHTML = q.createImgTag(6, 8);
  document.getElementById('deeplink').href = qr;
  pollTimer = setInterval(async () => {
    const s = await (await fetch('/api/result/' + id)).json();
    if (s.status === 'pending') return;
    clearInterval(pollTimer);
    render(s);
  }, 1500);
}

function render(s) {
  const el = document.getElementById('status');
  document.getElementById('again').style.display = 'inline-block';

  if (s.status === 'verified' && s.mode === 'age') {
    const age = s.adultAge || 18;
    const adult = s.adult === true;
    el.className = 'card ' + (adult ? 'ok' : 'fail');
    el.innerHTML =
      '<div class="verdict ' + (adult ? 'ok' : 'fail') + '">' + (adult ? '✓ 已滿 ' + age + ' 歲' : '✗ 未滿 ' + age + ' 歲') + '</div>' +
      '<div class="note">查驗方只要求了「出生日期」這一個欄位——<strong>沒有姓名、身分證字號、地址</strong>，' +
      '再由本頁換算成年與否。查驗器仍看得到生日；這是選擇性揭露，不是零知識證明。</div>';
    return;
  }

  if (s.status === 'verified') {
    let rows = '';
    for (const [k, v] of Object.entries(s.claims || {})) {
      if (typeof v === 'object') continue;
      rows += '<tr><td>' + escapeHtml(k) + '</td><td>' + escapeHtml(String(v)) + '</td></tr>';
    }
    el.className = 'card ok';
    el.innerHTML = '<strong>✓ 驗證通過</strong>' + (s.vct ? ' · ' + escapeHtml(s.vct) : '') + '<table>' + rows + '</table>';
    return;
  }

  el.className = 'card fail';
  el.innerHTML = '<strong>✗ 驗證未通過</strong><div class="muted">' + escapeHtml(s.reason || s.status) + '</div>';
}

function escapeHtml(x){return x.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
document.getElementById('again').onclick = start;
document.getElementById('mode-general').onclick = () => setMode('general');
document.getElementById('mode-age').onclick = () => setMode('age');
document.getElementById('source-government').onclick = () => setSource('government');
document.getElementById('source-self').onclick = () => setSource('selfIssued');
start();
</script>
</body>
</html>`;
