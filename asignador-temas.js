/* =====================================================================
   Asignador de temas · Dinamiclase
   - Reparto equilibrado: si hay menos temas que estudiantes, cada tema
     se repite el mínimo de veces posible
   - Mismo color para quienes comparten tema
   - Modo suspenso: revelar los temas uno a uno
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, parseList, escapeHTML, sfx, copyText } = DC.utils;
  const $ = (s) => document.querySelector(s);

  const THEMES = ['blue', 'purple', 'pink', 'teal', 'orange', 'green', 'yellow', 'red', 'cyan'];
  const EXAMPLE_STUDENTS = ['Ana López', 'Bruno Díaz', 'Carla Méndez', 'Diego Ruiz', 'Elena Torres', 'Fernando Gil', 'Gabriela Rojas', 'Hugo Castro'];
  const EXAMPLE_TOPICS = ['El ciclo del agua', 'La Revolución Industrial', 'Energías renovables', 'Inteligencia artificial',
    'El sistema solar', 'Los volcanes', 'La fotosíntesis', 'Los derechos humanos'];

  const studentsEl = $('#students');
  const topicsEl = $('#topics');
  const results = $('#results');
  const notes = $('#notes');
  const suspenseEl = $('#suspense');
  const revealAllBtn = $('#btn-reveal-all');
  const remixBtn = $('#btn-remix');
  const copyBtn = $('#btn-copy');
  const titleEl = $('#resTitle');

  let items = [];

  function updateCounts() {
    const s = parseList(studentsEl.value).length;
    const t = parseList(topicsEl.value).length;
    $('#studentsCount').textContent = `${s} ${s === 1 ? 'estudiante' : 'estudiantes'}`;
    $('#topicsCount').textContent = `${t} ${t === 1 ? 'tema' : 'temas'}`;
  }

  /** Bolsa de temas barajada, repetida las veces necesarias para cubrir a todos. */
  function buildPool(topics, n) {
    const pool = [];
    while (pool.length < n) pool.push(...shuffle(topics));
    return pool.slice(0, n);
  }

  const note = (type, icon, html) => `<p class="dc-notice dc-notice--${type}"><i class="bi ${icon}" aria-hidden="true"></i><span>${html}</span></p>`;

  function assign() {
    const students = parseList(studentsEl.value);
    const topics = parseList(topicsEl.value);
    notes.innerHTML = '';

    if (!students.length || !topics.length) {
      results.innerHTML = note('error', 'bi-exclamation-triangle-fill', 'Escribe al menos un estudiante y un tema (uno por línea).');
      (students.length ? topicsEl : studentsEl).focus();
      return;
    }

    const pool = buildPool(topics, students.length);
    const colorOf = new Map(topics.map((t, i) => [t, THEMES[i % THEMES.length]]));
    items = students.map((student, i) => ({ student, topic: pool[i], theme: colorOf.get(pool[i]) }));

    if (students.length > topics.length) {
      const max = Math.ceil(students.length / topics.length);
      notes.innerHTML += note('warn', 'bi-info-circle-fill',
        `Hay más estudiantes que temas: algunos temas se repiten (como máximo ${max} personas por tema). Los colores indican quién comparte tema.`);
    } else if (topics.length > students.length) {
      const used = new Set(pool);
      const left = topics.filter((t) => !used.has(t));
      notes.innerHTML += note('ok', 'bi-check-circle-fill',
        `Sobraron ${left.length} ${left.length === 1 ? 'tema' : 'temas'}: <strong>${left.map(escapeHTML).join(', ')}</strong>.`);
    }

    render();
    remixBtn.disabled = false;
    copyBtn.disabled = false;
    sfx(suspenseEl.checked ? 'pop' : 'win');
    if (!suspenseEl.checked) {
      const r = results.getBoundingClientRect();
      DC.confetti({ x: r.left + r.width / 2, y: Math.max(80, r.top + 40), count: 50 });
    }
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function render() {
    const hidden = suspenseEl.checked;
    titleEl.textContent = `${items.length} ${items.length === 1 ? 'asignación' : 'asignaciones'}`;
    revealAllBtn.hidden = !hidden;
    results.innerHTML = `<ol class="tm-list">${items.map((it, i) => `
      <li class="tm-item dc-theme-${it.theme}" style="--i:${Math.min(i, 20)}">
        <span class="tm-item__num" aria-hidden="true">${i + 1}</span>
        <span class="tm-item__student">${escapeHTML(it.student)}</span>
        <i class="bi bi-arrow-right tm-item__arrow" aria-hidden="true"></i>
        ${hidden
          ? `<button class="tm-item__topic is-hidden" type="button" data-index="${i}" aria-label="Revelar el tema de ${escapeHTML(it.student)}"><i class="bi bi-question-lg" aria-hidden="true"></i> Revelar</button>`
          : `<span class="tm-item__topic">${escapeHTML(it.topic)}</span>`}
      </li>`).join('')}</ol>`;
  }

  function reveal(btn) {
    const it = items[Number(btn.dataset.index)];
    const span = document.createElement('span');
    span.className = 'tm-item__topic is-revealed';
    span.textContent = it.topic;
    btn.replaceWith(span);
    sfx('flip');
    if (!results.querySelector('.tm-item__topic.is-hidden')) {
      revealAllBtn.hidden = true;
      sfx('win');
      DC.confetti({ count: 70 });
    }
  }

  results.addEventListener('click', (e) => {
    const btn = e.target.closest('.tm-item__topic.is-hidden');
    if (btn) reveal(btn);
  });
  revealAllBtn.addEventListener('click', () => {
    results.querySelectorAll('.tm-item__topic.is-hidden').forEach((btn, i) => setTimeout(() => btn.isConnected && reveal(btn), i * 120));
  });

  $('#btn-assign').addEventListener('click', assign);
  remixBtn.addEventListener('click', assign);
  copyBtn.addEventListener('click', () => copyText(items.map((it) => `${it.student} → ${it.topic}`).join('\n')));
  studentsEl.addEventListener('input', updateCounts);
  topicsEl.addEventListener('input', updateCounts);
  $('#exampleStudents').addEventListener('click', () => {
    studentsEl.value = EXAMPLE_STUDENTS.join('\n');
    studentsEl.dispatchEvent(new Event('input', { bubbles: true }));
  });
  $('#exampleTopics').addEventListener('click', () => {
    topicsEl.value = EXAMPLE_TOPICS.join('\n');
    topicsEl.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); assign(); }
  });

  updateCounts();
})();
