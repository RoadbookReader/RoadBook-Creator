/* ---------- Fonds vectoriels personnels : tuiles vectorielles (.pbf / .mvt) ajoutées par l'utilisateur dans « Ajouter un fond »
   - type 'vec'   : adresse de tuiles .pbf, dessinées avec un style simple automatique (genericDraw)
   - type 'style' : adresse d'un fichier de style MapLibre / Mapbox (.json) : on en lit la source de tuiles et on peint les couches
                    (fond, surfaces, lignes, points, textes) avec un interpréteur de style simplifié (styleDraw).
   Réutilise ctlTile (téléchargement) et decodeMVT (décodage) de 12b-controle.js ; le dessin est celui d'un GridLayer sur canvas. */
// mémoire des styles (adresse → promesse { layers, bg, tpl, minz, maxz }) : créée à la demande, car 05-carte.js appelle vsLoad avant que ce fichier ait fini de se charger
function vsColor(s) {      // chaîne CSS quelconque → [r, g, b, a]
  vsColor.c = vsColor.c || new Map(); if (vsColor.c.has(s)) return vsColor.c.get(s);
  let r = [0, 0, 0, 1];
  try { const cv = document.createElement('canvas'); cv.width = cv.height = 1; const x = cv.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, 1, 1); x.fillStyle = s; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; r = [d[0], d[1], d[2], d[3] / 255]; } catch (_) {}
  vsColor.c.set(s, r); return r;
}
function vsVal(v, z, dflt, isCol) {      // valeur constante ou { stops: [[zoom, valeur], …] }
  if (v == null) return dflt;
  if (typeof v === 'object' && !Array.isArray(v) && v.stops && v.stops.length) {
    const st = v.stops; if (z <= st[0][0]) return st[0][1]; if (z >= st[st.length - 1][0]) return st[st.length - 1][1];
    for (let i = 0; i < st.length - 1; i++) if (z >= st[i][0] && z < st[i + 1][0]) {
      const a = st[i], b = st[i + 1], t = (z - a[0]) / (b[0] - a[0]);
      if (isCol) { const c1 = vsColor(a[1]), c2 = vsColor(b[1]); return `rgba(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)},${(c1[3] + (c2[3] - c1[3]) * t).toFixed(3)})`; }
      return typeof a[1] === 'number' ? a[1] + (b[1] - a[1]) * t : a[1];
    }
  }
  return Array.isArray(v) ? dflt : v;      // les expressions modernes ne sont pas gérées : valeur par défaut
}
function vsFilter(f, p, gt) {      // filtres MapLibre : ==, !=, in, !in, has, !has, all, any, none (forme ancienne), $type
  try {
    const op = f[0], key = f[1], val = k => k === '$type' ? (gt === 1 ? 'Point' : gt === 2 ? 'LineString' : 'Polygon') : (Array.isArray(k) && k[0] === 'get' ? p[k[1]] : p[k]);
    const arg = x => Array.isArray(x) && x[0] === 'get' ? p[x[1]] : x;
    switch (op) {
      case '==': return val(key) == arg(f[2]); case '!=': return val(key) != arg(f[2]);
      case '<': return val(key) < arg(f[2]); case '<=': return val(key) <= arg(f[2]); case '>': return val(key) > arg(f[2]); case '>=': return val(key) >= arg(f[2]);
      case 'in': return f.slice(2).some(x => val(key) == x); case '!in': return !f.slice(2).some(x => val(key) == x);
      case 'has': return val(key) != null; case '!has': return val(key) == null;
      case 'all': return f.slice(1).every(x => vsFilter(x, p, gt)); case 'any': return f.slice(1).some(x => vsFilter(x, p, gt)); case 'none': return !f.slice(1).some(x => vsFilter(x, p, gt));
    }
  } catch (_) {}
  return true;
}
function vsText(tf, p) {      // text-field : "{nom}", ["get", "nom"], ["concat", …]
  if (tf == null) return '';
  if (typeof tf === 'string') return tf.replace(/\{([^}]+)\}/g, (_, k) => p[k] == null ? '' : p[k]);
  if (Array.isArray(tf)) { if (tf[0] === 'get') return p[tf[1]] == null ? '' : String(p[tf[1]]); if (tf[0] === 'concat') return tf.slice(1).map(x => vsText(x, p)).join(''); }
  return '';
}
async function vsLoad(url) {      // télécharge et prépare un style
  const MEM = vsLoad.mem = vsLoad.mem || new Map(); if (MEM.has(url)) return MEM.get(url);
  const pr = (async () => {
    const r = await fetch(url); if (!r.ok) throw new Error('style introuvable'); const j = await r.json();
    let src = null; for (const k in (j.sources || {})) if ((j.sources[k].type || '') === 'vector') { src = j.sources[k]; break; }
    if (!src) throw new Error('aucune source vectorielle dans ce style');
    let tiles = src.tiles && src.tiles[0], minz = src.minzoom, maxz = src.maxzoom;
    if ((!tiles || maxz == null) && src.url) { try { const m = await (await fetch(src.url)).json(); tiles = tiles || (m.tiles && m.tiles[0]); if (minz == null) minz = m.minzoom; if (maxz == null) maxz = m.maxzoom; } catch (_) {} }
    if (!tiles) throw new Error('adresse des tuiles introuvable dans ce style');
    const layers = (j.layers || []).filter(l => !(l.layout && l.layout.visibility === 'none') && /^(fill|line|circle|symbol|background)$/.test(l.type));
    const bgL = layers.find(l => l.type === 'background'), bg = bgL && bgL.paint && typeof bgL.paint['background-color'] === 'string' ? bgL.paint['background-color'] : '#f4f1e8';
    return { layers: layers.filter(l => l.type !== 'background'), bg, tpl: tiles, minz: minz == null ? 0 : minz, maxz: maxz == null ? 14 : maxz };
  })();
  pr.catch(() => MEM.delete(url)); MEM.set(url, pr); return pr;
}
function styleDraw(S, g, T, z, N, sc) {
  const pth = (f, ext, close) => { g.beginPath(); for (const r of f.rings) { r.forEach(([x, y], i) => { x = x / ext * N; y = y / ext * N; i ? g.lineTo(x, y) : g.moveTo(x, y); }); if (close) g.closePath(); } };
  const placed = [];
  for (const L of S.layers) {
    if (L.minzoom != null && z < L.minzoom) continue; if (L.maxzoom != null && z >= L.maxzoom) continue;
    const Ly = T[L['source-layer']]; if (!Ly) continue; const P = L.paint || {}, Y = L.layout || {}, ext = Ly.extent || 4096;
    if (L.type === 'fill') {
      const col = vsVal(P['fill-color'], z, null, true); if (!col || Array.isArray(col)) continue; const op = vsVal(P['fill-opacity'], z, 1), oc = vsVal(P['fill-outline-color'], z, null, true);
      for (const f of Ly.features) { if (f.type !== 3 || (L.filter && !vsFilter(L.filter, f.props, 3))) continue; pth(f, ext, true); g.globalAlpha = op; g.fillStyle = col; g.fill('evenodd'); if (oc && !Array.isArray(oc)) { g.lineWidth = 1 / sc; g.strokeStyle = oc; g.stroke(); } g.globalAlpha = 1; }
    } else if (L.type === 'line') {
      const col = vsVal(P['line-color'], z, '#888', true), w = vsVal(P['line-width'], z, 1) / sc, op = vsVal(P['line-opacity'], z, 1), da = Array.isArray(P['line-dasharray']) && typeof P['line-dasharray'][0] === 'number' ? P['line-dasharray'] : null;
      if (!(w > 0)) continue;
      for (const f of Ly.features) {
        if (f.type === 1 || (L.filter && !vsFilter(L.filter, f.props, f.type))) continue;
        pth(f, ext, f.type === 3); g.globalAlpha = op; g.strokeStyle = Array.isArray(col) ? '#888' : col; g.lineWidth = w; g.lineCap = Y['line-cap'] || 'butt'; g.lineJoin = Y['line-join'] || 'miter'; g.setLineDash(da ? da.map(d => d * w) : []); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      }
    } else if (L.type === 'circle') {
      const col = vsVal(P['circle-color'], z, '#888', true), r = vsVal(P['circle-radius'], z, 3) / sc, op = vsVal(P['circle-opacity'], z, 1), sw = vsVal(P['circle-stroke-width'], z, 0) / sc, sc2 = vsVal(P['circle-stroke-color'], z, '#fff', true);
      for (const f of Ly.features) { if (f.type !== 1 || !f.rings[0] || (L.filter && !vsFilter(L.filter, f.props, 1))) continue; const [x, y] = f.rings[0][0]; g.globalAlpha = op; g.beginPath(); g.arc(x / ext * N, y / ext * N, r, 0, 6.2832); g.fillStyle = col; g.fill(); if (sw > 0) { g.lineWidth = sw; g.strokeStyle = sc2; g.stroke(); } g.globalAlpha = 1; }
    } else if (L.type === 'symbol' && Y['text-field'] != null) {
      const size = vsVal(Y['text-size'], z, 12) / sc, col = vsVal(P['text-color'], z, '#333', true), hc = vsVal(P['text-halo-color'], z, 'rgba(255,255,255,.85)', true), hw = vsVal(P['text-halo-width'], z, 0), up = Y['text-transform'] === 'uppercase';
      const ff = (Y['text-font'] || []).join(' '), font = `${/Italic|Oblique/i.test(ff) ? 'italic ' : ''}${/Bold|Semibold/i.test(ff) ? 'bold' : 'normal'} ${size}px sans-serif`;
      for (const f of Ly.features) {
        if (f.type !== 1 || !f.rings[0] || (L.filter && !vsFilter(L.filter, f.props, 1))) continue;
        let t = vsText(Y['text-field'], f.props); if (!t) continue; if (up) t = t.toUpperCase();
        const [x0, y0] = f.rings[0][0], x = x0 / ext * N, y = y0 / ext * N; g.font = font; const w = g.measureText(t).width, bx = [x - w / 2, y - size / 2, x + w / 2, y + size / 2];
        if (bx[0] < -N * .1 || bx[2] > N * 1.1 || placed.some(r => bx[0] < r[2] && bx[2] > r[0] && bx[1] < r[3] && bx[3] > r[1])) continue; placed.push(bx);
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        if (hw > 0) { g.strokeStyle = hc; g.lineWidth = hw * 2 / sc; g.strokeText(t, x, y); } g.fillStyle = col; g.fillText(t, x, y);
      }
    }
  }
}
function genericDraw(g, T, z, N, sc) {      // sans style : couleurs choisies d'après le nom des couches
  const pth = (f, ext, close) => { g.beginPath(); for (const r of f.rings) { r.forEach(([x, y], i) => { x = x / ext * N; y = y / ext * N; i ? g.lineTo(x, y) : g.moveTo(x, y); }); if (close) g.closePath(); } };
  const k = clamp(0.55 + (z - 12) * 0.2, 0.45, 1.7) / sc, labels = [];
  const order = n => /water|hydro|eau/i.test(n) ? 1 : /wood|forest|veget|bois|landcover|park/i.test(n) ? 0 : /landuse|habitation|resid/i.test(n) ? 0 : /build|bati/i.test(n) ? 2 : /rail|ferre/i.test(n) ? 3 : /road|route|routier|transport|highway|street|chemin|voie/i.test(n) ? 4 : 3;
  for (const n of Object.keys(T).sort((a, b) => order(a) - order(b))) {
    const Ly = T[n], ext = Ly.extent || 4096;
    for (const f of Ly.features) {
      if (f.type === 3) { const c = /water|hydro|eau/i.test(n) ? '#a9d3f0' : /wood|forest|veget|bois|landcover|park/i.test(n) ? '#cfe3b8' : /build|bati/i.test(n) ? '#cdc7ba' : /landuse|habitation|resid/i.test(n) ? '#ece5d6' : null; pth(f, ext, true); if (c) { g.fillStyle = c; g.fill('evenodd'); } else { g.strokeStyle = 'rgba(120,120,120,.35)'; g.lineWidth = .6 / sc; g.stroke(); } }
      else if (f.type === 2) {
        pth(f, ext, false); g.lineCap = g.lineJoin = 'round'; g.setLineDash([]);
        if (/water|hydro|eau/i.test(n)) { g.strokeStyle = '#6fb2e0'; g.lineWidth = 1.5 * k; g.stroke(); }
        else if (/rail|ferre/i.test(n)) { g.strokeStyle = '#666'; g.lineWidth = 1.3 * k; g.stroke(); }
        else if (/road|route|routier|transport|highway|street|chemin|voie/i.test(n)) { g.strokeStyle = '#9a958a'; g.lineWidth = 3.6 * k; g.stroke(); pth(f, ext, false); g.strokeStyle = '#fff'; g.lineWidth = 2.3 * k; g.stroke(); }
        else if (/bound|admin|limite/i.test(n)) { g.strokeStyle = '#b07ac0'; g.lineWidth = .8 * k; g.setLineDash([6 * k, 3 * k]); g.stroke(); g.setLineDash([]); }
        else { g.strokeStyle = '#999'; g.lineWidth = .9 * k; g.stroke(); }
      } else if (f.type === 1 && z >= 10 && f.rings[0]) { const t = f.props.name || f.props.texte || f.props.toponyme || f.props.nom; if (t) labels.push([String(t), f.rings[0][0][0] / ext * N, f.rings[0][0][1] / ext * N]); }
    }
  }
  const placed = []; g.font = `600 ${11 / sc}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (const [t, x, y] of labels) { const w = g.measureText(t).width, bx = [x - w / 2, y - 6 / sc, x + w / 2, y + 6 / sc]; if (placed.some(r => bx[0] < r[2] && bx[2] > r[0] && bx[1] < r[3] && bx[3] > r[1])) continue; placed.push(bx); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3 / sc; g.strokeText(t, x, y); g.fillStyle = '#333'; g.fillText(t, x, y); }
}
function vecCustomLayer(c) {      // c : { url, type: 'vec' | 'style', max, name }
  let S = null, err = null; const ready = c.type === 'style' ? vsLoad(c.url).then(s => { S = s; }).catch(e => { err = e; }) : Promise.resolve();
  const Layer = L.GridLayer.extend({
    createTile(co, done) {
      const cv = document.createElement('canvas'), S2 = 2, N = 256; cv.width = cv.height = N * S2; const g = cv.getContext('2d'); g.scale(S2, S2);
      ready.then(() => {
        const tpl = c.type === 'style' ? (S && S.tpl) : c.url; if (c.kind !== 'over') { g.fillStyle = S ? S.bg : '#f4f1e8'; g.fillRect(0, 0, N, N); }
        if (!tpl) { done(null, cv); return; }
        const zmin = c.type === 'style' ? S.minz : 0, zmax = c.type === 'style' ? S.maxz : (c.max || 14), jobs = [];
        if (co.z > zmax) { const f = 2 ** (co.z - zmax), px = Math.floor(co.x / f), py = Math.floor(co.y / f); jobs.push({ z: zmax, x: px, y: py, ox: -(co.x - px * f) * N, oy: -(co.y - py * f) * N, s: f }); }
        else if (co.z < zmin) { const n = 2 ** (zmin - co.z); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) jobs.push({ z: zmin, x: co.x * n + i, y: co.y * n + j, ox: i * N / n, oy: j * N / n, s: 1 / n }); }
        else jobs.push({ z: co.z, x: co.x, y: co.y, ox: 0, oy: 0, s: 1 });
        const sub = (j, y) => tpl.replace('{z}', j.z).replace('{x}', j.x).replace(/\{-y\}/, (1 << j.z) - 1 - j.y).replace('{y}', j.y);
        return Promise.all(jobs.map(j => ctlTile(sub(j)).then(d => ({ j, d })).catch(() => null))).then(res => {
          for (const r of res) {
            if (!r || !r.d.length) continue; const j = r.j; let T; try { T = decodeMVT(r.d); } catch (_) { continue; }
            g.save(); if (j.s < 1) { g.beginPath(); g.rect(j.ox, j.oy, N * j.s, N * j.s); g.clip(); }
            g.translate(j.ox, j.oy); g.scale(j.s, j.s); try { S ? styleDraw(S, g, T, co.z, N, j.s) : genericDraw(g, T, co.z, N, j.s); } catch (_) {} g.restore();
          }
          done(null, cv);
        });
      });
      return cv;
    } });
  const lay = new Layer({ minZoom: 4, maxZoom: 19, tileSize: 256, zIndex: c.kind === 'over' ? 5 : 1, attribution: esc(c.name || '') });
  lay.vecReady = ready.then(() => { if (err) throw err; });
  return lay;
}
