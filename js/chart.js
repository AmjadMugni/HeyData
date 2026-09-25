// HeyData — hero crosstab. Canvas 2D, koi library nahi.
//
// Assembly ke phase (kul ~1.9s):
//   0-260    GRID      grid lines baayein se daayein draw hoti hain
//   260-760  INTAKE    ~70 raw dots trail ke saath apni lane mein aate hain
//   700-900  REJECT    5 dots QC mein flag hokar ghul jaate hain
//   760-1400 PRINT     ek scan line guzarti hai aur uske peeche bar "print" hoti hai
//   1400-1900 LOCK     overshoot settle + number count-up + ring pulse + click

import { rows, DATA, LOW_BASE } from './data.js?v=20260925121500';

const SERIES = ['--series-1', '--series-2', '--series-3', '--series-4'];

const T = { grid: 420, intake: 1250, reject: 1520, print: 2450, lock: 3250 };
const ROW_STAGGER = 150;
const SWITCH_MS = 1250;
const DOTS = 70;
const REJECTS = 5;

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = t => Math.min(1, Math.max(0, t));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOvershoot = t => {
  const c = 1.8;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function createChart(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const onLock = opts.onLock || (() => {});
  const onSettle = opts.onSettle || (() => {});

  let W = 0, H = 0;
  let group = opts.group || 'small';
  let data = rows(group);
  let shown = data.map(() => 0);
  let from = data.map(() => 0);
  let raf = null, phase = null, t0 = 0;
  let dots = [], pulses = [], locked = new Set();
  let validated = 0;          // 0..1 — "VALIDATED" chip
  let palette = [], ink, inkDim, inkFaint, line, panel, cyan, amber;
  let highlight = null;

  function readColors() {
    palette = SERIES.map(css);
    ink = css('--ink'); inkDim = css('--ink-dim'); inkFaint = css('--ink-faint');
    line = css('--line'); panel = css('--bg-panel');
    cyan = css('--cyan'); amber = css('--amber');
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = Math.max(226, Math.min(r.width * 0.48, 300));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (phase === null) drawStatic();  // animation chalu ho to usko mat chhedo
  }

  function geom() {
    const padL = Math.min(186, Math.max(112, W * 0.33));
    const padR = 56, padT = 10, padB = 28;
    const rowH = (H - padT - padB) / data.length;
    const barH = Math.min(26, rowH * 0.5);
    return { padL, padR, padT, padB, rowH, barH, max: 70, plotW: W - padL - padR };
  }

  function barRect(i, value) {
    const g = geom();
    return {
      x: g.padL,
      y: g.padT + g.rowH * i + (g.rowH - g.barH) / 2,
      w: Math.max(0, (value / g.max) * g.plotW),
      h: g.barH
    };
  }

  function seedDots() {
    const rand = rng((Date.now() ^ (W * 7919)) >>> 0);
    dots = [];
    for (let i = 0; i < DOTS; i++) {
      const col = i % data.length;
      dots.push({
        col,
        rejected: i >= DOTS - REJECTS,
        x0: rand() * W,
        y0: rand() * H,
        lane: rand(),
        delay: rand() * 560,
        speed: 0.82 + rand() * 0.35
      });
    }
  }

  /* ---------- drawing helpers ---------- */

  function gridLines(p) {
    // lines hata di — sirf axis ke % labels, chart khud bolta hai
    const g = geom();
    ctx.save();
    ctx.font = `400 11px ${css('--font-mono') || 'monospace'}`;
    ctx.textAlign = 'center';
    for (let v = 0; v <= 60; v += 20) {
      const x = Math.round(g.padL + (v / g.max) * g.plotW) + 0.5;
      const local = clamp01((p - (v / 60) * 0.35) * 1.6);
      if (local <= 0) continue;
      ctx.globalAlpha = local * 0.75;
      ctx.fillStyle = inkFaint;
      ctx.fillText(v + '%', x, H - g.padB + 19);
    }
    ctx.restore();
  }

  function labels(alpha) {
    const g = geom();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = inkDim;
    ctx.font = `400 ${W < 520 ? 11 : 12}px ${css('--font-body') || 'sans-serif'}`;
    ctx.textAlign = 'right';
    data.forEach((row, i) => {
      const r = barRect(i, 0);
      ctx.fillText(row.label, g.padL - 16, r.y + r.h / 2 + 4, g.padL - 26);
    });
    ctx.restore();
  }

  function tracks() {
    // row bands bhi hata diye — saaf, sirf bars
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, h / 2, Math.max(0, w));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.max(0, w - rr), y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + Math.max(0, w - rr), y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }

  function bar(i, value, opts = {}) {
    const r = barRect(i, value);
    if (r.w <= 0.5) return r;
    const isYou = highlight === data[i].id;
    const base = isYou ? cyan : palette[i];

    // body — halka gradient, taaki flat na lage
    const grad = ctx.createLinearGradient(r.x, 0, r.x + Math.max(r.w, 1), 0);
    grad.addColorStop(0, base);
    grad.addColorStop(1, mix(base, '#ffffff', 0.18));
    ctx.save();
    ctx.fillStyle = grad;
    ctx.shadowColor = base;
    ctx.shadowBlur = opts.glow ? 10 : 3;
    ctx.shadowOffsetY = 2;
    roundRect(r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.restore();

    // leading edge — print hote waqt chamakti hai
    if (opts.edge) {
      ctx.save();
      ctx.globalAlpha = opts.edge;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(r.x + r.w - 2, r.y, 2, r.h);
      ctx.restore();
    }

    if (isYou) {
      ctx.save();
      ctx.strokeStyle = panel;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      ctx.fillStyle = cyan;
      ctx.font = `500 10px ${css('--font-mono') || 'monospace'}`;
      ctx.textAlign = 'left';
      ctx.fillText('YOU', r.x + r.w + 48, r.y + r.h / 2 + 3);
      ctx.restore();
    }
    return r;
  }

  function value(i, v, alpha) {
    const r = barRect(i, v);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = alpha >= 1 ? ink : inkDim;
    ctx.font = `500 ${W < 520 ? 14 : 16}px ${css('--font-mono') || 'monospace'}`;
    ctx.textAlign = 'left';
    ctx.fillText(Math.round(v) + '%', r.x + r.w + 12, r.y + r.h / 2 + 5);
    ctx.restore();
  }

  function scanline(x, alpha) {
    const g = geom();
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createLinearGradient(x - 26, 0, x + 2, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, cyan);
    ctx.fillStyle = grad;
    ctx.fillRect(x - 26, g.padT - 4, 26, H - g.padT - g.padB + 10);
    ctx.fillStyle = cyan;
    ctx.fillRect(x, g.padT - 4, 1.5, H - g.padT - g.padB + 10);
    ctx.restore();
  }

  function ringPulse(p) {
    ctx.save();
    ctx.globalAlpha = (1 - p.t) * 0.55;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2 * (1 - p.t) + 0.5;
    const r = 6 + p.t * 34;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function validatedChip(a) {
    if (a <= 0.01) return;
    const g = geom();
    const text = 'VALIDATED';
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `500 10px ${css('--font-mono') || 'monospace'}`;
    const w = ctx.measureText(text).width + 22;
    const x = W - g.padR - w + 40, y = 2;
    ctx.fillStyle = mix(css('--green'), panel, 0.75);
    roundRect(x, y, w, 18, 9);
    ctx.fill();
    ctx.fillStyle = css('--green');
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 11, y + 13);
    ctx.restore();
  }

  function mix(a, b, amt) {
    const pa = hex(a), pb = hex(b);
    if (!pa || !pb) return a;
    const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * amt));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function hex(c) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c.trim());
    return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : null;
  }

  /* ---------- frames ---------- */

  function drawStatic() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    gridLines(1);
    labels(1);
    tracks();
    data.forEach((d, i) => { bar(i, shown[i]); value(i, shown[i], 1); });
    validatedChip(validated);
  }

  function drawFrame(t) {
    ctx.clearRect(0, 0, W, H);
    const g = geom();

    gridLines(clamp01(t / T.grid));
    labels(clamp01((t - 160) / 400));
    if (t > T.grid * 0.7) tracks();

    // dots
    if (t < T.print + 120) {
      dots.forEach(d => {
        const p = easeOut(clamp01((t - T.grid - d.delay) / (900 / d.speed)));
        if (p <= 0) return;
        const target = barRect(d.col, data[d.col].value);
        const tx = target.x + 10 + d.lane * Math.max(24, target.w - 20);
        const ty = target.y + 4 + d.lane * (target.h - 8);
        const x = d.x0 + (tx - d.x0) * p;
        const y = d.y0 + (ty - d.y0) * p;

        let alpha = 0.22 + 0.55 * p;
        let color = d.rejected ? inkFaint : palette[d.col];

        if (d.rejected) {
          const r = clamp01((t - T.intake + 40) / (T.reject - T.intake));
          alpha *= 1 - r;
          color = mix(inkFaint, amber, r);
        } else if (t > T.print - 200) {
          alpha *= clamp01(1 - (t - (T.print - 200)) / 320);   // bar ban gayi to dots ghul jaate hain
        }
        if (alpha <= 0.02) return;

        // trail
        ctx.save();
        ctx.globalAlpha = alpha * 0.35;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - (tx - d.x0) * 0.06 * (1 - p), y - (ty - d.y0) * 0.06 * (1 - p));
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // print phase — scan line ke peeche bars
    const printP = clamp01((t - T.intake) / (T.print - T.intake));
    if (printP > 0) {
      const headX = g.padL + easeInOut(printP) * g.plotW;
      data.forEach((d, i) => {
        const full = barRect(i, d.value);
        const lockStart = T.print + i * ROW_STAGGER;
        let w;
        if (t < lockStart) {
          w = Math.min(full.w, Math.max(0, headX - full.x));
          const v = (w / Math.max(full.w, 0.001)) * d.value;
          shown[i] = v;
          bar(i, v, { edge: printP < 1 ? 0.9 : 0.4 });
          value(i, v, 0.55);
        } else {
          const lp = clamp01((t - lockStart) / (T.lock - T.print - ROW_STAGGER));
          shown[i] = d.value * easeOvershoot(Math.max(lp, 0.001));
          bar(i, shown[i], { glow: lp < 0.6 });
          value(i, shown[i], 0.55 + 0.45 * lp);
          if (lp >= 1 && !locked.has(i)) {
            locked.add(i);
            const r = barRect(i, d.value);
            pulses.push({ x: r.x + r.w, y: r.y + r.h / 2, t: 0, color: palette[i] });
            onLock(i);
          }
        }
      });
      if (printP < 1) scanline(headX, 0.9);
    }

    // pulses
    pulses = pulses.filter(p => p.t < 1);
    pulses.forEach(p => { p.t += 0.03; ringPulse(p); });

    validated = clamp01((t - T.lock + 200) / 400);
    validatedChip(validated);
  }

  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; phase = null; }

  function run(duration, frame, done) {
    stop();
    phase = 'run';
    t0 = performance.now();
    const step = now => {
      const t = now - t0;
      if (t >= duration) {
        phase = null;
        done();
        return;
      }
      frame(t);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /* ---------- public ---------- */

  let introDone = false;

  function intro() {
    readColors();
    if (reduced()) {
      shown = data.map(d => d.value);
      validated = 1;
      drawStatic();
      onSettle();
      return;
    }
    seedDots();
    locked = new Set();
    pulses = [];
    validated = 0;
    shown = data.map(() => 0);
    run(T.lock + 700, drawFrame, () => {
      shown = data.map(d => d.value);
      validated = 1;
      introDone = true;
      drawStatic();
      onSettle();
    });
  }

  function setGroup(id) {
    group = id;
    from = shown.slice();
    data = rows(group);
    readColors();
    if (reduced()) { shown = data.map(d => d.value); drawStatic(); onSettle(); return; }

    locked = new Set();
    pulses = [];
    const g = geom();
    run(SWITCH_MS + 260, t => {
      ctx.clearRect(0, 0, W, H);
      gridLines(1);
      labels(1);
      tracks();
      const headX = g.padL + easeInOut(clamp01(t / (SWITCH_MS * 0.55))) * g.plotW;
      data.forEach((d, i) => {
        const p = clamp01((t - i * ROW_STAGGER) / (SWITCH_MS - ROW_STAGGER * 1.5));
        shown[i] = from[i] + (d.value - from[i]) * easeOvershoot(Math.max(p, 0.001));
        bar(i, shown[i], { glow: p < 0.7 });
        value(i, shown[i], 0.6 + 0.4 * p);
        if (p >= 1 && !locked.has(i)) {
          locked.add(i);
          const r = barRect(i, d.value);
          pulses.push({ x: r.x + r.w, y: r.y + r.h / 2, t: 0, color: palette[i] });
          onLock(i);
        }
      });
      if (t < SWITCH_MS * 0.55) scanline(headX, 0.55);
      pulses = pulses.filter(p => p.t < 1);
      pulses.forEach(p => { p.t += 0.035; ringPulse(p); });
      validatedChip(validated);
    }, () => {
      shown = data.map(d => d.value);
      drawStatic();
      onSettle();
    });
  }

  function setHighlight(id) { highlight = id; if (phase === null) drawStatic(); }

  function baseText() {
    const g = DATA.groups.find(x => x.id === group);
    return `n=${g.n} of ${DATA.meta.n} · demo dataset · ${DATA.meta.updated}${g.n < LOW_BASE ? ' · low base' : ''}`;
  }

  readColors();
  new ResizeObserver(resize).observe(canvas.parentElement || canvas);
  resize();

  return {
    intro, setGroup, setHighlight, baseText, redraw: drawStatic,
    get group() { return group; },
    get introDone() { return introDone; }
  };
}
