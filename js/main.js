// HeyData — entry

import { createChart } from './chart.js?v=20260925103000';
import { createLive } from './live.js?v=20260925103000';
import { initPoll } from './poll.js?v=20260925103000';
import { takeaway, DATA } from './data.js?v=20260925103000';
import * as audio from './audio.js?v=20260925103000';
import { initPipeline, initCounters, initReveal } from './sections.js?v=20260925103000';
import { initServiceVisuals } from './services.js?v=20260925103000';
import { cycleHeadline, rollCounters } from './hero.js?v=20260925103000';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ---- nav ---- */
const nav = $('.nav');
const toggle = $('.nav-toggle');
const links = $('.nav-links');

addEventListener('scroll', () => {
  nav.classList.toggle('is-stuck', scrollY > 8);
}, { passive: true });

toggle?.addEventListener('click', () => {
  const open = links.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
});
links?.addEventListener('click', e => {
  if (e.target.tagName === 'A') {
    links.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
  }
});

/* ---- hero chart ---- */
const canvas = $('#hero-canvas');
const takeawayEl = $('#takeaway');
const baseEl = $('#chart-base');

function renderTakeaway(groupId) {
  const t = takeaway(groupId);
  takeawayEl.innerHTML = `${t.text} — <b>${t.stat}</b> ${t.tail}`;
}

let chart = null;

if (canvas) {
  chart = createChart(canvas, {
    onLock: (i) => audio.click(i),
    onSettle: () => audio.thunk()
  });

  renderTakeaway('small');
  baseEl.textContent = chart.baseText();

  // auto-rotate: intro ke baad cuts apne aap badalte rehte hain,
  // jab tak user khud kuch na kare — tab hamesha ke liye ruk jata hai
  const ORDER = ['small', 'mid', 'inhouse'];
  let rotating = true, rotateTimer = null, cursor = 0;

  function stopRotation() {
    rotating = false;
    clearTimeout(rotateTimer);
  }
  function queueRotate(delay = 5200) {
    if (!rotating) return;
    clearTimeout(rotateTimer);
    rotateTimer = setTimeout(() => {
      if (!rotating || document.hidden) { queueRotate(2000); return; }
      cursor = (cursor + 1) % ORDER.length;
      const id = ORDER[cursor];
      $$('.pill').forEach(p => p.setAttribute('aria-selected', String(p.dataset.group === id)));
      chart.setGroup(id);
      renderTakeaway(id);
      baseEl.textContent = chart.baseText();
      queueRotate();
    }, delay);
  }

  const startIntro = () => {
    chart.intro();
    setTimeout(() => $('.pill')?.classList.add('is-hint'), 3800);
    queueRotate(6200);
  };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(startIntro, 420));
  } else {
    setTimeout(startIntro, 600);
  }

  /* ---- banner pills ---- */
  const pills = $$('.pill');
  function selectPill(btn) {
    stopRotation();
    pills.forEach(p => p.setAttribute('aria-selected', String(p === btn)));
    pills.forEach(p => p.classList.remove('is-hint'));
    const id = btn.dataset.group;
    audio.tick();
    chart.setGroup(id);
    renderTakeaway(id);
    baseEl.textContent = chart.baseText();
  }
  pills.forEach((btn, i) => {
    btn.addEventListener('click', () => selectPill(btn));
    btn.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = pills[(i + (e.key === 'ArrowRight' ? 1 : -1) + pills.length) % pills.length];
      next.focus();
      selectPill(next);
    });
  });

  /* ---- sound ----
     Browser page load pe audio nahi chalne deta. Isliye user ke pehle
     click/keypress/scroll pe hum use unlock karte hain, aur chart ki
     assembly dobara chalate hain — is baar awaaz ke saath.
     Jisne pehle khud mute kiya hai, uske liye band hi rahega. */
  const sound = $('.sound-toggle');
  const syncSound = on => {
    sound.setAttribute('aria-pressed', String(on));
    sound.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    sound.textContent = on ? 'Sound on' : 'Sound off';
  };
  syncSound(audio.restore());

  let unlocked = false;
  function unlockSound() {
    if (unlocked) return;
    unlocked = true;
    if (audio.wasMuted()) return;          // user ne khud band kiya tha
    audio.enable();
    syncSound(true);
    audio.tick();
    if (!chart.introDone) return;
    stopRotation();
    chart.intro();                          // dobara, awaaz ke saath
    queueRotate(7000);
    rotating = true;
  }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev =>
    addEventListener(ev, unlockSound, { once: true, passive: true })
  );

  sound.addEventListener('click', e => {
    e.stopPropagation();
    const on = audio.toggle();
    syncSound(on);
    if (on) audio.tick();
  });

  /* ---- poll ---- */
  initPoll({
    openBtn: $('.poll-open'),
    form: $('#poll'),
    chart,
    onAnswer: r => {
      stopRotation();
      renderTakeaway(r.group);
      baseEl.textContent = chart.baseText();
      $$('.pill').forEach(p => p.setAttribute('aria-selected', String(p.dataset.group === r.group)));
    }
  });
}

/* ---- live section ---- */
const liveCanvas = $('#live-canvas');
if (liveCanvas) {
  const live = createLive(liveCanvas);
  const tabs = $$('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
      audio.tick();
      live.setView(tab.dataset.view);
    });
  });
  const liveIO = new IntersectionObserver(e => {
    if (e[0].isIntersecting) { live.setView('trend'); liveIO.disconnect(); }
  }, { threshold: 0.3 });
  liveIO.observe(liveCanvas);
}

/* ---- contact form (abhi koi backend nahi) ---- */
$('#contact-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const msg = e.target.querySelector('.form-msg');
  const email = e.target.querySelector('#email');
  if (!email.value.includes('@')) { msg.textContent = 'Check the email address.'; return; }
  msg.textContent = 'Not connected yet — email me directly for now.';
});


/* ---- sections ---- */
initReveal();
initCounters();
initPipeline({ onNode: () => audio.tick() });
initServiceVisuals();

/* hero ka hook */
cycleHeadline();
rollCounters();
