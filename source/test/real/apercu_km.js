const { chromium } = require('playwright'), fs = require('fs');
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1400, height: 860 }, locale: 'fr-FR' })).newPage();
  await p.goto('file:///home/claude/roadbook-creator/source/dist/generateur-roadbook.html'); await p.waitForTimeout(800);
  await p.evaluate(t => window.__rb.loadText(t, 'T.gpx'), fs.readFileSync('/home/claude/scan/seg.gpx', 'utf8')); await p.waitForTimeout(900);
  await p.click('#bGen'); await p.waitForTimeout(400); await p.selectOption('#gsT', 'ign'); await p.selectOption('#gsN', 'ign'); await p.click('#modal .mbtn.primary');
  await p.waitForFunction(() => window.__rb.S.notes.length > 5, null, { timeout: 120000 }); await p.waitForTimeout(3000);
  await p.addStyleTag({ content: '#toast{display:none!important}' });
  await p.evaluate(() => { const m = document.querySelector('#modalBg'); m && m.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); await p.waitForTimeout(500);
  const cells = await p.$$('.k1'); console.log('cells', cells.length);
  let el = null; for (const c of cells) { if (await c.$('.par') && await c.$('.arr') && (await c.$eval('.par', x => x.textContent)) !== '0,00') { el = c; break; } } if (!el) el = cells[3];
  await el.scrollIntoViewIfNeeded();
  const info = await el.evaluate(e => { const r = e.getBoundingClientRect(), pr = e.parentElement.getBoundingClientRect(); return [r.x, r.y, r.width, r.height, pr.x, pr.y, pr.width, pr.height, e.parentElement.className, e.className]; }); console.log(info.join(' '));
  const clip = () => el.evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 }; });
  await p.screenshot({ path: '/tmp/km_avant.png', clip: await clip() });
  await p.addStyleTag({ content: '.k1 .bl{left:0;bottom:0;gap:1.2cqw}.k1 .par{border:0;border-top:.55cqw solid #000;border-right:.55cqw solid #000;font-size:5.6cqw;padding:.5cqw 1.8cqw .4cqw 1.4cqw;line-height:1.05}.k1 .arr{margin-bottom:1.3cqw}' });
  await p.waitForTimeout(300); await p.screenshot({ path: '/tmp/km_apres.png', clip: await clip() });
  await b.close();
})();
