const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^(?!file).*/, r => r.abort());
  await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(t => window.__rb.loadText(t, 'a.gpx'), fs.readFileSync(path.join(__dirname, 'andorra.gpx'), 'utf8')); await p.waitForTimeout(600);
  await p.evaluate(() => { const R = window.__rb, mk = (i, s, wp) => ({ id: 'n' + i, s, lat: R.S.ll[i * 10][0], lon: R.S.ll[i * 10][1], text: 't', kind: 'info', wp, tulip: null }); R.S.notes = [mk(1, 500, { type: 'dss', name: 'Départ <A&B>' }), mk(2, 900, { type: 'dn', name: 'Neutra' }), mk(3, 1200, { type: 'wpv' }), mk(4, 1500, { type: 'ch', name: 'CH1' }), mk(5, 1800, { type: 'dt', name: 'Chrono' }), mk(6, 2100, { type: 'ch' })]; R.renderAll && R.renderAll(); });
  const gpx = await p.evaluate(async () => await window.__rb.buildGPX());
  console.log((gpx.match(/<openrally:(?:dss|dn|wpv|checkpoint|dt)[^>]*\/>/g) || []).join('\n'), '\nerreurs', errs.join('|') || 0); await b.close(); })();
