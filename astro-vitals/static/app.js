const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = (p, b) => fetch('/api/' + p, {method: b === undefined ? 'GET' : 'POST',
  headers: {'Content-Type': 'application/json'}, body: b === undefined ? undefined : JSON.stringify(b)}).then(r => r.json());
const PARTS = {
  head: ['Brain and sleep', 'Controls mood, focus and sleep cycles.'],
  chest: ['Heart and blood vessels', 'Pumps blood. Microgravity shifts fluid toward your head.'],
  gut: ['Metabolism and immunity', 'Handles blood sugar and fights infection.'],
  legs: ['Bones and muscles', 'Lose load in microgravity, so bone density drops without exercise.'],
  body: ['Whole body: radiation', 'Space radiation passes through the hull and every tissue.']};
const SHORT = {hr: 'Heart', bp_sys: 'BP top', bp_dia: 'BP low', glucose: 'Sugar', temp: 'Temp', sleep: 'Sleep', mood: 'Mood', exercise: 'Exercise', radiation: 'Radiation'};
const RANK = {ok: 0, warn: 1, crit: 2}, WORD = {ok: 'Good', warn: 'Watch', crit: 'Act now', none: 'No data'};
const PTS = {ok: 100, warn: 60, crit: 20}, COL = {ok: '#2fd17b', warn: '#ffb81c', crit: '#fc3d21'}, FACES = ['😞', '😕', '😐', '🙂', '😄'];
let S, part = 'chest', key = 'hr', view = 'overview', oldLevel = null;

const keysOf = p => Object.keys(S.ind).filter(k => S.ind[k].part === p);
const worst = ks => ks.reduce((w, k) => { const st = S.latest && S.latest.status[k]; return st && w !== 'none' && RANK[st] > RANK[w] ? st : w; }, S.latest ? 'ok' : 'none');
const inR = (v, [a, b]) => v >= a && v <= b;
const stat = (k, v) => inR(v, S.ind[k].ok) ? 'ok' : inR(v, S.ind[k].warn) ? 'warn' : 'crit';
const score = () => { const v = S.latest ? Object.values(S.latest.status).map(s => PTS[s]) : []; return v.length ? Math.round(v.reduce((a, b) => a + b) / v.length) : 0; };

