/* ---------- Clic droit : bulle d'actions + « Autour d'ici » ; POI automatiques autour de la trace ---------- */
let REP_SKIPPED = [];      // panneaux / obstacles repérés mais écartés à la dernière génération (pour « Autour d'ici »)
let AROUND_LAYER = null;
function aroundClear() { if (AROUND_LAYER) { map.removeLayer(AROUND_LAYER); AROUND_LAYER = null; } }
function rightClickMenu(ll) {
  const la = ll.lat.toFixed(6), lo = ll.lng.toFixed(6);
  const sv = `https://www.google.com/maps?q=&layer=c&cbll=${la},${lo}`;      // cbll : Google cale sur le panorama le plus proche (le lien « pano/viewpoint » donnait un écran noir)
  const gm = `https://www.google.com/maps/search/?api=1&query=${la},${lo}`;
  const pop = L.popup({ closeButton: false, className: 'svpop', offset: [0, 4] }).setLatLng(ll)
    .setContent(`<a class="svlnk" href="${sv}" target="_blank" rel="noopener">👁 Google Street View</a><a class="svlnk" href="${gm}" target="_blank" rel="noopener">🗺️ Google Maps</a>`
      + `<a class="svlnk" href="#" data-a="around">🔎 Autour d’ici</a><a class="svlnk" href="#" data-a="mark">📍 Ajouter un marqueur ici</a><div class="svco">${la}, ${lo}</div>`).openOn(map);
  pop.getElement().querySelectorAll('[data-a]').forEach(el => el.addEventListener('click', ev => {
    ev.preventDefault(); map.closePopup();
    if (el.dataset.a === 'mark') markForm({ lat: +la, lon: +lo, icon: 'pin', name: '', desc: '' }, true); else aroundDialog(ll);
  }));
}
function aroundItems(ll, R) {
  const c = [ll.lat, ll.lng], d = (la, lo) => haversine(c, [la, lo]), out = { notes: [], marks: [], skipped: [] };
  for (const n of S.notes || []) if (n.lat != null) { const x = d(n.lat, n.lon); if (x <= R) out.notes.push({ x, n }); }
  for (const mk of S.marks || []) { const x = d(mk.lat, mk.lon); if (x <= R) out.marks.push({ x, mk }); }
  for (const s of REP_SKIPPED) { const x = d(s.lat, s.lon); if (x <= R) out.skipped.push({ x, s }); }
  for (const k in out) out[k].sort((a, b) => a.x - b.x);
  return out;
}
function aroundDialog(ll) {
  let R = 300;
  const m = openModal('Autour d’ici', '<div id="arBody"></div>', [{ label: 'Fermer', cls: 'primary', onClick: aroundClear }], { free: true });
  const draw = () => {
    const it = aroundItems(ll, R), tot = it.notes.length + it.marks.length + it.skipped.length;
    const row = (ic, txt, x, id) => `<div class="arRow" data-id="${id}" style="display:flex;gap:8px;align-items:center;margin:3px 0;cursor:pointer;padding:3px 4px;border-radius:6px"><span style="font-size:17px">${ic}</span><span style="flex:1">${esc(txt)}</span><span class="help" style="margin:0">${Math.round(x)} m</span></div>`;
    const sec = (t, rows) => rows.length ? `<div style="margin-top:8px"><b>${t}</b>${rows.join('')}</div>` : '';
    m.querySelector('#arBody').innerHTML = `<label>Rayon <select id="arR">${[100, 300, 1000].map(r => `<option value="${r}" ${r === R ? 'selected' : ''}>${r} m</option>`).join('')}</select></label>`
      + sec('Notes du roadbook', it.notes.map(o => row('📝', (String(o.n.text || '').split('\n').filter(Boolean)[0] || 'Note') + ' · n° ' + (S.notes.indexOf(o.n) + 1), o.x, 'n' + o.n.id)))
      + sec('Marqueurs', it.marks.map(o => row(markIcon(o.mk.icon)[1], o.mk.name || markIcon(o.mk.icon)[2], o.x, 'm' + o.mk.id)))
      + sec('Repères et panneaux écartés', it.skipped.map((o, i) => row('⚠️', o.s.text + (o.s.why ? ' — ' + o.s.why : ''), o.x, 's' + i)))
      + (tot ? '' : `<p class="help" style="margin-top:10px">${gpsOffT('Rien à moins de ' + R + ' m. Les repères et panneaux apparaissent après « Générer le roadbook ».', 'Nothing within ' + R + ' m. Landmarks and signs appear after “Generate the roadbook”.')}</p>`);
    m.querySelector('#arR').onchange = e => { R = +e.target.value; draw(); };
    m.querySelectorAll('.arRow').forEach(el => el.onclick = () => {
      const k = el.dataset.id[0], v = el.dataset.id.slice(1);
      if (k === 'n') { selectNote(+v); return; }
      let la, lo;
      if (k === 'm') { const mk = (S.marks || []).find(x => String(x.id) === v); if (!mk) return; la = mk.lat; lo = mk.lon; }
      else { const o = it.skipped[+v]; la = o.s.lat; lo = o.s.lon; }
      map.setView([la, lo], Math.max(map.getZoom(), 18)); aroundClear();
      AROUND_LAYER = L.circleMarker([la, lo], { radius: 14, color: '#ff7a00', weight: 4, fillOpacity: 0 }).addTo(map);
    });
  };
  draw();
}

