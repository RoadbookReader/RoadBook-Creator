const { chromium } = require('playwright'), fs = require('fs');
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1300, height: 800 }, locale: 'fr-FR' })).newPage();
  const errs = []; p.on('pageerror', e => { if (!/LatLng/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + __dirname + '/../../dist/generateur-roadbook.html'); await p.waitForTimeout(800);
  await p.selectOption('#heatSel', 'gpsoff');
  await p.click('#goGapBtn'); console.log('sans trace:', await p.textContent('#goGaps'));
  await p.evaluate(t => window.__rb.loadText(t, 'T.gpx'), fs.readFileSync(__dirname + '/data/offroad.gpx', 'utf8')); await p.waitForTimeout(900);
  await p.click('#goGapBtn'); console.log('sans réseau:', await p.textContent('#goGaps'));
  await p.click('#bGen'); await p.waitForTimeout(400); await p.selectOption('#gsT', 'ign'); await p.selectOption('#gsN', 'ign'); await p.click('#modal .mbtn.primary');
  await p.waitForFunction(() => window.__rb.S.notes.length > 5, null, { timeout: 120000 }); await p.waitForTimeout(3000);
  await p.evaluate(() => { const m = document.querySelector('#modalBg'); m && m.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); await p.waitForTimeout(400);
  await p.click('#goGapBtn'); console.log('A (heatmap vide) :\n' + (await p.innerText('#goGaps')));
  const ll = await p.evaluate(() => window.__rb.S.ll);
  const w = Math.min(...ll.map(x => x[1])) - .01, s = Math.min(...ll.map(x => x[0])) - .01, e = Math.max(...ll.map(x => x[1])) + .01, n = Math.max(...ll.map(x => x[0])) + .01;
  const dense = []; for (let i = 1; i < ll.length; i++) { for (let k = 0; k < 10; k++) dense.push(+(ll[i - 1][0] + (ll[i][0] - ll[i - 1][0]) * k / 10 + 0.00005).toFixed(5), +(ll[i - 1][1] + (ll[i][1] - ll[i - 1][1]) * k / 10 + 0.00005).toFixed(5)); }
  const imp = async (zones, pts) => { fs.writeFileSync('/tmp/hm_gap.json', JSON.stringify({ type: 'rb-heatmap-osm', v: 1, zones, pts })); await p.setInputFiles('#goFile', '/tmp/hm_gap.json'); await p.waitForTimeout(700); await p.click('#goGapBtn'); };
  await imp([[w, s, e, n]], dense); console.log('B (trace entière en heatmap) :\n' + (await p.innerText('#goGaps')));
  await imp([[w, s, e, n]], []); console.log('C (zone chargée, aucun point) :\n' + (await p.innerText('#goGaps')));
  await p.screenshot({ path: '/tmp/gaps_test.png' });
  console.log('erreurs', errs); await b.close();
})();
