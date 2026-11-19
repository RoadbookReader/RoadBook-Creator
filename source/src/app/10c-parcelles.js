/* ---------- Passages dans des parcelles cadastrales (France) : indice de chemin privé, dans le rapport de génération ---------- */
const PARC_TYPE = 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle', PARC_CELL = 0.01, PARC_STEP = 10, PARC_MARGIN = 4, PARC_GAP = 20, PARC_MIN = 40, PARC_PAGE = 5000;
let PARC_LAYER = null;
function parcClear() { if (PARC_LAYER) { map.removeLayer(PARC_LAYER); PARC_LAYER = null; } }
function parcInFrance(ll) { const a = ll[0]; return a && a[0] > 41 && a[0] < 51.5 && a[1] > -5.6 && a[1] < 10; }
async function parcQuery(box, isCancelled) {
  const out = [];
  for (let page = 0; page < 40; page++) {
    if (isCancelled()) throw new Error('annulé');
    const q = new URLSearchParams({ SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: PARC_TYPE, OUTPUTFORMAT: 'application/json',
      BBOX: `${box[0].toFixed(5)},${box[1].toFixed(5)},${box[2].toFixed(5)},${box[3].toFixed(5)},urn:ogc:def:crs:EPSG::4326`, COUNT: PARC_PAGE, STARTINDEX: page * PARC_PAGE, PROPERTYNAME: 'geom,idu' });
    let j = null, err = null;
    for (let t = 0; t < 4 && !j; t++) {
      try { j = await fetchJSON(IGN_WFS + '?' + q, {}, 90000); }
      catch (e) { err = e; if (isCancelled()) throw new Error('annulé'); if (e.status === 400 && q.has('PROPERTYNAME')) { q.delete('PROPERTYNAME'); t--; continue; } await sleep((e.status === 429 ? 2000 : 1000) * 2 ** t); }
    }
    if (!j) throw err || new Error('Service cadastre indisponible');
    if (!Array.isArray(j.features)) throw new Error('Réponse cadastre inattendue');
    out.push(...j.features);
    if (j.features.length < PARC_PAGE) break;
  }
  return out;
}
async function parcQueryRetry(box, isCancelled) {      // le service IGN a parfois des coups de fatigue : on réessaie plusieurs fois, en attendant de plus en plus
  let last = null;
  for (let t = 0; t < 4; t++) {
    try { return await parcQuery(box, isCancelled); }
    catch (e) { if (/annulé/.test(e.message || '') || isCancelled()) throw e; last = e; console.warn('Cadastre : nouvel essai', e); await sleep(5000 * (t + 1)); }
  }
  throw last;
}
function parcSamples() {      // un point tous les PARC_STEP m le long de la trace : [{s, lat, lon}]
  const ll = S.ll, out = []; let s = 0, next = 0;
  for (let i = 1; i < ll.length; i++) {
    const a = ll[i - 1], b = ll[i], d = haversine(a, b); if (!d) continue;
    while (next <= s + d) { const f = (next - s) / d; out.push({ s: next, lat: a[0] + (b[0] - a[0]) * f, lon: a[1] + (b[1] - a[1]) * f }); next += PARC_STEP; }
    s += d;
  }
  return out;
}
async function parcelCheck(prog, isCancelled) {      // → { passages:[{s0,s1,len,pts}], total, L, nPar } ; lève une erreur si le service est indisponible
  const sm = parcSamples(); if (sm.length < 2) return null;
  const L = sm[sm.length - 1].s;
  const cells = new Set(); for (const p of sm) cells.add(Math.floor(p.lon / PARC_CELL) + ',' + Math.floor(p.lat / PARC_CELL));
  const rects = ignRects([...cells]), feats = []; let n = 0;
  for (const [x0, x1, y] of rects) {
    prog && prog('Parcelles cadastrales…', n++ / rects.length); await sleep(0);
    feats.push(...await parcQueryRetry([y * PARC_CELL, x0 * PARC_CELL, (y + 1) * PARC_CELL, (x1 + 1) * PARC_CELL], isCancelled));
  }
  const lat0 = sm[0].lat, kx = 111320 * Math.cos(lat0 * D2R), ky = 110540;
  const xy = c => [c[0] * kx, c[1] * ky];      // c = [lon, lat]
  const polys = [], grid = new Map(), seen = new Set(), CG = 100;
  const addPoly = rings => {
    const R = rings.map(r => r.map(xy)); let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
    for (const q of R[0]) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    const id = polys.length; polys.push({ R, x0, y0, x1, y1 });
    for (let gx = Math.floor(x0 / CG); gx <= Math.floor(x1 / CG); gx++) for (let gy = Math.floor(y0 / CG); gy <= Math.floor(y1 / CG); gy++) { const k = gx + ',' + gy; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(id); }
  };
  for (const f of feats) { if (seen.has(f.id) || !f.geometry) continue; seen.add(f.id); const g = f.geometry; if (g.type === 'Polygon') addPoly(g.coordinates); else if (g.type === 'MultiPolygon') for (const p of g.coordinates) addPoly(p); }
  if (!polys.length) return { passages: [], total: 0, L, nPar: 0 };
  const edgeD = (p, ring) => { let m = 1e18; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[j], b = ring[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); const ex = a[0] + t * dx - p[0], ey = a[1] + t * dy - p[1]; const d = ex * ex + ey * ey; if (d < m) m = d; } return Math.sqrt(m); };
  const inside = sm.map(s => {
    const p = xy([s.lon, s.lat]), ids = grid.get(Math.floor(p[0] / CG) + ',' + Math.floor(p[1] / CG)) || [];
    for (const id of ids) {
      const P = polys[id]; if (p[0] < P.x0 || p[0] > P.x1 || p[1] < P.y0 || p[1] > P.y1) continue;
      if (!pointInPoly(p, P.R[0]) || P.R.slice(1).some(h => pointInPoly(p, h))) continue;
      if (P.R.every(r => edgeD(p, r) >= PARC_MARGIN)) return true;      // à plus de 4 m du bord : la trace est bien dans la parcelle (et pas sur son contour)
    }
    return false;
  });
  const passages = []; let cur = null;
  for (let i = 0; i < sm.length; i++) {
    if (inside[i]) { if (cur && sm[i].s - cur.s1 <= PARC_GAP) { cur.s1 = sm[i].s; cur.i1 = i; } else { if (cur) passages.push(cur); cur = { s0: sm[i].s, s1: sm[i].s, i0: i, i1: i }; } }
  }
  if (cur) passages.push(cur);
  const keep = passages.filter(p => p.s1 - p.s0 + PARC_STEP >= PARC_MIN).map(p => ({ s0: p.s0, s1: p.s1, len: p.s1 - p.s0 + PARC_STEP, pts: sm.slice(p.i0, p.i1 + 1).map(q => [q.lat, q.lon]) }));
  return { passages: keep, total: keep.reduce((a, p) => a + p.len, 0), L, nPar: polys.length };
}
function parcDraw(R) {
  parcClear(); if (!R || !R.passages.length) return;
  PARC_LAYER = L.layerGroup(R.passages.map((p, i) => L.polyline(p.pts, { color: '#ff7a00', weight: 7, opacity: .75, interactive: true }).bindTooltip(`Passage dans une parcelle n° ${i + 1} · km ${(p.s0 / 1000).toFixed(1)} · ${Math.round(p.len)} m`, { sticky: true }))).addTo(map);
}
function parcHtml(R) {
  const km = m => (m / 1000).toFixed(1).replace('.', ','), T = gpsOffT, n = R.passages.length;
  if (!n) return `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(60,160,80,.13)">${T('<b>Parcelles cadastrales :</b> aucun passage dans une parcelle (' + R.nPar + ' parcelles vérifiées le long de la trace).', '<b>Cadastral parcels:</b> no passage inside a parcel (' + R.nPar + ' parcels checked along the track).')}</div>`;
  const rows = R.passages.slice(0, 12).map((p, i) => `<li>${T('n° ' + (i + 1) + ' : km ' + km(p.s0) + ' → ' + km(p.s1) + ' (' + Math.round(p.len) + ' m)', 'no. ' + (i + 1) + ': km ' + km(p.s0).replace(',', '.') + ' → ' + km(p.s1).replace(',', '.') + ' (' + Math.round(p.len) + ' m)')}</li>`).join('');
  const pc = Math.round(100 * R.total / R.L);
  return `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(255,122,0,.15)">${T(
    `<b>Parcelles cadastrales : ${n} passage${n > 1 ? 's' : ''} dans des parcelles</b> (${Math.round(R.total)} m, ${pc} % de la trace, en orange sur la carte). En France, les chemins publics sont en général hors parcelles : ces passages sont <b>plus probablement privés</b>, à vérifier.`,
    `<b>Cadastral parcels: ${n} passage${n > 1 ? 's' : ''} inside parcels</b> (${Math.round(R.total)} m, ${pc} % of the track, in orange on the map). In France, public paths are usually outside parcels: these passages are <b>more likely private</b>, to be checked.`)}<ul style="margin:4px 0 0 18px;padding:0">${rows}</ul>${n > 12 ? `<div class="help">${T('… et ' + (n - 12) + ' autres.', '… and ' + (n - 12) + ' more.')}</div>` : ''}<div class="help" style="margin:4px 0 0">${T('C’est un indice, pas une preuve : le cadastre peut être décalé de quelques mètres, et les forêts communales ou chemins d’exploitation ouverts sont aussi dans des parcelles.', 'This is a hint, not proof: the cadastre can be shifted by a few metres, and communal forests or open farm tracks are also inside parcels.')}</div></div>`;
}
