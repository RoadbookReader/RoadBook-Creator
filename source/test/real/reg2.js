const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1000, height: 760 }, locale: 'fr-FR' })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^(?!file).*/, r => r.abort());
  await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => window.__rb.regDialog()); await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('.rgtw').scrollTop = 200; }); const a = await p.evaluate(() => document.querySelector('.rgtw').scrollTop);
  await p.selectOption('tr[data-t="ch"] select[data-k=mu]', 'pts'); await p.selectOption('tr[data-t="dss"] select[data-k=ar]', 'both-pts');
  const c = await p.evaluate(() => document.querySelector('.rgtw').scrollTop); console.log('défilement avant', a, 'après', c, 'erreurs', errs.join('|') || 0); await b.close(); })();
