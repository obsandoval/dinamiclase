/* =====================================================================
   DINAMICLASE · Portada (index.html)
   Filtros, buscador, "herramienta sorpresa" y formulario de sugerencias.
   Requiere dinamiclase.js cargado antes.
   ===================================================================== */
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const DC = window.Dinamiclase;
  const reduced = () => (DC ? DC.reducedMotion() : false);
  const normalize = (txt) => txt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const grid = $('#tools-grid');
  if (!grid) return;
  const cards = $$('.dc-tool[data-tool]', grid);
  const specials = $$('.dc-tool--special', grid);

  /* ------------------------------------------------------------------
     Catálogo leído del propio HTML (una sola fuente de verdad)
     ------------------------------------------------------------------ */
  const tools = cards.map((card) => ({
    card,
    id: card.dataset.tool,
    cat: card.dataset.cat,
    name: $('.dc-tool__title', card).textContent.trim(),
    desc: $('.dc-tool__desc', card).textContent.trim(),
    icon: $('.dc-tool__icon i', card).className,
    theme: Array.from(card.classList).find((c) => c.startsWith('dc-theme-')) || 'dc-theme-orange',
    href: $('.dc-tool__cta', card).getAttribute('href'),
    text: normalize(`${card.textContent} ${card.dataset.keywords || ''}`),
  }));

  /* ------------------------------------------------------------------
     Filtros + buscador
     ------------------------------------------------------------------ */
  const chips = $$('[data-filter]');
  const search = $('#tool-search');
  const empty = $('#tools-empty');
  const results = $('#tools-results');
  let currentCat = 'all';
  let query = '';

  chips.forEach((chip) => {
    const cat = chip.dataset.filter;
    const count = cat === 'all' ? tools.length : tools.filter((t) => t.cat === cat).length;
    const badge = $('.dc-chip__count', chip);
    if (badge) badge.textContent = String(count);
  });

  if (results) results.textContent = `Mostrando las ${tools.length} herramientas`;

  function applyFilters() {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    let shown = 0;
    tools.forEach((t) => {
      const match = (currentCat === 'all' || t.cat === currentCat) && terms.every((term) => t.text.includes(term));
      const wasHidden = t.card.hidden;
      t.card.hidden = !match;
      if (match) {
        t.card.classList.add('is-visible');
        if (wasHidden && !reduced()) {
          t.card.classList.remove('is-pop');
          t.card.style.setProperty('--i', String(shown));
          void t.card.offsetWidth;
          t.card.classList.add('is-pop');
        }
        shown += 1;
      }
    });
    // Las tarjetas especiales solo se muestran sin búsqueda activa
    specials.forEach((s) => { s.hidden = terms.length > 0; });
    if (empty) empty.hidden = shown > 0;
    if (results) {
      results.textContent = shown === tools.length
        ? `Mostrando las ${shown} herramientas`
        : `${shown} ${shown === 1 ? 'herramienta encontrada' : 'herramientas encontradas'}`;
    }
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      currentCat = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      applyFilters();
    });
  });

  if (search) {
    search.addEventListener('input', () => { query = search.value; applyFilters(); });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && search.value) { search.value = ''; query = ''; applyFilters(); }
    });
  }

  $$('[data-dc-clear-filters]').forEach((btn) => btn.addEventListener('click', () => {
    query = '';
    if (search) search.value = '';
    currentCat = 'all';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === 'all')));
    applyFilters();
    if (search) search.focus();
  }));

  /* ------------------------------------------------------------------
     Herramienta sorpresa (dado)
     ------------------------------------------------------------------ */
  const dialog = $('#surprise');
  const slot = dialog && $('.dc-slot', dialog);
  const slotIcon = dialog && $('.dc-slot__icon i', dialog);
  const slotName = dialog && $('.dc-slot__name', dialog);
  const slotDesc = dialog && $('.dc-slot__desc', dialog);
  const slotLive = dialog && $('[data-dc-slot-live]', dialog);
  const goBtn = dialog && $('[data-dc-go]', dialog);
  const rerollBtn = dialog && $('[data-dc-reroll]', dialog);
  let rolling = false;
  let lastPick = -1;

  function paint(t, phase) {
    const card = $('.dc-dialog__card', dialog);
    card.className = `dc-dialog__card ${t.theme}`;
    slotIcon.className = t.icon;
    slotName.textContent = t.name;
    slot.classList.remove('is-tick', 'is-landed');
    void slot.offsetWidth;
    slot.classList.add(phase === 'final' ? 'is-landed' : 'is-tick');
  }

  function roll() {
    if (rolling || !tools.length) return;
    rolling = true;
    goBtn.setAttribute('aria-disabled', 'true');
    rerollBtn.setAttribute('aria-disabled', 'true');
    slotDesc.textContent = 'Girando…';
    slotLive.textContent = '';

    let pick;
    do { pick = Math.floor(Math.random() * tools.length); } while (tools.length > 1 && pick === lastPick);
    lastPick = pick;

    const steps = reduced() ? 1 : 18;
    let i = 0;
    let idx = Math.floor(Math.random() * tools.length);

    const tick = () => {
      if (!dialog.open) { rolling = false; return; } // se cerró a mitad del giro
      i += 1;
      if (i >= steps) {
        land(tools[pick]);
        return;
      }
      idx = (idx + 1 + Math.floor(Math.random() * (tools.length - 1))) % tools.length;
      paint(tools[idx], 'tick');
      setTimeout(tick, 55 + Math.pow(i / steps, 3) * 360);
    };
    tick();
  }

  function land(t) {
    paint(t, 'final');
    slotDesc.textContent = t.desc;
    slotLive.textContent = `Te tocó: ${t.name}. ${t.desc}`;
    goBtn.href = t.href;
    goBtn.removeAttribute('aria-disabled');
    rerollBtn.removeAttribute('aria-disabled');
    rolling = false;

    const r = $('.dc-slot__icon', dialog).getBoundingClientRect();
    if (DC) DC.confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 60 });
  }

  function openSurprise() {
    if (!dialog || typeof dialog.showModal !== 'function') {
      // Navegador sin <dialog>: resalta una tarjeta al azar
      const t = tools[Math.floor(Math.random() * tools.length)];
      t.card.hidden = false;
      t.card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
      t.card.classList.add('is-highlight');
      setTimeout(() => t.card.classList.remove('is-highlight'), 3400);
      return;
    }
    dialog.showModal();
    roll();
  }

  $$('[data-dc-surprise]').forEach((btn) => btn.addEventListener('click', openSurprise));

  if (dialog) {
    rerollBtn.addEventListener('click', roll);
    goBtn.addEventListener('click', (e) => { if (rolling) e.preventDefault(); });
    $$('[data-dc-close]', dialog).forEach((b) => b.addEventListener('click', () => dialog.close()));
    // Cerrar al hacer clic fuera de la tarjeta
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }

  /* ------------------------------------------------------------------
     Formulario de sugerencias (Formspree vía fetch, con respaldo HTML)
     ------------------------------------------------------------------ */
  const form = $('[data-dc-suggest]');
  if (form && window.fetch) {
    const status = $('.dc-form__status', form);
    const submit = $('button[type="submit"]', form);
    const fields = $('[data-dc-form-fields]', form);
    const success = $('[data-dc-form-success]', form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.classList.remove('is-error');
      status.textContent = 'Enviando tu idea…';
      submit.disabled = true;
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.textContent = '';
        fields.hidden = true;
        success.hidden = false;
        $('h3', success).focus();
        if (DC) {
          const r = success.getBoundingClientRect();
          DC.confetti({ x: r.left + r.width / 2, y: r.top + 60, count: 120 });
        }
      } catch {
        status.classList.add('is-error');
        status.textContent = 'No pudimos enviar tu sugerencia. Revisa tu conexión e inténtalo de nuevo.';
      } finally {
        submit.disabled = false;
      }
    });

    $$('[data-dc-form-again]', form).forEach((btn) => btn.addEventListener('click', () => {
      success.hidden = true;
      fields.hidden = false;
      $('input[type="email"]', form).focus();
    }));
  }
})();
