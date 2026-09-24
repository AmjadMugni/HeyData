// HeyData — hero ka hook: boot log, badalti hui headline, counters.

import * as audio from './audio.js?v=20260924162000';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CHARS = '0123456789<>/+=|';   // sirf narrow glyphs — reserve height kam rehti hai

/* ---- boot log: teen lines type hoti hain ---- */
export function bootLog(onDone) {
  const lines = Array.from(document.querySelectorAll('.boot-line'));
  if (!lines.length) { onDone && onDone(); return; }

  if (reduced()) {
    lines.forEach(l => { l.textContent = l.dataset.text; l.classList.add('done', 'ok'); });
    onDone && onDone();
    return;
  }

  let i = 0;
  const typeLine = () => {
    if (i >= lines.length) { onDone && onDone(); return; }
    const el = lines[i], text = el.dataset.text;
    let c = 0;
    const step = () => {
      el.textContent = text.slice(0, ++c);
      if (c % 2 === 0) audio.key(0.5);
      if (c < text.length) setTimeout(step, 14 + Math.random() * 22);
      else {
        el.classList.add('done', 'ok');
        i++;
        setTimeout(typeLine, 180);
      }
    };
    step();
  };
  setTimeout(typeLine, 260);
}

/* ---- headline ka badalta hua hissa ---- */
const PHRASES = [
  'raw survey data',
  '40,000 messy rows',
  'a broken export',
  'straightliners & dupes',
  'five waves of fieldwork'
];

/* h1 ki height pehle se reserve karo.
   Ghost = .t-live ka invisible clone, isliye styling bilkul same.
   Har phrase ke saath scramble ka worst case (sabse chaude chars) bhi naapte hain,
   warna scramble ke beech ek extra line ban kar niche ka content dhak deti hai. */
function reserveTitleHeight() {
  const h1 = document.querySelector('.hero-title');
  const live = h1 && h1.querySelector('.t-live');
  if (!h1 || !live) return;

  let ghost = h1.querySelector('.t-ghost');
  if (!ghost) {
    ghost = live.cloneNode(true);
    ghost.className = 't-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    h1.appendChild(ghost);
  }
  const slot = ghost.querySelector('.t-cycle');
  if (!slot) return;

  // worst case: har lambai ke liye sabse chaude glyphs
  const variants = PHRASES.slice();
  PHRASES.forEach(p => variants.push('0'.repeat(p.length), '8'.repeat(p.length)));

  h1.style.minHeight = '';
  let max = 0;
  variants.forEach(v => {
    slot.textContent = v;
    max = Math.max(max, ghost.getBoundingClientRect().height);
  });
  slot.textContent = PHRASES[0];
  h1.style.minHeight = Math.ceil(max) + 'px';
}

export function cycleHeadline() {
  const el = document.querySelector('#cycle');
  if (!el) return;

  reserveTitleHeight();
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(reserveTitleHeight, 160);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => reserveTitleHeight());
  }

  if (reduced()) { el.textContent = PHRASES[0]; return; }

  let idx = 0;
  el.textContent = PHRASES[0];

  const scrambleTo = (from, to, done) => {
    const len = to.length;          // target ki lambai — width kabhi nahi badhti
    let frame = 0;
    const total = 64;                                // pehle 26 — ab aaram se decode hota hai
    const tick = () => {
      let out = '';
      for (let i = 0; i < len; i++) {
        const settle = (i / len) * 0.62 + 0.20;       // baayein se daayein settle
        const p = frame / total;
        if (p >= settle) out += to[i] || '';
        else if (Math.random() < 0.42) out += CHARS[(Math.random() * CHARS.length) | 0];
        else out += from[i] || CHARS[(Math.random() * CHARS.length) | 0];
      }
      el.textContent = out;
      frame++;
      if (frame <= total) requestAnimationFrame(tick);
      else { el.textContent = to; done && done(); }
    };
    tick();
  };

  const next = () => {
    const from = PHRASES[idx];
    idx = (idx + 1) % PHRASES.length;
    audio.typeBurst(PHRASES[idx].length, 1000);
    scrambleTo(from, PHRASES[idx], () => setTimeout(next, 5200));
  };
  setTimeout(next, 4500);
}

/* ---- hero ke numbers ---- */
export function rollCounters() {
  const els = Array.from(document.querySelectorAll('[data-roll]'));
  els.forEach(el => {
    const target = parseFloat(el.dataset.roll);
    const suffix = el.dataset.suffix || '';
    const fmt = v => (target >= 1000 ? Math.round(v).toLocaleString('en-US') : Math.round(v)) + suffix;
    if (reduced()) { el.textContent = fmt(target); return; }
    const dur = 1500, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 900);
  });
}
