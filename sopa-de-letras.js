/* =====================================================================
   Sopa de letras · Dinamiclase
   - Genera la sopa con tus palabras (hasta 30): fácil, con diagonales o al revés
   - Tamaño automático o fijo (10, 15, 20); avisa de lo que no cabe
   - «palabra - pista»: la ficha muestra la pista y se busca la palabra
   - Se resuelve en pantalla arrastrando de la primera a la última letra
   - Imprime la ficha (con línea de nombre y fecha) y, si quieres, la solución
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { sfx, store, escapeHTML } = DC.utils;
  const $ = (s) => document.querySelector(s);
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

  const DIRS = {
    facil: [[0, 1], [1, 0]],
    media: [[0, 1], [1, 0], [1, 1], [-1, 1]],
    dificil: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]],
  };
  // Letras de relleno con una frecuencia parecida a la del español
  const FILL = 'AAAAAAAAAAAABBCCCCDDDDDEEEEEEEEEEEEEFGGHIIIIIIJLLLLLMMMNNNNNNNÑOOOOOOOOOPPQRRRRRRSSSSSSSTTTTUUUUVXYZ';
  const MARKS = ['#FFD3B8', '#C9D8FF', '#C3F0CA', '#FBCFE8', '#DDD0FE', '#BDE9FA', '#FFE7A3', '#B9EFE6'];
  const MAX_WORDS = 30;

  const wordsEl = $('#wsWords');
  const titleEl = $('#wsTitle');
  const gridEl = $('#grid');
  const marksEl = $('#marks');
  const listEl = $('#wordList');
  const solveBtn = $('#solveBtn');

  /* ---------- Ajustes ---------- */
  const settings = store.get('sopa-ajustes', {});
  const setRadio = (name, value) => {
    const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  };
  if (settings.dir) setRadio('wsDir', settings.dir);
  if (settings.size) setRadio('wsSize', settings.size);

  /* ---------- Palabras ---------- */
  /** Mayúsculas sin acentos ni espacios (la Ñ se mantiene). */
  const clean = (w) => Array.from(w.toLocaleUpperCase('es'))
    .map((ch) => (ch === 'Ñ' ? 'Ñ' : ch.normalize('NFD').replace(/[̀-ͯ]/g, '')))
    .join('')
    .replace(/[^A-ZÑ]/g, '');

  const SEPARATORS = ['\t', '|', ' – ', ' — ', ' - ', ':', '='];
  function readWords() {
    const seen = new Set();
    const items = [];
    wordsEl.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
      let word = line;
      let clue = '';
      for (const sep of SEPARATORS) {
        const i = line.indexOf(sep);
        if (i > 0) { word = line.slice(0, i).trim(); clue = line.slice(i + sep.length).trim(); break; }
      }
      const answer = clean(word);
      if (answer.length < 2 || seen.has(answer)) return;
      seen.add(answer);
      items.push({ answer, word, clue });
    });
    return { items: items.slice(0, MAX_WORDS), extra: Math.max(0, items.length - MAX_WORDS) };
  }

  /* ---------- Generador ---------- */
  function tryBuild(items, n, dirs) {
    const grid = Array(n * n).fill('');
    const placed = [];
    const missing = [];
    [...items].sort((a, b) => b.answer.length - a.answer.length).forEach((it) => {
      const w = it.answer;
      const options = [];
      if (w.length <= n) {
        for (const [dr, dc] of dirs) {
          for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
              const er = r + dr * (w.length - 1);
              const ec = c + dc * (w.length - 1);
              if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
              let overlap = 0;
              let ok = true;
              for (let k = 0; k < w.length; k++) {
                const ch = grid[(r + dr * k) * n + c + dc * k];
                if (ch) {
                  if (ch !== w[k]) { ok = false; break; }
                  overlap += 1;
                }
              }
              if (ok && overlap < w.length) options.push({ r, c, dr, dc, overlap });
            }
          }
        }
      }
      if (!options.length) {
        missing.push(it);
        return;
      }
      // A veces se prefieren los cruces: la sopa queda más compacta y más difícil
      const crossing = options.filter((o) => o.overlap > 0);
      const pool = crossing.length && Math.random() < 0.6 ? crossing : options;
      const o = pool[Math.floor(Math.random() * pool.length)];
      for (let k = 0; k < w.length; k++) grid[(o.r + o.dr * k) * n + o.c + o.dc * k] = w[k];
      placed.push({ ...it, r: o.r, c: o.c, dr: o.dr, dc: o.dc });
    });
    return { grid, placed, missing };
  }

  function generate(items, sizeSetting, level) {
    const dirs = DIRS[level] || DIRS.facil;
    const longest = Math.max(0, ...items.map((i) => i.answer.length));
    const letters = items.reduce((a, i) => a + i.answer.length, 0);
    const auto = sizeSetting === 'auto';
    let n = auto ? Math.min(22, Math.max(8, longest, Math.ceil(Math.sqrt(letters * 1.9)))) : Number(sizeSetting);
    let best = null;
    for (let grow = 0; grow < 8; grow++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const res = tryBuild(items, n, dirs);
        if (!best || res.placed.length > best.placed.length) best = { ...res, n };
        if (!res.missing.length) break;
      }
      if (!best.missing.length || !auto || n >= 22) break;
      n += 1;
    }
    best.grid = best.grid.map((ch) => ch || FILL[Math.floor(Math.random() * FILL.length)]);
    return best;
  }

  /* ---------- Estado ---------- */
  let puzzle = null; // { n, grid, placed, missing, found, sig }
  let showAll = false;
  const signature = () => JSON.stringify([wordsEl.value, radio('wsDir'), radio('wsSize')]);
  const save = () => store.set('sopa-partida', puzzle);

  function newPuzzle() {
    const { items, extra } = readWords();
    store.set('sopa-ajustes', { dir: radio('wsDir'), size: radio('wsSize') });
    showAll = false;
    if (!items.length) {
      puzzle = null;
      render();
      return;
    }
    const res = generate(items, radio('wsSize'), radio('wsDir'));
    puzzle = { n: res.n, grid: res.grid, placed: res.placed, missing: res.missing.map((m) => m.word), extra, found: [], sig: signature() };
    save();
    render();
  }

  /* ---------- Pintado ---------- */
  const markLine = (w, color, cls = '') => {
    const x1 = w.c + 0.5;
    const y1 = w.r + 0.5;
    const x2 = w.c + w.dc * (w.answer.length - 1) + 0.5;
    const y2 = w.r + w.dr * (w.answer.length - 1) + 0.5;
    return `<line class="ws-mark__edge ${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`
      + `<line class="ws-mark__fill ${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:${color}"/>`;
  };

  function boardHTML(withAll) {
    const { n, grid } = puzzle;
    const cells = grid.map((ch, i) => `<span class="ws-cell" data-i="${i}">${ch}</span>`).join('');
    const marks = puzzle.placed.map((w, i) => (withAll || puzzle.found.includes(i)
      ? markLine(w, MARKS[i % MARKS.length], puzzle.found.includes(i) ? '' : 'is-solution') : '')).join('');
    return { cells, marks, n };
  }

  const itemLabel = (w) => escapeHTML(w.clue || w.word);

  function render() {
    $('#sheetTitle').textContent = titleEl.value.trim() || 'Sopa de letras';
    const warn = $('#wsWarn');
    const n = readWords().items.length;
    $('#wsCount').textContent = `${n} ${n === 1 ? 'palabra' : 'palabras'}`;
    if (!puzzle) {
      gridEl.innerHTML = '';
      marksEl.innerHTML = '';
      listEl.innerHTML = '';
      gridEl.closest('.ws-board').hidden = true;
      warn.hidden = false;
      warn.innerHTML = '<i class="bi bi-info-circle-fill" aria-hidden="true"></i><span>Escribe al menos una palabra de dos letras para crear la sopa.</span>';
      $('#foundCount').textContent = '0 de 0';
      return;
    }
    gridEl.closest('.ws-board').hidden = false;
    const { cells, marks } = boardHTML(showAll);
    gridEl.style.setProperty('--n', puzzle.n);
    gridEl.innerHTML = cells;
    marksEl.setAttribute('viewBox', `0 0 ${puzzle.n} ${puzzle.n}`);
    marksEl.innerHTML = marks + '<line class="ws-mark__drag" id="dragLine" x1="0" y1="0" x2="0" y2="0" visibility="hidden"/>';
    listEl.innerHTML = [...puzzle.placed]
      .map((w, i) => ({ w, i }))
      .sort((a, b) => a.w.word.localeCompare(b.w.word, 'es'))
      .map(({ w, i }) => `<li class="ws-word${puzzle.found.includes(i) ? ' is-found' : ''}" style="--mk:${MARKS[i % MARKS.length]}">${itemLabel(w)}</li>`).join('');
    const problems = [];
    if (puzzle.missing.length) problems.push(`No ${puzzle.missing.length === 1 ? 'cupo' : 'cupieron'}: ${escapeHTML(puzzle.missing.join(', '))}. Elige un tamaño mayor o «Automático».`);
    if (puzzle.extra) problems.push(`Solo se usan las primeras ${MAX_WORDS} palabras.`);
    warn.hidden = !problems.length;
    warn.innerHTML = problems.length ? `<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><span>${problems.join(' ')}</span>` : '';
    $('#foundCount').textContent = `${puzzle.found.length} de ${puzzle.placed.length}`;
    solveBtn.setAttribute('aria-pressed', String(showAll));
  }

  /** Hoja de solución (solo para imprimir). */
  function buildSolution() {
    const sol = $('#solution');
    if (!puzzle || !$('#wsPrintSolution').checked) {
      sol.innerHTML = '';
      return;
    }
    const { cells, n } = boardHTML(true);
    const marks = puzzle.placed.map((w, i) => markLine(w, MARKS[i % MARKS.length])).join('');
    sol.innerHTML = `<header class="ws-head"><h2 class="ws-title">${escapeHTML(titleEl.value.trim() || 'Sopa de letras')} · Solución</h2></header>
      <div class="ws-board"><div class="ws-grid" style="--n:${n}">${cells}</div>
      <svg class="ws-marks" viewBox="0 0 ${n} ${n}" aria-hidden="true">${marks}</svg></div>
      <ul class="ws-words">${puzzle.placed.map((w) => `<li class="ws-word">${itemLabel(w)}${w.clue ? ` → ${escapeHTML(w.answer)}` : ''}</li>`).join('')}</ul>`;
  }

  /* ---------- Marcar palabras arrastrando ---------- */
  let drag = null;
  function cellAt(e) {
    const rect = gridEl.getBoundingClientRect();
    const size = rect.width / puzzle.n;
    const c = Math.floor((e.clientX - rect.left) / size);
    const r = Math.floor((e.clientY - rect.top) / size);
    return [Math.min(puzzle.n - 1, Math.max(0, r)), Math.min(puzzle.n - 1, Math.max(0, c))];
  }
  /** Ajusta el final a la línea recta (horizontal, vertical o diagonal) más cercana. */
  function snap([r0, c0], [r, c]) {
    const dr = r - r0;
    const dc = c - c0;
    if (!dr && !dc) return [r0, c0];
    const angle = Math.round(Math.atan2(dr, dc) / (Math.PI / 4)) * (Math.PI / 4);
    const sr = Math.round(Math.sin(angle));
    const sc = Math.round(Math.cos(angle));
    let len = Math.max(Math.abs(dr), Math.abs(dc));
    while (len > 0 && (r0 + sr * len < 0 || r0 + sr * len >= puzzle.n || c0 + sc * len < 0 || c0 + sc * len >= puzzle.n)) len -= 1;
    return [r0 + sr * len, c0 + sc * len];
  }
  function drawDrag() {
    const line = $('#dragLine');
    if (!drag) { line.setAttribute('visibility', 'hidden'); return; }
    const [[r1, c1], [r2, c2]] = [drag.start, drag.end];
    line.setAttribute('x1', c1 + 0.5);
    line.setAttribute('y1', r1 + 0.5);
    line.setAttribute('x2', c2 + 0.5);
    line.setAttribute('y2', r2 + 0.5);
    line.setAttribute('visibility', 'visible');
  }

  const board = $('#board');
  board.addEventListener('pointerdown', (e) => {
    if (!puzzle || e.button !== 0) return;
    const start = cellAt(e);
    drag = { start, end: start };
    board.setPointerCapture(e.pointerId);
    drawDrag();
    e.preventDefault();
  });
  board.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.end = snap(drag.start, cellAt(e));
    drawDrag();
  });
  const endDrag = () => {
    if (!drag) return;
    const { start, end } = drag;
    drag = null;
    drawDrag();
    const same = (a, b) => a[0] === b[0] && a[1] === b[1];
    const idx = puzzle.placed.findIndex((w) => {
      const a = [w.r, w.c];
      const b = [w.r + w.dr * (w.answer.length - 1), w.c + w.dc * (w.answer.length - 1)];
      return (same(a, start) && same(b, end)) || (same(a, end) && same(b, start));
    });
    if (idx < 0 || puzzle.found.includes(idx)) {
      if (!same(start, end)) sfx('tick');
      return;
    }
    puzzle.found.push(idx);
    save();
    render();
    if (puzzle.found.length === puzzle.placed.length) {
      sfx('win');
      DC.confetti({ count: 150 });
      DC.toast({ title: '¡Sopa completa!', text: `Encontraron las ${puzzle.placed.length} palabras.`, icon: 'bi-trophy-fill', theme: 'yellow' });
    } else sfx('pop');
  };
  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', endDrag);

  /* ---------- Eventos ---------- */
  $('#newBtn').addEventListener('click', () => { newPuzzle(); sfx('pop'); });
  solveBtn.addEventListener('click', () => {
    if (!puzzle) return;
    showAll = !showAll;
    render();
  });
  $('#printBtn').addEventListener('click', () => window.print());
  window.addEventListener('beforeprint', buildSolution);
  titleEl.addEventListener('input', render);

  let regen;
  const onChange = () => {
    clearTimeout(regen);
    regen = setTimeout(newPuzzle, 500);
  };
  wordsEl.addEventListener('input', onChange);
  document.querySelectorAll('input[name="wsDir"], input[name="wsSize"]').forEach((r) => r.addEventListener('change', onChange));

  /* ---------- Inicio ---------- */
  const saved = store.get('sopa-partida', null);
  if (saved && saved.sig === signature() && Array.isArray(saved.grid)) {
    puzzle = saved;
    render();
  } else newPuzzle();
})();
