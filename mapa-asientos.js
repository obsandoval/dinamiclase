/* =====================================================================
   Mapa de asientos · Dinamiclase
   - Acomoda la lista de estudiantes al azar en una cuadrícula de pupitres
   - Pupitres individuales, por parejas o en mesas de 4
   - Intercambiar dos pupitres o bloquear los que no se usan
   - Vista desde el fondo (pizarra arriba) o desde el frente
   - El mapa se recuerda y se imprime en horizontal
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, parseList, sfx, store, escapeHTML } = DC.utils;
  const $ = (s) => document.querySelector(s);
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

  const studentsEl = $('#students');
  const rowsEl = $('#rows');
  const colsEl = $('#cols');
  const gridEl = $('#grid');
  const groupEl = $('#groupName');

  let st = { rows: 5, cols: 6, layout: '1x1', fill: 'front', seats: [], locked: [], flipped: false };
  let selected = -1;

  const save = () => store.set('asientos-estado', st);
  const readStudents = () => parseList(studentsEl.value);
  const isLocked = (i) => st.locked.includes(i);

  /** Pupitres libres y disponibles, en el orden en que se ocupan. */
  function freeSeats(order = st.fill) {
    const free = st.seats.map((n, i) => i).filter((i) => !st.seats[i] && !isLocked(i));
    return order === 'random' ? shuffle(free) : free; // índice por filas: la fila 0 es la del frente
  }

  /** Nombres de la lista que no tienen pupitre (respeta nombres repetidos). */
  function unseated() {
    const left = readStudents();
    st.seats.forEach((n) => {
      const k = n ? left.indexOf(n) : -1;
      if (k >= 0) left.splice(k, 1);
    });
    return left;
  }

  function placeAll() {
    st.seats = Array(st.rows * st.cols).fill(null);
    const names = shuffle(readStudents());
    freeSeats().slice(0, names.length).forEach((seat, k) => { st.seats[seat] = names[k]; });
  }

  /** Aplica cambios de la lista sin mover a quien ya tiene sitio. */
  function sync() {
    const pending = readStudents();
    st.seats = st.seats.map((n) => {
      const k = n ? pending.indexOf(n) : -1;
      if (k < 0) return null;
      pending.splice(k, 1);
      return n;
    });
    const free = freeSeats();
    shuffle(pending).forEach((name, k) => { if (k < free.length) st.seats[free[k]] = name; });
  }

  /** Cambia filas o columnas conservando la posición de cada pupitre que sigue existiendo. */
  function relayout(rows, cols) {
    const old = st;
    const seats = Array(rows * cols).fill(null);
    const locked = [];
    const overflow = [];
    old.seats.forEach((name, i) => {
      const r = Math.floor(i / old.cols);
      const c = i % old.cols;
      const inside = r < rows && c < cols;
      if (inside && isLocked(i)) locked.push(r * cols + c);
      if (!name) return;
      if (inside) seats[r * cols + c] = name;
      else overflow.push(name);
    });
    st = { ...old, rows, cols, seats, locked };
    const free = freeSeats('front');
    overflow.forEach((name, k) => { if (k < free.length) st.seats[free[k]] = name; });
  }

  /* ---------- Pintado ---------- */
  function render() {
    const { rows, cols } = st;
    const [gx, gy] = st.layout.split('x').map(Number);
    // Con la vista girada, los grupos se reflejan: se calculan sobre la posición real
    const colGroups = (vc) => Math.floor((st.flipped ? cols - 1 - vc : vc) / gx);
    const rowGroups = (vr) => Math.floor((st.flipped ? rows - 1 - vr : vr) / gy);
    const viewTracks = (count, groupOf) => Array.from({ length: count }, (_, k) => (k < count - 1
      ? `minmax(0, 1fr) ${groupOf(k) !== groupOf(k + 1) ? 'var(--aisle)' : 'var(--join)'}`
      : 'minmax(0, 1fr)')).join(' ');
    // Entre pupitres del mismo grupo, una junta; entre grupos, un pasillo
    gridEl.style.gridTemplateColumns = viewTracks(cols, colGroups);
    gridEl.style.gridTemplateRows = viewTracks(rows, rowGroups);
    gridEl.style.setProperty('--cols', cols);
    gridEl.style.setProperty('--rows', rows);

    let html = '';
    st.seats.forEach((name, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const vr = st.flipped ? rows - 1 - r : r;
      const vc = st.flipped ? cols - 1 - c : c;
      const joinR = vc < cols - 1 && colGroups(vc) === colGroups(vc + 1);
      const joinL = vc > 0 && colGroups(vc) === colGroups(vc - 1);
      const joinB = vr < rows - 1 && rowGroups(vr) === rowGroups(vr + 1);
      const joinT = vr > 0 && rowGroups(vr) === rowGroups(vr - 1);
      const locked = isLocked(i);
      const cls = ['as-desk', locked ? 'is-locked' : name ? '' : 'is-empty', i === selected ? 'is-sel' : '',
        joinR ? 'join-r' : '', joinL ? 'join-l' : '', joinB ? 'join-b' : '', joinT ? 'join-t' : ''].filter(Boolean).join(' ');
      const label = locked ? 'Pupitre no disponible' : name || 'Libre';
      const len = name && name.length > 18 ? ' data-long' : '';
      html += `<button class="${cls}" type="button" data-i="${i}" style="grid-row:${2 * vr + 1}; grid-column:${2 * vc + 1}"
        aria-label="Fila ${r + 1}, columna ${c + 1}: ${escapeHTML(label)}"${len}>${locked
        ? '<i class="bi bi-x-lg" aria-hidden="true"></i>'
        : `<span class="as-desk__name">${escapeHTML(name || 'Libre')}</span>`}</button>`;
    });
    gridEl.innerHTML = html;
    $('#room').classList.toggle('is-flipped', st.flipped);
    $('#flipBtn').setAttribute('aria-pressed', String(st.flipped));

    const students = readStudents().length;
    const total = rows * cols;
    const available = total - st.locked.length;
    const seated = st.seats.filter(Boolean).length;
    $('#studentsCount').textContent = `${students} ${students === 1 ? 'estudiante' : 'estudiantes'}`;
    $('#stats').textContent = `${seated} de ${students} ${students === 1 ? 'estudiante sentado' : 'estudiantes sentados'} · ${available} ${available === 1 ? 'pupitre disponible' : 'pupitres disponibles'}${st.locked.length ? ` (${st.locked.length} bloqueados)` : ''}`;
    const missing = unseated();
    const warn = $('#seatWarn');
    warn.hidden = missing.length === 0;
    if (missing.length) {
      warn.innerHTML = `<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><span>${missing.length === 1 ? 'Falta 1 pupitre' : `Faltan ${missing.length} pupitres`}: ${escapeHTML(missing.join(', '))}. Añade filas o columnas, o desbloquea algún pupitre.</span>`;
    }
    $('#mapTitle').textContent = groupEl.value.trim() ? `Mapa del salón · ${groupEl.value.trim()}` : 'Mapa del salón';
  }

  /* ---------- Acciones ---------- */
  function shuffleSeats() {
    selected = -1;
    placeAll();
    render();
    save();
    sfx('pop');
    gridEl.classList.remove('is-shuffling');
    void gridEl.offsetWidth;
    gridEl.classList.add('is-shuffling');
  }

  function onDesk(i) {
    if (radio('asMode') === 'lock') {
      selected = -1;
      if (isLocked(i)) st.locked = st.locked.filter((k) => k !== i);
      else {
        st.locked.push(i);
        const name = st.seats[i];
        st.seats[i] = null;
        if (name) {
          const free = freeSeats('front');
          if (free.length) st.seats[free[0]] = name; // si no hay sitio, aparece en el aviso de «faltan pupitres»
        }
      }
      sfx('click');
    } else {
      if (isLocked(i)) {
        DC.toast({ title: 'Pupitre bloqueado', text: 'Cambia a «Bloquear» y tócalo para volver a usarlo.', icon: 'bi-slash-circle', theme: 'blue', timeout: 2600 });
        return;
      }
      if (selected < 0) selected = i;
      else if (selected === i) selected = -1;
      else {
        [st.seats[selected], st.seats[i]] = [st.seats[i], st.seats[selected]];
        selected = -1;
        sfx('pop');
      }
    }
    render();
    save();
    gridEl.querySelector(`[data-i="${i}"]`)?.focus({ preventScroll: true });
  }

  /* ---------- Eventos ---------- */
  gridEl.addEventListener('click', (e) => {
    const d = e.target.closest('.as-desk');
    if (d) onDesk(Number(d.dataset.i));
  });
  $('#shuffleBtn').addEventListener('click', shuffleSeats);
  $('#printBtn').addEventListener('click', () => {
    selected = -1;
    render();
    window.print();
  });
  $('#flipBtn').addEventListener('click', () => {
    st.flipped = !st.flipped;
    render();
    save();
  });
  document.querySelectorAll('input[name="asMode"]').forEach((r) => r.addEventListener('change', () => {
    selected = -1;
    $('#modeHint').textContent = r.value === 'lock'
      ? 'Toca un pupitre para bloquearlo (por ejemplo, si está roto) o para volver a usarlo.'
      : 'Toca dos pupitres para intercambiarlos.';
    render();
  }));
  document.querySelectorAll('input[name="asLayout"]').forEach((r) => r.addEventListener('change', () => {
    st.layout = r.value;
    render();
    save();
  }));
  document.querySelectorAll('input[name="asFill"]').forEach((r) => r.addEventListener('change', () => {
    st.fill = r.value;
    save();
  }));
  let dimTimer;
  [rowsEl, colsEl].forEach((el) => el.addEventListener('input', () => {
    clearTimeout(dimTimer);
    dimTimer = setTimeout(() => {
      const rows = Math.min(12, Math.max(1, Number(rowsEl.value) || 1));
      const cols = Math.min(12, Math.max(1, Number(colsEl.value) || 1));
      if (rows === st.rows && cols === st.cols) return;
      selected = -1;
      relayout(rows, cols);
      sync();
      render();
      save();
    }, 150);
  }));
  let listTimer;
  studentsEl.addEventListener('input', () => {
    clearTimeout(listTimer);
    listTimer = setTimeout(() => { sync(); render(); save(); }, 400);
  });
  groupEl.addEventListener('input', render);

  /* ---------- Inicio ---------- */
  const saved = store.get('asientos-estado', null);
  if (saved && saved.rows * saved.cols === saved.seats?.length) {
    st = { ...st, ...saved, locked: saved.locked || [] };
    sync(); // la lista pudo cambiar en otra herramienta
  } else {
    placeAll();
  }
  rowsEl.value = st.rows;
  colsEl.value = st.cols;
  const setRadio = (name, value) => {
    const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  };
  setRadio('asLayout', st.layout);
  setRadio('asFill', st.fill);
  $('#printDate').textContent = new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(new Date());
  render();
  save();
})();
