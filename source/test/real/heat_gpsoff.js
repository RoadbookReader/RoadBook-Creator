const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), pg = await (await b.newContext({ viewport: { width: 1300, height: 800 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  // 600 points : une route goudronnée (lat 44.0, lon de 2.40 à 2.60) + une piste au nord (lat 44.02), 20 km/h, pas de 0,001° ≈ 80 m en 14 s
  const pts = []; const mk = (lat, lon0, n, dt, sec) => { let s = ''; for (let i = 0; i < n; i++) s += `<trkpt lat="${lat}" lon="${(lon0 + i * 0.001).toFixed(4)}"><time>2024-05-01T10:${String(Math.floor((i * dt) / 60)).padStart(2, '0')}:${String((i * dt) % 60).padStart(2, '0')}Z</time></trkpt>`; return s; };
  const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>${mk(44.0, 2.40, 150, 14)}</trkseg><trkseg>${mk(44.02, 2.40, 150, 14)}</trkseg></trk></gpx>`;
  await pg.route('**/api.openstreetmap.org/api/0.6/trackpoints**', r => r.fulfill({ status: 200, contentType: 'application/gpx+xml', headers: { 'access-control-allow-origin': '*' }, body: r.request().url().includes('page=0') ? gpx : '<gpx/>' }));
  await pg.route('**/interpreter', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ elements: [{ type: 'way', tags: { highway: 'secondary' }, geometry: [{ lat: 44.0, lon: 2.39 }, { lat: 44.0, lon: 2.56 }] }] }) }));
  await pg.route('**/status', r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'ok' }));
  await pg.goto('file:///home/claude/roadbook-creator/source/dist/generateur-roadbook.html');
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const m = document.querySelector('#map'); });
  await pg.selectOption('#heatSel', 'gpsoff');
  console.log('box visible', await pg.isVisible('#gpsOffBox'));
  await pg.evaluate(() => window.__rb && window.__rb.map && window.__rb.map.setView([44.01, 2.5], 12));
  const hasMap = await pg.evaluate(() => !!(window.__rb && window.__rb.map));
  console.log('map exposed', hasMap);
  await pg.click('#goLoad'); await pg.waitForTimeout(2500);
  console.log('MSG:', await pg.textContent('#goMsg'));
  console.log('canvas', await pg.evaluate(() => !!document.querySelector('canvas.leaflet-heatmap-layer')));
  await pg.screenshot({ path: '/tmp/gpsoff.png' });
  console.log('errors', errs);
  await b.close();
})();
