/* =====================================================================
   Bombo de sorteos · Dinamiclase
   - Física con Matter.js (vendor/matter-js): el bombo gira de verdad
     y las bolas ruedan, chocan y caen por la compuerta
   - Bolas con nombres (o tu lista) o con números (desde–hasta)
   - Sacar la bola del bombo o devolverla; historial de bolas
   - Hasta 60 bolas; el tamaño se ajusta a cuántas haya
   ===================================================================== */
(() => {
  'use strict';

  const DC = window.Dinamiclase;
  const { parseList, sfx, store, escapeHTML } = DC.utils;
  const $ = (s) => document.querySelector(s);
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

  // matter.min.js se carga con «defer»: puede llegar después de este script
  const boot = () => {
    if (!window.Matter) {
      const err = $('#bbError');
      err.innerHTML = '<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><span>No se pudo cargar el motor de física. Recarga la página.</span>';
      err.hidden = false;
      $('#drawBtn').disabled = true;
      return;
    }
    init(window.Matter);
  };
  if (window.Matter) boot();
  else window.addEventListener('DOMContentLoaded', boot, { once: true });

  function init(Matter) {
    const { Engine, Bodies, Body, Composite, Events } = Matter;

    /* ---------- Mundo (unidades del lienzo: 800 × 720) ---------- */
    const W = 800;
    const H = 720;
    const CX = 400;
    const CY = 300;
    const R = 240;          // radio interior del bombo
    const T = 28;           // grosor de la pared
    const N = 48;           // segmentos de la pared
    const TAU = Math.PI * 2;
    const MAX_BALLS = 60;
    const INK = '#231942';
    const COLORS = ['#FFB38A', '#9DB8FF', '#8FE3A8', '#FFA3CF', '#C7A8FF', '#86D8F7', '#FFD86B', '#7FE0D2'];

    const engine = Engine.create({ gravity: { x: 0, y: 1 } });
    engine.positionIterations = 10;
    engine.velocityIterations = 8;
    const world = engine.world;

    const segLen = ((TAU * (R + T / 2)) / N) * 1.12;
    const segs = Array.from({ length: N }, (_, i) => {
      const base = (i / N) * TAU;
      const body = Bodies.rectangle(0, 0, segLen, T, { isStatic: true, friction: 0.5, restitution: 0.3, label: 'wall' });
      return { body, base, open: false };
    });
    const fins = Array.from({ length: 3 }, (_, i) => ({
      base: (i / 3) * TAU + 0.4,
      body: Bodies.rectangle(0, 0, 70, 14, { isStatic: true, friction: 0.6, restitution: 0.2, chamfer: { radius: 6 }, label: 'fin' }),
    }));
    // Bandeja bajo la compuerta
    const TRAY_Y = 690;
    const tray = [
      Bodies.rectangle(CX, TRAY_Y + 14, 190, 24, { isStatic: true, chamfer: { radius: 8 }, label: 'tray' }),
      Bodies.rectangle(CX - 102, TRAY_Y - 26, 18, 100, { isStatic: true, chamfer: { radius: 8 }, label: 'tray' }),
      Bodies.rectangle(CX + 102, TRAY_Y - 26, 18, 100, { isStatic: true, chamfer: { radius: 8 }, label: 'tray' }),
    ];
    Composite.add(world, [...segs.map((s) => s.body), ...fins.map((f) => f.body), ...tray]);

    let drumAngle = 0;
    function placeDrum(updateVelocity) {
      segs.forEach((s) => {
        const a = s.base + drumAngle;
        Body.setPosition(s.body, { x: CX + Math.cos(a) * (R + T / 2), y: CY + Math.sin(a) * (R + T / 2) }, updateVelocity);
        Body.setAngle(s.body, a + Math.PI / 2, updateVelocity);
      });
      fins.forEach((f) => {
        const a = f.base + drumAngle;
        Body.setPosition(f.body, { x: CX + Math.cos(a) * (R - 32), y: CY + Math.sin(a) * (R - 32) }, updateVelocity);
        Body.setAngle(f.body, a, updateVelocity);
      });
    }
    placeDrum(false);

    /* ---------- Contenido de las bolas ---------- */
    const namesEl = $('#bbNames');
    const fromEl = $('#bbFrom');
    const toEl = $('#bbTo');
    const removeEl = $('#bbRemove');
    const durationEl = $('#bbDuration');

    const savedMode = store.get('bombo-modo', 'names');
    const modeInput = document.querySelector(`input[name="bbMode"][value="${savedMode}"]`);
    if (modeInput) modeInput.checked = true;

    function items() {
      if (radio('bbMode') === 'numbers') {
        const a = Math.max(0, Math.round(Number(fromEl.value) || 0));
        const b = Math.max(a, Math.round(Number(toEl.value) || 0));
        return Array.from({ length: Math.min(b - a + 1, 999) }, (_, i) => String(a + i));
      }
      return namesEl.value.split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
    }
    const signature = () => JSON.stringify([radio('bbMode'), radio('bbMode') === 'numbers' ? [fromEl.value, toEl.value] : namesEl.value]);

    let history = [];   // nombres o números en el orden en que salieron
    const savedHistory = store.get('bombo-historial', null);
    if (savedHistory && savedHistory.sig === signature()) history = savedHistory.list || [];
    const saveHistory = () => store.set('bombo-historial', { sig: signature(), list: history });

    /* ---------- Bolas ---------- */
    let balls = [];       // cuerpos de Matter con .plugin = { label, color }
    let trayBall = null;  // la última bola que salió (en la bandeja)
    let radius = 30;

    function ballsWanted() {
      const all = items();
      if (!removeEl.checked) return all.slice(0, MAX_BALLS);
      const left = [...history];
      return all.filter((it) => {
        const i = left.indexOf(it);
        if (i < 0) return true;
        left.splice(i, 1);
        return false;
      }).slice(0, MAX_BALLS);
    }

    function makeBall(label, color, x, y) {
      const b = Bodies.circle(x, y, radius, { restitution: 0.55, friction: 0.02, frictionAir: 0.004, density: 0.002, label: 'ball' });
      b.plugin = { label, color };
      return b;
    }

    function rebuild() {
      balls.forEach((b) => Composite.remove(world, b));
      if (trayBall) { Composite.remove(world, trayBall); trayBall = null; }
      const list = ballsWanted();
      radius = Math.max(15, Math.min(36, R * Math.sqrt(0.3 / Math.max(1, list.length))));
      balls = list.map((label, i) => {
        // Posición al azar dentro del bombo, sin encimarse
        let x = CX;
        let y = CY;
        for (let tries = 0; tries < 40; tries++) {
          const a = Math.random() * TAU;
          const d = Math.sqrt(Math.random()) * (R - radius - 14);
          x = CX + Math.cos(a) * d;
          y = CY + Math.sin(a) * d;
          // eslint-disable-next-line no-loop-func
          if (balls.every((o) => Math.hypot(o.position.x - x, o.position.y - y) > radius * 2.1)) break;
        }
        const b = makeBall(label, COLORS[i % COLORS.length], x, y);
        Composite.add(world, b);
        return b;
      });
      paintUI();
    }

    const canvas = $('#bombo');

    /* ---------- Sorteo ---------- */
    let state = 'idle'; // idle · spinning · settling · gate · out
    let stateAt = 0;
    let winner = null;
    const dialog = $('#winnerDialog');

    const gateHalf = () => Math.asin(Math.min(0.95, (radius * 2 * 0.8) / R)) + Math.PI / N;
    /**
     * Ángulo final del giro: el bombo se detiene con la compuerta (abajo) a mitad de
     * camino entre dos aletas, para que ninguna tape la salida ni frene a la última bola.
     */
    let spin = { from: 0, to: 0 };
    function planSpin(D) {
      const from = drumAngle;
      const minTurn = (4.2 * 2 * D) / Math.PI;                       // unas vueltas, según la duración
      const step3 = TAU / 3;
      const ideal = Math.PI / 2 - Math.PI / 3 - fins[0].base;          // punto medio entre aletas, abajo
      let to = ideal + Math.ceil((from + minTurn - ideal) / step3) * step3;
      to += (Math.random() - 0.5) * 0.3;                             // un poco de azar
      spin = { from, to };
    }
    const gateSegs = () => {
      const half = gateHalf();
      return segs.filter((s) => {
        let d = ((s.base + drumAngle) % TAU + TAU) % TAU - Math.PI / 2;
        if (d > Math.PI) d -= TAU;
        return Math.abs(d) < half;
      });
    };
    function setGate(open) {
      const list = open ? gateSegs() : segs.filter((s) => s.open);
      list.forEach((s) => {
        if (s.open === open) return;
        s.open = open;
        if (open) Composite.remove(world, s.body);
        else Composite.add(world, s.body);
      });
    }

    function draw() {
      if (state !== 'idle') return;
      if (dialog.open) dialog.close();
      // La bola de la bandeja: fuera del bombo o de vuelta adentro
      if (trayBall) {
        if (removeEl.checked) Composite.remove(world, trayBall);
        else {
          Body.setPosition(trayBall, { x: CX + (Math.random() - 0.5) * 80, y: CY - R / 2 });
          Body.setVelocity(trayBall, { x: 0, y: 0 });
          balls.push(trayBall);
        }
        trayBall = null;
      }
      if (!balls.length) {
        DC.toast({ title: 'El bombo está vacío', text: 'Pulsa «Volver a llenar el bombo» para meter todas las bolas otra vez.', icon: 'bi-info-circle-fill', theme: 'orange' });
        paintUI();
        return;
      }
      planSpin(Number(durationEl.value) || 4);
      state = 'spinning';
      stateAt = performance.now();
      $('#drawBtn').disabled = true;
      paintUI();
    }

    function finish(ball) {
      state = 'out';
      stateAt = performance.now();
      winner = ball;
      balls = balls.filter((b) => b !== ball);
      trayBall = ball;
      setGate(false);
    }

    function announce() {
      const label = winner.plugin.label;
      history.push(label);
      saveHistory();
      $('#winnerName').textContent = label;
      const wb = $('#winnerBall');
      wb.textContent = radio('bbMode') === 'numbers' ? label : '';
      wb.style.setProperty('--ball', winner.plugin.color);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      sfx('win');
      DC.confetti({ count: 130 });
      state = 'idle';
      $('#drawBtn').disabled = false;
      paintUI();
    }

    /* ---------- Bucle ---------- */
    const STEP = 1000 / 120;
    let last = performance.now();
    let acc = 0;
    let lastTick = 0;
    Events.on(engine, 'collisionStart', () => {
      const now = performance.now();
      if (state === 'spinning' && now - lastTick > 70) {
        sfx('tick');
        lastTick = now;
      }
    });

    function update(now) {
      const t = (now - stateAt) / 1000;
      if (state === 'spinning') {
        const D = Number(durationEl.value) || 4;
        if (t >= D) {
          drumAngle = spin.to;
          state = 'settling';
          stateAt = now;
          placeDrum(false);
        } else {
          // Acelera y frena suave hasta el ángulo planificado
          drumAngle = spin.from + (spin.to - spin.from) * (1 - Math.cos((Math.PI * t) / D)) / 2;
          placeDrum(true);
        }
      } else if (state === 'settling' && t > 0.7) {
        state = 'gate';
        stateAt = now;
        setGate(true);
      } else if (state === 'gate') {
        const out = balls.find((b) => b.position.y > CY + R + T + radius * 0.4);
        if (out) {
          canvas.dataset.lastExit = 'natural';
          finish(out);
        } else if (t > 3) {
          canvas.dataset.lastExit = 'forzada';
          // Si ninguna cae (p. ej. se quedaron atascadas), sale una al azar
          const b = balls[Math.floor(Math.random() * balls.length)];
          Body.setPosition(b, { x: CX, y: CY + R + T + radius + 4 });
          Body.setVelocity(b, { x: 0, y: 2 });
          finish(b);
        }
      } else if (state === 'out' && t > 1.1) {
        announce();
      }
      // Bolas que se colaron por la compuerta: vuelven al bombo
      if (state !== 'gate') {
        balls.forEach((b) => {
          if (b.position.y > CY + R + T || b.position.y > H || Math.hypot(b.position.x - CX, b.position.y - CY) > R + T * 2) {
            Body.setPosition(b, { x: CX + (Math.random() - 0.5) * 60, y: CY - R / 2 });
            Body.setVelocity(b, { x: 0, y: 0 });
          }
        });
      }
    }

    function frame(now) {
      acc += Math.min(100, now - last);
      last = now;
      while (acc >= STEP) {
        update(performance.now());
        Engine.update(engine, STEP);
        acc -= STEP;
      }
      render();
      requestAnimationFrame(frame);
    }

    /* ---------- Dibujo ---------- */
    const ctx = canvas.getContext('2d');
    let scale = 1;
    function resize() {
      const cssW = canvas.getBoundingClientRect().width || 600;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(((cssW * H) / W) * dpr);
      scale = (cssW * dpr) / W;
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    function fitLabel(text, maxW, size, weight = 800) {
      let fs = size;
      ctx.font = `${weight} ${fs}px Nunito, system-ui, sans-serif`;
      while (fs > 9 && ctx.measureText(text).width > maxW) {
        fs -= 1;
        ctx.font = `${weight} ${fs}px Nunito, system-ui, sans-serif`;
      }
      if (ctx.measureText(text).width <= maxW) return text;
      let t = text;
      while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
      return `${t}…`;
    }

    function drawBall(b) {
      const { x, y } = b.position;
      const r = b.circleRadius;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = b.plugin.color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - r * 0.32, y - r * 0.36, r * 0.24, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const numbers = radio('bbMode') === 'numbers';
      if (numbers) {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.66, 0, TAU);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.fillText(fitLabel(b.plugin.label, r * 1.15, Math.round(r * 0.78), 900), x, y + 1);
      } else {
        ctx.fillText(fitLabel(b.plugin.label, r * 1.8, Math.round(r * 0.5)), x, y + 1);
      }
    }

    function render() {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Soporte
      ctx.strokeStyle = INK;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX - 250, H - 12);
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + 250, H - 12);
      ctx.stroke();
      ctx.strokeStyle = '#FB5306';
      ctx.lineWidth = 9;
      ctx.stroke();

      // Fondo del bombo
      ctx.beginPath();
      ctx.arc(CX, CY, R + T, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fill();

      // Bolas
      balls.forEach(drawBall);

      // Pared (cada segmento presente es un arco; la compuerta abierta se ve como un hueco)
      const step = TAU / N;
      ctx.lineCap = 'butt';
      [[T + 6, INK], [T - 6, '#FFC53D']].forEach(([width, color]) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        segs.forEach((s) => {
          if (s.open) return;
          const a = s.base + drumAngle;
          ctx.beginPath();
          ctx.arc(CX, CY, R + T / 2, a - step / 2 - 0.004, a + step / 2 + 0.004);
          ctx.stroke();
        });
      });
      // Tornillos de la pared, para que se note el giro
      ctx.fillStyle = INK;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + drumAngle;
        ctx.beginPath();
        ctx.arc(CX + Math.cos(a) * (R + T / 2), CY + Math.sin(a) * (R + T / 2), 3.5, 0, TAU);
        ctx.fill();
      }

      // Aletas y eje
      ctx.lineCap = 'round';
      fins.forEach((f) => {
        const a = f.base + drumAngle;
        const x = CX + Math.cos(a) * (R - 32);
        const y = CY + Math.sin(a) * (R - 32);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * 33, y - Math.sin(a) * 33);
        ctx.lineTo(x + Math.cos(a) * 33, y + Math.sin(a) * 33);
        ctx.stroke();
        ctx.strokeStyle = '#FB5306';
        ctx.lineWidth = 8;
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.arc(CX, CY, 20, 0, TAU);
      ctx.fillStyle = '#FB5306';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.stroke();

      // Bandeja
      ctx.fillStyle = '#FFE6D9';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(CX - 111, TRAY_Y - 76);
      ctx.lineTo(CX - 111, TRAY_Y + 26);
      ctx.lineTo(CX + 111, TRAY_Y + 26);
      ctx.lineTo(CX + 111, TRAY_Y - 76);
      ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.fillRect(CX - 93, TRAY_Y + 2, 186, 22);
      ctx.globalAlpha = 1;
      if (trayBall) drawBall(trayBall);
    }

    /* ---------- Interfaz ---------- */
    function paintUI() {
      const mode = radio('bbMode');
      $('#namesField').hidden = mode !== 'names';
      $('#numbersField').hidden = mode !== 'numbers';
      const total = items().length;
      $('#bbCount').textContent = `${namesEl.value.split(/\r?\n/).filter((l) => l.trim()).length} nombres`;
      $('#ballsLeft').textContent = `${balls.length} ${balls.length === 1 ? 'bola' : 'bolas'} en el bombo`;
      $('#bbDurationValue').textContent = `${durationEl.value} s`;
      const list = $('#history');
      list.innerHTML = history.map((h) => `<li>${escapeHTML(h)}</li>`).reverse().join('');
      $('#historyEmpty').hidden = history.length > 0;
      if (total > MAX_BALLS) {
        const err = $('#bbError');
        err.className = 'dc-notice dc-notice--warn';
        err.innerHTML = `<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><span>Hay ${total} elementos: en el bombo caben ${MAX_BALLS}. Se usan los primeros ${MAX_BALLS}.</span>`;
        err.hidden = false;
      } else if (!$('#bbError').classList.contains('dc-notice--error')) $('#bbError').hidden = true;
    }

    let rebuildTimer;
    const onContent = () => {
      store.set('bombo-modo', radio('bbMode'));
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(() => {
        if (state !== 'idle') return;
        // El historial se conserva solo para lo que sigue en la lista
        const all = items();
        history = history.filter((h) => all.includes(h));
        saveHistory();
        rebuild();
      }, 400);
    };
    namesEl.addEventListener('input', onContent);
    [fromEl, toEl].forEach((el) => el.addEventListener('input', onContent));
    document.querySelectorAll('input[name="bbMode"]').forEach((r) => r.addEventListener('change', () => { paintUI(); onContent(); }));
    removeEl.addEventListener('change', () => { if (state === 'idle') rebuild(); });
    durationEl.addEventListener('input', paintUI);

    $('#drawBtn').addEventListener('click', draw);
    $('#againBtn').addEventListener('click', () => { dialog.close(); setTimeout(draw, 200); });
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    $('#refillBtn').addEventListener('click', () => {
      if (state !== 'idle') return;
      history = [];
      saveHistory();
      rebuild();
      sfx('pop');
    });
    $('#useStudents').addEventListener('click', () => {
      const list = parseList(store.get('lista-estudiantes', ''));
      if (!list.length) {
        DC.toast({ title: 'Aún no tienes una lista', text: 'Escríbela en «Mi lista», en la página de inicio, y estará disponible aquí.', icon: 'bi-people-fill', theme: 'blue' });
        return;
      }
      namesEl.value = list.join('\n');
      namesEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName) || dialog.open) return;
      e.preventDefault();
      draw();
    });

    rebuild();
    requestAnimationFrame(frame);
  }
})();
