// HeyData — har service ka apna chhota chalta hua visual.
// Sab ek hi rAF loop pe chalte hain, aur sirf wahi jo screen pe hain.

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = t => Math.min(1, Math.max(0, t));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function rand(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/* ============ 01 — cleaning: kharab rows nikalte hain ============ */
function cleaning(c, w, h, t, S) {
  const cols = 14, rows = 6;
  const cw = w / cols, ch = h / rows;
  const p = (t % 5200) / 5200;
  S.r = S.r || rand(11);
  S.bad = S.bad || Array.from({ length: cols * rows }, () => S.r() < 0.18);

  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * cw, y = ((i / cols) | 0) * ch;
    const bad = S.bad[i];
    const scan = clamp01((p * 1.25) - (i % cols) / cols);
    let a = 0.22;
    let col = css('--ink-faint');
    if (bad && scan > 0.2) {
      const k = clamp01((scan - 0.2) / 0.5);
      col = css('--amber');
      a = 0.85 * (1 - k);
    } else if (scan > 0.2) {
      // scan ke saath ek chamak, phir shaant ho jata hai
      const k = clamp01((scan - 0.2) / 0.28);
      col = css('--green');
      a = 0.18 + 0.5 * (1 - k) + 0.12 * k;
    }
    c.globalAlpha = a;
    c.fillStyle = col;
    c.fillRect(x + 2, y + 2, cw - 4, ch - 4);
  }
  c.globalAlpha = 1;
  const kept = 847 - Math.round(65 * easeOut(clamp01(p * 1.4)));
  label(c, w, h, `n=847 → ${kept}`);
}

/* ============ 02 — labelling: har ganda naam apne saaf naam pe ============ */
function labelling(c, w, h, t, S) {
  const PAIRS = [
    ['q1_a',  'Q1_a'],
    ['Q1B',   'Q1_b'],
    ['1_c',   'Q1_c'],
    ['q1d_x', 'Q1_d'],
    ['Q_1e',  'Q1_e']
  ];
  const p = (t % 6000) / 6000;
  S.r = S.r || rand(29);
  S.pos = S.pos || PAIRS.map(() => [0.25 + S.r() * 0.55, S.r()]);

  const rowH = (h - 26) / PAIRS.length;
  const colX = 12;

  c.font = `400 11px ${css('--font-mono')}`;
  c.textAlign = 'left';

  PAIRS.forEach(([raw, clean], i) => {
    const k = easeInOut(clamp01((p - 0.06 - i * 0.07) * 2.6));
    const x0 = 12 + S.pos[i][0] * (w - 80);
    const y0 = 14 + S.pos[i][1] * (h - 30);
    const y1 = 16 + i * rowH;
    const x = x0 + (colX - x0) * k;
    const y = y0 + (y1 - y0) * k;
    const done = k > 0.94;

    c.globalAlpha = 0.4 + 0.55 * k;
    c.fillStyle = done ? css('--green') : css('--ink-faint');
    c.fillText(done ? clean : raw, x, y);

    if (done) {
      c.strokeStyle = css('--green');
      c.globalAlpha = 0.8;
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(x + 46, y - 4);
      c.lineTo(x + 49, y - 1);
      c.lineTo(x + 54, y - 8);
      c.stroke();
    }
  });

  // saaf column ki hairline
  c.globalAlpha = 0.5;
  c.strokeStyle = css('--line');
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(colX - 5, 6);
  c.lineTo(colX - 5, h - 16);
  c.stroke();
  c.globalAlpha = 1;

  label(c, w, h, 'labels aligned');
}

