const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'); const { execFileSync } = require('child_process');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1000, height: 900 }, locale: 'fr-FR' })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https?:/, r => { const u = r.request().url(); if (!/data\.geopf\.fr/.test(u)) return r.abort(); try { const d = execFileSync('curl', ['-s', '--max-time', '90', u], { maxBuffer: 1 << 28 }); r.fulfill({ status: d.length ? 200 : 204, body: d, headers: { 'access-control-allow-origin': '*' } }); } catch (e) { r.abort(); } });
  await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.waitForTimeout(500);
  await p.evaluate(t => window.__rb.loadText(t, 't.gpx'), fs.readFileSync(process.argv[2] || '/home/claude/scan/seg.gpx', 'utf8')); await p.waitForTimeout(500);
  await p.click('#bGen'); await p.waitForTimeout(300); await p.selectOption('#gsT', 'ign'); await p.selectOption('#gsN', 'ign'); await p.click('#modal .mbtn.primary');
  await p.waitForSelector('#modal h2:has-text("rapport")', { timeout: 280000 });
  console.log((await p.innerText('#modal')).replace(/\n+/g, ' | ').slice(0, 1500));
  await p.screenshot({ path: '/tmp/parc_rapport.png' }); await p.click('#modal .mbtn.primary'); await p.waitForTimeout(800); await p.screenshot({ path: '/tmp/parc_carte.png' }); console.log('erreurs', errs.join('|') || 0); await b.close(); })();
