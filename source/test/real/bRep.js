const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); for (const [w, name] of [[1280, 'pc'], [420, 'tel']]) { const pg = await (await b.newContext({ viewport: { width: w, height: w > 600 ? 500 : 800 }, locale: 'fr-FR' })).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + __dirname + '/../../dist/generateur-roadbook.html'); await pg.waitForTimeout(700);
  await pg.evaluate(() => localStorage.setItem('rbgen.report', JSON.stringify({ title: 'Roadbook généré — rapport', html: '<p>Rapport de test</p>' }))); await pg.reload(); await pg.waitForTimeout(700);
  await pg.screenshot({ path: `/tmp/rep_${name}.png`, clip: { x: 0, y: 0, width: w, height: 200 } });
  await pg.click('#bRep'); await pg.waitForTimeout(300); console.log(name, await pg.evaluate(() => (document.querySelector('#modal h2') || {}).innerText), errs); }
  await b.close(); })();
