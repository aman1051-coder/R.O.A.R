// Site-wide search. Opens from the magnifier in the header, or with "/" or Ctrl/Cmd+K.
// Searches every page and section listed below, plus published events, careers, resources and news
// (through window.ROAR_PUBLIC.list from js/public.js, when the page loads it).
// When you add a page or section, add a line to PAGES so people can find it.
(function () {
  'use strict';
  const root = document.body.dataset.root || '';
  const PAGES = [
    ['Home', 'index.html', 'ROAR national community radiation oncology residents young radiation oncologists India mission vision'],
    ['Our mission', 'index.html#mission', 'unity equal exposure IMRT VMAT IGRT SBRT SRS brachytherapy contouring planning education wellbeing dignity'],
    ['Member Welfare Charter', 'index.html#charter', 'working hours stipend index senior resident pay benchmark education standards desk dignity safety dosimetry mental health evidence surveys'],
    ['Roadmap', 'index.html#roadmap', 'first two years registration ambassadors trademark logo survey first election'],
    ['Get involved', 'index.html#join', 'register interest institutional ambassador keep me updated volunteer'],
    ['About ROAR', 'about.html', 'about vision mission objectives'],
    ['Partnerships', 'about.html#partners', 'AROI YROF ICRO association of brachytherapy ESTRO ASTRO FARO MoU collaboration societies'],
    ['Governance', 'about.html#governance', 'general body executive council founders council advisory mentor board first two years election president'],
    ['Leadership & founders', 'about.html#leadership', 'founders cabinet president chairman general secretary additional secretary Aakash Bellige Aman Gupta Kratika Bhatia Shriya Dhingra Deepika Sharma Arshida Pulimala Arsheya Gupta Honey Sharma Abhishek Bhadri'],
    ['Principles', 'about.html#principles', 'independent industry sponsorship audited accounts welfare budget conflict of interest terms'],
    ['Legal status', 'about.html#status', 'registration society societies registration act New Delhi constitution draft'],
    ['Membership', 'membership.html', 'join apply who can join categories resident young radiation oncologist honorary senior mentor'],
    ['Voting window', 'membership.html#calc', 'vote voting rights eligibility calculator PG start completion six years pause clock'],
    ['Membership fees', 'membership.html#fees', 'fees annual lifetime founding member deferred stipend unpaid refund'],
    ['Membership FAQ', 'membership.html#faq', 'questions first year consultant vote after six years stipend unpaid medical oncologist pathologist radiologist refund'],
    ['Events calendar', 'events.html', 'events conferences workshops webinars courses contouring sessions deadlines calendar'],
    ['Careers (members)', 'opportunities.html', 'jobs senior residency consultant fellowships observerships research scholarships hiring career help CV'],
    ['Education (members)', 'learn.html', 'education learning library resources guidelines contouring atlas exam preparation'],
    ['Signature programmes', 'learn.html', 'Contour Club Passport observerships Research Collective Global fellowships abroad Wellbeing minimum exposure standard'],
    ['Welfare & support desks (members)', 'desks.html', 'grievance cell education standards desk dignity at work harassment bullying discrimination POSH anti-ragging confidential Tele-MANAS helpline'],
    ['National survey', 'survey/', 'national survey questionnaire residents training exposure duty hours stipend pay wellbeing burnout careers anonymous'],
    ['Survey questions (review copy)', 'survey/?review=1', 'survey questions preview print review'],
    ['News', 'news.html', 'news announcements updates statements'],
    ['Contact & FAQ', 'contact.html', 'contact email partnership media suggest event post opportunity question'],
    ['ROAR Community (members)', 'portal/#community', 'community social feed posts questions ask answer articles case discussion photos profile username profile picture members network forum discussion'],
    ['Members area: Education', 'portal/#education', 'members education recordings case files contour club sessions members only library'],
    ['Members area: Careers help', 'portal/#careers', 'career help CV review fellowship guidance job search exam preparation observership placement research mentorship mentor'],
    ['Member portal', 'portal/', 'member login sign in apply application membership card ballots vote'],
    ['Privacy', 'privacy.html', 'privacy data personal information delete'],
  ];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

  // Live content, loaded once when search first opens
  let live = null;
  async function loadLive() {
    if (live) return live;
    live = [];
    const api = window.ROAR_PUBLIC;
    if (!api || !api.list) return live;
    try {
      const [ev, op, rs, nw] = await Promise.all(['events', 'opportunities', 'resources', 'announcements'].map(t => api.list(t)));
      ev.forEach(e => live.push({ group: 'Events', title: e.title, url: 'events.html', text: [e.kind, e.city, e.organiser, e.description].join(' '), meta: e.starts_on }));
      op.forEach(o => live.push({ group: 'Careers', title: o.title, url: 'opportunities.html', text: [o.kind, o.organisation, o.location, o.description].join(' '), meta: o.organisation }));
      rs.forEach(r => live.push({ group: 'Education', title: r.title, url: 'learn.html', text: [r.kind, r.level, r.description].join(' '), meta: r.kind }));
      nw.forEach(n => live.push({ group: 'News', title: n.title, url: 'news.html#news-' + n.id, text: n.body, meta: String(n.created_at).slice(0, 10) }));
    } catch (e) { /* search still works on pages */ }
    return live;
  }

  function score(item, terms) {
    const t = norm(item.title), x = norm(item.text);
    let s = 0;
    for (const w of terms) {
      if (t.includes(w)) s += t.startsWith(w) ? 6 : 4;
      else if (x.includes(w)) s += 1;
      else return 0;           // every word must match somewhere
    }
    return s;
  }

  // ---- UI ----
  const dlg = document.createElement('dialog');
  dlg.className = 'search-dialog';
  dlg.setAttribute('aria-label', 'Search ROAR');
  dlg.innerHTML = `
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="search" placeholder="Search ROAR: membership, events, contouring, welfare…" aria-label="Search the site" autocomplete="off">
      <kbd>Esc</kbd>
    </div>
    <div class="search-results" role="listbox" aria-label="Results"></div>
    <div class="search-foot">Tip: press <kbd>/</kbd> anywhere to search.</div>`;
  document.body.appendChild(dlg);
  const input = dlg.querySelector('input'), box = dlg.querySelector('.search-results');
  let active = -1, shown = [];

  const SUGGEST = ['Voting window', 'Membership fees', 'Events calendar', 'National survey', 'Partnerships', 'Member portal'];
  async function draw() {
    const q = norm(input.value).trim();
    const terms = q.split(/\s+/).filter(Boolean);
    let groups = [];
    if (!terms.length) {
      groups = [['Popular', PAGES.filter(p => SUGGEST.includes(p[0])).map(p => ({ title: p[0], url: p[1] }))]];
    } else {
      const pages = PAGES.map(p => ({ title: p[0], url: p[1], text: p[2], s: score({ title: p[0], text: p[2] }, terms) })).filter(p => p.s).sort((a, b) => b.s - a.s).slice(0, 8);
      const items = (await loadLive()).map(i => ({ ...i, s: score(i, terms) })).filter(i => i.s).sort((a, b) => b.s - a.s);
      groups = [['Pages', pages]];
      ['Events', 'Careers', 'Education', 'News'].forEach(g => groups.push([g, items.filter(i => i.group === g).slice(0, 5)]));
      groups = groups.filter(g => g[1].length);
    }
    shown = groups.flatMap(g => g[1]);
    active = shown.length ? 0 : -1;
    box.innerHTML = shown.length ? groups.map(([g, list]) => `<div class="sr-group">${esc(g)}</div>` + list.map(i =>
      `<a class="sr-item" role="option" href="${esc(root + i.url)}"><span class="sr-title">${esc(i.title)}</span>${i.meta ? `<span class="sr-meta">${esc(i.meta)}</span>` : ''}</a>`).join('')).join('')
      : `<div class="sr-empty">No results for “${esc(input.value)}”. Try a broader word, or <a href="${root}contact.html">ask us</a>.</div>`;
    highlight();
  }
  function highlight() {
    box.querySelectorAll('.sr-item').forEach((a, i) => { a.classList.toggle('on', i === active); a.setAttribute('aria-selected', i === active); });
    const el = box.querySelectorAll('.sr-item')[active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function open() {
    if (dlg.open) return;
    dlg.showModal(); input.value = ''; draw(); input.focus();
  }
  input.addEventListener('input', draw);
  input.addEventListener('keydown', e => {
    const items = box.querySelectorAll('.sr-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); highlight(); }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); items[active].click(); }
  });
  box.addEventListener('click', e => { if (e.target.closest('.sr-item')) dlg.close(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // click outside the panel

  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); open(); }
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-search-open]')) open(); });
  window.ROAR_SEARCH = { open };
})();
