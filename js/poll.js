// HeyData — poll. Inaam hai, shart nahi: chart bina iske bhi poora chalta hai.
// Abhi local-only (koi backend nahi) — jawab browser mein rehta hai.

const KEY = 'heydata-poll';

export function saved() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
}

function store(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
}

export function initPoll({ openBtn, form, chart, onAnswer }) {
  if (!openBtn || !form) return;
  const msg = form.querySelector('.poll-msg');
  const prev = saved();

  if (prev) {
    openBtn.textContent = 'You answered — see your bar';
    chart.setHighlight(prev.answer);
  }

  openBtn.addEventListener('click', () => {
    const open = form.hasAttribute('hidden');
    if (open) { form.removeAttribute('hidden'); } else { form.setAttribute('hidden', ''); }
    openBtn.setAttribute('aria-expanded', String(open));
    if (open && saved()) msg.textContent = 'Already counted — thanks.';
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (saved()) { msg.textContent = 'Already counted — thanks.'; return; }

    const answer = form.querySelector('input[name="answer"]:checked');
    if (!answer) { msg.textContent = 'Pick one first.'; return; }
    const group = form.querySelector('#poll-group').value;

    const record = { answer: answer.value, group, at: Date.now() };
    store(record);

    chart.setGroup(group);
    chart.setHighlight(record.answer);
    onAnswer && onAnswer(record);

    msg.textContent = 'Counted — your answer is marked on the chart.';
    openBtn.textContent = 'You answered — see your bar';
    form.querySelectorAll('input, select, button').forEach(el => { el.disabled = true; });

    // thoda ruk kar khud band ho jaye — user ko confirmation dikh jaye pehle
    setTimeout(() => {
      form.setAttribute('hidden', '');
      openBtn.setAttribute('aria-expanded', 'false');
      openBtn.focus({ preventScroll: true });
    }, 1300);
  });
}
