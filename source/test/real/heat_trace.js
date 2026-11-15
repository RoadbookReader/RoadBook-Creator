const { chromium } = require('playwright'), fs = require('fs');
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1300, height: 800 }, locale: 'fr-FR' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); let calls = 0;
  await p.route('**/api.openstreetmap.org/api/0.6/trackpoints**', r => {
    const u = new URL(r.request().url()); const [w, s, e, n] = u.searchParams.get('bbox').split(',').map(Number); calls++;
    let t = ''; if (u.searchParams.get('page') === '0') for (let i = 0; i < 20; i++) t += `<trkpt lat="${(s + (n - s) / 2).toFixed(5)}" lon="${(w + (e - w) * (i / 21) + 0.001).toFixed(5)}"><time>2024-05-01T10:00:${String(i * 14 % 60).padStart(2, '0')}Z</time></trkpt>`;
    r.fulfill({ status: 200, contentType: 'application/gpx+xml', headers: { 'access-control-allow-origin': '*' }, body: `<gpx><trk><trkseg>${t}</trkseg></trk></gpx>` });
  });
  await p.route('**/interpreter', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ elements: [] }) }));
  await p.route('**/status', r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'ok' }));
  await p.goto('file:///home/claude/roadbook-creator/source/dist/generateur-roadbook.html'); await p.waitForTimeout(1000);
  await p.selectOption('#heatSel', 'gpsoff');
  await p.click('#goTrace'); console.log('sans trace:', await p.textContent('#goMsg'));
  await p.evaluate(t => window.__rb.loadText(t, 'T.gpx'), fs.readFileSync('/home/claude/scan/seg.gpx', 'utf8')); await p.waitForTimeout(900);
  await p.click('#goTrace'); await p.waitForTimeout(2600); console.log('en cours:', await p.textContent('#goMsg'), '| bouton:', await p.textContent('#goTrace'));
  await p.click('#goTrace'); await p.waitForTimeout(1800); console.log('arrêt:', await p.textContent('#goMsg'));
  await p.click('#goTrace'); await p.waitForFunction(() => /Terminé/.test(document.getElementById('goMsg').textContent), null, { timeout: 120000 });
  console.log('fin:', await p.textContent('#goMsg'), '|', await p.textContent('#goCount'), '| appels API:', calls);
  console.log('erreurs', errs); await b.close();
})();
