const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), pg = await (await b.newContext({ viewport: { width: 1700, height: 820 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const { execFileSync } = require('child_process'); const cache = {};
  await pg.route(/^https?:/, r => { const u = r.request().url(); if (!/data\.geopf\.fr/.test(u)) return r.abort(); try { const b = cache[u] || (cache[u] = execFileSync('curl', ['-s', '--max-time', '25', u], { maxBuffer: 1 << 26 })); r.fulfill({ status: b.length ? 200 : 204, body: b, headers: { 'access-control-allow-origin': '*', 'content-type': /json/.test(u) ? 'application/json' : 'application/octet-stream' } }); } catch (e) { r.abort(); } });
  await pg.goto('file://' + __dirname + '/../../dist/generateur-roadbook.html'); await pg.waitForTimeout(1200);
  const U = 'https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/classique.json';
  await pg.evaluate(u => localStorage.setItem('rbgen.myLayers', JSON.stringify([{ id: 'v1', name: 'Plan IGN Classique', url: u, max: 18, type: 'style' }])), U);
  await pg.reload(); await pg.waitForTimeout(1200); await pg.selectOption('#layerSel', 'c:v1');
  const z = +(process.argv[3] || 14), [la, lo] = (process.argv[2] || '42.95,0.1').split(',').map(Number);
  await pg.evaluate(([a, o, z]) => window.__rb.map.setView([a, o], z, { animate: false }), [la, lo, z]);
  await pg.waitForTimeout(16000);
  await pg.screenshot({ path: process.argv[4] || '/tmp/vec1.png', clip: { x: 0, y: 60, width: 880, height: 740 } });
  console.log('erreurs', errs.slice(0, 5)); await b.close();
})();
