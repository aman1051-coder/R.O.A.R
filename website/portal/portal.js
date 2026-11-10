// ROAR member portal: sign-up, membership application, dashboard and secret-ballot voting.
// Live mode uses Supabase (see supabase/schema.sql, PART 3). Demo mode keeps everything in this
// browser and shares its data with the Founders' console demo, so you can test both sides.
(() => {
  'use strict';
  const cfg = window.ROAR_CONFIG || {};
  const LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const R = window.ROAR_RULES;
  const DEMO_KEY = 'roar-council-demo-v3';
  const DEMO_USER = 'roar-portal-demo-user';
  const DRAFT_KEY = 'roar-portal-draft';
  const root = document.getElementById('portal-root');

  const $ = s => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = v => v ? new Date(String(v).length === 10 ? v + 'T00:00:00+05:30' : v).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) : '—';
  const fmtTime = v => v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
  };
  function toast(msg, err) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), err ? 6000 : 2600);
  }
  const fail = e => { console.error(e); toast(e && e.message ? e.message : 'Something went wrong', true); };

  // ===================================================================
  // Data layer
  // ===================================================================
  const initialHash = location.hash;
  const sb = LIVE && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const Demo = {
    s: null,
    load() {
      this.s = store.get(DEMO_KEY);
      if (!this.s) { this.s = JSON.parse(JSON.stringify(window.ROAR_DEMO_SEED)); this.save(); }
      ['members', 'elections', 'ballot_receipts', 'ballot_votes', 'settings'].forEach(t => { this.s[t] = this.s[t] || []; });
    },
    save() { store.set(DEMO_KEY, this.s); },
    user() { return store.get(DEMO_USER); },
  };
  if (!LIVE && window.ROAR_DEMO_OK) Demo.load();   // demo data only in demo mode, never for public visitors
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + Math.random().toString(16).slice(2));

  const API = {
    async session() {
      if (!LIVE) return window.ROAR_DEMO_OK ? Demo.user() : null;
      const { data } = await sb.auth.getSession();
      return data.session ? { email: data.session.user.email.toLowerCase(), id: data.session.user.id } : null;
    },
    async signUp(name, email, password) {
      const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname, data: { full_name: name } } });
      if (error) throw error;
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async reset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
    },
    async setPassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
    },
    async signOut() { if (LIVE) await sb.auth.signOut(); else store.del(DEMO_USER); },

    async membershipOpen() {
      if (!LIVE) { const s = Demo.s.settings.find(x => x.key === 'membership_open'); return s ? !!s.value : true; }
      const { data } = await sb.from('settings').select('value').eq('key', 'membership_open').maybeSingle();
      return !!(data && data.value === true);
    },
    async me(sess) {
      if (!LIVE) return Demo.s.members.find(m => m.email === sess.email) || null;
      const { data, error } = await sb.from('members').select('*').eq('user_id', sess.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async create(row, sess) {
      if (!LIVE) {
        const r = { ...row, id: uid(), user_id: 'demo:' + sess.email, email: sess.email, created_at: new Date().toISOString(), status: 'submitted', category: null, member_no: null, approved_at: null, paid_until: null, payment_ref: null, fee_deferred: false, clock_pause_months: 0 };
        if (r.plan === 'founding' && (await API.foundingLeft()) <= 0) r.plan = 'lifetime';
        Demo.s.members.push(r); Demo.save(); return r;
      }
      const { data, error } = await sb.from('members').insert(row).select().single();
      if (error) throw error;
      return data;
    },
    async update(m, patch) {
      if (!LIVE) { Object.assign(Demo.s.members.find(x => x.id === m.id), patch); Demo.save(); return; }
      const { error } = await sb.from('members').update(patch).eq('id', m.id);
      if (error) throw error;
    },
    async upload(kind, file, sess) {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!LIVE) return `demo/${kind}-${file.name}`;
      const path = `${sess.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await sb.storage.from('member-docs').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      return path;
    },
    async foundingLeft() {
      if (!LIVE) return Math.max(0, R.FOUNDING_LIMIT - Demo.s.members.filter(m => m.plan === 'founding' && m.status !== 'rejected').length);
      const { data } = await sb.rpc('founding_places_left');
      return data ?? 0;
    },
    async amFounder(sess) {
      if (!LIVE) return (Demo.s.founders || []).some(f => f.email === sess.email);
      const { data } = await sb.rpc('am_i_founder');
      return !!data;
    },
    async ballots() {
      if (!LIVE) return Demo.s.elections.filter(e => e.status !== 'draft');
      const { data, error } = await sb.from('elections').select('*').neq('status', 'draft').order('opens_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async myReceipts(m) {
      if (!LIVE) return new Set(Demo.s.ballot_receipts.filter(r => r.member_id === m.id).map(r => r.election_id));
      const { data } = await sb.from('ballot_receipts').select('election_id').eq('member_id', m.id);
      return new Set((data || []).map(r => r.election_id));
    },
    async cast(e, choice, m, isFounder) {
      if (!LIVE) {
        const now = new Date().toISOString();
        if (e.status !== 'open' || now < e.opens_at || now > e.closes_at) throw new Error('This ballot is not open');
        if (!R.canVote(m, e, { isFounder }).ok) throw new Error('You are not on the electoral roll for this ballot');
        if (Demo.s.ballot_receipts.some(r => r.election_id === e.id && r.member_id === m.id)) throw new Error('You have already voted in this ballot');
        Demo.s.ballot_receipts.push({ election_id: e.id, member_id: m.id });
        Demo.s.ballot_votes.push({ id: uid(), election_id: e.id, choice });
        Demo.save(); return;
      }
      const { error } = await sb.rpc('cast_ballot', { p_election: e.id, p_choice: choice });
      if (error) throw error;
    },
    // Members' area: content (members-only items included once signed in) and career help requests
    async content(table) {
      if (!LIVE) return (Demo.s[table] || []).filter(r => r.published);
      const { data, error } = await sb.from(table).select('*').eq('published', true);
      if (error) throw error;
      return data || [];
    },
    async myRequests(sess) {
      if (!LIVE) return (Demo.s.support_requests || []).filter(r => r.email === sess.email).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const { data, error } = await sb.from('support_requests').select('*').eq('user_id', sess.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async askForHelp(row, sess) {
      if (!LIVE) {
        Demo.s.support_requests = Demo.s.support_requests || [];
        Demo.s.support_requests.push({ ...row, id: uid(), created_at: new Date().toISOString(), user_id: 'demo:' + sess.email, email: sess.email, status: 'new', assigned_to: null, notes: null });
        Demo.save(); return;
      }
      const { error } = await sb.from('support_requests').insert(row);
      if (error) throw error;
    },
    async results(e) {
      if (!LIVE) {
        const out = {};
        Demo.s.ballot_votes.filter(v => v.election_id === e.id).forEach(v => { out[v.choice] = (out[v.choice] || 0) + 1; });
        return { voted: Demo.s.ballot_receipts.filter(r => r.election_id === e.id).length, results: out };
      }
      const { data } = await sb.rpc('election_stats', { p_election: e.id });
      return data && data[0] ? data[0] : null;
    },
  };

  // ===================================================================
  // Router
  // ===================================================================
  let sess = null, member = null, isFounder = false;

  // Tabs of the members' area. Every signed-in account gets Education and Careers help;
  // the membership tab holds the application, card and ballots.
  const TABS = [['membership', 'My membership'], ['community', 'Community'], ['education', 'Education'], ['careers', 'Careers'], ['welfare', 'Welfare']];
  const tabsEl = document.getElementById('portal-tabs');
  const route = () => location.hash.replace('#', '').split('/');
  const currentTab = () => { const t = route()[0]; return TABS.some(x => x[0] === t) ? t : 'membership'; };
  const FOUNDER_DOMAIN = '@' + (cfg.founderLoginDomain || 'founders.roar.invalid');
  const shownName = s => s.email.endsWith(FOUNDER_DOMAIN) ? s.email.slice(0, -FOUNDER_DOMAIN.length) : s.email;
  function drawTabs() {
    if (!sess) { tabsEl.hidden = true; return; }
    tabsEl.hidden = false;
    const t = currentTab();
    tabsEl.innerHTML = `<div class="wrap area-bar">
      <nav class="area-tabs" aria-label="Members' area">${TABS.map(([k, l]) => `<a href="#${k}"${k === t ? ' class="on" aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
      <div class="area-user"><span>${esc(shownName(sess))}</span><button class="btn btn-glass small" id="tab-out">Sign out</button></div>
    </div>`;
    tabsEl.querySelector('#tab-out').addEventListener('click', async () => { await API.signOut(); location.hash = ''; render(); });
  }
  window.addEventListener('hashchange', () => { if (sess) render(); });

  async function render() {
    try {
      if (LIVE && /type=recovery/.test(initialHash) && !render.recovered) { render.recovered = true; return authView('newpass'); }
      sess = await API.session();
      drawTabs();
      if (!sess) return authView(sessionStorage.getItem('roar-signup') ? (sessionStorage.removeItem('roar-signup'), 'signup') : 'signin');
      const tab = currentTab();
      if (tab === 'education') return educationView();
      if (tab === 'careers') return careersView();
      if (tab === 'welfare') return welfareView();
      if (tab === 'community') {
        isFounder = await API.amFounder(sess);
        if (!window.ROAR_COMMUNITY) throw new Error('Community failed to load. Refresh the page.');
        return window.ROAR_COMMUNITY.view(portalCtx, route().slice(1));
      }
      member = await API.me(sess);
      isFounder = await API.amFounder(sess);
      if (!member) return (await API.membershipOpen()) ? wizard() : closedView();
      return dashboard();
    } catch (e) { fail(e); root.innerHTML = `<div class="card empty-state">Couldn't load the portal: ${esc(e.message || e)}</div>`; }
  }

  // Shared with community.js
  const portalCtx = {
    LIVE, cfg, sb, Demo, root, esc, toast, fail, fmt, fmtTime, uid, rerender: () => render(),
    get sess() { return sess; }, get isFounder() { return isFounder; },
  };

  // ===================================================================
  // Members' area: Education
  // ===================================================================
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? esc(u) : '';
  const membersTag = r => r.members_only ? '<span class="tag tag-roar">Members</span>' : '';
  async function educationView() {
    const [res, ev] = await Promise.all([API.content('resources'), API.content('events')]);
    const today = R.todayIST();
    const upcoming = ev.filter(e => (e.ends_on || e.starts_on) >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    const resSorted = [...res].sort((a, b) => (b.members_only ? 1 : 0) - (a.members_only ? 1 : 0) || a.title.localeCompare(b.title));
    root.innerHTML = `
      <div class="dash-head"><div><span class="eyebrow">Members' area</span><h1>Education</h1></div></div>
      <p class="lead" style="margin-top:-8px">Session recordings, case files and resources for ROAR members, alongside the public learning library.</p>
      <div class="dash">
        <div>
          <div class="panel glass"><h2>Learning library</h2>
            ${resSorted.length ? resSorted.map(r => `<div class="ballot">
              <div class="meta-row"><span class="tag">${esc(r.kind)}</span><span class="tag tag-quiet">${esc(r.level)}</span>${membersTag(r)}</div>
              <h3>${esc(r.title)}</h3>${r.description ? `<p style="font-size:.92rem;margin:0 0 8px">${esc(r.description)}</p>` : ''}
              ${safeUrl(r.url) ? `<a class="more" href="${safeUrl(r.url)}" target="_blank" rel="noopener">Open resource ↗</a>` : ''}
            </div>`).join('') : '<p class="muted" style="margin:0">The Academic Society is preparing the first resources.</p>'}
          </div>
        </div>
        <div>
          <div class="panel glass"><h2>Upcoming sessions</h2>
            ${upcoming.length ? upcoming.slice(0, 8).map(e => `<div class="ballot">
              <div class="meta-row"><span class="tag">${esc(e.kind)}</span><span class="tag tag-quiet">${esc(e.format)}</span>${membersTag(e)}</div>
              <h3>${esc(e.title)}</h3><div class="when">${fmt(e.starts_on)}${e.ends_on && e.ends_on !== e.starts_on ? ' – ' + fmt(e.ends_on) : ''}${e.city ? ' · ' + esc(e.city) : ''}</div>
              ${e.description ? `<p style="font-size:.92rem;margin:0">${esc(e.description)}</p>` : ''}
              ${safeUrl(e.url) ? `<a class="more" href="${safeUrl(e.url)}" target="_blank" rel="noopener">Details ↗</a>` : ''}
            </div>`).join('') : '<p class="muted" style="margin:0">No sessions scheduled yet.</p>'}
            <p style="margin:12px 0 0"><a class="more" href="../events.html">Full public calendar →</a></p>
          </div>
          <div class="panel glass"><h2>Programmes</h2>
            <p style="margin:0 0 10px">Contour Club, ROAR Passport observerships, the Research Collective, ROAR Global and ROAR Wellbeing are being set up for members.</p>
            <a class="more" href="../learn.html#programmes">About the programmes →</a>
          </div>
        </div>
      </div>`;
  }


  // ===================================================================
  // Members' area: Welfare (Member Welfare Charter, Articles 8A-8N)
  // ===================================================================
  function welfareView() {
    const desks = [
      ['Education Standards Desk', 'When your training falls short: no exposure to a technique the curriculum requires, no teaching programme, or being kept from planning or patient care. ROAR records the concern, advises you, and connects you with teaching or observerships elsewhere.'],
      ['Grievance cell', 'Duty hours, unpaid or delayed stipends, senior-resident pay, contracts and bonds, leave, and radiation safety. ROAR advises you, helps you prepare a representation, and links you with legal and contract advisers.'],
      ['Dignity at work desk', 'Bullying, humiliation, harassment or discrimination, including on grounds of gender, caste, religion, region, language or where you trained. ROAR listens, keeps it confidential, and explains your options, including POSH and anti-ragging routes.'],
    ];
    root.innerHTML = `
      <div class="dash-head"><div><span class="eyebrow">Members' area</span><h1>Welfare</h1></div></div>
      <p class="lead" style="margin-top:-8px">Confidential support on training, working conditions and wellbeing. ROAR never names you or your institution without your written consent.</p>
      <div class="notice warn">The support desks open once ROAR is registered. Until then, you can tell us about a general concern through <a href="#careers">Careers help</a> (choose "Other"), and we'll reply in confidence.</div>
      <div class="dash">
        <div>
          ${desks.map(([t, d]) => `<div class="panel glass"><h2>${t}</h2><p style="margin:0">${d}</p></div>`).join('')}
        </div>
        <div>
          <div class="panel glass"><h2>Our promise to you</h2>
            <ul class="promise">
              <li><b>Anonymised.</b> Concerns and survey answers are anonymised (Article 8G).</li>
              <li><b>Never named without consent.</b> No member or institution is named in connection with a concern without written consent.</li>
              <li><b>No exposure.</b> An office-bearer who reveals a reporter's identity is removed from office (Article 8K).</li>
              <li><b>Free when it's hardest.</b> A resident whose stipend has been unpaid for 3 months or more can join free, with the fee deferred.</li>
            </ul>
          </div>
          <div class="panel glass"><h2>National survey</h2>
            <p style="margin:0 0 10px">Help build the first national picture of training, pay, hours and wellbeing. It's anonymous and takes about 15 minutes.</p>
            <a class="btn btn-glass small" href="../survey/">Go to the survey</a>
          </div>
          <div class="panel glass help-now"><h2>Need help right now?</h2>
            <p style="margin:0">Call <b>Tele-MANAS on 14416</b> (or 1-800-891-4416), India's free 24-hour mental health helpline. For harassment, you can go directly to your institution's Internal Committee under the POSH Act or its anti-ragging committee.</p>
          </div>
        </div>
      </div>`;
  }

  // ===================================================================
  // Members' area: Careers help (Article 8O)
  // ===================================================================
  const HELP_KINDS = [['CV review', 'Feedback on your CV for jobs or fellowships'], ['Fellowship guidance', 'Choosing and applying for fellowships in India or abroad'],
    ['Job search', 'Senior residency and consultant posts, and what to check in a contract'], ['Exam preparation', 'MD/DNB and other exam guidance'],
    ['Observership placement', 'Finding a centre to observe a technique you lack'], ['Research mentorship', 'Help with a thesis, paper or project'], ['Other', 'Anything else about your career']];
  async function careersView() {
    const [reqs, opps] = await Promise.all([API.myRequests(sess), API.content('opportunities')]);
    const today = R.todayIST();
    const open = opps.filter(o => !o.deadline || o.deadline >= today).sort((a, b) => (b.members_only ? 1 : 0) - (a.members_only ? 1 : 0) || (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    const ST = { new: 'Received', assigned: 'Assigned to a mentor', in_progress: 'In progress', closed: 'Closed' };
    root.innerHTML = `
      <div class="dash-head"><div><span class="eyebrow">Members' area</span><h1>Careers help</h1></div></div>
      <p class="lead" style="margin-top:-8px">One-to-one guidance from ROAR founders and mentors on jobs, fellowships, exams and research. Tell us what you need and we'll match you with someone who can help.</p>
      <div class="dash">
        <div>
          <form class="panel glass pform" id="help-form">
            <h2>Ask for help</h2>
            <label>What do you need help with?</label>
            <div class="opts-help">${HELP_KINDS.map(([k, d], i) => `<label class="o"><input type="radio" name="kind" value="${esc(k)}"${i === 0 ? ' checked' : ''}><span><b>${esc(k)}</b><br><small class="muted">${esc(d)}</small></span></label>`).join('')}</div>
            <div class="row one" style="margin-top:14px"><div><label for="h-name">Your name</label><input id="h-name" required value="${esc((member && member.full_name) || sess.name || '')}"></div></div>
            <div class="row one"><div><label for="h-details">Tell us about it</label><textarea id="h-details" required minlength="10" maxlength="4000" placeholder="Your stage of training, what you are aiming for, and any deadlines."></textarea></div></div>
            <div class="row one"><div><label for="h-contact">How should we contact you?</label><input id="h-contact" placeholder="Email is fine, or add a WhatsApp number"></div></div>
            <button class="btn btn-primary" type="submit">Send request</button>
            <p class="msg" id="h-msg" role="status"></p>
          </form>
          <div class="panel glass"><h2>Your requests</h2>
            ${reqs.length ? reqs.map(r => `<div class="ballot"><div class="meta-row"><span class="tag">${esc(r.kind)}</span><span class="tag tag-quiet">${esc(ST[r.status] || r.status)}</span></div>
              <p style="margin:0 0 4px;font-size:.92rem">${esc(r.details)}</p><div class="when">Sent ${fmt(r.created_at)}${r.assigned_to ? ' · with ' + esc(r.assigned_to) : ''}</div></div>`).join('') : '<p class="muted" style="margin:0">You haven\'t asked for help yet.</p>'}
          </div>
        </div>
        <div>
          <div class="panel glass"><h2>Open positions</h2>
            ${open.length ? open.slice(0, 10).map(o => `<div class="ballot">
              <div class="meta-row"><span class="tag">${esc(o.kind)}</span>${o.deadline ? `<span class="tag tag-quiet">Apply by ${fmt(o.deadline)}</span>` : ''}${membersTag(o)}</div>
              <h3>${esc(o.title)}</h3><div class="when">${[o.organisation, o.location].filter(Boolean).map(esc).join(' · ')}</div>
              ${safeUrl(o.url) ? `<a class="more" href="${safeUrl(o.url)}" target="_blank" rel="noopener">View ↗</a>` : ''}
            </div>`).join('') : '<p class="muted" style="margin:0">No open positions listed right now.</p>'}
            <p style="margin:12px 0 0"><a class="more" href="../opportunities.html">All careers listings →</a></p>
          </div>
        </div>
      </div>`;
    $('#help-form').addEventListener('submit', async e => {
      e.preventDefault();
      if (!e.target.reportValidity()) return;
      const m = $('#h-msg');
      try {
        await API.askForHelp({ name: $('#h-name').value.trim(), kind: (root.querySelector('[name="kind"]:checked') || {}).value || 'Other', details: $('#h-details').value.trim(), contact_pref: $('#h-contact').value.trim() || null }, sess);
        toast('Request sent. A founder will be in touch.');
        careersView();
      } catch (err) { m.textContent = err.message; m.className = 'msg err'; }
    });
  }
  if (LIVE && sb) sb.auth.onAuthStateChange(evt => { if (evt === 'PASSWORD_RECOVERY') authView('newpass'); });

  // ===================================================================
  // Sign-in / sign-up
  // ===================================================================
  function authView(mode) {
    if (!LIVE && !window.ROAR_DEMO_OK) {
      root.innerHTML = `<div class="auth glass" style="text-align:center"><span class="eyebrow">Member portal</span><h1>Member accounts open soon.</h1>
        ${wantedSection()}<p>ROAR is setting up member accounts. Register your interest and we'll tell you when you can sign in.</p>
        <p style="margin:0"><a class="btn btn-primary" href="../index.html#join">Keep me updated</a></p></div>`;
      return;
    }
    if (!LIVE) return demoAuth();
    const title = { signin: 'Member login', signup: 'Create your account', reset: 'Reset your password', newpass: 'Choose a new password' }[mode];
    root.innerHTML = `<div class="auth glass pform">
      <span class="eyebrow">Member portal</span>
      <h1>${title}</h1>
      ${wantedSection()}
      ${mode === 'signin' || mode === 'signup' ? `<div class="tabs" role="tablist">
        <button type="button" class="${mode === 'signin' ? 'on' : ''}" data-mode="signin">Sign in</button>
        <button type="button" class="${mode === 'signup' ? 'on' : ''}" data-mode="signup">Create account</button></div>` : '<p class="muted">We\'ll email you a link.</p>'}
      <form id="auth-form" novalidate>
        ${mode === 'signup' ? '<div class="row one"><div><label for="a-name">Full name</label><input id="a-name" required autocomplete="name"></div></div>' : ''}
        ${mode !== 'newpass' ? `<div class="row one"><div><label for="a-email">${mode === 'signin' ? 'Email (founders: your username)' : 'Email'}</label><input id="a-email" type="${mode === 'signin' ? 'text' : 'email'}" required autocomplete="${mode === 'signin' ? 'username' : 'email'}" autocapitalize="none" spellcheck="false"></div></div>` : ''}
        ${mode !== 'reset' ? `<div class="row one"><div><label for="a-pass">${mode === 'signin' ? 'Password' : 'Password (at least 10 characters)'}</label><input id="a-pass" type="password" required minlength="${mode === 'signin' ? 1 : 10}" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}"></div></div>` : ''}
        <button class="btn btn-primary wide" type="submit">${{ signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', newpass: 'Save password' }[mode]}</button>
        <p class="msg" id="a-msg" role="status"></p>
      </form>
      ${mode === 'signin' ? '<p style="margin:6px 0 0;font-size:.9rem"><button class="linklike" data-mode="reset">Forgot your password?</button></p>' : ''}
      ${mode === 'reset' ? '<p style="margin:6px 0 0;font-size:.9rem"><button class="linklike" data-mode="signin">Back to sign in</button></p>' : ''}
      <div class="divider">Founders</div>
      <p class="muted" style="font-size:.88rem;margin:0">Founders sign in here with the same username and password as the <a href="../council/">Founders' console</a>. Set your password in the console first.</p>
    </div>`;
    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => authView(b.dataset.mode)));
    const msg = (t, k) => { const el = $('#a-msg'); el.textContent = t; el.className = 'msg ' + (k || ''); };
    $('#auth-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      if (!ev.target.reportValidity()) return;
      let email = ($('#a-email') || {}).value?.trim().toLowerCase();
      if (email && mode === 'signin' && !email.includes('@')) email += FOUNDER_DOMAIN;   // founders sign in with their username
      const pass = ($('#a-pass') || {}).value;
      try {
        msg('Please wait…');
        if (mode === 'signin') { await API.signIn(email, pass); return render(); }
        if (mode === 'signup') { await API.signUp($('#a-name').value.trim(), email, pass); return msg('Check your inbox and click the link to confirm your email, then sign in.', 'ok'); }
        if (mode === 'reset') { await API.reset(email); return msg('If that email has an account, a reset link is on its way.', 'ok'); }
        if (mode === 'newpass') { await API.setPassword(pass); history.replaceState(null, '', location.pathname); toast('Password saved'); return render(); }
      } catch (e) { msg(e.message, 'err'); }
    });
  }

  function wantedSection() {
    const t = location.hash.replace('#', '');
    const label = { education: 'Education', careers: 'Careers', welfare: 'Welfare', community: 'ROAR Community' }[t.split('/')[0]];
    return label ? `<div class="notice">${label} is for members. Sign in, or create a free account, to continue.</div>` : '';
  }

  function demoAuth() {
    const example = Demo.s.members.find(m => m.status === 'approved');
    root.innerHTML = `<div class="auth glass pform">
      <span class="eyebrow">Member portal · demo</span>
      <h1>Member login</h1>
      ${wantedSection()}
      <div class="notice">Demo mode: no database is connected, so nothing leaves this browser. Applications you make here appear in the Founders' console demo for verification.</div>
      <form id="demo-new">
        <div class="row one"><div><label for="d-name">Your name</label><input id="d-name" required value="Dr. Demo Applicant"></div></div>
        <div class="row one"><div><label for="d-email">Email</label><input id="d-email" type="email" required value="applicant@demo.roar"></div></div>
        <button class="btn btn-primary wide" type="submit">Start a demo application</button>
      </form>
      ${example ? `<div class="divider">or</div><button class="btn btn-glass wide" id="d-example">Sign in as ${esc(example.full_name)} (approved member)</button>` : ''}
    </div>`;
    $('#demo-new').addEventListener('submit', ev => {
      ev.preventDefault();
      store.set(DEMO_USER, { email: $('#d-email').value.trim().toLowerCase(), name: $('#d-name').value.trim() });
      render();
    });
    const ex = $('#d-example');
    if (ex) ex.addEventListener('click', () => { store.set(DEMO_USER, { email: example.email, name: example.full_name }); render(); });
  }

  function closedView() {
    root.innerHTML = `<div class="auth glass" style="max-width:620px;text-align:center">
      <span class="eyebrow">Membership</span>
      <h1>Applications open soon.</h1>
      <p>ROAR opens membership once it is legally registered and has a bank account. Your account is ready: we'll email you the moment you can apply.</p>
      <p><a class="btn btn-glass" href="../membership.html">How membership works</a></p>
      <p style="margin:0"><button class="linklike" id="out">Sign out</button></p>
    </div>`;
    $('#out').addEventListener('click', async () => { await API.signOut(); render(); });
  }

  // ===================================================================
  // Application wizard (Article 10)
  // ===================================================================
  const STEPS = ['About you', 'Training', 'Documents', 'Plan & declarations'];
  let files = { id_card: null, proof: null };

  async function wizard(step = 0) {
    const d = store.get(DRAFT_KEY) || { full_name: (sess.name || ''), applying_as: 'resident', course: 'MD', plan: 'annual' };
    const save = patch => { Object.assign(d, patch); store.set(DRAFT_KEY, d); };
    const left = step === 3 ? await API.foundingLeft() : null;
    const isHon = d.applying_as === 'honorary';

    const bodies = [
      () => `<h2>About you</h2>
        <div class="row"><div><label for="w-name">Full name (as on your documents)</label><input id="w-name" required value="${esc(d.full_name)}"></div>
          <div><label for="w-phone">WhatsApp number</label><input id="w-phone" type="tel" value="${esc(d.phone)}" autocomplete="tel"></div></div>
        <label>I am applying as</label>
        <div class="choice-grid">
          ${[['resident', 'RO resident', 'Currently in MD/DNB Radiation Oncology'], ['post_pg', 'Young RO', 'Completed PG (MD/DNB) in radiation oncology'], ['honorary', 'Honorary member', 'RO more than 6 years after PG, or an allied oncology specialist']].map(([v, b, s]) =>
            `<label class="choice-card"><input type="radio" name="w-as" value="${v}"${d.applying_as === v ? ' checked' : ''}><b>${b}</b><span>${s}</span></label>`).join('')}
        </div>
        <div class="row one" id="w-spec-row"${isHon ? '' : ' hidden'}><div><label for="w-spec">Specialty</label>
          <select id="w-spec">${['Radiation oncology (more than 6 years after PG)', 'Medical oncology', 'Surgical oncology', 'Pathology', 'Radiology'].map(o => `<option${d.specialty === o ? ' selected' : ''}>${o}</option>`).join('')}</select>
          <div class="hint">Honorary Members are admitted on the recommendation of the President and the Executive Council, and don't vote.</div></div></div>`,
      () => `<h2>Your training</h2>
        <div class="row"><div><label for="w-course">PG course</label><select id="w-course">${['MD', 'DNB', 'Equivalent abroad', 'Other'].map(o => `<option${d.course === o ? ' selected' : ''}>${o}</option>`).join('')}</select></div>
          <div><label for="w-inst">PG institution</label><input id="w-inst" required value="${esc(d.institution)}"></div></div>
        <div class="row"><div><label for="w-city">City</label><input id="w-city" value="${esc(d.city)}"></div>
          <div><label for="w-state">State / UT</label><select id="w-state"><option value="">Choose</option>${R.STATES.map(s => `<option${d.state === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div></div>
        <div class="row"><div><label for="w-start">PG start date</label><input id="w-start" type="date" ${isHon ? '' : 'required'} value="${esc(d.pg_start)}"><div class="hint">As shown on your allotment letter.</div></div>
          <div><label for="w-end">PG completion date</label><input id="w-end" type="date" value="${esc(d.pg_completion)}" ${d.applying_as === 'post_pg' ? 'required' : ''}><div class="hint">${d.applying_as === 'resident' ? 'Leave empty while you are still in PG.' : 'The date of the final result declaring you qualified.'}</div></div></div>
        <div id="w-window"></div>`,
      () => `<h2>Documents</h2>
        <p class="muted">Both are required (Article 10). PDF, JPG or PNG, up to 5 MB each. Only the Treasurer & Memberships secretary and the founders can see them.</p>
        <label class="drop"><b>PG college identity card</b><input type="file" id="w-id" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">${files.id_card ? `<div class="file-ok">✓ ${esc(files.id_card.name)}</div>` : ''}</label>
        <label class="drop"><b>PG allotment letter or degree certificate</b><input type="file" id="w-proof" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">${files.proof ? `<div class="file-ok">✓ ${esc(files.proof.name)}</div>` : ''}</label>`,
      () => `<h2>Plan &amp; declarations</h2>
        <div class="choice-grid">
          <label class="choice-card"><input type="radio" name="w-plan" value="annual"${d.plan === 'annual' ? ' checked' : ''}><div class="price">₹500</div><b>Annual</b><span>Renew each year.</span></label>
          <label class="choice-card"><input type="radio" name="w-plan" value="lifetime"${d.plan === 'lifetime' ? ' checked' : ''}><div class="price">₹5,000</div><b>Lifetime</b><span>Pay once, member for life.</span></label>
          <label class="choice-card"><input type="radio" name="w-plan" value="founding"${d.plan === 'founding' ? ' checked' : ''}${left > 0 ? '' : ' disabled'}><div class="price">₹1,000</div><b>Founding Member</b><span>${left > 0 ? `${left} of 20 places left. Lifetime, recognised permanently.` : 'All 20 places are taken.'}</span></label>
        </div>
        <div class="notice">You don't pay now. After verification, the Treasurer will send payment details. Your membership starts once payment is received.</div>
        ${isHon ? '' : `<div class="check"><input type="checkbox" id="w-defer"${d.fee_deferral_requested ? ' checked' : ''}><label for="w-defer">My stipend has been unpaid or delayed for 3 months or more. I'd like to join free with the fee deferred (Article 8J).</label></div>`}
        <div class="check"><input type="checkbox" id="w-d1" required><label for="w-d1">The information and documents I've given are true. I understand that a false declaration is misconduct and can lead to removal (Article 11).</label></div>
        <div class="check"><input type="checkbox" id="w-d2" required><label for="w-d2">I will follow ROAR's Code of Conduct (Article 39).</label></div>
        <div class="check"><input type="checkbox" id="w-d3" required><label for="w-d3">ROAR may store and verify these details and documents to process my membership. See the <a href="../privacy.html" target="_blank">privacy note</a>.</label></div>`,
    ];

    root.innerHTML = `<div class="wizard">
      <span class="eyebrow">Membership application</span>
      <h1 style="font-size:clamp(2rem,4.5vw,3rem);margin:0">Join ROAR</h1>
      <ol class="stepper">${STEPS.map((s, i) => `<li class="${i < step ? 'done' : i === step ? 'on' : ''}"><span>${i + 1}. ${s}</span></li>`).join('')}</ol>
      <form class="step-card glass pform" id="w-form" novalidate>
        ${bodies[step]()}
        <p class="msg" id="w-msg" role="status"></p>
        <div class="step-actions">
          ${step > 0 ? '<button type="button" class="btn btn-glass" id="w-back">Back</button>' : '<button type="button" class="btn btn-glass" id="w-out">Sign out</button>'}
          <button type="submit" class="btn btn-primary">${step < 3 ? 'Continue' : 'Submit application'}</button>
        </div>
      </form>
    </div>`;

    const msg = (t, k) => { const el = $('#w-msg'); el.textContent = t; el.className = 'msg ' + (k || ''); };
    const back = $('#w-back');
    if (back) back.addEventListener('click', () => { collect(); wizard(step - 1); });
    const out = $('#w-out');
    if (out) out.addEventListener('click', async () => { await API.signOut(); render(); });

    if (step === 0) root.querySelectorAll('[name="w-as"]').forEach(r => r.addEventListener('change', () => { $('#w-spec-row').hidden = r.value !== 'honorary'; }));
    if (step === 1) {
      const preview = () => {
        const w = R.votingWindow({ pg_start: $('#w-start').value, pg_completion: $('#w-end').value || null });
        const cat = R.category({ applying_as: d.applying_as, pg_completion: $('#w-end').value || null });
        $('#w-window').innerHTML = !w || isHon ? '' : `<div class="notice${cat === 'senior' ? ' warn' : ''}">
          ${cat === 'senior' ? 'You are more than 6 years after PG, so you would join as a <b>Senior Member without a vote</b>. Consider applying as an Honorary Member instead.'
            : `Your voting window: <b>${fmt(w.from)}</b> to <b>${fmt(w.until)}</b>${w.estimated ? ' (estimated from a 3-year course until your completion date is known)' : ''}.`}</div>`;
      };
      ['#w-start', '#w-end'].forEach(s => $(s).addEventListener('input', preview));
      preview();
    }
    if (step === 2) {
      [['#w-id', 'id_card'], ['#w-proof', 'proof']].forEach(([s, k]) => $(s).addEventListener('change', e => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) { e.target.value = ''; return msg('That file is over 5 MB. Please upload a smaller scan.', 'err'); }
        if (!/^(application\/pdf|image\/(jpeg|png))$/.test(f.type)) { e.target.value = ''; return msg('Please upload a PDF, JPG or PNG.', 'err'); }
        files[k] = f; msg('');
        e.target.parentElement.querySelector('.file-ok')?.remove();
        e.target.insertAdjacentHTML('afterend', `<div class="file-ok">✓ ${esc(f.name)}</div>`);
      }));
    }

    function collect() {
      const v = s => { const el = $(s); return el ? el.value.trim() : undefined; };
      if (step === 0) save({ full_name: v('#w-name'), phone: v('#w-phone'), applying_as: (root.querySelector('[name="w-as"]:checked') || {}).value || 'resident', specialty: v('#w-spec') });
      if (step === 1) save({ course: v('#w-course'), institution: v('#w-inst'), city: v('#w-city'), state: v('#w-state'), pg_start: v('#w-start'), pg_completion: v('#w-end') });
      if (step === 3) save({ plan: (root.querySelector('[name="w-plan"]:checked') || {}).value || 'annual', fee_deferral_requested: !!(root.querySelector('#w-defer') || {}).checked });
    }

    $('#w-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      collect();
      if (!ev.target.reportValidity()) return;
      if (step === 0 && (!d.full_name || d.full_name.length < 2)) return msg('Please enter your full name.', 'err');
      if (step === 1) {
        if (!isHon && !d.pg_start) return msg('Please enter your PG start date.', 'err');
        if (d.pg_completion && d.pg_start && d.pg_completion <= d.pg_start) return msg('The completion date must be after the start date.', 'err');
        if (d.pg_start && d.pg_start > R.todayIST()) return msg('The PG start date can\'t be in the future.', 'err');
      }
      if (step === 2 && (!files.id_card || !files.proof)) return msg('Please upload both documents.', 'err');
      if (step < 3) return wizard(step + 1);

      // Submit
      const btn = ev.submitter; btn.disabled = true; btn.textContent = 'Uploading…';
      try {
        const id_card_path = await API.upload('id-card', files.id_card, sess);
        const proof_path = await API.upload('proof', files.proof, sess);
        btn.textContent = 'Submitting…';
        await API.create({
          full_name: d.full_name, phone: d.phone || null, applying_as: d.applying_as, specialty: isHon ? d.specialty : null,
          course: d.course, institution: d.institution, city: d.city || null, state: d.state || null,
          pg_start: d.pg_start || null, pg_completion: d.pg_completion || null,
          id_card_path, proof_path, plan: d.plan, fee_deferral_requested: !!d.fee_deferral_requested,
          declarations_at: new Date().toISOString(), redeclared_at: new Date().toISOString(),
        }, sess);
        store.del(DRAFT_KEY); files = { id_card: null, proof: null };
        toast('Application submitted');
        render();
      } catch (e) { btn.disabled = false; btn.textContent = 'Submit application'; msg(e.message, 'err'); }
    });
  }

  // ===================================================================
  // Dashboard
  // ===================================================================
  async function dashboard() {
    const m = member;
    const approved = m.status === 'approved';
    const w = R.votingWindow(m);
    const today = R.todayIST();
    const [ballots, receipts] = approved ? await Promise.all([API.ballots(), API.myReceipts(m)]) : [[], new Set()];
    const results = {};
    await Promise.all(ballots.filter(b => b.status === 'closed').map(async b => { results[b.id] = await API.results(b); }));
    const firstName = m.full_name.replace(/^Dr\.?\s*/i, '').split(' ')[0];
    const paid = m.plan === 'annual' ? (m.paid_until && m.paid_until >= today) : !!m.payment_ref;
    const due = new Date(new Date(m.created_at).getTime() + R.VERIFY_DAYS * 864e5).toISOString();
    const voteState = !w ? null : today < w.from ? 'Not yet: your vote starts on ' + fmt(w.from) : today > w.until ? 'Ended: you passed the 6-year limit' : 'Within your voting window';

    const statusPanel = approved ? '' : `<div class="panel glass">
      <h2>Your application</h2>
      ${m.status === 'rejected' ? `<div class="notice bad"><b>Not approved.</b> Reason: ${esc(m.rejection_reason || '—')}</div>
        <form class="pform" id="appeal-form"><label for="appeal">Appeal to the Executive Council (Article 10), or explain what you've corrected</label>
        <textarea id="appeal" required maxlength="4000">${esc(m.appeal)}</textarea>
        <button class="btn btn-primary" style="margin-top:12px" type="submit">Send appeal and resubmit</button></form>` : `
      <ol class="timeline-steps">
        <li class="done"><div><b>Submitted</b><br><span class="muted">${fmtTime(m.created_at)}</span></div></li>
        <li class="${m.status === 'under_review' ? 'now' : m.status === 'submitted' ? 'now' : 'done'}"><div><b>Verification of your documents</b><br><span class="muted">By the Treasurer &amp; Memberships secretary, due by ${fmt(due)}</span></div></li>
        <li><div><b>Approved and payment</b><br><span class="muted">You'll get your member number and payment details</span></div></li>
      </ol>`}
    </div>`;

    const card = `<div class="mcard${approved ? '' : ' pending'}" aria-label="Membership card">
      <div class="mc-top"><span class="brand" style="color:#fff"><img class="brand-mark" src="../favicon.svg" alt=""><span class="brand-word">ROAR</span></span>${m.plan === 'founding' ? '<span class="fm">Founding Member</span>' : ''}</div>
      <div class="mc-name">${esc(m.full_name)}</div>
      <div class="mc-cat">${approved ? esc(R.CATEGORY_LABEL[m.category] || '') : 'Pending verification'}${m.institution ? ' · ' + esc(m.institution) : ''}</div>
      <div class="mc-row">
        <div>Member no.<b>${esc(m.member_no || '—')}</b></div>
        <div>Valid until<b>${!approved ? '—' : m.plan === 'annual' ? (m.paid_until ? fmt(m.paid_until) : 'Awaiting payment') : (paid ? 'Life' : 'Awaiting payment')}</b></div>
        <div>Vote<b>${approved && isFounder ? 'For life' : approved && w && today >= w.from && today <= w.until && ['resident', 'young_ro'].includes(m.category) ? 'Yes' : 'No'}</b></div>
      </div>
    </div>`;

    const payPanel = !approved ? '' : `<div class="panel glass">
      <h2>Membership &amp; payment</h2>
      <dl class="kv"><dt>Plan</dt><dd>${esc(R.PLAN_LABEL[m.plan])}</dd>
        <dt>Status</dt><dd>${m.fee_deferred ? 'Fee deferred (Article 8J)' : paid ? (m.plan === 'annual' ? 'Paid until ' + fmt(m.paid_until) : 'Paid for life') : 'Awaiting payment'}</dd></dl>
      ${!paid && !m.fee_deferred ? `<div class="notice" style="margin-top:14px">The Treasurer will email you payment details. Quote your member number <b>${esc(m.member_no)}</b> with your payment.</div>` : ''}
      ${m.plan === 'annual' && paid && m.paid_until <= R.addMonths(today, 1) ? '<div class="notice warn" style="margin-top:14px">Your membership is due for renewal within a month.</div>' : ''}
    </div>`;

    const vwPanel = !w || m.applying_as === 'honorary' ? '' : (() => {
      const span = Date.parse(w.until) - Date.parse(m.pg_start);
      const pos = d => Math.max(0, Math.min(100, (Date.parse(d) - Date.parse(m.pg_start)) / span * 100));
      return `<div class="panel glass">
        <h2>Your voting window</h2>
        <p style="margin:0">${isFounder ? "As a founder you keep voting rights for life (Article 15A)." : esc(voteState)}</p>
        <div class="vw-bar"><i style="left:${pos(w.from)}%;right:0"></i><span class="now" style="left:${pos(today)}%" title="Today"></span></div>
        <div class="vw-labels"><span>PG start ${fmt(m.pg_start)}</span><span>Vote from ${fmt(w.from)}</span><span>Until ${fmt(w.until)}</span></div>
        ${w.estimated ? '<p class="hint muted" style="font-size:.82rem;margin:10px 0 0">The end date is estimated from a 3-year course. It will be fixed when your completion date is added.</p>' : ''}
        ${m.clock_pause_months ? `<p style="font-size:.88rem;margin:10px 0 0">Approved pause: ${m.clock_pause_months} months.</p>` : ''}
        <details style="margin-top:14px"><summary class="linklike" style="text-decoration:none">Request a pause on the 6-year clock</summary>
          <form class="pform" id="pause-form" style="margin-top:12px"><label for="pause">Reason and dates: parental leave, documented serious illness, or a full-time research degree (up to 24 months in total)</label>
          <textarea id="pause" required maxlength="2000">${esc(m.clock_pause_request)}</textarea>
          <button class="btn btn-glass small" style="margin-top:10px" type="submit">Send request</button></form>
        </details>
      </div>`;
    })();

    const ballotHTML = b => {
      const voted = receipts.has(b.id);
      const now = new Date().toISOString();
      const live = b.status === 'open' && now >= b.opens_at && now <= b.closes_at;
      const elig = R.canVote(m, b, { isFounder });
      let action = '';
      if (b.status === 'closed') {
        const r = results[b.id];
        const res = (r && r.results) || {};
        const total = Object.values(res).reduce((a, c) => a + c, 0) || 1;
        action = `<div>${b.options.map(o => `<div class="res-row"><span>${esc(o)}</span><span class="bar"><i style="width:${(res[o] || 0) / total * 100}%"></i></span><span>${res[o] || 0}</span></div>`).join('')}</div>`;
      } else if (voted) action = '<div class="notice" style="margin:0">✓ Your vote is recorded. Ballots are secret: nobody, not even the founders, can see how you voted.</div>';
      else if (!live) action = `<p class="muted" style="margin:0">Opens ${fmtTime(b.opens_at)}.</p>`;
      else if (!elig.ok) action = `<div class="notice warn" style="margin:0">${esc(elig.reason)}${elig.needsRedeclare ? ' <button class="btn btn-glass small" data-redeclare style="margin-left:8px">My PG dates are correct</button>' : ''}</div>`;
      else action = `<div class="opts">${b.options.map(o => `<button class="btn btn-glass" data-vote="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
      return `<div class="ballot" data-id="${esc(b.id)}">
        <div class="meta-row"><span class="tag">${esc(b.kind)}</span><span class="tag tag-quiet">${b.status === 'closed' ? 'Closed' : live ? 'Voting open' : 'Upcoming'}</span></div>
        <h3>${esc(b.title)}</h3>
        <div class="when">${fmtTime(b.opens_at)} – ${fmtTime(b.closes_at)}</div>
        ${b.description ? `<p style="font-size:.92rem">${esc(b.description)}</p>` : ''}
        ${action}
      </div>`;
    };
    const ballotsPanel = !approved ? '' : `<div class="panel glass">
      <h2>Ballots</h2>
      ${ballots.length ? ballots.map(ballotHTML).join('') : '<p class="muted" style="margin:0">No ballots yet. Elections and consultations will appear here.</p>'}
    </div>`;

    const profilePanel = `<div class="panel glass">
      <h2>Your details</h2>
      <dl class="kv">
        <dt>Email</dt><dd>${esc(m.email)}</dd>
        <dt>Applying as</dt><dd>${esc({ resident: 'RO resident', post_pg: 'Young RO', honorary: 'Honorary member' }[m.applying_as])}${m.specialty ? ' · ' + esc(m.specialty) : ''}</dd>
        <dt>Course</dt><dd>${esc(m.course || '—')}</dd>
        <dt>PG dates</dt><dd>${fmt(m.pg_start)} to ${m.pg_completion ? fmt(m.pg_completion) : 'in progress'}</dd>
        <dt>Documents</dt><dd>${m.id_card_path && m.proof_path ? 'ID card and proof uploaded' : 'Missing'}</dd>
      </dl>
      <form class="pform" id="profile-form" style="margin-top:16px">
        <div class="row"><div><label for="p-phone">WhatsApp</label><input id="p-phone" value="${esc(m.phone)}"></div>
          <div><label for="p-inst">Current institution</label><input id="p-inst" value="${esc(m.institution)}"></div></div>
        <div class="row"><div><label for="p-city">City</label><input id="p-city" value="${esc(m.city)}"></div>
          <div><label for="p-state">State / UT</label><select id="p-state"><option value="">—</option>${R.STATES.map(s => `<option${m.state === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div></div>
        <button class="btn btn-glass small" type="submit">Save changes</button>
        <p class="hint">PG dates are locked after verification. To correct them, <a href="../contact.html?topic=Membership">contact us</a>.</p>
      </form>
    </div>`;

    root.innerHTML = `
      ${!LIVE ? '<div class="notice">Demo mode: this member lives only in this browser. Verify the application in the <a href="../council/#/members">Founders\' console</a> (sign in as the Treasurer).</div>' : ''}
      <div class="dash-head">
        <div><span class="eyebrow">Member portal</span><h1>Hello, ${esc(firstName)}.</h1></div>
        <button class="btn btn-glass small" id="out">Sign out</button>
      </div>
      <div class="dash">
        <div>${statusPanel}${card}${payPanel}${profilePanel}</div>
        <div>${vwPanel}${ballotsPanel}</div>
      </div>`;

    $('#out').addEventListener('click', async () => { await API.signOut(); render(); });

    const af = $('#appeal-form');
    if (af) af.addEventListener('submit', async e => {
      e.preventDefault();
      try { await API.update(m, { appeal: $('#appeal').value.trim(), status: 'submitted' }); toast('Appeal sent'); render(); } catch (err) { fail(err); }
    });
    const pf = $('#pause-form');
    if (pf) pf.addEventListener('submit', async e => {
      e.preventDefault();
      try { await API.update(m, { clock_pause_request: $('#pause').value.trim() }); toast('Request sent to the Membership Committee'); render(); } catch (err) { fail(err); }
    });
    $('#profile-form').addEventListener('submit', async e => {
      e.preventDefault();
      const v = s => $(s).value.trim() || null;
      try { await API.update(m, { phone: v('#p-phone'), institution: v('#p-inst'), city: v('#p-city'), state: v('#p-state') }); toast('Saved'); render(); } catch (err) { fail(err); }
    });
    root.querySelectorAll('.ballot').forEach(el => {
      const b = ballots.find(x => x.id === el.dataset.id);
      el.querySelectorAll('[data-vote]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm(`Cast your vote for "${btn.dataset.vote}"? You can't change it afterwards.`)) return;
        try { await API.cast(b, btn.dataset.vote, m, isFounder); toast('Vote cast'); render(); } catch (err) { fail(err); }
      }));
      const rd = el.querySelector('[data-redeclare]');
      if (rd) rd.addEventListener('click', async () => {
        try { await API.update(m, { redeclared_at: new Date().toISOString() }); toast('Thank you. Your PG dates are confirmed.'); render(); } catch (err) { fail(err); }
      });
    });
  }

  render();
})();
