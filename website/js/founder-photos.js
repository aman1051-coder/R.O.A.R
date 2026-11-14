// The Founders' Council, kept up to date from the database:
// * any element with data-founder="FC-02" shows that founder's ROAR Community profile picture;
// * a card with data-founder-card="FC-02" also shows their current name and cabinet role,
//   so a rename in the Founders' console appears on the website without editing the pages.
// Live: schema PARTs 13-14 (public_founders(); only founders' current profile pictures are public).
// Demo: reads the demo founders and Community profiles kept in this browser.
(() => {
  'use strict';
  const cfg = window.ROAR_CONFIG || {};
  let loading = null;
  const shortRole = r => String(r || '').replace(/Additional Secretary/g, 'Addl. Secretary').replace(/\s+[–-]\s+/g, ' · ').replace(/\s*&\s*/g, ' & ');

  function load() {
    if (loading) return loading;
    loading = (async () => {
      const map = {};
      try {
        if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
          const h = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey, 'Content-Type': 'application/json' };
          let rows = await (await fetch(cfg.supabaseUrl + '/rest/v1/rpc/public_founders', { method: 'POST', headers: h, body: '{}' })).json();
          if (!Array.isArray(rows)) rows = await (await fetch(cfg.supabaseUrl + '/rest/v1/rpc/public_founder_photos', { method: 'POST', headers: h, body: '{}' })).json();
          if (!Array.isArray(rows)) return map;
          rows.forEach(r => { map[r.founder_id] = { name: r.name, role: r.cabinet_role }; });
          const paths = rows.map(r => r.avatar_path).filter(Boolean);
          if (paths.length) {
            const signed = await (await fetch(cfg.supabaseUrl + '/storage/v1/object/sign/community', {
              method: 'POST', headers: h, body: JSON.stringify({ expiresIn: 6 * 3600, paths }),
            })).json();
            rows.forEach(r => {
              const s = Array.isArray(signed) ? signed.find(x => x.path === r.avatar_path) : null;
              if (s && s.signedURL) map[r.founder_id].url = cfg.supabaseUrl + '/storage/v1' + s.signedURL;
            });
          }
        } else if (window.ROAR_DEMO_OK) {
          const s = JSON.parse(localStorage.getItem('roar-council-demo-v3') || 'null');
          (s && s.founders || []).forEach(f => {
            const p = s.community && (s.community.profiles || []).find(x => x.id === f.email);
            if (f.founder_id) map[f.founder_id] = { name: f.name, role: f.cabinet_role, url: p && p.avatar_path };
          });
        }
      } catch (e) { console.warn('Founders list unavailable', e); }
      return map;
    })();
    return loading;
  }

  function apply() {
    const pics = [...document.querySelectorAll('[data-founder]:not([data-photo])')];
    const cards = [...document.querySelectorAll('[data-founder-card]:not([data-synced])')];
    if (!pics.length && !cards.length) return;
    pics.forEach(el => el.setAttribute('data-photo', ''));
    cards.forEach(el => el.setAttribute('data-synced', ''));
    load().then(map => {
      pics.forEach(el => {
        const f = map[el.dataset.founder];
        if (!f || !f.url) return;
        const img = new Image();
        img.onload = () => { el.style.backgroundImage = `url("${f.url.replace(/"/g, '%22')}")`; el.classList.add('has-photo'); };
        img.src = f.url;
      });
      cards.forEach(card => {
        const f = map[card.dataset.founderCard];
        if (!f) return;
        const nameEl = card.querySelector('b'), roleEl = card.querySelector('b + span, span');
        if (f.name && nameEl) nameEl.textContent = f.name;
        if (f.role && roleEl && card.dataset.keepRole === undefined) {
          // Keep the page's fuller description when the database role is just the start of it
          const short = shortRole(f.role);
          if (!roleEl.textContent.toLowerCase().startsWith(short.toLowerCase().slice(0, 12))) roleEl.textContent = short;
        }
        const av = card.querySelector('.avatar');
        if (f.name && av && !av.classList.contains('has-photo')) av.textContent = f.name.replace(/^Dr\.?\s*/i, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      });
    });
  }

  const start = () => {
    apply();
    // The console draws its pages after loading, so watch for founders appearing later
    new MutationObserver(() => apply()).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.ROAR_FOUNDER_PHOTOS = { load, apply };
})();
