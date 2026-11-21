const { chromium } = require('playwright'); const path = require('path'); const { execFileSync } = require('child_process'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1000, height: 760 }, locale: 'fr-FR' })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^(?!file).*/, r => r.abort()); await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => window.__rb.regDialog()); await p.waitForTimeout(300);
  await p.selectOption('select[data-k=spd]', 'pts');
  const x = await p.evaluate(() => { const R = window.__rb; return R.regXml(R.regAll(R.regLoad()).find(q => q.id === 'nav')); }); console.log(x);
  await p.screenshot({ path: '/tmp/reg-speed.png' }); console.log('erreurs', errs.join('|') || 0); await b.close(); })();