/* ============ 03 — QC: checklist scan, kuch flag ============ */
function qc(c, w, h, t, S) {
  const cols = 10, rows = 5;
  const cw = w / cols, ch = h / rows;
  const p = (t % 4800) / 4800;
  S.r = S.r || rand(7);
  S.flag = S.flag || Array.from({ length: cols * rows }, () => S.r() < 0.1);
  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * cw + cw / 2, y = ((i / cols) | 0) * ch + ch / 2;
    const done = clamp01(p * 1.3 - i / (cols * rows));
    if (done <= 0) continue;
    c.strokeStyle = S.flag[i] ? css('--amber') : css('--green');
    c.globalAlpha = 0.35 + 0.6 * done;
    c.lineWidth = 1.4;
    c.beginPath();
    if (S.flag[i]) { c.moveTo(x - 3, y - 3); c.lineTo(x + 3, y + 3); c.moveTo(x + 3, y - 3); c.lineTo(x - 3, y + 3); }
    else { c.moveTo(x - 4, y); c.lineTo(x - 1, y + 3); c.lineTo(x + 4, y - 3); }
    c.stroke();
  }
  c.globalAlpha = 1;
  label(c, w, h, 'checks passing');
}

/* ============ 04 — routing: token branches se guzarta hai ============ */
function routing(c, w, h, t, S) {
  const p = (t % 5200) / 5200;
  const nodes = [[14, h / 2], [w * .35, h * .28], [w * .35, h * .72], [w * .66, h / 2], [w - 14, h / 2]];
  const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]];
  c.strokeStyle = css('--line');
  c.lineWidth = 1;
  edges.forEach(([a, b]) => {
    c.beginPath(); c.moveTo(...nodes[a]); c.lineTo(...nodes[b]); c.stroke();
  });
  const path = p < .5 ? [0, 1, 3, 4] : [0, 2, 3, 4];
  const seg = (p % .5) / .5 * (path.length - 1);
  const i = Math.min(path.length - 2, seg | 0), f = easeInOut(seg - i);
  const a = nodes[path[i]], b = nodes[path[i + 1]];
  c.strokeStyle = css('--green');
  c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(...a); c.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); c.stroke();
  nodes.forEach((n, k) => {
    const hot = path.slice(0, i + 2).includes(k);
    c.fillStyle = hot ? css('--green') : css('--ink-faint');
    c.beginPath(); c.arc(n[0], n[1], hot ? 3.4 : 2.4, 0, Math.PI * 2); c.fill();
  });
  c.fillStyle = css('--green');
  c.beginPath();
  c.arc(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 3.2, 0, Math.PI * 2);
  c.fill();
  label(c, w, h, 'paths tested');
}

/* ============ 05 — weighting: tirchi profile target pe baithti hai ============ */
function weighting(c, w, h, t, S) {
  const p = (t % 5200) / 5200;
  const k = easeInOut(clamp01((p - .12) * 1.8));
  const raw = [.28, .44, .62, .38, .18];
  const tgt = [.4, .4, .4, .4, .4];
  const bw = (w - 20) / raw.length;
  raw.forEach((v, i) => {
    const val = v + (tgt[i] - v) * k;
    const bh = val * (h - 26);
    const x = 10 + i * bw;
    c.fillStyle = css('--line');
    c.fillRect(x + 2, h - 16 - (h - 26), bw - 6, h - 26);
    c.fillStyle = k > .9 ? css('--green') : css('--series-1');
    c.fillRect(x + 2, h - 16 - bh, bw - 6, bh);
  });
  c.strokeStyle = css('--amber');
  c.setLineDash([3, 3]);
  c.lineWidth = 1;
  const ty = h - 16 - .4 * (h - 26);
  c.beginPath(); c.moveTo(6, ty); c.lineTo(w - 6, ty); c.stroke();
  c.setLineDash([]);
  label(c, w, h, k > .9 ? 'weighted to target' : 'applying weights');
}

