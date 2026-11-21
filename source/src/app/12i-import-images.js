/* ============================================================
   Import d'un GPX venu d'une autre plateforme : waypoints + images de tulipe / de notes, sans trace
   Chaque waypoint devient une note ; les images (openrally:tulip / openrally:notes) sont gardées telles quelles
   (n.imgT, n.imgN), affichées à la place des cases dessinées et réécrites à l'export.
   Le tracé provisoire relie les waypoints en ligne droite (à remplacer plus tard).
   ============================================================ */
function importWptGPX(txt, fileName) {
  const doc = new DOMParser().parseFromString(txt, 'application/xml');
  const kids = (el, ln) => Array.from(el.children).filter(c => c.localName === ln);
  const first = (el, ln) => kids(el, ln)[0];
  const num = v => { const x = parseFloat(v); return isFinite(x) ? x : null; };
  const rad = v => { const x = num(v); return x != null && x < 1e7 ? x : null; };      // « infini » (1.79e308) = pas de rayon
  const rows = [];
  for (const w of Array.from(doc.getElementsByTagNameNS('*', 'wpt'))) {
    const lat = num(w.getAttribute('lat')), lon = num(w.getAttribute('lon')); if (lat == null || lon == null) continue;
    const ext = first(w, 'extensions'), ex = ext ? Array.from(ext.children) : [];
    const g = ln => ex.find(e => e.localName === ln);
    const txtOf = ln => { const e = g(ln); return e ? e.textContent.trim() : ''; };
    const r = { lat, lon, name: (first(w, 'name') || {}).textContent || '', desc: ((first(w, 'desc') || {}).textContent || '').trim(), g, txtOf };
    if (!ext || (!g('distance') && !g('tulip') && !g('notes') && !ex.some(e => /^(dss|ass|wp.|checkpoint|dt|ft|dn|fn|dz|fz|fuel|danger|cap)$/.test(e.localName)))) { r.skip = true; }
    rows.push(r);
  }
  const R = rows.filter(r => !r.skip);
  if (!R.length) throw new Error('Aucun waypoint exploitable dans ce fichier.');
  let hasDist = R.every(r => num(r.txtOf('distance')) != null);
  const ll = R.map(r => [r.lat, r.lon]);
  const out = []; let nid = 1, cum = 0;
  R.forEach((r, i) => {
    if (i) cum += haversine(ll[i - 1], ll[i]);
    const n = { id: nid++, s: hasDist ? Math.round(num(r.txtOf('distance')) * 1000 * 10) / 10 : Math.round(cum * 10) / 10, lat: +r.lat.toFixed(6), lon: +r.lon.toFixed(6),
      text: '', cap: null, showCap: false, danger: 0, wp: null, auto: false, edited: true, kind: i === 0 ? 'start' : i === R.length - 1 ? 'end' : 'info', tulip: null };
    const t = r.txtOf('tulip'), nt = r.txtOf('notes');
    if (/^data:image\//.test(t)) n.imgT = t;
    if (/^data:image\//.test(nt)) n.imgN = nt;
    const cap = num(r.txtOf('cap')); if (cap != null) { n.cap = cap; n.showCap = true; }
    const dg = num(r.txtOf('danger')); if (dg) n.danger = Math.max(0, Math.min(3, Math.round(dg)));
    if (r.g('fuel')) n.fuel = true;
    const at = ln => { const e = r.g(ln); return e ? { open: rad(e.getAttribute('open')), clear: rad(e.getAttribute('clear')), name: e.getAttribute('name') || '' } : null; };
    for (const t0 of ['dss', 'ass', 'wpm', 'wpc', 'wps', 'wpn', 'wpp', 'wpv', 'wpe', 'dt', 'ft', 'dn', 'fn']) {
      const a = at(t0); if (!a) continue;
      n.wp = { type: t0, name: a.name }; if (a.open != null) n.wp.open = a.open; if (a.clear != null) n.wp.clear = a.clear; break;
    }
    if (!n.wp) { const a = at('checkpoint'); if (a) { n.wp = { type: a.open || a.clear ? 'cp' : 'ch', name: a.name }; if (a.open != null && a.open) n.wp.open = a.open; if (a.clear) n.wp.clear = a.clear; } }
    const tc = r.g('timecontrol'); if (tc && n.wp) { const al = num(tc.getAttribute('allowed')); if (al > 0) n.wp.limit = al; }
    const sp = num(r.txtOf('speed')); if (sp && n.wp) n.wp.speed = sp;
    const nu = num(r.txtOf('neutralization')); if (nu != null && n.wp && n.wp.type === 'dn') n.wp.dur = nu / 60;
    const dz = at('dz'), fz = at('fz');
    if (dz || fz) n.zone = { type: dz && fz ? 'fzdz' : dz ? 'dz' : 'fz', speed: sp || undefined };
    if (r.desc && !(n.imgN)) n.text = r.desc;
    out.push(n);
  });
  const md = doc.getElementsByTagNameNS('*', 'metadata')[0], mn = md && Array.from(md.children).find(c => c.localName === 'name');
  return { notes: out, ll, name: mn && mn.textContent.trim() || fileName.replace(/\.gpx$/i, ''), nImg: out.filter(n => n.imgT || n.imgN).length, skipped: rows.length - R.length };
}
function applyWptImport(r) {
  if (drawing) setDrawing(false);
  S.stages = []; S.ele = null; S.marks = []; if (S.timing) S.timing.ss = {}; renderMarks();
  S.src = 'gpx'; S.ctrl = []; S.segs = []; S.stale = false; S.sel = null; S.nextId = r.notes.length + 1;
  S.name = r.name; $('#rbName').value = S.name;
  setTrack(r.ll, true); S.notes = r.notes;
  HIST.length = 0; renderAll(); renderTrack(true); setDirty(false);
}
