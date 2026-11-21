const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch();
  for (const [loc, out] of [['fr-FR', '../../src/manuel/img/60_reglements.png'], ['en-US', '../../src/manuel/img/en/60_reglements.png']]) {
    const p = await (await b.newContext({ viewport: { width: 1000, height: 1300 }, locale: loc })).newPage();
    await p.route(/^(?!file).*/, r => r.abort()); await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.evaluate(() => window.__rb.regDialog()); await p.waitForTimeout(300);
    const row = t => `tr[data-t="${t}"]`;
    await p.fill('textarea[data-k=desc]', loc === 'fr-FR' ? 'Épreuve d’orientation : chaque WP manqué coûte des points.' : 'Orienteering event: every missed WP costs points.');
    await p.selectOption(row('dss') + ' select[data-k=mu]', 'pts'); await p.fill(row('dss') + ' input[data-k=mv]', '20'); await p.selectOption(row('dss') + ' select[data-k=ar]', 'late-pts'); await p.fill(row('dss') + ' input[data-k=tol]', '1'); await p.press(row('dss') + ' input[data-k=tol]', 'Tab');
    await p.selectOption(row('ch') + ' select[data-k=ar]', 'both-pts'); await p.selectOption(row('cp') + ' select[data-k=mu]', 'time'); await p.fill(row('cp') + ' input[data-k=mv]', '15'); await p.press(row('cp') + ' input[data-k=mv]', 'Tab');
    await p.selectOption('select[data-k=spd]', 'pts'); await p.check('input[data-k=dson]'); await p.fill('input[data-k=dx]', '3'); await p.fill('input[data-k=dy]', '2500'); await p.press('input[data-k=dy]', 'Tab');
    await p.evaluate(() => { const w = document.querySelector('.rgtw'); w.style.maxHeight = 'none'; });
    await p.waitForTimeout(200);
    const m = await p.$('#modal'); await m.screenshot({ path: path.join(__dirname, out) });
  } await b.close(); })();
