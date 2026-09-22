// HeyData — demo dataset. Asli poll data aane par sirf ye file badlegi.

export const DATA = {
  meta: { n: 47, source: 'demo', updated: 'Sep 2026' },

  groups: [
    { id: 'small',   label: 'Agency 1–10',     short: 'small agencies',  n: 18 },
    { id: 'mid',     label: 'Agency 11–50',    short: 'larger agencies', n: 16 },
    { id: 'inhouse', label: 'In-house / Solo', short: 'in-house teams',  n: 13 }
  ],

  answers: [
    { id: 'dp',     label: 'Data processing turnaround' },
    { id: 'qc',     label: 'Data quality & QC issues' },
    { id: 'script', label: 'Scripting & logic changes' },
    { id: 'report', label: 'Reporting & chart prep' }
  ],

  cells: {
    small:   { dp: 61, qc: 22, script: 11, report: 6 },
    mid:     { dp: 34, qc: 28, script: 21, report: 17 },
    inhouse: { dp: 29, qc: 18, script: 9,  report: 44 }
  }
};

export const LOW_BASE = 30;

export function rows(groupId) {
  const cell = DATA.cells[groupId];
  return DATA.answers.map((a, i) => ({
    id: a.id, label: a.label, value: cell[a.id], series: i
  }));
}

export function takeaway(groupId) {
  const sorted = rows(groupId).slice().sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const others = DATA.groups.filter(g => g.id !== groupId);
  const compare = others
    .map(g => ({ g, v: DATA.cells[g.id][top.id] }))
    .sort((a, b) => b.v - a.v)[0];
  const me = DATA.groups.find(g => g.id === groupId);

  return {
    text: `For ${me.label}, ${top.label.toLowerCase()} is the biggest bottleneck`,
    stat: `${top.value}%`,
    tail: `vs ${compare.v}% at ${compare.g.short}.`
  };
}

// Live Data section — teen view, teeno synthetic, MR ke asli shape me
export const LIVE = {
  trend: {
    kind: 'trend',
    title: 'Category value, indexed (2021 = 100)',
    titleShort: 'Value indexed (2021 = 100)',
    x: ['2021', '2022', '2023', '2024', '2025', '2026'],
    series: [
      { label: 'Your brand', values: [100, 108, 119, 131, 147, 166], ci: [0, 3.1, 3.6, 4.2, 4.8, 5.4] },
      { label: 'Category',   values: [100, 104, 109, 115, 122, 129], ci: [0, 2.2, 2.5, 2.8, 3.1, 3.4] }
    ],
    note: 'Shaded band = 95% CI · gap vs category labelled at the latest wave'
  },

  segmentation: {
    kind: 'bars',
    title: 'Segment size vs share of spend',
    titleShort: 'Size vs share of spend',
    x: ['Loyalists', 'Switchers', 'Value seekers', 'Lapsed'],
    series: [
      { label: 'Share of sample', values: [31, 26, 28, 15] },
      { label: 'Share of spend',  values: [44, 22, 24, 10] }
    ],
    index: [142, 85, 86, 67],
    sig:   ['up', '', '', 'down'],
    note: 'Index = share of spend ÷ share of sample × 100 · ▲▼ sig at 95%'
  },

  crosstab: {
    kind: 'matrix',
    title: 'Purchase intent by age (index)',
    titleShort: 'Intent by age (index)',
    cols: ['18–24', '25–34', '35–44', '45–54', '55+'],
    short: ['18–24', '25–34', '35–44', '45–54', '55+'],
    rows: [
      { label: 'Definitely would buy', short: 'Definitely', values: [118, 131, 104, 86, 71] },
      { label: 'Probably would buy',   short: 'Probably',   values: [109, 116, 102, 93, 82] },
      { label: 'Might / might not',    short: 'Might',      values: [ 97,  94, 101, 106, 112] },
      { label: 'Would not buy',        short: 'Would not',  values: [ 78,  71,  95, 118, 141] }
    ],
    base: [126, 184, 162, 151, 28],
    note: 'Index vs total (100 = average) · ▲▼ sig at 95% · base < 30 flagged'
  }
};
