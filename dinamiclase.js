/* =====================================================================
   DINAMICLASE · Núcleo compartido v2
   ---------------------------------------------------------------------
   Notificaciones, confeti, navegación, animaciones y componentes
   comunes de las herramientas. Sin dependencias. Se carga en todas
   las páginas del sitio:  <script src="dinamiclase.js"></script>

   API pública (window.Dinamiclase):
     toast({title,text,icon,theme,timeout})
     confetti({x,y,count})
     reducedMotion()
     utils: shuffle, parseList, clamp, sleep, escapeHTML, sfx(tipo),
            copyText, store.get/set

   Componentes declarativos (no requieren JS propio):
     [data-dc-persist="clave"]          → guarda el valor del campo en el navegador
     [data-dc-stepper]                  → selector numérico − / +
     input.dc-range                     → deslizador con relleno de color
     [data-dc-sound]                    → botón para activar/silenciar sonidos
     [data-dc-fullscreen="#selector"]   → modo proyector (pantalla completa)
     [data-dc-timer]                    → temporizador con anillo de progreso
     [data-dc-clear-data]               → borra los datos guardados en este navegador
   ===================================================================== */
(() => {
  'use strict';

  document.documentElement.classList.add('dc-js');

  const CONFETTI_COLORS = ['#FB5306', '#2F6BFF', '#7C3AED', '#DB2777', '#14B8A6', '#22C55E', '#FFC53D', '#0EA5E9'];

  /* ------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------ */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => motionQuery.matches;

  /** Capa donde dibujar efectos: diálogo modal abierto, escenario a pantalla completa o el body. */
  const effectsHost = () => {
    let modal = null;
    try { modal = $('dialog:modal'); } catch { /* navegador sin :modal */ }
    return modal || document.fullscreenElement || $('.dc-stage.is-fullscreen') || document.body;
  };

  /* ------------------------------------------------------------------
     Efectos: avisos y confeti
     ------------------------------------------------------------------ */
  function toast({ title, text = '', icon = 'bi-stars', theme = 'yellow', timeout = 4800 } = {}) {
    const host = effectsHost();
    let box = $(':scope > .dc-toasts', host);
    if (!box) {
      box = document.createElement('div');
      box.className = 'dc-toasts';
      box.setAttribute('aria-live', 'polite');
      host.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `dc-toast dc-theme-${theme}`;
    el.innerHTML = `
      <span class="dc-toast__icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
      <div><p class="dc-toast__title"></p><p class="dc-toast__text"></p></div>
      <button type="button" class="dc-toast__close" aria-label="Cerrar notificación"><i class="bi bi-x-lg"></i></button>`;
    $('.dc-toast__title', el).textContent = title;
    $('.dc-toast__text', el).textContent = text;
    box.appendChild(el);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 400);
    };
    $('.dc-toast__close', el).addEventListener('click', close);
    setTimeout(close, timeout);
    return el;
  }

  function confetti({ x, y, count = 100 } = {}) {
    if (reducedMotion() || typeof Element.prototype.animate !== 'function') return;
    const ox = x ?? window.innerWidth / 2;
    const oy = y ?? window.innerHeight * 0.35;
    const layer = document.createElement('div');
    layer.className = 'dc-confetti';
    layer.setAttribute('aria-hidden', 'true');
    effectsHost().appendChild(layer);

    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      const w = 6 + Math.random() * 7;
      p.style.cssText = `left:${ox}px;top:${oy}px;width:${w}px;height:${w * (Math.random() > .5 ? 1.6 : 1)}px;`
        + `background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};border-radius:${Math.random() > .6 ? '50%' : '2px'};`;
      layer.appendChild(p);
      const angle = Math.random() * Math.PI * 2;
      const power = 120 + Math.random() * 300;
      const dx = Math.cos(angle) * power;
      const dy = Math.sin(angle) * power - 220;
      const spin = (Math.random() - .5) * 1080;
      p.animate([
        { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin / 2}deg)`, opacity: 1, offset: .35 },
        { transform: `translate(calc(-50% + ${dx * 1.3}px), calc(-50% + ${dy + 520}px)) rotate(${spin}deg)`, opacity: 0 },
      ], { duration: 1500 + Math.random() * 1100, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
    }
    setTimeout(() => layer.remove(), 2800);
  }

  /* ------------------------------------------------------------------
     Interfaz general
     ------------------------------------------------------------------ */
  function initNav() {
    const nav = $('.dc-nav');
    if (!nav) return;

    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const toggle = $('.dc-nav__toggle', nav);
    const menu = $('.dc-nav__menu', nav);
    if (toggle && menu) {
      const setOpen = (open) => {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        menu.classList.toggle('is-open', open);
      };
      toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
      menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
      });
    }

    // Resalta la sección visible
    const links = $$('.dc-nav__link[href^="#"]', nav);
    const targets = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
    if (!targets.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => {
          const on = a.getAttribute('href') === `#${en.target.id}`;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach((t) => io.observe(t));
  }

  function initReveal() {
    $$('[data-dc-stagger]').forEach((group) => {
      Array.from(group.children).forEach((child, i) => child.style.setProperty('--i', String(i % 6)));
    });
    const items = $$('.dc-reveal');
    if (!('IntersectionObserver' in window) || reducedMotion()) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-visible');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => io.observe(el));
  }

  function initCounters() {
    const els = $$('[data-dc-count]');
    if (!els.length || reducedMotion() || !('IntersectionObserver' in window)) return;
    const run = (el) => {
      const to = Number(el.dataset.dcCount);
      const suffix = el.dataset.dcSuffix || '';
      const start = performance.now();
      const dur = 1300;
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        el.textContent = `${Math.round(to * (1 - Math.pow(1 - t, 3)))}${suffix}`;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        run(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.6 });
    els.forEach((el) => {
      el.textContent = `0${el.dataset.dcSuffix || ''}`;
      io.observe(el);
    });
  }

  function initRotators() {
    $$('[data-dc-rotate]').forEach((el) => {
      const words = el.dataset.dcRotate.split('|').map((w) => w.trim()).filter(Boolean);
      if (words.length < 2 || reducedMotion()) return;
      let i = Math.max(0, words.indexOf(el.textContent.trim()));
      el.addEventListener('animationend', () => el.classList.remove('is-in'));
      setInterval(() => {
        if (document.hidden) return;
        el.classList.add('is-out');
        setTimeout(() => {
          i = (i + 1) % words.length;
          el.textContent = words[i];
          el.classList.remove('is-out');
          el.classList.add('is-in');
        }, 280);
      }, 2900);
    });
  }

  /* Borrar los datos guardados en este navegador: [data-dc-clear-data] */
  function initClearData() {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-dc-clear-data]')) return;
      if (!window.confirm('¿Borrar tus listas y preferencias guardadas en este navegador?')) return;
      try {
        Object.keys(localStorage).filter((k) => k.startsWith('dinamiclase:')).forEach((k) => localStorage.removeItem(k));
      } catch { /* almacenamiento no disponible */ }
      toast({ title: 'Datos borrados', text: 'Se eliminaron tus listas y preferencias de este navegador.', icon: 'bi-trash3-fill', theme: 'blue' });
    });
  }

  /* ------------------------------------------------------------------
     Utilidades para las herramientas
     ------------------------------------------------------------------ */
  const STORE_PREFIX = 'dinamiclase:dato:';
  const store = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(STORE_PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value)); } catch { /* sin espacio */ }
    },
  };

  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const escapeHTML = (str) => String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Copia y baraja (Fisher–Yates). No modifica el original. */
  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Convierte un texto en lista. Usa saltos de línea; si no hay, usa comas o punto y coma. */
  function parseList(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const sep = raw.includes('\n') ? /\r?\n/ : /[,;]/;
    return raw.split(sep).map((s) => s.trim()).filter(Boolean);
  }

  /* Sonidos generados (sin archivos) */
  const SOUND_KEY = 'dinamiclase:sonido';
  let audioCtx = null;
  const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } };
  const SFX = {
    tick:  [[1400, .03, 'square', .035]],
    click: [[320, .06, 'triangle', .12]],
    pop:   [[520, .09, 'sine', .16, 0, 880], [880, .08, 'sine', .1, .06]],
    flip:  [[760, .22, 'triangle', .12, 0, 380]],
    win:   [[523, .14, 'triangle', .16], [659, .14, 'triangle', .16, .12], [784, .14, 'triangle', .16, .24], [1047, .4, 'triangle', .18, .36]],
    alarm: [[880, .22, 'square', .09], [880, .22, 'square', .09, .32], [1175, .5, 'square', .09, .64]],
    soft:  [[660, .35, 'sine', .14], [990, .5, 'sine', .1, .18]],
  };
  function sfx(name = 'pop') {
    if (!soundOn() || !SFX[name]) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      SFX[name].forEach(([freq, dur, type = 'sine', vol = .12, delay = 0, to]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + delay);
        if (to) osc.frequency.exponentialRampToValueAtTime(to, now + delay + dur);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(vol, now + delay + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.05);
      });
    } catch { /* audio no disponible */ }
  }

  function syncSoundButtons() {
    const on = soundOn();
    $$('[data-dc-sound]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(!on));
      btn.setAttribute('aria-label', on ? 'Silenciar sonidos' : 'Activar sonidos');
      btn.title = on ? 'Silenciar sonidos' : 'Activar sonidos';
      const i = $('i', btn);
      if (i) i.className = `bi ${on ? 'bi-volume-up-fill' : 'bi-volume-mute-fill'}`;
    });
  }

  async function copyText(text, { silent = false } = {}) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    if (!silent) {
      toast(ok
        ? { title: '¡Copiado!', text: 'Ya puedes pegarlo donde quieras.', icon: 'bi-clipboard-check-fill', theme: 'green', timeout: 2600 }
        : { title: 'No se pudo copiar', text: 'Tu navegador bloqueó el portapapeles.', icon: 'bi-exclamation-triangle-fill', theme: 'red' });
    }
    return ok;
  }

  /* Campos que se recuerdan entre visitas: [data-dc-persist="clave"] */
  function restorePersisted() {
    $$('[data-dc-persist]').forEach((el) => {
      const key = el.dataset.dcPersist;
      const saved = store.get(key);
      if (saved !== null && saved !== '') {
        if (el.type === 'checkbox') el.checked = Boolean(saved);
        else el.value = saved;
      }
      let t;
      const save = () => {
        clearTimeout(t);
        t = setTimeout(() => store.set(key, el.type === 'checkbox' ? el.checked : el.value), 250);
      };
      el.addEventListener('input', save);
      el.addEventListener('change', save);
    });

    // Si el dato cambia en otra pestaña (p. ej. la lista de estudiantes en la portada), se actualiza aquí
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith(STORE_PREFIX)) return;
      let value = null;
      try { value = JSON.parse(e.newValue); } catch { return; }
      const key = e.key.slice(STORE_PREFIX.length);
      $$(`[data-dc-persist="${CSS.escape(key)}"]`).forEach((el) => {
        if (el === document.activeElement) return; // no se pisa lo que alguien está escribiendo
        if (el.type === 'checkbox') {
          if (el.checked === Boolean(value)) return;
          el.checked = Boolean(value);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          const next = value === null ? '' : String(value);
          if (el.value === next) return;
          el.value = next;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    });
  }

  /* Selector numérico: [data-dc-stepper] > button[data-step] + input[type=number] */
  function initSteppers() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dc-stepper] [data-step]');
      if (!btn) return;
      const input = $('input', btn.closest('[data-dc-stepper]'));
      if (!input || input.disabled) return;
      const min = input.min === '' ? -Infinity : Number(input.min);
      const max = input.max === '' ? Infinity : Number(input.max);
      const step = Number(btn.dataset.step) * (Number(input.step) || 1);
      const cur = Number(input.value) || 0;
      input.value = String(clamp(cur + step, min, max));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    document.addEventListener('change', (e) => {
      const input = e.target.closest('[data-dc-stepper] input');
      if (!input) return;
      const min = input.min === '' ? -Infinity : Number(input.min);
      const max = input.max === '' ? Infinity : Number(input.max);
      const v = Number(input.value);
      const fixed = Number.isFinite(v) ? clamp(Math.round(v), min, max) : (Number.isFinite(min) ? min : 0);
      if (String(fixed) !== input.value) input.value = String(fixed);
    });
  }

  /* Deslizadores con relleno */
  const paintRange = (r) => {
    const min = Number(r.min) || 0;
    const max = Number(r.max) || 100;
    r.style.setProperty('--fill', `${((Number(r.value) - min) / (max - min)) * 100}%`);
  };
  function initRanges() {
    $$('input.dc-range').forEach(paintRange);
    document.addEventListener('input', (e) => { if (e.target.matches?.('input.dc-range')) paintRange(e.target); });
  }

  /* Modo proyector: [data-dc-fullscreen="#objetivo"] */
  function setStage(target, on) {
    if (!target) return;
    target.classList.toggle('is-fullscreen', on);
    if (on && target.requestFullscreen && !document.fullscreenElement) {
      target.requestFullscreen().catch(() => { /* se queda en modo pseudo-pantalla completa */ });
    }
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    $$('[data-dc-fullscreen]').forEach((btn) => {
      const active = $(btn.dataset.dcFullscreen)?.classList.contains('is-fullscreen');
      btn.setAttribute('aria-pressed', String(Boolean(active)));
      btn.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Pantalla completa (modo proyector)');
      btn.title = active ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa (modo proyector)';
      const i = $('i', btn);
      if (i) i.className = `bi ${active ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}`;
    });
    target.dispatchEvent(new CustomEvent('dc:stage', { detail: { fullscreen: on } }));
  }
  function initFullscreen() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dc-fullscreen]');
      if (!btn) return;
      const target = $(btn.dataset.dcFullscreen);
      setStage(target, !target?.classList.contains('is-fullscreen'));
    });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) $$('.dc-stage.is-fullscreen').forEach((el) => setStage(el, false));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      $$('.dc-stage.is-fullscreen').forEach((el) => setStage(el, false));
    });
  }

  /* Temporizador: [data-dc-timer] (ver marcado en plantilla.html) */
  const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  function initTimer(el) {
    const timeEl = $('.dc-timer__time', el);
    const live = $('[data-dc-timer-live]', el);
    const toggle = $('[data-dc-timer-toggle]', el);
    const resetBtn = $('[data-dc-timer-reset]', el);
    let total = Number(el.dataset.seconds) || 60;
    let remaining = total;
    let endAt = 0;
    let raf = 0;
    let running = false;
    let lastWhole = -1;

    const paint = () => {
      const shown = Math.ceil(remaining);
      timeEl.textContent = remaining <= 0 ? '¡Tiempo!' : fmtClock(shown);
      el.style.setProperty('--off', String(1 - remaining / total));
      el.classList.toggle('is-urgent', running && remaining > 0 && remaining <= 5);
      if (toggle) {
        toggle.innerHTML = running
          ? '<i class="bi bi-pause-fill" aria-hidden="true"></i> Pausar'
          : `<i class="bi bi-play-fill" aria-hidden="true"></i> ${remaining < total && remaining > 0 ? 'Seguir' : 'Iniciar'}`;
      }
    };
    const loop = () => {
      remaining = Math.max(0, (endAt - performance.now()) / 1000);
      const whole = Math.ceil(remaining);
      if (running && whole !== lastWhole && whole <= 5 && whole > 0) sfx('tick');
      lastWhole = whole;
      paint();
      if (remaining <= 0) {
        running = false;
        el.classList.add('is-done');
        if (live) live.textContent = '¡Se acabó el tiempo!';
        sfx('alarm');
        paint();
        el.dispatchEvent(new CustomEvent('dc:timer-end', { bubbles: true }));
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const api = {
      start() {
        if (running) return;
        if (remaining <= 0) remaining = total;
        el.classList.remove('is-done');
        running = true;
        endAt = performance.now() + remaining * 1000;
        if (live) live.textContent = `Temporizador iniciado: ${fmtClock(remaining)}`;
        loop();
      },
      pause() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(raf);
        paint();
      },
      reset() {
        running = false;
        cancelAnimationFrame(raf);
        remaining = total;
        el.classList.remove('is-done', 'is-urgent');
        paint();
      },
      restart() { api.reset(); api.start(); },
      setSeconds(sec) { total = Math.max(1, Number(sec) || 60); api.reset(); },
      get running() { return running; },
    };
    toggle?.addEventListener('click', () => (running ? api.pause() : api.start()));
    resetBtn?.addEventListener('click', api.reset);
    $$('input[type="radio"]', el).forEach((r) => {
      if (r.checked) total = Number(r.value) || total;
      r.addEventListener('change', () => api.setSeconds(r.value));
    });
    remaining = total;
    paint();
    el.dcTimer = api;
  }

  // Se ejecuta en cuanto carga el script (antes que el JS de cada herramienta)
  restorePersisted();
  initSteppers();
  initRanges();
  initFullscreen();
  $$('[data-dc-timer]').forEach(initTimer);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dc-sound]');
    if (!btn) return;
    try { localStorage.setItem(SOUND_KEY, soundOn() ? 'off' : 'on'); } catch { /* */ }
    syncSoundButtons();
    sfx('pop');
  });
  syncSoundButtons();


  /* ------------------------------------------------------------------
     Arranque
     ------------------------------------------------------------------ */
  // Limpia el progreso de XP de versiones anteriores del sitio
  try { localStorage.removeItem('dinamiclase:progreso:v1'); } catch { /* */ }

  function boot() {
    initNav();
    initReveal();
    initCounters();
    initRotators();
    initClearData();
  }

  window.Dinamiclase = {
    toast, confetti, reducedMotion,
    utils: { shuffle, parseList, clamp, sleep, escapeHTML, sfx, copyText, store },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
