const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1000, height: 1300 }, locale: 'fr-FR' })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^(?!file).*/, r => r.abort()); await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => window.__rb.regDialog()); await p.waitForTimeout(300);
  await p.check('input[data-k=dson]'); await p.selectOption('select[data-k=dsc]', 'special');
  const x = await p.evaluate(() => { const R = window.__rb; return R.regXml(R.regAll(R.regLoad()).find(q => q.id === 'nav')); }); console.log(x.split('\n').filter(l => l.includes('distance')).join('\n'));
  await p.evaluate(() => { document.querySelector('.rgtw').style.maxHeight = 'none'; }); await (await p.$('#modal')).screenshot({ path: '/tmp/apercu-distance-portee.png' }); console.log('erreurs', errs.join('|') || 0); await b.close(); })();
