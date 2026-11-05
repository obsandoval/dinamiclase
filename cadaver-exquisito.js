/* =====================================================================
   Cadáver exquisito · Dinamiclase
   - Historia colectiva en una sola computadora
   - Cada participante ve solo la frase anterior (o solo su final)
   - Pantalla de «pasa la computadora» entre turnos
   - Lectura final frase a frase, en voz alta (síntesis de voz), copiar e imprimir
   - La historia en curso se recuerda si se recarga la página
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, parseList, sfx, store, escapeHTML, copyText } = DC.utils;
  const $ = (s) => document.querySelector(s);
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

  const stage = $('#stage');
  const workspace = $('#herramienta');
  const lineEl = $('#line');
  const titleEl = $('#storyTitle');
  const playersEl = $('#players');

  let story = null; // { lines: [{ text, author, starter }], limit, peek, order, view, revealed }

  /* ---------- Ajustes ---------- */
  const savedSettings = store.get('cadaver-ajustes', {});
  const setRadio = (name, value) => {
    const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  };
  if (savedSettings.limit) setRadio('ceLimit', savedSettings.limit);
  if (savedSettings.peek) setRadio('cePeek', savedSettings.peek);
  if (typeof savedSettings.shuffle === 'boolean') $('#shufflePlayers').checked = savedSettings.shuffle;
  const saveSettings = () => store.set('cadaver-ajustes', { limit: radio('ceLimit'), peek: radio('cePeek'), shuffle: $('#shufflePlayers').checked });
  document.querySelectorAll('input[name="ceLimit"], input[name="cePeek"], #shufflePlayers').forEach((el) => el.addEventListener('change', saveSettings));

  const readPlayers = () => parseList(playersEl.value);
  function paintPlayers() {
    const n = readPlayers().length;
    $('#playersCount').textContent = n ? `${n} ${n === 1 ? 'persona' : 'personas'}` : 'Sin nombres';
  }
  playersEl.addEventListener('input', paintPlayers);
  $('#useStudents').addEventListener('click', () => {
    const list = parseList(store.get('lista-estudiantes', ''));
    if (!list.length) {
      DC.toast({ title: 'Aún no tienes una lista', text: 'Escríbela en «Mi lista», en la página de inicio, y estará disponible aquí.', icon: 'bi-people-fill', theme: 'blue' });
      return;
    }
    playersEl.value = list.join('\n');
    playersEl.dispatchEvent(new Event('input', { bubbles: true }));
  });

  /* ---------- Turnos ---------- */
  const written = () => story.lines.filter((l) => !l.starter).length;
  const authorAt = (t) => (story.order.length ? story.order[t % story.order.length] : '');
  const save = () => store.set('cadaver-partida', story);

  function start() {
    if (story && story.lines.some((l) => !l.starter) && story.view !== 'read'
      && !window.confirm('¿Empezar una historia nueva? Se perderá la que está en curso.')) return;
    const players = readPlayers();
    const order = $('#shufflePlayers').checked ? shuffle(players) : players;
    const choice = radio('ceLimit');
    let limit = choice === 'players' ? players.length : Number(choice);
    if (choice === 'players' && !players.length) {
      limit = 10;
      DC.toast({ title: 'No hay participantes', text: 'Escribe los nombres para «Una por persona». Mientras, serán 10 frases.', icon: 'bi-info-circle-fill', theme: 'blue' });
    }
    const first = $('#firstLine').value.trim();
    story = {
      lines: first ? [{ text: first, author: '', starter: true }] : [],
      limit,
      peek: radio('cePeek') || 'all',
      order,
      view: 'write',
      revealed: 0,
    };
    lineEl.value = '';
    save();
    render();
    sfx('pop');
    lineEl.focus();
  }

  function saveLine() {
    const text = lineEl.value.trim().replace(/\s+/g, ' ');
    if (!text) {
      lineEl.classList.remove('is-shake');
      void lineEl.offsetWidth;
      lineEl.classList.add('is-shake');
      lineEl.focus();
      return;
    }
    const t = written();
    story.lines.push({ text, author: authorAt(t), starter: false });
    lineEl.value = '';
    $('#lineCount').textContent = '0';
    sfx('pop');
    if (story.limit && t + 1 >= story.limit) {
      finish();
      return;
    }
    story.view = 'pass';
    save();
    render();
  }

  function finish() {
    if (!story.lines.length) {
      DC.toast({ title: 'Todavía no hay frases', text: 'Escribe al menos una frase antes de leer la historia.', icon: 'bi-info-circle-fill', theme: 'blue' });
      return;
    }
    story.view = 'read';
    story.revealed = 1;
    save();
    render();
    sfx('win');
    DC.confetti({ count: 120 });
  }

  function reveal(all = false) {
    story.revealed = all ? story.lines.length : Math.min(story.lines.length, story.revealed + 1);
    save();
    render();
    sfx(story.revealed === story.lines.length ? 'soft' : 'flip');
    const last = $('#story').children[story.revealed - 1];
    last?.scrollIntoView({ block: 'nearest', behavior: DC.reducedMotion() ? 'auto' : 'smooth' });
  }

  /* ---------- Pintado ---------- */
  function lastWords(text, n = 4) {
    const words = text.split(' ');
    return words.length <= n ? text : `… ${words.slice(-n).join(' ')}`;
  }

  function render() {
    const view = story ? story.view : 'setup';
    stage.dataset.view = view;
    workspace.classList.toggle('ce-playing', view === 'write' || view === 'pass');
    const total = story ? story.lines.length : 0;
    $('#linesCount').textContent = `${total} ${total === 1 ? 'frase' : 'frases'}`;
    if (!story) return;

    const t = written();
    if (view === 'write') {
      $('#turnNum').textContent = story.limit ? `Frase ${t + 1} de ${story.limit}` : `Frase ${t + 1}`;
      const who = authorAt(t);
      $('#turnName').textContent = who ? `Turno de ${who}` : '';
      const prev = story.lines[story.lines.length - 1];
      const prevText = $('#prevText');
      if (!prev) {
        $('#prevLabel').textContent = '¡Empiezas tú!';
        prevText.textContent = 'Escribe la primera frase de la historia.';
        prevText.classList.add('is-empty');
      } else {
        $('#prevLabel').textContent = story.peek === 'end' ? 'La frase anterior termina así:' : 'La frase anterior:';
        prevText.textContent = story.peek === 'end' ? lastWords(prev.text) : prev.text;
        prevText.classList.remove('is-empty');
      }
      $('#lineCount').textContent = String(lineEl.value.length);
    } else if (view === 'pass') {
      const next = authorAt(t);
      $('#passText').innerHTML = next
        ? `Pasa la computadora a <strong>${escapeHTML(next)}</strong>.`
        : 'Pasa la computadora a la siguiente persona.';
    } else if (view === 'read') {
      $('#storyHeading').textContent = titleEl.value.trim() || 'Nuestra historia';
      $('#story').innerHTML = story.lines.map((l, i) => (i < story.revealed
        ? `<li class="ce-story__line${i === story.revealed - 1 ? ' is-new' : ''}"><span class="ce-story__text">${escapeHTML(l.text)}</span>${l.author ? `<span class="ce-story__author">${escapeHTML(l.author)}</span>` : ''}</li>`
        : '<li class="ce-story__line is-hidden" aria-hidden="true"><span class="ce-story__text">• • •</span></li>')).join('');
      const done = story.revealed >= story.lines.length;
      $('#revealNext').disabled = done;
      $('#revealAll').disabled = done;
    }
  }

  /* ---------- Lectura en voz alta ---------- */
  const speakBtn = $('#speakBtn');
  if ('speechSynthesis' in window) speakBtn.hidden = false;
  function speak() {
    const synth = window.speechSynthesis;
    if (synth.speaking) {
      synth.cancel();
      return;
    }
    if (story.revealed < story.lines.length) reveal(true);
    const text = `${titleEl.value.trim() || 'Nuestra historia'}. ${story.lines.map((l) => l.text).join(' ')}`;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('es'));
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onstart = () => speakBtn.setAttribute('aria-pressed', 'true');
    u.onend = () => speakBtn.setAttribute('aria-pressed', 'false');
    u.onerror = u.onend;
    synth.speak(u);
  }

  /* ---------- Eventos ---------- */
  $('#startBtn').addEventListener('click', start);
  $('#saveLine').addEventListener('click', saveLine);
  $('#finishBtn').addEventListener('click', () => {
    if (lineEl.value.trim()) saveLine();
    if (story.view !== 'read') finish();
  });
  $('#readyBtn').addEventListener('click', () => {
    story.view = 'write';
    save();
    render();
    lineEl.focus();
  });
  lineEl.addEventListener('input', () => { $('#lineCount').textContent = String(lineEl.value.length); });
  lineEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveLine();
    }
  });
  $('#revealNext').addEventListener('click', () => reveal());
  $('#revealAll').addEventListener('click', () => reveal(true));
  speakBtn.addEventListener('click', speak);
  $('#copyStory').addEventListener('click', () => {
    const title = titleEl.value.trim() || 'Nuestra historia';
    copyText(`${title}\n\n${story.lines.map((l) => l.text).join('\n')}`);
  });
  $('#printStory').addEventListener('click', () => {
    if (story.revealed < story.lines.length) reveal(true);
    window.print();
  });
  $('#moreBtn').addEventListener('click', () => {
    if (story.limit && written() >= story.limit) story.limit = 0; // sin límite a partir de aquí
    story.view = 'write';
    save();
    render();
    lineEl.focus();
  });
  $('#newStory').addEventListener('click', () => {
    window.speechSynthesis?.cancel();
    story = null;
    store.set('cadaver-partida', null);
    render();
    $('#startBtn').focus();
  });

  /* ---------- Inicio ---------- */
  paintPlayers();
  const saved = store.get('cadaver-partida', null);
  if (saved && Array.isArray(saved.lines) && ['write', 'pass', 'read'].includes(saved.view)) story = saved;
  render();
})();
