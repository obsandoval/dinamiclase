/* =====================================================================
   Técnica Pomodoro · Dinamiclase
   - Reloj basado en la hora real: no se desfasa en pestañas en segundo plano
   - Fases: concentración → descanso (largo cada N ciclos)
   - Configuración rápida o a medida, arranque automático opcional
   - Notificaciones solo si el usuario las activa
   - Estadísticas del día guardadas en el navegador
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { sfx, store } = DC.utils;
  const $ = (s) => document.querySelector(s);

  const PHASES = {
    work: { label: 'Concentración', icon: 'bi-lightning-charge-fill', theme: 'red', msg: '¡A concentrarse!' },
    break: { label: 'Descanso corto', icon: 'bi-cup-hot-fill', theme: 'green', msg: '¡Hora de descansar!' },
    long: { label: 'Descanso largo', icon: 'bi-stars', theme: 'blue', msg: '¡Te ganaste un descanso largo!' },
  };
  const BASE_TITLE = document.title;

  const stage = $('#stage');
  const timeText = $('#timeText');
  const timeLabel = $('#timeLabel');
  const ringBar = $('#ringBar');
  const startBtn = $('#startBtn');
  const phaseEl = $('#phase');
  const live = $('#live');
  const cfg = { work: $('#cfgWork'), break: $('#cfgBreak'), long: $('#cfgLong'), cycles: $('#cfgCycles') };
  const autoNext = $('#autoNext');
  const notify = $('#notify');

  let phase = 'work';
  let total = 0;        // segundos de la fase
  let remaining = 0;    // segundos restantes
  let endAt = 0;        // marca de tiempo de fin
  let ticker = null;
  let nextTimeout = null;
  let completedInRound = 0; // pomodoros dentro del ciclo actual

  /* ---------- Estadísticas del día ---------- */
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  let stats = store.get('pomodoro-stats', null);
  if (!stats || stats.day !== todayKey()) stats = { day: todayKey(), pomodoros: 0, minutes: 0, cycle: 1 };
  const saveStats = () => store.set('pomodoro-stats', stats);
  function paintStats() {
    $('#statPomodoros').textContent = stats.pomodoros;
    $('#statMinutes').textContent = Math.round(stats.minutes);
    $('#statCycle').textContent = stats.cycle;
  }

  /* ---------- Configuración ---------- */
  const minutes = (key) => Math.max(1, Number(cfg[key].value) || 1);
  const cycles = () => Math.max(2, Number(cfg.cycles.value) || 4);
  const phaseSeconds = (p) => minutes(p === 'long' ? 'long' : p) * 60;

  function matchPreset() {
    const now = [cfg.work.value, cfg.break.value, cfg.long.value, cfg.cycles.value].join(',');
    const radio = document.querySelector(`input[name="preset"][value="${now}"]`) || document.querySelector('input[name="preset"][value="custom"]');
    radio.checked = true;
  }

  /* ---------- Pintado ---------- */
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const running = () => ticker !== null;

  function paint() {
    const shown = Math.ceil(remaining);
    timeText.textContent = fmt(shown);
    ringBar.style.strokeDashoffset = String(1 - remaining / total);
    const ph = PHASES[phase];
    stage.classList.remove('dc-theme-red', 'dc-theme-green', 'dc-theme-blue');
    stage.classList.add(`dc-theme-${ph.theme}`);
    stage.dataset.phase = phase;
    phaseEl.innerHTML = `<i class="bi ${ph.icon}" aria-hidden="true"></i> ${ph.label}`;
    timeLabel.textContent = running() ? 'en marcha' : (remaining < total ? 'en pausa' : 'listo para empezar');
    startBtn.innerHTML = running()
      ? '<i class="bi bi-pause-fill" aria-hidden="true"></i> Pausar'
      : `<i class="bi bi-play-fill" aria-hidden="true"></i> ${remaining < total ? 'Seguir' : 'Iniciar'}`;
    document.title = running() || remaining < total ? `${fmt(shown)} · ${ph.label} — Dinamiclase` : BASE_TITLE;

    const n = cycles();
    $('#dots').innerHTML = Array.from({ length: n }, (_, i) => {
      const done = i < completedInRound;
      const now = i === completedInRound && phase === 'work';
      return `<li class="${done ? 'is-done' : ''}${now ? ' is-now' : ''}"><span class="dc-visually-hidden">Ciclo ${i + 1}${done ? ', completado' : now ? ', en curso' : ''}</span></li>`;
    }).join('');
  }

  /* ---------- Motor ---------- */
  function setPhase(p) {
    phase = p;
    total = phaseSeconds(p);
    remaining = total;
    paint();
  }

  function tick() {
    remaining = Math.max(0, (endAt - Date.now()) / 1000);
    paint();
    if (remaining <= 0) complete();
  }

  function start() {
    if (running()) return;
    clearTimeout(nextTimeout);
    if (remaining <= 0) remaining = total;
    endAt = Date.now() + remaining * 1000;
    ticker = setInterval(tick, 250);
    sfx('click');
    paint();
  }

  function pause() {
    clearInterval(ticker);
    ticker = null;
    remaining = Math.max(0, (endAt - Date.now()) / 1000);
    paint();
  }

  function stopAll() {
    clearInterval(ticker);
    ticker = null;
    clearTimeout(nextTimeout);
  }

  function reset() {
    stopAll();
    completedInRound = 0;
    setPhase('work');
  }

  function advance({ counted }) {
    if (phase === 'work') {
      if (counted) {
        stats.pomodoros += 1;
        stats.minutes += total / 60;
      }
      completedInRound += 1;
      if (completedInRound >= cycles()) {
        setPhase('long');
      } else {
        setPhase('break');
      }
    } else {
      if (phase === 'long') {
        completedInRound = 0;
        stats.cycle += 1;
      }
      setPhase('work');
    }
    saveStats();
    paintStats();
  }

  function complete() {
    stopAll();
    const finished = phase;
    advance({ counted: true });
    sfx(finished === 'work' ? 'win' : 'alarm');
    if (finished === 'work') DC.confetti({ count: 90 });
    const msg = PHASES[phase].msg;
    live.textContent = msg;
    DC.toast({
      title: finished === 'work' ? '¡Pomodoro completado!' : '¡Se acabó el descanso!',
      text: msg,
      icon: PHASES[phase].icon,
      theme: PHASES[phase].theme,
    });
    if (notify.checked && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification(finished === 'work' ? '¡Pomodoro completado!' : '¡Se acabó el descanso!', { body: msg, icon: 'IMG/logo/logo-128x128.svg' }); } catch { /* */ }
    }
    if (autoNext.checked) nextTimeout = setTimeout(start, 3000);
  }

  function skip() {
    stopAll();
    advance({ counted: false });
    sfx('pop');
  }

  /* ---------- Eventos ---------- */
  startBtn.addEventListener('click', () => (running() ? pause() : start()));
  $('#resetBtn').addEventListener('click', reset);
  $('#skipBtn').addEventListener('click', skip);

  document.querySelectorAll('input[name="preset"]').forEach((r) => r.addEventListener('change', () => {
    if (r.value === 'custom') { cfg.work.focus(); return; }
    const [w, b, l, c] = r.value.split(',');
    cfg.work.value = w; cfg.break.value = b; cfg.long.value = l; cfg.cycles.value = c;
    Object.values(cfg).forEach((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    if (!running()) setPhase(phase);
  }));
  Object.values(cfg).forEach((el) => el.addEventListener('input', () => {
    matchPreset();
    // Si no está corriendo, aplica el nuevo tiempo de inmediato
    if (!running() && remaining === total) setPhase(phase);
    else paint();
  }));

  notify.checked = store.get('pomodoro-notificar', false) && 'Notification' in window && Notification.permission === 'granted';
  notify.addEventListener('change', async () => {
    if (!notify.checked) { store.set('pomodoro-notificar', false); return; }
    if (!('Notification' in window)) {
      notify.checked = false;
      DC.toast({ title: 'Sin notificaciones', text: 'Tu navegador no las admite.', icon: 'bi-bell-slash-fill', theme: 'red' });
      return;
    }
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    notify.checked = perm === 'granted';
    store.set('pomodoro-notificar', notify.checked);
    if (perm === 'denied') DC.toast({ title: 'Notificaciones bloqueadas', text: 'Actívalas en la configuración del sitio de tu navegador.', icon: 'bi-bell-slash-fill', theme: 'red' });
  });

  $('#resetStats').addEventListener('click', () => {
    stats = { day: todayKey(), pomodoros: 0, minutes: 0, cycle: 1 };
    saveStats();
    paintStats();
  });

  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); running() ? pause() : start(); }
    if (e.key === 's' || e.key === 'S') skip();
  });

  matchPreset();
  setPhase('work');
  paintStats();
})();