function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; $('#toasts').append(t); setTimeout(() => t.remove(), 2600); }
function tween(el, to, ms = 1000) {
  const from = +el.dataset.v || 0, t0 = performance.now(); el.dataset.v = to;
  (function f(t) { const p = Math.min(1, (t - t0) / ms); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0);
}

/* ---------- Overview ---------- */
function render() {
  $('#env').innerHTML = Object.entries(S.envs).map(([k, e]) => `<option value="${k}" ${k === S.env ? 'selected' : ''}>${e.name}</option>`).join('');
  $('#day').textContent = 'Mission day ' + S.day;
  $('#level').textContent = `Level ${S.level} · ${S.xp} XP`;
  $('#xpfill').style.width = (S.xp % 100) + '%';
  $('#streak').textContent = `🔥 ${S.streak}-day streak`;
  if (oldLevel !== null && S.level > oldLevel) toast('Level up! You reached level ' + S.level);
  oldLevel = S.level;
  const a = $('#alert'); a.hidden = !S.alerts.length; a.className = S.escalate ? 'crit' : '';
  a.innerHTML = (S.escalate ? '<b>Contact your flight surgeon.</b> At least one reading is far outside the safe range: ' : '<b>Keep an eye on:</b> ') + S.alerts.map(x => x.label).join(', ') + '.';
  const hr = S.latest && S.latest.values.hr; $('#fig').style.setProperty('--beat', (60 / (hr || 70)) + 's');
  $$('.part').forEach(el => {
    const p = el.dataset.part, w = worst(keysOf(p));
    el.setAttribute('class', `part ${p === 'body' ? 'ring' : ''} ${p === 'chest' ? 'beat' : ''} st-${w} ${p === part ? 'sel' : ''}`);
    el.setAttribute('aria-label', `${PARTS[p][0]}: ${WORD[w]}`);
  });
  $('#rad').textContent = `Dose logged: ${S.dose} mSv (career limit ${S.limit} mSv)`;
  gauge(); plan(); panel(); form();
  $('#badges').innerHTML = S.badges.map(b => `<li class="${b.got ? 'got' : ''}">${b.got ? '🏅' : '🔒'}<br>${b.name}</li>`).join('');
  if (view === 'insights') charts();
}

function gauge() {
  const sc = score(), C = 2 * Math.PI * 52, col = sc >= 80 ? COL.ok : sc >= 55 ? COL.warn : COL.crit;
  $('#gauge').innerHTML = `<svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle id="gfg" class="fg" cx="60" cy="60" r="52" stroke="${col}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/><text id="gsc" x="60" y="70">0</text></svg>`;
  requestAnimationFrame(() => requestAnimationFrame(() => $('#gfg').style.strokeDashoffset = C * (1 - sc / 100)));
  tween($('#gsc'), sc);
  const n = S.alerts.length;
  $('#scoretext').textContent = !S.latest ? 'No readings yet. Start a check-in or connect the wearables.' : n ? `${n} of ${Object.keys(S.latest.status).length} readings need attention.` : 'Every reading is in its safe range. Nice work.';
}

const tipHTML = a => {
  const d = S.tips_done.includes(a.key);
  return `<div class="tip ${a.status}${d ? ' done' : ''}"><span class="dir">${a.dir === 'low' ? '▼' : '▲'}</span><div><b>${a.label} is ${a.dir === 'low' ? 'below' : 'above'} the safe range</b><p>${a.tip}</p></div><button class="done" data-tip="${a.key}" ${d ? 'disabled' : ''}>${d ? '✓ Done' : 'Done +5 XP'}</button></div>`;
};
function plan() {
  $('#plan').innerHTML = `<h2>Action plan</h2>` + (S.alerts.length ? S.alerts.map(tipHTML).join('') : '<p class="muted">Nothing to fix right now. Keep up your exercise, sleep and check-in routine.</p>');
}

function panel() {
  $('#panel').innerHTML = `<h2 style="margin-top:6px">${PARTS[part][0]}</h2><p class="muted" style="margin-bottom:10px">${PARTS[part][1]}</p>` + keysOf(part).map((k, n) => {
    const i = S.ind[k], v = S.latest && S.latest.values[k], st = (S.latest && S.latest.status[k]) || 'none', al = S.alerts.find(x => x.key === k);
    return `<div class="row" style="animation-delay:${n * 70}ms"><h3>${i.label}<span class="pill ${st}">${v === undefined ? WORD.none : v + ' ' + i.unit + ' · ' + WORD[st]}</span></h3>
      <p><b class="l">Safe range:</b> ${i.ok[0]} to ${i.ok[1]} ${i.unit}</p><p><b class="l">Why it matters:</b> ${i.why} <i>(${i.hazard})</i></p>
      <p><b class="l">How to measure:</b> ${i.how}</p>${al ? tipHTML(al) : ''}</div>`;
  }).join('');
}

/* ---------- Check-in ---------- */
const bounds = k => {
  const i = S.ind[k], lo = Math.min(i.ok[0], i.warn[0]), hi = Math.max(i.ok[1], i.warn[1]), sp = hi - lo;
  return [Math.max(i.min, +(lo - sp * .6).toFixed(2)), Math.min(i.max, +(hi + sp * .6).toFixed(2))];
};
function setRow(row, v) {
  const k = row.dataset.k, i = S.ind[k]; v = +(+v).toFixed(2); row.dataset.val = v;
  const o = $('.fv', row); o.className = 'fv ' + stat(k, v); o.textContent = k === 'mood' ? FACES[v - 1] : `${v} ${i.unit}`;
  const r = $('input', row); if (r) r.value = v;
  $$('.mood', row).forEach(b => b.classList.toggle('on', +b.dataset.v === v));
}
function form() {
  const f = $('#form'), tag = S.day + S.env; if (f.dataset.tag === tag && f.children.length) return; f.dataset.tag = tag;
  const today = S.latest && S.latest.day === S.day ? S.latest.values : {};
  f.innerHTML = Object.entries(S.ind).map(([k, i]) => {
    const [lo, hi] = bounds(k), mid = k === 'radiation' ? S.envs[S.env].rad : (i.ok[0] + i.ok[1]) / 2;
    const ctrl = k === 'mood' ? `<div class="fc moods">${FACES.map((x, n) => `<button type="button" class="mood" data-v="${n + 1}" aria-label="Mood ${n + 1} of 5">${x}</button>`).join('')}</div>`
      : `<div class="fc"><button type="button" class="step" data-d="-1" aria-label="Decrease">−</button><input type="range" min="${lo}" max="${hi}" step="${i.step}"><button type="button" class="step" data-d="1" aria-label="Increase">+</button></div>`;
    return `<div class="frow" data-k="${k}" data-start="${today[k] ?? Math.round(mid / i.step) * i.step}"><div class="fl">${i.label}<span class="fv"></span></div>${ctrl}</div>`;
  }).join('') + '<button class="primary">Save check-in</button>';
  $$('.frow', f).forEach(r => setRow(r, r.dataset.start));
}
$('#form').addEventListener('input', e => { if (e.target.type === 'range') setRow(e.target.closest('.frow'), e.target.value); });
$('#form').addEventListener('click', e => {
  const row = e.target.closest('.frow'); if (!row) return;
  if (e.target.classList.contains('mood')) setRow(row, e.target.dataset.v);
  if (e.target.classList.contains('step')) { const [lo, hi] = bounds(row.dataset.k), st = S.ind[row.dataset.k].step; setRow(row, Math.min(hi, Math.max(lo, +row.dataset.val + e.target.dataset.d * st))); }
});
$('#form').onsubmit = e => {
  e.preventDefault(); const values = {}; $$('.frow').forEach(r => values[r.dataset.k] = r.dataset.val);
  save(values);
};
function save(values, quiet) {
  if (!Object.keys(values).length) return; const before = S.xp;
  api('checkin', {values}).then(r => { if (r.error) return toast(r.error); S = r; render(); const g = r.xp - before;
    toast(g ? `Saved! +${g} XP` : 'Check-in updated'); if (!quiet) showView('overview'); });
}

/* ---------- Charts ---------- */
function charts() { $('#radar').innerHTML = radar(); $('#bars').innerHTML = bars(); chart(); }
const empty = '<p class="muted">No data yet. Save a check-in or load the demo week.</p>';
function radar() {
  if (!S.latest) return empty;
  const ks = Object.keys(S.ind), n = ks.length, cx = 150, cy = 140, R = 90;
  const pt = (i, f) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
  const poly = f => ks.map((k, i) => pt(i, f(k)).join(',')).join(' ');
  return `<svg viewBox="0 0 300 290" role="img" aria-label="Radar of current status">${[.33, .66, 1].map(f => `<polygon class="grid" points="${poly(() => f)}"/>`).join('')}
    ${ks.map((k, i) => `<line class="grid" x1="${cx}" y1="${cy}" x2="${pt(i, 1)[0]}" y2="${pt(i, 1)[1]}"/>`).join('')}
    <polygon class="radar" points="${poly(k => (PTS[S.latest.status[k]] || 0) / 100)}"/>
    ${ks.map((k, i) => { const [x, y] = pt(i, (PTS[S.latest.status[k]] || 0) / 100), [lx, ly] = pt(i, 1.2); return `<circle cx="${x}" cy="${y}" r="4.5" fill="${COL[S.latest.status[k]] || '#888'}"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${SHORT[k]}</text>`; }).join('')}</svg>`;
}
function bars() {
  const h = S.history; if (!h.length) return empty;
  const W = 400, H = 150, slot = (W - 30) / h.length, bw = Math.min(34, slot - 8), tot = Object.keys(S.ind).length, u = (H - 10) / tot;
  return `<svg viewBox="0 0 ${W} ${H + 20}" role="img" aria-label="Daily status mix">` + h.map((e, j) => {
    const x = 20 + j * slot + (slot - bw) / 2, c = {ok: 0, warn: 0, crit: 0}; let y = H; Object.values(e.status).forEach(s => c[s]++);
    return ['ok', 'warn', 'crit'].map(s => { const hh = c[s] * u; y -= hh; return hh ? `<rect class="bk" style="animation-delay:${j * 70}ms" x="${x}" y="${y}" width="${bw}" height="${hh - 1}" rx="2" fill="${COL[s]}"/>` : ''; }).join('')
      + `<text x="${x + bw / 2}" y="${H + 14}" text-anchor="middle">D${e.day}</text>`;
  }).join('') + '</svg>';
}
function chart() {
  $('#tabs').innerHTML = Object.keys(S.ind).map(k => `<button data-k="${k}" class="${k === key ? 'on' : ''}">${SHORT[k]}</button>`).join('');
  const h = S.history.filter(e => e.values[key] !== undefined), i = S.ind[key]; if (!h.length) { $('#chart').innerHTML = empty; return; }
  const vs = h.map(e => e.values[key]), lo = Math.min(...vs, i.ok[0]), hi = Math.max(...vs, i.ok[1]), pad = (hi - lo) * .2 || 1, W = 520, H = 190;
  const x = j => h.length > 1 ? 30 + j * (W - 60) / (h.length - 1) : W / 2, y = v => H - 24 - (v - (lo - pad)) / (hi - lo + 2 * pad) * (H - 44);
  $('#chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${i.label} trend"><rect x="0" y="${y(i.ok[1])}" width="${W}" height="${Math.max(3, y(i.ok[0]) - y(i.ok[1]))}" fill="${COL.ok}" opacity=".16"/>
    <polyline class="line" pathLength="1" points="${vs.map((v, j) => x(j) + ',' + y(v)).join(' ')}"/>
    ${h.map((e, j) => `<circle cx="${x(j)}" cy="${y(e.values[key])}" r="6" fill="${COL[e.status[key]]}" stroke="#050d24" stroke-width="2"><title>Day ${e.day}: ${e.values[key]} ${i.unit}</title></circle><text x="${x(j)}" y="${H - 6}" text-anchor="middle">D${e.day}</text>`).join('')}
    <text x="8" y="14">${i.label}: green band is ${i.ok[0]} to ${i.ok[1]} ${i.unit}</text></svg>`;
}

/* ---------- Live sensors ---------- */
let timer = null, tick = 0, LIVE = {}, BUF = {};
function buildLive() {
  if ($('#tiles').children.length) return;
  $('#tiles').innerHTML = Object.entries(S.ind).map(([k, i]) => `<div class="tile" data-k="${k}"><div class="tl">${i.label}</div><div class="tv"><span class="n">–</span><small>${i.unit}</small></div><svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none"><polyline points=""/></svg><div class="ts">No signal</div></div>`).join('');
}
async function poll() {
  const d = await api('live'); LIVE = d.values; tick++;
  $('#src').textContent = d.source === 'device' ? 'Receiving data from a connected device' : 'Streaming from the simulated wearable suite';
  for (const [k, v] of Object.entries(d.values)) {
    const t = $(`.tile[data-k="${k}"]`); if (!t) continue;
    const b = (BUF[k] = BUF[k] || []); b.push(v); if (b.length > 30) b.shift();
    const st = d.status[k], i = S.ind[k], mn = Math.min(...b), r = (Math.max(...b) - mn) || 1;
    t.className = 'tile st-' + st + ' flash'; setTimeout(() => t.classList.remove('flash'), 450);
    $('.n', t).textContent = v; $('.ts', t).textContent = WORD[st] + (st === 'ok' ? '' : v < i.ok[0] ? ' · low' : ' · high');
    $('polyline', t).setAttribute('points', b.map((x, j) => `${j * 100 / 29},${26 - (x - mn) / r * 24}`).join(' '));
  }
  if ($('#auto').checked && tick % 15 === 0) save(LIVE, true);
}
$('#conn').onclick = () => {
  if (timer) { clearInterval(timer); timer = null; } else { poll(); timer = setInterval(poll, 2000); }
  $('#conn').textContent = timer ? 'Disconnect wearables' : 'Connect wearables'; $('#conn').classList.toggle('on', !!timer);
  $('#dot').hidden = !timer; if (!timer) $('#src').textContent = 'Not connected';
};
$('#savelive').onclick = () => Object.keys(LIVE).length ? save(LIVE, true) : toast('Connect the wearables first');

/* ---------- Wiring ---------- */
function showView(v) {
  view = v; $$('.view').forEach(e => e.hidden = e.id !== 'v-' + v); $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'insights') charts(); if (v === 'live') buildLive();
}
const refresh = s => { $('#form').innerHTML = ''; S = s; render(); };
document.addEventListener('click', e => {
  const t = e.target, p = t.closest('.part'), nav = t.closest('#nav button');
  if (p) { part = p.dataset.part; render(); }
  if (nav) showView(nav.dataset.v);
  if (t.closest('#tabs') && t.dataset.k) { key = t.dataset.k; chart(); }
  if (t.dataset.tip) api('tip', {key: t.dataset.tip}).then(r => { const b = S.xp; S = r; render(); toast(`Nice! +${r.xp - b} XP`); });
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('part')) { e.preventDefault(); part = e.target.dataset.part; render(); } });
$('#fig').addEventListener('pointerover', e => { const p = e.target.dataset.part; if (p) $('#cap').textContent = `${PARTS[p][0]}: ${WORD[worst(keysOf(p))]}`; });
$('#fig').addEventListener('pointerleave', () => $('#cap').innerHTML = '&nbsp;');
$('#env').onchange = e => api('env', {env: e.target.value}).then(s => { BUF = {}; refresh(s); });
$('#next').onclick = () => api('day', {}).then(s => { refresh(s); toast('Mission day ' + s.day); });
$('#demo').onclick = () => api('demo', {}).then(s => { refresh(s); toast('Demo week loaded'); });
$('#reset').onclick = () => confirm('Delete all logged data?') && api('reset', {}).then(refresh);
api('state').then(s => { S = s; render(); });
