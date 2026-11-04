/* =====================================================================
   Lotería una a una · Dinamiclase
   - Saca cartas al azar sin repetir (mazo de 54)
   - Registro de cartas cantadas para verificar tableros
   - Modo automático con intervalo configurable y cuenta regresiva
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, sfx } = DC.utils;
  const $ = (s) => document.querySelector(s);

  const TOTAL = 54;
  const IMG = (n) => `IMG/lot-${String(n).padStart(2, '0')}.webp`;

  const deckBtn = $('#deck');
  const nextBtn = $('#nextBtn');
  const autoBtn = $('#autoBtn');
  const resetBtn = $('#resetBtn');
  const current = $('#current');
  const historyEl = $('#history');
  const historyEmpty = $('#historyEmpty');
  const autoBar = $('#autoBar');
  const zoom = $('#zoom');

  let deck = shuffle(Array.from({ length: TOTAL }, (_, i) => i + 1));
  let called = [];
  let autoTimer = null;

  const interval = () => Number(document.querySelector('input[name="interval"]:checked').value) || 5;

  function updateUI() {
    const left = deck.length;
    $('#remaining').textContent = left ? `${left} ${left === 1 ? 'carta' : 'cartas'} en el mazo` : 'Mazo vacío';
    $('#calledCount').textContent = `${called.length} ${called.length === 1 ? 'cantada' : 'cantadas'}`;
    deckBtn.style.setProperty('--left', String(left / TOTAL));
    deckBtn.classList.toggle('is-empty', left === 0);
    $('#deckTitle').textContent = left ? 'Mazo de lotería' : 'Mazo vacío';
    $('#deckHint').textContent = left ? 'Toca para sacar una carta' : 'Pulsa «Nuevo juego»';
    deckBtn.disabled = left === 0;
    nextBtn.disabled = left === 0;
    autoBtn.disabled = left === 0;
    historyEmpty.hidden = called.length > 0;
  }

  function draw() {
    if (!deck.length) return;
    const n = deck.pop();
    called.push(n);

    current.innerHTML = `
      <button class="lu-card" type="button" data-img="${n}" aria-label="Carta ${n}. Pulsa para ampliarla">
        <img src="${IMG(n)}" alt="Carta número ${n}" width="221" height="348">
        <span class="lu-card__num">${n}</span>
      </button>`;

    const li = document.createElement('li');
    li.innerHTML = `<button class="lu-thumb" type="button" data-img="${n}" aria-label="Carta ${n}, cantada en el turno ${called.length}">
      <img src="${IMG(n)}" alt="" loading="lazy" width="221" height="348"><span>${n}</span></button>`;
    historyEl.prepend(li);

    sfx('flip');
    updateUI();
    if (!deck.length) {
      stopAuto();
      sfx('win');
      DC.confetti({ count: 120 });
      DC.toast({ title: '¡Mazo terminado!', text: 'Se cantaron las 54 cartas. Pulsa «Nuevo juego» para empezar otra ronda.', icon: 'bi-trophy-fill', theme: 'yellow' });
    } else if (autoTimer) {
      restartBar();
    }
  }

  /* Modo automático */
  function restartBar() {
    autoBar.style.animation = 'none';
    void autoBar.offsetWidth;
    autoBar.style.animation = `lu-countdown ${interval()}s linear forwards`;
  }
  function startAuto() {
    if (autoTimer || !deck.length) return;
    autoBtn.setAttribute('aria-pressed', 'true');
    autoBtn.innerHTML = '<i class="bi bi-pause-fill" aria-hidden="true"></i> Pausar';
    deckBtn.classList.add('is-auto');
    draw();
    autoTimer = setInterval(draw, interval() * 1000);
    restartBar();
  }
  function stopAuto() {
    clearInterval(autoTimer);
    autoTimer = null;
    autoBtn.setAttribute('aria-pressed', 'false');
    autoBtn.innerHTML = '<i class="bi bi-play-fill" aria-hidden="true"></i> Automático';
    deckBtn.classList.remove('is-auto');
    autoBar.style.animation = 'none';
  }
  const toggleAuto = () => (autoTimer ? stopAuto() : startAuto());

  function reset() {
    if (called.length && !window.confirm('¿Empezar un nuevo juego? Se borrará el registro de cartas cantadas.')) return;
    stopAuto();
    deck = shuffle(Array.from({ length: TOTAL }, (_, i) => i + 1));
    called = [];
    historyEl.innerHTML = '';
    current.innerHTML = `<div class="lu-current__empty"><i class="bi bi-postcard-heart-fill" aria-hidden="true"></i><p>La carta aparecerá aquí</p></div>`;
    updateUI();
    sfx('click');
  }

  function showZoom(n) {
    $('#zoomImg').src = IMG(n);
    $('#zoomNum').textContent = n;
    if (typeof zoom.showModal === 'function' && !zoom.open) zoom.showModal();
  }

  // Eventos
  deckBtn.addEventListener('click', draw);
  nextBtn.addEventListener('click', draw);
  autoBtn.addEventListener('click', toggleAuto);
  resetBtn.addEventListener('click', reset);
  document.querySelectorAll('input[name="interval"]').forEach((r) => r.addEventListener('change', () => {
    if (!autoTimer) return;
    clearInterval(autoTimer);
    autoTimer = setInterval(draw, interval() * 1000);
    restartBar();
  }));
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.lu-card, .lu-thumb');
    if (target) showZoom(target.dataset.img);
  });
  zoom.addEventListener('click', () => zoom.close());
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName) || zoom.open) return;
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); draw(); }
    if (e.key === 'a' || e.key === 'A') toggleAuto();
  });
  // Pausa el automático si la pestaña se oculta (evita "cantar" sin que nadie mire)
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAuto(); });

  updateUI();
})();
