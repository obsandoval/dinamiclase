/* =====================================================================
   Ruleta de sorteos · Dinamiclase
   - Se actualiza sola al escribir las opciones
   - Paletas de colores, texto nítido en pantallas de alta densidad
   - "Clic" al pasar por cada sector, ganador con confeti
   - Quitar al ganador e historial de resultados
   - Guardar o copiar el resultado como imagen (con el nombre del sorteo)
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
  const titleEl = $('#raffleTitle');

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

  /** Recorta el texto con «…» hasta que quepa (con la fuente ya puesta en c). */
  function ellipsize(c, text, maxWidth) {
    if (c.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && c.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  function fitText(text, maxWidth, fontSize) {
    ctx.font = `800 ${fontSize}px Nunito, system-ui, sans-serif`;
    return ellipsize(ctx, text, maxWidth);
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

  /* ---------- Imagen del resultado (1920×1080, para proyectar o compartir) ---------- */
  const DISPLAY = 'Fredoka, Nunito, system-ui, sans-serif';
  const BODY = 'Nunito, system-ui, sans-serif';

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function wrapWords(c, text, maxW) {
    const lines = [];
    let line = '';
    text.split(/\s+/).forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (line && c.measureText(test).width > maxW) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  /** Una línea, reduciendo la letra de `from` a `to` px y recortando si aún no cabe. */
  function fitLine(c, text, maxW, weight, from, to, family) {
    for (let fs = from; fs >= to; fs -= 2) {
      c.font = `${weight} ${fs}px ${family}`;
      if (c.measureText(text).width <= maxW) return { fs, text };
    }
    c.font = `${weight} ${to}px ${family}`;
    return { fs: to, text: ellipsize(c, text, maxW) };
  }

  /** El nombre lo más grande posible: en una línea o, si así queda mucho mayor, en dos. */
  function fitName(c, name, maxW) {
    const largest = (from, maxLines) => {
      for (let fs = from; fs >= 56; fs -= 4) {
        c.font = `700 ${fs}px ${DISPLAY}`;
        const lines = maxLines === 1 ? [name] : wrapWords(c, name, maxW);
        if (lines.length <= maxLines && lines.every((l) => c.measureText(l).width <= maxW)) return { fs, lines };
      }
      return null;
    };
    const one = largest(180, 1);
    const two = /\s/.test(name) ? largest(130, 2) : null;
    if (one && (!two || one.fs * 1.15 >= two.fs)) return one;
    if (two) return two;
    c.font = `700 56px ${DISPLAY}`;
    const all = wrapWords(c, name, maxW);
    return { fs: 56, lines: [all[0], all.slice(1).join(' ')].filter(Boolean).map((l) => ellipsize(c, l, maxW)) };
  }

  async function resultImage(name, title) {
    const head = title || 'Resultado del sorteo';
    try {
      await Promise.all(['700 100px Fredoka', '600 60px Fredoka', '700 32px Nunito']
        .map((f) => document.fonts.load(f, `${name}${head}¡Felicidades!Dinamiclase0123456789`)));
    } catch { /* usa la fuente de respaldo */ }

    const W = 1920;
    const H = 1080;
    const cx = W / 2;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const c = out.getContext('2d');
    const colors = PALETTES[palette];
    c.lineJoin = 'round';
    c.lineCap = 'round';

    // Fondo crema con puntos
    c.fillStyle = '#FFF8F0';
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(35,25,66,.07)';
    c.beginPath();
    for (let y = 18; y < H; y += 36) {
      for (let x = 18; x < W; x += 36) {
        c.moveTo(x + 2.5, y);
        c.arc(x, y, 2.5, 0, TAU);
      }
    }
    c.fill();

    // Medidas de la tarjeta (se calculan antes para dejar libre su sitio)
    const cw = 1300;
    const cardX = cx - cw / 2;
    const maxW = cw - 180;
    const t = fitLine(c, head, maxW, 600, 60, 36, DISPLAY);
    const nm = fitName(c, name, maxW);
    const lh = nm.fs * 1.12;
    const ch = 100 + 90 + nm.lines.length * lh + 30 + 40 + 80;
    const top = 245 + Math.max(0, (695 - ch) / 2);

    // Confeti alrededor (sin tapar la tarjeta, los banderines ni la marca)
    const blocked = (x, y) => y < 170
      || (x > cardX - 50 && x < cardX + cw + 50 && y > top - 120 && y < top + ch + 80)
      || (y > H - 90 && Math.abs(x - cx) < 260);
    for (let placed = 0, tries = 0; placed < 70 && tries < 3000; tries++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      if (blocked(x, y)) continue;
      placed++;
      c.save();
      c.translate(x, y);
      c.rotate(Math.random() * TAU);
      c.scale(0.8 + Math.random() * 0.6, 0.8 + Math.random() * 0.6);
      c.fillStyle = colors[placed % colors.length];
      c.strokeStyle = c.fillStyle;
      c.beginPath();
      switch (placed % 4) {
        case 0: roundRect(c, -7, -16, 14, 32, 4); c.fill(); break;
        case 1: c.arc(0, 0, 9, 0, TAU); c.fill(); break;
        case 2: c.moveTo(0, -12); c.lineTo(11, 9); c.lineTo(-11, 9); c.closePath(); c.fill(); break;
        default:
          c.lineWidth = 6;
          c.moveTo(-18, 0);
          c.quadraticCurveTo(-9, -12, 0, 0);
          c.quadraticCurveTo(9, 12, 18, 0);
          c.stroke();
      }
      c.restore();
    }

    // Banderines: dos guirnaldas que se cuelgan del centro
    c.strokeStyle = INK;
    c.lineWidth = 4;
    const garland = (x0, x1, offset) => {
      const P0 = [x0, 18];
      const P1 = [(x0 + x1) / 2, 150];
      const P2 = [x1, 18];
      const at = (s) => [0, 1].map((k) => (1 - s) ** 2 * P0[k] + 2 * (1 - s) * s * P1[k] + s * s * P2[k]);
      c.beginPath();
      c.moveTo(...P0);
      c.quadraticCurveTo(...P1, ...P2);
      c.stroke();
      const flags = 9;
      for (let i = 0; i < flags; i++) {
        const a = at((i + 0.12) / flags);
        const b = at((i + 0.88) / flags);
        c.beginPath();
        c.moveTo(...a);
        c.lineTo(...b);
        c.lineTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 72);
        c.closePath();
        c.fillStyle = colors[(i + offset) % colors.length];
        c.fill();
        c.stroke();
      }
    };
    garland(-60, cx, 0);
    garland(cx, W + 60, 4);

    // Tarjeta con sombra desplazada (estilo Dinamiclase)
    c.fillStyle = INK;
    roundRect(c, cardX + 16, top + 16, cw, ch, 48);
    c.fill();
    c.fillStyle = '#FFFFFF';
    roundRect(c, cardX, top, cw, ch, 48);
    c.fill();
    c.lineWidth = 6;
    c.stroke();

    // Textos
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let y = top + 100;
    c.font = `600 ${t.fs}px ${DISPLAY}`;
    c.fillStyle = '#4A4466';
    c.fillText(t.text, cx, y + 35);
    y += 90;

    c.font = `700 ${nm.fs}px ${DISPLAY}`;
    c.fillStyle = 'rgba(255,197,61,.5)'; // subrayado tipo rotulador
    nm.lines.forEach((line, i) => {
      const w = c.measureText(line).width;
      roundRect(c, cx - w / 2 - 24, y + i * lh + lh * 0.52, w + 48, lh * 0.34, Math.min(14, lh * 0.17));
      c.fill();
    });
    c.fillStyle = INK;
    nm.lines.forEach((line, i) => c.fillText(line, cx, y + i * lh + lh / 2));
    y += nm.lines.length * lh + 30;

    c.font = `700 32px ${BODY}`;
    c.fillStyle = '#6B6585';
    c.fillText(new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(new Date()), cx, y + 20);

    // Corona sobre el borde superior
    c.strokeStyle = INK;
    c.lineWidth = 6;
    const x0 = cx - 100;
    const y0 = top - 85;
    c.beginPath();
    c.moveTo(x0 + 18, y0 + 112);
    c.lineTo(x0 + 4, y0 + 30);
    c.lineTo(x0 + 58, y0 + 70);
    c.lineTo(x0 + 100, y0 + 6);
    c.lineTo(x0 + 142, y0 + 70);
    c.lineTo(x0 + 196, y0 + 30);
    c.lineTo(x0 + 182, y0 + 112);
    c.closePath();
    c.fillStyle = '#FFC53D';
    c.fill();
    c.stroke();
    roundRect(c, x0 + 12, y0 + 100, 176, 30, 10);
    c.fillStyle = '#FFB020';
    c.fill();
    c.stroke();
    [[4, 30], [100, 6], [196, 30]].forEach(([dx, dy]) => {
      c.beginPath();
      c.arc(x0 + dx, y0 + dy, 12, 0, TAU);
      c.fillStyle = '#FB5306';
      c.fill();
      c.stroke();
    });
    [[60, '#2F6BFF'], [100, '#DB2777'], [140, '#22C55E']].forEach(([dx, col]) => {
      c.beginPath();
      c.arc(x0 + dx, y0 + 115, 7, 0, TAU);
      c.fillStyle = col;
      c.fill();
    });

    // Destellos junto a la corona
    c.lineWidth = 4;
    [[cx - 175, top - 30, 30], [cx + 165, top - 58, 22], [cx + 212, top - 8, 14]].forEach(([sx, sy, r]) => {
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2;
        const rr = i % 2 ? r * 0.38 : r;
        c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
      }
      c.closePath();
      c.fillStyle = '#FFC53D';
      c.fill();
      c.stroke();
    });

    // Cinta «¡Felicidades!» sobre el borde inferior
    const label = '¡Felicidades!';
    c.font = `700 46px ${DISPLAY}`;
    const rw = c.measureText(label).width + 110;
    const rh = 82;
    const rx = cx - rw / 2;
    const ry = top + ch - rh / 2;
    c.lineWidth = 5;
    c.fillStyle = '#B83A00';
    [[rx + 24, -1], [rx + rw - 24, 1]].forEach(([ex, dir]) => {
      c.beginPath();
      c.moveTo(ex, ry + 22);
      c.lineTo(ex + dir * 84, ry + 22);
      c.lineTo(ex + dir * 62, ry + 57);
      c.lineTo(ex + dir * 84, ry + 92);
      c.lineTo(ex, ry + 92);
      c.closePath();
      c.fill();
      c.stroke();
    });
    roundRect(c, rx, ry, rw, rh, 14);
    c.fillStyle = '#FB5306';
    c.fill();
    c.stroke();
    c.fillStyle = '#FFFFFF';
    c.fillText(label, cx, ry + rh / 2 + 2);

    // Marca
    c.font = `700 40px ${DISPLAY}`;
    const wa = c.measureText('Dinami').width;
    const bx = cx - (wa + c.measureText('clase').width) / 2;
    c.textAlign = 'left';
    c.fillStyle = INK;
    c.fillText('Dinami', bx, H - 46);
    c.fillStyle = '#FB5306';
    c.fillText('clase', bx + wa, H - 46);

    return out;
  }

  const toPNG = (cv) => new Promise((resolve, reject) => {
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Sin imagen'))), 'image/png');
  });
  const slug = (txt) => txt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  let shownWinner = '';

  async function saveImage(btn) {
    if (!shownWinner) return;
    btn.disabled = true;
    try {
      const title = titleEl.value.trim();
      const blob = await toPNG(await resultImage(shownWinner, title));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug(title) || 'sorteo'}-${slug(shownWinner) || 'resultado'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      sfx('pop');
    } catch {
      DC.toast({ title: 'No se pudo crear la imagen', text: 'Inténtalo de nuevo.', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
    } finally {
      btn.disabled = false;
    }
  }

  async function copyImage(btn) {
    if (!shownWinner) return;
    if (!window.ClipboardItem || !navigator.clipboard?.write) {
      DC.toast({ title: 'Tu navegador no permite copiar imágenes', text: 'Usa «Guardar imagen» y comparte el archivo.', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
      return;
    }
    btn.disabled = true;
    try {
      // La promesa se pasa directamente para que Safari no pierda el permiso del clic
      const blob = resultImage(shownWinner, titleEl.value.trim()).then(toPNG);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      DC.toast({ title: '¡Imagen copiada!', text: 'Pégala en tu presentación, documento o chat.', icon: 'bi-clipboard-check-fill', theme: 'green' });
    } catch {
      DC.toast({ title: 'No se pudo copiar', text: 'Prueba con «Guardar imagen».', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- Lógica ---------- */
  const norm =(a) => ((a % TAU) + TAU) % TAU;
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

    shownWinner = lastWinner.name;
    $('#winnerName').textContent = lastWinner.name;
    const title = titleEl.value.trim();
    $('#winnerTitle').textContent = title;
    $('#winnerTitle').hidden = !title;
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
      DC.toast({ title: 'Aún no tienes una lista', text: 'Escríbela en «Mi lista», en la página de inicio, y estará disponible aquí.', icon: 'bi-people-fill', theme: 'blue' });
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
  $('#saveImgBtn').addEventListener('click', (e) => saveImage(e.currentTarget));
  $('#copyImgBtn').addEventListener('click', (e) => copyImage(e.currentTarget));

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
