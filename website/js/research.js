// Research Collective: published projects for everyone; signed-in members can express interest.
(() => {
  'use strict';
  const box = document.getElementById('research-projects');
  if (!box) return;
  const SB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STATUS = { proposed: 'Proposed', recruiting: 'Recruiting sites', ongoing: 'Under way', completed: 'Completed', published: 'Published' };
  const loadScript = src => new Promise((res, rej) => { if (window.supabase) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  let projects = [], mine = new Set(), sb = null, uid = null;

  async function load() {
    const cfg = window.ROAR_CONFIG || {};
    if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
      const h = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey };
      const r = await fetch(cfg.supabaseUrl + '/rest/v1/research_projects?select=*&published=eq.true&order=created_at.desc', { headers: h });
      projects = r.ok ? await r.json() : [];
      if (window.ROAR_ACCOUNT && window.ROAR_ACCOUNT.current()) {
        await loadScript(SB_URL);
        sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        const { data } = await sb.auth.getSession();
        if (data.session) {
          uid = data.session.user.id;
          const { data: rows } = await sb.from('research_interest').select('project_id').eq('user_id', uid);
          mine = new Set((rows || []).map(x => x.project_id));
        }
      }
    } else if (window.ROAR_DEMO_OK) {
      const s = JSON.parse(localStorage.getItem('roar-council-demo-v3') || 'null') || {};
      projects = (s.research_projects || []).filter(p => p.published);
      const me = window.ROAR_ACCOUNT && window.ROAR_ACCOUNT.current();
      if (me) { uid = me.email; mine = new Set((s.research_interest || []).filter(x => x.user_id === uid).map(x => x.project_id)); }
    }
  }

  function draw() {
    if (!projects.length) {
      box.innerHTML = `<div class="card"><h3>The first projects are being prepared</h3><p>The Research Society will list multi-centre projects here. Have an idea? <a href="contact.html?topic=Research%20proposal">Propose a project</a>.</p></div>`;
      return;
    }
    box.innerHTML = projects.map(p => `<article class="card research-item" data-id="${esc(p.id)}">
      <div class="meta-row"><span class="tag">${esc(STATUS[p.status] || p.status)}</span>${p.area ? `<span class="tag tag-quiet">${esc(p.area)}</span>` : ''}${p.sites_wanted ? `<span class="tag tag-quiet">${esc(p.sites_wanted)} sites wanted</span>` : ''}</div>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.summary)}</p>
      ${p.lead ? `<p class="event-when">Lead: ${esc(p.lead)}</p>` : ''}
      <div class="event-links">
        ${/^https?:\/\//.test(p.link_url || '') ? `<a class="more" href="${esc(p.link_url)}" target="_blank" rel="noopener">Protocol and details ↗</a>` : ''}
        ${['proposed', 'recruiting', 'ongoing'].includes(p.status) ? (mine.has(p.id) ? '<span class="tag tag-roar">You expressed interest</span>'
          : uid ? '<button type="button" class="btn btn-primary small" data-interest>I\'d like to take part</button>'
          : '<a class="btn btn-glass small" href="portal/">Sign in to take part</a>') : ''}
      </div>
      <form class="research-form pform" hidden>
        <div class="row"><div><label>Your name</label><input name="name" required minlength="2" maxlength="120"></div><div><label>Institution</label><input name="institution" maxlength="200"></div></div>
        <div class="row one"><div><label>How you'd like to help</label><input name="role" maxlength="120" placeholder="e.g. Site lead, data collection, statistics"></div></div>
        <div class="row one"><div><label>Message (optional)</label><textarea name="message" rows="3" maxlength="1500"></textarea></div></div>
        <button class="btn btn-primary small" type="submit">Send</button><p class="msg" role="status"></p>
      </form>
    </article>`).join('');
    box.querySelectorAll('[data-interest]').forEach(b => b.addEventListener('click', () => {
      const f = b.closest('.research-item').querySelector('form'); f.hidden = !f.hidden;
      const me = window.ROAR_ACCOUNT && window.ROAR_ACCOUNT.current();
      if (me && me.name && !f.elements['name'].value) f.elements['name'].value = me.name;
      if (!f.hidden) f.elements['name'].focus();
    }));
    box.querySelectorAll('.research-form').forEach(f => f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!f.reportValidity()) return;
      const id = f.closest('.research-item').dataset.id, msg = f.querySelector('.msg');
      const row = { project_id: id, name: f.elements['name'].value.trim(), institution: f.elements['institution'].value.trim() || null, role: f.elements['role'].value.trim() || null, message: f.elements['message'].value.trim() || null };
      try {
        if (sb) { const { error } = await sb.from('research_interest').insert(row); if (error) throw error; }
        else { const s = JSON.parse(localStorage.getItem('roar-council-demo-v3') || '{}'); (s.research_interest = s.research_interest || []).push({ ...row, id: Date.now().toString(36), user_id: uid, created_at: new Date().toISOString() }); localStorage.setItem('roar-council-demo-v3', JSON.stringify(s)); }
        mine.add(id); draw();
      } catch (err) { msg.textContent = /duplicate/i.test(err.message) ? 'You have already expressed interest.' : err.message; msg.className = 'msg err'; }
    }));
  }

  const start = async () => { try { await load(); } catch (e) { console.warn(e); } draw(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
