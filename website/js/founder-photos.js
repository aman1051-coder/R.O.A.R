// Founders' photos: wherever a founder is shown (an element with data-founder="FC-02"), use the profile
// picture that founder uploaded to ROAR Community, in place of their initials.
// Live: schema PART 13 lets anyone read only the founders' profile pictures (public_founder_photos()).
// Demo: reads the demo Community profiles kept in this browser.
(() => {
  'use strict';
  const cfg = window.ROAR_CONFIG || {};
  let loading = null;

  function load() {
    if (loading) return loading;
    loading = (async () => {
      const map = {};
      try {
        if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
          const h = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey, 'Content-Type': 'application/json' };
          const rows = await (await fetch(cfg.supabaseUrl + '/rest/v1/rpc/public_founder_photos', { method: 'POST', headers: h, body: '{}' })).json();
          if (!Array.isArray(rows) || !rows.length) return map;
          const signed = await (await fetch(cfg.supabaseUrl + '/storage/v1/object/sign/community', {
            method: 'POST', headers: h, body: JSON.stringify({ expiresIn: 6 * 3600, paths: rows.map(r => r.avatar_path) }),
          })).json();
          rows.forEach(r => {
            const s = Array.isArray(signed) ? signed.find(x => x.path === r.avatar_path) : null;
            if (s && s.signedURL) map[r.founder_id] = cfg.supabaseUrl + '/storage/v1' + s.signedURL;
          });
        } else if (window.ROAR_DEMO_OK) {
          const s = JSON.parse(localStorage.getItem('roar-council-demo-v3') || 'null');
          if (s && s.community) (s.founders || []).forEach(f => {
            const p = (s.community.profiles || []).find(x => x.id === f.email);
            if (p && p.avatar_path && f.founder_id) map[f.founder_id] = p.avatar_path;
          });
        }
      } catch (e) { console.warn('Founder photos unavailable', e); }
      return map;
    })();
    return loading;
  }

  function apply(scope) {
    const els = [...(scope || document).querySelectorAll('[data-founder]:not([data-photo])')];
    if (!els.length) return;
    els.forEach(el => el.setAttribute('data-photo', ''));
    load().then(map => els.forEach(el => {
      const url = map[el.dataset.founder];
      if (!url) return;
      const img = new Image();
      img.onload = () => { el.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`; el.classList.add('has-photo'); };
      img.src = url;
    }));
  }

  const start = () => {
    apply();
    // The console draws its pages after loading, so watch for founders appearing later
    new MutationObserver(() => apply()).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.ROAR_FOUNDER_PHOTOS = { load, apply };
})();
