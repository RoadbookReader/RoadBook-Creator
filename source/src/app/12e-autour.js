/* ---------- Clic droit sur la carte : Street View, Google Maps, ajouter un marqueur ---------- */
function rightClickMenu(ll) {
  const la = ll.lat.toFixed(6), lo = ll.lng.toFixed(6);
  const sv = `https://www.google.com/maps?q=&layer=c&cbll=${la},${lo}`;      // cbll : Google cale sur le panorama le plus proche (le lien « pano/viewpoint » donnait un écran noir)
  const gm = `https://www.google.com/maps/search/?api=1&query=${la},${lo}`;
  const pop = L.popup({ closeButton: false, className: 'svpop', offset: [0, 4] }).setLatLng(ll)
    .setContent(`<a class="svlnk" href="${sv}" target="_blank" rel="noopener">👁 Google Street View</a><a class="svlnk" href="${gm}" target="_blank" rel="noopener">🗺️ Google Maps</a>`
      + `<a class="svlnk" href="#" data-a="mark">📍 Ajouter un marqueur ici</a><div class="svco">${la}, ${lo}</div>`).openOn(map);
  pop.getElement().querySelectorAll('[data-a]').forEach(el => el.addEventListener('click', ev => {
    ev.preventDefault(); map.closePopup();
    markForm({ lat: +la, lon: +lo, icon: 'pin', name: '', desc: '' }, true);
  }));
}
