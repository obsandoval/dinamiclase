/* =====================================================================
   Generador de códigos QR · Dinamiclase
   - Enlace/texto o red Wi-Fi
   - Colores personalizables (con aviso de bajo contraste) y fondo transparente
   - Forma de los puntos, margen, nivel de corrección y texto debajo
   - Descarga en PNG (512–2048 px) y SVG, y copiar imagen
   Requiere: dinamiclase.js y qrcode-generator (window.qrcode)
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { sfx, store, escapeHTML } = DC.utils;
  const $ = (s) => document.querySelector(s);
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

  const PRESETS = [
    ['Clásico', '#231942', '#FFFFFF'],
    ['Negro', '#000000', '#FFFFFF'],
    ['Naranja', '#B83A00', '#FFF1E3'],
    ['Azul', '#1A45B8', '#E2EAFF'],
    ['Morado', '#5B21B6', '#EEE6FF'],
    ['Verde', '#147A3A', '#DCF7E5'],
    ['Rosa', '#A3165A', '#FFE2F0'],
    ['Turquesa', '#0B7468', '#D6F5F0'],
  ];
  const DEFAULTS = { fg: '#231942', bg: '#FFFFFF', transparent: false, shape: 'square', ecc: 'M', margin: 2, size: '1024', type: 'texto', security: 'WPA' };

  const preview = $('#preview');
  const meta = $('#qrMeta');
  const warn = $('#contrastWarn');
  const fgEl = $('#fgColor');
  const bgEl = $('#bgColor');
  const transEl = $('#transparent');
  const marginEl = $('#qrMargin');
  const textEl = $('#qrText');
  const captionEl = $('#qrCaption');
  const buttons = [$('#dlPng'), $('#dlSvg'), $('#copyImg')];

  if (typeof window.qrcode !== 'function') {
    preview.innerHTML = '<p class="dc-notice dc-notice--error"><i class="bi bi-wifi-off" aria-hidden="true"></i> No se pudo cargar el generador de códigos QR. Revisa tu conexión y recarga la página.</p>';
    buttons.forEach((b) => { b.disabled = true; });
    return;
  }
  // Acentos, eñes y emojis correctos
  window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];

  /* ---------- Ajustes (se recuerdan en el navegador) ---------- */
  const saved = { ...DEFAULTS, ...store.get('qr-ajustes', {}) };
  const setRadio = (name, value) => {
    const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  };
  fgEl.value = saved.fg;
  bgEl.value = saved.bg;
  transEl.checked = saved.transparent;
  marginEl.value = String(saved.margin);
  setRadio('qrShape', saved.shape);
  setRadio('qrEcc', saved.ecc);
  setRadio('qrSize', saved.size);
  setRadio('qrType', saved.type);
  setRadio('wifiSec', saved.security);

  const settings = () => ({
    fg: fgEl.value.toUpperCase(),
    bg: bgEl.value.toUpperCase(),
    transparent: transEl.checked,
    shape: radio('qrShape') || 'square',
    ecc: radio('qrEcc') || 'M',
    margin: Math.max(0, Math.min(8, Number(marginEl.value) || 0)),
    size: radio('qrSize') || '1024',
    type: radio('qrType') || 'texto',
    security: radio('wifiSec') || 'WPA',
  });

  /* ---------- Contenido ---------- */
  const wifiEscape = (v) => v.replace(/([\\;,":])/g, '\\$1');
  function payload(s) {
    if (s.type === 'wifi') {
      const ssid = $('#wifiSsid').value.trim();
      if (!ssid) return '';
      let out = `WIFI:T:${s.security};S:${wifiEscape(ssid)};`;
      if (s.security !== 'nopass') out += `P:${wifiEscape($('#wifiPass').value)};`;
      if ($('#wifiHidden').checked) out += 'H:true;';
      return `${out};`;
    }
    return textEl.value.trim();
  }

  const slug = (txt) => txt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  function fileName(s) {
    const base = s.type === 'wifi' ? `wifi-${slug($('#wifiSsid').value)}` : slug(textEl.value);
    return `qr-${base || 'dinamiclase'}`;
  }

  /* ---------- Geometría (unidad = 1 módulo) ---------- */
  const n3 = (v) => Math.round(v * 1000) / 1000;
  const rect = (x, y, w, h) => `M${n3(x)} ${n3(y)}h${n3(w)}v${n3(h)}h${n3(-w)}z`;
  function rounded(x, y, w, h, r) {
    if (r <= 0) return rect(x, y, w, h);
    const a = (dx, dy) => `a${n3(r)} ${n3(r)} 0 0 1 ${n3(dx)} ${n3(dy)}`;
    return `M${n3(x + r)} ${n3(y)}h${n3(w - 2 * r)}${a(r, r)}v${n3(h - 2 * r)}${a(-r, r)}h${n3(-(w - 2 * r))}${a(-r, -r)}v${n3(-(h - 2 * r))}${a(r, -r)}z`;
  }
  const circle = (cx, cy, r) => `M${n3(cx - r)} ${n3(cy)}a${n3(r)} ${n3(r)} 0 1 0 ${n3(2 * r)} 0a${n3(r)} ${n3(r)} 0 1 0 ${n3(-2 * r)} 0z`;

  /* Centros de los patrones de alineación por versión (especificación QR, tabla de qrcode-generator) */
  const ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
    [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
    [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]];

  /**
   * Devuelve los trazados del código: módulos (nonzero) y patrones fijos (evenodd).
   * Los "ojos" de las esquinas y los patrones de alineación se dibujan macizos
   * en todos los estilos: son las marcas que usan los lectores para encontrar
   * y enderezar el código, así se mantiene legible aunque los puntos sean redondos.
   */
  function geometry(qr, s) {
    const n = qr.getModuleCount();
    const m = s.margin;
    const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    const centers = [];
    if (s.shape !== 'square') {
      const pos = ALIGN[(n - 17) / 4 - 1] || [];
      pos.forEach((r) => pos.forEach((c) => { if (!inEye(r, c)) centers.push([r, c]); }));
    }
    const inAlign = (r, c) => centers.some(([ar, ac]) => Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2);
    const skip = (r, c) => inEye(r, c) || inAlign(r, c);

    let mods = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c) || skip(r, c)) continue;
        if (s.shape === 'square') {
          // Une los módulos seguidos de la fila en un solo rectángulo
          let run = 1;
          while (c + run < n && qr.isDark(r, c + run) && !skip(r, c + run)) run++;
          mods += rect(c + m, r + m, run, 1);
          c += run - 1;
        } else if (s.shape === 'rounded') {
          mods += rounded(c + m, r + m, 1, 1, 0.32);
        } else {
          mods += circle(c + m + 0.5, r + m + 0.5, 0.46);
        }
      }
    }

    // Ojos: anillo 7×7 + centro 3×3 (con evenodd el hueco 5×5 queda vacío)
    const R = { square: [0, 0, 0], rounded: [1.6, 0.8, 0.8], dots: [2.2, 1.4, 1.1] }[s.shape];
    let eyes = '';
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r, c]) => {
      const x = c + m;
      const y = r + m;
      eyes += rounded(x, y, 7, 7, R[0]) + rounded(x + 1, y + 1, 5, 5, R[1]) + rounded(x + 2, y + 2, 3, 3, R[2]);
    });
    // Alineación: anillo 5×5 + centro 1×1
    centers.forEach(([r, c]) => {
      const x = c - 2 + m;
      const y = r - 2 + m;
      eyes += rounded(x, y, 5, 5, 1.2) + rounded(x + 1, y + 1, 3, 3, 0.6) + rounded(x + 2, y + 2, 1, 1, 0.3);
    });
    return { n, size: n + 2 * m, mods, eyes };
  }

  function layout(g, caption, margin) {
    const fs = Math.max(1.6, g.size * 0.068);
    const capH = caption ? fs * (margin > 0 ? 1.9 : 2.4) : 0;
    return { W: g.size, H: g.size + capH, fs, capY: g.size + capH * (margin > 0 ? 0.42 : 0.55) };
  }

  /* ---------- Salidas ---------- */
  function toSVG(g, s, caption, { forFile = false } = {}) {
    const L = layout(g, caption, s.margin);
    const scale = forFile ? 12 : 1;
    const bg = s.transparent ? '' : `<rect width="${n3(L.W)}" height="${n3(L.H)}" fill="${s.bg}"/>`;
    const crisp = s.shape === 'square' ? ' shape-rendering="crispEdges"' : '';
    const text = caption
      ? `<text x="${n3(L.W / 2)}" y="${n3(L.capY)}" fill="${s.fg}" font-family="Nunito, 'Segoe UI', Arial, sans-serif" font-weight="800" font-size="${n3(L.fs)}" text-anchor="middle" dominant-baseline="central">${escapeHTML(caption)}</text>`
      : '';
    const size = forFile ? ` width="${n3(L.W * scale)}" height="${n3(L.H * scale)}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n3(L.W)} ${n3(L.H)}"${size} role="img" aria-label="Código QR">`
      + `${bg}<path fill="${s.fg}"${crisp} d="${g.mods}"/><path fill="${s.fg}" fill-rule="evenodd" d="${g.eyes}"/>${text}</svg>`;
  }

  async function toCanvas(g, s, caption) {
    const L = layout(g, caption, s.margin);
    const px = Number(s.size) || 1024;
    const k = px / L.W;
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = Math.round(L.H * k);
    const ctx = canvas.getContext('2d');
    ctx.scale(k, k);
    if (!s.transparent) {
      ctx.fillStyle = s.bg;
      ctx.fillRect(0, 0, L.W, L.H);
    }
    ctx.fillStyle = s.fg;
    ctx.fill(new Path2D(g.mods));
    ctx.fill(new Path2D(g.eyes), 'evenodd');
    if (caption) {
      try { await document.fonts.load(`800 ${Math.round(L.fs * k)}px Nunito`); } catch { /* usa la fuente de respaldo */ }
      ctx.font = `800 ${L.fs}px Nunito, 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(caption, L.W / 2, L.capY, L.W * 0.94);
    }
    return canvas;
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ---------- Avisos de legibilidad ---------- */
  function luminance(hex) {
    const v = parseInt(hex.slice(1), 16);
    const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  function checkContrast(s) {
    const lf = luminance(s.fg);
    const lb = luminance(s.bg);
    let msg = '';
    if (s.transparent) {
      if (lf > 0.35) msg = 'Con fondo transparente el código debería ser oscuro y colocarse sobre un fondo claro.';
    } else if ((Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05) < 3) {
      msg = 'Hay poco contraste entre el código y el fondo: puede que algunos móviles no lo lean.';
    } else if (lf > lb) {
      msg = 'El código es más claro que el fondo: algunos lectores no lo reconocen. Si puedes, usa un código más oscuro.';
    }
    warn.hidden = !msg;
    warn.innerHTML = msg ? `<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><span>${msg}</span>` : '';
  }

  /* ---------- Pintado ---------- */
  let current = null; // { g, s, caption }

  function render() {
    const s = settings();
    store.set('qr-ajustes', s);
    $('#panelTexto').hidden = s.type !== 'texto';
    $('#panelWifi').hidden = s.type !== 'wifi';
    $('#wifiPassField').hidden = s.security === 'nopass';
    $('#fgHex').textContent = s.fg;
    $('#bgHex').textContent = s.bg;
    bgEl.disabled = s.transparent;
    $('#textCount').textContent = `${textEl.value.trim().length} caracteres`;
    document.querySelectorAll('.qr-preset').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.fg === s.fg && b.dataset.bg === s.bg && !s.transparent));
    });
    checkContrast(s);

    const data = payload(s);
    const caption = captionEl.value.trim();
    preview.classList.toggle('is-transparent', s.transparent);
    if (!data) {
      current = null;
      preview.innerHTML = `<div class="dc-placeholder"><i class="bi bi-qr-code" aria-hidden="true"></i><p>${s.type === 'wifi' ? 'Escribe el nombre de la red Wi-Fi' : 'Escribe un enlace o un texto'} para crear tu código QR.</p></div>`;
      meta.textContent = '';
      buttons.forEach((b) => { b.disabled = true; });
      return;
    }
    try {
      const qr = window.qrcode(0, s.ecc);
      qr.addData(data, 'Byte');
      qr.make();
      const g = geometry(qr, s);
      current = { g, s, caption };
      preview.innerHTML = toSVG(g, s, caption);
      const bytes = new TextEncoder().encode(data).length;
      meta.textContent = `Versión ${(g.n - 17) / 4} · ${g.n}×${g.n} módulos · ${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
      buttons.forEach((b) => { b.disabled = false; });
    } catch {
      current = null;
      preview.innerHTML = '<p class="dc-notice dc-notice--error"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><span>El contenido es demasiado largo para un código QR. Acórtalo o baja la «Resistencia a daños».</span></p>';
      meta.textContent = '';
      buttons.forEach((b) => { b.disabled = true; });
    }
  }

  let t;
  const schedule = () => { clearTimeout(t); t = setTimeout(render, 90); };

  /* ---------- Combinaciones de color ---------- */
  $('#presets').innerHTML = PRESETS.map(([name, fg, bg]) =>
    `<button class="qr-preset" type="button" data-fg="${fg}" data-bg="${bg}" style="--fg:${fg};--bg:${bg}" title="${name}" aria-label="Colores ${name}" aria-pressed="false"></button>`).join('');
  $('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('.qr-preset');
    if (!b) return;
    fgEl.value = b.dataset.fg;
    bgEl.value = b.dataset.bg;
    transEl.checked = false;
    sfx('click');
    render();
  });

  /* ---------- Eventos ---------- */
  document.querySelector('#herramienta').addEventListener('input', schedule);
  document.querySelector('#herramienta').addEventListener('change', schedule);
  $('#qrExample').addEventListener('click', () => {
    textEl.value = 'https://dinamiclase.org';
    textEl.dispatchEvent(new Event('input', { bubbles: true }));
  });
  $('#swapColors').addEventListener('click', () => {
    [fgEl.value, bgEl.value] = [bgEl.value, fgEl.value];
    render();
  });

  $('#dlSvg').addEventListener('click', () => {
    if (!current) return;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n${toSVG(current.g, current.s, current.caption, { forFile: true })}`;
    download(new Blob([svg], { type: 'image/svg+xml' }), `${fileName(current.s)}.svg`);
    sfx('pop');
  });

  $('#dlPng').addEventListener('click', async () => {
    if (!current) return;
    const canvas = await toCanvas(current.g, current.s, current.caption);
    canvas.toBlob((blob) => {
      if (blob) download(blob, `${fileName(current.s)}.png`);
    }, 'image/png');
    sfx('pop');
  });

  $('#copyImg').addEventListener('click', async () => {
    if (!current) return;
    if (!window.ClipboardItem || !navigator.clipboard?.write) {
      DC.toast({ title: 'Tu navegador no permite copiar imágenes', text: 'Usa «Descargar PNG» y pega el archivo.', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
      return;
    }
    const canvas = await toCanvas(current.g, current.s, current.caption);
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        DC.toast({ title: '¡Código QR copiado!', text: 'Pégalo en tu presentación, documento o chat.', icon: 'bi-clipboard-check-fill', theme: 'green' });
      } catch {
        DC.toast({ title: 'No se pudo copiar', text: 'Prueba con «Descargar PNG».', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
      }
    }, 'image/png');
  });

  render();
})();
