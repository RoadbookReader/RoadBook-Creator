/* ============================================================
   Roadbook en direct : pendant le dessin, les notes sont recalculées après chaque point posé (pause de 1,5 s).
   Réutilise genPipeline (10-generation.js) : calcul complet de la trace, sans fenêtre ni rapport. Les notes modifiées ou ajoutées
   à la main sont gardées (keepOnRegen), les routes déjà téléchargées sont réutilisées (tuiles en mémoire).
   ============================================================ */
const LIVE = { on: false, running: false, ver: 0, timer: 0 };
try { LIVE.on = localStorage.getItem('rbgen.live') === '1'; } catch (_) {}
function liveStatus(txt, warn) { const e = $('#liveSt'); if (e) { e.textContent = txt; e.classList.toggle('warn', !!warn); } }
function liveSchedule() {      // appelé à chaque changement de la trace (setTrack)
  if (!LIVE.on || !drawing) return;
  LIVE.ver++; clearTimeout(LIVE.timer);
  if (!T || S.ll.length < 2) { liveStatus(''); return; }
  liveStatus('⏳ en attente…');
  LIVE.timer = setTimeout(liveRun, 1500);
}
async function liveRun() {
  if (!LIVE.on || !T || S.ll.length < 2) return;
  if (LIVE.running) return;      // le calcul en cours est annulé par le nouveau changement (version) puis relancé à sa fin
  LIVE.running = true; const ver = LIVE.ver, t0 = Date.now(); GENQUIET = true; GENLOG = [];
  try {
    const R = await genPipeline(txt => liveStatus('⏳ ' + txt.replace(/…$/, '') + '…'), () => LIVE.ver !== ver || !LIVE.on);
    if (R.noWays) liveStatus('⚠ aucun chemin trouvé autour de la trace', true);
    else {
      renderAll(); const sec = Math.round((Date.now() - t0) / 100) / 10;
      liveStatus(`✓ ${S.notes.length} notes · ${sec} s` + (GENLOG.length ? ' · ' + GENLOG[0] : ''), sec > 25 || GENLOG.length > 0);
    }
  } catch (e) {
    if (!/annulé/.test(e && e.message || '')) { console.warn('roadbook en direct', e); liveStatus('⚠ réseau indisponible : réessaie plus tard', true); }
  } finally { GENQUIET = false; LIVE.running = false; }
  if (LIVE.on && LIVE.ver !== ver) { clearTimeout(LIVE.timer); LIVE.timer = setTimeout(liveRun, 300); }      // la trace a changé pendant le calcul
}
$('#liveChk').checked = LIVE.on;
$('#liveChk').addEventListener('change', e => {
  LIVE.on = e.target.checked; try { localStorage.setItem('rbgen.live', LIVE.on ? '1' : '0'); } catch (_) {}
  if (LIVE.on) { if (T && S.ll.length > 1) { liveSchedule(); } else liveStatus('Pose au moins 2 points.'); }
  else { LIVE.ver++; clearTimeout(LIVE.timer); liveStatus(''); }
});
