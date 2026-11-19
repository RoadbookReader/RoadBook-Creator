const { chromium } = require('playwright'); const { execFileSync } = require('child_process');
(async () => { const b = await chromium.launch(), pg = await (await b.newContext({ viewport: { width: 1700, height: 820 } })).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:/, r => { const u = r.request().url(); if (!/data\.geopf\.fr/.test(u)) return r.abort(); try { const d = execFileSync('curl', ['-s', '--max-time', '25', u], { maxBuffer: 1 << 26 }); r.fulfill({ status: d.length ? 200 : 204, body: d, headers: { 'access-control-allow-origin': '*' } }); } catch (e) { r.abort(); } });
  await pg.goto('file://' + __dirname + '/../../dist/generateur-roadbook.html'); await pg.waitForTimeout(1000);
  await pg.selectOption('#layerSel', process.argv[2] || 'ortho'); await pg.selectOption('#heatSel', 'cadastre');
  await pg.evaluate(() => window.__rb.map.setView([45.5646, 5.9178], 17, { animate: false })); await pg.waitForTimeout(9000);
  console.log('options:', await pg.$$eval('#heatSel option', o => o.map(x => x.textContent).filter(t => /adastr/.test(t))), 'niveau:', await pg.textContent('#heatLvlTxt'));
  await pg.screenshot({ path: '/tmp/cadastre.png', clip: { x: 0, y: 60, width: 880, height: 740 } }); console.log('erreurs', errs); await b.close(); })();
