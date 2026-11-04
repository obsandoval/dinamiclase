/* =====================================================================
   Lotería interactiva · Dinamiclase
   - Tablero de 54 cartas boca abajo: toca para revelar (giro 3D)
   - "Mezclar" reparte las imágenes al azar detrás de cada número
   - Opción de ampliar cada carta revelada (ideal para proyectar)
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, sfx } = DC.utils;
  const $ = (s) => document.querySelector(s);

  const TOTAL = 54;
  const IMG = (n) => `IMG/lot-${String(n).padStart(2, '0')}.webp`;

  const grid = $('#loteriaGrid');
  const statusEl = $('#deckStatus');
  const countEl = $('#revealedCount');
  const progress = $('#progress');
  const zoomToggle = $('#zoomToggle');
  const zoom = $('#zoom');

  /** order[i] = número de imagen que hay detrás de la posición i+1 */
  let order = Array.from({ length: TOTAL }, (_, i) => i + 1);
  let shuffled = false;
  let zoomOn = DC.utils.store.get('loteria-ampliar', true);

  function build() {
    grid.innerHTML = order.map((img, i) => `
      <button class="lot-card" type="button" data-pos="${i + 1}" data-img="${img}" aria-label="Carta ${i + 1}, boca abajo. Pulsa para revelarla">
        <span class="lot-card__inner">
          <span class="lot-card__back" aria-hidden="true"><span class="lot-card__num">${i + 1}</span></span>
          <span class="lot-card__front"><img src="${IMG(img)}" alt="" loading="lazy" width="221" height="348"><span class="lot-card__tag">${i + 1}</span></span>
        </span>
      </button>`).join('');
    updateCount();
  }

  function updateCount() {
    const n = grid.querySelectorAll('.lot-card.is-revealed').length;
    countEl.textContent = `${n} de ${TOTAL} reveladas`;
    progress.style.setProperty('--p', `${(n / TOTAL) * 100}%`);
    return n;
  }

  function setMode() {
    statusEl.classList.toggle('is-random', shuffled);
    statusEl.innerHTML = shuffled
      ? '<i class="bi bi-shuffle" aria-hidden="true"></i> Orden: <strong>aleatorio</strong>'
      : '<i class="bi bi-sort-numeric-down" aria-hidden="true"></i> Orden: <strong>1 a 54</strong>';
  }

  function showZoom(card) {
    $('#zoomImg').src = IMG(card.dataset.img);
    $('#zoomNum').textContent = card.dataset.pos;
    if (typeof zoom.showModal === 'function' && !zoom.open) zoom.showModal();
  }

  function reveal(card, { silent = false } = {}) {
    if (card.classList.contains('is-revealed')) {
      if (zoomOn && !silent) showZoom(card);
      return;
    }
    card.classList.add('is-revealed');
    card.setAttribute('aria-label', `Carta ${card.dataset.pos}, revelada. Pulsa para ampliarla`);
    if (silent) return;
    sfx('flip');
    if (zoomOn) setTimeout(() => showZoom(card), DC.reducedMotion() ? 0 : 380);
    if (updateCount() === TOTAL) finish();
  }

  function finish() {
    sfx('win');
    DC.confetti({ count: 140 });
    DC.toast({ title: '¡Tablero completo!', text: 'Revelaste las 54 cartas. Mezcla para jugar otra ronda.', icon: 'bi-trophy-fill', theme: 'yellow' });
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.lot-card');
    if (card) reveal(card);
  });

  $('#revealAllBtn').addEventListener('click', () => {
    grid.querySelectorAll('.lot-card:not(.is-revealed)').forEach((c) => reveal(c, { silent: true }));
    updateCount();
    sfx('pop');
  });

  $('#resetBtn').addEventListener('click', () => {
    if (updateCount() > 0 && !window.confirm('¿Reiniciar el tablero? Se ocultarán todas las cartas y volverán al orden 1 a 54.')) return;
    order = Array.from({ length: TOTAL }, (_, i) => i + 1);
    shuffled = false;
    build();
    setMode();
    sfx('click');
  });

  $('#shuffleBtn').addEventListener('click', () => {
    if (updateCount() > 0 && !window.confirm('¿Mezclar las cartas? Se ocultarán las que ya revelaste.')) return;
    order = shuffle(order);
    shuffled = true;
    grid.classList.add('is-shuffling');
    build();
    setMode();
    sfx('pop');
    setTimeout(() => grid.classList.remove('is-shuffling'), 600);
  });

  const paintZoomToggle = () => zoomToggle.setAttribute('aria-pressed', String(zoomOn));
  zoomToggle.addEventListener('click', () => {
    zoomOn = !zoomOn;
    DC.utils.store.set('loteria-ampliar', zoomOn);
    paintZoomToggle();
  });

  // Cerrar la carta ampliada con un toque en cualquier sitio
  zoom.addEventListener('click', () => zoom.close());

  paintZoomToggle();
  build();
  setMode();
})();
