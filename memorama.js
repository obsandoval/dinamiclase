/* =====================================================================
   Memorama de conceptos · Dinamiclase
   - El docente escribe parejas (concepto - definición, palabra - traducción…)
   - Tablero de 12 a 24 cartas numeradas, pensado para el proyector
   - Turnos y puntos para 1–4 equipos (quien acierta repite turno)
   - Se puede voltear con clic o escribiendo el número con el teclado
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, sfx, store, escapeHTML } = DC.utils;
  const $ = (s) => document.querySelector(s);
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

  const TEAM_THEMES = ['blue', 'pink', 'green', 'yellow'];
  const COLS = { 6: 4, 8: 4, 10: 5, 12: 6 };
  const EXAMPLES = {
    ingles: ['Perro - Dog', 'Gato - Cat', 'Manzana - Apple', 'Casa - House', 'Libro - Book', 'Sol - Sun', 'Agua - Water', 'Escuela - School'],
    tablas: ['3 × 4 = 12', '6 × 7 = 42', '8 × 8 = 64', '9 × 6 = 54', '7 × 7 = 49', '5 × 9 = 45', '4 × 8 = 32', '12 × 3 = 36'],
    fechas: ['1492 - Llegada de Colón a América', '1789 - Revolución francesa', '1810 - Inicio de la Independencia de México',
      '1910 - Inicio de la Revolución mexicana', '1914 - Inicio de la Primera Guerra Mundial', '1945 - Fin de la Segunda Guerra Mundial',
      '1969 - Llegada del ser humano a la Luna', '1989 - Caída del Muro de Berlín'],
    ciencias: ['Fotosíntesis: Las plantas fabrican su alimento con la luz del sol', 'Herbívoro: Animal que se alimenta de plantas',
      'Evaporación: El agua líquida se convierte en vapor', 'Célula: Unidad básica de los seres vivos', 'Imán: Atrae objetos de hierro',
      'Mamífero: Animal que alimenta a sus crías con leche', 'Planeta: Cuerpo que gira alrededor de una estrella',
      'Esqueleto: Conjunto de huesos que sostiene el cuerpo'],
  };

  const pairsEl = $('#pairs');
  const board = $('#board');
  const statusEl = $('#status');
  const scoreEl = $('#scoreboard');
  const pendingHint = $('#pendingHint');

  /* ---------- Ajustes (se recuerdan en el navegador) ---------- */
  const saved = store.get('memorama-ajustes', {});
  const setRadio = (name, value) => {
    const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  };
  if (saved.size) setRadio('mmSize', saved.size);
  if (saved.teams) setRadio('mmTeams', saved.teams);

  /* ---------- Lectura de las parejas ---------- */
  // Por orden de preferencia: así «5 - 3 = 2» se separa por el «=» y «Rompe-hielo - Icebreaker» por « - »
  const SEPARATORS = ['\t', '=', '|', ' – ', ' — ', ' - ', ':', ';', '-', ','];
  function splitPair(line) {
    for (const sep of SEPARATORS) {
      const i = line.indexOf(sep);
      if (i <= 0) continue;
      const a = line.slice(0, i).trim();
      const b = line.slice(i + sep.length).trim();
      if (a && b) return { a, b };
    }
    return null;
  }
  function readPairs() {
    const lines = pairsEl.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const pairs = lines.map(splitPair).filter(Boolean);
    return { pairs, invalid: lines.length - pairs.length };
  }

  function updateCount() {
    const { pairs, invalid } = readPairs();
    const counter = $('#pairsCount');
    counter.textContent = `${pairs.length} ${pairs.length === 1 ? 'pareja' : 'parejas'}`
      + (invalid ? ` · ${invalid} ${invalid === 1 ? 'línea' : 'líneas'} sin separador` : '');
    counter.classList.toggle('is-warn', invalid > 0);
  }

  /* ---------- Estado del juego ---------- */
  const same = (x, y) => x.trim().toLocaleLowerCase('es') === y.trim().toLocaleLowerCase('es');
  let game = null;
  let dealTimer;

  const teamName = (i) => `Equipo ${i + 1}`;
  const lenClass = (t) => (t.length <= 6 ? 'xs' : t.length <= 14 ? 's' : t.length <= 30 ? 'm' : t.length <= 60 ? 'l' : 'xl');

  function deal() {
    const { pairs } = readPairs();
    const size = Number(radio('mmSize')) || 8;
    const teams = Number(radio('mmTeams')) || 1;
    store.set('memorama-ajustes', { size, teams });
    pendingHint.hidden = true;

    if (pairs.length < 2) {
      game = null;
      board.style.removeProperty('--cols');
      board.innerHTML = '<div class="dc-placeholder"><i class="bi bi-grid-3x2-gap-fill" aria-hidden="true"></i><p>Escribe al menos 2 parejas para crear el tablero.</p></div>';
      scoreEl.innerHTML = '';
      statusEl.textContent = '';
      return;
    }

    const chosen = shuffle(pairs).slice(0, size);
    const cards = shuffle(chosen.flatMap((p, i) => [
      { pair: i, side: 'a', text: p.a },
      { pair: i, side: 'b', text: p.b },
    ])).map((c, i) => ({ ...c, n: i + 1, open: false, matched: false, team: -1 }));

    game = { pairs: chosen, cards, open: [], miss: null, found: 0, attempts: 0, turn: 0, teams, scores: Array(teams).fill(0), over: false };

    const cols = COLS[chosen.length] || Math.ceil(Math.sqrt(cards.length));
    board.style.setProperty('--cols', cols);
    board.style.setProperty('--rows', Math.ceil(cards.length / cols));
    board.innerHTML = cards.map((c, i) => `
      <button class="mm-card" type="button" data-i="${i}" style="--i:${i}" aria-label="Carta ${c.n}">
        <span class="mm-card__inner">
          <span class="mm-card__back" aria-hidden="true"><span class="mm-card__num">${c.n}</span></span>
          <span class="mm-card__front mm-card__front--${c.side}" data-len="${lenClass(c.text)}">
            <span class="mm-card__tag">${c.n}</span>
            <span class="mm-card__text">${escapeHTML(c.text)}</span>
          </span>
        </span>
      </button>`).join('');
    board.classList.remove('is-dealing');
    void board.offsetWidth;
    board.classList.add('is-dealing');
    clearTimeout(dealTimer);
    dealTimer = setTimeout(() => board.classList.remove('is-dealing'), 1400);

    setStatus(teams > 1 ? `Empieza el ${teamName(0)}: elijan dos cartas.` : 'Elige dos cartas para buscar una pareja.');
    renderScore();
  }

  const cardEl = (c) => board.querySelector(`[data-i="${c.n - 1}"]`);

  function paint(c) {
    const el = cardEl(c);
    if (!el) return;
    el.classList.toggle('is-open', c.open || c.matched);
    el.classList.toggle('is-matched', c.matched);
    TEAM_THEMES.forEach((t) => el.classList.remove(`dc-theme-${t}`));
    if (c.matched) el.classList.add(`dc-theme-${game.teams > 1 ? TEAM_THEMES[c.team] : 'green'}`);
    el.setAttribute('aria-label', c.open || c.matched ? `Carta ${c.n}: ${c.text}${c.matched ? ' (pareja encontrada)' : ''}` : `Carta ${c.n}`);
  }

  function setStatus(text, tone = '') {
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }

  function renderScore() {
    if (!game) { scoreEl.innerHTML = ''; return; }
    const teams = game.teams > 1
      ? `<ol class="mm-teams">${game.scores.map((pts, i) => `
          <li class="mm-team dc-theme-${TEAM_THEMES[i]}${i === game.turn && !game.over ? ' is-turn' : ''}">
            <span class="mm-team__name">${teamName(i)}</span><span class="mm-team__pts">${pts}</span>
          </li>`).join('')}</ol>`
      : '';
    scoreEl.innerHTML = `${teams}
      <p class="mm-stats"><span>Parejas <strong>${game.found}/${game.pairs.length}</strong></span><span>Intentos <strong>${game.attempts}</strong></span></p>`;
  }

  /** ¿Son pareja? Compara textos y no solo el origen: «3 × 4» casa con cualquier «12». */
  const isMatch = (x, y) => x.side !== y.side && same(game.pairs[x.pair][y.side], y.text);

  function hideMiss() {
    if (!game.miss) return;
    game.miss.forEach((c) => {
      c.open = false;
      cardEl(c)?.classList.remove('is-miss');
      paint(c);
    });
    game.miss = null;
  }

  function flip(i) {
    if (!game || game.over) return;
    const card = game.cards[i];
    if (!card || card.matched) return;
    if (game.miss) {
      const wasShown = game.miss.includes(card);
      hideMiss();
      if (wasShown) return; // tocar una carta del fallo solo la tapa
    }
    if (card.open) return;

    card.open = true;
    paint(card);
    sfx('flip');
    game.open.push(card);
    pendingHint.hidden = true;
    if (game.open.length < 2) {
      setStatus(game.teams > 1 ? `${teamName(game.turn)}: elijan la segunda carta.` : 'Elige la segunda carta.');
      return;
    }

    const [x, y] = game.open;
    game.open = [];
    game.attempts += 1;
    if (isMatch(x, y)) {
      [x, y].forEach((c) => { c.matched = true; c.team = game.turn; paint(c); });
      game.found += 1;
      game.scores[game.turn] += 1;
      if (game.found === game.pairs.length) {
        finish();
        return;
      }
      sfx('soft');
      setStatus(game.teams > 1 ? `¡Pareja! El ${teamName(game.turn)} suma un punto y vuelve a jugar.` : '¡Pareja encontrada! Sigue buscando.', 'ok');
    } else {
      game.miss = [x, y];
      [x, y].forEach((c) => {
        const el = cardEl(c);
        el?.classList.remove('is-miss');
        void el?.offsetWidth;
        el?.classList.add('is-miss');
      });
      game.turn = (game.turn + 1) % game.teams;
      setStatus(game.teams > 1
        ? `No son pareja. Turno del ${teamName(game.turn)}: toquen otra carta para seguir.`
        : 'No son pareja. Toca otra carta para seguir.', 'miss');
    }
    renderScore();
  }

  function finish() {
    game.over = true;
    renderScore();
    sfx('win');
    DC.confetti({ count: 160 });
    let text;
    if (game.teams > 1) {
      const best = Math.max(...game.scores);
      const winners = game.scores.map((s, i) => (s === best ? teamName(i) : null)).filter(Boolean);
      const pts = `${best} ${best === 1 ? 'pareja' : 'parejas'}`;
      text = winners.length > 1
        ? `¡Empate entre ${winners.join(' y ')} con ${pts}!`
        : `¡Gana el ${winners[0]} con ${pts}!`;
    } else {
      text = `¡Tablero completo en ${game.attempts} intentos!`;
    }
    setStatus(text, 'ok');
    DC.toast({ title: '¡Memorama completo!', text, icon: 'bi-trophy-fill', theme: 'yellow' });
  }

  function solve() {
    if (!game || game.over) return;
    if (game.attempts > 0 && !window.confirm('¿Mostrar todas las cartas? El juego terminará.')) return;
    game.over = true;
    game.miss = null;
    game.open = [];
    game.cards.forEach((c) => { c.open = true; paint(c); cardEl(c)?.classList.remove('is-miss'); });
    renderScore();
    setStatus('Solución a la vista. Pulsa «Nuevo juego» para jugar otra vez.');
  }

  /* ---------- Eventos ---------- */
  board.addEventListener('click', (e) => {
    const el = e.target.closest('.mm-card');
    if (el) flip(Number(el.dataset.i));
  });
  document.querySelectorAll('[data-new-game]').forEach((b) => b.addEventListener('click', () => {
    if (game && !game.over && game.attempts > 0 && !window.confirm('¿Empezar un juego nuevo? Se perderá el marcador actual.')) return;
    deal();
    sfx('pop');
  }));
  $('#solveBtn').addEventListener('click', solve);

  // Cambios en las parejas o ajustes: si aún no se ha jugado, se reparte de nuevo; si no, se avisa
  let t;
  const onSettings = () => {
    updateCount();
    clearTimeout(t);
    t = setTimeout(() => {
      if (!game || game.over || (game.attempts === 0 && game.open.length === 0)) deal();
      else pendingHint.hidden = false;
    }, 350);
  };
  pairsEl.addEventListener('input', onSettings);
  document.querySelectorAll('input[name="mmSize"], input[name="mmTeams"]').forEach((r) => r.addEventListener('change', onSettings));
  document.querySelectorAll('[data-example]').forEach((b) => b.addEventListener('click', () => {
    pairsEl.value = EXAMPLES[b.dataset.example].join('\n');
    pairsEl.dispatchEvent(new Event('input', { bubbles: true }));
  }));

  // Escribir el número de la carta (útil con el proyector): «1», «2» + Enter
  let typed = '';
  let typedTimer;
  const commitTyped = () => {
    clearTimeout(typedTimer);
    const n = Number(typed);
    typed = '';
    if (game && n >= 1 && n <= game.cards.length) flip(n - 1);
  };
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey || !game) return;
    if (/^[0-9]$/.test(e.key)) {
      typed += e.key;
      clearTimeout(typedTimer);
      // Si ya no puede haber un número mayor (p. ej. «3» con 24 cartas), voltea enseguida
      if (Number(typed) * 10 > game.cards.length) commitTyped();
      else typedTimer = setTimeout(commitTyped, 900);
    } else if (e.key === 'Enter' && typed) {
      e.preventDefault();
      commitTyped();
    }
  });

  updateCount();
  deal();
})();
