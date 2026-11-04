/* =====================================================================
   Story Icons · Dinamiclase
   - De 2 a 9 dados con íconos al azar (sin repetir hasta agotar la lista)
   - Toca un dado para fijarlo y vuelve a tirar los demás
   - Guía narrativa opcional, reto con temporizador e historial
   Requiere: dinamiclase.js y story-icons-lista.js
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { clamp, sfx, reducedMotion } = { ...DC.utils, reducedMotion: DC.reducedMotion };
  const SI = window.StoryIcons;
  const $ = (s) => document.querySelector(s);

  // Color de cada dado [fondo, sombra]: todos admiten el ícono en blanco
  const DIE_COLORS = [
    ['#DB2777', '#A3165A'], ['#2F6BFF', '#1A45B8'], ['#EA580C', '#9A3412'],
    ['#0D9488', '#115E59'], ['#7C3AED', '#5B21B6'], ['#16A34A', '#14532D'],
    ['#E11D48', '#A8102F'], ['#0284C7', '#075985'], ['#D97706', '#92400E'],
  ];
  const GUIDE = ['Personaje', 'Lugar', 'Problema', 'Objeto', 'Ayuda', 'Giro', 'Emoción', 'Desenlace', 'Moraleja'];
  const GUIDE_3 = ['Inicio', 'Nudo', 'Desenlace'];

  const diceEl = $('#dice');
  const countEl = $('#iconCount');
  const guideEl = $('#guide');
  const rollBtn = $('#rollButton');
  const unlockBtn = $('#unlockAll');
  const live = $('#diceLive');
  const historyEl = $('#history');
  const timerEl = document.querySelector('[data-dc-timer]');

  /** Estado de cada dado: { icon, locked } */
  let dice = [];
  let rolling = false;
  const history = [];

  const count = () => clamp(Number(countEl.value) || 3, 2, 9);
  const labelFor = (i, n) => (n === 3 ? GUIDE_3[i] : GUIDE[i]);

  function syncDice() {
    const n = count();
    if (dice.length === 0) dice = SI.pick(n).map((icon) => ({ icon, locked: false }));
    while (dice.length < n) dice.push({ icon: SI.pick(1, dice.map((d) => d.icon))[0], locked: false });
    dice.length = n;
    render();
  }

  function render() {
    const n = dice.length;
    diceEl.dataset.count = String(n);
    diceEl.innerHTML = dice.map((d, i) => `
      <button class="sc-die${d.locked ? ' is-locked' : ''}" type="button"
        style="--c:${DIE_COLORS[i % DIE_COLORS.length][0]};--c-dark:${DIE_COLORS[i % DIE_COLORS.length][1]};--c-on:#fff"
        data-index="${i}" aria-pressed="${d.locked}" aria-label="Dado ${i + 1}: ${d.icon.replace(/_/g, ' ')}. ${d.locked ? 'Fijado' : 'Pulsa para fijarlo'}">
        <span class="sc-die__face"><span class="sc-die__icon material-symbols-rounded" aria-hidden="true">${d.icon}</span></span>
        <span class="sc-die__lock" aria-hidden="true"><i class="bi bi-lock-fill"></i></span>
        ${guideEl.checked ? `<span class="sc-die__label">${labelFor(i, n)}</span>` : ''}
      </button>`).join('');
    unlockBtn.hidden = !dice.some((d) => d.locked);
  }

  function addHistory(icons) {
    history.unshift(icons);
    history.length = Math.min(history.length, 6);
    historyEl.innerHTML = history.map((row, i) => `
      <li class="sc-history__row${i === 0 ? ' is-current' : ''}">
        <span class="sc-history__num">${i === 0 ? 'Ahora' : `#${history.length - i}`}</span>
        ${row.map((ic) => `<span class="material-symbols-rounded" aria-hidden="true">${ic}</span>`).join('')}
        <span class="dc-visually-hidden">${row.map((ic) => ic.replace(/_/g, ' ')).join(', ')}</span>
      </li>`).join('');
  }

  async function roll() {
    if (rolling) return;
    syncDice();
    const free = dice.map((d, i) => (d.locked ? -1 : i)).filter((i) => i >= 0);
    if (!free.length) {
      DC.toast({ title: 'Todos los dados están fijados', text: 'Toca alguno para soltarlo y vuelve a tirar.', icon: 'bi-lock-fill', theme: 'pink' });
      return;
    }
    rolling = true;
    rollBtn.disabled = true;
    const finals = SI.pick(free.length, dice.filter((d) => d.locked).map((d) => d.icon));
    const buttons = diceEl.querySelectorAll('.sc-die');

    if (!reducedMotion()) {
      free.forEach((i) => buttons[i].classList.add('is-rolling'));
      const timers = free.map((i) => setInterval(() => {
        const icon = buttons[i].querySelector('.sc-die__icon');
        if (icon) icon.textContent = SI.random();
      }, 70));
      for (let k = 0; k < free.length; k++) {
        await new Promise((r) => setTimeout(r, k === 0 ? 750 : 220));
        clearInterval(timers[k]);
        const i = free[k];
        dice[i].icon = finals[k];
        buttons[i].classList.remove('is-rolling');
        buttons[i].classList.add('is-landed');
        buttons[i].querySelector('.sc-die__icon').textContent = finals[k];
        sfx('tick');
      }
    } else {
      free.forEach((i, k) => { dice[i].icon = finals[k]; });
    }

    render();
    sfx('pop');
    addHistory(dice.map((d) => d.icon));
    live.textContent = `Nuevos íconos: ${dice.map((d) => d.icon.replace(/_/g, ' ')).join(', ')}`;
    rolling = false;
    rollBtn.disabled = false;
    if ($('#autoTimer').checked && timerEl?.dcTimer) timerEl.dcTimer.restart();
  }

  diceEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.sc-die');
    if (!btn || rolling) return;
    const d = dice[Number(btn.dataset.index)];
    d.locked = !d.locked;
    sfx('click');
    render();
    diceEl.querySelector(`[data-index="${btn.dataset.index}"]`)?.focus();
  });
  unlockBtn.addEventListener('click', () => { dice.forEach((d) => { d.locked = false; }); render(); });
  rollBtn.addEventListener('click', roll);
  countEl.addEventListener('input', syncDice);
  guideEl.addEventListener('change', render);
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT|BUTTON/.test(tag) || e.target.isContentEditable) return;
    e.preventDefault();
    roll();
  });

  syncDice();
})();
