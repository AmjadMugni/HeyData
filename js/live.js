// HeyData — Live Data: ek "analysis console".
// Teen cuts ek hi canvas pe, aur switch karne par marks ud kar nayi shape banate hain:
// trend ke points -> bars -> crosstab ke cells. Hover pe readout milta hai.

import { LIVE } from './data.js?v=20260924162000';

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = t => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;

function rgb(hex) {
  const h = (hex || '#888').replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mixRgb = (a, b, t) => [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)];
const toCss = (c, a = 1) => `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;

export function createLive(canvas) {
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement || canvas;

  let W = 0, H = 0;
  let view = 'trend', prevView = 'trend';
  let t = 1;                 // 0 = prevView, 1 = view
  let raf = null, intro = 0; // intro 0..1 — pehli baar draw-on
  let hover = null;          // {x, y}
  let marks = [];            // current frame ke marks (hover ke liye)

  const tip = document.createElement('div');
  tip.className = 'live-tip';
  tip.hidden = true;
  host.style.position = 'relative';
  host.appendChild(tip);

  /* ---------- layout ---------- */
  const narrow = () => W < 680;

  function frame(kind) {
    const l = kind === 'matrix' ? (narrow() ? 96 : 168) : 56;
    return { l, r: kind === 'matrix' ? (narrow() ? 14 : 30) : 54, t: narrow() ? 64 : 44, b: 42 };
  }

  // domain — 0 se shuru karke aadha chart khaali chhodne ka koi matlab nahi
  function domainOf(d) {
    if (d.kind === 'matrix') return { lo: 0, hi: 1 };
    const all = d.series.flatMap(s => s.values);
    const mn = Math.min(...all), mx = Math.max(...all);
    if (d.kind === 'bars') return { lo: 0, hi: Math.ceil((mx * 1.18) / 10) * 10 };
    const pad = Math.max(6, (mx - mn) * 0.2);
    return { lo: Math.max(0, Math.floor((mn - pad) / 20) * 20), hi: Math.ceil((mx + pad) / 20) * 20 };
  }

  /* ---------- har view apne marks banata hai ---------- */
  // mark: { key, cx, cy, w, h, r, col, alpha, val, label, col2 }

  function buildTrend(d) {
    const f = frame('trend'), pw = W - f.l - f.r, ph = H - f.t - f.b;
    const { lo, hi } = domainOf(d);
    const out = [];
    d.series.forEach((s, si) => {
      const col = rgb(css(si === 0 ? '--series-1' : '--series-2'));
      s.values.forEach((v, i) => {
        out.push({
          key: si + ':' + i, si, i,
          cx: f.l + (pw / (s.values.length - 1)) * i,
          cy: f.t + ph - ((v - lo) / (hi - lo)) * ph,
          w: 9, h: 9, r: 4.5, col, alpha: 1,
          val: v, unit: '', label: s.label, x: d.x[i]
        });
      });
    });
    return out;
  }

  function buildBars(d) {
    const f = frame('bars'), pw = W - f.l - f.r, ph = H - f.t - f.b;
    const { hi } = domainOf(d);
    const groups = d.x.length, per = d.series.length, slot = pw / groups;
    const bw = Math.min(34, (slot - 18) / per);
    const out = [];
    d.series.forEach((s, si) => {
      const col = rgb(css(si === 0 ? '--series-1' : '--series-2'));
      s.values.forEach((v, i) => {
        const h = (v / hi) * ph;
        const x = f.l + slot * i + (slot - bw * per - 3 * (per - 1)) / 2 + si * (bw + 3);
        out.push({
          key: si + ':' + i, si, i,
          cx: x + bw / 2, cy: f.t + ph - h / 2,
          w: bw, h, r: 3, col, alpha: 1,
          val: v, unit: '%', label: s.label, x: d.x[i]
        });
      });
    });
    return out;
  }

  function buildMatrix(d) {
    const f = frame('matrix'), pw = W - f.l - f.r, ph = H - f.t - f.b;
    const cw = pw / d.cols.length, ch = Math.min(52, ph / d.rows.length);
    const top = f.t + (ph - ch * d.rows.length) / 2;
    const hot = rgb(css('--green')), cold = rgb(css('--magenta')), flat = rgb(css('--bg-elev'));
    const out = [];
    d.rows.forEach((row, ri) => {
      row.values.forEach((v, ci) => {
        const dev = clamp01(Math.abs(v - 100) / 45);
        const col = mixRgb(flat, v >= 100 ? hot : cold, 0.12 + dev * 0.78);
        out.push({
          key: ri + ':' + ci, si: ri, i: ci,
          cx: f.l + cw * ci + cw / 2, cy: top + ch * ri + ch / 2,
          w: cw - 4, h: ch - 4, r: 2, col, alpha: 1,
          val: v, unit: '', label: row.label, x: d.cols[ci],
          sig: v >= 115 ? 'up' : (v <= 85 ? 'down' : ''),
          lowBase: d.base[ci] < 30
        });
      });
    });
    return out;
  }

  const build = id => {
    const d = LIVE[id];
    return d.kind === 'trend' ? buildTrend(d) : d.kind === 'bars' ? buildBars(d) : buildMatrix(d);
  };

  /* ---------- chrome: title, axes, legend ---------- */

  function chrome(id, a) {
    if (a <= 0.01) return;
    const d = LIVE[id], f = frame(d.kind);
    const pw = W - f.l - f.r, ph = H - f.t - f.b;
    ctx.save();
    ctx.globalAlpha = a;

    ctx.fillStyle = css('--ink-dim');
    ctx.font = `400 13px ${css('--font-body') || 'sans-serif'}`;
    ctx.textAlign = 'left';
    ctx.fillText(narrow() ? (d.titleShort || d.title) : d.title, f.l, narrow() ? 16 : 22);

    ctx.font = `400 11px ${css('--font-mono') || 'monospace'}`;

    if (d.kind === 'matrix') {
      const ch = Math.min(52, ph / d.rows.length);
      const top = f.t + (ph - ch * d.rows.length) / 2;
      ctx.fillStyle = css('--ink-dim');
      ctx.textAlign = 'right';
      d.rows.forEach((r, ri) => {
        ctx.fillText(narrow() ? r.short : r.label, f.l - 12, top + ch * ri + ch / 2 + 4);
      });
      ctx.textAlign = 'center';
      ctx.fillStyle = css('--ink-faint');
      d.cols.forEach((c, ci) => {
        const x = f.l + (pw / d.cols.length) * ci + (pw / d.cols.length) / 2;
        ctx.fillText(c, x, top - 12);
        ctx.fillStyle = d.base[ci] < 30 ? css('--amber') : css('--ink-faint');
        ctx.fillText('n=' + d.base[ci] + (d.base[ci] < 30 ? ' *' : ''), x, top + ch * d.rows.length + 20);
        ctx.fillStyle = css('--ink-faint');
      });
    } else {
      const { lo, hi } = domainOf(d);
      ctx.strokeStyle = css('--line');
      ctx.lineWidth = 1;
      ctx.fillStyle = css('--ink-faint');
      for (let i = 0; i <= 4; i++) {
        const y = Math.round(f.t + (ph / 4) * i) + 0.5;
        ctx.globalAlpha = a * 0.55;
        ctx.beginPath(); ctx.moveTo(f.l, y); ctx.lineTo(W - f.r, y); ctx.stroke();
        ctx.globalAlpha = a;
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(hi - ((hi - lo) / 4) * i), f.l - 12, y + 4);
      }
      ctx.textAlign = 'center';
      d.x.forEach((label, i) => {
        const x = d.kind === 'trend'
          ? f.l + (pw / (d.x.length - 1)) * i
          : f.l + (pw / d.x.length) * (i + 0.5);
        ctx.fillText(label, x, H - f.b + 22);
      });

      // legend
      let lx = W - f.r;
      const ly = narrow() ? 42 : 22;
      ctx.textAlign = 'right';
      ctx.font = `400 12px ${css('--font-body') || 'sans-serif'}`;
      for (let i = d.series.length - 1; i >= 0; i--) {
        ctx.fillStyle = css('--ink-dim');
        ctx.fillText(d.series[i].label, lx, ly);
        const w = ctx.measureText(d.series[i].label).width;
        ctx.fillStyle = css(i === 0 ? '--series-1' : '--series-2');
        ctx.beginPath(); ctx.arc(lx - w - 10, ly - 4, 4.5, 0, Math.PI * 2); ctx.fill();
        lx -= w + 34;
      }
    }
    ctx.restore();
  }

  /* ---------- view-specific garnish ---------- */

  function trendExtras(a, reveal) {
    if (a <= 0.01) return;
    const d = LIVE.trend, f = frame('trend');
    const pw = W - f.l - f.r, ph = H - f.t - f.b;
    const { lo, hi } = domainOf(d);
    const X = i => f.l + (pw / (d.x.length - 1)) * i;
    const Y = v => f.t + ph - ((v - lo) / (hi - lo)) * ph;
    const cut = f.l + pw * reveal;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, cut + 1, H); ctx.clip();
    ctx.globalAlpha = a;

    // 95% CI ribbon
    d.series.forEach((s, si) => {
      const col = rgb(css(si === 0 ? '--series-1' : '--series-2'));
      ctx.fillStyle = toCss(col, 0.12);
      ctx.beginPath();
      s.values.forEach((v, i) => { const x = X(i), y = Y(v + s.ci[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      for (let i = s.values.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(s.values[i] - s.ci[i]));
      ctx.closePath(); ctx.fill();
    });

    // lines — glowing neon stroke
    d.series.forEach((s, si) => {
      const col = css(si === 0 ? '--series-1' : '--series-2');
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      s.values.forEach((v, i) => { const x = X(i), y = Y(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
    ctx.restore();

    if (reveal < 0.999) return;

    // gap callout — yahi wo "cut" hai jiske liye client paisa deta hai
    ctx.save();
    ctx.globalAlpha = a;
    const last = d.x.length - 1;
    const yA = Y(d.series[0].values[last]), yB = Y(d.series[1].values[last]);
    const gx = X(last) - 26;
    ctx.strokeStyle = css('--ink-faint');
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(gx, yA); ctx.lineTo(gx, yB); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = css('--green');
    ctx.font = `500 12px ${css('--font-mono') || 'monospace'}`;
    ctx.textAlign = 'right';
    const gap = d.series[0].values[last] - d.series[1].values[last];
    ctx.fillText('+' + gap + ' pts', gx - 8, (yA + yB) / 2 + 4);

    // aakhri value ka direct label
    ctx.font = `600 13px ${css('--font-mono') || 'monospace'}`;
    ctx.textAlign = 'left';
    d.series.forEach((s2, si) => {
      ctx.fillStyle = css(si === 0 ? '--series-1' : '--series-2');
      ctx.fillText(s2.values[last], X(last) + 14, Y(s2.values[last]) + 4);
    });

    // latest point pe pulse
    const pulse = (Math.sin(performance.now() / 420) + 1) / 2;
    d.series.forEach((s, si) => {
      ctx.fillStyle = toCss(rgb(css(si === 0 ? '--series-1' : '--series-2')), 0.16 + pulse * 0.2);
      ctx.beginPath(); ctx.arc(X(last), Y(s.values[last]), 9 + pulse * 5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  function barExtras(a) {
    if (a <= 0.01) return;
    const d = LIVE.segmentation, f = frame('bars');
    const pw = W - f.l - f.r, ph = H - f.t - f.b;
    const { hi } = domainOf(d);
    const slot = pw / d.x.length;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    d.index.forEach((idx, i) => {
      const x = f.l + slot * i + slot / 2;
      const top = f.t + ph - (Math.max(d.series[0].values[i], d.series[1].values[i]) / hi) * ph;
      const up = d.sig[i] === 'up', down = d.sig[i] === 'down';
      ctx.fillStyle = up ? css('--green') : down ? css('--magenta') : css('--ink-faint');
      ctx.font = `500 12px ${css('--font-mono') || 'monospace'}`;
      ctx.fillText((up ? '▲ ' : down ? '▼ ' : '') + 'idx ' + idx, x, top - 34);
    });
    ctx.restore();
  }

  function matrixExtras(a) {
    if (a <= 0.01) return;
    const d = LIVE.crosstab;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `500 12px ${css('--font-mono') || 'monospace'}`;
    marks.forEach(m => {
      if (m.val == null) return;
      const strong = Math.abs(m.val - 100) > 22;
      ctx.fillStyle = strong ? '#07080a' : css('--ink');
      ctx.fillText(m.val + (m.sig === 'up' ? ' ▲' : m.sig === 'down' ? ' ▼' : ''), m.cx, m.cy + 4);
    });
    ctx.restore();
  }

  function valueLabels(a) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `500 12px ${css('--font-mono') || 'monospace'}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = css('--ink');
    marks.forEach(m => {
      if (m.val == null) return;
      ctx.fillText(m.val + (m.unit || ''), m.cx, m.cy - m.h / 2 - 9);
    });
    ctx.restore();
  }

  /* ---------- morph ---------- */

  function morphed() {
    const from = build(prevView), to = build(view);
    const k = easeInOut(clamp01(t));
    const byKey = new Map(from.map(m => [m.key, m]));
    const cx0 = W / 2, cy0 = H / 2;
    return to.map(m => {
      const s = byKey.get(m.key);
      if (!s) return { ...m, alpha: k, w: m.w * k, h: m.h * k };
      return {
        ...m,
        cx: lerp(s.cx, m.cx, k), cy: lerp(s.cy, m.cy, k),
        w: lerp(s.w, m.w, k), h: lerp(s.h, m.h, k),
        r: lerp(s.r, m.r, k),
        col: mixRgb(s.col, m.col, k),
        alpha: 1
      };
    }).concat(
      from.filter(m => !to.some(x => x.key === m.key))
          .map(m => ({ ...m, alpha: 1 - k, w: m.w * (1 - k), h: m.h * (1 - k), val: null }))
    );
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  /* ---------- draw ---------- */

  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    const k = easeInOut(clamp01(t));
    marks = morphed();

    // chrome pehle poora fade out, phir naya fade in — do title ek saath nahi dikhte
    const outA = clamp01(1 - k * 2), inA = clamp01(k * 2 - 1);
    chrome(prevView, outA);
    chrome(view, inA);

    const isTrend = w => (w === 'trend' ? 1 : 0);
    trendExtras(isTrend(prevView) * outA + isTrend(view) * inA, intro);

    marks.forEach(m => {
      ctx.save();
      ctx.globalAlpha = m.alpha;
      ctx.fillStyle = toCss(m.col);
      ctx.shadowColor = toCss(m.col);
      ctx.shadowBlur = 10;
      if (m.h <= 10 && m.w <= 10) {                 // point
        ctx.fillStyle = css('--bg-deep');
        ctx.beginPath(); ctx.arc(m.cx, m.cy, m.r + 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = toCss(m.col);
        ctx.beginPath(); ctx.arc(m.cx, m.cy, m.r, 0, Math.PI * 2); ctx.fill();
      } else {
        roundRect(m.cx - m.w / 2, m.cy - m.h / 2, m.w, m.h, Math.max(m.r, 5));
        ctx.fill();
      }
      ctx.restore();
    });

    const isBars = w => (w === 'segmentation' ? 1 : 0);
    const isMat  = w => (w === 'crosstab' ? 1 : 0);
    barExtras(isBars(prevView) * outA + isBars(view) * inA);
    matrixExtras(isMat(prevView) * outA + isMat(view) * inA);
    if (view === 'segmentation') valueLabels(inA * 0.95);
    else if (prevView === 'segmentation') valueLabels(outA * 0.95);

    drawHover();
  }

  /* ---------- hover readout ---------- */

  function drawHover() {
    if (!hover || t < 0.999) { tip.hidden = true; return; }
    const d = LIVE[view];
    const f = frame(d.kind);
    const rows = [];
    let cx = null, hits = [];

    if (d.kind === 'matrix') {
      const m = marks.find(m => m.val != null &&
        Math.abs(m.cx - hover.x) <= m.w / 2 && Math.abs(m.cy - hover.y) <= m.h / 2);
      if (!m) { tip.hidden = true; return; }
      hits = [m];
      rows.push({ col: css('--green'), label: m.label, val: m.val + (m.sig === 'up' ? ' ▲' : m.sig === 'down' ? ' ▼' : '') });
      tipHead(m.x + (m.lowBase ? ' · low base' : ''));
    } else {
      // x ke sabse paas wala column — poora group padho
      let idx = null, bd = 1e9;
      marks.forEach(m => {
        if (m.val == null || m.si !== 0) return;
        const dx = Math.abs(m.cx - hover.x);
        if (dx < bd) { bd = dx; idx = m.i; }
      });
      if (idx == null || bd > (W / d.x.length) * 0.75) { tip.hidden = true; return; }
      hits = marks.filter(m => m.i === idx && m.val != null);
      if (!hits.length) { tip.hidden = true; return; }
      cx = d.kind === 'trend' ? hits[0].cx : hits.reduce((a, m) => a + m.cx, 0) / hits.length;
      hits.forEach(m => rows.push({
        col: css(m.si === 0 ? '--series-1' : '--series-2'),
        label: m.label,
        val: m.val + (m.unit || '')
      }));
      if (d.kind === 'trend' && hits.length === 2) {
        rows.push({ col: css('--ink-faint'), label: 'gap', val: '+' + (hits[0].val - hits[1].val) + ' pts' });
      }
      if (d.kind === 'bars') {
        rows.push({ col: css('--ink-faint'), label: 'index', val: String(d.index[idx]) });
      }
      tipHead(hits[0].x);
    }

    // crosshair + highlight
    ctx.save();
    if (cx != null) {
      ctx.strokeStyle = css('--line-hot');
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(cx, f.t); ctx.lineTo(cx, H - f.b); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = css('--ink');
    ctx.lineWidth = 1.5;
    hits.forEach(m => {
      if (m.h <= 10 && m.w <= 10) { ctx.beginPath(); ctx.arc(m.cx, m.cy, m.r + 4, 0, Math.PI * 2); ctx.stroke(); }
      else { roundRect(m.cx - m.w / 2, m.cy - m.h / 2, m.w, m.h, m.r); ctx.stroke(); }
    });
    ctx.restore();

    tip.innerHTML = tipHTML(rows);
    tip.hidden = false;
    const anchorX = cx != null ? cx : hits[0].cx;
    const anchorY = Math.min(...hits.map(m => m.cy - m.h / 2));
    const tw = tip.offsetWidth || 170, th = tip.offsetHeight || 70;
    tip.style.left = Math.max(4, Math.min(W - tw - 4, anchorX - tw / 2)) + 'px';
    tip.style.top  = Math.max(4, anchorY - th - 14) + 'px';
  }

  let tipTitle = '';
  const tipHead = x => { tipTitle = x; };
  const tipHTML = rows => `<b>${tipTitle}</b>` + rows.map(r =>
    `<div class="tip-row"><i style="background:${r.col}"></i><span>${r.label}</span><em>${r.val}</em></div>`).join('');

  /* ---------- loop ---------- */

  function tick() {
    raf = null;
    let live = false;
    if (t < 1) { t = Math.min(1, t + 0.022); live = true; }
    if (intro < 1) { intro = Math.min(1, intro + 0.018); live = true; }
    if (view === 'trend' && intro >= 1) live = true;       // pulse chalta rahe
    draw();
    if (live) raf = requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = Math.max(300, Math.min(r.width * 0.46, 440));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(); kick();
  }

  function setView(v) {
    if (v === view) return;
    prevView = view; view = v;
    t = reduced() ? 1 : 0;
    const note = document.querySelector('#live-note');
    if (note) note.textContent = LIVE[v].note;
    draw(); kick();
  }

  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    hover = { x: e.clientX - r.left, y: e.clientY - r.top };
    draw(); kick();
  });
  canvas.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; draw(); });

  new ResizeObserver(resize).observe(host);
  if (reduced()) intro = 1;
  resize();

  return { setView, redraw: draw, start: () => { intro = reduced() ? 1 : 0; kick(); } };
}
