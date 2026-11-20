const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1000, height: 900 }, locale: 'fr-FR' })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { const files = {}; window.__files = files;
    const mk = name => ({ kind: 'directory', name, queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      getFileHandle: async (n, o) => { if (!files[n]) { if (!(o && o.create)) throw new Error('NotFound'); files[n] = ''; } return { createWritable: async () => { let buf = ''; return { write: async t => { buf = t; }, close: async () => { files[n] = buf; } }; }, getFile: async () => ({ text: async () => files[n] }) }; } });
    window.showDirectoryPicker = async () => mk('MesReglages'); });
  await p.route(/^(?!file).*/, r => r.abort());
  await p.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'generateur-roadbook.html')); await p.waitForTimeout(500);
  await p.click('#menuBtn, [data-menu], #bMenu', { timeout: 2000 }).catch(() => {});
  await p.evaluate(() => document.querySelector('[data-act=prefs]').click()); await p.waitForTimeout(300);
  console.log('dialogue :', (await p.innerText('#modal')).replace(/\n+/g, ' | ').slice(0, 330));
  await p.click('#asPick'); await p.waitForTimeout(800);
  console.log('fichier créé :', await p.evaluate(() => Object.keys(window.__files)), 'éléments', await p.evaluate(() => Object.keys(JSON.parse(window.__files['reglages-roadbook.json'] || '{"data":{}}').data).length));
  await p.evaluate(() => localStorage.setItem('rbgen.theme', 'dark-test')); await p.waitForTimeout(2200);
  console.log('thème dans le fichier :', await p.evaluate(() => (JSON.parse(window.__files['reglages-roadbook.json']).data || {})['rbgen.theme']));
  await p.evaluate(() => localStorage.removeItem('rbgen.theme')); await p.waitForTimeout(2200);
  console.log('après suppression :', await p.evaluate(() => 'rbgen.theme' in (JSON.parse(window.__files['reglages-roadbook.json']).data || {})));
  console.log('erreurs', errs.join('|') || 0); await b.close(); })();
