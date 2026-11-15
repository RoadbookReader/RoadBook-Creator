const { chromium } = require('playwright'), fs = require('fs');
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1000, height: 700 }, locale: 'fr-FR' })).newPage();
  await p.goto('file:///home/claude/roadbook-creator/source/dist/generateur-roadbook.html'); await p.waitForTimeout(800);
  await p.evaluate(t => window.__rb.loadText(t, 'T.gpx'), fs.readFileSync('/home/claude/scan/seg.gpx', 'utf8')); await p.waitForTimeout(900);
  await p.selectOption('#heatSel', 'gpsoff');
  await p.evaluate(() => {
    const goLoad = document.getElementById('goLoad');
    goLoad.insertAdjacentHTML('afterend', ' <button type="button" id="goTrace">🛣️ Charger autour de ma trace</button>');
    goLoad.parentElement.insertAdjacentHTML('afterend', '<div>Largeur du couloir : <input type="number" value="3" style="width:52px"> km de chaque côté</div>');
    document.getElementById('goMsg').textContent = 'Zone 4 sur 11… 18 250 points (pause entre deux zones pour ménager OSM).';
    document.getElementById('goCount').textContent = 'En mémoire : 18 250 points';
  });
  await p.waitForTimeout(300);
  const el = await p.$('#gpsOffBox'); await el.screenshot({ path: '/tmp/apercu_corridor.png' });
  await b.close();
})();
