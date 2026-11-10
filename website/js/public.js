// Public website: content and forms backed by the database.
// Live (js/config.js filled in): reads published content from Supabase and saves forms there.
// Not live: forms post to Netlify Forms. If this browser has the Founders' console demo data,
// pages preview it with a banner; otherwise the live sections show their empty states.
(function () {
  'use strict';
  const cfg = window.ROAR_CONFIG || {};
  const LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const DEMO_KEY = 'roar-council-demo-v3';
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).toISOString().slice(0, 10);

  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? esc(u) : '';
  const fmtDay = (v, opts) => v ? new Date(v.length === 10 ? v + 'T00:00:00+05:30' : v).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...(opts || { dateStyle: 'medium' }) }) : '';

  // ------------------------------------------------------------------
  // Data
  // ------------------------------------------------------------------
  let sb = null;
  let demo = null;
  if (!LIVE && window.ROAR_DEMO_OK) { try { demo = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) { demo = null; } }

  function loadSupabase() {
    if (!LIVE) return Promise.resolve(null);
    if (sb) return Promise.resolve(sb);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
      s.onload = () => { sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false } }); res(sb); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // Published rows of a table (or the public_ambassadors view)
  async function list(table) {
    if (LIVE) {
      const client = await loadSupabase();
      const q = table === 'public_ambassadors' ? client.from(table).select('*') : client.from(table).select('*').eq('published', true);
      const { data, error } = await q;
      if (error) { console.warn(table, error); return []; }
      return data || [];
    }
    if (!demo) return [];
    if (table === 'public_ambassadors') {
      return (demo.institutions || []).filter(i => i.status === 'appointed' && i.show_public && i.ambassador_name)
        .map(i => ({ institution: i.name, city: i.city, state: i.state, region: i.region, ambassador_name: i.ambassador_name }));
    }
    return (demo[table] || []).filter(r => r.published && !r.members_only);
  }

  window.ROAR_PUBLIC = { list };   // used by js/search.js

  async function submit(table, row) {
    const client = await loadSupabase();
    const { error } = await client.from(table).insert(row);
    if (error) throw error;
  }

  // ------------------------------------------------------------------
  // Renderers (each runs only if its container is on the page)
  // ------------------------------------------------------------------
  const KIND_ICON = {
    Conference: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>',
    Workshop: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    Webinar: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    Course: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    'Contouring session': '<path d="M12 3c5 0 9 3.5 9 8.5S17 21 12 21 3 16.5 3 11.5 7 3 12 3z"/><path d="M12 8c2.5 0 4 1.5 4 3.5S14.5 16 12 16s-4-2-4-4.5S9.5 8 12 8z"/>',
    Deadline: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    Meeting: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  };
  const icon = k => `<div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${KIND_ICON[k] || KIND_ICON.Course}</svg></div>`;

  function eventCard(e) {
    const d = new Date(e.starts_on + 'T00:00:00+05:30');
    const range = e.ends_on && e.ends_on !== e.starts_on ? `${fmtDay(e.starts_on, { day: 'numeric', month: 'short' })} – ${fmtDay(e.ends_on)}` : fmtDay(e.starts_on, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return `<article class="event card${e.roar_event ? ' roar' : ''}">
      <div class="event-date" aria-hidden="true"><span>${d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })}</span><b>${d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</b></div>
      <div class="event-body">
        <div class="meta-row"><span class="tag">${esc(e.kind)}</span><span class="tag tag-quiet">${esc(e.format)}</span>${e.roar_event ? '<span class="tag tag-roar">ROAR</span>' : ''}</div>
        <h3>${esc(e.title)}</h3>
        <p class="event-when">${range}${e.city ? ' · ' + esc(e.city) : ''}${e.organiser ? ' · ' + esc(e.organiser) : ''}</p>
        ${e.description ? `<p>${esc(e.description)}</p>` : ''}
        ${safeUrl(e.url) ? `<a class="more" href="${safeUrl(e.url)}" target="_blank" rel="noopener">Details &amp; registration ↗</a>` : ''}
      </div>
    </article>`;
  }

  function oppCard(o) {
    const soon = o.deadline && (new Date(o.deadline) - new Date(today)) / 864e5 <= 14;
    return `<article class="card opp">
      <div class="meta-row"><span class="tag">${esc(o.kind)}</span>${o.deadline ? `<span class="tag ${soon ? 'tag-roar' : 'tag-quiet'}">Apply by ${fmtDay(o.deadline)}</span>` : '<span class="tag tag-quiet">Open</span>'}</div>
      <h3>${esc(o.title)}</h3>
      <p class="event-when">${[o.organisation, o.location].filter(Boolean).map(esc).join(' · ')}</p>
      ${o.description ? `<p>${esc(o.description)}</p>` : ''}
      ${safeUrl(o.url) ? `<a class="more" href="${safeUrl(o.url)}" target="_blank" rel="noopener">View &amp; apply ↗</a>` : ''}
    </article>`;
  }

  function resCard(r) {
    return `<article class="card res">
      <div class="meta-row"><span class="tag">${esc(r.kind)}</span><span class="tag tag-quiet">${esc(r.level)}</span></div>
      <h3>${esc(r.title)}</h3>
      ${r.description ? `<p>${esc(r.description)}</p>` : ''}
      <a class="more" href="${safeUrl(r.url)}" target="_blank" rel="noopener">Open resource ↗</a>
    </article>`;
  }

  function newsCard(a, full) {
    return `<article class="card update" id="news-${esc(a.id)}">
      <div class="update-date">${fmtDay(a.created_at)}</div>
      <h3>${esc(a.title)}</h3><p>${esc(full ? a.body : a.body.length > 220 ? a.body.slice(0, 220) + '…' : a.body)}</p>
      ${!full ? `<a class="more" href="news.html#news-${esc(a.id)}">Read more →</a>` : ''}
    </article>`;
  }

  // A filterable list: chips for "kind", a search box, and an empty state
  function filterable({ box, rows, card, kinds, search, emptyText, extra }) {
    const root = $(box);
    if (!root) return;
    const wantKind = new URLSearchParams(location.search).get('kind');
    const state = { kind: kinds.includes(wantKind) ? wantKind : '', q: '', extra: extra ? extra.initial : '' };
    root.innerHTML = `
      <div class="filters" role="toolbar" aria-label="Filter">
        <div class="chips">${['All', ...kinds].map((k, i) => `<button class="chip${(i === 0 ? '' : k) === state.kind ? ' on' : ''}" data-kind="${i === 0 ? '' : esc(k)}">${esc(k)}</button>`).join('')}</div>
        ${extra ? `<div class="chips seg">${extra.options.map(([v, l]) => `<button class="chip${v === extra.initial ? ' on' : ''}" data-extra="${v}">${l}</button>`).join('')}</div>` : ''}
        <input type="search" class="search" placeholder="Search…" aria-label="Search">
      </div>
      <div class="list-grid" aria-live="polite"></div>`;
    const grid = root.querySelector('.list-grid');
    const draw = () => {
      const shown = rows.filter(r =>
        (!state.kind || r.kind === state.kind) &&
        (!extra || extra.test(r, state.extra)) &&
        (!state.q || search(r).toLowerCase().includes(state.q)));
      grid.innerHTML = shown.length ? shown.map(card).join('') : `<div class="card empty-state">${emptyText(rows.length)}</div>`;
    };
    root.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => {
      state.kind = b.dataset.kind;
      root.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === b));
      draw();
    }));
    root.querySelectorAll('[data-extra]').forEach(b => b.addEventListener('click', () => {
      state.extra = b.dataset.extra;
      root.querySelectorAll('[data-extra]').forEach(x => x.classList.toggle('on', x === b));
      draw();
    }));
    root.querySelector('.search').addEventListener('input', e => { state.q = e.target.value.toLowerCase(); draw(); });
    draw();
  }

  const emptyMsg = (what, cta) => total => total
    ? `No ${what} match these filters.`
    : `<b>No ${what} listed yet.</b><br>${cta}`;

  async function renderEvents() {
    if (!$('#events-list') && !$('#home-events')) return;
    const rows = (await list('events')).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    const upcoming = r => (r.ends_on || r.starts_on) >= today;
    const home = $('#home-events');
    if (home) {
      const next = rows.filter(upcoming).slice(0, 3);
      if (next.length) home.innerHTML = next.map(e => `<a class="ne-item" href="events.html"><span class="ne-date">${fmtDay(e.starts_on)}${e.ends_on && e.ends_on !== e.starts_on ? ' – ' + fmtDay(e.ends_on) : ''}</span><span class="ne-title">${esc(e.title)}</span><span class="ne-meta">${[e.kind, e.format, e.city].filter(Boolean).map(esc).join(' · ')}</span></a>`).join('');
    }
    filterable({
      box: '#events-list', rows, card: eventCard,
      kinds: ['Conference', 'Workshop', 'Webinar', 'Course', 'Contouring session', 'Deadline'],
      search: r => [r.title, r.city, r.organiser, r.description].join(' '),
      extra: { initial: 'upcoming', options: [['upcoming', 'Upcoming'], ['past', 'Past']], test: (r, v) => v === 'past' ? !upcoming(r) : upcoming(r) },
      emptyText: emptyMsg('events', 'Know an event residents should attend? <a href="contact.html?topic=Suggest%20an%20event">Tell us</a>.'),
    });
  }

  async function renderOpportunities() {
    if (!$('#opps-list')) return;
    const rows = (await list('opportunities'))
      .filter(o => !o.deadline || o.deadline >= today)
      .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    filterable({
      box: '#opps-list', rows, card: oppCard,
      kinds: ['Job', 'Fellowship', 'Observership', 'Research', 'Scholarship'],
      search: r => [r.title, r.organisation, r.location, r.description].join(' '),
      emptyText: emptyMsg('open opportunities', 'Hiring, or offering an observership? <a href="contact.html?topic=Post%20an%20opportunity">Send it to us</a>.'),
    });
  }

  async function renderResources() {
    if (!$('#res-list')) return;
    const rows = (await list('resources')).sort((a, b) => a.title.localeCompare(b.title));
    filterable({
      box: '#res-list', rows, card: resCard,
      kinds: ['Guideline', 'Contouring atlas', 'Course', 'Exam prep', 'Tool', 'Reading', 'Video'],
      search: r => [r.title, r.description, r.level].join(' '),
      emptyText: emptyMsg('resources', 'Our Academic Society is curating the first set. <a href="contact.html?topic=Suggest%20a%20resource">Suggest one</a>.'),
    });
  }

  async function renderNews() {
    const home = $('#updates-list'), page = $('#news-list');
    if (!home && !page) return;
    const rows = (await list('announcements')).sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (home && rows.length) home.innerHTML = rows.slice(0, 4).map(a => `<a class="ne-item" href="news.html#news-${esc(a.id)}"><span class="ne-date">${fmtDay(a.created_at)}</span><span class="ne-title">${esc(a.title)}</span></a>`).join('');
    if (page) page.innerHTML = rows.length ? rows.map(a => newsCard(a, true)).join('') : '<div class="card empty-state"><b>No news yet.</b><br>Announcements from the founders will appear here.</div>';
    if (page && location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }

  async function renderAmbassadors() {
    const box = $('#ambassadors-list');
    if (!box) return;
    const rows = await list('public_ambassadors');
    if (!rows.length) return;
    const byState = {};
    rows.forEach(r => (byState[r.state || 'Other'] = byState[r.state || 'Other'] || []).push(r));
    box.innerHTML = Object.keys(byState).sort().map(s => `<div class="amb-state card">
      <h3>${esc(s)}</h3>
      <ul>${byState[s].map(r => `<li><b>${esc(r.ambassador_name)}</b><span>${esc(r.institution)}${r.city ? ', ' + esc(r.city) : ''}</span></li>`).join('')}</ul>
    </div>`).join('');
    const count = $('#amb-count');
    if (count) count.textContent = `${rows.length} institution${rows.length === 1 ? '' : 's'} covered so far.`;
    $('#ambassadors').hidden = false;
  }

  // ------------------------------------------------------------------
  // Forms: Supabase when live, Netlify Forms otherwise (and as a fallback)
  // ------------------------------------------------------------------
  function wireForm(selector, table, toRow) {
    const form = $(selector);
    if (!form) return;
    if (!LIVE) {
      const netlify = /netlify\.app$/.test(location.hostname) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
      if (!netlify) form.addEventListener('submit', e => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        let note = form.querySelector('.form-offline');
        if (!note) { form.insertAdjacentHTML('beforeend', '<p class="full form-offline" role="status" style="margin:0;color:var(--accent);font-weight:500">Thank you. This form isn\'t connected yet on our temporary site, so your details weren\'t sent. Please try again soon.</p>'); }
      });
      return;
    }
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (form.company && form.company.value) { location.href = form.getAttribute('action'); return; } // bot trap
      const fd = new FormData(form);
      const val = k => { const v = String(fd.get(k) || '').trim(); return v || null; };
      const btn = form.querySelector('button[type="submit"]');
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        await submit(table, toRow(val, fd));
        location.href = form.getAttribute('action');
      } catch (err) {
        console.warn('Database save failed, falling back to Netlify Forms', err);
        btn.disabled = false; btn.textContent = label;
        HTMLFormElement.prototype.submit.call(form);
      }
    });
  }

  wireForm('form[name="interest"]', 'registrations', (val, fd) => ({
    name: val('name'), email: val('email'), phone: val('phone'), stage: val('stage'),
    institution: val('institution'), state: val('state'), message: val('message'),
    ambassador: fd.get('ambassador') === 'yes', consent: fd.get('consent') === 'yes',
  }));
  wireForm('form[name="contact"]', 'messages', (val, fd) => ({
    name: val('name'), email: val('email'), topic: val('topic'), message: val('message'), consent: fd.get('consent') === 'yes',
  }));

  // Pre-select the contact topic from ?topic=
  const topicSel = $('form[name="contact"] select[name="topic"]');
  const wanted = new URLSearchParams(location.search).get('topic');
  if (topicSel && wanted) [...topicSel.options].forEach(o => { if (o.value === wanted) o.selected = true; });

  // Voting window calculator on the membership page (rules in js/rules.js)
  const calcStart = $('#calc-start');
  if (calcStart && window.ROAR_RULES) {
    const R = window.ROAR_RULES, out = $('#calc-out'), calcEnd = $('#calc-end');
    const calc = () => {
      if (!calcStart.value) { out.textContent = 'Enter your PG start date.'; return; }
      if (calcEnd.value && calcEnd.value <= calcStart.value) { out.textContent = 'The completion date must be after the start date.'; return; }
      const w = R.votingWindow({ pg_start: calcStart.value, pg_completion: calcEnd.value || null });
      const t = R.todayIST();
      const state = t < w.from ? "Your vote hasn't started yet." : t > w.until ? "You have passed the 6-year limit, so you'd join as a non-voting Senior or Honorary Member." : 'You can vote today.';
      out.innerHTML = `You can vote from <b>${fmtDay(w.from)}</b> to <b>${fmtDay(w.until)}</b>${w.estimated ? ' (estimated, assuming a 3-year course)' : ''}. ${esc(state)}`;
    };
    calcStart.addEventListener('input', calc); calcEnd.addEventListener('input', calc);
  }

  // ------------------------------------------------------------------
  if (!LIVE && demo) {
    document.body.insertAdjacentHTML('beforeend', '<div class="preview-banner">Preview: showing demo data from the Founders\' console in this browser. Visitors don\'t see this.</div>');
  }
  Promise.all([renderEvents(), renderOpportunities(), renderResources(), renderNews(), renderAmbassadors()])
    .catch(err => console.warn(err));
})();
