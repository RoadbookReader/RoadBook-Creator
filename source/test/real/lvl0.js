const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), pg = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + __dirname + '/../../dist/generateur-roadbook.html'); await pg.waitForTimeout(1200);
  await pg.selectOption('#heatSel', 'gpsoff');
  for (const id of ['baseLvl', 'heatLvl']) { await pg.$eval('#' + id, e => { e.value = 0; e.dispatchEvent(new Event('input', { bubbles: true })); }); }
  console.log('fond:', await pg.textContent('#baseLvlTxt'), '| couche:', await pg.textContent('#heatLvlTxt'), '| min:', await pg.getAttribute('#baseLvl', 'min'), await pg.getAttribute('#heatLvl', 'min'));
  await pg.reload(); await pg.waitForTimeout(1200);
  console.log('après rechargement — fond:', await pg.textContent('#baseLvlTxt'), '| couche:', await pg.textContent('#heatLvlTxt'));
  await pg.dblclick('#baseLvlTxt'); console.log('double-clic fond:', await pg.textContent('#baseLvlTxt'));
  console.log('erreurs', errs); await b.close();
})();
