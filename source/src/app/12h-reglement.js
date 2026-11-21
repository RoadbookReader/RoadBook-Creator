/* ---------- Règlements particuliers : profils de pénalités par type de WP, écrits dans le GPX (<rbgen:rules>) ---------- */
const REG_KEY = 'rbgen.reg';
const REG_FIM = { id: 'fim', name: 'FIM', builtin: true, desc: 'Règlement FIM 2026 appliqué par le lecteur : départ anticipé, CH (1 min par minute), CP manqué 15 min, temps maximum de spéciale…', res: 'time', k: 2, sp: { m: 'time', k: 1 }, spd: 'time', rows: {} };
const REG_TIMED = ['ch', 'dss', 'ass', 'dt', 'ft', 'dn', 'fn'];      // seuls ces types ont une heure : avance / retard possible
const REG_AR = [['none', 'Aucune'], ['early-time', 'Avance → temps'], ['late-time', 'Retard → temps'], ['both-time', 'Avance + retard → temps'], ['early-pts', 'Avance → points'], ['late-pts', 'Retard → points'], ['both-pts', 'Avance + retard → points']];
function regNum(v, d) { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) && x >= 0 ? x : (d || 0); }
function regLoad() {
  let o = null; try { o = JSON.parse(localStorage.getItem(REG_KEY) || 'null'); } catch (_) { }
  if (!o || !Array.isArray(o.list)) {
    const nav = { id: 'nav', name: 'Navigation', desc: '', res: 'pts', k: 2, sp: { m: 'none', k: 1 }, spd: 'none', rows: {} };
    o = { list: [nav], sel: 'nav' };
  }
  return o;
}
function regSave(o) { try { localStorage.setItem(REG_KEY, JSON.stringify(o)); } catch (_) { } }
function regAll(o) { return [REG_FIM].concat(o.list); }
function regRow(p, t) { return p.rows[t] || (p.rows[t] = { mu: 'none', mv: 0, ar: 'none', tol: 0 }); }
function regFromFim() {                                          // point de départ copiable : les lignes principales du règlement FIM
  const r = {}; r.cp = { mu: 'time', mv: 15, ar: 'none', tol: 0 }; r.ch = { mu: 'none', mv: 0, ar: 'both-time', tol: 0 }; r.ft = { mu: 'none', mv: 0, ar: 'late-time', tol: 0 };
  return r;
}
function regXml(p) {                                             // bloc GPX ; p = profil ou null
  if (!p) return '';
  const q = s => xmlEsc(String(s));
  if (p.builtin) return `\n      <rbgen:rules name="${q(p.name)}" builtin="fim"><rbgen:desc>${q(p.desc)}</rbgen:desc></rbgen:rules>`;
  const o = [`\n      <rbgen:rules name="${q(p.name)}" result="${p.res === 'time' ? 'time' : 'points'}" ptsPerMin="${regNum(p.k, 1)}">`];
  if ((p.desc || '').trim()) o.push(`        <rbgen:desc>${q(p.desc.trim())}</rbgen:desc>`);
  if (p.sp && p.sp.m !== 'none') o.push(`        <rbgen:special mode="${p.sp.m === 'pts' ? 'points' : 'time'}" ptsPerMin="${regNum(p.sp.k, 1)}"/>`);
  if (p.spd && p.spd !== 'none') o.push(`        <rbgen:speed mode="${p.spd === 'pts' ? 'points' : 'time'}"/>`);
  if (p.dist && p.dist.on && regNum(p.dist.x) > 0 && regNum(p.dist.y) > 0) o.push(`        <rbgen:distance points="${regNum(p.dist.x)}" per="${regNum(p.dist.y)}" unit="m"/>`);
  for (const [t] of WP_TYPES) {
    if (!t) continue;
    const r = p.rows[t]; const tm = REG_TIMED.includes(t), ar = tm && r ? r.ar : 'none';
    if (!r || (r.mu === 'none' && ar === 'none')) continue;
    let a = ` type="${t}"`;
    if (r.mu !== 'none') a += ` miss="${r.mu === 'pts' ? 'points' : 'time'}" value="${regNum(r.mv)}"`;
    if (ar !== 'none') a += ` timing="${ar}" tol="${regNum(r.tol)}"`;
    o.push(`        <rbgen:wp${a}/>`);
  }
  o.push('      </rbgen:rules>');
  return o.join('\n');
}
function regDialog() {
  const st = regLoad(); let cur = st.sel;
  const cp = () => regAll(st).find(p => p.id === cur) || REG_FIM;
  const sel = (n, v, opts) => `<select data-k="${n}">${opts.map(([a, b]) => `<option value="${a}"${a === v ? ' selected' : ''}>${b}</option>`).join('')}</select>`;
  const body = () => {
    const p = cp(), ro = !!p.builtin;
    const list = regAll(st).map(x => `<div class="rgit${x.id === cur ? ' on' : ''}" data-id="${x.id}">${esc(x.name)}${x.builtin ? ' <small>préréglé</small>' : ''}</div>`).join('');
    let ed;
    if (ro) ed = `<div class="fld"><label>Nom</label><div><b>FIM</b></div></div><p>${esc(p.desc)}</p><p style="color:#6b6558">Ce profil est fourni avec le générateur : il n’a pas de tableau. Le lecteur applique alors son règlement FIM. Pour partir d’une base, clique sur « Dupliquer ».</p>`;
    else {
      const rows = WP_TYPES.filter(t => t[0]).map(([t, l]) => { const r = regRow(p, t); return `<tr data-t="${t}"><td>${esc(l.split(' — ')[0])}</td><td>${sel('mu', r.mu, [['none', 'Aucune'], ['time', 'Temps'], ['pts', 'Points']])}</td><td>${r.mu === 'none' ? '' : `<input data-k="mv" size="4" value="${r.mv}"> ${r.mu === 'pts' ? 'pts' : 'min'}`}</td><td>${REG_TIMED.includes(t) ? sel('ar', r.ar, REG_AR) : '<span style="color:#8a8478">—</span>'}</td><td>${!REG_TIMED.includes(t) || r.ar === 'none' ? '' : `<input data-k="tol" size="3" value="${r.tol}"> min`}</td></tr>`; }).join('');
      ed = `<div style="display:flex;gap:10px;flex-wrap:wrap"><div class="fld" style="flex:1;min-width:140px"><label>Nom</label><input type="text" data-k="name" value="${esc(p.name)}"></div>
<div class="fld"><label>Résultat final</label>${sel('res', p.res, [['pts', 'Points'], ['time', 'Temps']])}</div>
<div class="fld"><label>Conversion</label><span>1 min = <input data-k="k" size="3" value="${p.k}"> pts</span></div></div>
<div class="fld"><label>Description (visible par les pilotes)</label><textarea data-k="desc">${esc(p.desc || '')}</textarea></div>
<div class="rgtw" style="max-height:34vh;overflow:auto"><table class="rgt"><tr><th>Type de WP</th><th>WP manqué</th><th>Valeur</th><th>Avance / retard</th><th>Tolérance</th></tr>${rows}</table></div>
<div class="rgsp"><b>Temps de spéciale</b> (chrono DSS → ASS)<br>Compté comme ${sel('spm', p.sp.m, [['none', 'Non compté'], ['time', 'Du temps'], ['pts', 'Des points']])}${p.sp.m === 'pts' ? ` &nbsp;1 min de spéciale = <input data-k="spk" size="3" value="${p.sp.k}"> pt` : ''}</div>
<div class="rgsp"><b>Excès de vitesse</b> (toutes les limites, par impulsion)<br>Compté comme ${sel('spd', p.spd || 'none', [['none', 'Non compté'], ['time', 'Du temps (barème FIM classique)'], ['pts', 'Des points (barème FIM converti)']])}<div style="color:#6b6558;font-size:12px;margin-top:3px">Barème FIM par impulsion : 1 à 5 km/h = 10 s ; 6 à 15 = 1 min ; 16 à 40 = 2 min ; plus de 40 = 6 min. En points, avec la conversion du profil (1 min = ${p.k} pts).</div></div>
<div class="rgsp"><b>Pénalité de distance</b><br><label><input type="checkbox" data-k="dson"${p.dist && p.dist.on ? ' checked' : ''}> Compter une pénalité de distance</label>${p.dist && p.dist.on ? `<div style="margin-top:4px"><input data-k="dx" size="4" value="${p.dist.x}"> points pour <input data-k="dy" size="5" value="${p.dist.y}"> m</div><div style="color:#6b6558;font-size:12px;margin-top:3px">Par tranche entamée : "X" points chaque fois que "Y" mètres sont commencés. En résultat « Temps », les points sont convertis avec la conversion du profil.</div>` : ''}</div>
<div style="color:#8a8478;margin-top:6px;font-size:12px">Un type sans ligne renseignée ne donne aucune pénalité.</div>`;
    }
    return `<div style="display:flex;gap:12px;flex-wrap:wrap"><div style="width:190px;flex:none"><div class="rgl">${list}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="mbtn sm" data-a="new">＋ Nouveau</button><button class="mbtn sm" data-a="dup">Dupliquer</button>${ro ? '' : '<button class="mbtn danger sm" data-a="del">Supprimer</button>'}</div></div><div style="flex:1;min-width:260px">${ed}</div></div>
<style>.rgit{padding:7px 9px;border:1px solid #bdb5a5;border-radius:6px;margin-bottom:4px;cursor:pointer}.rgit.on{background:var(--sand);font-weight:700}.rgit small{color:#8a8478}.rgt{width:100%;border-collapse:collapse;font-size:13px}.rgt th{text-align:left;color:#8a8478;font-weight:600}.rgt td{border-top:1px solid #ddd5c5;padding:3px 4px}.rgt select,.rgt input{font:inherit;padding:3px}.rgsp{margin-top:10px;padding:8px 10px;border:1px solid #bdb5a5;border-radius:6px}</style>`;
  };
  const m = openModal('Règlements particuliers', '<div id="rgB"></div>', [{ label: 'Fermer', cls: 'primary' }], { noEsc: false });
  m.classList.add('wide'); const B = m.querySelector('#rgB');
  const draw = () => {                                              // le tableau est reconstruit : on garde la position de défilement
    const sc = () => [m.querySelector('.mb'), B.querySelector('.rgtw')];
    const pos = sc().map(e => e ? e.scrollTop : 0);
    B.innerHTML = body();
    sc().forEach((e, i) => { if (e) e.scrollTop = pos[i]; });
  };
  const newId = () => 'p' + Date.now().toString(36);
  const commit = () => { st.sel = cur; regSave(st); };
  B.addEventListener('click', e => {
    const it = e.target.closest('.rgit'); if (it) { cur = it.dataset.id; commit(); draw(); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    const p = cp();
    if (a.dataset.a === 'new') { const n = { id: newId(), name: 'Nouveau règlement', desc: '', res: 'pts', k: 2, sp: { m: 'none', k: 1 }, spd: 'none', rows: {} }; st.list.push(n); cur = n.id; }
    else if (a.dataset.a === 'dup') { const n = JSON.parse(JSON.stringify(p.builtin ? { ...p, builtin: false, rows: regFromFim() } : p)); n.id = newId(); n.name = (p.name + ' (copie)').slice(0, 60); delete n.builtin; st.list.push(n); cur = n.id; }
    else if (a.dataset.a === 'del') { if (!confirm('Supprimer ce profil ?')) return; st.list = st.list.filter(x => x.id !== p.id); cur = st.list.length ? st.list[0].id : 'fim'; }
    commit(); draw();
  });
  B.addEventListener('change', e => {
    const el = e.target, k = el.dataset.k; if (!k) return;
    const p = cp(); if (p.builtin) return;
    const tr = el.closest('tr[data-t]');
    if (tr) { const r = regRow(p, tr.dataset.t); if (k === 'mu') r.mu = el.value; else if (k === 'ar') r.ar = el.value; else if (k === 'mv') r.mv = regNum(el.value); else if (k === 'tol') r.tol = regNum(el.value); }
    else if (k === 'name') p.name = el.value.trim().slice(0, 60) || 'Sans nom';
    else if (k === 'desc') p.desc = el.value;
    else if (k === 'res') p.res = el.value;
    else if (k === 'k') p.k = regNum(el.value, 1) || 1;
    else if (k === 'spm') p.sp.m = el.value;
    else if (k === 'spd') p.spd = el.value;
    else if (k === 'dson') p.dist = Object.assign(p.dist || { x: 1, y: 1000 }, { on: el.checked });
    else if (k === 'dx') p.dist = Object.assign(p.dist || { on: true, y: 1000 }, { x: regNum(el.value, 1) });
    else if (k === 'dy') p.dist = Object.assign(p.dist || { on: true, x: 1 }, { y: regNum(el.value, 1000) });
    else if (k === 'spk') p.sp.k = regNum(el.value, 1);
    commit(); if (tr || k === 'name' || k === 'spm' || k === 'k' || k === 'dson') draw();
  });
  draw();
}
