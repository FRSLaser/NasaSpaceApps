const $ = s => document.querySelector(s);
const api = (p, b) => fetch('/api/' + p, {method: b === undefined ? 'GET' : 'POST',
  headers: {'Content-Type': 'application/json'}, body: b === undefined ? undefined : JSON.stringify(b)}).then(r => r.json());
const PARTS = {
  head: ['Brain and sleep', 'Controls mood, focus and sleep cycles.'],
  chest: ['Heart and blood vessels', 'Pumps blood. Microgravity shifts fluid toward your head.'],
  gut: ['Metabolism and immunity', 'Handles blood sugar and fights infection.'],
  legs: ['Bones and muscles', 'Lose load in microgravity, so bone density drops without exercise.'],
  body: ['Whole body: radiation', 'Space radiation passes through the hull and every tissue.']};
const RANK = {ok: 0, warn: 1, crit: 2}, WORD = {ok: 'Good', warn: 'Watch', crit: 'Act now', none: 'No data'};
let S, part = 'chest', key = 'hr';

const keysOf = p => Object.keys(S.ind).filter(k => S.ind[k].part === p);
const worst = keys => keys.reduce((w, k) => {
  const st = S.latest && S.latest.status[k];
  return st && w !== 'none' && RANK[st] > RANK[w] ? st : w;
}, S.latest ? 'ok' : 'none');

function render() {
  $('#env').innerHTML = Object.entries(S.envs).map(([k, e]) => `<option value="${k}" ${k === S.env ? 'selected' : ''}>${e.name}</option>`).join('');
  $('#day').textContent = 'Mission day ' + S.day;
  $('#level').textContent = `Level ${S.level} · ${S.xp} XP`;
  $('#streak').textContent = `Streak ${S.streak} day${S.streak === 1 ? '' : 's'}`;
  const a = $('#alert'); a.hidden = !S.alerts.length;
  a.className = S.escalate ? 'crit' : '';
  a.innerHTML = (S.escalate ? '<b>Contact your flight surgeon.</b> At least one reading is outside the safe range. ' : '<b>Keep an eye on:</b> ')
    + S.alerts.map(x => x.label).join(', ') + '.';
  document.querySelectorAll('.part').forEach(el => {
    const p = el.dataset.part, w = worst(keysOf(p));
    el.setAttribute('class', `part ${p === 'body' ? 'ring' : ''} st-${w} ${p === part ? 'sel' : ''}`);
    el.setAttribute('aria-label', `${PARTS[p][0]}: ${WORD[w]}`);
  });
  $('#rad').textContent = `Dose logged so far: ${S.dose} mSv (career limit ${S.limit} mSv)`;
  panel(); form(); chart();
  $('#badges').innerHTML = S.badges.map(b => `<li class="${b.got ? 'got' : ''}">${b.got ? '★ ' : ''}${b.name}</li>`).join('');
}

function panel() {
  $('#panel').innerHTML = `<h2>${PARTS[part][0]}</h2><p class="muted">${PARTS[part][1]}</p><br>` + keysOf(part).map(k => {
    const i = S.ind[k], v = S.latest && S.latest.values[k], st = (S.latest && S.latest.status[k]) || 'none';
    return `<div class="row"><h3>${i.label}<span class="pill ${st}">${v === undefined ? WORD.none : v + ' ' + i.unit + ' · ' + WORD[st]}</span></h3>
      <p><b>Safe range:</b> ${i.ok[0]} to ${i.ok[1]} ${i.unit}</p>
      <p><b>Why it matters:</b> ${i.why} <i>(${i.hazard})</i></p>
      <p><b>How to measure:</b> ${i.how}</p>
      ${st === 'warn' || st === 'crit' ? `<p><b>What to do:</b> ${i.tip}</p>` : ''}</div>`;
  }).join('');
}

function form() {
  const f = $('#form'), tag = S.day + S.env;
  if (f.dataset.tag === tag && f.children.length) return;
  f.dataset.tag = tag;
  const today = S.latest && S.latest.day === S.day ? S.latest.values : {};
  f.innerHTML = Object.entries(S.ind).map(([k, i]) =>
    `<label>${i.label} (${i.unit})<input name="${k}" type="number" min="${i.min}" max="${i.max}" step="${i.step}" value="${today[k] ?? ''}"></label>`).join('')
    + '<button>Save check-in</button>';
}

function chart() {
  $('#tabs').innerHTML = Object.entries(S.ind).map(([k, i]) => `<button data-k="${k}" class="${k === key ? 'on' : ''}">${i.label.split(' (')[0]}</button>`).join('');
  const h = S.history.filter(e => e.values[key] !== undefined), i = S.ind[key];
  if (!h.length) { $('#chart').innerHTML = '<p class="muted">No data yet. Save a check-in to see the trend.</p>'; return; }
  const vs = h.map(e => e.values[key]), lo = Math.min(...vs, i.ok[0]), hi = Math.max(...vs, i.ok[1]), pad = (hi - lo) * .2 || 1;
  const W = 400, H = 140, x = j => h.length > 1 ? 24 + j * (W - 48) / (h.length - 1) : W / 2;
  const y = v => H - 16 - (v - (lo - pad)) / (hi - lo + 2 * pad) * (H - 32);
  const col = {ok: '#4fd39a', warn: '#ffc65a', crit: '#ff5f56'};
  $('#chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${i.label} trend">
    <rect x="0" y="${y(i.ok[1])}" width="${W}" height="${Math.max(2, y(i.ok[0]) - y(i.ok[1]))}" fill="#4fd39a" opacity=".15"/>
    <polyline fill="none" stroke="#9aa6c9" stroke-width="2" points="${vs.map((v, j) => x(j) + ',' + y(v)).join(' ')}"/>
    ${h.map((e, j) => `<circle cx="${x(j)}" cy="${y(e.values[key])}" r="5" fill="${col[e.status[key]]}"><title>Day ${e.day}: ${e.values[key]} ${i.unit}</title></circle>`).join('')}
    <text x="6" y="12" fill="#9aa6c9" font-size="11">Green band: safe range (${i.ok[0]} to ${i.ok[1]} ${i.unit})</text></svg>`;
}

const set = s => { S = s; render(); };
const refresh = s => { $('#form').innerHTML = ''; set(s); };
document.addEventListener('click', e => {
  const p = e.target.closest('.part'); if (p) { part = p.dataset.part; render(); }
  if (e.target.dataset.k) { key = e.target.dataset.k; chart(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList.contains('part')) { part = e.target.dataset.part; render(); }
});
$('#env').onchange = e => api('env', {env: e.target.value}).then(refresh);
$('#next').onclick = () => api('day', {}).then(refresh);
$('#demo').onclick = () => api('demo', {}).then(refresh);
$('#reset').onclick = () => confirm('Delete all logged data?') && api('reset', {}).then(refresh);
$('#form').onsubmit = e => {
  e.preventDefault();
  const values = {}; new FormData(e.target).forEach((v, k) => { if (v !== '') values[k] = v; });
  api('checkin', {values}).then(r => r.error ? alert(r.error) : set(r));
};
api('state').then(set);
