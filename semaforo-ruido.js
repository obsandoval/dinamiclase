/* =====================================================================
   Semáforo de ruido · Dinamiclase
   - Escucha el micrófono y mide el volumen en el navegador (Web Audio)
   - El sonido NO se graba ni se envía: solo se calcula su intensidad
   - Verde / amarillo / rojo con límites ajustables y tiempo de reacción
   - Estadísticas de la sesión: % del tiempo en cada color y veces en rojo
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { sfx, store } = DC.utils;
  const $ = (s) => document.querySelector(s);
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

  // tau: suavizado del nivel (s) · hold: tiempo que debe mantenerse un color antes de cambiar (ms)
  const REACTION = { rapida: { tau: 0.15, hold: 250 }, normal: { tau: 0.4, hold: 800 }, tranquila: { tau: 0.8, hold: 1800 } };

  const light = $('#light');
  const msgEl = $('#msg');
  const micBtn = $('#micBtn');
  const yellowEl = $('#yellowAt');
  const redEl = $('#redAt');
  const errorEl = $('#micError');
  const stage = $('#stage');

  let audio = null;      // { ctx, stream, analyser, buf }
  let raf = 0;
  let level = 0;         // 0–100, suavizado
  let state = 'off';
  let candidate = null;
  let candidateSince = 0;
  let lastFrame = 0;
  let lastAlarm = 0;
  let stats = { green: 0, yellow: 0, red: 0, redCount: 0 };

  /* ---------- Ajustes ---------- */
  const savedReact = store.get('semaforo-reaccion', 'normal');
  const reactInput = document.querySelector(`input[name="smReact"][value="${savedReact}"]`);
  if (reactInput) reactInput.checked = true;
  document.querySelectorAll('input[name="smReact"]').forEach((r) => r.addEventListener('change', () => store.set('semaforo-reaccion', r.value)));

  const thresholds = () => ({ yellow: Number(yellowEl.value), red: Number(redEl.value) });
  function paintThresholds(changed) {
    // El rojo siempre por encima del amarillo
    let { yellow, red } = thresholds();
    if (red < yellow + 5) {
      if (changed === redEl) yellow = Math.max(5, red - 5);
      else red = Math.min(100, yellow + 5);
      yellowEl.value = yellow;
      redEl.value = red;
    }
    $('#yellowVal').textContent = yellow;
    $('#redVal').textContent = red;
    $('#markYellow').style.left = `${yellow}%`;
    $('#markRed').style.left = `${red}%`;
    stage.style.setProperty('--yellow', `${yellow}%`);
    stage.style.setProperty('--red', `${red}%`);
  }
  [yellowEl, redEl].forEach((el) => el.addEventListener('input', () => paintThresholds(el)));

  const message = (s) => ({ green: $('#msgGreen'), yellow: $('#msgYellow'), red: $('#msgRed') }[s]?.value.trim() || '');
  ['#msgGreen', '#msgYellow', '#msgRed'].forEach((id) => $(id).addEventListener('input', () => {
    if (state !== 'off') msgEl.textContent = message(state);
  }));

  /* ---------- Estado del semáforo ---------- */
  function setState(next) {
    if (next === 'red' && state !== 'red' && state !== 'off') {
      stats.redCount += 1;
      const now = performance.now();
      if ($('#alarm').checked && now - lastAlarm > 4000) {
        sfx('alarm');
        lastAlarm = now;
      }
    }
    state = next;
    light.dataset.state = next;
    stage.dataset.state = next;
    msgEl.textContent = next === 'off' ? 'Activa el micrófono para empezar.' : message(next);
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function paintStats() {
    const total = stats.green + stats.yellow + stats.red;
    const pct = (v) => (total > 0 ? `${Math.round((v / total) * 100)}%` : '–');
    $('#pGreen').textContent = pct(stats.green);
    $('#pYellow').textContent = pct(stats.yellow);
    $('#pRed').textContent = pct(stats.red);
    $('#redCount').textContent = stats.redCount;
    $('#elapsed').textContent = fmt(total);
  }

  /* ---------- Bucle de medida ---------- */
  function frame(now) {
    const { analyser, buf } = audio;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let k = 0; k < buf.length; k++) sum += buf[k] * buf[k];
    const rms = Math.sqrt(sum / buf.length);
    const db = 20 * Math.log10(Math.max(rms, 1e-8));
    // −65 dBFS (aula en silencio) → 0 · −15 dBFS (gritos cerca del micro) → 100
    const raw = Math.min(100, Math.max(0, (db + 65) * 2));
    const dt = Math.min(0.25, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    const { tau, hold } = REACTION[radio('smReact')] || REACTION.normal;
    level += (raw - level) * (1 - Math.exp(-dt / tau));

    const { yellow, red } = thresholds();
    const zone = level >= red ? 'red' : level >= yellow ? 'yellow' : 'green';
    if (state === 'off') setState(zone);
    else if (zone !== state) {
      if (candidate !== zone) {
        candidate = zone;
        candidateSince = now;
      } else if (now - candidateSince >= hold) {
        setState(zone);
        candidate = null;
      }
    } else candidate = null;

    stats[state] += dt;
    $('#meterFill').style.setProperty('--level', `${level.toFixed(1)}%`);
    paintStats();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- Micrófono ---------- */
  function showError(text) {
    errorEl.innerHTML = `<i class="bi bi-mic-mute-fill" aria-hidden="true"></i><span>${text}</span>`;
    errorEl.hidden = false;
  }

  async function start() {
    errorEl.hidden = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      showError('Este navegador no permite usar el micrófono aquí. Abre la página desde https://dinamiclase.org con Chrome, Edge, Firefox o Safari.');
      return;
    }
    micBtn.disabled = true;
    try {
      // Sin cancelación de eco ni control de ganancia: así el volumen medido es el real
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser); // no se conecta a los altavoces
      audio = { ctx, stream, analyser, buf: new Float32Array(analyser.fftSize) };
      lastFrame = 0;
      raf = requestAnimationFrame(frame);
      micBtn.querySelector('span').textContent = 'Detener';
      micBtn.querySelector('i').className = 'bi bi-stop-fill';
      micBtn.setAttribute('aria-pressed', 'true');
      sfx('pop');
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        showError('No hay permiso para usar el micrófono. Pulsa el icono del candado o de la cámara en la barra de direcciones, permite el micrófono y vuelve a intentarlo.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        showError('No se encontró ningún micrófono. Conecta uno (o revisa que no esté desactivado) y vuelve a intentarlo.');
      } else {
        showError('No se pudo activar el micrófono. Comprueba que ninguna otra aplicación lo esté usando y vuelve a intentarlo.');
      }
    } finally {
      micBtn.disabled = false;
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    if (audio) {
      audio.stream.getTracks().forEach((t) => t.stop());
      audio.ctx.close().catch(() => {});
      audio = null;
    }
    level = 0;
    candidate = null;
    $('#meterFill').style.setProperty('--level', '0%');
    setState('off');
    micBtn.querySelector('span').textContent = 'Activar micrófono';
    micBtn.querySelector('i').className = 'bi bi-mic-fill';
    micBtn.setAttribute('aria-pressed', 'false');
  }

  micBtn.addEventListener('click', () => (audio ? stop() : start()));
  $('#resetBtn').addEventListener('click', () => {
    stats = { green: 0, yellow: 0, red: 0, redCount: 0 };
    paintStats();
    sfx('click');
  });
  window.addEventListener('pagehide', stop);

  paintThresholds();
  paintStats();
  setState('off');
})();
