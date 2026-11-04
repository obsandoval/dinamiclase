/* =====================================================================
   Ruleta de sorteos · Dinamiclase
   - Se actualiza sola al escribir las opciones
   - Paletas de colores, texto nítido en pantallas de alta densidad
   - "Clic" al pasar por cada sector, ganador con confeti
   - Quitar al ganador e historial de resultados
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, parseList, sfx, store } = DC.utils;
  const $ = (s) => document.querySelector(s);

  const PALETTES = {
    dinamiclase: ['#FB5306', '#2F6BFF', '#FFC53D', '#7C3AED', '#22C55E', '#DB2777', '#0EA5E9', '#14B8A6'],
    arcoiris: ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'],
    pastel: ['#FFB5A7', '#B5E2FA', '#FDE68A', '#C3F0CA', '#D8B4FE', '#FBCFE8', '#A7F3D0', '#FED7AA'],
    oceano: ['#023E8A', '#0077B6', '#0096C7', '#00B4D8', '#48CAE4', '#90E0EF', '#03045E', '#ADE8F4'],
    atardecer: ['#F72585', '#B5179E', '#7209B7', '#F77F00', '#FCBF49', '#D62828', '#560BAD', '#EAE2B7'],
  };
  const PALETTE_NAMES = { dinamiclase: 'Dinamiclase', arcoiris: 'Arcoíris', pastel: 'Pastel', oceano: 'Océano', atardecer: 'Atardecer' };
  const INK = '#231942';
  const TAU = Math.PI * 2;

  const entriesEl = $('#entries');
  const canvas = $('#wheel');
  const ctx = canvas.getContext('2d');
  const spinBtn = $('#spin');
  const hub = $('#hub');
  const pointer = $('#pointer');
  const durationEl = $('#duration');
  const removeEl = $('#removeWinner');
  const dialog = $('#winnerDialog');
  const historyEl = $('#history');

  let labels = [];
  let palette = store.get('ruleta-paleta', 'dinamiclase');
  if (!PALETTES[palette]) palette = 'dinamiclase';
  let angle = 0;
  let spinning = false;
  let lastWinner = null;
  let size = 0;

  /* ---------- Colores ---------- */
  function colorSequence(n, pal) {
    const seq = [];
    for (let i = 0; i < n; i++) {
      let c = pal[i % pal.length];
      // Evita que el último sector tenga el mismo color que el primero
      if (i === n - 1 && n > 1 && c === seq[0]) c = pal[(i + 1) % pal.length] === seq[i - 1] ? pal[(i + 2) % pal.length] : pal[(i + 1) % pal.length];
      seq.push(c);
    }
    return seq;
  }
  function textColorFor(hex) {
    const v = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return L > 0.36 ? INK : '#FFFFFF';
  }

  function renderPalettes() {
    $('#palettes').innerHTML = Object.entries(PALETTES).map(([key, cols]) => `
      <label class="rl-palette">
        <input type="radio" name="palette" value="${key}" ${key === palette ? 'checked' : ''}>
        <span class="rl-palette__swatches" aria-hidden="true">${cols.slice(0, 5).map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="rl-palette__name">${PALETTE_NAMES[key]}</span>
      </label>`).join('');
  }

  /* ---------- Dibujo ---------- */
  function resize() {
    const cssSize = canvas.getBoundingClientRect().width || 480;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    size = cssSize;
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function fitText(text, maxWidth, fontSize) {
    ctx.font = `800 ${fontSize}px Nunito, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
  }

  function draw() {
    if (size < 40) return; // aún sin tamaño (p. ej. antes del primer resize)
    const W = size;
    const c = W / 2;
    const r = c - 8;
    ctx.clearRect(0, 0, W, W);

    if (labels.length === 0) {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, TAU);
      ctx.fillStyle = '#FFF1E3';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = '#6B6585';
      ctx.font = '700 16px Nunito, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Escribe opciones para empezar', c, c + r * 0.55);
      return;
    }

    const n = labels.length;
    const slice = TAU / n;
    const colors = colorSequence(n, PALETTES[palette]);
    const fontSize = Math.max(11, Math.min(26, (r * 0.9) / Math.max(4, n * 0.55), W / 20));

    for (let i = 0; i < n; i++) {
      const a0 = angle + i * slice;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, r, a0, a0 + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(35,25,66,.35)';
      ctx.stroke();

      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(a0 + slice / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = textColorFor(colors[i]);
      ctx.fillText(fitText(labels[i], r * 0.68, fontSize), r - 18, 0);
      ctx.restore();
    }

    // Borde exterior con "focos"
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.lineWidth = 8;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const bulbs = Math.max(12, Math.min(28, n * 2));
    for (let i = 0; i < bulbs; i++) {
      const a = (i / bulbs) * TAU;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 3, 0, TAU);
      ctx.fillStyle = i % 2 ? '#FFC53D' : '#FFFFFF';
      ctx.fill();
    }
  }

  /* ---------- Lógica ---------- */
  const norm = (a) => ((a % TAU) + TAU) % TAU;
  /** Índice del sector bajo el puntero (arriba, a -90°). */
  const indexAtPointer = (a) => Math.floor(norm(-Math.PI / 2 - a) / (TAU / labels.length)) % labels.length;

  function update() {
    if (spinning) return;
    labels = parseList(entriesEl.value);
    $('#entriesCount').textContent = `${labels.length} ${labels.length === 1 ? 'opción' : 'opciones'}`;
    canvas.setAttribute('aria-label', labels.length ? `Ruleta con ${labels.length} opciones: ${labels.join(', ')}` : 'Ruleta vacía');
    const can = labels.length >= 2;
    spinBtn.disabled = !can;
    hub.disabled = !can;
    draw();
  }

  const easeOut = (t) => 1 - (1 - t) ** 4;

  function spin() {
    if (spinning || labels.length < 2) return;
    if (dialog.open) dialog.close();
    spinning = true;
    spinBtn.disabled = true;
    hub.disabled = true;
    entriesEl.readOnly = true;

    const duration = (Number(durationEl.value) || 6) * 1000;
    const start = angle;
    const target = start + TAU * (5 + Math.random() * 4) + Math.random() * TAU;
    const t0 = performance.now();
    let lastIdx = indexAtPointer(angle);
    const reduced = DC.reducedMotion();

    const frame = (now) => {
      const t = reduced ? 1 : Math.min(1, (now - t0) / duration);
      angle = start + (target - start) * easeOut(t);
      draw();
      const idx = indexAtPointer(angle);
      if (idx !== lastIdx) {
        lastIdx = idx;
        sfx('tick');
        pointer.classList.remove('is-tick');
        void pointer.offsetWidth;
        pointer.classList.add('is-tick');
      }
      if (t < 1) requestAnimationFrame(frame);
      else finish();
    };
    requestAnimationFrame(frame);
  }

  function finish() {
    angle = norm(angle);
    spinning = false;
    entriesEl.readOnly = false;
    const idx = indexAtPointer(angle);
    lastWinner = { name: labels[idx], index: idx };

    const li = document.createElement('li');
    li.textContent = lastWinner.name;
    historyEl.prepend(li);
    $('#historyEmpty').hidden = true;
    $('#clearHistory').hidden = false;

    $('#winnerName').textContent = lastWinner.name;
    $('#removeBtn').hidden = removeEl.checked;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    sfx('win');
    DC.confetti({ count: 150 });
    update();
  }

  function removeLast() {
    if (!lastWinner) return;
    const lines = entriesEl.value.split(/\r?\n/);
    const i = lines.findIndex((l) => l.trim() === lastWinner.name);
    if (i >= 0) lines.splice(i, 1);
    else {
      const list = parseList(entriesEl.value);
      list.splice(list.indexOf(lastWinner.name), 1);
      lines.splice(0, lines.length, ...list);
    }
    entriesEl.value = lines.join('\n');
    entriesEl.dispatchEvent(new Event('input', { bubbles: true }));
    lastWinner = null;
  }

  /* ---------- Eventos ---------- */
  entriesEl.addEventListener('input', update);
  spinBtn.addEventListener('click', spin);
  hub.addEventListener('click', spin);
  durationEl.addEventListener('input', () => { $('#durationValue').textContent = `${durationEl.value} s`; });
  $('#palettes').addEventListener('change', (e) => {
    palette = e.target.value;
    store.set('ruleta-paleta', palette);
    draw();
  });
  $('#shuffleEntries').addEventListener('click', () => {
    entriesEl.value = shuffle(parseList(entriesEl.value)).join('\n');
    entriesEl.dispatchEvent(new Event('input', { bubbles: true }));
  });
  $('#useStudents').addEventListener('click', () => {
    const list = parseList(store.get('lista-estudiantes', ''));
    if (!list.length) {
      DC.toast({ title: 'Aún no tienes una lista', text: 'Escribe tu lista de estudiantes en Grupos aleatorios y estará disponible aquí.', icon: 'bi-people-fill', theme: 'blue' });
      return;
    }
    entriesEl.value = list.join('\n');
    entriesEl.dispatchEvent(new Event('input', { bubbles: true }));
  });
  $('#clearHistory').addEventListener('click', () => {
    historyEl.innerHTML = '';
    $('#historyEmpty').hidden = false;
    $('#clearHistory').hidden = true;
  });

  // Diálogo del ganador
  dialog.addEventListener('close', () => { if (removeEl.checked) removeLast(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  $('#removeBtn').addEventListener('click', () => { removeLast(); dialog.close(); });
  $('#againBtn').addEventListener('click', () => { dialog.close(); setTimeout(spin, 150); });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName) || dialog.open) return;
    e.preventDefault();
    spin();
  });

  new ResizeObserver(() => resize()).observe(canvas);
  document.fonts?.ready.then(draw);

  renderPalettes();
  $('#durationValue').textContent = `${durationEl.value} s`;
  resize();
  update();
})();
