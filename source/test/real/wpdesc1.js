const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'); const { execFileSync } = require('child_process');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 900, height: 900 }, locale: 'fr-FR' })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^(?!file).*/, r => r.abort());
  await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(t => window.__rb.loadText(t, 'a.gpx'), fs.readFileSync(path.join(__dirname, 'andorra.gpx'), 'utf8')); await p.waitForTimeout(600);
  await p.evaluate(() => { const R = window.__rb, mk = (i, s, wp) => ({ id: 'n' + i, s, lat: R.S.ll[i * 10][0], lon: R.S.ll[i * 10][1], text: 't', kind: 'info', wp, tulip: null }); R.S.notes = [mk(1, 500, { type: 'dss', name: 'Départ', desc: 'Énigme 1 :\nQuel est le « nom » du col ? <A&B> ]]> fin' }), mk(2, 900, { type: 'ch', name: 'CH1', desc: 'Va à gauche.' }), mk(3, 1200, { type: 'wpv' })]; R.renderAll && R.renderAll(); });
  // éditeur : champ nom visible pour un CH, description présente
  await p.evaluate(() => window.__rb.editNote('n2')); await p.waitForTimeout(600); console.log('modal', (await p.innerText('#modal')).slice(0, 60).replace(/\n/g, ' '), errs.join('|')); await p.click('#enTabs button[data-t="2"]');
  console.log('CH : nom visible', await p.evaluate(() => getComputedStyle(document.getElementById('eWpRad')).display !== 'none'), '| description :', await p.evaluate(() => document.getElementById('eWdesc').value)); await p.screenshot({ path: '/tmp/apercu-wpdesc.png' });
  await p.evaluate(() => { document.getElementById('eWdesc').value = 'Va à gauche.\n\nPuis lis la plaque.'; }); await p.click('#modal >> text=Enregistrer'); await p.waitForTimeout(300);
  console.log('description enregistrée :', JSON.stringify(await p.evaluate(() => window.__rb.S.notes[1].wp.desc)));
  console.log('case cochée (CH avec texte) :', await p.evaluate(() => document.getElementById('eWdescOn').checked), '| zone de texte visible :', await p.evaluate(() => getComputedStyle(document.getElementById('eWdescT')).display !== 'none'));
  await p.evaluate(() => window.__rb.editNote('n3')); await p.waitForTimeout(400); await p.click('#enTabs button[data-t="2"]');
  console.log('WPV sans texte : case cochée', await p.evaluate(() => document.getElementById('eWdescOn').checked), '| zone visible', await p.evaluate(() => getComputedStyle(document.getElementById('eWdescT')).display !== 'none'));
  await p.click('#eWdescOn'); await p.fill('#eWdesc', 'Indice du WPV'); await p.screenshot({ path: '/tmp/apercu-wpdesc2.png' }); await p.click('#modal >> text=Enregistrer'); await p.waitForTimeout(300);
  await p.evaluate(() => window.__rb.editNote('n1')); await p.waitForTimeout(400); await p.click('#enTabs button[data-t="2"]'); await p.click('#eWdescOn'); await p.click('#modal >> text=Enregistrer'); await p.waitForTimeout(300);
  console.log('DSS décoché : texte gardé', await p.evaluate(() => !!window.__rb.S.notes[0].wp.desc), 'descOff', await p.evaluate(() => window.__rb.S.notes[0].wp.descOff));
  for (const [mode, opts] of [['full', {}], ['orient', {}]]) {
    const gpx = await p.evaluate(async ([m, o]) => await window.__rb.buildGPX(null, m, o), [mode, opts]); fs.writeFileSync('/tmp/wpd.gpx', gpx);
    let ok = 'ok'; try { execFileSync('xmllint', ['--noout', '/tmp/wpd.gpx']); } catch (e) { ok = 'XML INVALIDE ' + String(e.stderr || e.message).slice(0, 200); }
    console.log(mode, JSON.stringify(opts), '→ balises wpdesc (attendu 2 : CH et WPV, pas le DSS décoché) :', (gpx.match(/<rbgen:wpdesc>/g) || []).length, '| XML', ok);
  }
  const gpx = await p.evaluate(async () => await window.__rb.buildGPX(null, 'orient')); const x = gpx.match(/<rbgen:wpdesc>[\s\S]*?<\/rbgen:wpdesc>/)[0]; console.log(x.replace(/\n/g, '\\n'));
  console.log('erreurs', errs.join('|') || 0); await b.close(); })();
