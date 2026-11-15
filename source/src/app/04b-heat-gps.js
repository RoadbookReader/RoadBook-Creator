/* ---------- Heatmap « traces GPS OSM hors route » ----------
   Points publics de l'API OSM (trackpoints) → filtre vitesse (entre points d'un même segment, grâce à l'heure) → on retire ceux qui sont près
   d'une route goudronnée (Overpass, index en cases de 50 m) → Leaflet.heat. Calculé à la demande pour la zone visible (max 0,25 deg²). */
const GPSOFF_ROAD = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$/;
const GPSOFF_UNPAVED = /^(unpaved|gravel|fine_gravel|dirt|ground|earth|grass|sand|mud|compacted|pebblestone)$/;
let gpsOffOpt = { vmin: 3, vmax: 50, hr: true, dist: 25 };
try { Object.assign(gpsOffOpt, JSON.parse(localStorage.getItem('rbgen.gpsOff') || '{}')); } catch (_) {}
const gpsOffLayer = L.layerGroup();
let gpsOffRun = 0, gpsOffHeat = null;
gpsOffLayer.setOpacity = o => { gpsOffLayer._op = o; const c = gpsOffHeat && gpsOffHeat._canvas; if (c) c.style.opacity = o; };
const gpsOffT = (fr, en) => (I18N.lang === 'en' ? en : fr);
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
async function gpsOffLoad() {
  const msg = $('#goMsg'), run = ++gpsOffRun, cancelled = () => run !== gpsOffRun || curHeat !== 'gpsoff';
  const num = (id, d, lo, hi) => { const v = parseFloat($(id).value); return clamp(isFinite(v) ? v : d, lo, hi); };
  gpsOffOpt = { vmin: num('#goVmin', 3, 0, 200), vmax: num('#goVmax', 50, 1, 300), hr: $('#goHr').checked, dist: num('#goDist', 25, 5, 200) };
  if (gpsOffOpt.vmax < gpsOffOpt.vmin) gpsOffOpt.vmax = gpsOffOpt.vmin;
  try { localStorage.setItem('rbgen.gpsOff', JSON.stringify(gpsOffOpt)); } catch (_) {}
  const b = map.getBounds(), w = b.getWest(), s = b.getSouth(), e = b.getEast(), n = b.getNorth();
  if ((e - w) * (n - s) > 0.25) { msg.textContent = gpsOffT('Zone trop grande : zoome davantage (maxi 0,25 deg², zoom 12 ou plus).', 'Area too large: zoom in (max 0.25 deg², zoom 12 or more).'); return; }
  $('#goLoad').disabled = true;
  try {
    msg.textContent = gpsOffT('Chargement des traces…', 'Loading tracks…');
    let pts = await gpsOffPoints(w, s, e, n, cancelled, c => { msg.textContent = c + gpsOffT(' points…', ' points…'); });
    const total = pts.length, capped = pts.capped;
    pts = pts.filter(p => p[2] === null || (p[2] >= gpsOffOpt.vmin && p[2] <= gpsOffOpt.vmax));
    const afterSpeed = pts.length;
    if (gpsOffOpt.hr && pts.length) {
      msg.textContent = gpsOffT('Chargement des routes…', 'Loading roads…');
      const near = gpsOffIndex(await gpsOffRoads(w, s, e, n, cancelled), (s + n) / 2);
      pts = pts.filter(p => !near(p[0], p[1], gpsOffOpt.dist));
    }
    if (cancelled()) return;
    if (gpsOffHeat) gpsOffLayer.removeLayer(gpsOffHeat);
    gpsOffHeat = L.heatLayer(pts.map(p => [p[0], p[1], 0.5]), { radius: 8, blur: 12, minOpacity: 0.3 });
    gpsOffLayer.addLayer(gpsOffHeat);
    gpsOffLayer.setOpacity(gpsOffLayer._op == null ? 1 : gpsOffLayer._op);
    msg.textContent = gpsOffT(`${pts.length} points gardés (sur ${total} ; ${afterSpeed} après le filtre vitesse).`, `${pts.length} points kept (out of ${total}; ${afterSpeed} after the speed filter).`) + (capped ? gpsOffT(' Limite de 50 000 points atteinte : zoome pour tout voir.', ' 50,000-point limit reached: zoom in to see everything.') : '');
  } catch (err) {
    if (!cancelled()) msg.textContent = gpsOffT('Erreur : ', 'Error: ') + (err && err.message || err) + (location.protocol === 'file:' ? gpsOffT(' (fichier local : utilise plutôt la Web App)', ' (local file: use the Web App instead)') : '');
  } finally { $('#goLoad').disabled = false; }
}
