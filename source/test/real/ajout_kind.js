const { chromium } = require('playwright'); const { execFileSync } = require('child_process');
(async () => { const b = await chromium.launch(), pg = await (await b.newContext({ viewport: { width: 1300, height: 800 }, locale: 'fr-FR' })).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:/, r => { const u = r.request().url(); if (!/data\.geopf\.fr/.test(u)) return r.abort(); try { const d = execFileSync('curl', ['-s', '--max-time', '25', u], { maxBuffer: 1 << 26 }); r.fulfill({ status: d.length ? 200 : 204, body: d, headers: { 'access-control-allow-origin': '*' } }); } catch (e) { r.abort(); } });
  await pg.goto('file://' + __dirname + '/../../dist/generateur-roadbook.html'); await pg.waitForTimeout(1000);
  await pg.selectOption('#layerSel', '__my'); await pg.waitForTimeout(300);
  await pg.fill('#mlName', 'Bâtiments IGN'); await pg.fill('#mlUrl', 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=BUILDINGS.BUILDINGS&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}');
  await pg.check('input[name=mlKind][value=over]'); await pg.screenshot({ path: '/tmp/dlg.png' });
  await pg.getByRole('button', { name: /Ajouter et afficher/ }).click(); await pg.waitForTimeout(600);
  console.log('curHeat:', await pg.inputValue('#heatSel'), '| fond:', await pg.inputValue('#layerSel'));
  console.log('base options perso:', await pg.$$eval('#layerSel optgroup[data-my] option', o => o.map(x => x.textContent)));
  console.log('heat options perso:', await pg.$$eval('#heatSel optgroup[data-my] option', o => o.map(x => x.textContent)));
  // un fond Classique, puis suppression de la couche
  await pg.selectOption('#heatSel', '__my'); await pg.waitForTimeout(300); await pg.fill('#mlName', 'Classique'); await pg.fill('#mlUrl', 'https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/classique.json'); await pg.getByRole('button', { name: /Ajouter et afficher/ }).click(); await pg.waitForTimeout(500);
  console.log('après fond: fond=', await pg.inputValue('#layerSel'), '| couche=', await pg.inputValue('#heatSel'));
  await pg.evaluate(() => window.__rb.map.setView([42.79, 0.59], 16, { animate: false })); await pg.waitForTimeout(12000);
  await pg.screenshot({ path: '/tmp/kind_map.png', clip: { x: 0, y: 60, width: 700, height: 500 } });
  await pg.reload(); await pg.waitForTimeout(1000); console.log('après rechargement: couche=', await pg.inputValue('#heatSel'), '| fond=', await pg.inputValue('#layerSel'));
  console.log('erreurs', errs); await b.close(); })();
