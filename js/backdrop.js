// HeyData — section ke peeche behta hua data.
// Sirf numbers nahi: asli research ke tokens, mini charts, tables, flags.
// Teen depth layers — peeche wale chhote/dheeme, aage wale bade/tez.

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pick = a => a[(Math.random() * a.length) | 0];
const rnd = (a, b) => a + Math.random() * (b - a);

/* ---- kya-kya tair sakta hai ---- */

const STATS = () => pick([
  `n=${(300 + Math.random() * 900) | 0}`,
  `p<.0${(1 + Math.random() * 4) | 0}`,
  `σ=${rnd(0.6, 2.4).toFixed(2)}`,
  `μ=${rnd(2.1, 8.9).toFixed(1)}`,
  `wt=${rnd(0.71, 1.44).toFixed(2)}`,
  `χ²=${rnd(3, 28).toFixed(1)}`,
  `CI±${rnd(1.2, 4.8).toFixed(1)}`,
  `eff=${(72 + Math.random() * 26) | 0}%`,
  `base ${(120 + Math.random() * 700) | 0}`
]);

const VARS = () => pick([
  `Q${(1 + Math.random() * 12) | 0}_${pick('abcde')}`,
  `S${(1 + Math.random() * 9) | 0}`,
  `D${(1 + Math.random() * 6) | 0}_net`,
  `AGE_R`, `REGION`, `WAVE_${(1 + Math.random() * 4) | 0}`,
  `T2B`, `B2B`, `NPS`, `OE_${(1 + Math.random() * 3) | 0}`
]);

const KINDS = ['stat', 'var', 'pct', 'bars', 'spark', 'cell', 'flag', 'delta'];

