/* ---------- Sauvegarde automatique des réglages dans un dossier choisi (Chrome / Edge sur ordinateur : API d'accès aux fichiers) ---------- */
const AS = { h: null, t: 0, state: '', last: 0 }, AS_FILE = 'reglages-roadbook.json';
const asOK = () => typeof window.showDirectoryPicker === 'function';
function asDB() { return new Promise(res => { try { const r = indexedDB.open('rbgen-fs', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (_) { res(null); } }); }
async function asLoad() { const db = await asDB(); if (!db) return null; return new Promise(res => { try { const q = db.transaction('h').objectStore('h').get('dir'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (_) { res(null); } }); }
async function asStore(h) { const db = await asDB(); if (!db) return; await new Promise(res => { try { const tx = db.transaction('h', 'readwrite'); if (h) tx.objectStore('h').put(h, 'dir'); else tx.objectStore('h').delete('dir'); tx.oncomplete = tx.onerror = tx.onabort = () => res(); } catch (_) { res(); } }); }
function asPayload() { const data = {}; prefKeys().forEach(n => { try { data[n] = localStorage.getItem(n); } catch (_) {} }); return JSON.stringify({ app: 'rbgen-prefs', v: 1, data }, null, 1); }
async function asWrite() {
  if (!AS.h) return false;
  try {
    if ((await AS.h.queryPermission({ mode: 'readwrite' })) !== 'granted') { AS.state = 'pause'; return false; }
    const f = await AS.h.getFileHandle(AS_FILE, { create: true }), w = await f.createWritable();
    await w.write(asPayload()); await w.close(); AS.state = 'ok'; AS.last = Date.now(); return true;
  } catch (e) { AS.state = 'err'; console.warn('Sauvegarde auto des réglages', e); return false; }
}
function asSchedule() { if (!AS.h) return; clearTimeout(AS.t); AS.t = setTimeout(asWrite, 1500); }
async function asRead(h) {      // fichier de réglages du dossier, ou null
  try { const o = JSON.parse(await (await (await h.getFileHandle(AS_FILE)).getFile()).text()); return o && o.app === 'rbgen-prefs' && o.data && typeof o.data === 'object' && Object.keys(o.data).length ? o : null; } catch (_) { return null; }
}
function asApply(o) {
  let n = 0; for (const k of Object.keys(o.data)) { if ((k.indexOf('rbgen.') !== 0 && k !== 'rbLang') || PREF_SKIP.indexOf(k) >= 0 || typeof o.data[k] !== 'string') continue; try { localStorage.setItem(k, o.data[k]); n++; } catch (_) {} }
  toast(gpsOffT(n + ' éléments restaurés depuis le dossier. Rechargement…', n + ' items restored from the folder. Reloading…'), 'ok'); setTimeout(() => location.reload(), 900);
}
try {      // chaque réglage modifié déclenche l'écriture (après 1,5 s de calme)
  const si = Storage.prototype.setItem, ri = Storage.prototype.removeItem, mine = (s, k) => s === localStorage && /^(rbgen\.|rbLang$)/.test(k) && PREF_SKIP.indexOf(k) < 0;
  Storage.prototype.setItem = function (k, v) { si.call(this, k, v); if (mine(this, k)) asSchedule(); };
  Storage.prototype.removeItem = function (k) { ri.call(this, k); if (mine(this, k)) asSchedule(); };
} catch (_) {}
async function asChoose(after) {
  let h; try { h = await window.showDirectoryPicker({ id: 'rbgen-reglages', mode: 'readwrite' }); } catch (_) { return; }
  const o = await asRead(h); AS.h = h; await asStore(h);
  if (!o) { await asWrite(); toast(gpsOffT('Sauvegarde automatique activée dans « ' + h.name + ' ».', 'Automatic backup enabled in “' + h.name + '”.'), 'ok'); return after && after(); }
  const m = openModal(gpsOffT('Réglages déjà présents dans ce dossier', 'Settings already in this folder'), '<p>' + gpsOffT('Ce dossier contient déjà un fichier de réglages (' + Object.keys(o.data).length + ' éléments). Lesquels veux-tu garder ?', 'This folder already holds a settings file (' + Object.keys(o.data).length + ' items). Which ones do you want to keep?') + '</p>',
    [{ label: gpsOffT('Ceux de ce navigateur', 'This browser’s'), onClick: async () => { await asWrite(); toast(gpsOffT('Sauvegarde automatique activée.', 'Automatic backup enabled.'), 'ok'); after && after(); } }, 'sp',
     { label: gpsOffT('Ceux du dossier', 'The folder’s'), cls: 'primary', onClick: () => asApply(o) }]);
}
async function asStop() { clearTimeout(AS.t); AS.h = null; AS.state = ''; await asStore(null); }
function asBlockHtml() {
  if (!asOK()) return '<p class="help">' + gpsOffT('Sauvegarde automatique dans un dossier : disponible seulement sur Chrome ou Edge sur ordinateur.', 'Automatic backup to a folder: only available on Chrome or Edge on a computer.') + '</p>';
  const st = !AS.h ? gpsOffT('Désactivée.', 'Off.') : AS.state === 'ok' ? gpsOffT('Active : dossier « ' + AS.h.name + ' », fichier ' + AS_FILE + '.', 'On: folder “' + AS.h.name + '”, file ' + AS_FILE + '.') : AS.state === 'pause' ? gpsOffT('En pause : le navigateur attend ton accord au prochain clic (dossier « ' + AS.h.name + ' »).', 'Paused: the browser waits for your OK on the next click (folder “' + AS.h.name + '”).') : gpsOffT('Dossier « ' + AS.h.name + ' » choisi.', 'Folder “' + AS.h.name + '” chosen.');
  return '<hr><p><b>' + gpsOffT('Sauvegarde automatique dans un dossier', 'Automatic backup to a folder') + '</b></p><p class="help" id="asSt">' + st + '</p><p><button class="btn" id="asPick">📁 ' + gpsOffT('Choisir le dossier', 'Choose the folder') + '</button> ' + (AS.h ? '<button class="btn" id="asStop">⏹ ' + gpsOffT('Arrêter', 'Stop') + '</button>' : '') + '</p>';
}
function asBind(m) {
  const p = m.querySelector('#asPick'), s = m.querySelector('#asStop');
  if (p) p.onclick = () => { closeModal(); asChoose(() => {}); };
  if (s) s.onclick = async () => { await asStop(); toast(gpsOffT('Sauvegarde automatique arrêtée.', 'Automatic backup stopped.'), 'ok'); closeModal(); };
}
(async () => {      // au démarrage : on retrouve le dossier ; navigateur neuf (aucun réglage) : on reprend ceux du dossier au lieu de les écraser
  if (!asOK()) return;
  AS.h = await asLoad(); if (!AS.h) return;
  let perm = 'prompt'; try { perm = await AS.h.queryPermission({ mode: 'readwrite' }); } catch (_) {}
  const go = async () => { if (!prefKeys().length) { const o = await asRead(AS.h); if (o) return asApply(o); } asWrite(); };
  if (perm === 'granted') go();
  else { AS.state = 'pause'; document.addEventListener('pointerdown', async () => { try { if (await AS.h.requestPermission({ mode: 'readwrite' }) === 'granted') go(); } catch (_) {} }, { once: true }); }
})();
