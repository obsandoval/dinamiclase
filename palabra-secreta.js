/* =====================================================================
   Palabra secreta (ahorcado cooperativo) · Dinamiclase
   - Lista de palabras o frases con pista opcional («Palabra - pista»)
   - Cada letra que no está hace caer un pétalo de la flor
   - Acentos y diéresis se aciertan con la letra base (la Ñ es aparte)
   - Teclado en pantalla y del ordenador; lista oculta al proyectar
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, sfx, store, escapeHTML } = DC.utils;
  const $ = (s) => document.querySelector(s);
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

  const ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];
  const MOUTH = {
    happy: 'M88 102 Q100 113 112 102',
    calm: 'M89 104 Q100 109 111 104',
    worried: 'M89 106 L111 106',
    sad: 'M88 110 Q100 99 112 110',
    party: 'M86 100 Q100 120 114 100',
  };

  const wordsEl = $('#words');
  const stage = $('#stage');
  const wordEl = $('#word');
  const hintEl = $('#hint');
  const msgEl = $('#msg');
  const keysEl = $('#keys');
  const petalsEl = $('#petals');
  const livesEl = $('#lives');
  const hintBtn = $('#hintBtn');

  /* ---------- Ajustes ---------- */
  const saved = store.get('palabra-secreta-ajustes', {});
  const setRadio = (name, value) => {
    const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  };
  if (saved.lives) setRadio('psLives', saved.lives);
  if (saved.order) setRadio('psOrder', saved.order);
  if (typeof saved.hide === 'boolean') $('#hideList').checked = saved.hide;
  const saveSettings = () => store.set('palabra-secreta-ajustes', {
    lives: radio('psLives'), order: radio('psOrder'), hide: $('#hideList').checked,
  });
  const paintHidden = () => wordsEl.classList.toggle('is-hidden', $('#hideList').checked);

  /* ---------- Lista ---------- */
  const SEPARATORS = ['\t', '|', ' – ', ' — ', ' - ', ':', '='];
  function parseLine(line) {
    for (const sep of SEPARATORS) {
      const i = line.indexOf(sep);
      if (i > 0) return { word: line.slice(0, i).trim(), hint: line.slice(i + sep.length).trim() };
    }
    return { word: line.trim(), hint: '' };
  }
  const readList = () => wordsEl.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map(parseLine).filter((it) => /\p{L}/u.test(it.word));

  /** Letra que hay que pulsar para descubrir este carácter (null si se muestra tal cual). */
  function keyOf(ch) {
    const up = ch.toLocaleUpperCase('es');
    if (up === 'Ñ') return 'Ñ';
    const base = up.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return /^[A-Z]$/.test(base) ? base : null;
  }

  /* ---------- Estado ---------- */
  let deck = [];
  let idx = 0;
  let round = null;
  let dirty = false; // la lista o los ajustes cambiaron a mitad de una palabra

  function buildDeck() {
    const list = readList();
    deck = radio('psOrder') === 'list' ? list : shuffle(list);
    idx = 0;
    dirty = false;
  }

  function startRound() {
    const item = deck[idx];
    const lives = Number(radio('psLives')) || 8;
    stage.classList.remove('is-won', 'is-lost');
    if (!item) {
      round = null;
      wordEl.innerHTML = '<div class="dc-placeholder"><i class="bi bi-alphabet-uppercase" aria-hidden="true"></i><p>Escribe al menos una palabra en la lista.</p></div>';
      hintEl.hidden = true;
      msgEl.textContent = '';
      $('#roundTitle').textContent = 'Palabra secreta';
      [hintBtn, $('#solveBtn'), $('#nextBtn')].forEach((b) => { b.disabled = true; });
      renderKeys();
      renderFlower(0, 0);
      return;
    }
    const chars = Array.from(item.word);
    round = {
      ...item,
      chars: chars.map((ch) => ({ ch: ch.toLocaleUpperCase('es'), key: keyOf(ch) })),
      used: new Set(),
      wrong: 0,
      lives,
      over: false,
    };
    $('#roundTitle').textContent = `Palabra ${idx + 1} de ${deck.length}`;
    hintBtn.disabled = !item.hint;
    hintBtn.setAttribute('aria-pressed', 'false');
    $('#solveBtn').disabled = false;
    $('#nextBtn').disabled = false;
    hintEl.hidden = true;
    hintEl.innerHTML = item.hint ? `<i class="bi bi-lightbulb-fill" aria-hidden="true"></i> <span>${escapeHTML(item.hint)}</span>` : '';
    renderWord();
    renderKeys();
    renderFlower(lives, 0);
    setMsg('Propongan una letra.');
  }

  /* ---------- Pintado ---------- */
  function renderWord(reveal = false) {
    const groups = [];
    let current = [];
    round.chars.forEach((c, i) => {
      if (c.ch === ' ') {
        if (current.length) groups.push(current);
        current = [];
      } else current.push({ ...c, i });
    });
    if (current.length) groups.push(current);
    const longest = Math.max(...groups.map((g) => g.length));
    wordEl.style.setProperty('--len', Math.max(longest, 6));
    wordEl.innerHTML = groups.map((g) => `<span class="ps-group">${g.map((c) => {
      if (!c.key) return `<span class="ps-tile ps-tile--fixed">${escapeHTML(c.ch)}</span>`;
      const shown = round.used.has(c.key);
      const missed = !shown && reveal;
      return `<span class="ps-tile${shown ? ' is-shown' : ''}${missed ? ' is-missed' : ''}" data-i="${c.i}">${shown || reveal ? escapeHTML(c.ch) : ''}</span>`;
    }).join('')}</span>`).join('');
    wordEl.setAttribute('aria-label', round.chars.map((c) => (!c.key || round.used.has(c.key) || reveal ? c.ch : '_')).join(' '));
  }

  function renderKeys() {
    keysEl.innerHTML = ROWS.map((row) => `<div class="ps-keys__row">${Array.from(row).map((k) => {
      const used = round?.used.has(k);
      const state = !used ? '' : round.chars.some((c) => c.key === k) ? ' is-hit' : ' is-miss';
      return `<button class="ps-key${state}" type="button" data-key="${k}"${used || !round || round.over ? ' disabled' : ''}>${k}</button>`;
    }).join('')}</div>`).join('');
  }

  function renderFlower(lives, wrong) {
    if (petalsEl.childElementCount !== lives) {
      petalsEl.innerHTML = Array.from({ length: lives }, (_, i) => {
        const a = (i * 360) / lives;
        const dx = Math.round(Math.sin((a * Math.PI) / 180) * 60);
        return `<g class="ps-petal ps-petal--${i % 2 ? 'b' : 'a'}" style="--dx:${dx}px; --r:${i % 2 ? 140 : -120}deg; --delay:${(i % 3) * 0.04}s">
          <ellipse cx="100" cy="54" rx="14.5" ry="27" transform="rotate(${a.toFixed(1)} 100 95)"/></g>`;
      }).join('');
    }
    Array.from(petalsEl.children).forEach((p, i) => p.classList.toggle('is-fallen', i < wrong));
    const left = lives - wrong;
    livesEl.textContent = !lives ? '' : left === 0 ? 'Sin pétalos' : `${left} ${left === 1 ? 'pétalo' : 'pétalos'}`;
    livesEl.classList.toggle('is-low', lives > 0 && left <= 2);
    const ratio = lives ? left / lives : 1;
    let mouth = ratio > 0.6 ? 'happy' : ratio > 0.35 ? 'calm' : ratio > 0 ? 'worried' : 'sad';
    if (stage.classList.contains('is-won')) mouth = 'party';
    $('#mouth').setAttribute('d', MOUTH[mouth]);
  }

  function setMsg(text, tone = '') {
    msgEl.textContent = text;
    msgEl.dataset.tone = tone;
  }

  /* ---------- Juego ---------- */
  function guess(k) {
    if (!round || round.over) return;
    if (round.used.has(k)) {
      setMsg(`La «${k}» ya salió. Prueben con otra.`);
      return;
    }
    round.used.add(k);
    const hits = round.chars.filter((c) => c.key === k).length;
    if (hits) {
      sfx('pop');
      renderWord();
      wordEl.querySelectorAll('.ps-tile.is-shown').forEach((t) => {
        if (round.chars[Number(t.dataset.i)].key === k) t.classList.add('is-new');
      });
      const done = round.chars.every((c) => !c.key || round.used.has(c.key));
      if (done) {
        win();
      } else {
        setMsg(hits === 1 ? `¡Sí! Hay una «${k}».` : `¡Sí! Hay ${hits} «${k}».`, 'ok');
      }
    } else {
      round.wrong += 1;
      sfx('flip');
      const left = round.lives - round.wrong;
      if (left <= 0) lose();
      else setMsg(`No hay «${k}». ${left === 1 ? 'Queda 1 pétalo' : `Quedan ${left} pétalos`}.`, 'miss');
    }
    renderKeys();
    renderFlower(round.lives, round.wrong);
  }

  function endRound() {
    round.over = true;
    renderKeys();
  }

  function win() {
    stage.classList.add('is-won');
    endRound();
    sfx('win');
    DC.confetti({ count: 140 });
    setMsg(`¡Lo lograron! La palabra era «${round.word}».`, 'ok');
  }

  function lose() {
    stage.classList.add('is-lost');
    endRound();
    renderWord(true);
    setMsg(`¡La flor se quedó sin pétalos! La palabra era «${round.word}».`, 'miss');
  }

  function solve() {
    if (!round || round.over) return;
    endRound();
    renderWord(true);
    setMsg(`La palabra secreta era «${round.word}».`);
  }

  function next() {
    if (dirty) buildDeck();
    else idx += 1;
    if (idx >= deck.length) {
      const last = round?.word;
      buildDeck();
      if (deck.length > 1 && deck[0].word === last) deck.push(deck.shift());
      DC.toast({ title: '¡Ronda completa!', text: 'Se terminaron las palabras: empezamos otra vez.', icon: 'bi-arrow-repeat', theme: 'purple' });
    }
    startRound();
    sfx('click');
  }

  /* ---------- Eventos ---------- */
  keysEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (b) guess(b.dataset.key);
  });
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter' && round?.over && !['BUTTON', 'A'].includes(e.target.tagName)) {
      next();
      return;
    }
    if (e.key.length !== 1) return;
    const k = keyOf(e.key);
    if (k && round && !round.over) {
      e.preventDefault();
      guess(k);
    }
  });

  hintBtn.addEventListener('click', () => {
    if (!round?.hint) return;
    hintEl.hidden = !hintEl.hidden;
    hintBtn.setAttribute('aria-pressed', String(!hintEl.hidden));
    if (!hintEl.hidden) sfx('soft');
  });
  $('#solveBtn').addEventListener('click', solve);
  $('#nextBtn').addEventListener('click', next);
  $('#startBtn').addEventListener('click', () => {
    buildDeck();
    startRound();
    sfx('pop');
  });

  // Cambios en la lista o los ajustes: si aún no se ha propuesto ninguna letra, se aplican ya
  let t;
  const onChange = () => {
    const n = readList().length;
    $('#wordsCount').textContent = `${n} ${n === 1 ? 'palabra' : 'palabras'}`;
    saveSettings();
    clearTimeout(t);
    t = setTimeout(() => {
      // Con una palabra ya resuelta, se espera a «Siguiente» para no perder el avance
      if (!round || (!round.over && round.used.size === 0)) {
        buildDeck();
        startRound();
      } else dirty = true;
    }, 400);
  };
  wordsEl.addEventListener('input', onChange);
  document.querySelectorAll('input[name="psLives"], input[name="psOrder"]').forEach((r) => r.addEventListener('change', onChange));
  $('#hideList').addEventListener('change', () => { paintHidden(); saveSettings(); });

  paintHidden();
  const n = readList().length;
  $('#wordsCount').textContent = `${n} ${n === 1 ? 'palabra' : 'palabras'}`;
  buildDeck();
  startRound();
})();
