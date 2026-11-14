// Members' panel on the Education, Careers, Welfare and Community pages.
// Visitors see the invitation already in the page. Signed-in members (one login for the whole site)
// see the live content in its place: the learning library and sessions, open positions and their
// help requests, confidential support, or the latest Community posts.
(() => {
  'use strict';
  const zone = document.querySelector('[data-members-zone]');
  if (!zone) return;
  const AREA = zone.dataset.membersZone;
  const SB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? esc(u) : '';
  const todayIST = () => new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
  const fmt = v => v ? new Date(String(v).length === 10 ? v + 'T00:00:00+05:30' : v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';
  const ago = v => { const s = (Date.now() - new Date(v)) / 1000; return s < 3600 ? Math.max(1, Math.floor(s / 60)) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : s < 7 * 86400 ? Math.floor(s / 86400) + 'd' : fmt(v); };
  const loadScript = src => new Promise((res, rej) => { if (window.supabase) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });

  // ---------------------------------------------------------------- data (live or demo)
  async function source() {
    const cfg = window.ROAR_CONFIG || {};
    const me = window.ROAR_ACCOUNT && window.ROAR_ACCOUNT.current();
    if (!me) return null;
    if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
      await loadScript(SB_URL);
      const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const uid = data.session.user.id;
      const get = async (q) => { const { data: rows, error } = await q; if (error) throw error; return rows || []; };
      return {
        me,
        resources: () => get(sb.from('resources').select('*').eq('published', true)),
        events: () => get(sb.from('events').select('*').eq('published', true).gte('starts_on', todayIST().slice(0, 8) + '01').order('starts_on')),
        opportunities: () => get(sb.from('opportunities').select('*').eq('published', true)),
        requests: () => get(sb.from('support_requests').select('kind, status, created_at, assigned_to').eq('user_id', uid).order('created_at', { ascending: false }).limit(10)),
        posts: () => get(sb.from('posts').select('id, kind, topic, title, body, image_paths, created_at, author:profiles!posts_author_id_fkey(username, display_name), likes:post_likes(count), ncomments:comments!comments_post_id_fkey(count)').order('created_at', { ascending: false }).limit(6)),
        trending: async () => { const { data: t } = await sb.rpc('community_trending', { p_days: 14 }); return t || []; },
        hasProfile: async () => !!(await get(sb.from('profiles').select('id').eq('id', uid))).length,
        mentors: () => get(sb.from('mentors').select('display_name, headline, areas, offers, institution, city').eq('status', 'approved').order('updated_at', { ascending: false }).limit(6)),
      };
    }
    // Demo: the data the console and portal demos keep in this browser
    let s = null;
    try { s = JSON.parse(localStorage.getItem('roar-council-demo-v3') || 'null'); } catch (e) { }
    s = s || {};
    const c = s.community || {};
    const profile = id => (c.profiles || []).find(p => p.id === id);
    return {
      me,
      resources: async () => (s.resources || []).filter(r => r.published),
      events: async () => (s.events || []).filter(e => e.published),
      opportunities: async () => (s.opportunities || []).filter(o => o.published),
      requests: async () => (s.support_requests || []).filter(r => r.email === me.email),
      posts: async () => (c.posts || []).filter(p => !p.hidden).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6).map(p => ({ ...p,
        author: profile(p.author_id), likes: [{ count: (c.likes || []).filter(l => l.post_id === p.id).length }], ncomments: [{ count: (c.comments || []).filter(x => x.post_id === p.id).length }] })),
      trending: async () => { const n = {}; (c.posts || []).forEach(p => (p.hashtags || []).forEach(t => { n[t] = (n[t] || 0) + 1; })); return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, k]) => ({ tag, n: k })); },
      hasProfile: async () => !!profile(me.email),
      mentors: async () => (s.mentors || []).filter(m => m.status === 'approved').slice(0, 6),
    };
  }

  // ---------------------------------------------------------------- calendar files for sessions
  function ics(e) {
    const d = v => String(v).replace(/-/g, '');
    const end = new Date((e.ends_on || e.starts_on) + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + 1);
    const t = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ROAR//Events//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:${e.id || d(e.starts_on) + Math.random().toString(16).slice(2)}@roar`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${d(e.starts_on)}`, `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`,
      `SUMMARY:${t(e.title)}`, e.description ? `DESCRIPTION:${t(e.description)}` : '', e.city ? `LOCATION:${t(e.city)}` : '', safeUrl(e.url) ? `URL:${e.url}` : '',
      'END:VEVENT', 'END:VCALENDAR'].filter(Boolean);
    return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  }
  window.ROAR_ICS = ics;

  // ---------------------------------------------------------------- the panels
  const shell = (title, inner, link, linkText) => `
    <div class="mz glass">
      <div class="mz-top"><div><span class="eyebrow">Members' area</span><h2>${title}</h2></div>
        <a class="btn btn-glass small" href="${link}">${linkText} →</a></div>
      ${inner}
    </div>`;
  const tag = (t, quiet) => `<span class="tag${quiet ? ' tag-quiet' : ''}">${esc(t)}</span>`;
  const empty = t => `<p class="mz-empty">${t}</p>`;
  const first = name => esc(String(name || '').replace(/^Dr\.?\s+/i, 'Dr. ').split(' ').slice(0, 2).join(' '));

  async function education(src) {
    const [res, ev] = await Promise.all([src.resources(), src.events()]);
    const today = todayIST();
    const upcoming = ev.filter(e => (e.ends_on || e.starts_on) >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on)).slice(0, 6);
    const kinds = [...new Set(res.map(r => r.kind).filter(Boolean))].sort();
    zone.querySelector('.wrap').innerHTML = shell(`Welcome back, ${first(src.me.name || 'colleague')}`, `
      <div class="mz-grid">
        <div>
          <div class="mz-bar"><h3>Learning library</h3>
            <input type="search" class="mz-q" placeholder="Search the library" aria-label="Search the library">
            ${kinds.length > 1 ? `<select class="mz-k" aria-label="Type"><option value="">All types</option>${kinds.map(k => `<option>${esc(k)}</option>`).join('')}</select>` : ''}</div>
          <div class="mz-list" data-list>${''}</div>
        </div>
        <div>
          <div class="mz-bar"><h3>Upcoming sessions</h3></div>
          <div class="mz-list">${upcoming.length ? upcoming.map(e => `<article class="mz-item">
              <div class="mz-date"><b>${esc(new Date(e.starts_on + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' }))}</b><span>${esc(new Date(e.starts_on + 'T00:00:00+05:30').toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }))}</span></div>
              <div><div class="meta-row">${tag(e.kind || 'Session')}${e.format ? tag(e.format, true) : ''}${e.members_only ? '<span class="tag tag-roar">Members</span>' : ''}</div>
                <h4>${esc(e.title)}</h4><p class="mz-sub">${fmt(e.starts_on)}${e.ends_on && e.ends_on !== e.starts_on ? ' – ' + fmt(e.ends_on) : ''}${e.city ? ' · ' + esc(e.city) : ''}</p>
                <div class="mz-acts"><a href="#" data-ics="${esc(e.id || '')}">Add to calendar</a>${safeUrl(e.url) ? `<a href="${safeUrl(e.url)}" target="_blank" rel="noopener">Details ↗</a>` : ''}</div></div>
            </article>`).join('') : empty('No sessions scheduled yet. The Academic Society will post them here.')}
            <a class="mz-more" href="events.html">Full calendar →</a></div>
        </div>
      </div>`, 'portal/#learning', "Open members' area");
    const list = zone.querySelector('[data-list]'), q = zone.querySelector('.mz-q'), k = zone.querySelector('.mz-k');
    const draw = () => {
      const term = (q.value || '').toLowerCase(), kind = k ? k.value : '';
      const rows = res.filter(r => (!kind || r.kind === kind) && (!term || (r.title + ' ' + (r.description || '')).toLowerCase().includes(term)))
        .sort((a, b) => (b.members_only ? 1 : 0) - (a.members_only ? 1 : 0) || a.title.localeCompare(b.title));
      list.innerHTML = rows.length ? rows.slice(0, 12).map(r => `<article class="mz-item">
          <div><div class="meta-row">${r.kind ? tag(r.kind) : ''}${r.level ? tag(r.level, true) : ''}${r.members_only ? '<span class="tag tag-roar">Members</span>' : ''}</div>
          <h4>${safeUrl(r.url) ? `<a href="${safeUrl(r.url)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a>` : esc(r.title)}</h4>${r.description ? `<p class="mz-sub">${esc(r.description)}</p>` : ''}</div></article>`).join('')
        + (rows.length > 12 ? `<a class="mz-more" href="portal/#learning">See all ${rows.length} →</a>` : '')
        : empty(res.length ? 'Nothing matches that search.' : 'The Academic Society is preparing the first resources.');
    };
    q.addEventListener('input', draw); if (k) k.addEventListener('change', draw); draw();
    zone.querySelectorAll('[data-ics]').forEach(a => a.addEventListener('click', ev => {
      ev.preventDefault();
      const e = upcoming.find(x => String(x.id || '') === a.dataset.ics) || upcoming[0];
      const link = document.createElement('a'); link.href = ics(e); link.download = (e.title || 'roar-event').replace(/[^\w]+/g, '-').slice(0, 50) + '.ics'; link.click();
    }));
  }

  const ST = { new: 'Received', assigned: 'With a mentor', in_progress: 'In progress', closed: 'Closed' };
  const requestsHtml = reqs => reqs.length ? reqs.map(r => `<div class="mz-req"><span>${esc(r.kind)}</span><span class="pill ${esc(r.status)}">${esc(ST[r.status] || r.status)}</span><small>${fmt(r.created_at)}</small></div>`).join('') : empty("You haven't asked for help yet.");

  async function careers(src) {
    const [opps, reqs] = await Promise.all([src.opportunities(), src.requests()]);
    const today = todayIST();
    const open = opps.filter(o => !o.deadline || o.deadline >= today).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    const kinds = [...new Set(open.map(o => o.kind).filter(Boolean))].sort();
    const HELP = ['CV review', 'Fellowship guidance', 'Job search', 'Exam preparation', 'Observership placement', 'Research mentorship'];
    zone.querySelector('.wrap').innerHTML = shell(`Welcome back, ${first(src.me.name || 'colleague')}`, `
      <div class="mz-grid">
        <div>
          <div class="mz-bar"><h3>Open positions</h3>${kinds.length > 1 ? `<select class="mz-k" aria-label="Type"><option value="">All</option>${kinds.map(k => `<option>${esc(k)}</option>`).join('')}</select>` : ''}</div>
          <div class="mz-list" data-list></div>
        </div>
        <div>
          <div class="mz-bar"><h3>Ask for one-to-one help</h3></div>
          <div class="mz-chips">${HELP.map(h => `<a class="chip" href="portal/#careers">${h}</a>`).join('')}</div>
          <div class="mz-bar" style="margin-top:18px"><h3>Your requests</h3></div>
          ${requestsHtml(reqs)}
        </div>
      </div>`, 'portal/#careers', 'Careers help');
    const list = zone.querySelector('[data-list]'), k = zone.querySelector('.mz-k');
    const draw = () => {
      const rows = open.filter(o => !k || !k.value || o.kind === k.value);
      list.innerHTML = rows.length ? rows.slice(0, 10).map(o => `<article class="mz-item"><div>
          <div class="meta-row">${o.kind ? tag(o.kind) : ''}${o.deadline ? tag('Apply by ' + fmt(o.deadline), true) : ''}${o.members_only ? '<span class="tag tag-roar">Members</span>' : ''}</div>
          <h4>${safeUrl(o.url) ? `<a href="${safeUrl(o.url)}" target="_blank" rel="noopener">${esc(o.title)} ↗</a>` : esc(o.title)}</h4>
          <p class="mz-sub">${[o.organisation, o.location].filter(Boolean).map(esc).join(' · ')}</p></div></article>`).join('')
        : empty('No open positions listed right now. New listings appear here first.');
    };
    if (k) k.addEventListener('change', draw); draw();
  }

  async function welfare(src) {
    const reqs = await src.requests();
    zone.querySelector('.wrap').innerHTML = shell('Confidential support', `
      <div class="mz-grid">
        <div>
          <div class="mz-bar"><h3>Raise a concern in confidence</h3></div>
          <p class="mz-text">Tell us about a problem with your training, working conditions, pay or how you are treated. A founder will reply in confidence. Nothing is shared, and no one is named, without your written consent.</p>
          <a class="btn btn-primary small" href="portal/#careers">Raise a concern</a>
          <div class="mz-bar" style="margin-top:22px"><h3>Your requests</h3></div>
          ${requestsHtml(reqs)}
        </div>
        <div>
          <div class="mz-bar"><h3>Be counted</h3></div>
          <p class="mz-text">The national survey builds the first picture of training, pay, hours and wellbeing across India. It's anonymous and takes about 15 minutes.</p>
          <a class="btn btn-glass small" href="survey/">Take the survey</a>
          <div class="mz-bar" style="margin-top:22px"><h3>Need help right now?</h3></div>
          <p class="mz-text">Call <a href="tel:14416"><b>Tele-MANAS on 14416</b></a>, India's free 24-hour mental health helpline.</p>
        </div>
      </div>`, 'portal/#welfare', 'Welfare in the members’ area');
  }

  async function community(src) {
    const [posts, tr, has] = await Promise.all([src.posts(), src.trending(), src.hasProfile()]);
    const n = x => (x && x[0] && x[0].count) || 0;
    zone.querySelector('.wrap').innerHTML = shell(has ? `Welcome back, ${first(src.me.name || 'colleague')}` : 'Create your Community profile', `
      <div class="mz-grid">
        <div>
          <div class="mz-bar"><h3>Latest in Community</h3></div>
          <div class="mz-list">${posts.length ? posts.map(p => `<a class="mz-item mz-post" href="portal/#community/p/${esc(p.id)}"><div>
              <div class="meta-row">${tag(p.kind || 'post')}${p.author ? `<span class="mz-sub">${esc(p.author.display_name)} · ${ago(p.created_at)}</span>` : ''}</div>
              <h4>${esc(p.title || String(p.body).slice(0, 90) + (String(p.body).length > 90 ? '…' : ''))}</h4>
              <p class="mz-sub">♥ ${n(p.likes)} · 💬 ${n(p.ncomments)}${(p.image_paths || []).length ? ' · 📷 ' + p.image_paths.length : ''}</p></div></a>`).join('') : empty('No posts yet. Be the first to ask a question.')}</div>
        </div>
        <div>
          ${has ? '' : `<p class="mz-text">Pick a username, add a photo and say hello. It takes a minute.</p><a class="btn btn-primary small" href="portal/#community">Create my profile</a>`}
          <div class="mz-bar"${has ? '' : ' style="margin-top:22px"'}><h3>Trending</h3></div>
          <div class="mz-chips">${tr.length ? tr.slice(0, 8).map(t => `<a class="chip" href="portal/#community/tag/${esc(t.tag)}">#${esc(t.tag)}</a>`).join('') : '<span class="mz-sub">Hashtags you use in posts show up here.</span>'}</div>
          <div class="mz-cta"><a class="btn btn-primary" href="portal/#community">Open Community</a><a class="btn btn-glass" href="portal/#community/explore">Explore topics</a></div>
        </div>
      </div>`, 'portal/#community', 'Open Community');
  }

  async function mentorship(src) {
    const ms = await src.mentors();
    zone.querySelector('.wrap').innerHTML = shell('Mentors you can ask', `
      <div class="mz-mentors">${ms.length ? ms.map(m => `<article class="mz-mentor">
          <b>${esc(m.display_name)}</b><span class="mz-sub">${esc(m.headline || '')}</span>
          <span class="mz-sub">${[m.institution, m.city].filter(Boolean).map(esc).join(' · ')}</span>
          <div class="mz-chips">${(m.offers || []).slice(0, 3).map(o => tag(o, true)).join('')}</div>
        </article>`).join('') : empty("The first mentors are being approved by the Founders' Council.")}</div>
      <div class="mz-cta"><a class="btn btn-primary" href="portal/#mentorship">Find a mentor</a><a class="btn btn-glass" href="portal/#mentorship">Offer to mentor</a></div>`, 'portal/#mentorship', 'Mentorship in My ROAR');
  }

  async function start() {
    let src;
    try { src = await source(); } catch (e) { console.warn(e); return; }
    if (!src) return;                                  // visitors keep the invitation
    zone.classList.add('is-member');
    try { await ({ education, careers, welfare, community, mentorship }[AREA])(src); }
    catch (e) { console.warn('Members content unavailable', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
