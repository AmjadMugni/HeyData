// HeyData — sound design. Sab synthesised, koi audio file nahi.
// Niyam: default OFF, load pe chup, sirf lock/change events pe, halka aur saaf.
// Tone: mechanical nahi — musical. Bars pentatonic scale pe lock hote hain,
// headline sci-fi decode karta hai. Sab kuch ek warm bus se hokar jaata hai.

const KEY = 'heydata-sound';

let ctx = null;
let bus = null;        // sab yahin aata hai
let air = null;        // halka sa delay — space deta hai
let enabled = false;
let active = 0;

export function isEnabled() { return enabled; }

export function restore() {
  try { enabled = localStorage.getItem(KEY) === 'on'; } catch (e) { enabled = false; }
  return enabled;
}

export function wasMuted() {
  try { return localStorage.getItem(KEY) === 'off'; } catch (e) { return false; }
}

export function enable() {
  enabled = true;
  try { localStorage.setItem(KEY, 'on'); } catch (e) {}
  ensure();
  return true;
}

export function toggle() {
  enabled = !enabled;
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) {}
  if (enabled) ensure();
  return enabled;
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();

  const master = ctx.createGain();
  master.gain.value = 0.3;

  // tez frequencies ko thoda kaat do — kaan ko chubhta nahi
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 6200;
  soft.Q.value = 0.4;

  bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(soft).connect(master).connect(ctx.destination);

  // halka sa echo — premium feel, alag se sunai nahi deta
  const dly = ctx.createDelay(0.5);
  dly.delayTime.value = 0.12;
  const fb = ctx.createGain(); fb.gain.value = 0.16;
  air = ctx.createGain(); air.gain.value = 0.13;
  const airLp = ctx.createBiquadFilter();
  airLp.type = 'lowpass'; airLp.frequency.value = 2600;
  bus.connect(dly); dly.connect(fb); fb.connect(dly);
  dly.connect(airLp).connect(air).connect(master);

  return ctx;
}

function reduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function can() {
  if (!enabled || reduced()) return false;
  if (!ensure()) return false;
  if (ctx.state === 'suspended') ctx.resume();
  return active < 4;
}

function noiseBuffer(dur) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

function hold(ms) {
  active++;
  setTimeout(() => { active--; }, ms);
}

/* ek chhota sa tone — sab sounds isi se bante hain */
function tone({ t, freq, type = 'sine', peak = 0.16, attack = 0.005, decay = 0.2, to = null }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + decay);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + decay + 0.02);
  return o;
}

/* pentatonic — bars upar chadhte hue lock hote hain */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

/** Bar lock. i = kaunsa bar (0 se) — har bar apna sur. */
export function click(i = 0) {
  if (!can()) return;
  const t = ctx.currentTime;
  hold(240);
  const f = SCALE[i % SCALE.length];

  tone({ t, freq: f, type: 'triangle', peak: 0.13, attack: 0.004, decay: 0.26 });
  tone({ t, freq: f * 2, type: 'sine', peak: 0.05, attack: 0.003, decay: 0.12 });
  // halki si "lag gaya" wali chot
  tone({ t, freq: f * 4, type: 'sine', peak: 0.025, attack: 0.001, decay: 0.035 });
}

/** Poora chart lock — gehra, warm, ek hi baar. */
export function thunk() {
  if (!can()) return;
  const t = ctx.currentTime;
  hold(560);
  tone({ t, freq: 174.61, type: 'sine', peak: 0.26, attack: 0.012, decay: 0.42, to: 87.31 });
  tone({ t: t + 0.01, freq: 349.23, type: 'sine', peak: 0.07, attack: 0.008, decay: 0.3 });
}

/** Pill, tab ya pipeline node — wahi keyboard wala touch. */
export function tick() {
  if (!can()) return;
  hold(80);
  keyAt(ctx.currentTime, 0.6);
}

/** Sci-fi text-decode — headline ke words badalte waqt.
    Chhote data blips jinki pitch chadhti hai, phir ek settle sweep. */
export function decode(ms = 900) {
  if (!can()) return;
  const t0 = ctx.currentTime;
  const dur = ms / 1000;
  hold(ms + 320);

  const n = Math.max(8, Math.round(ms / 52));
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const t = t0 + p * dur * 0.86 + Math.random() * 0.012;

    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(680 + p * 820 + (Math.random() * 440 - 220), t);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1000 + p * 1400, t);
    bp.Q.value = 3.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03 + Math.random() * 0.022, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.024);

    o.connect(bp).connect(g).connect(bus);
    o.start(t); o.stop(t + 0.028);
  }

  // settle: word lock ho gaya
  const ts = t0 + dur * 0.86;
  tone({ t: ts, freq: 1318.51, type: 'sine', peak: 0.085, attack: 0.018, decay: 0.26, to: 659.25 });
}

/* ---------- mechanical keyboard ----------
   Ek keypress = teen cheezein: switch ka click (upar, tez),
   bottom-out ka thock (neeche, bhaari), aur halki si spring ring.
   Har press ka pitch thoda alag, warna machine-gun lagta hai. */
function keyAt(t, force = 1) {
  const det = 0.9 + Math.random() * 0.2;

  // 1) click — chhota, tez noise transient
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(0.012);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3100 * det;
  bp.Q.value = 1.1;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.42 * force, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.011);
  n.connect(bp).connect(ng).connect(bus);
  n.start(t); n.stop(t + 0.015);

  // 2) thock — bottom-out ka bhaari hissa
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(205 * det, t + 0.004);
  o.frequency.exponentialRampToValueAtTime(118 * det, t + 0.05);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1100;
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t + 0.004);
  og.gain.exponentialRampToValueAtTime(0.3 * force, t + 0.009);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
  o.connect(lp).connect(og).connect(bus);
  o.start(t + 0.004); o.stop(t + 0.06);

  // 3) case/plate ka thoda sa mid knock
  const k = ctx.createBufferSource();
  k.buffer = noiseBuffer(0.03);
  const kf = ctx.createBiquadFilter();
  kf.type = 'bandpass';
  kf.frequency.value = 780 * det;
  kf.Q.value = 0.8;
  const kg = ctx.createGain();
  kg.gain.setValueAtTime(0.16 * force, t + 0.005);
  kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  k.connect(kf).connect(kg).connect(bus);
  k.start(t + 0.005); k.stop(t + 0.045);
}

/** Ek keypress. */
export function key(force = 1) {
  if (!can()) return;
  hold(80);
  keyAt(ctx.currentTime, force);
}

/** Typing burst — headline ke words badalte waqt.
    n presses, ms milliseconds mein, thoda uneven rhythm (insaan jaisa). */
export function typeBurst(n = 16, ms = 950) {
  if (!can()) return;
  hold(ms + 200);
  const t0 = ctx.currentTime, dur = ms / 1000;
  const count = Math.max(4, Math.min(28, n));
  for (let i = 0; i < count; i++) {
    const p = i / count;
    const jitter = (Math.random() - 0.5) * (dur / count) * 0.7;
    keyAt(t0 + p * dur * 0.92 + jitter, 0.55 + Math.random() * 0.3);
  }
  // aakhir mein ek zoradaar "enter" press
  keyAt(t0 + dur, 1.15);
}