/* ============ 06 — crosstab: cells bharte hain ============ */
function crosstab(c, w, h, t, S) {
  const cols = 5, rows = 4;
  const cw = (w - 16) / cols, ch = (h - 26) / rows;
  const p = (t % 5400) / 5400;
  S.r = S.r || rand(53);
  S.v = S.v || Array.from({ length: cols * rows }, () => 0.2 + S.r() * 0.8);
  S.sig = S.sig || Array.from({ length: cols * rows }, () => S.r() < 0.16);
  c.font = `400 9px ${css('--font-mono')}`;
  for (let i = 0; i < cols * rows; i++) {
    const cx = 8 + (i % cols) * cw, cy = 8 + ((i / cols) | 0) * ch;
    const done = clamp01(p * 1.5 - i / (cols * rows));
    c.strokeStyle = css('--line');
    c.lineWidth = 1;
    c.strokeRect(cx, cy, cw - 2, ch - 2);
    if (done <= 0) continue;
    c.globalAlpha = done;
    c.fillStyle = S.sig[i] ? css('--green') : css('--ink-dim');
    c.fillText(Math.round(S.v[i] * 99) + (S.sig[i] ? '*' : ''), cx + 5, cy + ch / 2 + 2);
    c.globalAlpha = 1;
  }
  label(c, w, h, 'sig-tested');
}

/* ============ 07 — chart pack: bars slide mein dhalti hain ============ */
function chartpack(c, w, h, t, S) {
  const p = (t % 5000) / 5000;
  const k = easeInOut(clamp01((p - .1) * 1.7));
  const vals = [.85, .6, .42, .3];
  const frameW = (w - 20) * (0.55 + 0.45 * k), frameH = (h - 26);
  c.strokeStyle = css('--line');
  c.strokeRect(10, 8, frameW, frameH);
  c.fillStyle = css('--line');
  c.fillRect(10, 8, frameW, 10);
  const bw = (frameW - 24) / vals.length;
  vals.forEach((v, i) => {
    const grow = clamp01((k - i * .1) * 1.6);
    const bh = v * (frameH - 32) * grow;
    c.fillStyle = css(`--series-${(i % 4) + 1}`);
    c.fillRect(22 + i * bw, 8 + frameH - 10 - bh, bw - 8, bh);
  });
  label(c, w, h, 'on your template');
}

/* ============ 08 — report: ek page jo khud likha ja raha hai ============ */
function report(c, w, h, t, S) {
  const p = (t % 6400) / 6400;
  const padX = 12, padY = 10;
  const pageW = w - padX * 2, pageH = h - padY * 2;

  // page
  c.fillStyle = css('--bg-panel');
  c.fillRect(padX, padY, pageW, pageH);
  c.strokeStyle = css('--line');
  c.lineWidth = 1;
  c.strokeRect(padX + .5, padY + .5, pageW - 1, pageH - 1);

  const L = padX + 10;
  const chartW = Math.min(76, pageW * 0.34);
  const textW = pageW - 28 - chartW;
  const FOOT = padY + pageH - 14;      // footer ki line — iske upar kuch nahi aayega
  const bodyTop = padY + 26;
  const lineGap = Math.max(7, Math.min(9, (FOOT - bodyTop - 26) / 6));

  // title type hota hai
  c.font = `500 10px ${css('--font-mono')}`;
  c.textAlign = 'left';
  const title = 'TOPLINE — WAVE 4';
  const tk = clamp01(p * 4.2);
  c.fillStyle = css('--green');
  c.fillText(title.slice(0, Math.round(title.length * tk)), L, padY + 16);

  // headline lines
  const lines = [0.96, 0.78, 0.88, 0.62];
  lines.forEach((len, i) => {
    const k = clamp01((p - 0.16 - i * 0.12) * 5);
    if (k <= 0) return;
    c.fillStyle = css('--ink-faint');
    c.globalAlpha = i === 0 ? 0.85 : 0.5;
    c.fillRect(L, bodyTop + i * lineGap, textW * len * k, i === 0 ? 3.5 : 2.5);
    c.globalAlpha = 1;
  });

  // key-finding bullets
  const bullets = [0.7, 0.55];
  bullets.forEach((len, i) => {
    const k = clamp01((p - 0.52 - i * 0.12) * 5);
    if (k <= 0) return;
    const by = bodyTop + lines.length * lineGap + 9 + i * (lineGap + 1);
    c.fillStyle = css('--green');
    c.fillRect(L, by - 2, 3, 3);
    c.fillStyle = css('--ink-faint');
    c.globalAlpha = 0.6;
    c.fillRect(L + 8, by - 1.5, (textW - 8) * len * k, 2.5);
    c.globalAlpha = 1;
  });

  // chart inset — bars ugti hain
  const cx = padX + pageW - chartW - 10, cy = bodyTop;
  const chartH = FOOT - bodyTop - 8;
  c.strokeStyle = css('--line');
  c.strokeRect(cx + .5, cy + .5, chartW - 1, chartH - 1);
  const vals = [0.82, 0.55, 0.38];
  const bw = (chartW - 16) / vals.length;
  vals.forEach((v, i) => {
    const k = clamp01((p - 0.3 - i * 0.08) * 4);
    const bh = (chartH - 14) * v * k;
    c.fillStyle = css(`--series-${i + 1}`);
    c.fillRect(cx + 8 + i * bw, cy + chartH - 7 - bh, bw - 5, bh);
  });

  // footer
  c.font = `400 8px ${css('--font-mono')}`;
  c.fillStyle = css('--ink-faint');
  c.globalAlpha = 0.75;
  c.fillText('p.1 / 12', L, FOOT + 7);
  c.globalAlpha = 0.35;
  c.fillStyle = css('--line');
  c.fillRect(L, FOOT, pageW - 20, 1);
  c.globalAlpha = 1;

  // cursor
  if ((t % 900) < 470 && p > 0.16 && p < 0.9) {
    const i = Math.min(lines.length - 1, Math.floor((p - 0.16) / 0.12));
    const k = clamp01((p - 0.16 - i * 0.12) * 5);
    c.fillStyle = css('--green');
    c.fillRect(L + textW * lines[i] * k + 2, bodyTop - 1 + i * lineGap, 4, 4);
  }

  label(c, w, h, 'decision-ready');
}

