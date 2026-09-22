// HeyData — hero ka ambient layer. Lagatar chalta hai, bahut halka.
// Raw survey values hero se uthte hain aur chart ki taraf bahte hain.

const GLYPHS = ['0','1','2','3','4','5','6','7','8','9','%','n=','·','1','0','7','4'];
const COUNT = 64;

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createAmbient(canvas) {
  if (reduced()) return { stop() {} };

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = null, parts = [], running = true;

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(initial) {
    return {
      x: Math.random() * W * 0.62,
      y: initial ? Math.random() * H : H + 20 + Math.random() * 80,
      vx: 0.06 + Math.random() * 0.12,
      vy: -(0.10 + Math.random() * 0.22),
      g: GLYPHS[(Math.random() * GLYPHS.length) | 0],
      size: 11 + Math.random() * 8,
      life: 0,
      max: 900 + Math.random() * 900,
      drift: Math.random() * Math.PI * 2,
      cy: Math.random() < 0.22
    };
  }

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    const cyan = css('--cyan');
    const faint = css('--ink-faint');

    parts.forEach((p, i) => {
      p.life++;
      p.drift += 0.006;
      p.x += p.vx + Math.sin(p.drift) * 0.12;
      p.y += p.vy;

      const fadeIn = Math.min(1, p.life / 90);
      const fadeOut = Math.min(1, (p.max - p.life) / 140);
      const edge = Math.min(1, (W * 0.78 - p.x) / (W * 0.16));   // chart ke paas ghul jaate hain
      const a = 0.17 * fadeIn * fadeOut * Math.max(0, edge);

      if (p.life > p.max || p.y < -30 || a <= 0.004) {
        parts[i] = spawn(false);
        return;
      }

      ctx.globalAlpha = a;
      ctx.fillStyle = p.cy ? cyan : faint;
      ctx.font = `400 ${p.size}px ${css('--font-mono') || 'monospace'}`;
      ctx.fillText(p.g, p.x, p.y);
    });

    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }

  new ResizeObserver(resize).observe(canvas.parentElement || canvas);
  resize();
  parts = Array.from({ length: COUNT }, () => spawn(true));
  raf = requestAnimationFrame(tick);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    } else if (!running) {
      running = true;
      if (!raf) raf = requestAnimationFrame(tick);
    }
  });

  return { stop() { running = false; if (raf) cancelAnimationFrame(raf); } };
}
