/* ---------- Sauvegarder / restaurer mes réglages (fonds et couches perso, fond actif, thème, langue, clé OpenRoute…) ---------- */
const PREF_SKIP = ['rbgen.v1', 'rbgen.dirty', 'rbgen.report'];      // projet en cours et rapport : pas des réglages
function prefKeys() { const k = []; try { for (let i = 0; i < localStorage.length; i++) { const n = localStorage.key(i); if ((n.indexOf('rbgen.') === 0 || n === 'rbLang') && PREF_SKIP.indexOf(n) < 0) k.push(n); } } catch (_) {} return k; }
function prefsExport() {
  const data = {}; prefKeys().forEach(n => { try { data[n] = localStorage.getItem(n); } catch (_) {} });
  const d = new Date(), p = x => String(x).padStart(2, '0');
  download('reglages-roadbook-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.json', JSON.stringify({ app: 'rbgen-prefs', v: 1, data }), 'application/json');
  toast(gpsOffT('Réglages enregistrés (' + Object.keys(data).length + ' éléments).', 'Settings saved (' + Object.keys(data).length + ' items).'), 'ok');
}
function prefsImport(file) {
  const r = new FileReader();
  r.onload = () => {
    let o = null; try { o = JSON.parse(r.result); } catch (_) {}
    if (!o || o.app !== 'rbgen-prefs' || !o.data || typeof o.data !== 'object') return toast('Ce fichier n’est pas un fichier de réglages du générateur.', 'err');
    let n = 0;
    for (const k of Object.keys(o.data)) { if ((k.indexOf('rbgen.') !== 0 && k !== 'rbLang') || PREF_SKIP.indexOf(k) >= 0 || typeof o.data[k] !== 'string') continue; try { localStorage.setItem(k, o.data[k]); n++; } catch (_) {} }
    toast(gpsOffT(n + ' éléments restaurés. Rechargement…', n + ' items restored. Reloading…'), 'ok'); setTimeout(() => location.reload(), 900);
  };
  r.readAsText(file);
}
function prefsDialog() {
  const m = openModal('Mes réglages', `<p>Enregistre dans un petit fichier tes fonds de carte et couches personnels, le fond et la couche affichés, leurs niveaux, le thème, la langue, les rayons et ta clé OpenRoute éventuelle. Utile pour changer de navigateur ou d’appareil, ou si le navigateur vide ses données.</p>
    <p class="help">Le projet en cours (trace, notes) n’en fait pas partie : il a son propre bouton « Enregistrer le projet ». Le fichier contient ta clé OpenRoute si tu en as une : ne le partage pas.</p>
    <input type="file" id="prefFile" accept=".json,application/json" style="display:none">${asBlockHtml()}`,
    [{ label: 'Fermer' }, 'sp',
     { label: '📥 Restaurer depuis un fichier', keep: true, onClick: () => document.getElementById('prefFile').click() },
     { label: '💾 Enregistrer mes réglages', cls: 'primary', onClick: () => prefsExport() }]);
  asBind(m);
  m.querySelector('#prefFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) prefsImport(f); });
}