/* ---- POI automatiques autour de la trace (OpenStreetMap, types et rayon au choix) ---- */
const POI_TYPES = [
  ['fuel', 'Carburant', ['amenity=fuel']], ['water', 'Eau potable, sources', ['amenity=drinking_water', 'natural=spring']],
  ['refuge', 'Refuges, abris', ['tourism=alpine_hut', 'tourism=wilderness_hut', 'amenity=shelter']],
  ['food', 'Restaurants, cafés', ['amenity=restaurant', 'amenity=cafe']], ['bed', 'Hébergement, camping', ['tourism=hotel', 'tourism=guest_house', 'tourism=hostel', 'tourism=camp_site', 'tourism=caravan_site']],
  ['shop', 'Magasins (supermarché, boulangerie…)', ['shop=supermarket', 'shop=convenience', 'shop=bakery']], ['health', 'Santé (pharmacie, hôpital)', ['amenity=pharmacy', 'amenity=hospital', 'amenity=clinic']],
  ['wc', 'Toilettes', ['amenity=toilets']], ['parking', 'Parkings', ['amenity=parking']], ['view', 'Points de vue', ['tourism=viewpoint']]];
const POI_MAX = 1500;
function poiPrefs() { try { return JSON.parse(localStorage.getItem('rbgen.poi')) || {}; } catch (_) { return {}; } }
async function poiSearch(types, R, prog, isCancelled) {      // → [{lat, lon, key, name, desc, s, d}]
  const idx = simplifyLL(S.ll, Math.max(10, R / 10), 700), pts = idx.map(i => S.ll[i]), CH = 70, found = new Map();
  const filt = types.flatMap(k => POI_TYPES.find(t => t[0] === k)[2].map(f => [k, f]));
  for (let a = 0, n = 0; a < pts.length - 1; a += CH - 1, n++) {
    const part = pts.slice(a, a + CH); if (part.length < 2) break;
    prog && prog(n / Math.ceil((pts.length - 1) / (CH - 1)));
    const ar = `(around:${R},${part.map(p => p[0].toFixed(5) + ',' + p[1].toFixed(5)).join(',')})`;
    const q = `[out:json][timeout:60];(${filt.map(([, f]) => { const [k, v] = f.split('='); return `nwr["${k}"="${v}"]${ar};`; }).join('')});out center tags 2000;`;
    const j = await overpass(q, isCancelled, 0);
    for (const e of j.elements || []) {
      const lat = e.lat != null ? e.lat : e.center && e.center.lat, lon = e.lon != null ? e.lon : e.center && e.center.lon, t = e.tags || {}; if (lat == null) continue;
      const key = e.type + e.id; if (found.has(key)) continue;
      const hit = filt.find(([, f]) => { const [k, v] = f.split('='); return t[k] === v; }); if (!hit) continue;
      found.set(key, { lat, lon, key: hit[0], name: t.name || '', desc: t.description || '' });
    }
    await sleep(0);
  }
  const sm = parcSamples(), k0 = Math.cos(sm[0].lat * D2R), out = [];
  for (const p of found.values()) {
    let best = 1e18, bs = 0;
    for (const q of sm) { const dx = (q.lon - p.lon) * k0, dy = q.lat - p.lat, v = dx * dx + dy * dy; if (v < best) { best = v; bs = q.s; } }
    p.d = Math.sqrt(best) * 111320; p.s = bs; if (p.d <= R * 1.05) out.push(p);
  }
  return out.sort((a, b) => a.s - b.s);
}
function poiDialog() {
  if (!S.ll || S.ll.length < 2) { toast('Charge ou dessine d’abord une trace.', 'err'); return; }
  const pr = poiPrefs(), on = new Set(pr.types || ['fuel', 'water', 'refuge']); let R = pr.r || 500, res = null, busy = false;
  const m = openModal('POI autour de la trace', `<p class="help" style="margin-top:0">Cherche sur OpenStreetMap les lieux utiles le long de ta trace, dans un rayon autour d’elle (France et ailleurs).</p>
    <div id="poiTypes" style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px">${POI_TYPES.map(t => `<label><input type="checkbox" value="${t[0]}" ${on.has(t[0]) ? 'checked' : ''}> ${markIcon(t[0])[1]} ${t[1]}</label>`).join('')}</div>
    <label style="display:block;margin-top:10px">Rayon autour de la trace : <b id="poiRtx">${R} m</b> <input type="range" id="poiR" min="100" max="5000" step="100" value="${R}" style="width:100%"></label>
    <div id="poiRes" style="margin-top:10px"></div>`,
    [{ label: 'Fermer' }, 'sp', { label: '➕ Ajouter les résultats', keep: true, onClick: () => addAll() }, { label: '🔎 Chercher', cls: 'primary', keep: true, onClick: () => go() }]);
  const bts = m.querySelectorAll('.mf .mbtn'), bAdd = bts[1], bGo = bts[2]; bAdd.style.display = 'none';
  m.querySelector('#poiR').oninput = e => { R = +e.target.value; m.querySelector('#poiRtx').textContent = R + ' m'; };
  const info = t => { m.querySelector('#poiRes').innerHTML = t; };
  async function go() {
    if (busy) return; const types = [...m.querySelectorAll('#poiTypes input:checked')].map(i => i.value);
    if (!types.length) { info('<span style="color:#b00">Coche au moins un type.</span>'); return; }
    try { localStorage.setItem('rbgen.poi', JSON.stringify({ types, r: R })); } catch (_) { }
    busy = true; bGo.disabled = true; bAdd.style.display = 'none'; info('Recherche… 0 %');
    try {
      res = await poiSearch(types, R, f => info('Recherche… ' + Math.round(f * 100) + ' %'), () => false);
      if (res.length > POI_MAX) res = res.slice(0, POI_MAX);
      candLayer.clearLayers();
      for (const p of res) {
        const ic = markIcon(p.key);
        const cm = L.marker([p.lat, p.lon], { keyboard: false, opacity: 0.85, icon: L.divIcon({ className: 'mkpin cand', html: `<span>${ic[1]}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
          .bindTooltip(`${esc(p.name || ic[2])} · ${Math.round(p.d)} m de la trace (km ${kmFr(p.s)}) — clique pour ajouter`).on('click', () => markForm({ lat: p.lat, lon: p.lon, icon: p.key, name: p.name, desc: p.desc }, true, cm)).addTo(candLayer);
      }
      const by = {}; for (const p of res) by[p.key] = (by[p.key] || 0) + 1;
      info(res.length ? `<b>${res.length} résultat${res.length > 1 ? 's' : ''}</b> (en transparence sur la carte) : ${POI_TYPES.filter(t => by[t[0]]).map(t => markIcon(t[0])[1] + ' ' + by[t[0]]).join(' · ')}<div class="help">Clique sur un point de la carte pour l’ajouter seul, ou « Ajouter les résultats » pour tout ajouter comme marqueurs (exportés dans le GPX).</div>` : 'Aucun résultat dans ce rayon.');
      bAdd.style.display = res.length ? '' : 'none';
    } catch (e) { info('<span style="color:#b00">Recherche impossible : ' + esc(failReason(e) || e.message) + '</span>'); }
    busy = false; bGo.disabled = false;
  }
  function addAll() {
    if (!res || !res.length) return;
    const have = new Set((S.marks || []).map(x => x.lat.toFixed(5) + ',' + x.lon.toFixed(5))); let n = 0;
    for (const p of res) {
      if (have.has(p.lat.toFixed(5) + ',' + p.lon.toFixed(5))) continue;
      (S.marks = S.marks || []).push({ id: Date.now() + n, lat: p.lat, lon: p.lon, icon: p.key, name: p.name, desc: ((p.desc ? p.desc + ' · ' : '') + `à ${Math.round(p.d)} m de la trace, km ${kmFr(p.s)}`) }); n++;
    }
    candLayer.clearLayers(); renderMarks(); save(); closeModal(); modalOpts = null;
    toast(n + ' marqueur' + (n > 1 ? 's' : '') + ' ajouté' + (n > 1 ? 's' : '') + '.', 'ok');
  }
}
