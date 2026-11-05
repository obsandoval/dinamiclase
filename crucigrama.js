/* =====================================================================
   Crucigrama · Dinamiclase
   - Arma el crucigrama solo a partir de «palabra - pista» (hasta 30)
   - Prueba muchas distribuciones y se queda con la que más palabras cruza
   - Se resuelve en pantalla (teclado del ordenador o del móvil)
   - Comprobar, revelar palabra, ver solución
   - Imprime la ficha y, si quieres, una hoja con la solución
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, sfx, store, escapeHTML } = DC.utils;
  const $ = (s) => document.querySelector(s);

  const MAX_WORDS = 30;
  const MAX_SIDE = 24;     // casillas como máximo por lado (para que quepa en una hoja)
  const ATTEMPTS = 60;

  const wordsEl = $('#cwWords');
  const titleEl = $('#cwTitle');
  const boardEl = $('#board');
  const statusEl = $('#status');
  const lengthsEl = $('#cwLengths');

  /* ---------- Palabras ---------- */
  const keyOf = (ch) => {
    const up = ch.toLocaleUpperCase('es');
    if (up === 'Ñ') return 'Ñ';
    const base = up.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return /^[A-Z]$/.test(base) ? base : '';
  };
  const clean = (w) => Array.from(w).map(keyOf).join('');

  const SEPARATORS = ['\t', '|', ' – ', ' — ', ' - ', ':', '='];
  function readWords() {
    const seen = new Set();
    const items = [];
    let noClue = 0;
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
      if (!clue) noClue += 1;
      items.push({ answer, word, clue });
    });
    return { items: items.slice(0, MAX_WORDS), extra: Math.max(0, items.length - MAX_WORDS), noClue };
  }

  /* ---------- Generador ---------- */
  const k = (r, c) => `${r},${c}`;

  function attempt(order) {
    const cells = new Map(); // "r,c" → { ch, h, v } (h/v: índice de la palabra en esa dirección)
    const placed = [];
    let box = null;

    const occupied = (r, c) => cells.has(k(r, c));
    /** Devuelve cuántos cruces tendría la palabra, o 0 si no se puede colocar ahí. */
    function check(w, r, c, dir) {
      const dr = dir === 'v' ? 1 : 0;
      const dc = dir === 'h' ? 1 : 0;
      if (occupied(r - dr, c - dc) || occupied(r + dr * w.length, c + dc * w.length)) return 0;
      let crosses = 0;
      for (let i = 0; i < w.length; i++) {
        const rr = r + dr * i;
        const cc = c + dc * i;
        const cell = cells.get(k(rr, cc));
        if (cell) {
          if (cell.ch !== w[i] || cell[dir] !== undefined) return 0;
          crosses += 1;
        } else if (dir === 'h' ? occupied(rr - 1, cc) || occupied(rr + 1, cc) : occupied(rr, cc - 1) || occupied(rr, cc + 1)) {
          return 0; // formaría palabras de dos letras con sus vecinas
        }
      }
      if (crosses === w.length) return 0;
      const r2 = r + dr * (w.length - 1);
      const c2 = c + dc * (w.length - 1);
      const h = Math.max(box.r2, r2) - Math.min(box.r1, r) + 1;
      const wd = Math.max(box.c2, c2) - Math.min(box.c1, c) + 1;
      if (h > MAX_SIDE || wd > MAX_SIDE) return 0;
      return crosses;
    }
    function put(it, r, c, dir) {
      const dr = dir === 'v' ? 1 : 0;
      const dc = dir === 'h' ? 1 : 0;
      for (let i = 0; i < it.answer.length; i++) {
        const key = k(r + dr * i, c + dc * i);
        const cell = cells.get(key) || { ch: it.answer[i] };
        cell[dir] = placed.length;
        cells.set(key, cell);
      }
      const r2 = r + dr * (it.answer.length - 1);
      const c2 = c + dc * (it.answer.length - 1);
      box = box ? { r1: Math.min(box.r1, r), c1: Math.min(box.c1, c), r2: Math.max(box.r2, r2), c2: Math.max(box.c2, c2) } : { r1: r, c1: c, r2, c2 };
      placed.push({ ...it, r, c, dir });
    }
    function bestSpot(w) {
      let best = null;
      placed.forEach((p) => {
        for (let i = 0; i < p.answer.length; i++) {
          for (let j = 0; j < w.length; j++) {
            if (p.answer[i] !== w[j]) continue;
            const dir = p.dir === 'h' ? 'v' : 'h';
            const r = p.dir === 'h' ? p.r - j : p.r + i;
            const c = p.dir === 'h' ? p.c + i : p.c - j;
            const crosses = check(w, r, c, dir);
            if (!crosses) continue;
            const r2 = r + (dir === 'v' ? w.length - 1 : 0);
            const c2 = c + (dir === 'h' ? w.length - 1 : 0);
            const area = (Math.max(box.r2, r2) - Math.min(box.r1, r) + 1) * (Math.max(box.c2, c2) - Math.min(box.c1, c) + 1);
            const score = crosses * 60 - area + Math.random() * 8;
            if (!best || score > best.score) best = { r, c, dir, score };
          }
        }
      });
      return best;
    }

    put(order[0], 0, 0, Math.random() < 0.5 ? 'h' : 'v');
    let pending = order.slice(1);
    for (let pass = 0; pass < 3 && pending.length; pass++) {
      const left = [];
      pending.forEach((it) => {
        const spot = bestSpot(it.answer);
        if (spot) put(it, spot.r, spot.c, spot.dir);
        else left.push(it);
      });
      if (left.length === pending.length) break;
      pending = left;
    }
    let crosses = 0;
    cells.forEach((cell) => { if (cell.h !== undefined && cell.v !== undefined) crosses += 1; });
    return { placed, missing: pending, box, crosses };
  }

  function layout(items) {
    let best = null;
    for (let a = 0; a < ATTEMPTS; a++) {
      // La primera vez, de la más larga a la más corta; después, con algo de azar
      const order = a === 0
        ? [...items].sort((x, y) => y.answer.length - x.answer.length)
        : shuffle(items).sort((x, y) => (y.answer.length + Math.random() * 4) - (x.answer.length + Math.random() * 4));
      const res = attempt(order);
      const area = (res.box.r2 - res.box.r1 + 1) * (res.box.c2 - res.box.c1 + 1);
      const better = !best
        || res.placed.length > best.placed.length
        || (res.placed.length === best.placed.length && (res.crosses > best.crosses || (res.crosses === best.crosses && area < best.area)));
      if (better) best = { ...res, area };
    }
    // Pasar a coordenadas desde 0 y numerar en orden de lectura
    const { r1, c1, r2, c2 } = best.box;
    const words = best.placed.map((w) => ({ ...w, r: w.r - r1, c: w.c - c1 }));
    const starts = [...new Set(words.map((w) => k(w.r, w.c)))]
      .map((s) => s.split(',').map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const numbers = new Map(starts.map(([r, c], i) => [k(r, c), i + 1]));
    words.forEach((w) => { w.num = numbers.get(k(w.r, w.c)); });
    return { W: c2 - c1 + 1, H: r2 - r1 + 1, words, missing: best.missing.map((m) => m.word) };
  }

  /* ---------- Estado ---------- */
  let puzzle = null; // { W, H, words, missing, extra, noClue, entries, sig }
  let solution = new Map(); // "r,c" → { ch, h, v, num }
  let active = { key: null, dir: 'h' };
  const signature = () => wordsEl.value;
  const save = () => store.set('crucigrama-partida', puzzle);

  function indexCells() {
    solution = new Map();
    puzzle.words.forEach((w, i) => {
      for (let j = 0; j < w.answer.length; j++) {
        const key = w.dir === 'h' ? k(w.r, w.c + j) : k(w.r + j, w.c);
        const cell = solution.get(key) || { ch: w.answer[j] };
        cell[w.dir] = i;
        if (j === 0) cell.num = w.num;
        solution.set(key, cell);
      }
    });
  }

  function newPuzzle() {
    const { items, extra, noClue } = readWords();
    active = { key: null, dir: 'h' };
    if (items.length < 2) {
      puzzle = null;
      render();
      return;
    }
    puzzle = { ...layout(items), extra, noClue, entries: {}, sig: signature() };
    indexCells();
    save();
    render();
  }

  /* ---------- Pintado ---------- */
  const cellsOf = (w) => Array.from({ length: w.answer.length }, (_, j) => (w.dir === 'h' ? k(w.r, w.c + j) : k(w.r + j, w.c)));
  const clueText = (w) => `${escapeHTML(w.clue || '(sin pista)')}${lengthsEl.checked ? ` <span class="cw-len">(${w.answer.length})</span>` : ''}`;

  function gridHTML(withAnswers) {
    let html = '';
    for (let r = 0; r < puzzle.H; r++) {
      for (let c = 0; c < puzzle.W; c++) {
        const key = k(r, c);
        const cell = solution.get(key);
        if (!cell) { html += '<div class="cw-void"></div>'; continue; }
        const num = cell.num ? `<span class="cw-num">${cell.num}</span>` : '';
        html += withAnswers
          ? `<div class="cw-cell">${num}<span class="cw-letter">${cell.ch}</span></div>`
          : `<div class="cw-cell" data-key="${key}">${num}<input class="cw-input" type="text" maxlength="2" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" aria-label="Casilla ${cell.num ? `${cell.num}` : `fila ${r + 1}, columna ${c + 1}`}" value="${puzzle.entries[key] || ''}"></div>`;
      }
    }
    return `<div class="cw-grid" style="--w:${puzzle.W}">${html}</div>`;
  }

  function render() {
    $('#sheetTitle').textContent = titleEl.value.trim() || 'Crucigrama';
    const n = readWords().items.length;
    $('#cwCount').textContent = `${n} ${n === 1 ? 'palabra' : 'palabras'}`;
    const warn = $('#cwWarn');
    if (!puzzle) {
      boardEl.innerHTML = '<div class="dc-placeholder"><i class="bi bi-border-all" aria-hidden="true"></i><p>Escribe al menos dos palabras con su pista.</p></div>';
      $('#cluesH').innerHTML = '';
      $('#cluesV').innerHTML = '';
      warn.hidden = true;
      statusEl.textContent = '';
      return;
    }
    boardEl.innerHTML = gridHTML(false);
    boardEl.style.setProperty('--w', puzzle.W);
    boardEl.style.setProperty('--print-cell', `${Math.min(0.9, 17 / puzzle.W).toFixed(2)}cm`);
    const list = (dir) => puzzle.words.map((w, i) => ({ w, i })).filter(({ w }) => w.dir === dir).sort((a, b) => a.w.num - b.w.num)
      .map(({ w, i }) => `<li data-i="${i}"><b>${w.num}.</b> ${clueText(w)}</li>`).join('');
    $('#cluesH').innerHTML = list('h');
    $('#cluesV').innerHTML = list('v');
    const problems = [];
    if (puzzle.missing.length) problems.push(`No ${puzzle.missing.length === 1 ? 'se pudo cruzar' : 'se pudieron cruzar'}: ${escapeHTML(puzzle.missing.join(', '))}. Prueba «Otra distribución» o añade palabras que compartan letras.`);
    if (puzzle.noClue) problems.push(`${puzzle.noClue === 1 ? 'Una palabra no tiene' : `${puzzle.noClue} palabras no tienen`} pista: escríbela después de un guion.`);
    if (puzzle.extra) problems.push(`Solo se usan las primeras ${MAX_WORDS} palabras.`);
    warn.hidden = !problems.length;
    warn.innerHTML = problems.length ? `<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><span>${problems.join(' ')}</span>` : '';
    highlight();
  }

  function highlight() {
    const cell = active.key && solution.get(active.key);
    const wi = cell ? cell[active.dir] : undefined;
    const keys = wi !== undefined ? new Set(cellsOf(puzzle.words[wi])) : new Set();
    boardEl.querySelectorAll('.cw-cell').forEach((el) => {
      el.classList.toggle('is-word', keys.has(el.dataset.key));
      el.classList.toggle('is-active', el.dataset.key === active.key);
    });
    document.querySelectorAll('.cw-cluelist li').forEach((li) => li.classList.toggle('is-active', Number(li.dataset.i) === wi));
  }

  /** Hoja de solución (solo para imprimir). */
  function buildSolution() {
    const sol = $('#solution');
    if (!puzzle || !$('#cwPrintSolution').checked) { sol.innerHTML = ''; return; }
    sol.innerHTML = `<header class="ws-head"><h2 class="ws-title">${escapeHTML(titleEl.value.trim() || 'Crucigrama')} · Solución</h2></header>
      <div class="cw-board" style="--w:${puzzle.W}; --print-cell:${Math.min(0.9, 17 / puzzle.W).toFixed(2)}cm">${gridHTML(true)}</div>`;
  }

  /* ---------- Escribir ---------- */
  const inputAt = (key) => boardEl.querySelector(`[data-key="${key}"] input`);
  const focusKey = (key) => { const inp = inputAt(key); if (inp) inp.focus({ preventScroll: false }); };

  function step(key, delta) {
    const cell = solution.get(key);
    const wi = cell?.[active.dir];
    if (wi === undefined) return null;
    const keys = cellsOf(puzzle.words[wi]);
    return keys[keys.indexOf(key) + delta] || null;
  }

  function setEntry(key, letter) {
    if (letter) puzzle.entries[key] = letter;
    else delete puzzle.entries[key];
    const inp = inputAt(key);
    if (inp) inp.value = letter;
    inputAt(key)?.closest('.cw-cell').classList.remove('is-wrong');
    save();
  }

  function checkWin() {
    const done = [...solution].every(([key, cell]) => puzzle.entries[key] === cell.ch);
    if (done) {
      statusEl.textContent = '¡Crucigrama resuelto!';
      statusEl.dataset.tone = 'ok';
      sfx('win');
      DC.confetti({ count: 150 });
    }
  }

  boardEl.addEventListener('focusin', (e) => {
    const cellEl = e.target.closest('.cw-cell');
    if (!cellEl?.dataset.key) return;
    const key = cellEl.dataset.key;
    const cell = solution.get(key);
    if (cell[active.dir] === undefined) active.dir = active.dir === 'h' ? 'v' : 'h';
    active.key = key;
    highlight();
    e.target.select?.();
  });
  // Tocar otra vez la casilla activa cambia entre horizontal y vertical
  let wasActive = false;
  boardEl.addEventListener('pointerdown', (e) => {
    const key = e.target.closest('.cw-cell')?.dataset.key;
    wasActive = key && key === active.key && document.activeElement === inputAt(key);
  });
  boardEl.addEventListener('click', (e) => {
    const key = e.target.closest('.cw-cell')?.dataset.key;
    if (!key || !wasActive) return;
    const cell = solution.get(key);
    const other = active.dir === 'h' ? 'v' : 'h';
    if (cell[other] !== undefined) { active.dir = other; highlight(); }
  });
  boardEl.addEventListener('input', (e) => {
    const key = e.target.closest('.cw-cell')?.dataset.key;
    if (!key) return;
    const letter = keyOf(e.target.value.slice(-1) || '');
    setEntry(key, letter);
    statusEl.textContent = '';
    if (letter) {
      const next = step(key, 1);
      if (next) focusKey(next);
      checkWin();
    }
  });
  boardEl.addEventListener('keydown', (e) => {
    const key = e.target.closest('.cw-cell')?.dataset.key;
    if (!key) return;
    const [r, c] = key.split(',').map(Number);
    if (e.key === 'Backspace' && !e.target.value) {
      e.preventDefault();
      const prev = step(key, -1);
      if (prev) { setEntry(prev, ''); focusKey(prev); }
      return;
    }
    const move = { ArrowRight: [0, 1, 'h'], ArrowLeft: [0, -1, 'h'], ArrowDown: [1, 0, 'v'], ArrowUp: [-1, 0, 'v'] }[e.key];
    if (move) {
      e.preventDefault();
      const [dr, dc, dir] = move;
      if (solution.get(key)[dir] !== undefined) active.dir = dir;
      for (let s = 1; s < Math.max(puzzle.W, puzzle.H); s++) {
        const target = k(r + dr * s, c + dc * s);
        if (solution.has(target)) { focusKey(target); break; }
        if (r + dr * s < 0 || c + dc * s < 0 || r + dr * s >= puzzle.H || c + dc * s >= puzzle.W) break;
      }
      highlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const wi = solution.get(key)[active.dir];
      const nextWord = puzzle.words[(wi + 1) % puzzle.words.length];
      active.dir = nextWord.dir;
      focusKey(cellsOf(nextWord).find((kk) => !puzzle.entries[kk]) || k(nextWord.r, nextWord.c));
    }
  });
  document.querySelector('.cw-clues').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li || !puzzle) return;
    const w = puzzle.words[Number(li.dataset.i)];
    active.dir = w.dir;
    focusKey(cellsOf(w).find((kk) => !puzzle.entries[kk]) || k(w.r, w.c));
  });

  /* ---------- Ayudas ---------- */
  $('#checkBtn').addEventListener('click', () => {
    if (!puzzle) return;
    let wrong = 0;
    let empty = 0;
    solution.forEach((cell, key) => {
      const v = puzzle.entries[key];
      const el = inputAt(key)?.closest('.cw-cell');
      if (!v) { empty += 1; return; }
      if (v !== cell.ch) { wrong += 1; el?.classList.add('is-wrong'); }
    });
    statusEl.dataset.tone = wrong ? 'miss' : 'ok';
    statusEl.textContent = wrong
      ? `${wrong === 1 ? 'Hay 1 letra que no va' : `Hay ${wrong} letras que no van`}: están en rojo.`
      : `¡Todo correcto hasta ahora! ${empty === 1 ? 'Falta 1 casilla' : `Faltan ${empty} casillas`}.`;
    sfx(wrong ? 'flip' : 'soft');
    setTimeout(() => boardEl.querySelectorAll('.is-wrong').forEach((el) => el.classList.remove('is-wrong')), 3000);
  });
  $('#revealBtn').addEventListener('click', () => {
    if (!puzzle) return;
    const cell = active.key && solution.get(active.key);
    const wi = cell ? cell[active.dir] : undefined;
    if (wi === undefined) {
      statusEl.dataset.tone = '';
      statusEl.textContent = 'Toca primero una casilla de la palabra que quieres revelar.';
      return;
    }
    cellsOf(puzzle.words[wi]).forEach((key) => setEntry(key, solution.get(key).ch));
    sfx('soft');
    checkWin();
  });
  $('#solveBtn').addEventListener('click', () => {
    if (!puzzle || !window.confirm('¿Mostrar todas las respuestas?')) return;
    solution.forEach((cell, key) => setEntry(key, cell.ch));
    statusEl.dataset.tone = '';
    statusEl.textContent = 'Estas son todas las respuestas.';
  });

  /* ---------- Eventos ---------- */
  $('#newBtn').addEventListener('click', () => {
    if (puzzle && Object.keys(puzzle.entries).length && !window.confirm('¿Crear otra distribución? Se borrarán las letras escritas.')) return;
    newPuzzle();
    sfx('pop');
  });
  $('#printBtn').addEventListener('click', () => window.print());
  window.addEventListener('beforeprint', buildSolution);
  titleEl.addEventListener('input', () => { $('#sheetTitle').textContent = titleEl.value.trim() || 'Crucigrama'; });
  lengthsEl.addEventListener('change', () => { if (puzzle) render(); });
  let regen;
  wordsEl.addEventListener('input', () => {
    clearTimeout(regen);
    regen = setTimeout(newPuzzle, 600);
  });

  /* ---------- Inicio ---------- */
  const saved = store.get('crucigrama-partida', null);
  if (saved && saved.sig === signature() && Array.isArray(saved.words)) {
    puzzle = { entries: {}, ...saved };
    indexCells();
    render();
  } else newPuzzle();
})();
