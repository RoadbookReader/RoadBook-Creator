const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const mobile of [true, false]) {
    const pg = await (await b.newContext({ viewport: { width: 1000, height: 700 }, hasTouch: mobile, isMobile: mobile })).newPage();
    await pg.addInitScript(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async d => { window.__shared = d.files.map(f => f.name + ':' + f.size); }; });
    await pg.route('**/api.openstreetmap.org/**', r => r.fulfill({ status: 200, contentType: 'application/gpx+xml', headers: { 'access-control-allow-origin': '*' }, body: '<gpx><trk><trkseg><trkpt lat="44.01" lon="2.5"/></trkseg></trk></gpx>' }));
    await pg.route('**/interpreter', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"elements":[]}' }));
    await pg.goto('file://' + __dirname + '/../../dist/generateur-roadbook.html'); await pg.waitForTimeout(1000);
    await pg.selectOption('#heatSel', 'gpsoff'); await pg.evaluate(() => window.__rb.map.setView([44.01, 2.5], 12));
    await pg.click('#goLoad'); await pg.waitForTimeout(1500);
    const dl = pg.waitForEvent('download', { timeout: 1500 }).then(() => 'téléchargement', () => 'pas de téléchargement');
    await pg.click('#goSave'); console.log(mobile ? 'TACTILE' : 'ORDINATEUR', '| partage:', await pg.evaluate(() => window.__shared), '|', await dl, '|', await pg.textContent('#goMsg'));
  }
  await b.close();
})();
