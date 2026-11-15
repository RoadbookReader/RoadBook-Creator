/* ---------- Heatmap « traces GPS OSM hors route » ----------
   Points publics de l'API OSM (trackpoints) → filtre vitesse (entre points d'un même segment, grâce à l'heure) → on retire ceux qui sont près
   d'une route goudronnée (Overpass, index en cases de 50 m) → Leaflet.heat. Calculé à la demande pour la zone visible (max 0,25 deg²). */
const GPSOFF_ROAD = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$/;
const GPSOFF_UNPAVED = /^(unpaved|gravel|fine_gravel|dirt|ground|earth|grass|sand|mud|compacted|pebblestone)$/;
let gpsOffOpt = { vmin: 3, vmax: 50, hr: true, dist: 25, width: 3 };
try { Object.assign(gpsOffOpt, JSON.parse(localStorage.getItem('rbgen.gpsOff') || '{}')); } catch (_) {}
const gpsOffT = (fr, en) => (I18N.lang === 'en' ? en : fr);
const gpsOffLayer = L.layerGroup();
let gpsOffRun = 0, gpsOffHeat = null;
/* Mémoire : tout ce qui a été calculé est gardé (IndexedDB) et se complète à chaque chargement. Un nouveau chargement remplace les points déjà gardés dans sa zone
   (pas de doublons, la densité = nombre de traces reste juste). Format : pts = [lat, lon, lat, lon…], zones = [[w, s, e, n]…]. */
