/* ---------- Message « Nouvelle version disponible » : compare la version de cette page avec version.json publié à côté d'elle ---------- */
const NV = { last: 0 };
async function nvCheck(force) {
  if (!/^https?:$/.test(location.protocol) || navigator.onLine === false) return;
  if (!force && Date.now() - NV.last < 30 * 60 * 1000) return;
  NV.last = Date.now();
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const j = await r.json(), cur = ((document.querySelector('.vtag') || {}).textContent || '').trim(), ok = v => /^v0\.\d{6}\.\d{4}$/.test(v || '');
    if (ok(j.v) && ok(cur) && j.v > cur) nvShow(j.v);      // AAMMJJ.HHMM : l'ordre des textes est l'ordre des dates
  } catch (_) {}
}
function nvShow(v) {
  try { if (sessionStorage.getItem('rbgen.nvX') === v) return; } catch (_) {}
  if (document.getElementById('nv')) return;
  const d = document.createElement('div'); d.id = 'nv';
  d.innerHTML = '<span>🔄 ' + gpsOffT('Nouvelle version disponible', 'New version available') + ' (' + v + ')</span><button class="btn primary" id="nvGo">' + gpsOffT('Recharger', 'Reload') + '</button><button class="btn" id="nvX" title="' + gpsOffT('Plus tard', 'Later') + '">✕</button>';
  document.body.appendChild(d);
  d.querySelector('#nvX').onclick = () => { try { sessionStorage.setItem('rbgen.nvX', v); } catch (_) {} d.remove(); };
  d.querySelector('#nvGo').onclick = async () => {
    d.querySelector('#nvGo').disabled = true;
    try { clearTimeout(saveTimer); if (S.ll.length || S.notes.length) doSave(); } catch (_) {}      // le projet en cours est gardé avant de recharger
    try { await fetch(location.href, { cache: 'reload' }); } catch (_) {}
    try { for (const k of await caches.keys()) await caches.delete(k); const rg = await navigator.serviceWorker.getRegistration(); if (rg) await rg.update(); } catch (_) {}
    location.reload();
  };
}
setTimeout(() => nvCheck(true), 3000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) nvCheck(); });
setInterval(nvCheck, 30 * 60 * 1000);