function label(c, w, h, text) {
  c.font = `400 9px ${css('--font-mono')}`;
  c.fillStyle = css('--ink-faint');
  c.globalAlpha = .8;
  c.textAlign = 'right';
  c.fillText(text, w - 6, h - 4);
  c.textAlign = 'left';
  c.globalAlpha = 1;
}

const RENDERERS = [cleaning, labelling, qc, routing, weighting, crosstab, chartpack, report];

export function initServiceVisuals() {
  const hosts = Array.from(document.querySelectorAll('.service .viz'));
  if (!hosts.length) return;

  const items = hosts.map((host, i) => {
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    return { canvas, ctx: canvas.getContext('2d'), draw: RENDERERS[i % 8], state: {}, live: false, w: 0, h: 0 };
  });

  function size(it) {
    const r = it.canvas.parentElement.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    it.w = r.width; it.h = Math.max(72, Math.min(r.width * 0.42, 108));
    it.canvas.width = Math.round(it.w * dpr);
    it.canvas.height = Math.round(it.h * dpr);
    it.canvas.style.width = '100%';
    it.canvas.style.height = it.h + 'px';
    it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  items.forEach(size);
  new ResizeObserver(() => items.forEach(size)).observe(document.querySelector('#services'));

  if (reduced()) {
    items.forEach(it => { it.ctx.clearRect(0, 0, it.w, it.h); it.draw(it.ctx, it.w, it.h, 4200, it.state); });
    return;
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const it = items.find(x => x.canvas.parentElement === e.target);
      if (it) it.live = e.isIntersecting;
    });
  }, { threshold: 0.15 });
  hosts.forEach(h => io.observe(h));

  let raf = null;
  const loop = now => {
    items.forEach(it => {
      if (!it.live || !it.w) return;
      it.ctx.clearRect(0, 0, it.w, it.h);
      it.draw(it.ctx, it.w, it.h, now, it.state);
    });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (!raf) raf = requestAnimationFrame(loop);
  });
}