let gpsOffMem = { zones: [], pts: [] }, gpsOffTimer = 0;
const gpsOffDB = (() => {
  let dbp = null; const open = () => dbp || (dbp = new Promise(res => { try { const r = indexedDB.open('rbgen-heat', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = r.onblocked = () => res(null); } catch (e) { res(null); } }));
  const run = (mode, fn) => open().then(db => new Promise(res => { if (!db) return res(null); try { const tx = db.transaction('h', mode); let out = null; const rq = fn(tx.objectStore('h')); if (rq) rq.onsuccess = () => { out = rq.result; }; tx.oncomplete = () => res(out === null ? true : out); tx.onerror = tx.onabort = () => res(null); } catch (e) { res(null); } }));
  return { put: v => run('readwrite', st => st.put(v, 'mem')), get: () => run('readonly', st => st.get('mem')), del: () => run('readwrite', st => st.delete('mem')) };
})();
const gpsOffIn = (z, la, lo) => lo >= z[0] && lo <= z[2] && la >= z[1] && la <= z[3];
function gpsOffMerge(zones, flat) {          // remplace les points gardés dans ces zones par `flat`
  const keep = [], old = gpsOffMem.pts;
  for (let i = 0; i < old.length; i += 2) if (!zones.some(z => gpsOffIn(z, old[i], old[i + 1]))) keep.push(old[i], old[i + 1]);
  for (let i = 0; i < flat.length; i++) keep.push(flat[i]);
  gpsOffMem = { zones: gpsOffMem.zones.concat(zones).slice(-500), pts: keep };
  gpsOffRefresh(); clearTimeout(gpsOffTimer); gpsOffTimer = setTimeout(() => gpsOffDB.put(gpsOffMem), 500);
}
function gpsOffRefresh() {
  const ll = []; for (let i = 0; i < gpsOffMem.pts.length; i += 2) ll.push([gpsOffMem.pts[i], gpsOffMem.pts[i + 1], 0.5]);
  if (!gpsOffHeat) { gpsOffHeat = L.heatLayer(ll, { radius: 8, blur: 12, minOpacity: 0.3 }); gpsOffLayer.addLayer(gpsOffHeat); } else gpsOffHeat.setLatLngs(ll);
  gpsOffLayer.setOpacity(gpsOffLayer._op == null ? 1 : gpsOffLayer._op);
  const c = $('#goCount'); if (c) c.textContent = gpsOffT(`En mémoire : ${ll.length} points`, `In memory: ${ll.length} points`);
}
gpsOffDB.get().then(v => { if (v && Array.isArray(v.pts)) { gpsOffMem = { zones: v.zones || [], pts: v.pts }; } gpsOffRefresh(); });
gpsOffLayer.setOpacity = o => { gpsOffLayer._op = o; const c = gpsOffHeat && gpsOffHeat._canvas; if (c) c.style.opacity = o; };
function gpsOffDist(a, b) {        // mètres entre deux points [lat, lon]
  const R = 6371000, rad = Math.PI / 180, dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
async function gpsOffPoints(w, s, e, n, cancelled, progress) {      // [lat, lon, km/h ou null]
  const pts = []; let capped = false;
  for (let page = 0; page < 10; page++) {
    if (cancelled()) throw new Error('annulé');
    const r = await fetch(`https://api.openstreetmap.org/api/0.6/trackpoints?bbox=${w},${s},${e},${n}&page=${page}`);
    if (!r.ok) throw new Error(gpsOffT('API OSM : erreur ', 'OSM API: error ') + r.status);
    const xml = new DOMParser().parseFromString(await r.text(), 'application/xml');
    let count = 0;
    for (const seg of xml.getElementsByTagName('trkseg')) {
      let prev = null;
      for (const p of seg.getElementsByTagName('trkpt')) {
        count++;
        const lat = +p.getAttribute('lat'), lon = +p.getAttribute('lon'), t = p.getElementsByTagName('time')[0], time = t ? Date.parse(t.textContent) : NaN;
        let v = null;
        if (prev && isFinite(time) && isFinite(prev.time) && time > prev.time) v = gpsOffDist([prev.lat, prev.lon], [lat, lon]) / ((time - prev.time) / 1000) * 3.6;
        pts.push([lat, lon, v]); prev = { lat, lon, time };
      }
    }
    progress(pts.length);
    if (count < 5000) break;
    if (page === 9) capped = true;
  }
  pts.capped = capped;
  return pts;
}
async function gpsOffRoads(w, s, e, n, cancelled) {         // routes goudronnées de la zone (polylignes [lat, lon])
  const q = `[out:json][timeout:60];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$"](${s},${w},${n},${e});out geom;`;
  const j = await overpass(q, cancelled, 0, await liveServers());
  return (j.elements || []).filter(el => el.geometry && GPSOFF_ROAD.test((el.tags || {}).highway || '') && !GPSOFF_UNPAVED.test((el.tags || {}).surface || '')).map(el => el.geometry.map(g => [g.lat, g.lon]));
}
function gpsOffIndex(roads, lat0) {          // renvoie nearRoad(lat, lon, maxD) : vrai si une route est à moins de maxD mètres
  const kLat = 111320, kLon = 111320 * Math.cos(lat0 * Math.PI / 180), cell = 50, grid = new Map();
  const xy = p => [p[1] * kLon, p[0] * kLat];
  for (const way of roads) for (let i = 0; i < way.length - 1; i++) {
    const a = xy(way[i]), b = xy(way[i + 1]);
    const x0 = Math.floor(Math.min(a[0], b[0]) / cell), x1 = Math.floor(Math.max(a[0], b[0]) / cell), y0 = Math.floor(Math.min(a[1], b[1]) / cell), y1 = Math.floor(Math.max(a[1], b[1]) / cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x + ',' + y; if (!grid.has(k)) grid.set(k, []); grid.get(k).push([a, b]); }
  }
  return (lat, lon, maxD) => {
    const p = [lon * kLon, lat * kLat], cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), r = Math.ceil(maxD / cell);
    for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) {
      const segs = grid.get(x + ',' + y); if (!segs) continue;
      for (const [a, b] of segs) {
        const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
        let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0; t = Math.max(0, Math.min(1, t));
        if (Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)) <= maxD) return true;
      }
    }
    return false;
  };
}
async function gpsOffProcess(w, s, e, n, cancelled, progress) {      // points hors route d'une zone : {pts, total, afterSpeed, capped}
  let pts = await gpsOffPoints(w, s, e, n, cancelled, progress);
  const total = pts.length, capped = pts.capped;
  pts = pts.filter(p => p[2] === null || (p[2] >= gpsOffOpt.vmin && p[2] <= gpsOffOpt.vmax));
  const afterSpeed = pts.length;
  if (gpsOffOpt.hr && pts.length) {
    const mg = 0.002;      // marge : une route juste hors de la zone compte aussi
    const near = gpsOffIndex(await gpsOffRoads(w - mg, s - mg, e + mg, n + mg, cancelled), (s + n) / 2);
    pts = pts.filter(p => !near(p[0], p[1], gpsOffOpt.dist));
  }
  return { pts, total, afterSpeed, capped };
}
function gpsOffReadOpt() {
  const num = (id, d, lo, hi) => { const v = parseFloat($(id).value); return clamp(isFinite(v) ? v : d, lo, hi); };
  gpsOffOpt = { vmin: num('#goVmin', 3, 0, 200), vmax: num('#goVmax', 50, 1, 300), hr: $('#goHr').checked, dist: num('#goDist', 25, 5, 200), width: num('#goWidth', 3, 1, 10) };
  if (gpsOffOpt.vmax < gpsOffOpt.vmin) gpsOffOpt.vmax = gpsOffOpt.vmin;
  try { localStorage.setItem('rbgen.gpsOff', JSON.stringify(gpsOffOpt)); } catch (_) {}
}
const gpsOffFlat = pts => pts.flatMap(p => [+p[0].toFixed(5), +p[1].toFixed(5)]);
async function gpsOffLoad() {      // zone visible
  const msg = $('#goMsg'), run = ++gpsOffRun, cancelled = () => run !== gpsOffRun || curHeat !== 'gpsoff';
  gpsOffReadOpt();
  const b = map.getBounds(), w = b.getWest(), s = b.getSouth(), e = b.getEast(), n = b.getNorth();
  if ((e - w) * (n - s) > 0.25) { msg.textContent = gpsOffT('Zone trop grande : zoome davantage (maxi 0,25 deg², zoom 12 ou plus).', 'Area too large: zoom in (max 0.25 deg², zoom 12 or more).'); return; }
  $('#goLoad').disabled = $('#goTrace').disabled = true;
  try {
    msg.textContent = gpsOffT('Chargement des traces…', 'Loading tracks…');
    const r = await gpsOffProcess(w, s, e, n, cancelled, c => { msg.textContent = c + gpsOffT(' points…', ' points…'); });
    if (cancelled()) return;
    gpsOffMerge([[w, s, e, n]], gpsOffFlat(r.pts));
    msg.textContent = gpsOffT(`${r.pts.length} points gardés dans cette zone (sur ${r.total} ; ${r.afterSpeed} après le filtre vitesse).`, `${r.pts.length} points kept in this area (out of ${r.total}; ${r.afterSpeed} after the speed filter).`) + (r.capped ? gpsOffT(' Limite de 50 000 points atteinte : zoome pour tout voir.', ' 50,000-point limit reached: zoom in to see everything.') : '');
  } catch (err) {
    if (!cancelled()) msg.textContent = gpsOffT('Erreur : ', 'Error: ') + (err && err.message || err) + (location.protocol === 'file:' ? gpsOffT(' (fichier local : utilise plutôt la Web App)', ' (local file: use the Web App instead)') : '');
  } finally { $('#goLoad').disabled = $('#goTrace').disabled = false; }
}
/* Couloir autour de la trace : carrés de 0,1° ≤ largeur choisie de chaque côté, chargés un par un (pause d'1 s pour ménager l'API OSM) */
function gpsOffTiles(ll, widthKm) {
  const T = 0.1, seen = new Map(), dLat = widthKm / 111;
  let last = null;
  for (let i = 0; i < ll.length; i++) {
    const p = ll[i]; if (last && Math.abs(p[0] - last[0]) < 0.0015 && Math.abs(p[1] - last[1]) < 0.0015 && i < ll.length - 1) continue; last = p;
    const dLon = dLat / Math.max(0.2, Math.cos(p[0] * Math.PI / 180));
    for (let x = Math.floor((p[1] - dLon) / T); x <= Math.floor((p[1] + dLon) / T); x++) for (let y = Math.floor((p[0] - dLat) / T); y <= Math.floor((p[0] + dLat) / T); y++) { const k = x + ',' + y; if (!seen.has(k)) seen.set(k, [x * T, y * T, (x + 1) * T, (y + 1) * T]); }
  }
  return [...seen.values()];
}
async function gpsOffTrace() {
  const msg = $('#goMsg'), btn = $('#goTrace');
  if (btn.dataset.run) { gpsOffRun++; return; }      // 2e clic = arrêter
  if (!S.ll || S.ll.length < 2) { msg.textContent = gpsOffT('Charge d’abord une trace.', 'Load a track first.'); return; }
  gpsOffReadOpt();
  const tiles = gpsOffTiles(S.ll, gpsOffOpt.width), MAXT = 80;
  if (tiles.length > MAXT) { msg.textContent = gpsOffT(`Trop de zones (${tiles.length}, maxi ${MAXT}) : réduis la largeur du couloir ou charge la trace en plusieurs fois.`, `Too many areas (${tiles.length}, max ${MAXT}): reduce the corridor width or load the track in several steps.`); return; }
  const run = ++gpsOffRun, cancelled = () => run !== gpsOffRun || curHeat !== 'gpsoff', label = btn.textContent;
  btn.dataset.run = '1'; btn.textContent = gpsOffT('⏹ Arrêter', '⏹ Stop'); $('#goLoad').disabled = true;
  let kept = 0, err = 0, errRow = 0, done = 0;
  try {
    for (const [w, s, e, n] of tiles) {
      if (cancelled()) break;
      const head = gpsOffT(`Zone ${done + 1} sur ${tiles.length}… `, `Area ${done + 1} of ${tiles.length}… `);
      msg.textContent = head;
      try {
        const r = await gpsOffProcess(w, s, e, n, cancelled, c => { msg.textContent = head + c + gpsOffT(' points', ' points'); });
        if (cancelled()) break;
        gpsOffMerge([[w, s, e, n]], gpsOffFlat(r.pts)); kept += r.pts.length; errRow = 0;
      } catch (ex) { if (cancelled()) break; err++; if (++errRow >= 3) { msg.textContent = gpsOffT('Arrêt : 3 erreurs de suite (', 'Stopped: 3 errors in a row (') + (ex && ex.message || ex) + ').'; return; } }
      done++;
      await new Promise(r => setTimeout(r, 1000));
    }
    msg.textContent = (done < tiles.length ? gpsOffT('Arrêté : ', 'Stopped: ') : gpsOffT('Terminé : ', 'Done: ')) + gpsOffT(`${done} zones sur ${tiles.length}, ${kept} points gardés`, `${done} of ${tiles.length} areas, ${kept} points kept`) + (err ? gpsOffT(` (${err} zone(s) en erreur : relance pour les compléter).`, ` (${err} area(s) failed: run again to complete them).`) : '.');
  } finally { delete btn.dataset.run; btn.textContent = label; $('#goLoad').disabled = false; }
}
function gpsOffSave() {
  if (!gpsOffMem.pts.length) { $('#goMsg').textContent = gpsOffT('Rien à enregistrer : charge d’abord une zone.', 'Nothing to save: load an area first.'); return; }
  const d = new Date(), stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  download('heatmap-osm-' + stamp + '.json', JSON.stringify({ type: 'rb-heatmap-osm', v: 1, date: d.toISOString(), zones: gpsOffMem.zones, pts: gpsOffMem.pts }), 'application/json');
  $('#goMsg').textContent = gpsOffT('Heatmap enregistrée (fichier .json).', 'Heatmap saved (.json file).');
}
async function gpsOffImport(file) {
  try {
    const j = JSON.parse(await file.text());
    if (!j || j.type !== 'rb-heatmap-osm' || !Array.isArray(j.pts) || !Array.isArray(j.zones)) throw new Error(gpsOffT('ce n’est pas un fichier de heatmap', 'not a heatmap file'));
    gpsOffMerge(j.zones.filter(z => Array.isArray(z) && z.length === 4), j.pts.filter(x => typeof x === 'number'));
    $('#goMsg').textContent = gpsOffT(`Heatmap importée : ${j.pts.length / 2} points ajoutés.`, `Heatmap imported: ${j.pts.length / 2} points added.`);
    const z = j.zones[j.zones.length - 1]; if (z && !map.getBounds().intersects([[z[1], z[0]], [z[3], z[2]]])) map.fitBounds([[z[1], z[0]], [z[3], z[2]]]);
  } catch (err) { $('#goMsg').textContent = gpsOffT('Import impossible : ', 'Import failed: ') + (err && err.message || err); }
}
function gpsOffClear() {
  if (!gpsOffMem.pts.length) return;
  if (!confirm(gpsOffT('Vider la heatmap gardée en mémoire ? (pense à l’enregistrer avant)', 'Clear the heatmap kept in memory? (save it first if you want to keep it)'))) return;
  gpsOffMem = { zones: [], pts: [] }; gpsOffRefresh(); gpsOffDB.del();
  $('#goMsg').textContent = gpsOffT('Mémoire vidée.', 'Memory cleared.');
}
