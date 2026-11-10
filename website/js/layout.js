// Shared header, footer and background for every public page.
// Edit the menu here once and every page updates.
// Each page has <body data-page="..."> plus empty #site-header and #site-footer placeholders.
(function () {
  // Top-level menu items. Each item links to its page; "items" become its dropdown.
  const NAV = [
    { key: 'about', label: 'About', href: 'about.html', items: [
      ['Overview', 'about.html', 'Who we are and what we stand for'],
      ['Vision & mission', 'about.html#vision', 'What ROAR is working towards'],
      ['Governance', 'about.html#governance', 'How ROAR is run and decisions are made'],
      ['Leadership', 'about.html#leadership', "The Founders' Council and first cabinet"],
      ['Partnerships', 'about.html#partners', 'Working with national and international societies'],
      ['Principles', 'about.html#principles', 'Independence, transparency and accountability'],
      ['National survey', 'survey/', 'The anonymous national survey of radiation oncologists'],
    ] },
    { key: 'membership', label: 'Membership', href: 'membership.html', items: [
      ['Who can join', 'membership.html#categories', 'Membership categories and voting'],
      ['Your voting window', 'membership.html#calc', 'Check when you can vote'],
      ['How to join', 'membership.html#join-steps', 'Four steps, all online'],
      ['Fees', 'membership.html#fees', 'Annual, lifetime and founding membership'],
      ['FAQ', 'membership.html#faq', 'Common questions about membership'],
      ['Member portal', 'portal/', 'Apply, sign in, vote in ballots'],
    ] },
    { key: 'events', label: 'Events', href: 'events.html' },
    // Members' sections: the pages are short previews; the content is in the member portal
    { key: 'community', label: 'Community', href: 'portal/#community', members: true },
    { key: 'learn', label: 'Education', href: 'learn.html', members: true },
    { key: 'opportunities', label: 'Careers', href: 'opportunities.html', members: true },
    { key: 'desks', label: 'Welfare', href: 'desks.html', members: true },
    { key: 'news', label: 'News', href: 'news.html' },
  ];
  const page = document.body.dataset.page || '';
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

  const header = document.getElementById('site-header');
  if (header) header.outerHTML = `
    <header class="site-header">
      <div class="bar">
        <a class="brand" href="${root}index.html" aria-label="ROAR home">
          <img class="brand-mark" src="${root}favicon.svg" alt=""><span class="brand-word">ROAR</span>
        </a>
        <nav class="quick-links" aria-label="Sections">
          ${NAV.map(n => `<a href="${root}${n.href}"${n.key === page ? ' aria-current="page" class="active"' : ''}>${n.label}${n.members ? '<svg class="nav-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' : ''}</a>`).join('')}
        </nav>
        <nav class="nav" id="nav" aria-label="Main">
          ${NAV.map((n, i) => !n.items
            ? `<a href="${root}${n.href}"${n.key === page ? ' aria-current="page" class="active"' : ''}${n.members ? ' title="For members: sign in to use"' : ''}>${n.label}${n.members ? '<svg class="nav-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span class="sr-only"> (members)</span>' : ''}</a>`
            : `<div class="nav-group${n.key === page ? ' current' : ''}">
                <a href="${root}${n.href}" class="nav-top${n.key === page ? ' active' : ''}"${n.key === page ? ' aria-current="page"' : ''}>${n.label}</a>
                <button class="nav-caret" type="button" aria-expanded="false" aria-controls="dd-${i}" aria-label="Show ${n.label} pages"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
                <div class="dropdown" id="dd-${i}" role="group" aria-label="${n.label}">
                  ${n.items.map(([t, h, d]) => `<a href="${root}${h}"><b>${t}</b><span>${d}</span></a>`).join('')}
                </div>
              </div>`).join('')}
          <a href="${root}portal/"${page === 'portal' ? ' aria-current="page" class="active"' : ''}>Member login</a>
          <a class="btn btn-primary" href="${root}membership.html">Join</a>
        </nav>
        <div class="header-tools">
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
          <a class="brand" href="${root}index.html" style="color:#fff"><img class="brand-mark" src="${root}favicon.svg" alt=""><span class="brand-word">ROAR</span></a>
          <p style="margin-top:14px">Rising Oncologists' Alliance in Radiation Oncology, India. A national, non-profit, non-political professional body for the young generation of radiation oncologists.</p>
        </div>
        <div>
          <h3>ROAR</h3>
          <ul>
            <li><a href="${root}about.html">About &amp; governance</a></li>
            <li><a href="${root}index.html#charter">Member Welfare Charter</a></li>
            <li><a href="${root}membership.html">Membership</a></li>
            <li><a href="${root}news.html">News</a></li>
            <li><a href="${root}survey/">National survey</a></li>
          </ul>
        </div>
        <div>
          <h3>For members</h3>
          <ul>
            <li><a href="${root}events.html">Events calendar</a></li>
            <li><a href="${root}opportunities.html">Careers &amp; fellowships</a></li>
            <li><a href="${root}portal/#community">ROAR Community</a></li>
            <li><a href="${root}learn.html">Learning library</a></li>
            <li><a href="${root}desks.html">Member welfare</a></li>
            <li><a href="${root}portal/">Member login</a></li>
          </ul>
        </div>
        <div>
          <h3>Contact</h3>
          <ul>
            <li><a href="${root}contact.html">Contact &amp; FAQ</a></li>
            <!-- TODO: replace with ROAR's social links once created -->
            <li><a href="#" data-todo>Instagram</a></li>
            <li><a href="#" data-todo>LinkedIn</a></li>
            <li><a href="${root}council/">Founders' login</a></li>
          </ul>
        </div>
        <div class="footer-base">ROAR is in the process of registration as a Society. An independent, non-profit professional body. · <a href="${root}privacy.html">Privacy</a> · © ${new Date().getFullYear()} ROAR</div>
      </div>
    </footer>`;

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
