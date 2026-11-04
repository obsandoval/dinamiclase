/* =====================================================================
   Pizarra de dibujo · Dinamiclase
   - Lienzo fijo 1920×1080 escalado por CSS (no se deforma al redimensionar)
   - Lápiz, marcador, borrador, línea, rectángulo y elipse
   - Deshacer / rehacer (los trazos se guardan como datos y se redibujan)
   - Fondos: blanco, cuadrícula, rayado y pizarra verde
   - Descargar PNG y copiar al portapapeles
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { sfx } = DC.utils;
  const $ = (s) => document.querySelector(s);

  const COLORS = [
    ['#231942', 'Negro'], ['#FFFFFF', 'Blanco'], ['#E11D48', 'Rojo'], ['#FB5306', 'Naranja'],
    ['#FFC53D', 'Amarillo'], ['#22C55E', 'Verde'], ['#2F6BFF', 'Azul'], ['#7C3AED', 'Morado'], ['#DB2777', 'Rosa'],
  ];
  const BG = {
    blanco: { fill: '#FFFFFF' },
    cuadricula: { fill: '#FFFFFF', grid: 48, line: '#D7E3F4' },
    rayado: { fill: '#FFFEF7', rows: 54, line: '#BFD4F2', margin: '#F4A6A6' },
    pizarra: { fill: '#1F4D3A' },
  };

  const canvas = $('#pizarraCanvas');
  const overlay = $('#overlay');
  const ctx = canvas.getContext('2d');
  const octx = overlay.getContext('2d');
  const board = $('#board');
  const sizeEl = $('#brushSize');
  const sizeDot = $('#sizeDot');
  const undoBtn = $('#undoBtn');
  const redoBtn = $('#redoBtn');

  let tool = 'pen';
  let color = '#231942';
  let actions = [];   // trazos y "limpiar" en orden
  let redoStack = [];
  let current = null; // trazo en curso
  let dirty = false;  // cambios sin descargar/copiar

  /* ---------- Interfaz ---------- */
  $('#swatches').insertAdjacentHTML('afterbegin', COLORS.map(([hex, name]) =>
    `<button class="pz-swatch" type="button" data-color="${hex}" style="--sw:${hex}" aria-pressed="${hex === color}" title="${name}" aria-label="${name}"></button>`).join(''));

  function setTool(t) {
    tool = t;
    document.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
    board.dataset.tool = t;
  }
  function setColor(hex) {
    color = hex;
    document.querySelectorAll('.pz-swatch[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color.toLowerCase() === hex.toLowerCase())));
    sizeDot.style.setProperty('--dot', hex);
    if (tool === 'eraser') setTool('pen');
  }
  function paintSize() {
    const s = Number(sizeEl.value);
    sizeDot.style.setProperty('--size', `${Math.max(4, Math.min(30, s))}px`);
  }
  function syncButtons() {
    undoBtn.disabled = actions.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  /* ---------- Dibujo ---------- */
  function strokePath(c, a) {
    const p = a.points;
    c.beginPath();
    c.moveTo(p[0].x, p[0].y);
    if (p.length < 3) {
      c.lineTo(p[p.length - 1].x + 0.01, p[p.length - 1].y);
    } else {
      for (let i = 1; i < p.length - 1; i++) {
        const mx = (p[i].x + p[i + 1].x) / 2;
        const my = (p[i].y + p[i + 1].y) / 2;
        c.quadraticCurveTo(p[i].x, p[i].y, mx, my);
      }
      c.lineTo(p[p.length - 1].x, p[p.length - 1].y);
    }
    c.stroke();
  }

  function drawAction(c, a) {
    if (a.type === 'clear') { c.clearRect(0, 0, canvas.width, canvas.height); return; }
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = a.width;
    c.strokeStyle = a.color;
    c.globalAlpha = a.type === 'marker' ? 0.38 : 1;
    c.globalCompositeOperation = a.type === 'eraser' ? 'destination-out' : 'source-over';
    if (a.type === 'eraser') c.strokeStyle = '#000';
    if (a.type === 'pen' || a.type === 'marker' || a.type === 'eraser') {
      strokePath(c, a);
    } else {
      const [p0, p1] = [a.points[0], a.points[a.points.length - 1]];
      c.beginPath();
      if (a.type === 'line') { c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); }
      if (a.type === 'rect') c.rect(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y));
      if (a.type === 'ellipse') c.ellipse((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, Math.abs(p1.x - p0.x) / 2, Math.abs(p1.y - p0.y) / 2, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    actions.forEach((a) => drawAction(ctx, a));
  }

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
  }

  function start(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    overlay.setPointerCapture(e.pointerId);
    const r = canvas.getBoundingClientRect();
    const scale = canvas.width / r.width;
    const base = Number(sizeEl.value);
    const width = (tool === 'marker' ? base * 3.2 : tool === 'eraser' ? base * 3 : base) * scale;
    current = { type: tool, color, width, points: [toCanvas(e)] };
    e.preventDefault();
  }

  function move(e) {
    if (!current) return;
    const pt = toCanvas(e);
    const pts = current.points;
    if (['line', 'rect', 'ellipse'].includes(current.type)) {
      pts[1] = pt;
    } else {
      const last = pts[pts.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) return;
      pts.push(pt);
    }
    if (current.type === 'eraser') {
      // El borrador actúa directamente sobre el lienzo (solo el último tramo, para ir fluido)
      drawAction(ctx, { ...current, points: pts.slice(-2) });
    } else {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      drawAction(octx, current);
    }
  }

  function end() {
    if (!current) return;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    if (current.points.length === 1 && ['line', 'rect', 'ellipse'].includes(current.type)) { current = null; return; }
    actions.push(current);
    redoStack = [];
    if (current.type === 'eraser') redraw();
    else drawAction(ctx, current);
    current = null;
    dirty = true;
    syncButtons();
  }

  overlay.addEventListener('pointerdown', start);
  overlay.addEventListener('pointermove', move);
  overlay.addEventListener('pointerup', end);
  overlay.addEventListener('pointercancel', end);

  /* ---------- Acciones ---------- */
  function undo() {
    if (!actions.length) return;
    redoStack.push(actions.pop());
    redraw();
    syncButtons();
    sfx('click');
  }
  function redo() {
    if (!redoStack.length) return;
    actions.push(redoStack.pop());
    redraw();
    syncButtons();
    sfx('click');
  }
  function clearBoard() {
    if (!actions.length || actions[actions.length - 1].type === 'clear') return;
    actions.push({ type: 'clear' });
    redoStack = [];
    redraw();
    syncButtons();
    sfx('pop');
    DC.toast({ title: 'Pizarra limpia', text: '¿Te arrepentiste? Pulsa «Deshacer» o Ctrl+Z.', icon: 'bi-trash3-fill', theme: 'orange', timeout: 3500 });
  }

  /** Imagen final = fondo + dibujo */
  function compose() {
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const c = out.getContext('2d');
    const bg = BG[board.dataset.bg] || BG.blanco;
    c.fillStyle = bg.fill;
    c.fillRect(0, 0, out.width, out.height);
    c.lineWidth = 2;
    if (bg.grid) {
      c.strokeStyle = bg.line;
      for (let x = bg.grid; x < out.width; x += bg.grid) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, out.height); c.stroke(); }
      for (let y = bg.grid; y < out.height; y += bg.grid) { c.beginPath(); c.moveTo(0, y); c.lineTo(out.width, y); c.stroke(); }
    }
    if (bg.rows) {
      c.strokeStyle = bg.line;
      for (let y = bg.rows; y < out.height; y += bg.rows) { c.beginPath(); c.moveTo(0, y); c.lineTo(out.width, y); c.stroke(); }
      c.strokeStyle = bg.margin;
      c.beginPath(); c.moveTo(150, 0); c.lineTo(150, out.height); c.stroke();
    }
    c.drawImage(canvas, 0, 0);
    return out;
  }

  function download() {
    const a = document.createElement('a');
    const d = new Date();
    a.download = `pizarra-dinamiclase-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.png`;
    a.href = compose().toDataURL('image/png');
    a.click();
    dirty = false;
    sfx('pop');
  }

  function copyImage() {
    if (!window.ClipboardItem || !navigator.clipboard?.write) {
      DC.toast({ title: 'Tu navegador no permite copiar imágenes', text: 'Usa el botón «Descargar» y comparte el archivo.', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
      return;
    }
    compose().toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        dirty = false;
        DC.toast({ title: '¡Imagen copiada!', text: 'Pégala en tu presentación, documento o chat.', icon: 'bi-clipboard-check-fill', theme: 'green' });
      } catch {
        DC.toast({ title: 'No se pudo copiar', text: 'Prueba con «Descargar».', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
      }
    });
  }

  /* ---------- Eventos ---------- */
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('#swatches').addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (b) setColor(b.dataset.color); });
  $('#customColor').addEventListener('input', (e) => setColor(e.target.value));
  sizeEl.addEventListener('input', paintSize);
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  $('#clearBtn').addEventListener('click', clearBoard);
  $('#downloadBtn').addEventListener('click', download);
  $('#copyBtn').addEventListener('click', copyImage);
  document.querySelectorAll('input[name="bg"]').forEach((r) => r.addEventListener('change', () => {
    board.dataset.bg = r.value;
    // En la pizarra verde, el negro no se ve: cambia a blanco (tiza)
    if (r.value === 'pizarra' && color === '#231942') setColor('#FFFFFF');
    if (r.value !== 'pizarra' && color === '#FFFFFF') setColor('#231942');
  }));

  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { b: 'pen', p: 'pen', m: 'marker', e: 'eraser', l: 'line', r: 'rect', o: 'ellipse' };
    if (map[k]) setTool(map[k]);
    if (k === '[' || k === ']') {
      sizeEl.value = String(Number(sizeEl.value) + (k === ']' ? 2 : -2));
      sizeEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Aviso antes de salir si hay un dibujo sin guardar
  window.addEventListener('beforeunload', (e) => {
    if (!dirty || !actions.some((a) => a.type !== 'clear')) return;
    e.preventDefault();
    e.returnValue = '';
  });

  setTool('pen');
  setColor(color);
  paintSize();
  syncButtons();
})();
