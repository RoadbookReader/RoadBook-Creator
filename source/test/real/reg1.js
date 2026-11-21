const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'); const { execFileSync } = require('child_process');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1000, height: 760 }, locale: 'fr-FR' })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^(?!file).*/, r => r.abort());
  await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(t => window.__rb.loadText(t, 'a.gpx'), fs.readFileSync(path.join(__dirname, 'andorra.gpx'), 'utf8')); await p.waitForTimeout(600);
  await p.evaluate(() => { const R = window.__rb, mk = (i, s, wp) => ({ id: 'n' + i, s, lat: R.S.ll[i * 10][0], lon: R.S.ll[i * 10][1], text: 't', kind: 'info', wp, tulip: null }); R.S.notes = [mk(1, 500, { type: 'dss', name: 'D' }), mk(2, 900, { type: 'ch', name: 'CH1' })]; R.renderAll && R.renderAll(); });
  await p.evaluate(() => window.__rb.regDialog()); await p.waitForTimeout(300);
  console.log('profils', await p.$$eval('.rgit', e => e.map(x => x.textContent.trim())));
  // édite Navigation : DSS manqué 20 pts, retard->pts tol 1 ; CH 10 pts ; spéciale en points
  const row = t => `tr[data-t="${t}"]`;
  await p.selectOption(row('dss') + ' select[data-k=mu]', 'pts'); await p.fill(row('dss') + ' input[data-k=mv]', '20'); await p.selectOption(row('dss') + ' select[data-k=ar]', 'late-pts'); await p.fill(row('dss') + ' input[data-k=tol]', '1');
  await p.selectOption(row('cp') + ' select[data-k=mu]', 'time'); await p.fill(row('cp') + ' input[data-k=mv]', '15');
  await p.selectOption('select[data-k=spm]', 'pts'); await p.fill('input[data-k=spk]', '1,5'); await p.fill('textarea[data-k=desc]', 'Épreuve <orientation> & co');
  await p.screenshot({ path: '/tmp/reg-test.png' });
  // duplication FIM
  await p.click('.rgit[data-id=fim]'); await p.click('[data-a=dup]'); console.log('après dup', await p.$$eval('.rgit', e => e.map(x => x.textContent.trim())), 'cp:', await p.inputValue(row('cp') + ' input[data-k=mv]'));
  await p.click('.rgit[data-id=nav]');
  const st = await p.evaluate(() => localStorage.getItem('rbgen.reg')); console.log('stocké', st.length, 'o');
  await p.evaluate(() => { document.getElementById('modalBg') && 0; }); await p.keyboard.press('Escape');
  for (const id of ['nav', 'fim', '']) {
    const gpx = await p.evaluate(async i => { const R = window.__rb; return await R.buildGPX(null, 'full', { reg: R.regAll(R.regLoad()).find(x => x.id === i) || null }); }, id); fs.writeFileSync('/tmp/reg.gpx', gpx);
    let ok = 'ok'; try { execFileSync('xmllint', ['--noout', '/tmp/reg.gpx']); } catch (e) { ok = 'XML INVALIDE ' + String(e.stderr || e.message).slice(0, 200); }
    console.log(JSON.stringify(id), 'XML', ok); const m = gpx.match(/<rbgen:rules[\s\S]*?<\/rbgen:rules>/); console.log(m ? m[0] : '(aucun bloc)');
  }
  console.log('erreurs', errs.join('|') || 0); await b.close(); })();
