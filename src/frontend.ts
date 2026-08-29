// The verifier's front-end: creates a presentation session, shows the QR /
// deep-link the wallet scans, and polls for the result. Served by the Worker at
// `/`. The QR library is loaded from a CDN (a Worker-served page has no Artifact
// CSP); swap for an inlined generator if you want zero external requests.

export const FRONTEND_HTML = /* html */ `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VP Verifier</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 -apple-system, system-ui, "Noto Sans TC", sans-serif; margin: 0; padding: 2rem 1.25rem; max-width: 34rem; margin-inline: auto; }
  h1 { font-size: 1.4rem; }
  #qr { display: grid; place-items: center; min-height: 260px; margin: 1.5rem 0; }
  #qr img { image-rendering: pixelated; width: 240px; height: 240px; }
  .muted { color: #666; font-size: .9rem; word-break: break-all; }
  .link { display: inline-block; margin-top: .5rem; }
  .card { border: 1px solid #8883; border-radius: 12px; padding: 1rem 1.25rem; margin-top: 1rem; }
  .ok { color: #197a3d; } .fail { color: #b3261e; }
  table { border-collapse: collapse; width: 100%; margin-top: .5rem; }
  td { padding: .3rem .2rem; border-bottom: 1px solid #8882; vertical-align: top; }
  td:first-child { color: #666; white-space: nowrap; padding-right: 1rem; }
  button { font: inherit; padding: .5rem 1rem; border-radius: 8px; border: 1px solid #8886; background: transparent; }
</style>
</head>
<body>
  <h1>出示證件 · Verify</h1>
  <p class="muted">用「有備而來」掃描下方 QR,選擇要揭露的欄位後出示。跨裝置掃 QR;同一支手機可直接點連結。</p>
  <div id="qr">建立中…</div>
  <a id="deeplink" class="link" href="#">在本機開啟錢包</a>
  <div id="status" class="card">等待出示…</div>
  <button id="again" style="margin-top:1rem; display:none">重新產生</button>

<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
<script>
let pollTimer = null;
async function start() {
  clearInterval(pollTimer);
  document.getElementById('again').style.display = 'none';
  document.getElementById('status').textContent = '等待出示…';
  document.getElementById('status').className = 'card';
  const r = await fetch('/api/presentations', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ vct: null }) });
  const { id, qr } = await r.json();
  // QR
  const q = qrcode(0, 'M'); q.addData(qr); q.make();
  document.getElementById('qr').innerHTML = q.createImgTag(6, 8);
  document.getElementById('deeplink').href = qr;
  // poll
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
  if (s.status === 'verified') {
    let rows = '';
    for (const [k, v] of Object.entries(s.claims || {})) {
      if (typeof v === 'object') continue;
      rows += '<tr><td>' + escapeHtml(k) + '</td><td>' + escapeHtml(String(v)) + '</td></tr>';
    }
    el.className = 'card ok';
    el.innerHTML = '<strong>✓ 驗證通過</strong>' + (s.vct ? ' · ' + escapeHtml(s.vct) : '') + '<table>' + rows + '</table>';
  } else {
    el.className = 'card fail';
    el.innerHTML = '<strong>✗ 驗證未通過</strong><div class="muted">' + escapeHtml(s.reason || s.status) + '</div>';
  }
}
function escapeHtml(x){return x.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
document.getElementById('again').onclick = start;
start();
</script>
</body>
</html>`;
