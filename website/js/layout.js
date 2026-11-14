// Shared header, footer and background for every public page.
// Edit the menu here once and every page updates.
// Each page has <body data-page="..."> plus empty #site-header and #site-footer placeholders.
(function () {
  // Top-level menu items. Each item links to its page; "items" become its dropdown.
  const page = document.body.dataset.page || '';
  // Seven areas, like the big professional bodies (ESTRO, ASTRO, RCR). "pages" lists the pages that light the item up.
  const NAV = [
    { key: 'about', label: 'About', href: 'about.html', pages: ['about', 'news', 'contact'], items: [
      ['Who we are', 'about.html', 'Our vision, mission and principles'],
      ['Governance', 'about.html#governance', 'How ROAR is run and decisions are made'],
      ['Leadership', 'about.html#leadership', "The Founders' Council and first cabinet"],
      ['Partnerships', 'about.html#partners', 'Working with national and international societies'],
      ['News', 'news.html', 'Announcements and updates'],
      ['Contact', 'contact.html', 'Questions, partnerships and media'],
    ] },
    { key: 'membership', label: 'Membership', href: 'membership.html', pages: ['membership', 'portal'], items: [
      ['Why join', 'membership.html', 'What membership gives you'],
      ['Who can join', 'membership.html#categories', 'Categories, voting and your voting window'],
      ['Fees', 'membership.html#fees', 'Annual, lifetime and founding membership'],
      ['How to join', 'membership.html#join-steps', 'Four steps, all online'],
      ['FAQ', 'membership.html#faq', 'Common questions about membership'],
      ['My ROAR', 'portal/', 'Your dashboard, card, ballots and settings'],
    ] },
    { key: 'learn', label: 'Education', href: 'learn.html', pages: ['learn', 'events', 'certificate'], items: [
      ['Programmes', 'learn.html', 'Contour Club, Passport, members\' sessions'],
      ['Events calendar', 'events.html', 'Conferences, courses, webinars and deadlines'],
      ['Learning library', 'portal/#learning', 'Guidelines, atlases and exam preparation'],
      ['CME and certificates', 'portal/#learning', 'Check in to sessions and keep your CME log'],
      ['Check a certificate', 'certificate.html', 'Confirm that a ROAR certificate is genuine'],
    ] },
    { key: 'opportunities', label: 'Careers', href: 'opportunities.html', pages: ['opportunities', 'mentorship'], items: [
      ['Jobs and fellowships', 'opportunities.html', 'Posts, fellowships and observerships'],
      ['Mentorship', 'mentorship.html', 'One-to-one help from experienced colleagues'],
      ['Career help', 'portal/#careers', 'CV review, fellowship and contract advice'],
      ['Job alerts', 'portal/#settings', 'An email when a matching opening is posted'],
    ] },
    { key: 'desks', label: 'Welfare', href: 'desks.html', pages: ['desks', 'survey'], items: [
      ['Member Welfare Charter', 'desks.html', 'Our promise to every member'],
      ['Support desks', 'desks.html#members', 'Confidential help with training and work'],
      ['National survey', 'survey/', 'The anonymous national survey'],
      ['Need help now?', 'desks.html', 'Tele-MANAS 14416, free and 24-hour'],
    ] },
    { key: 'research', label: 'Research', href: 'research.html', pages: ['research'] },
    { key: 'community', label: 'Community', href: 'community.html', pages: ['community'] },
  ];
  const isCur = n => (n.pages || [n.key]).includes(page);
  const root = document.body.dataset.root || '';   // '../' for pages inside a subfolder, e.g. /portal/

  // Background canvas and the liquid-glass refraction filter
  document.body.insertAdjacentHTML('afterbegin', `
    <a class="skip-link" href="#main">Skip to content</a>
    <canvas id="bg-shader" aria-hidden="true"></canvas>
    <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
      <filter id="liquid-refract" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise"/>
        <feGaussianBlur in="noise" stdDeviation="2" result="soft"/>
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="38" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </svg>`);

  // ROAR logo: the O is a linac gantry, with five weighted beams converging on the isocentre.
  // Letters follow the text colour, so the same logo works in the light and dark themes.
  // Source files (for print and social media) are in assets/logo/.
  const LOGO = `<svg class="logo-svg" viewBox="-6 -56 880 282" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M0 0H106A64 64 0 0 1 132 122L176 200H124L84 128H46V200H0ZM46 44H104A20 20 0 0 1 104 84H46ZM465 200L539 0H591L665 200H615L600 158H530L515 200ZM544 118H586L565 58ZM691 0H797A64 64 0 0 1 823 122L867 200H815L775 128H737V200H691ZM737 44H795A20 20 0 0 1 795 84H737Z"/><path d="M320 -8L331 -47L295 -47L306 -8Z" fill="#e8792b" fill-opacity="1.0"/><path d="M421 107L460 118L460 82L421 93Z" fill="#e8792b" fill-opacity="0.9"/><path d="M205 93L166 82L166 118L205 107Z" fill="#e8792b" fill-opacity="0.9"/><path d="M377.06 187.23L393.7 224.18L421.28 201.04L387.78 178.23Z" fill="#e8792b" fill-opacity="0.62"/><path d="M238.22 178.23L204.72 201.04L232.3 224.18L248.94 187.23Z" fill="#e8792b" fill-opacity="0.62"/><path fill="currentColor" fill-rule="evenodd" d="M211 100a102 102 0 1 0 204 0a102 102 0 1 0-204 0ZM251 100a62 62 0 1 0 124 0a62 62 0 1 0-124 0Z"/><path d="M314 85L318 43L308 43L312 85Z" fill="#e8792b" fill-opacity="1"/><path d="M328 101L370 105L370 95L328 99Z" fill="#e8792b" fill-opacity="1"/><path d="M298 99L256 95L256 105L298 101Z" fill="#e8792b" fill-opacity="1"/><path d="M321.88 112.13L345.81 146.88L353.47 140.45L323.41 110.85Z" fill="#e8792b" fill-opacity="0.72"/><path d="M302.59 110.85L272.53 140.45L280.19 146.88L304.12 112.13Z" fill="#e8792b" fill-opacity="0.72"/><circle cx="313" cy="100" r="31" fill="none" stroke="#e8792b" stroke-opacity=".45" stroke-width="2.5" stroke-dasharray="5 6"/><path d="M289 100H337M313 76V124" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><circle cx="313" cy="100" r="10" fill="#e8792b"/></svg>`;
  const LOGO_FULL = `<svg class="logo-svg" viewBox="-6 -56 880 440" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M0 0H106A64 64 0 0 1 132 122L176 200H124L84 128H46V200H0ZM46 44H104A20 20 0 0 1 104 84H46ZM465 200L539 0H591L665 200H615L600 158H530L515 200ZM544 118H586L565 58ZM691 0H797A64 64 0 0 1 823 122L867 200H815L775 128H737V200H691ZM737 44H795A20 20 0 0 1 795 84H737Z"/><path d="M320 -8L331 -47L295 -47L306 -8Z" fill="#e8792b" fill-opacity="1.0"/><path d="M421 107L460 118L460 82L421 93Z" fill="#e8792b" fill-opacity="0.9"/><path d="M205 93L166 82L166 118L205 107Z" fill="#e8792b" fill-opacity="0.9"/><path d="M377.06 187.23L393.7 224.18L421.28 201.04L387.78 178.23Z" fill="#e8792b" fill-opacity="0.62"/><path d="M238.22 178.23L204.72 201.04L232.3 224.18L248.94 187.23Z" fill="#e8792b" fill-opacity="0.62"/><path fill="currentColor" fill-rule="evenodd" d="M211 100a102 102 0 1 0 204 0a102 102 0 1 0-204 0ZM251 100a62 62 0 1 0 124 0a62 62 0 1 0-124 0Z"/><path d="M314 85L318 43L308 43L312 85Z" fill="#e8792b" fill-opacity="1"/><path d="M328 101L370 105L370 95L328 99Z" fill="#e8792b" fill-opacity="1"/><path d="M298 99L256 95L256 105L298 101Z" fill="#e8792b" fill-opacity="1"/><path d="M321.88 112.13L345.81 146.88L353.47 140.45L323.41 110.85Z" fill="#e8792b" fill-opacity="0.72"/><path d="M302.59 110.85L272.53 140.45L280.19 146.88L304.12 112.13Z" fill="#e8792b" fill-opacity="0.72"/><circle cx="313" cy="100" r="31" fill="none" stroke="#e8792b" stroke-opacity=".45" stroke-width="2.5" stroke-dasharray="5 6"/><path d="M289 100H337M313 76V124" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><circle cx="313" cy="100" r="10" fill="#e8792b"/><rect x="0" y="262" width="867" height="5" rx="2.5" fill="currentColor"/><text x="434" y="326" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-weight="500" font-size="31" letter-spacing="7.4" fill="currentColor" text-anchor="middle">RISING ONCOLOGISTS’ ALLIANCE</text><text x="434" y="372" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-weight="500" font-size="31" letter-spacing="7.4" fill="currentColor" text-anchor="middle">IN RADIATION ONCOLOGY · INDIA</text></svg>`;
  const FULL_NAME = "ROAR: Rising Oncologists' Alliance in Radiation Oncology";

  const header = document.getElementById('site-header');
  if (header) header.outerHTML = `
    <header class="site-header">
      <div class="bar">
        <a class="brand" href="${root}index.html" aria-label="${FULL_NAME}, home" title="Rising Oncologists' Alliance in Radiation Oncology">${LOGO}</a>
        <nav class="quick-links" aria-label="Sections">
          ${NAV.map(n => `<a href="${root}${n.href}"${isCur(n) ? ' aria-current="page" class="active"' : ''}>${n.label}${n.members ? '<svg class="nav-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' : ''}</a>`).join('')}
        </nav>
        <nav class="nav" id="nav" aria-label="Main">
          ${NAV.map((n, i) => !n.items
            ? `<a href="${root}${n.href}"${isCur(n) ? ' aria-current="page" class="active"' : ''}${n.members ? ' title="For members: sign in to use"' : ''}>${n.label}${n.members ? '<svg class="nav-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span class="sr-only"> (members)</span>' : ''}</a>`
            : `<div class="nav-group${isCur(n) ? ' current' : ''}">
                <a href="${root}${n.href}" class="nav-top${isCur(n) ? ' active' : ''}"${isCur(n) ? ' aria-current="page"' : ''}>${n.label}</a>
                <button class="nav-caret" type="button" aria-expanded="false" aria-controls="dd-${i}" aria-label="Show ${n.label} pages"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
                <div class="dropdown" id="dd-${i}" role="group" aria-label="${n.label}">
                  ${n.items.map(([t, h, d]) => `<a href="${root}${h}"><b>${t}</b><span>${d}</span></a>`).join('')}
                </div>
              </div>`).join('')}
          <a href="${root}portal/" data-guest>Sign in</a>
          <a class="btn btn-primary" href="${root}membership.html" data-guest>Join</a>
        </nav>
        <div class="header-tools">
          <div class="acct" id="acct" hidden></div>
          <button class="theme-toggle" type="button" data-search-open aria-label="Search the site" title="Search (/)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></button>
          <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch between light and dark theme" title="Light / dark theme"><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
          <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="nav">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        </div>
      </div>
    </header>`;

  const footer = document.getElementById('site-footer');
  if (footer) footer.outerHTML = `
    <footer class="site-footer">
      <div class="wrap">
        <div>
          <a class="brand brand-full" href="${root}index.html" aria-label="${FULL_NAME}, home">${LOGO_FULL}</a>
          <p style="margin-top:18px">A national, non-profit, non-political professional body for the young generation of radiation oncologists in India.</p>
        </div>
        <div>
          <h3>ROAR</h3>
          <ul>
            <li><a href="${root}about.html">Who we are</a></li>
            <li><a href="${root}about.html#governance">Governance &amp; leadership</a></li>
            <li><a href="${root}research.html">Research Collective</a></li>
            <li><a href="${root}news.html">News</a></li>
            <li><a href="${root}survey/">National survey</a></li>
          </ul>
        </div>
        <div>
          <h3>Members</h3>
          <ul>
            <li><a href="${root}membership.html">Membership</a></li>
            <li><a href="${root}portal/">My ROAR</a></li>
            <li><a href="${root}learn.html">Education &amp; events</a></li>
            <li><a href="${root}opportunities.html">Careers</a> &amp; <a href="${root}mentorship.html">mentorship</a></li>
            <li><a href="${root}desks.html">Welfare</a></li>
            <li><a href="${root}community.html">ROAR Community</a></li>
          </ul>
        </div>
        <div>
          <h3>Contact</h3>
          <ul>
            <li><a href="${root}contact.html">Contact &amp; FAQ</a></li>
            <li><a href="${root}certificate.html">Check a certificate</a></li>
            <!-- TODO: replace with ROAR's social links once created -->
            <li><a href="#" data-todo>Instagram</a></li>
            <li><a href="#" data-todo>LinkedIn</a></li>
            <li><a href="${root}council/">Founders' console</a></li>
          </ul>
        </div>
        <div class="footer-base">ROAR is in the process of registration as a Society. An independent, non-profit professional body. · <a href="${root}privacy.html">Privacy</a> · © ${new Date().getFullYear()} ROAR</div>
      </div>
    </footer>`;

  // ---- One account for the whole site ----
  // The member portal, ROAR Community and the Founders' console share one sign-in (the same Supabase session),
  // so once someone signs in anywhere, every page shows their account menu instead of "Member login".
  const ACCT_ICON = {
    portal: '<path d="M4 20V8l8-5 8 5v12"/><path d="M9 20v-6h6v6"/>',
    community: '<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.8A8.5 8.5 0 1 1 21 11.5z"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    console: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
    out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  };
  const authKey = cfg => { try { return 'sb-' + new URL(cfg.supabaseUrl).hostname.split('.')[0] + '-auth-token'; } catch (e) { return null; } };
  function siteAccount() {
    const cfg = window.ROAR_CONFIG || {};
    let email = null, session = null;
    try {
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        session = JSON.parse(localStorage.getItem(authKey(cfg)) || 'null');
        const u = session && (session.user || (session.currentSession && session.currentSession.user));
        if (u && session.refresh_token) email = String(u.email || '').toLowerCase();
      } else if (window.ROAR_DEMO_OK) {
        const d = JSON.parse(localStorage.getItem('roar-portal-demo-user') || 'null');
        if (d && d.email) email = d.email.toLowerCase();
      }
    } catch (e) { }
    if (!email) return null;
    let me = {};
    try { me = JSON.parse(localStorage.getItem('roar-me') || '{}') || {}; } catch (e) { }
    if (me.email !== email) me = { email };
    const fd = '@' + (cfg.founderLoginDomain || 'founders.roar.invalid');
    if (email.endsWith(fd)) { me.founder = true; me.login = email.slice(0, -fd.length); }
    me.session = session;
    return me;
  }
  async function siteSignOut() {
    const cfg = window.ROAR_CONFIG || {};
    const me = siteAccount();
    try {
      if (me && me.session && me.session.access_token) {
        await fetch(cfg.supabaseUrl + '/auth/v1/logout', { method: 'POST', headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + me.session.access_token } });
      }
    } catch (e) { }
    try { [authKey(cfg), 'roar-me', 'roar-portal-demo-user', 'roar-council-demo-user'].forEach(k => k && localStorage.removeItem(k)); } catch (e) { }
    location.href = root + 'index.html';
  }
  const escA = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let acctWired = false;
  function drawAccount() {
    const box = document.getElementById('acct'); if (!box) return;
    const me = siteAccount();
    document.querySelectorAll('[data-guest]').forEach(a => { a.hidden = !!me; });
    if (!me) { box.hidden = true; box.innerHTML = ''; return; }
    const name = me.name || me.login || me.email.split('@')[0];
    const ini = String(name).replace(/^dr\.?\s+/i, '').split(/[\s.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    const item = (href, icon, label) => `<a href="${href}" role="menuitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ACCT_ICON[icon]}</svg>${label}</a>`;
    box.hidden = false;
    box.innerHTML = `<button type="button" class="acct-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Your account: ${escA(name)}">
        <span class="acct-av${me.avatar ? ' has-photo' : ''}"${me.avatar ? ` style="background-image:url('${escA(me.avatar)}')"` : ''}>${me.avatar ? '' : escA(ini || '?')}</span></button>
      <div class="acct-menu" role="menu" hidden>
        <div class="acct-who"><b>${escA(name)}</b><small>${me.founder ? "Founders' Council" + (me.founder_id ? ' · ' + escA(me.founder_id) : '') : me.username ? '@' + escA(me.username) : escA(me.email)}</small></div>
        ${item(root + 'portal/', 'portal', "Members' area")}
        ${item(root + 'portal/#community', 'community', 'Community')}
        ${me.username ? item(root + 'portal/#community/u/' + encodeURIComponent(me.username), 'profile', 'My profile') : ''}
        ${me.founder ? item(root + 'council/', 'console', "Founders' console") : ''}
        <button type="button" role="menuitem" data-acct-out><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ACCT_ICON.out}</svg>Sign out</button>
      </div>`;
    const btn = box.querySelector('.acct-btn'), menu = box.querySelector('.acct-menu');
    btn.addEventListener('click', e => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
    box.querySelector('[data-acct-out]').addEventListener('click', siteSignOut);
    if (!acctWired) {
      acctWired = true;
      const close = () => { const m = box.querySelector('.acct-menu'), b = box.querySelector('.acct-btn'); if (m && !m.hidden) { m.hidden = true; b.setAttribute('aria-expanded', 'false'); return true; } };
      document.addEventListener('click', e => { if (!box.contains(e.target)) close(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && close()) box.querySelector('.acct-btn').focus(); });
    }
  }
  // config.js loads after this file, so wait for the page's scripts before reading the session
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', drawAccount); else setTimeout(drawAccount, 0);
  window.addEventListener('storage', e => { if (!e.key || /auth-token|roar-me|demo-user/.test(e.key)) drawAccount(); });
  window.ROAR_ACCOUNT = { refresh: drawAccount, signOut: siteSignOut, current: siteAccount };

  const ql = document.querySelector('.quick-links .active');
  if (ql) ql.scrollIntoView({ block: 'nearest', inline: 'center' });

  // Dropdowns: open on hover/focus (desktop, via CSS) or with the caret button (touch, keyboard, phone menu)
  const groups = [...document.querySelectorAll('.nav-group')];
  const closeAll = except => groups.forEach(g => { if (g !== except) { g.classList.remove('open'); g.querySelector('.nav-caret').setAttribute('aria-expanded', 'false'); } });
  groups.forEach(g => {
    const btn = g.querySelector('.nav-caret');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = !g.classList.contains('open');
      closeAll(g);
      g.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.nav-group')) closeAll(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const g = groups.find(x => x.classList.contains('open'));
    if (g) { closeAll(); g.querySelector('.nav-caret').focus(); }
  });

  // Site-wide search (js/search.js)
  const sc = document.createElement('script');
  sc.src = root + 'js/search.js';
  document.body.appendChild(sc);

  // Social links are placeholders until the accounts exist: hide them rather than show dead links
  document.querySelectorAll('[data-todo]').forEach(a => a.parentElement.remove());
})();

// ---- Back to top (long public pages), and the installable app (service worker)
(() => {
  const page = document.body.dataset.page || '';
  if (!/^(portal|council)$/.test(page)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'to-top'; b.setAttribute('aria-label', 'Back to top'); b.hidden = true;
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
    document.body.appendChild(b);
    let ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => { b.hidden = scrollY < innerHeight * 1.2; ticking = false; });
    }, { passive: true });
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', () => navigator.serviceWorker.register((document.body.dataset.root || '') + 'sw.js').catch(() => { }));
  }
})();
