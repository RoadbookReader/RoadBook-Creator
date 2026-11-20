const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'); const { execFile } = require('child_process');
const gpx = fs.readdirSync('/mnt/user-data/uploads').filter(f => /TOURANGELLE/.test(f)).map(f => '/mnt/user-data/uploads/' + f)[0];
const curl = u => new Promise(res => { const t0 = Date.now(); execFile('curl', ['-s', '--max-time', '100', u], { maxBuffer: 1 << 29, encoding: 'buffer' }, (e, out) => res({ out, ms: Date.now() - t0, e })); });
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1000, height: 900 }, locale: 'fr-FR' })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  let n = 0; const log = [];
  await p.route(/^https?:/, async r => { const u = r.request().url(); if (!/data\.geopf\.fr\/wfs/.test(u)) return r.abort(); const idx = ++n; const { out, ms } = await curl(u);
    const lay = (u.match(/TYPENAMES=BDTOPO_V3:(\w+)/) || [])[1], bb = decodeURIComponent((u.match(/BBOX=([^&]+)/) || [])[1] || '').split(',').slice(0, 4).join(','), st = (u.match(/STARTINDEX=(\d+)/) || [])[1];
    const ok = out.slice(0, 7).toString() === '{"type"'; log.push(`${idx} ${lay} ${bb} st=${st} ${ms}ms ${out.length}o ${ok ? 'ok' : 'BAD:' + out.slice(0, 40)}`); if (ms > 15000 || !ok) console.log(log[log.length - 1]);
    r.fulfill({ status: out.length ? 200 : 504, body: out, headers: { 'access-control-allow-origin': '*' } }); });
  await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.waitForTimeout(500);
  await p.evaluate(t => window.__rb.loadText(t, 't.gpx'), fs.readFileSync(gpx, 'utf8')); await p.waitForTimeout(800);
  await p.click('#bGen'); await p.waitForTimeout(300); await p.selectOption('#gsT', 'ign'); await p.selectOption('#gsN', 'ign'); await p.click('#modal .mbtn.primary');
  const t0 = Date.now(); while (Date.now() - t0 < 540000) { await p.waitForTimeout(5000); const m = await p.evaluate(() => (document.querySelector('#modal')||{}).innerText || ''); const mm = m.match(/(\d+)\/(\d+)/); console.log(Math.round((Date.now() - t0) / 1000) + 's', mm ? mm[0] : m.slice(0, 40).replace(/\n/g, ' '), 'req', n); if (/rapport/i.test(m)) break; }
  fs.writeFileSync('/tmp/ignslow.log', log.join('\n')); await b.close(); })();
