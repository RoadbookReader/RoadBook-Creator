const { chromium } = require('playwright'); const { execFileSync } = require('child_process'); const fs = require('fs');
(async () => { const b = await chromium.launch(), pg = await (await b.newContext({ viewport: { width: 1500, height: 850 }, locale: 'fr-FR' })).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const cache = {}; await pg.route(/^https?:/, r => { const u = r.request().url(); if (!/data\.geopf\.fr/.test(u)) return r.abort(); try { const d = cache[u] || (cache[u] = execFileSync('curl', ['-s', '--max-time', '40', u], { maxBuffer: 1 << 27 })); r.fulfill({ status: d.length ? 200 : 204, body: d, headers: { 'access-control-allow-origin': '*' } }); } catch (e) { r.abort(); } });
  await pg.goto('file://' + __dirname + '/../../dist/generateur-roadbook.html'); await pg.waitForTimeout(1000);
  const pts = [...fs.readFileSync(__dirname + '/data/seg.gpx', 'utf8').matchAll(/lat="([\d.]+)" lon="([\d.]+)"/g)].map(m => [+m[1], +m[2]]);
  await pg.evaluate(() => { window.__rb.S.settings.data = 'ign'; });
  await pg.evaluate(([a, o]) => window.__rb.map.setView([a, o], 17, { animate: false }), pts[Math.floor(pts.length / 2)]); await pg.waitForTimeout(800);
  await pg.click('#bDraw'); await pg.waitForTimeout(300); await pg.selectOption('#routeMode', 'line'); await pg.check('#liveChk');
  const click = async ll => { const xy = await pg.evaluate(l => { const p = window.__rb.map.latLngToContainerPoint(l), r = window.__rb.map.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }, ll); await pg.mouse.click(xy[0], xy[1]); await pg.waitForTimeout(400); };
  const idx = Array.from({ length: 9 }, (_, k) => k * 4); for (const i of idx) { await pg.evaluate(l => window.__rb.map.panTo(l, { animate: false }), pts[i]); await click(pts[i]); }
  const st = async n => { for (let k = 0; k < 90; k++) { const t = await pg.textContent('#liveSt'); if (/✓|⚠/.test(t)) return t; await pg.waitForTimeout(1000); } return 'timeout: ' + await pg.textContent('#liveSt'); };
  console.log('1) après 5 points :', await st(), '| notes:', await pg.evaluate(() => window.__rb.S.notes.length));
  for (const i of [36, 40, 44, 48, 52, pts.length - 1]) { await pg.evaluate(l => window.__rb.map.panTo(l, { animate: false }), pts[i]); await click(pts[i]); }
  await pg.waitForTimeout(2500); console.log('   pendant:', await pg.textContent('#liveSt'));
  console.log('2) après 7 points :', await st(), '| notes:', await pg.evaluate(() => window.__rb.S.notes.length));
  await pg.screenshot({ path: '/tmp/direct.png' });
  await pg.click('#bDrawEnd'); await pg.getByRole('button', { name: /Générer le roadbook/ }).first().click(); await pg.waitForTimeout(500);
  await pg.getByRole('button', { name: /^Générer$/ }).click(); for (let k = 0; k < 90 && !(await pg.$('text=rapport')); k++) await pg.waitForTimeout(1000);
  console.log('3) génération complète : notes', await pg.evaluate(() => window.__rb.S.notes.length), '| types', await pg.evaluate(() => window.__rb.S.notes.map(n => n.kind).join(','))); console.log('erreurs', errs); await b.close(); })();
