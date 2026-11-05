/* =====================================================================
   Sudoku · Dinamiclase
   - Genera sudokus nuevos con solución única: 4×4, 6×6 y 9×9, tres niveles
   - Notas, pistas, deshacer, comprobar y ver la solución
   - Teclado (números, flechas, N, Supr) y teclado en pantalla
   - La partida se recuerda; «Imprimir» saca solo los números iniciales
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, sfx, store } = DC.utils;
  const $ = (s) => document.querySelector(s);
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

  const BOX = { 4: [2, 2], 6: [2, 3], 9: [3, 3] };          // [filas, columnas] de cada caja
  const CLUES = { 4: { facil: 10, media: 8, dificil: 6 }, 6: { facil: 22, media: 17, dificil: 13 }, 9: { facil: 40, media: 32, dificil: 26 } };
  const LEVEL_NAMES = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };

  const boardEl = $('#board');
  const padEl = $('#pad');
  const statusEl = $('#status');
  const timerEl = $('#timer span');
  const errorsEl = $('#showErrors');
  const sameEl = $('#showSame');
  const notesBtn = $('#notesBtn');

  /* ---------- Geometría ---------- */
  const peersCache = {};
  function peersOf(n) {
    if (peersCache[n]) return peersCache[n];
    const [br, bc] = BOX[n];
    const list = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const set = new Set();
      for (let k = 0; k < n; k++) { set.add(r * n + k); set.add(k * n + c); }
      const r0 = r - (r % br);
      const c0 = c - (c % bc);
      for (let y = r0; y < r0 + br; y++) for (let x = c0; x < c0 + bc; x++) set.add(y * n + x);
      set.delete(i);
      list.push([...set]);
    }
    peersCache[n] = list;
    return list;
  }

  /* ---------- Resolver / generar (bits: el bit k es el número k + 1) ---------- */
  const bitCount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };

  /** Cuenta soluciones (hasta `limit`). Con `random`, prueba los números en orden aleatorio y devuelve la primera. */
  function solve(grid, n, { limit = 2, random = false } = {}) {
    const peers = peersOf(n);
    const full = (1 << n) - 1;
    const g = grid.slice();
    let count = 0;
    let first = null;
    const candidates = (i) => {
      let used = 0;
      for (const p of peers[i]) if (g[p]) used |= 1 << (g[p] - 1);
      return full & ~used;
    };
    function rec() {
      let best = -1;
      let bestMask = 0;
      let bestCount = 99;
      for (let i = 0; i < g.length; i++) {
        if (g[i]) continue;
        const m = candidates(i);
        const c = bitCount(m);
        if (c === 0) return false;
        if (c < bestCount) { best = i; bestMask = m; bestCount = c; if (c === 1) break; }
      }
      if (best === -1) {
        count += 1;
        if (!first) first = g.slice();
        return count >= limit;
      }
      let values = [];
      for (let v = 1; v <= n; v++) if (bestMask & (1 << (v - 1))) values.push(v);
      if (random) values = shuffle(values);
      for (const v of values) {
        g[best] = v;
        if (rec()) return true;
      }
      g[best] = 0;
      return false;
    }
    rec();
    return { count, solution: first };
  }

  function generate(n, level) {
    const solution = solve(Array(n * n).fill(0), n, { limit: 1, random: true }).solution;
    const puzzle = solution.slice();
    let filled = n * n;
    const target = CLUES[n][level];
    for (const i of shuffle([...puzzle.keys()])) {
      if (filled <= target) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (solve(puzzle, n).count !== 1) puzzle[i] = keep;
      else filled -= 1;
    }
    return { puzzle, solution };
  }

  /* ---------- Estado ---------- */
  let game = null;   // { n, level, puzzle, solution, values, notes, hinted, elapsed, over }
  let sel = -1;
  let notesMode = false;
  let history = [];
  let flashWrong = false;

  const save = () => store.set('sudoku-partida', game);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const isGiven = (i) => game.puzzle[i] !== 0;
  const valueAt = (i) => game.puzzle[i] || game.values[i];

  function newGame() {
    const n = Number(radio('sdSize')) || 9;
    const level = radio('sdLevel') || 'facil';
    store.set('sudoku-ajustes', { n, level, errors: errorsEl.checked, same: sameEl.checked });
    statusEl.textContent = 'Creando un sudoku nuevo…';
    boardEl.classList.add('is-loading');
    // setTimeout: deja que se pinte el mensaje antes de calcular
    setTimeout(() => {
      const { puzzle, solution } = generate(n, level);
      game = { n, level, puzzle, solution, values: Array(n * n).fill(0), notes: Array(n * n).fill(0), hinted: [], elapsed: 0, over: false };
      history = [];
      sel = -1;
      boardEl.classList.remove('is-loading');
      build();
      setStatus(`Toca una casilla vacía y elige un número del 1 al ${n}.`);
      save();
    }, 30);
  }

  /* ---------- Pintado ---------- */
  function build() {
    const { n } = game;
    const [br, bc] = BOX[n];
    $('#sdTitle').textContent = `Sudoku ${n}×${n} · ${LEVEL_NAMES[game.level]}`;
    boardEl.style.setProperty('--n', n);
    boardEl.style.setProperty('--box-cols', n / bc);
    boardEl.style.setProperty('--bc', bc);
    let html = '';
    for (let by = 0; by < n / br; by++) {
      for (let bx = 0; bx < n / bc; bx++) {
        html += '<div class="sd-box" role="presentation">';
        for (let y = 0; y < br; y++) {
          for (let x = 0; x < bc; x++) {
            const r = by * br + y;
            const c = bx * bc + x;
            html += `<button class="sd-cell" type="button" role="gridcell" data-i="${r * n + c}"></button>`;
          }
        }
        html += '</div>';
      }
    }
    boardEl.innerHTML = html;
    padEl.style.setProperty('--n', n);
    padEl.innerHTML = Array.from({ length: n }, (_, k) => `<button class="sd-key" type="button" data-v="${k + 1}">${k + 1}<small></small></button>`).join('');
    render();
  }

  function render() {
    const { n } = game;
    const peers = peersOf(n);
    const selPeers = sel >= 0 ? new Set(peers[sel]) : new Set();
    const selVal = sel >= 0 ? valueAt(sel) : 0;
    const [, bc] = BOX[n];
    boardEl.querySelectorAll('.sd-cell').forEach((el) => {
      const i = Number(el.dataset.i);
      const v = valueAt(i);
      const given = isGiven(i);
      const conflict = v && peers[i].some((p) => valueAt(p) === v);
      const wrong = v && !given && v !== game.solution[i] && (errorsEl.checked || flashWrong);
      el.className = 'sd-cell'
        + (given ? ' is-given' : '')
        + (i === sel ? ' is-sel' : '')
        + (selPeers.has(i) ? ' is-peer' : '')
        + (sameEl.checked && selVal && v === selVal && i !== sel ? ' is-same' : '')
        + (conflict ? ' is-conflict' : '')
        + (wrong ? ' is-wrong' : '')
        + (game.hinted.includes(i) ? ' is-hint' : '');
      if (v) {
        el.innerHTML = `<span class="sd-v">${v}</span>`;
      } else if (game.notes[i]) {
        let notes = '';
        for (let k = 1; k <= n; k++) notes += `<i>${game.notes[i] & (1 << (k - 1)) ? k : ''}</i>`;
        el.innerHTML = `<span class="sd-notes" style="--bc:${bc}">${notes}</span>`;
      } else el.innerHTML = '';
      const r = Math.floor(i / n) + 1;
      const c = (i % n) + 1;
      el.setAttribute('aria-label', `Fila ${r}, columna ${c}: ${v || 'vacía'}${given ? ' (fija)' : ''}`);
      el.tabIndex = i === (sel >= 0 ? sel : 0) ? 0 : -1;
    });
    // Cuántas veces falta cada número (cuenta lo escrito, acierte o no, para no delatar errores)
    padEl.querySelectorAll('.sd-key').forEach((b) => {
      const v = Number(b.dataset.v);
      const placed = game.solution.filter((_, i) => valueAt(i) === v).length;
      const left = n - placed;
      b.querySelector('small').textContent = left > 0 ? left : '✓';
      b.classList.toggle('is-done', left <= 0);
      b.disabled = game.over;
    });
    notesBtn.setAttribute('aria-pressed', String(notesMode));
    timerEl.textContent = fmt(game.elapsed);
    boardEl.classList.toggle('is-over', game.over);
  }

  function setStatus(text, tone = '') {
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }

  /* ---------- Jugadas ---------- */
  function select(i) {
    sel = i;
    render();
    boardEl.querySelector(`[data-i="${i}"]`)?.focus({ preventScroll: true });
  }

  function input(v) {
    if (!game || game.over || sel < 0 || isGiven(sel)) return;
    const i = sel;
    const before = { i, value: game.values[i], notes: game.notes[i], peerNotes: null };
    if (notesMode && v) {
      if (game.values[i]) return;
      game.notes[i] ^= 1 << (v - 1);
    } else {
      game.values[i] = game.values[i] === v ? 0 : v;
      game.notes[i] = 0;
      if (game.values[i]) {
        // Quita ese número de las notas de su fila, columna y caja
        before.peerNotes = peersOf(game.n)[i].map((p) => [p, game.notes[p]]);
        peersOf(game.n)[i].forEach((p) => { game.notes[p] &= ~(1 << (v - 1)); });
      }
    }
    history.push(before);
    game.hinted = game.hinted.filter((h) => h !== i);
    sfx('click');
    afterMove();
  }

  function erase() {
    if (!game || game.over || sel < 0 || isGiven(sel)) return;
    if (!game.values[sel] && !game.notes[sel]) return;
    history.push({ i: sel, value: game.values[sel], notes: game.notes[sel], peerNotes: null });
    game.values[sel] = 0;
    game.notes[sel] = 0;
    afterMove();
  }

  function undo() {
    const last = history.pop();
    if (!last || game.over) return;
    game.values[last.i] = last.value;
    game.notes[last.i] = last.notes;
    if (last.peerNotes) last.peerNotes.forEach(([p, m]) => { game.notes[p] = m; });
    sel = last.i;
    afterMove();
  }

  function afterMove() {
    flashWrong = false;
    render();
    save();
    const done = game.solution.every((s, i) => valueAt(i) === s);
    if (done) win();
  }

  function win() {
    game.over = true;
    sel = -1;
    render();
    save();
    sfx('win');
    DC.confetti({ count: 160 });
    const extra = game.hinted.length ? ` con ${game.hinted.length} ${game.hinted.length === 1 ? 'pista' : 'pistas'}` : '';
    setStatus(`¡Sudoku resuelto en ${fmt(game.elapsed)}${extra}!`, 'ok');
    DC.toast({ title: '¡Sudoku resuelto!', text: `Tiempo: ${fmt(game.elapsed)}${extra}.`, icon: 'bi-trophy-fill', theme: 'yellow' });
  }

  function hint() {
    if (!game || game.over) return;
    const needs = (i) => !isGiven(i) && game.values[i] !== game.solution[i];
    let i = sel >= 0 && needs(sel) ? sel : -1;
    if (i < 0) {
      const options = game.solution.map((_, k) => k).filter(needs);
      if (!options.length) return;
      i = options[Math.floor(Math.random() * options.length)];
    }
    history.push({ i, value: game.values[i], notes: game.notes[i], peerNotes: null });
    game.values[i] = game.solution[i];
    game.notes[i] = 0;
    if (!game.hinted.includes(i)) game.hinted.push(i);
    sel = i;
    sfx('soft');
    setStatus(`Pista: en la fila ${Math.floor(i / game.n) + 1}, columna ${(i % game.n) + 1} va un ${game.solution[i]}.`);
    afterMove();
  }

  function check() {
    if (!game || game.over) return;
    const wrong = game.values.filter((v, i) => v && v !== game.solution[i]).length;
    const empty = game.solution.filter((_, i) => !valueAt(i)).length;
    flashWrong = true;
    render();
    if (wrong) {
      setStatus(`${wrong === 1 ? 'Hay 1 número que no va' : `Hay ${wrong} números que no van`} ahí: están en rojo.`, 'miss');
      sfx('flip');
    } else {
      setStatus(`¡Todo correcto hasta ahora! ${empty === 1 ? 'Queda 1 casilla' : `Quedan ${empty} casillas`}.`, 'ok');
      sfx('soft');
    }
    setTimeout(() => { flashWrong = false; if (game) render(); }, 3000);
  }

  function showSolution() {
    if (!game || game.over) return;
    if (!window.confirm('¿Mostrar la solución? La partida terminará.')) return;
    game.values = game.solution.map((s, i) => (isGiven(i) ? 0 : s));
    game.notes = game.notes.map(() => 0);
    game.over = true;
    sel = -1;
    render();
    save();
    setStatus('Esta es la solución. Pulsa «Nuevo sudoku» para jugar otro.');
  }

  function restart() {
    if (!game) return;
    const progress = game.values.some(Boolean) || game.notes.some(Boolean);
    if (progress && !game.over && !window.confirm('¿Borrar todos tus números y empezar este sudoku de nuevo?')) return;
    Object.assign(game, { values: game.values.map(() => 0), notes: game.notes.map(() => 0), hinted: [], elapsed: 0, over: false });
    history = [];
    sel = -1;
    render();
    save();
    setStatus('Mismo sudoku, desde el principio.');
  }

  /* ---------- Eventos ---------- */
  boardEl.addEventListener('click', (e) => {
    const cell = e.target.closest('.sd-cell');
    if (cell && game) select(Number(cell.dataset.i));
  });
  padEl.addEventListener('click', (e) => {
    const k = e.target.closest('.sd-key');
    if (k) input(Number(k.dataset.v));
  });
  notesBtn.addEventListener('click', () => { notesMode = !notesMode; render(); });
  $('#eraseBtn').addEventListener('click', erase);
  $('#undoBtn').addEventListener('click', undo);
  $('#restartBtn').addEventListener('click', restart);
  $('#hintBtn').addEventListener('click', hint);
  $('#checkBtn').addEventListener('click', check);
  $('#solveBtn').addEventListener('click', showSolution);
  $('#printBtn').addEventListener('click', () => window.print());
  $('#newBtn').addEventListener('click', () => {
    const progress = game && !game.over && game.values.some(Boolean);
    if (progress && !window.confirm('¿Empezar un sudoku nuevo? Se perderá la partida actual.')) return;
    newGame();
  });
  // Cambiar tamaño o nivel: si aún no se ha jugado, se crea otro sudoku al momento
  document.querySelectorAll('input[name="sdSize"], input[name="sdLevel"]').forEach((r) => r.addEventListener('change', () => {
    if (!game || game.over || !game.values.some(Boolean)) newGame();
    else setStatus('Pulsa «Nuevo sudoku» para jugar con el tamaño y la dificultad elegidos.');
  }));
  [errorsEl, sameEl].forEach((el) => el.addEventListener('change', () => {
    store.set('sudoku-ajustes', { n: Number(radio('sdSize')), level: radio('sdLevel'), errors: errorsEl.checked, same: sameEl.checked });
    if (game) render();
  }));

  document.addEventListener('keydown', (e) => {
    if (!game || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.altKey || e.metaKey) return;
    if (e.ctrlKey) {
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      return;
    }
    const { n } = game;
    const move = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (move) {
      e.preventDefault();
      const cur = sel < 0 ? 0 : sel;
      const r = (Math.floor(cur / n) + move[0] + n) % n;
      const c = ((cur % n) + move[1] + n) % n;
      select(r * n + c);
      return;
    }
    if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) { e.preventDefault(); input(Number(e.key)); }
    else if (['Backspace', 'Delete', '0'].includes(e.key)) { e.preventDefault(); erase(); }
    else if (e.key.toLowerCase() === 'n') { notesMode = !notesMode; render(); }
  });

  // Cronómetro: solo avanza con la pestaña visible y la partida en curso
  setInterval(() => {
    if (!game || game.over || document.hidden || boardEl.classList.contains('is-loading')) return;
    game.elapsed += 1;
    timerEl.textContent = fmt(game.elapsed);
    if (game.elapsed % 10 === 0) save();
  }, 1000);

  /* ---------- Inicio ---------- */
  const settings = store.get('sudoku-ajustes', {});
  const setRadio = (name, value) => {
    const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  };
  if (settings.n) setRadio('sdSize', settings.n);
  if (settings.level) setRadio('sdLevel', settings.level);
  if (typeof settings.errors === 'boolean') errorsEl.checked = settings.errors;
  if (typeof settings.same === 'boolean') sameEl.checked = settings.same;

  const saved = store.get('sudoku-partida', null);
  if (saved && BOX[saved.n] && saved.puzzle?.length === saved.n * saved.n) {
    game = { hinted: [], ...saved };
    build();
    setStatus(game.over ? 'Partida terminada. Pulsa «Nuevo sudoku» para jugar otro.' : 'Seguimos con tu sudoku. ¡Ánimo!');
  } else {
    newGame();
  }
})();
