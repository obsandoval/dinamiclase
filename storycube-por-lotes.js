/* =====================================================================
   Story Icons por lotes · Dinamiclase
   - Íconos únicos para cada estudiante o equipo (sin repetir entre fichas)
   - Animación ficha por ficha que se puede saltar
   - Volver a tirar una ficha concreta e imprimir todas
   Requiere: dinamiclase.js y story-icons-lista.js
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { parseList, clamp, escapeHTML, sfx, sleep } = DC.utils;
  const SI = window.StoryIcons;
  const $ = (s) => document.querySelector(s);

  const THEMES = ['teal', 'pink', 'blue', 'yellow', 'purple', 'orange', 'green', 'red', 'cyan'];
  const EXAMPLE = ['Ana López', 'Bruno Díaz', 'Carla Méndez', 'Diego Ruiz', 'Elena Torres', 'Fernando Gil', 'Gabriela Rojas', 'Hugo Castro'];

  const namesEl = $('#studentNames');
  const countEl = $('#iconCount');
  const animateEl = $('#animate');
  const assignBtn = $('#assignBatch');
  const skipBtn = $('#skipBtn');
  const printBtn = $('#printBtn');
  const results = $('#results');
  const progress = $('#progress');
  const titleEl = $('#resTitle');

  let cards = [];
  let skipping = false;
  let running = false;

  const iconHTML = (icons) => icons.map((ic) => `
    <span class="sl-icon"><span class="material-symbols-rounded" aria-hidden="true">${ic}</span></span>`).join('');

  const cardHTML = (c, i) => `
    <article class="dc-result sl-card dc-print-card dc-theme-${THEMES[i % THEMES.length]}" data-index="${i}" style="--i:0">
      <div class="dc-result__head">
        <span class="dc-result__badge" aria-hidden="true">${i + 1}</span>
        <h3 class="dc-result__title">${escapeHTML(c.name)}</h3>
        <button class="dc-icon-btn sl-reroll dc-no-print" type="button" title="Otros íconos" aria-label="Nuevos íconos para ${escapeHTML(c.name)}"><i class="bi bi-arrow-repeat" aria-hidden="true"></i></button>
      </div>
      <div class="sl-icons" data-icons>${iconHTML(c.icons)}</div>
      <span class="dc-visually-hidden">Íconos: ${c.icons.map((ic) => ic.replace(/_/g, ' ')).join(', ')}</span>
    </article>`;

  function updateCount() {
    const n = parseList(namesEl.value).length;
    $('#namesCount').textContent = `${n} ${n === 1 ? 'ficha' : 'fichas'}`;
  }

  async function animateCard(el, finals) {
    const box = el.querySelector('[data-icons]');
    box.innerHTML = iconHTML(finals.map(() => SI.random()));
    el.classList.add('is-rolling');
    const spans = box.querySelectorAll('.material-symbols-rounded');
    const t = setInterval(() => spans.forEach((s) => { s.textContent = SI.random(); }), 70);
    await sleep(skipping ? 0 : 420);
    clearInterval(t);
    box.innerHTML = iconHTML(finals);
    el.querySelector('.dc-visually-hidden').textContent = `Íconos: ${finals.map((ic) => ic.replace(/_/g, ' ')).join(', ')}`;
    el.classList.remove('is-rolling');
    el.classList.add('is-landed');
    if (!skipping) sfx('tick');
  }

  async function assign() {
    if (running) return;
    const names = parseList(namesEl.value);
    if (!names.length) {
      results.innerHTML = '<p class="dc-notice dc-notice--error"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> Escribe al menos un nombre (uno por línea).</p>';
      namesEl.focus();
      return;
    }
    const n = clamp(Number(countEl.value) || 3, 2, 6);
    cards = names.map((name) => ({ name, icons: SI.pick(n) }));
    titleEl.textContent = `${cards.length} ${cards.length === 1 ? 'ficha' : 'fichas'}`;

    const animate = animateEl.checked && !DC.reducedMotion();
    running = true;
    skipping = !animate;
    assignBtn.disabled = true;
    printBtn.disabled = true;
    skipBtn.hidden = !animate;

    results.innerHTML = `<div class="dc-results-grid sl-grid">${cards.map((c, i) => cardHTML(animate ? { ...c, icons: [] } : c, i)).join('')}</div>`;
    const els = results.querySelectorAll('.sl-card');

    if (animate) {
      progress.hidden = false;
      results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      for (let i = 0; i < cards.length; i++) {
        els[i].scrollIntoView({ behavior: skipping ? 'auto' : 'smooth', block: 'nearest' });
        await animateCard(els[i], cards[i].icons);
        progress.style.setProperty('--p', `${((i + 1) / cards.length) * 100}%`);
        if (!skipping) await sleep(90);
      }
      progress.hidden = true;
    }

    running = false;
    skipBtn.hidden = true;
    assignBtn.disabled = false;
    printBtn.disabled = false;
    sfx('win');
    DC.confetti({ count: 60 });
  }

  results.addEventListener('click', async (e) => {
    const btn = e.target.closest('.sl-reroll');
    if (!btn || running) return;
    const el = btn.closest('.sl-card');
    const c = cards[Number(el.dataset.index)];
    c.icons = SI.pick(c.icons.length, c.icons);
    skipping = DC.reducedMotion();
    await animateCard(el, c.icons);
    sfx('pop');
  });

  assignBtn.addEventListener('click', assign);
  skipBtn.addEventListener('click', () => { skipping = true; });
  printBtn.addEventListener('click', () => window.print());
  namesEl.addEventListener('input', updateCount);
  $('#btn-ejemplo').addEventListener('click', () => {
    namesEl.value = EXAMPLE.join('\n');
    namesEl.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); assign(); }
  });

  updateCount();
})();
