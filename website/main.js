// Mobile menu
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

// "Become an Ambassador" button pre-ticks the ambassador box
document.querySelectorAll('[data-ambassador]').forEach(btn =>
  btn.addEventListener('click', () => { const box = document.getElementById('ambassador'); if (box) box.checked = true; })
);

// "Create an account" buttons open the portal on its sign-up tab
document.addEventListener('click', e => { if (e.target.closest('[data-signup]')) { try { sessionStorage.setItem('roar-signup', '1'); } catch (err) { } } });

// Current year in footer
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

// True liquid refraction (SVG filter in backdrop-filter) is only reliable in Chromium browsers
if (navigator.userAgentData && navigator.userAgentData.brands.some(b => /Chrom/.test(b.brand))) {
  document.documentElement.classList.add('liquid-ok');
}

// Specular sheen: each glass panel lights up where the pointer is
const glassSel = '.card, .programme, .fee, .window, .person, .roadmap > li, .form, .hero-panel, .problem blockquote';
if (window.matchMedia('(hover: hover)').matches) {
  document.addEventListener('pointermove', e => {
    const el = e.target.closest && e.target.closest(glassSel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
}

// Scroll reveal
const revealTargets = document.querySelectorAll('.section-head, .cards > *, .people > *, .roadmap > li, .fees > *, .who > *, .programmes > *, .window, .table-scroll, .problem-grid > *, .split > *, .join-grid > *');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealTargets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = (i % 3) * 80 + 'ms';
    io.observe(el);
  });
}
