// HeyData — har section ka apna moment.

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = t => 1 - Math.pow(1 - t, 3);

/* ---- status bar clock (IST) ---- */
export function initClock() {
  const el = $('#sb-clock');
  if (!el) return;
  const tick = () => {
    const d = new Date();
    el.textContent = d.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
    });
  };
  tick();
  setInterval(tick, 30000);
}

/* ---- process pipeline: ek packet rail pe chalta hai, node jagte hain ---- */
export function initPipeline({ onNode } = {}) {
  const wrap = $('#pipeline');
  const packet = $('#pipe-packet');
  if (!wrap || !packet) return;

  const steps = $$('#pipeline .step');
  if (reduced()) { steps.forEach(s => s.classList.add('is-hot')); packet.style.display = 'none'; return; }

  let raf = null, running = false, start = 0, lastNode = -1;
  const DURATION = 5200;

  function frame(now) {
    if (!running) return;
    const p = ((now - start) % DURATION) / DURATION;
    const top = 20 + easeOut(Math.min(1, p * 1.05)) * (wrap.offsetHeight - 40);
    packet.style.top = top + 'px';

    // sabse nazdeek node hamesha jalta hai — isse highlight kabhi miss nahi hoti
    let hot = 0, best = Infinity;
    steps.forEach((s, i) => {
      const d = Math.abs((s.offsetTop + 16) - top);
      if (d < best) { best = d; hot = i; }
    });
    steps.forEach((s, i) => s.classList.toggle('is-hot', i === hot && best < 90));
    if (best < 40 && hot !== lastNode) { lastNode = hot; onNode && onNode(hot); }
    if (p > 0.97) lastNode = -1;

    raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && !running) {
        running = true; start = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!e.isIntersecting && running) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        steps.forEach(s => s.classList.remove('is-hot'));
      }
    });
  }, { threshold: 0.25 });
  io.observe(wrap);
}

/* ---- about ke numbers count up ---- */
export function initCounters() {
  const els = $$('[data-count]');
  if (!els.length) return;

  const run = el => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reduced()) { el.textContent = target + suffix; return; }
    const dur = 1100, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(target * easeOut(p)) + (p === 1 ? suffix : '');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.6 });
  els.forEach(el => io.observe(el));
}

/* ---- section reveal ---- */
export function initReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(el => io.observe(el));
}


/* ---- side rails: scroll depth + current section ---- */
export function initRails() {
  const fill = $('#rail-fill'), pct = $('#rail-pct'), sec = $('#rail-sec');
  if (!fill) return;
  const secs = $$('main section[id]');

  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, scrollY / max) : 0;
    fill.style.height = (p * 100).toFixed(1) + '%';
    pct.textContent = String(Math.round(p * 100)).padStart(2, '0') + '%';

    let current = secs[0];
    secs.forEach(s => { if (s.getBoundingClientRect().top <= innerHeight * 0.35) current = s; });
    if (current && sec.textContent !== current.id) sec.textContent = current.id;
  };

  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
}
