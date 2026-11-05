/* =====================================================================
   Tangram · Dinamiclase
   - Las 7 piezas clásicas (cuadrado de 4×4 unidades) en un lienzo SVG
   - Arrastrar, girar (asa, doble clic, botones o Q/E) y voltear (F)
   - Imán: encaja las esquinas cercanas y gira de 45° en 45°
   - Colores, pastel o silueta; la figura se recuerda en el navegador
   - Guardar o copiar la figura como PNG (recortada a las piezas)
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { shuffle, sfx, store } = DC.utils;
  const $ = (s) => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';

  // Lienzo apaisado (1600×900) o vertical en pantallas estrechas (900×1200)
  const narrowQuery = window.matchMedia('(max-width: 600px)');
  let W = 1600;
  let H = 900;
  const U = 75;            // tamaño de 1 unidad: el cuadrado completo mide 4U = 300
  const SNAP = 18;         // distancia (en unidades del lienzo) para encajar esquinas
  const INK = '#231942';

  const SHAPES = [
    { id: 'tg1', name: 'Triángulo grande 1', pts: [[0, 0], [4, 0], [2, 2]] },
    { id: 'tg2', name: 'Triángulo grande 2', pts: [[0, 0], [2, 2], [0, 4]] },
    { id: 'tm', name: 'Triángulo mediano', pts: [[4, 2], [4, 4], [2, 4]] },
    { id: 'tp1', name: 'Triángulo pequeño 1', pts: [[4, 0], [4, 2], [3, 1]] },
    { id: 'tp2', name: 'Triángulo pequeño 2', pts: [[2, 2], [3, 3], [1, 3]] },
    { id: 'cu', name: 'Cuadrado', pts: [[3, 1], [4, 2], [3, 3], [2, 2]] },
    { id: 'pa', name: 'Paralelogramo', pts: [[0, 4], [1, 3], [3, 3], [2, 4]] },
  ];
  const PALETTES = {
    colores: { tg1: '#FB5306', tg2: '#2F6BFF', tm: '#0EA5E9', tp1: '#FFC53D', tp2: '#DB2777', cu: '#22C55E', pa: '#7C3AED' },
    pastel: { tg1: '#FFB5A7', tg2: '#B5E2FA', tm: '#A7F3D0', tp1: '#FDE68A', tp2: '#FBCFE8', cu: '#C3F0CA', pa: '#D8B4FE' },
    silueta: Object.fromEntries(SHAPES.map((s) => [s.id, INK])),
  };

  const svg = $('#board');
  const layer = $('#pieces');
  const handle = $('#handle');
  const snapEl = $('#snapToggle');
  const stage = $('#stage');
  const pieceButtons = [$('#rotLeft'), $('#rotRight'), $('#flipBtn')];

  /* ---------- Piezas ---------- */
  const pieces = SHAPES.map((s) => {
    const cx = s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length;
    const cy = s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length;
    const local = s.pts.map(([x, y]) => [(x - cx) * U, (y - cy) * U]);
    return {
      ...s,
      cx,
      cy,
      local,
      radius: Math.max(...local.map(([x, y]) => Math.hypot(x, y))),
      x: W / 2 + (cx - 2) * U,
      y: H / 2 + (cy - 2) * U,
      rot: 0,
      flip: false,
      el: null,
    };
  });
  /** Posición de la pieza en el cuadrado inicial, centrado en el lienzo. */
  const home = (p) => [W / 2 + (p.cx - 2) * U, H / 2 + (p.cy - 2) * U];
  const byId = (id) => pieces.find((p) => p.id === id);

  pieces.forEach((p) => {
    const g = document.createElementNS(NS, 'g');
    g.classList.add('tg-piece');
    g.dataset.id = p.id;
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', p.name);
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', p.local.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '));
    g.appendChild(poly);
    layer.appendChild(g);
    p.el = g;
  });

  /** Vértices de la pieza en coordenadas del lienzo. */
  function verts(p) {
    const r = (p.rot * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    return p.local.map(([lx, ly]) => {
      const x0 = p.flip ? -lx : lx;
      return [p.x + x0 * c - ly * s, p.y + x0 * s + ly * c];
    });
  }

  let colors = store.get('tangram-colores', 'colores');
  if (!PALETTES[colors]) colors = 'colores';

  function render(p) {
    p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${p.flip ? -1 : 1}, 1)`;
    p.el.firstChild.style.fill = PALETTES[colors][p.id];
  }
  const renderAll = () => pieces.forEach(render);

  /* ---------- Selección y asa de giro ---------- */
  let selected = null;

  function select(p) {
    selected = p;
    pieces.forEach((q) => q.el.classList.toggle('is-selected', q === p));
    pieceButtons.forEach((b) => { b.disabled = !p; });
    placeHandle();
  }

  function placeHandle() {
    if (!selected) {
      handle.style.display = 'none';
      return;
    }
    const p = selected;
    const a = (p.rot * Math.PI) / 180;
    const r = p.radius + 42;
    const hx = Math.min(W - 26, Math.max(26, p.x + Math.sin(a) * r));
    const hy = Math.min(H - 26, Math.max(26, p.y - Math.cos(a) * r));
    handle.style.display = '';
    const line = $('#handleLine');
    line.setAttribute('x1', p.x);
    line.setAttribute('y1', p.y);
    line.setAttribute('x2', hx);
    line.setAttribute('y2', hy);
    $('#handleKnob').setAttribute('cx', hx);
    $('#handleKnob').setAttribute('cy', hy);
    $('#handleIcon').setAttribute('transform', `translate(${hx} ${hy})`);
  }

  const toFront = (p) => { if (layer.lastChild !== p.el) layer.appendChild(p.el); };
  const norm360 = (a) => ((a % 360) + 360) % 360;
  const step = () => (snapEl.checked ? 45 : 15);

  /* ---------- Imán ---------- */
  function snapPiece(p) {
    if (!snapEl.checked) return false;
    const mine = verts(p);
    let best = null;
    pieces.forEach((o) => {
      if (o === p) return;
      verts(o).forEach(([ox, oy]) => mine.forEach(([mx, my]) => {
        const d = Math.hypot(ox - mx, oy - my);
        if (d < SNAP && (!best || d < best.d)) best = { d, dx: ox - mx, dy: oy - my };
      }));
    });
    if (!best) return false;
    p.x += best.dx;
    p.y += best.dy;
    return best.d > 0.5;
  }

  /* ---------- Acciones ---------- */
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set('tangram-estado', {
      pieces: pieces.map(({ id, x, y, rot, flip }) => ({ id, x, y, rot, flip })),
      order: Array.from(layer.children, (g) => g.dataset.id),
    }), 300);
  }

  function rotate(p, delta) {
    if (!p) return;
    p.rot = norm360(Math.round((p.rot + delta) / step()) * step());
    if (snapPiece(p)) sfx('tick');
    render(p);
    placeHandle();
    sfx('click');
    save();
  }

  function flip(p) {
    if (!p) return;
    p.flip = !p.flip;
    render(p);
    placeHandle();
    sfx('click');
    save();
  }

  function animateAll(fn) {
    if (!DC.reducedMotion()) {
      stage.classList.add('is-animating');
      setTimeout(() => stage.classList.remove('is-animating'), 650);
    }
    fn();
    renderAll();
    placeHandle();
    save();
  }

  function assemble() {
    animateAll(() => pieces.forEach((p) => {
      [p.x, p.y] = home(p);
      p.rot = 0;
      p.flip = false;
    }));
    sfx('pop');
  }

  function scatter() {
    // Rejilla de 8 huecos (4×2 apaisado, 2×4 vertical) para que no se amontonen
    const cols = W > H ? 4 : 2;
    const rows = 8 / cols;
    const slots = shuffle(Array.from({ length: 8 }, (_, i) => [
      (W * ((i % cols) + 0.5)) / cols,
      40 + ((H - 80) * (Math.floor(i / cols) + 0.5)) / rows,
    ]));
    animateAll(() => pieces.forEach((p, i) => {
      p.x = slots[i][0] + Math.round((Math.random() - 0.5) * 50);
      p.y = slots[i][1] + Math.round((Math.random() - 0.5) * 30);
      p.rot = 45 * Math.floor(Math.random() * 8);
      p.flip = false;
    }));
    sfx('pop');
  }

  /* ---------- Arrastrar y girar con el puntero ---------- */
  const toSVG = (e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  let drag = null;
  let lastTap = { id: null, t: 0 };

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const g = e.target.closest('.tg-piece');
    const pt = toSVG(e);
    if (e.target.closest('#handle') && selected) {
      drag = { mode: 'rotate', piece: selected, moved: false };
    } else if (g) {
      const p = byId(g.dataset.id);
      select(p);
      toFront(p);
      drag = { mode: 'move', piece: p, dx: p.x - pt.x, dy: p.y - pt.y, start: pt, moved: false };
      p.el.classList.add('is-dragging');
    } else {
      select(null);
      return;
    }
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = drag.piece;
    const pt = toSVG(e);
    if (drag.mode === 'move') {
      if (!drag.moved && Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) < 4) return;
      drag.moved = true;
      p.x = Math.min(W, Math.max(0, pt.x + drag.dx));
      p.y = Math.min(H, Math.max(0, pt.y + drag.dy));
    } else {
      const deg = (Math.atan2(pt.x - p.x, -(pt.y - p.y)) * 180) / Math.PI; // 0° = arriba, sentido horario
      const next = norm360(Math.round(deg / step()) * step());
      if (next !== p.rot) {
        p.rot = next;
        drag.moved = true;
        sfx('tick');
      }
    }
    render(p);
    placeHandle();
  });

  function endDrag() {
    if (!drag) return;
    const { piece, moved, mode } = drag;
    drag = null;
    piece.el.classList.remove('is-dragging');
    if (moved) {
      if (snapPiece(piece)) sfx('tick');
      render(piece);
      placeHandle();
      save();
    } else if (mode === 'move') {
      // Doble toque / doble clic: girar 45°
      const now = performance.now();
      if (lastTap.id === piece.id && now - lastTap.t < 380) {
        rotate(piece, 45);
        lastTap = { id: null, t: 0 };
      } else lastTap = { id: piece.id, t: now };
    }
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  /* ---------- Teclado ---------- */
  layer.addEventListener('focusin', (e) => {
    const g = e.target.closest('.tg-piece');
    if (g && selected?.id !== g.dataset.id) select(byId(g.dataset.id));
  });
  document.addEventListener('keydown', (e) => {
    if (!selected || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (move) {
      e.preventDefault();
      const d = e.shiftKey ? 25 : 5;
      selected.x = Math.min(W, Math.max(0, selected.x + move[0] * d));
      selected.y = Math.min(H, Math.max(0, selected.y + move[1] * d));
      render(selected);
      placeHandle();
      save();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'q') rotate(selected, -step());
    else if (k === 'e' || k === 'r') rotate(selected, step());
    else if (k === 'f') flip(selected);
    else if (e.key === 'Escape') select(null);
  });

  /* ---------- Imagen ---------- */
  async function exportCanvas() {
    try { await document.fonts.load('600 22px Fredoka', 'Dinamiclase'); } catch { /* fuente de respaldo */ }
    const all = pieces.flatMap(verts);
    const pad = 70;
    const minX = Math.min(...all.map((v) => v[0])) - pad;
    const minY = Math.min(...all.map((v) => v[1])) - pad;
    const maxX = Math.max(...all.map((v) => v[0])) + pad;
    const maxY = Math.max(...all.map((v) => v[1])) + pad;
    const scale = 2;
    const out = document.createElement('canvas');
    out.width = Math.round((maxX - minX) * scale);
    out.height = Math.round((maxY - minY) * scale);
    const c = out.getContext('2d');
    c.scale(scale, scale);
    c.translate(-minX, -minY);

    c.fillStyle = '#FFF8F0';
    c.fillRect(minX, minY, maxX - minX, maxY - minY);
    c.fillStyle = 'rgba(35,25,66,.08)';
    c.beginPath();
    for (let y = Math.ceil(minY / 30) * 30; y < maxY; y += 30) {
      for (let x = Math.ceil(minX / 30) * 30; x < maxX; x += 30) {
        c.moveTo(x + 2, y);
        c.arc(x, y, 2, 0, Math.PI * 2);
      }
    }
    c.fill();

    c.lineJoin = 'round';
    c.lineWidth = 3;
    c.strokeStyle = INK;
    Array.from(layer.children, (g) => byId(g.dataset.id)).forEach((p) => {
      const v = verts(p);
      c.beginPath();
      v.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fillStyle = PALETTES[colors][p.id];
      c.fill();
      c.stroke();
    });

    c.font = "600 22px Fredoka, Nunito, system-ui, sans-serif";
    c.textAlign = 'right';
    c.textBaseline = 'alphabetic';
    c.fillStyle = 'rgba(35,25,66,.45)';
    c.fillText('Dinamiclase', maxX - 18, maxY - 18);
    return out;
  }

  const toPNG = (cv) => new Promise((resolve, reject) => {
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Sin imagen'))), 'image/png');
  });

  async function saveImage() {
    try {
      const blob = await toPNG(await exportCanvas());
      const d = new Date();
      const pad2 = (n) => String(n).padStart(2, '0');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tangram-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      sfx('pop');
    } catch {
      DC.toast({ title: 'No se pudo crear la imagen', text: 'Inténtalo de nuevo.', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
    }
  }

  async function copyImage() {
    if (!window.ClipboardItem || !navigator.clipboard?.write) {
      DC.toast({ title: 'Tu navegador no permite copiar imágenes', text: 'Usa «Guardar imagen» y comparte el archivo.', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
      return;
    }
    try {
      // La promesa se pasa directamente para que Safari no pierda el permiso del clic
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': exportCanvas().then(toPNG) })]);
      DC.toast({ title: '¡Figura copiada!', text: 'Pégala en tu presentación, documento o chat.', icon: 'bi-clipboard-check-fill', theme: 'green' });
    } catch {
      DC.toast({ title: 'No se pudo copiar', text: 'Prueba con «Guardar imagen».', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
    }
  }

  /* ---------- Eventos de la barra ---------- */
  $('#rotLeft').addEventListener('click', () => rotate(selected, -step()));
  $('#rotRight').addEventListener('click', () => rotate(selected, step()));
  $('#flipBtn').addEventListener('click', () => flip(selected));
  $('#resetBtn').addEventListener('click', assemble);
  $('#scatterBtn').addEventListener('click', scatter);
  $('#saveBtn').addEventListener('click', saveImage);
  $('#copyBtn').addEventListener('click', copyImage);
  document.querySelectorAll('input[name="tgColors"]').forEach((r) => {
    r.checked = r.value === colors;
    r.addEventListener('change', () => {
      colors = r.value;
      store.set('tangram-colores', colors);
      svg.dataset.colors = colors;
      renderAll();
    });
  });
  snapEl.checked = store.get('tangram-iman', true);
  snapEl.addEventListener('change', () => store.set('tangram-iman', snapEl.checked));
  stage.addEventListener('dc:stage', placeHandle);

  /* ---------- Estado guardado ---------- */
  const savedState = store.get('tangram-estado', null);
  if (savedState?.pieces) {
    savedState.pieces.forEach((s) => {
      const p = byId(s.id);
      if (!p || ![s.x, s.y, s.rot].every(Number.isFinite)) return;
      Object.assign(p, { x: s.x, y: s.y, rot: s.rot, flip: Boolean(s.flip) });
    });
    (savedState.order || []).forEach((id) => { const p = byId(id); if (p) layer.appendChild(p.el); });
  }
  /** Centra la figura sin deformarla: siempre al cambiar de orientación, o si no cabe en el lienzo. */
  function fitInside(force = false) {
    const out = pieces.some((p) => p.x < 0 || p.y < 0 || p.x > W || p.y > H);
    if (force || out) {
      const v = pieces.flatMap(verts);
      const xs = v.map((q) => q[0]);
      const ys = v.map((q) => q[1]);
      const dx = W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
      const dy = H / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;
      pieces.forEach((p) => {
        p.x = Math.min(W, Math.max(0, p.x + dx));
        p.y = Math.min(H, Math.max(0, p.y + dy));
      });
    }
  }

  function setBoardSize(recenter = false) {
    const narrow = narrowQuery.matches;
    [W, H] = narrow ? [900, 1200] : [1600, 900];
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.parentElement.classList.toggle('is-portrait', narrow);
    fitInside(recenter);
    renderAll();
    placeHandle();
  }
  narrowQuery.addEventListener('change', () => { setBoardSize(true); save(); });

  svg.dataset.colors = colors;
  setBoardSize();
  if (!savedState?.pieces) {
    pieces.forEach((p) => { [p.x, p.y] = home(p); });
    renderAll();
  }
  select(null);
})();
