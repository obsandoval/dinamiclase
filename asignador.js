/* =====================================================================
   Grupos aleatorios · Dinamiclase
   - Por tamaño de grupo o por número de grupos
   - Reparto equilibrado (los grupos difieren como mucho en 1 persona)
   - Coordinador/a opcional y nombres de equipo divertidos
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, parseList, clamp, escapeHTML, sfx, copyText } = DC.utils;
  const $ = (s) => document.querySelector(s);

  const TEAMS = [
    ['Cohetes', 'bi-rocket-takeoff-fill'], ['Dragones', 'bi-fire'], ['Rayos', 'bi-lightning-charge-fill'],
    ['Estrellas', 'bi-star-fill'], ['Búhos', 'bi-moon-stars-fill'], ['Cometas', 'bi-stars'],
    ['Tiburones', 'bi-water'], ['Robots', 'bi-robot'], ['Planetas', 'bi-globe-americas'],
    ['Tornados', 'bi-tornado'], ['Diamantes', 'bi-gem'], ['Brújulas', 'bi-compass-fill'],
    ['Volcanes', 'bi-triangle-fill'], ['Ninjas', 'bi-incognito'], ['Cerebritos', 'bi-lightbulb-fill'],
    ['Corazones', 'bi-heart-fill'], ['Trofeos', 'bi-trophy-fill'], ['Arcoíris', 'bi-rainbow'],
  ];
  const THEMES = ['blue', 'purple', 'pink', 'teal', 'orange', 'green', 'yellow', 'red', 'cyan'];
  const EXAMPLE = ['Ana López', 'Bruno Díaz', 'Carla Méndez', 'Diego Ruiz', 'Elena Torres', 'Fernando Gil',
    'Gabriela Rojas', 'Hugo Castro', 'Irene Vega', 'Jorge Molina', 'Karla Ortiz', 'Luis Navarro', 'María Soto', 'Nicolás Paz'];

  const namesEl = $('#nombres');
  const valueEl = $('#valor');
  const previewEl = $('#preview');
  const countEl = $('#namesCount');
  const leaderEl = $('#lider');
  const funEl = $('#divertidos');
  const results = $('#resultados');
  const createBtn = $('#btn-crear');
  const remixBtn = $('#btn-mezclar');
  const copyBtn = $('#btn-copiar');
  const titleEl = $('#resTitle');

  let lastGroups = [];

  const mode = () => document.querySelector('input[name="modo"]:checked').value;
  const names = () => parseList(namesEl.value);

  /** Cuántos grupos salen según el modo elegido. */
  function groupCount(n, m, value) {
    if (n === 0) return 0;
    if (m === 'cantidad') return clamp(value, 1, n);
    return clamp(Math.round(n / Math.max(1, value)), 1, n);
  }

  function updatePreview() {
    const n = names().length;
    countEl.textContent = `${n} ${n === 1 ? 'nombre' : 'nombres'}`;
    valueEl.max = String(Math.max(1, n || 99));
    valueEl.setAttribute('aria-label', mode() === 'cantidad' ? 'Número de grupos' : 'Personas por grupo');
    const value = Number(valueEl.value) || 1;
    const k = groupCount(n, mode(), value);
    if (n < 2) {
      previewEl.textContent = 'Agrega al menos 2 nombres.';
      return;
    }
    const base = Math.floor(n / k);
    const extra = n % k;
    const sizes = extra ? `${base}–${base + 1}` : `${base}`;
    previewEl.innerHTML = `→ <strong>${k}</strong> ${k === 1 ? 'grupo' : 'grupos'} de <strong>${sizes}</strong> ${base + (extra ? 1 : 0) === 1 ? 'persona' : 'personas'}`;
  }

  function makeGroups(list) {
    const k = groupCount(list.length, mode(), Number(valueEl.value) || 1);
    const groups = Array.from({ length: k }, () => []);
    shuffle(list).forEach((name, i) => groups[i % k].push(name));
    // Mezcla el orden de los grupos para que el más grande no sea siempre el primero
    const teams = shuffle(TEAMS);
    return shuffle(groups).map((members, i) => ({
      members,
      leader: leaderEl.checked ? Math.floor(Math.random() * members.length) : -1,
      name: funEl.checked ? `Equipo ${teams[i % teams.length][0]}` : `Grupo ${i + 1}`,
      icon: funEl.checked ? teams[i % teams.length][1] : 'bi-people-fill',
      theme: THEMES[i % THEMES.length],
    }));
  }

  function render(groups) {
    titleEl.textContent = `${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}`;
    results.innerHTML = `<div class="dc-results-grid">${groups.map((g, i) => `
      <article class="dc-result dc-theme-${g.theme}" style="--i:${i}">
        <div class="dc-result__head">
          <span class="dc-result__badge" aria-hidden="true"><i class="bi ${g.icon}"></i></span>
          <h3 class="dc-result__title">${escapeHTML(g.name)}</h3>
          <span class="dc-result__meta">${g.members.length} ${g.members.length === 1 ? 'persona' : 'personas'}</span>
        </div>
        <ul class="dc-names">${g.members.map((m, j) => j === g.leader
          ? `<li class="is-leader"><i class="bi bi-award-fill" aria-hidden="true"></i>${escapeHTML(m)}<span class="dc-visually-hidden"> (coordina)</span></li>`
          : `<li>${escapeHTML(m)}</li>`).join('')}</ul>
      </article>`).join('')}</div>`;
  }

  function showError(msg) {
    results.innerHTML = `<p class="dc-notice dc-notice--error"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> ${msg}</p>`;
  }

  function create() {
    const list = names();
    if (list.length < 2) {
      showError('Escribe al menos 2 nombres (uno por línea) para formar grupos.');
      namesEl.focus();
      return;
    }
    lastGroups = makeGroups(list);
    render(lastGroups);
    remixBtn.disabled = false;
    copyBtn.disabled = false;
    sfx('win');
    const r = results.getBoundingClientRect();
    DC.confetti({ x: r.left + r.width / 2, y: Math.max(80, r.top + 40), count: 60 });
    if (window.matchMedia('(max-width: 920px)').matches) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function asText() {
    return lastGroups.map((g) => {
      const members = g.members.map((m, j) => (j === g.leader ? `${m} (coordina)` : m)).join(', ');
      return `${g.name} (${g.members.length}): ${members}`;
    }).join('\n');
  }

  // Eventos
  createBtn.addEventListener('click', create);
  remixBtn.addEventListener('click', create);
  copyBtn.addEventListener('click', () => copyText(asText()));
  namesEl.addEventListener('input', updatePreview);
  valueEl.addEventListener('input', updatePreview);
  document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener('change', updatePreview));
  $('#btn-ejemplo').addEventListener('click', () => {
    namesEl.value = EXAMPLE.join('\n');
    namesEl.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); create(); }
  });

  updatePreview();
})();