export function createBackdrop(section, opts = {}) {
  if (!section || reduced()) return { stop() {} };

  const density = opts.density ?? 0.16;
  const maxAlpha = opts.alpha ?? 0.45;
  const flavour = opts.flavour || 'mixed';      // mixed | vars | stats | charts

  const canvas = document.createElement('canvas');
  canvas.className = 'backdrop';
  canvas.setAttribute('aria-hidden', 'true');
  section.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, items = [], raf = null, live = false, tick = 0;

  function kindFor() {
    if (flavour === 'vars')   return pick(['var', 'var', 'cell', 'flag', 'stat']);
    if (flavour === 'stats')  return pick(['stat', 'stat', 'pct', 'delta', 'spark']);
    if (flavour === 'charts') return pick(['bars', 'spark', 'cell', 'pct', 'stat']);
    return pick(KINDS);
  }

  function seed(initial) {
    const layer = pick([0, 1, 1, 2]);              // 0 = door, 2 = paas
    const kind = kindFor();
    const scale = [0.72, 1, 1.35][layer];
    const tint = pick(['--blue', '--purple', '--pink', '--teal', '--ink-dim', '--ink-dim']);
    return {
      kind, layer, scale, tint: css(tint),
      x: Math.random() * W,
      y: initial ? Math.random() * H : H + rnd(20, 120),
      vy: -(0.04 + Math.random() * 0.13) * (0.6 + layer * 0.45),
      vx: rnd(-0.05, 0.08),
      life: 0,
      max: rnd(1500, 3200),
      text: kind === 'var' ? VARS() : STATS(),
      pct: (8 + Math.random() * 84) | 0,
      bars: Array.from({ length: 3 + ((Math.random() * 3) | 0) }, () => rnd(0.2, 1)),
      pts: Array.from({ length: 7 + ((Math.random() * 5) | 0) }, () => Math.random()),
      cells: Array.from({ length: 6 }, () => (10 + Math.random() * 80) | 0),
      up: Math.random() < 0.55,
      hot: Math.random() < 0.2,
      lockAt: rnd(0.45, 0.8),                      // is pal ek halki chamak
      w: rnd(30, 62)
    };
  }

  function size() {
    const r = section.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = section.offsetHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const want = Math.max(16, Math.round((W * H) / 10000 * density));
    items = Array.from({ length: want }, () => seed(true));
  }

  /* beech mein halka, kinaron pe poora — text hamesha saaf rahe */
  function edgeFade(x) {
    const d = Math.abs(x - W / 2) / (W / 2);
    return 0.45 + 0.55 * Math.pow(d, 1.4);
  }

  function alphaOf(it) {
    const inFade = Math.min(1, it.life / 200);
    const outFade = Math.min(1, (it.max - it.life) / 260);
    const layerA = [0.55, 0.85, 1][it.layer];
    return maxAlpha * layerA * edgeFade(it.x) * inFade * outFade;
  }

  /* ---- har kism ka apna drawing ---- */

  function drawItem(it, a) {
    const green = css('--green'), faint = css('--ink-dim'), amber = css('--amber');
    const prog = it.life / it.max;
    const locked = prog > it.lockAt && prog < it.lockAt + 0.06;
    const col = locked ? green : (it.hot ? green : it.tint);
    const s = it.scale;

    ctx.globalAlpha = a * (locked ? 1.8 : 1);
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.shadowColor = col;
    ctx.shadowBlur = locked ? 12 : 5;
    ctx.font = `400 ${Math.round(12 * s)}px ${css('--font-mono')}`;

    switch (it.kind) {
      case 'stat':
      case 'var':
        ctx.fillText(it.text, it.x, it.y);
        break;

      case 'pct': {                                    // ek mini gauge
        const w = it.w * s, h = 5 * s;
        ctx.globalAlpha = a * 0.5;
        ctx.strokeRect(it.x, it.y - h, w, h);
        ctx.globalAlpha = a;
        ctx.fillRect(it.x, it.y - h, w * (it.pct / 100), h);
        ctx.font = `400 ${Math.round(10 * s)}px ${css('--font-mono')}`;
        ctx.fillText(it.pct + '%', it.x + w + 5, it.y);
        break;
      }

      case 'bars': {                                   // chhota bar cluster
        const bw = 4 * s, gap = 3 * s, hMax = 20 * s;
        it.bars.forEach((v, i) => {
          const bh = hMax * v;
          ctx.fillRect(it.x + i * (bw + gap), it.y - bh, bw, bh);
        });
        break;
      }

      case 'spark': {                                  // sparkline
        const w = it.w * 1.4 * s, h = 13 * s;
        ctx.beginPath();
        it.pts.forEach((p, i) => {
          const px = it.x + (w / (it.pts.length - 1)) * i;
          const py = it.y - h * p;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.stroke();
        break;
      }

      case 'cell': {                                   // table ka tukda
        const cw = 26 * s, ch = 11 * s;
        ctx.font = `400 ${Math.round(9 * s)}px ${css('--font-mono')}`;
        it.cells.forEach((v, i) => {
          const cx = it.x + (i % 3) * cw;
          const cy = it.y + ((i / 3) | 0) * ch;
          ctx.globalAlpha = a * 0.4;
          ctx.strokeRect(cx, cy - ch + 2, cw - 2, ch - 2);
          ctx.globalAlpha = a;
          ctx.fillText(String(v), cx + 3, cy - 2);
        });
        break;
      }

      case 'flag': {                                   // tick ya cross
        const r = 5 * s;
        ctx.strokeStyle = it.hot ? amber : col;
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        if (it.hot) {
          ctx.moveTo(it.x - r, it.y - r); ctx.lineTo(it.x + r, it.y + r);
          ctx.moveTo(it.x + r, it.y - r); ctx.lineTo(it.x - r, it.y + r);
        } else {
          ctx.moveTo(it.x - r, it.y); ctx.lineTo(it.x - r / 3, it.y + r * 0.7);
          ctx.lineTo(it.x + r, it.y - r * 0.8);
        }
        ctx.stroke();
        break;
      }

      case 'delta': {                                  // upar/neeche ka teer
        const r = 5 * s;
        ctx.beginPath();
        if (it.up) { ctx.moveTo(it.x, it.y - r); ctx.lineTo(it.x + r, it.y + r); ctx.lineTo(it.x - r, it.y + r); }
        else { ctx.moveTo(it.x, it.y + r); ctx.lineTo(it.x + r, it.y - r); ctx.lineTo(it.x - r, it.y - r); }
        ctx.closePath();
        ctx.fill();
        ctx.font = `400 ${Math.round(10 * s)}px ${css('--font-mono')}`;
        ctx.fillText(`${it.up ? '+' : '−'}${(1 + Math.random() * 9) | 0}`, it.x + r + 4, it.y + 4);
        break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function frame() {
    if (!live) return;
    tick++;
    ctx.clearRect(0, 0, W, H);

    items.forEach((it, i) => {
      it.life++;
      it.y += it.vy;
      it.x += it.vx + Math.sin((tick + i * 37) / 260) * 0.05;
      if (it.life > it.max || it.y < -80) { items[i] = seed(false); return; }
      const a = alphaOf(it);
      if (a > 0.005) drawItem(it, a);
    });

    raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(e => {
    const on = e[0].isIntersecting;
    if (on && !live) { live = true; raf = requestAnimationFrame(frame); }
    else if (!on && live) { live = false; if (raf) cancelAnimationFrame(raf); raf = null; }
  }, { threshold: 0.02 });
  io.observe(section);

  new ResizeObserver(size).observe(section);
  size();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (live) { live = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    } else if (!live) {
      const r = section.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) { live = true; raf = requestAnimationFrame(frame); }
    }
  });

  return { stop() { live = false; if (raf) cancelAnimationFrame(raf); canvas.remove(); } };
}
