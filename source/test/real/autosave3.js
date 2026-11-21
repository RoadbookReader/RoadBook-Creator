const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const init = () => { const files = window.__files = window.__files || {}; const mtimes = window.__mt = window.__mt || {};
  window.__mk = name => ({ name, kind: 'directory', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFileHandle: async (n, o) => { if (!(n in files)) { if (!(o && o.create)) throw new Error('NF'); files[n] = ''; } return { kind: 'file', createWritable: async () => { let buf = ''; return { write: async t => { buf = t; }, close: async () => { files[n] = buf; mtimes[n] = Date.now(); } }; }, getFile: async () => ({ text: async () => files[n], lastModified: mtimes[n] || Date.now(), name: n }) }; },
    entries: async function* () { for (const n of Object.keys(files)) yield [n, { kind: 'file', getFile: async () => new File([files[n]], n, { lastModified: window.__mt[n] || Date.now() }) }]; } });
  window.showDirectoryPicker = async () => window.__mk('D'); };
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 900, height: 700 }, locale: 'fr-FR' })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(init); await p.route(/^(?!file).*/, r => r.abort());
  await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-act=prefs]').click()); await p.waitForTimeout(300);
  console.log('case projet présente (avant dossier) :', await p.evaluate(() => !!document.getElementById('asProj')));
  await p.click('#asPick'); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('[data-act=prefs]').click()); await p.waitForTimeout(300);
  console.log('case projet cochée :', await p.evaluate(() => document.getElementById('asProj').checked)); await p.screenshot({ path: '/tmp/apercu-auto-3.png' }); await p.keyboard.press('Escape'); await p.evaluate(() => closeModal && 0).catch(() => {});
  await p.evaluate(t => window.__rb.loadText(t, 'seg.gpx'), fs.readFileSync('/home/claude/scan/seg.gpx', 'utf8')); await p.waitForTimeout(6500);
  console.log('fichiers :', await p.evaluate(() => Object.keys(window.__files)));
  const f = await p.evaluate(() => { const k = Object.keys(window.__files).find(n => /\.roadbook\.json$/.test(n)); const o = k && JSON.parse(window.__files[k]); return o && { ll: o.ll.length, v: o.v }; }); console.log('projet écrit :', JSON.stringify(f));
  // navigateur sans projet : proposition d'ouverture
  const p2 = await (await b.newContext({ viewport: { width: 900, height: 700 }, locale: 'fr-FR' })).newPage(); const files = await p.evaluate(() => window.__files);
  await p2.addInitScript(fl => { window.__files = fl; window.__mt = Object.fromEntries(Object.keys(fl).map(k => [k, 1763700000000])); }, files); await p2.addInitScript(init); await p2.route(/^(?!file).*/, r => r.abort());
  await p2.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p2.waitForTimeout(500);
  await p2.evaluate(async () => { window.__rb.asOfferProject && 0; }); await p2.evaluate(() => document.querySelector('[data-act=prefs]').click()); await p2.waitForTimeout(300); await p2.click('#asPick'); await p2.waitForTimeout(500);
  await p2.evaluate(() => { document.querySelector('#modalBg').classList.remove('show'); }); console.log('dbg', await p2.evaluate(() => JSON.stringify({ ll: window.__rb.S.ll.length, n: window.__rb.S.notes.length, files: Object.keys(window.__files), ls: localStorage.getItem('rbgen.asProj') }))); console.log('AS.h/offre', await p2.evaluate(async () => { try { await window.__rb.asOfferProject(); return 'ok ' + document.querySelector('#modal h2').innerText; } catch (e) { return 'ERR ' + e.message; } })); await p2.waitForTimeout(600);
  console.log('offre :', (await p2.innerText('#modal')).replace(/\n+/g, ' | ').slice(0, 220));
  await p2.click('#modal >> text=Ouvrir ce projet'); await p2.waitForTimeout(1500); console.log('projet ouvert, points :', await p2.evaluate(() => window.__rb.S.ll.length), 'erreurs', errs.join('|') || 0); await b.close(); })();
