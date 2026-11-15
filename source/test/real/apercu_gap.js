const { chromium } = require('playwright'), fs = require('fs');
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1100, height: 720 }, locale: 'fr-FR' })).newPage();
  await p.goto('file:///home/claude/roadbook-creator/source/dist/generateur-roadbook.html'); await p.waitForTimeout(800);
  await p.evaluate(t => window.__rb.loadText(t, 'T.gpx'), fs.readFileSync(__dirname + '/data/seg.gpx', 'utf8')); await p.waitForTimeout(900);
  await p.selectOption('#layerSel', 'planign').catch(() => { }); await p.waitForTimeout(1500);
  await p.selectOption('#heatSel', 'gpsoff');
  await p.evaluate(() => {
    const rb = window.__rb, ll = rb.S.ll, m = rb.map;
    const seg = (a, b, o) => L.polyline(ll.slice(a, b), o).addTo(m);
    const n = ll.length;
    seg(Math.floor(n * .30), Math.floor(n * .38), { color: '#d4007a', weight: 6, opacity: .9 });
    seg(Math.floor(n * .62), Math.floor(n * .66), { color: '#ff8a00', weight: 5, dashArray: '8 7', opacity: .95 });
    seg(Math.floor(n * .82), Math.floor(n * .88), { color: '#888', weight: 5, dashArray: '2 8', opacity: .95 });
    document.getElementById('goLoad').parentElement.insertAdjacentHTML('afterend', '<div><button type="button">🔎 Chemins non cartographiés</button></div>');
    document.getElementById('goCount').insertAdjacentHTML('afterend', `<div class="gomsg" style="opacity:1;margin-top:6px"><b>3 passages hors des chemins connus :</b><br>
      <span style="color:#d4007a">━</span> 1. km 7,4 → 9,1 (1,7 km) : <b>fréquenté</b> (86 % de la trace couverte), chemin probablement non cartographié<br>
      <span style="color:#ff8a00">╍</span> 2. km 15,6 → 16,2 (0,6 km) : aucune trace trouvée<br>
      <span style="color:#888">┅</span> 3. km 20,5 → 22,0 (1,5 km) : zone non chargée (clique « Charger autour de ma trace »)</div>`);
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/apercu_gap.png' });
  await b.close();
})();
