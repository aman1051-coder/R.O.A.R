// ROAR Founders' Council console.
// Live mode: Supabase (auth + database, protected by the rules in supabase/schema.sql).
// Demo mode: when js/config.js is empty, data is kept in this browser's localStorage.
(() => {
  'use strict';

  const cfg = window.ROAR_CONFIG || {};
  const LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const R = window.ROAR_RULES;
  const QUORUM = 5;               // Article 32A: at least 5 of the 9 founders
  const NON_VOTES = ['Abstain'];  // counted for quorum, not for the result

  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (v, withTime) => {
    if (!v) return '';
    const d = new Date(v.length === 10 ? v + 'T00:00:00+05:30' : v);
    if (isNaN(d)) return esc(v);
    return d.toLocaleString('en-IN', withTime
      ? { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }
      : { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });
  };
  const initials = name => String(name || '?').replace(/^Dr\.?\s*/i, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), isErr ? 6000 : 2600);
  }
  const fail = e => { console.error(e); toast(e && e.message ? e.message : 'Something went wrong', true); };

  // =====================================================================
  // Data layer
  // =====================================================================
  const initialHash = location.hash; // read before Supabase consumes auth tokens in the URL
  let sb = null;
  if (LIVE && window.supabase) sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const Demo = {
    KEY: 'roar-council-demo-v3',
    s: null,
    load() {
      try { this.s = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { this.s = null; }
      if (!this.s) { this.s = JSON.parse(JSON.stringify(window.ROAR_DEMO_SEED)); this.save(); }
      // Older demo data: fill in founder usernames/IDs and any tables added since
      const seed = window.ROAR_DEMO_SEED;
      (this.s.founders || []).forEach(f => { const sf = seed.founders.find(x => x.email === f.email); if (sf) { f.username = f.username || sf.username; f.founder_id = f.founder_id || sf.founder_id; if (f.can_reset_passwords === undefined) f.can_reset_passwords = sf.can_reset_passwords; if (!f.pw_hash) f.password_set = false; } });
      Object.keys(seed).forEach(k => { if (!this.s[k]) this.s[k] = JSON.parse(JSON.stringify(seed[k])); });
      if (!this.s.surveys && window.ROAR_SURVEY) {
        const T = JSON.parse(JSON.stringify(window.ROAR_SURVEY));
        const now = new Date().toISOString();
        this.s.surveys = [
          { id: uid(), slug: T.id, kind: 'survey', title: T.title, intro: T.intro, version: T.version, definition: { minutes: T.minutes, helpline: T.helpline, sections: T.sections }, status: 'draft', audience: 'everyone', show_results: false, created_by: 'deepika@demo.roar', created_at: '2026-11-10T09:00:00+05:30', updated_at: now },
          { id: uid(), slug: 'poll-contour-club-day', kind: 'poll', title: 'EXAMPLE: Which day suits you best for Contour Club?', intro: null, version: '1', definition: { minutes: 1, sections: [{ id: 'poll', title: 'EXAMPLE: Which day suits you best for Contour Club?', questions: [{ id: 'answer', type: 'single', label: 'EXAMPLE: Which day suits you best for Contour Club?', required: true, options: ['Saturday evening', 'Sunday morning', 'Sunday evening', 'A weekday evening'] }] }] }, status: 'open', audience: 'members', show_results: true, created_by: 'arshida@demo.roar', created_at: '2026-11-10T10:00:00+05:30', updated_at: now },
        ];
        this.save();
      }
    },
    save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.s)); } catch (e) { /* private mode: keep in memory */ } },
    reset() { try { localStorage.removeItem(this.KEY); } catch (e) { } this.s = null; this.load(); },
  };

  let me = null;          // { email, name, cabinet_role, is_admin }
  let founders = [];

  const DB = {
    async list(table, order) {
      if (LIVE) {
        let q = sb.from(table).select('*');
        if (order) q = q.order(order[0], { ascending: order[1] !== false });
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      }
      const rows = JSON.parse(JSON.stringify(Demo.s[table] || []));
      if (order) {
        const [col, asc] = order;
        rows.sort((a, b) => (a[col] ?? '') > (b[col] ?? '') ? (asc === false ? -1 : 1) : (a[col] ?? '') < (b[col] ?? '') ? (asc === false ? 1 : -1) : 0);
      }
      return rows;
    },
    async insert(table, row) {
      if (LIVE) {
        const { data, error } = await sb.from(table).insert(row).select().single();
        if (error) throw error;
        return data;
      }
      const r = { id: uid(), created_at: new Date().toISOString(), ...row };
      (Demo.s[table] = Demo.s[table] || []).push(r);
      Demo.save();
      return r;
    },
    async update(table, key, patch, keyCol = 'id') {
      if (LIVE) {
        const { error } = await sb.from(table).update(patch).eq(keyCol, key);
        if (error) throw error;
        return;
      }
      const r = (Demo.s[table] || []).find(x => x[keyCol] === key);
      if (r) Object.assign(r, patch);
      Demo.save();
    },
    async remove(table, key, keyCol = 'id') {
      if (LIVE) {
        const { error } = await sb.from(table).delete().eq(keyCol, key);
        if (error) throw error;
        return;
      }
      Demo.s[table] = (Demo.s[table] || []).filter(x => x[keyCol] !== key);
      if (table === 'motions') Demo.s.votes = Demo.s.votes.filter(v => v.motion_id !== key);
      Demo.save();
    },
    // Visible votes: all votes on open ballots, only your own on secret ballots
    async votes(motions) {
      if (LIVE) {
        const { data, error } = await sb.from('votes').select('*');
        if (error) throw error;
        return data || [];
      }
      const secret = new Set(motions.filter(m => m.secret).map(m => m.id));
      return Demo.s.votes.filter(v => !secret.has(v.motion_id) || v.voter_email === me.email);
    },
    // Totals per motion and choice (works for secret ballots too)
    async tallies() {
      let rows;
      if (LIVE) {
        const { data, error } = await sb.from('motion_tallies').select('*');
        if (error) throw error;
        rows = data || [];
      } else {
        const map = {};
        Demo.s.votes.forEach(v => { const k = v.motion_id + '|' + v.choice; map[k] = (map[k] || 0) + 1; });
        rows = Object.entries(map).map(([k, n]) => ({ motion_id: k.split('|')[0], choice: k.split('|')[1], n }));
      }
      const out = {};
      rows.forEach(r => { (out[r.motion_id] = out[r.motion_id] || {})[r.choice] = r.n; });
      return out;
    },
    async vote(motion_id, choice) {
      if (LIVE) {
        const { error } = await sb.from('votes').upsert({ motion_id, choice, voter_email: me.email }, { onConflict: 'motion_id,voter_email' });
        if (error) throw error;
        return;
      }
      const v = Demo.s.votes.find(x => x.motion_id === motion_id && x.voter_email === me.email);
      if (v) v.choice = choice; else Demo.s.votes.push({ id: uid(), motion_id, voter_email: me.email, choice });
      Demo.save();
    },
    async setting(key) {
      if (LIVE) { const { data } = await sb.from('settings').select('value').eq('key', key).maybeSingle(); return data ? data.value : null; }
      const r = (Demo.s.settings || []).find(x => x.key === key); return r ? r.value : null;
    },
    async setSetting(key, value) {
      if (LIVE) { const { error } = await sb.from('settings').upsert({ key, value }); if (error) throw error; return; }
      Demo.s.settings = Demo.s.settings || [];
      const r = Demo.s.settings.find(x => x.key === key);
      if (r) r.value = value; else Demo.s.settings.push({ key, value });
      Demo.save();
    },
    async docUrl(path) {
      if (!path) return null;
      if (!LIVE) { toast('Demo mode: the file "' + path.replace(/^demo\//, '') + '" is not actually stored'); return null; }
      const { data, error } = await sb.storage.from('member-docs').createSignedUrl(path, 300);
      if (error) throw error;
      return data.signedUrl;
    },
    async electionStats(e) {
      if (LIVE) {
        const { data, error } = await sb.rpc('election_stats', { p_election: e.id });
        if (error) throw error;
        return data && data[0] ? data[0] : { voted: 0, eligible: 0, results: null };
      }
      const voted = (Demo.s.ballot_receipts || []).filter(r => r.election_id === e.id).length;
      const eligible = (Demo.s.members || []).filter(m => R.canVote(m, e, { isFounder: founders.some(f => f.email === m.email) }).ok).length;
      let results = null;
      if (e.status === 'closed') { results = {}; (Demo.s.ballot_votes || []).filter(v => v.election_id === e.id).forEach(v => { results[v.choice] = (results[v.choice] || 0) + 1; }); }
      return { voted, eligible, results };
    },
    async unvote(motion_id) {
      if (LIVE) {
        const { error } = await sb.from('votes').delete().eq('motion_id', motion_id).eq('voter_email', me.email);
        if (error) throw error;
        return;
      }
      Demo.s.votes = Demo.s.votes.filter(x => !(x.motion_id === motion_id && x.voter_email === me.email));
      Demo.save();
    },
  };

  // =====================================================================
  // Sign-in
  // =====================================================================
  const screens = ['#login-form', '#password-form', '#not-founder', '#not-connected'];
  function showLogin(which) {
    $('#app').hidden = true;
    $('#login-screen').hidden = false;
    screens.forEach(s => { $(s).hidden = s !== which; });
  }
  const msg = (el, text, kind) => { el.textContent = text; el.className = 'form-msg ' + (kind || ''); };

  async function init() {
    if (!LIVE && !window.ROAR_DEMO_OK) return showLogin('#not-connected');
    if (!LIVE) {
      Demo.load();
      founders = Demo.s.founders;
      let last = null;
      try { last = localStorage.getItem('roar-council-demo-user'); } catch (e) { }
      if (last && founders.some(f => f.email === last && f.password_set)) { me = founders.find(f => f.email === last); return startApp(); }
      lfShow('user');
      return showLogin('#login-form');
    }
    if (!sb) { showLogin('#login-form'); msg($('#login-msg'), 'Could not load the sign-in library. Check your connection and reload.', 'err'); return; }

    const needsPassword = /type=(invite|recovery)/.test(initialHash);
    sb.auth.onAuthStateChange(evt => { if (evt === 'PASSWORD_RECOVERY') showLogin('#password-form'); });
    const { data } = await sb.auth.getSession();
    if (!data.session) { lfShow('user'); return showLogin('#login-form'); }
    await afterSignIn(needsPassword);
  }

  async function afterSignIn(needsPassword) {
    try {
      founders = await DB.list('founders', ['sort']);
    } catch (e) { founders = []; }
    const { data } = await sb.auth.getUser();
    const email = (data.user && data.user.email || '').toLowerCase();
    me = founders.find(f => f.email === email) || null;
    if (!me) return showLogin('#not-founder');
    if (needsPassword) return showLogin('#password-form');
    startApp();
  }

  // Founders sign in with a username (or their Founder ID, FC-01 … FC-09); an email address also works.
  const FOUNDER_USERNAMES = cfg.founderUsernames || ['akash.bellige', 'aman.gupta', 'kratika.bhatia', 'shriya.dhingra', 'deepika.sharma', 'arshida.p', 'arsheya.gupta', 'honey.sharma', 'abhishek.bhadri'];
  function loginEmail(id) {
    if (id.includes('@')) return id;
    const m = id.match(/^fc-?0?([1-9])$/);          // FC-01 -> the first founder's username
    const username = m ? FOUNDER_USERNAMES[+m[1] - 1] : id;
    return `${username}@${cfg.founderLoginDomain || 'founders.roar.invalid'}`;
  }


  // ---------------- Founder sign-in ----------------
  // 1. Username (or Founder ID). 2a. Their own password, or 2b. on a first sign-in (or after the Chairman
  // resets them), they choose a password. The database (schema PART 8) enforces the same rules.
  const toUsername = id => { const m = id.match(/^fc-?0?([1-9])$/); return m ? FOUNDER_USERNAMES[+m[1] - 1] : id; };
  const sha = async (txt) => {   // demo only: never store demo passwords as plain text
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  const Auth = {
    // Username or Founder ID -> the founder's current username (the database knows about renames)
    async resolve(id) {
      if (LIVE) { const { data } = await sb.rpc('founder_username', { p_login: id }); if (data) return data; }
      return toUsername(id);
    },
    async status(username) {
      if (!LIVE) { const f = founders.find(x => x.username === username); return !f ? 'unknown' : f.password_set ? 'password' : 'choose_password'; }
      const { data, error } = await sb.rpc('founder_login_status', { p_username: username });
      if (error) throw error;
      return data;
    },
    async firstLogin(username, pw) {
      if (!LIVE) {
        const f = founders.find(x => x.username === username);
        if (!f || f.password_set) throw new Error('This account already has a password. Sign in with it, or ask the Chairman to reset it.');
        f.pw_hash = await sha(f.email + ':' + pw); f.password_set = true; Demo.save(); return;
      }
      const { error } = await sb.rpc('founder_first_login', { p_username: username, p_password: pw });
      if (error) throw error;
    },
    async signIn(username, pw) {
      if (!LIVE) {
        const f = founders.find(x => x.username === username);
        if (!f || !f.password_set || f.pw_hash !== await sha(f.email + ':' + pw)) throw new Error('That password is not right. Try again, or ask the Chairman to reset it.');
        me = f; try { localStorage.setItem('roar-council-demo-user', f.email); } catch (e) { }
        return;
      }
      const { error } = await sb.auth.signInWithPassword({ email: loginEmail(username), password: pw });
      if (error) throw new Error(/invalid/i.test(error.message) ? 'That password is not right. Try again, or ask the Chairman to reset it.' : error.message);
    },
    async reset(username) {
      if (!LIVE) { const f = founders.find(x => x.username === username); f.password_set = false; delete f.pw_hash; Demo.save(); return; }
      const { error } = await sb.rpc('founder_reset_password', { p_username: username });
      if (error) throw error;
    },
    async setFor(username, pw) {
      if (!LIVE) { const f = founders.find(x => x.username === username); f.pw_hash = await sha(f.email + ':' + pw); f.password_set = true; Demo.save(); return; }
      const { error } = await sb.rpc('founder_set_password', { p_username: username, p_password: pw });
      if (error) throw error;
    },
    async changeOwn(pw) {
      if (!LIVE) { me.pw_hash = await sha(me.email + ':' + pw); me.password_set = true; Demo.save(); return; }
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw error;
    },
  };

  let lfStep = 'user', lfUsername = null;
  function lfShow(step) {
    lfStep = step;
    ['user', 'pass', 'new'].forEach(k => { $('#lf-' + k).hidden = k !== step; });
    $('#lf-back').hidden = step === 'user';
    document.querySelectorAll('.lf-name').forEach(el => { el.textContent = lfUsername || ''; });
    const focus = { user: '#login-email', pass: '#login-password', new: '#lf-new1' }[step];
    setTimeout(() => { const el = $(focus); if (el) el.focus(); }, 30);
  }
  $('#lf-back').addEventListener('click', () => { lfUsername = null; ['#login-password', '#lf-new1', '#lf-new2'].forEach(s => { $(s).value = ''; }); msg($('#login-msg'), ''); lfShow('user'); });

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const m = $('#login-msg');
    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      if (lfStep === 'user') {
        const id = $('#login-email').value.trim().toLowerCase();
        if (!id) return msg(m, 'Enter your username.', 'err');
        if (id.includes('@')) { lfUsername = id; msg(m, ''); return lfShow('pass'); }
        msg(m, 'Checking…');
        lfUsername = await Auth.resolve(id);
        const st = await Auth.status(lfUsername);
        if (st === 'unknown') { lfUsername = null; return msg(m, 'That username is not on the Founders\u2019 Council list.', 'err'); }
        msg(m, '');
        return lfShow(st === 'password' ? 'pass' : 'new');
      }
      if (lfStep === 'pass') {
        const pw = $('#login-password').value;
        if (!pw) return msg(m, 'Enter your password.', 'err');
        msg(m, 'Signing in…');
        await Auth.signIn(lfUsername, pw);
      } else {
        const p1 = $('#lf-new1').value, p2 = $('#lf-new2').value;
        if (p1.length < 10) return msg(m, 'Use at least 10 characters.', 'err');
        if (p1 !== p2) return msg(m, 'The two passwords do not match.', 'err');
        msg(m, 'Saving your password…');
        await Auth.firstLogin(lfUsername, p1);
        await Auth.signIn(lfUsername, p1);
        toast('Password saved. Use it every time you sign in.');
      }
      msg(m, '');
      ['#login-password', '#lf-new1', '#lf-new2'].forEach(s => { $(s).value = ''; });
      if (LIVE) afterSignIn(false); else startApp();
    } catch (err) { msg(m, err.message || 'Something went wrong.', 'err'); }
    finally { if (btn) btn.disabled = false; }
  });

  $('#change-pass').addEventListener('click', () => openEditor({
    title: 'Change my password',
    fields: [{ key: 'pw', label: 'New password (at least 10 characters)', type: 'password', required: true, full: true },
      { key: 'pw2', label: 'Type it again', type: 'password', required: true, full: true }],
    onSave: async v => {
      if ((v.pw || '').length < 10) throw new Error('Use at least 10 characters.');
      if (v.pw !== v.pw2) throw new Error('The two passwords do not match.');
      await Auth.changeOwn(v.pw);
    },
  }));

  $('#password-form').addEventListener('submit', async e => {
    e.preventDefault();
    const password = $('#new-password').value;
    if (password.length < 10) return msg($('#password-msg'), 'Use at least 10 characters.', 'err');
    const { error } = await sb.auth.updateUser({ password });
    if (error) return msg($('#password-msg'), error.message, 'err');
    history.replaceState(null, '', location.pathname);
    msg($('#password-msg'), 'Password saved.', 'ok');
    afterSignIn(false);
  });

  // One account for the whole site: tell the header (and the member portal, in demo mode) who is signed in
  function shareAccount() {
    try {
      let prev = {}; try { prev = JSON.parse(localStorage.getItem('roar-me') || '{}') || {}; } catch (e) { }
      const keep = prev.email === me.email ? prev : {};
      localStorage.setItem('roar-me', JSON.stringify({ ...keep, email: me.email, name: me.name, founder: true, founder_id: me.founder_id || null }));
      if (!LIVE) localStorage.setItem('roar-portal-demo-user', JSON.stringify({ email: me.email, name: me.name }));
    } catch (e) { }
  }

  async function signOut() {
    if (LIVE) await sb.auth.signOut();
    else { try { localStorage.removeItem('roar-council-demo-user'); localStorage.removeItem('roar-portal-demo-user'); } catch (e) { } }
    try { localStorage.removeItem('roar-me'); } catch (e) { }
    me = null; lfUsername = null; lfShow('user');
    location.hash = '';
    init();
  }
  $('#sign-out').addEventListener('click', signOut);
  $('#not-founder-out').addEventListener('click', signOut);
  $('#demo-reset').addEventListener('click', () => {
    if (!confirm('Reset all demo data in this browser?')) return;
    Demo.reset(); founders = Demo.s.founders; me = founders.find(f => f.email === me.email) || founders[0];
    route(); toast('Demo data reset');
  });

  // =====================================================================
  // App shell and routing
  // =====================================================================
  const ICONS = {
    overview: '<path d="M3 12l9-8 9 8M5 10v10h14V10"/>',
    tracker: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    motions: '<path d="M4 4h16v12H5.2L4 17.2z"/><path d="M8 9h8M8 12h5"/>',
    meetings: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    registrations: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    ambassadors: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    announcements: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12"/>',
    library: '<path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5z"/><path d="M8 7h6"/>',
    members: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.8-1.8 2-2.6 3.5-2.6s2.7.8 3.5 2.6M15 9h3M15 13h3"/>',
    help: '<path d="M12 21a9 9 0 1 0-9-9c0 1.7.5 3.3 1.3 4.7L3 21l4.4-1.2A9 9 0 0 0 12 21z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.3M12 17h.01"/>',
    community: '<circle cx="12" cy="8" r="3.2"/><circle cx="5.5" cy="10" r="2.3"/><circle cx="18.5" cy="10" r="2.3"/><path d="M6.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M1.5 19c.3-2 1.6-3.3 3.6-3.5M22.5 19c-.3-2-1.6-3.3-3.6-3.5"/>',
    surveys: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
    elections: '<path d="M4 21h16M6 17V8l6-5 6 5v9"/><path d="M9.5 12l2 2 3.5-3.5"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
    opportunities: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20"/>',
    resources: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    founders: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
  };
  const VIEWS = [
    ['overview', 'Overview'], ['tracker', 'Launch tracker'], ['motions', 'Motions & votes'], ['meetings', 'Meetings & minutes'],
    ['section:Membership'],
    ['members', 'Members'], ['help', 'Career help'], ['elections', 'Elections & ballots'], ['surveys', 'Surveys & polls'], ['community', 'Community'], ['registrations', 'Interest list'], ['ambassadors', 'Ambassadors'],
    ['section:Public website'],
    ['inbox', 'Inbox'], ['announcements', 'News'], ['events', 'Events'], ['opportunities', 'Opportunities'], ['resources', 'Learning resources'],
    ['section:Council'],
    ['library', 'Library'], ['founders', 'Founders'],
  ];

  function startApp() {
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    $('#demo-bar').hidden = LIVE;
    $('#me-name').textContent = me.name;
    $('#me-role').textContent = [me.founder_id, me.cabinet_role].filter(Boolean).join(' · ');
    $('#me-initials').textContent = initials(me.name);
    if (me.founder_id) $('#me-initials').dataset.founder = me.founder_id;   // their Community photo, if they have one
    shareAccount();
    $('#side-nav').innerHTML = VIEWS.map(([k, label]) => k.startsWith('section:')
      ? `<div class="side-label">${esc(k.slice(8))}</div>` :
      `<a href="#/${k}" data-view="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>${label}<span class="count" hidden></span></a>`).join('');
    route();
  }

  const sidebar = $('#sidebar');
  $('#side-toggle').addEventListener('click', () => sidebar.classList.toggle('open'));
  $('#side-nav').addEventListener('click', () => sidebar.classList.remove('open'));
  window.addEventListener('hashchange', () => { if (me) route(); });

  function setHeader(eyebrow, title, actions) {
    $('#view-eyebrow').textContent = eyebrow;
    $('#view-title').textContent = title;
    const box = $('#view-actions');
    box.innerHTML = '';
    (actions || []).forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-glass') + ' small';
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      box.appendChild(b);
    });
  }

  async function route() {
    const m = location.hash.match(/^#\/([\w-]+)(?:\/(.+))?/);
    const key = (m && m[1]) || 'overview';
    const arg = m && m[2] ? m[2] : null;
    const view = RENDER[key] ? key : 'overview';
    if (!LIVE) {   // demo: pick up anything saved from other tabs (survey answers, portal requests)
      Demo.load();
      founders = Demo.s.founders;
      if (me) me = founders.find(f => f.email === me.email) || me;
    }
    document.querySelectorAll('.side-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    $('#view').innerHTML = '<div class="empty">Loading…</div>';
    try { await RENDER[view](arg); } catch (e) { fail(e); $('#view').innerHTML = `<div class="panel glass empty">Couldn't load this section: ${esc(e.message || e)}</div>`; }
    updateBadges();
  }

  async function updateBadges() {
    try {
      const [regs, motions, msgs] = await Promise.all([DB.list('registrations'), DB.list('motions'), DB.list('messages')]);
      setBadge('inbox', msgs.filter(m => m.status === 'new').length);
      const mem = await DB.list('members');
      setBadge('members', mem.filter(m => m.status === 'submitted' || m.status === 'under_review').length);
      const hr = await DB.list('support_requests');
      setBadge('help', hr.filter(r => r.status === 'new').length);
      const votes = await DB.votes(motions);
      const mine = new Set(votes.filter(v => v.voter_email === me.email).map(v => v.motion_id));
      setBadge('registrations', regs.filter(r => r.status === 'new').length);
      setBadge('motions', motions.filter(m => m.status === 'open' && !mine.has(m.id)).length);
    } catch (e) { /* badges are optional */ }
  }
  function setBadge(view, n) {
    const el = document.querySelector(`.side-nav a[data-view="${view}"] .count`);
    if (!el) return;
    el.hidden = !n;
    el.textContent = n;
  }

  // =====================================================================
  // Generic editor dialog
  // =====================================================================
  const dlg = $('#editor');
  let dlgState = null;

  function fieldHTML(f, v) {
    const id = 'f-' + f.key;
    const req = f.required ? ' required' : '';
    const cls = f.full || f.type === 'textarea' ? 'full' : '';
    let input;
    if (f.type === 'textarea') input = `<textarea id="${id}"${req} rows="${f.rows || 5}">${esc(v)}</textarea>`;
    else if (f.type === 'select') input = `<select id="${id}"${req}>${f.options.map(o => {
      const [val, label] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(val)}"${String(v ?? '') === String(val) ? ' selected' : ''}>${esc(label)}</option>`;
    }).join('')}</select>`;
    else if (f.type === 'checkbox') return `<div class="${cls || 'full'} checkrow"><input type="checkbox" id="${id}"${v ? ' checked' : ''}><label for="${id}">${esc(f.label)}</label></div>`;
    else if (f.type === 'datetime') {
      let local = '';
      if (v) { const d = new Date(v); if (!isNaN(d)) local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
      input = `<input id="${id}" type="datetime-local" value="${local}"${req}>`;
    }
    else if (f.type === 'list') input = `<input id="${id}" value="${esc((v || []).join(', '))}"${req}>`;
    else input = `<input id="${id}" type="${f.type || 'text'}" value="${esc(v)}"${req}>`;
    return `<div class="${cls}"><label for="${id}">${esc(f.label)}</label>${input}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
  }

  function readField(f) {
    const el = document.getElementById('f-' + f.key);
    if (f.type === 'checkbox') return el.checked;
    const v = el.value.trim();
    if (f.type === 'datetime') return v ? new Date(v).toISOString() : null;
    if (f.type === 'list') return v.split(',').map(s => s.trim()).filter(Boolean);
    return v === '' ? null : v;
  }

  function openEditor({ title, fields, values = {}, onSave, onDelete, readOnly, info }) {
    dlgState = { fields, onSave, onDelete };
    $('#editor-title').textContent = title;
    $('#editor-fields').innerHTML = (info ? `<div class="full editor-info">${info}</div>` : '') + fields.map(f => fieldHTML(f, values[f.key])).join('');
    $('#editor-fields').querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', async () => {
      try { const url = await DB.docUrl(b.dataset.doc); if (url) window.open(url, '_blank', 'noopener'); } catch (e) { fail(e); }
    }));
    $('#editor-delete').hidden = !onDelete || readOnly;
    $('#editor-save').hidden = !!readOnly;
    $('#editor-fields').querySelectorAll('input, select, textarea').forEach(el => { el.disabled = !!readOnly; });
    fields.filter(f => f.readOnly).forEach(f => { const el = document.getElementById('f-' + f.key); if (el) el.disabled = true; });
    dlg.showModal();
  }

  $('#editor-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter;
    if (!btn || btn.value !== 'save') return dlg.close();
    if (!$('#editor-form').reportValidity()) return;
    const vals = {};
    dlgState.fields.forEach(f => { if (!f.readOnly) vals[f.key] = readField(f); });
    try {
      btn.disabled = true;
      await dlgState.onSave(vals);
      dlg.close();
      toast('Saved');
      route();
    } catch (err) { fail(err); } finally { btn.disabled = false; }
  });
  $('#editor-delete').addEventListener('click', async () => {
    if (!confirm('Delete this permanently?')) return;
    try { await dlgState.onDelete(); dlg.close(); toast('Deleted'); route(); } catch (err) { fail(err); }
  });

  // =====================================================================
  // Generic list ("CRUD") view
  // =====================================================================
  function pill(v) { return v ? `<span class="pill ${esc(String(v).toLowerCase())}">${esc(v)}</span>` : ''; }

  async function crudView(spec) {
    const rows = await DB.list(spec.table, spec.order);
    const canEdit = spec.canEdit ? spec.canEdit() : true;
    const keyCol = spec.key || 'id';
    const actions = [...(spec.actions ? spec.actions(rows) : [])];
    if (canEdit && !spec.noAdd) actions.push({
      label: spec.addLabel || 'Add', primary: true,
      onClick: () => openEditor({ title: spec.addLabel || 'Add', fields: spec.fields, values: spec.defaults || {}, onSave: v => {
        if (spec.validate) { const err = spec.validate(v, {}); if (err) throw new Error(err); }
        return (async () => DB.insert(spec.table, { ...(spec.defaults || {}), ...(spec.beforeSave ? await spec.beforeSave(v, {}) : v) }))();
      } }),
    });
    setHeader(spec.eyebrow, spec.title, actions);

    const filters = spec.filters || [];
    $('#view').innerHTML = `
      ${spec.intro ? `<p class="lead" style="margin-top:-6px">${spec.intro}</p>` : ''}
      ${spec.before || ''}
      <div class="toolbar">
        <input type="search" id="crud-q" placeholder="Search…" aria-label="Search">
        ${filters.map(f => `<select data-filter="${f.key}" aria-label="${esc(f.label)}"><option value="">All: ${esc(f.label)}</option>${f.options.map(o => `<option>${esc(o)}</option>`).join('')}</select>`).join('')}
      </div>
      <div class="table-wrap glass"><table class="data"><thead><tr>${spec.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody id="crud-body"></tbody></table></div>
      <p class="note" id="crud-count"></p>`;

    const draw = () => {
      const q = $('#crud-q').value.toLowerCase();
      const active = [...document.querySelectorAll('[data-filter]')].map(s => [s.dataset.filter, s.value]).filter(x => x[1]);
      const shown = rows.filter(r =>
        (!q || (spec.search || spec.columns.map(c => c.key)).some(k => String(r[k] ?? '').toLowerCase().includes(q))) &&
        active.every(([k, v]) => String(r[k]) === v));
      $('#crud-body').innerHTML = shown.length ? shown.map((r, i) => `<tr data-i="${rows.indexOf(r)}">${spec.columns.map((c, ci) =>
        `<td class="${ci === 0 ? 'strong' : ''}">${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${spec.columns.length}" class="empty">${esc(spec.empty || 'Nothing here yet.')}</td></tr>`;
      $('#crud-count').textContent = `${shown.length} of ${rows.length}`;
    };
    $('#crud-q').addEventListener('input', draw);
    document.querySelectorAll('[data-filter]').forEach(s => s.addEventListener('change', draw));
    $('#crud-body').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-i]');
      if (!tr || e.target.closest('a')) return;
      const r = rows[+tr.dataset.i];
      openEditor({
        title: spec.editTitle ? spec.editTitle(r) : 'Edit', fields: spec.fields, values: r, readOnly: !canEdit,
        info: spec.info ? spec.info(r) : '',
        onSave: async v => {
          if (spec.validate) { const err = spec.validate(v, r); if (err) throw new Error(err); }
          if (spec.beforeSave) v = await spec.beforeSave(v, r);
          return DB.update(spec.table, r[keyCol], v, keyCol);
        },
        onDelete: canEdit && spec.deletable !== false ? () => DB.remove(spec.table, r[keyCol], keyCol) : null,
      });
    });
    draw();
  }

  // =====================================================================
  // Views
  // =====================================================================
  const PHASES = [['first-3-months', 'First 3 months'], ['after-registration', 'After registration'], ['year-2', 'End of year 2']];
  const PORTFOLIOS = ['President', 'Chairman', 'General Secretary', 'Spokesperson', 'Social Media & Surveys', 'Academic Society & Graphics', 'Research Society', 'Grievances & Legalities', 'Treasurer & Memberships'];
  const STATES = ['Andaman & Nicobar', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];
  const SURVEY_STATE = { group: 'all' };
  const HELP_KINDS = ['CV review', 'Fellowship guidance', 'Job search', 'Exam preparation', 'Observership placement', 'Research mentorship', 'Other'];
  const EVENT_KINDS = ['Conference', 'Workshop', 'Webinar', 'Course', 'Contouring session', 'Deadline', 'Meeting'];
  const RES_KINDS = ['Guideline', 'Contouring atlas', 'Course', 'Exam prep', 'Tool', 'Reading', 'Video'];
  const founderName = email => (founders.find(f => f.email === email) || {}).name || email;

  const TASK_FIELDS = [
    { key: 'title', label: 'Task', required: true, full: true },
    { key: 'phase', label: 'Phase', type: 'select', options: PHASES },
    { key: 'status', label: 'Status', type: 'select', options: [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done'], ['blocked', 'Blocked']] },
    { key: 'portfolio', label: 'Portfolio', type: 'select', options: [['', '—'], ...PORTFOLIOS.map(p => [p, p])] },
    { key: 'owner', label: 'Owner' },
    { key: 'due', label: 'Due date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 4 },
  ];

  function motionResult(m, t) {
    const counts = t || {};
    const cast = Object.values(counts).reduce((a, b) => a + b, 0);
    const ranked = m.options.filter(o => !NON_VOTES.includes(o)).map(o => [o, counts[o] || 0]).sort((a, b) => b[1] - a[1]);
    if (cast < QUORUM) return { cast, text: `No quorum yet: ${cast} voted, ${QUORUM} needed`, cls: 'todo' };
    if (!ranked.length || ranked[0][1] === 0) return { cast, text: 'No decision', cls: 'todo' };
    if (ranked[1] && ranked[1][1] === ranked[0][1]) return { cast, text: 'Tied: goes to the next General Body meeting (Art. 32A)', cls: 'blocked' };
    const yesNo = m.options.includes('Yes') && m.options.includes('No');
    if (yesNo) return ranked[0][0] === 'Yes'
      ? { cast, text: `Passed: ${counts.Yes || 0} yes, ${counts.No || 0} no`, cls: 'passed' }
      : { cast, text: `Not passed: ${counts.Yes || 0} yes, ${counts.No || 0} no`, cls: 'failed' };
    return { cast, text: `Leading: ${ranked[0][0]} (${ranked[0][1]} votes)`, cls: 'passed' };
  }

  const RENDER = {
    // ---------------- Overview ----------------
    async overview() {
      setHeader(LIVE ? "Founders' Council" : "Founders' Council · demo", `Welcome, ${me.name.replace(/^Dr\.?\s*/, 'Dr. ').split(' ').slice(0, 2).join(' ')}`);
      const [tasks, regs, insts, motions, meetings, tallies] = await Promise.all([
        DB.list('tasks'), DB.list('registrations', ['created_at', false]), DB.list('institutions'),
        DB.list('motions', ['created_at', false]), DB.list('meetings', ['starts_at']), DB.tallies(),
      ]);
      const votes = await DB.votes(motions);
      const mine = new Set(votes.filter(v => v.voter_email === me.email).map(v => v.motion_id));
      const done = tasks.filter(t => t.status === 'done').length;
      const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
      const appointed = insts.filter(i => i.status === 'appointed').length;
      const pending = motions.filter(m => m.status === 'open' && !mine.has(m.id));
      const now = Date.now();
      const next = meetings.find(m => new Date(m.starts_at).getTime() > now - 3 * 3600e3);

      $('#view').innerHTML = `
        <div class="grid k4">
          <div class="kpi glass"><div class="n">${pct}%</div><div class="l">Launch tasks done</div><div class="sub">${done} of ${tasks.length}</div></div>
          <div class="kpi glass"><div class="n">${regs.length}</div><div class="l">Interest registrations</div><div class="sub">${regs.filter(r => r.status === 'new').length} new</div></div>
          <div class="kpi glass"><div class="n">${regs.filter(r => r.ambassador).length}</div><div class="l">Ambassador volunteers</div><div class="sub">${appointed} appointed of ${insts.length} institutions</div></div>
          <div class="kpi glass"><div class="n">${pending.length}</div><div class="l">Motions awaiting your vote</div><div class="sub">${motions.filter(m => m.status === 'open').length} open in total</div></div>
        </div>
        <div class="grid k2" style="margin-top:18px">
          <div>
            <div class="panel glass">
              <h2>Roadmap progress</h2>
              ${PHASES.map(([k, label]) => {
                const ts = tasks.filter(t => t.phase === k), d = ts.filter(t => t.status === 'done').length, p = ts.length ? Math.round(d / ts.length * 100) : 0;
                return `<div class="phase-row"><b>${label}</b><div class="progress"><i style="width:${p}%"></i></div><span>${d}/${ts.length}</span></div>`;
              }).join('')}
              <p style="margin:14px 0 0"><a href="#/tracker">Open the launch tracker →</a></p>
            </div>
            <div class="panel glass">
              <h2>Latest registrations</h2>
              ${regs.length ? `<table class="data"><tbody>${regs.slice(0, 5).map(r => `<tr onclick="location.hash='#/registrations'"><td class="strong">${esc(r.name)}</td><td>${esc(r.institution)}</td><td>${r.ambassador ? pill('ambassador') : ''} ${pill(r.status)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No registrations yet. They arrive from the form on the public website.</p>'}
            </div>
          </div>
          <div>
            <div class="panel glass">
              <h2>Next meeting</h2>
              ${next ? `<div class="crumb">${fmtDate(next.starts_at, true)}</div><h3>${esc(next.title)}</h3><p>${esc(next.agenda || 'No agenda yet.')}</p><a href="#/meetings">All meetings →</a>` : '<p class="muted">No upcoming meeting. <a href="#/meetings">Schedule one</a>.</p>'}
            </div>
            <div class="panel glass">
              <h2>Your vote is needed</h2>
              ${pending.length ? pending.map(m => `<p style="margin:0 0 10px"><a href="#/motions">${esc(m.title)}</a><br><span class="muted" style="font-size:.85rem">${motionResult(m, tallies[m.id]).text}</span></p>`).join('') : '<p class="muted">You have voted on every open motion.</p>'}
            </div>
          </div>
        </div>`;
    },

    // ---------------- Launch tracker ----------------
    async tracker() {
      const tasks = await DB.list('tasks', ['sort']);
      setHeader('Annexure C roadmap · Article 44', 'Launch tracker', [{
        label: 'Add task', primary: true,
        onClick: () => openEditor({ title: 'Add task', fields: TASK_FIELDS, values: { phase: 'first-3-months', status: 'todo' }, onSave: v => DB.insert('tasks', { ...v, sort: (tasks.length + 1) * 10 }) }),
      }]);
      const order = { doing: 0, blocked: 1, todo: 2, done: 3 };
      $('#view').innerHTML = `<p class="lead" style="margin-top:-6px">Click the circle to move a task along: to do → in progress → done. Click the task to edit it.</p>
        <div class="board">${PHASES.map(([k, label]) => {
          const ts = tasks.filter(t => t.phase === k).sort((a, b) => order[a.status] - order[b.status] || a.sort - b.sort);
          const d = ts.filter(t => t.status === 'done').length;
          return `<div class="col glass"><div class="col-head"><h2>${label}</h2><span>${d}/${ts.length}</span></div>
            <div class="progress" style="margin:0 4px 14px"><i style="width:${ts.length ? d / ts.length * 100 : 0}%"></i></div>
            ${ts.map(t => `<div class="task ${t.status}" data-id="${esc(t.id)}">
              <button class="task-check" aria-label="Change status (now ${t.status})"></button>
              <div><div class="task-title">${esc(t.title)}</div>
              <div class="task-meta">${t.status === 'blocked' ? pill('blocked') : ''}${t.portfolio ? `<span>${esc(t.portfolio)}</span>` : ''}${t.owner ? `<span>· ${esc(t.owner)}</span>` : ''}${t.due ? `<span>· due ${fmtDate(t.due)}</span>` : ''}</div></div>
            </div>`).join('') || '<p class="muted" style="padding:0 6px">No tasks.</p>'}
          </div>`;
        }).join('')}</div>`;
      $('#view').querySelectorAll('.task').forEach(el => {
        const t = tasks.find(x => x.id === el.dataset.id);
        el.querySelector('.task-check').addEventListener('click', async e => {
          e.stopPropagation();
          const nextStatus = { todo: 'doing', doing: 'done', done: 'todo', blocked: 'doing' }[t.status];
          try { await DB.update('tasks', t.id, { status: nextStatus }); route(); } catch (err) { fail(err); }
        });
        el.addEventListener('click', () => openEditor({
          title: 'Edit task', fields: TASK_FIELDS, values: t,
          onSave: v => DB.update('tasks', t.id, v), onDelete: () => DB.remove('tasks', t.id),
        }));
      });
    },

    // ---------------- Motions & votes ----------------
    async motions() {
      const motions = await DB.list('motions', ['created_at', false]);
      const [tallies, votes] = await Promise.all([DB.tallies(), DB.votes(motions)]);
      const fields = [
        { key: 'title', label: 'Motion', required: true, full: true, hint: 'Write it as a decision, e.g. "Appoint X as our lawyer".' },
        { key: 'details', label: 'Details and supporting papers', type: 'textarea' },
        { key: 'options', label: 'Choices (comma-separated)', type: 'list', full: true, hint: 'Default: Yes, No, Abstain. For the logo vote, list the concepts.' },
        { key: 'meeting_date', label: 'Joint meeting date', type: 'date' },
        { key: 'secret', label: 'Secret ballot (only totals are shown)', type: 'checkbox' },
      ];
      setHeader('Article 32A · decisions by vote', 'Motions & votes', [{
        label: 'New motion', primary: true,
        onClick: () => openEditor({ title: 'New motion', fields, values: { options: ['Yes', 'No', 'Abstain'] }, onSave: v => {
          if (!v.options.length) v.options = ['Yes', 'No', 'Abstain'];
          return DB.insert('motions', { ...v, status: 'open', created_by: me.email });
        } }),
      }]);

      const card = m => {
        const t = tallies[m.id] || {};
        const res = motionResult(m, t);
        const myVote = (votes.find(v => v.motion_id === m.id && v.voter_email === me.email) || {}).choice;
        const max = Math.max(1, ...Object.values(t));
        const open = m.status === 'open';
        const canManage = me.is_admin || m.created_by === me.email;
        const visible = votes.filter(v => v.motion_id === m.id);
        return `<article class="motion glass" data-id="${esc(m.id)}">
          <div class="motion-head"><h3>${esc(m.title)}</h3>${pill(open ? 'open' : 'closed')}${m.secret ? ' <span class="pill">secret</span>' : ''}</div>
          <div class="motion-meta">Raised by ${esc(founderName(m.created_by))} · ${fmtDate(m.created_at)}${m.meeting_date ? ` · joint meeting ${fmtDate(m.meeting_date)}` : ''}</div>
          ${m.details ? `<p class="details">${esc(m.details)}</p>` : ''}
          ${open ? `<div class="choices">${m.options.map(o => `<button class="choice${myVote === o ? ' mine' : ''}" data-choice="${esc(o)}">${esc(o)}</button>`).join('')}
            ${myVote ? '<button class="linklike" data-unvote>withdraw my vote</button>' : ''}</div>` : ''}
          <div class="tally">${m.options.map(o => `<div class="tally-row"><span>${esc(o)}</span><div class="progress"><i style="width:${(t[o] || 0) / max * 100}%"></i></div><span>${t[o] || 0}</span></div>`).join('')}</div>
          <div class="motion-foot"><span class="pill ${res.cls}">${{ todo: 'pending', blocked: 'tie', passed: open ? 'leading' : 'decided', failed: 'not passed' }[res.cls]}</span> <span>${esc(open ? res.text : (m.outcome || res.text))}</span><span class="spacer"></span>
            ${canManage ? `<button class="btn btn-glass small" data-toggle>${open ? 'Close voting' : 'Reopen'}</button><button class="btn btn-glass small danger" data-delete>Delete</button>` : ''}
          </div>
          <div class="voters">${m.secret ? `${res.cast} founder${res.cast === 1 ? '' : 's'} voted (secret ballot)` : visible.length ? 'Voted: ' + visible.map(v => `${esc(founderName(v.voter_email))} (${esc(v.choice)})`).join(', ') : 'No votes yet'}</div>
        </article>`;
      };

      const open = motions.filter(m => m.status === 'open'), closed = motions.filter(m => m.status !== 'open');
      $('#view').innerHTML = `
        <div class="panel glass" style="font-size:.9rem"><b>Rules (Article 32A):</b> any disagreement is decided by vote, never by one person. Quorum is at least ${QUORUM} of the 9 founders. Simple majority wins. A tie goes to the next General Body meeting. If the motion is about your own conduct, choose Abstain: you may speak but not vote.</div>
        <h2 style="font-size:1.3rem;margin:24px 0 12px">Open</h2>
        ${open.map(card).join('') || '<div class="panel glass empty">No open motions.</div>'}
        ${closed.length ? `<h2 style="font-size:1.3rem;margin:28px 0 12px">Decided</h2>${closed.map(card).join('')}` : ''}`;

      $('#view').querySelectorAll('.motion').forEach(el => {
        const m = motions.find(x => x.id === el.dataset.id);
        el.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', async () => {
          try { await DB.vote(m.id, b.dataset.choice); toast('Vote recorded: ' + b.dataset.choice); route(); } catch (e) { fail(e); }
        }));
        const un = el.querySelector('[data-unvote]');
        if (un) un.addEventListener('click', async () => { try { await DB.unvote(m.id); route(); } catch (e) { fail(e); } });
        const tg = el.querySelector('[data-toggle]');
        if (tg) tg.addEventListener('click', async () => {
          const closing = m.status === 'open';
          if (closing && !confirm('Close voting and record the result?')) return;
          try {
            await DB.update('motions', m.id, closing ? { status: 'closed', outcome: motionResult(m, tallies[m.id]).text } : { status: 'open', outcome: null });
            route();
          } catch (e) { fail(e); }
        });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', async () => {
          if (!confirm('Delete this motion and all its votes?')) return;
          try { await DB.remove('motions', m.id); route(); } catch (e) { fail(e); }
        });
      });
    },

    // ---------------- Meetings ----------------
    async meetings() {
      const meetings = await DB.list('meetings', ['starts_at', false]);
      const fields = [
        { key: 'title', label: 'Title', required: true },
        { key: 'starts_at', label: 'Date and time', type: 'datetime', required: true },
        { key: 'location', label: 'Place or video link', full: true },
        { key: 'agenda', label: 'Agenda', type: 'textarea', hint: 'Article 32A: only items on the agenda can be decided. Circulate it 7 days before.' },
        { key: 'attendees', label: 'Attendees', full: true },
        { key: 'minutes', label: 'Minutes', type: 'textarea', rows: 8 },
      ];
      setHeader('Founders & Joint Meetings', 'Meetings & minutes', [{
        label: 'Schedule meeting', primary: true,
        onClick: () => openEditor({ title: 'Schedule meeting', fields, values: { title: `Founders' meeting ${meetings.length + 1}` }, onSave: v => DB.insert('meetings', v) }),
      }]);
      $('#view').innerHTML = meetings.map(m => `<article class="meeting glass" data-id="${esc(m.id)}">
          <div class="when">${fmtDate(m.starts_at, true)}${new Date(m.starts_at) > new Date() ? ' · upcoming' : ''}</div>
          <h3>${esc(m.title)}</h3>
          ${m.location ? `<p class="muted">${esc(m.location)}</p>` : ''}
          ${m.agenda ? `<div class="label">Agenda</div><p>${esc(m.agenda)}</p>` : ''}
          ${m.attendees ? `<div class="label">Attendees</div><p>${esc(m.attendees)}</p>` : ''}
          ${m.minutes ? `<div class="label">Minutes</div><p>${esc(m.minutes)}</p>` : '<div class="label">Minutes</div><p class="muted">Not recorded yet. Click to add.</p>'}
        </article>`).join('') || '<div class="panel glass empty">No meetings yet.</div>';
      $('#view').querySelectorAll('.meeting').forEach(el => el.addEventListener('click', () => {
        const m = meetings.find(x => x.id === el.dataset.id);
        openEditor({ title: 'Edit meeting', fields, values: m, onSave: v => DB.update('meetings', m.id, v), onDelete: () => DB.remove('meetings', m.id) });
      }));
    },

    // ---------------- Registrations ----------------
    async registrations() {
      await crudView({
        table: 'registrations', order: ['created_at', false], eyebrow: 'From the public website', title: 'Registrations',
        intro: 'People who registered interest on the website. Treat these details as confidential (see the privacy note).',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'stage', label: 'Stage' },
          { key: 'institution', label: 'Institution' },
          { key: 'state', label: 'State' },
          { key: 'ambassador', label: 'Ambassador?', fmt: v => v ? pill('ambassador') : '' },
          { key: 'status', label: 'Status', fmt: pill },
          { key: 'created_at', label: 'Received', fmt: v => fmtDate(v) },
        ],
        search: ['name', 'email', 'institution', 'state', 'message'],
        filters: [{ key: 'status', label: 'status', options: ['new', 'contacted', 'ambassador', 'archived'] }, { key: 'state', label: 'State', options: STATES }],
        fields: [
          { key: 'name', label: 'Name', required: true }, { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'phone', label: 'WhatsApp' }, { key: 'stage', label: 'Stage' },
          { key: 'institution', label: 'Institution' }, { key: 'state', label: 'State' },
          { key: 'ambassador', label: 'Volunteered as Institutional Ambassador', type: 'checkbox' },
          { key: 'message', label: 'Biggest problem where they train', type: 'textarea', rows: 3 },
          { key: 'status', label: 'Status', type: 'select', options: ['new', 'contacted', 'ambassador', 'archived'] },
          { key: 'notes', label: 'Founders’ notes (private)', type: 'textarea', rows: 3 },
        ],
        defaults: { status: 'new', consent: true, ambassador: false },
        addLabel: 'Add registration',
        editTitle: r => r.name,
        actions: rows => [
          { label: 'Export CSV', onClick: () => exportCSV(rows) },
          { label: 'Send volunteers to Ambassadors', onClick: () => promoteVolunteers(rows) },
        ],
      });
    },

    // ---------------- Ambassadors ----------------
    async ambassadors() {
      await crudView({
        table: 'institutions', order: ['state'], eyebrow: 'Article 22A', title: 'Institutional Ambassadors',
        intro: 'One resident ambassador in every radiation oncology training institution. Tick "Show on website" to list an appointed ambassador publicly (name and institution only).',
        columns: [
          { key: 'name', label: 'Institution' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'region', label: 'Region' },
          { key: 'ambassador_name', label: 'Ambassador' }, { key: 'status', label: 'Status', fmt: pill },
          { key: 'show_public', label: 'On website', fmt: v => v ? '✓' : '' },
        ],
        filters: [{ key: 'status', label: 'status', options: ['vacant', 'proposed', 'appointed'] }, { key: 'region', label: 'region', options: ['North', 'South', 'East', 'West', 'Central', 'North-East'] }],
        fields: [
          { key: 'name', label: 'Institution', required: true, full: true }, { key: 'city', label: 'City' },
          { key: 'state', label: 'State', type: 'select', options: [['', '—'], ...STATES.map(s => [s, s])] },
          { key: 'region', label: 'Region', type: 'select', options: [['', '—'], 'North', 'South', 'East', 'West', 'Central', 'North-East'] },
          { key: 'status', label: 'Status', type: 'select', options: ['vacant', 'proposed', 'appointed'] },
          { key: 'ambassador_name', label: 'Ambassador name' }, { key: 'ambassador_email', label: 'Ambassador email', type: 'email' },
          { key: 'ambassador_phone', label: 'Ambassador WhatsApp' },
          { key: 'show_public', label: 'Show on website (name and institution only, with their consent)', type: 'checkbox' },
          { key: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
        ],
        defaults: { status: 'vacant', show_public: false },
        addLabel: 'Add institution', editTitle: r => r.name,
        empty: 'No institutions yet. Add training institutions, or send ambassador volunteers here from Registrations.',
      });
    },

    // ---------------- Announcements ----------------
    async announcements() {
      await crudView({
        table: 'announcements', order: ['created_at', false], eyebrow: 'News page and home page', title: 'News',
        intro: 'Published news appears on the News page and the latest three on the home page. Have the Spokesperson approve public statements first.',
        actions: () => [{ label: 'View on website ↗', onClick: () => window.open('../news.html', '_blank') }],
        columns: [{ key: 'title', label: 'Title' }, { key: 'published', label: 'Status', fmt: v => pill(v ? 'published' : 'draft') }, { key: 'created_at', label: 'Created', fmt: v => fmtDate(v) }],
        fields: [{ key: 'title', label: 'Title', required: true, full: true }, { key: 'body', label: 'Text', type: 'textarea', required: true, rows: 6 }, { key: 'published', label: 'Published on the website', type: 'checkbox' }],
        defaults: { published: false }, addLabel: 'New announcement', editTitle: r => r.title,
      });
    },

    // ---------------- Library ----------------
    async library() {
      await crudView({
        table: 'documents', order: ['category'], eyebrow: 'Key documents', title: 'Library',
        intro: 'Links to the constitution drafts, legal papers and designs. Store files in a shared drive and paste the link here.',
        columns: [
          { key: 'title', label: 'Document' }, { key: 'category', label: 'Category' },
          { key: 'url', label: 'Link', fmt: v => /^https?:\/\//i.test(v || '') ? `<a href="${esc(v)}" target="_blank" rel="noopener">Open ↗</a>` : esc(v) },
        ],
        fields: [{ key: 'title', label: 'Title', required: true, full: true }, { key: 'url', label: 'Link (https://…)', type: 'url', required: true, full: true },
          { key: 'category', label: 'Category', type: 'select', options: ['Constitution', 'Minutes', 'Legal & registration', 'Finance', 'Design', 'Survey', 'Other'] }],
        defaults: { category: 'Other' }, addLabel: 'Add document', editTitle: r => r.title,
      });
    },

    // ---------------- Members (Article 10 verification) ----------------
    async members() {
      const R = window.ROAR_RULES;
      const [rows, open] = await Promise.all([DB.list('members', ['created_at', false]), DB.setting('membership_open')]);
      const today = R.todayIST();
      const age = r => Math.floor((Date.now() - new Date(r.created_at).getTime()) / 864e5);
      const pending = rows.filter(r => r.status === 'submitted' || r.status === 'under_review');
      const overdue = pending.filter(r => age(r) > R.VERIFY_DAYS);
      const founding = rows.filter(r => r.plan === 'founding' && r.status !== 'rejected').length;
      const isF = r => founders.some(f => f.email === r.email);
      const voters = rows.filter(r => R.canVote(r, null, { isFounder: isF(r) }).ok);
      const AS = { resident: 'RO resident', post_pg: 'Young RO', honorary: 'Honorary' };

      const exportRows = (list, name) => {
        const cols = ['member_no', 'full_name', 'email', 'phone', 'applying_as', 'category', 'institution', 'state', 'pg_start', 'pg_completion', 'vote_from', 'vote_until', 'plan', 'status', 'paid_until', 'payment_ref'];
        const cell = v => { let x = String(v ?? ''); if (/^[=+\-@]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
        const data = list.map(r => { const w = R.votingWindow(r) || {}; return { ...r, vote_from: w.from, vote_until: w.until }; });
        const csv = [cols.join(','), ...data.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
        a.download = `roar-${name}-${today}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };

      await crudView({
        table: 'members', order: ['created_at', false], eyebrow: 'Part III · verification within 30 days', title: 'Members',
        intro: 'Check each applicant’s PG college ID card and allotment letter or degree certificate, then approve or refuse. A refusal must give reasons, and the applicant can appeal to the Executive Council.',
        before: `<div class="grid k4" style="margin-bottom:18px">
          <div class="kpi glass"><div class="n">${pending.length}</div><div class="l">Awaiting verification</div><div class="sub">${overdue.length ? overdue.length + ' past 30 days' : 'none overdue'}</div></div>
          <div class="kpi glass"><div class="n">${rows.filter(r => r.status === 'approved').length}</div><div class="l">Approved members</div><div class="sub">${rows.filter(r => r.status === 'approved' && !R.isCurrent(r, today)).length} awaiting payment or renewal</div></div>
          <div class="kpi glass"><div class="n">${founding}/20</div><div class="l">Founding Member places</div><div class="sub">${20 - founding} left</div></div>
          <div class="kpi glass"><div class="n">${voters.length}</div><div class="l">On the electoral roll today</div><div class="sub">Applications are ${open ? 'open' : 'closed'}</div></div>
        </div>`,
        columns: [
          { key: 'full_name', label: 'Name' },
          { key: 'applying_as', label: 'Applying as', fmt: v => esc(AS[v] || v) },
          { key: 'institution', label: 'Institution' },
          { key: 'plan', label: 'Plan', fmt: v => esc({ annual: 'Annual', lifetime: 'Lifetime', founding: 'Founding' }[v] || v) },
          { key: 'status', label: 'Status', fmt: (v, r) => `<span class="pill ${esc(v)}">${esc(R.STATUS_LABEL[v] || v)}</span>`
              + ((v === 'submitted' || v === 'under_review') && age(r) > R.VERIFY_DAYS ? ' <span class="pill blocked">overdue</span>' : '')
              + (r.appeal && v === 'submitted' ? ' <span class="pill">appeal</span>' : '')
              + (r.clock_pause_request && !r.clock_pause_months ? ' <span class="pill">pause request</span>' : '') },
          { key: 'member_no', label: 'No.' },
          { key: 'created_at', label: 'Applied', fmt: v => fmtDate(v) },
        ],
        search: ['full_name', 'email', 'institution', 'state', 'member_no'],
        filters: [{ key: 'status', label: 'status', options: ['submitted', 'under_review', 'approved', 'rejected', 'lapsed'] },
          { key: 'plan', label: 'plan', options: ['annual', 'lifetime', 'founding'] }],
        noAdd: true,
        editTitle: r => r.full_name + (r.member_no ? ' · ' + r.member_no : ''),
        info: r => {
          const w = R.votingWindow(r);
          const cat = r.category || R.category(r);
          const v = R.canVote(r, null, { isFounder: isF(r) });
          return `<dl class="info-kv">
            <dt>Email</dt><dd>${esc(r.email)}${r.phone ? ' · ' + esc(r.phone) : ''}</dd>
            <dt>Applying as</dt><dd>${esc(AS[r.applying_as])}${r.specialty ? ' · ' + esc(r.specialty) : ''} → <b>${esc(R.CATEGORY_LABEL[cat])}</b></dd>
            <dt>Training</dt><dd>${esc(r.course || '')} · ${esc(r.institution || '')}${r.city ? ', ' + esc(r.city) : ''}${r.state ? ', ' + esc(r.state) : ''}</dd>
            <dt>PG dates</dt><dd>${fmtDate(r.pg_start) || '—'} to ${r.pg_completion ? fmtDate(r.pg_completion) : 'in progress'}</dd>
            <dt>Voting window</dt><dd>${w ? `${fmtDate(w.from)} – ${fmtDate(w.until)}${w.estimated ? ' (estimated)' : ''}` : '—'} · ${esc(v.reason)}</dd>
            <dt>Documents</dt><dd><button type="button" class="btn btn-glass small" data-doc="${esc(r.id_card_path || '')}">PG ID card ↗</button> <button type="button" class="btn btn-glass small" data-doc="${esc(r.proof_path || '')}">Allotment / degree ↗</button></dd>
            ${r.fee_deferral_requested ? '<dt>Fee deferral</dt><dd>Requested: stipend unpaid 3+ months (Article 8J)</dd>' : ''}
            ${r.clock_pause_request ? `<dt>Pause request</dt><dd>${esc(r.clock_pause_request)}</dd>` : ''}
            ${r.appeal ? `<dt>Appeal</dt><dd>${esc(r.appeal)}</dd>` : ''}
            <dt>Applied</dt><dd>${fmtDate(r.created_at, true)} · verify by ${fmtDate(new Date(new Date(r.created_at).getTime() + R.VERIFY_DAYS * 864e5).toISOString())}</dd>
          </dl>`;
        },
        fields: [
          { key: 'status', label: 'Decision', type: 'select', options: [['submitted', 'Submitted'], ['under_review', 'Under verification'], ['approved', 'Approve'], ['rejected', 'Refuse (give reasons)'], ['lapsed', 'Lapsed']] },
          { key: 'category', label: 'Category', type: 'select', options: [['', 'Work out automatically'], ['resident', 'Ordinary – Resident'], ['young_ro', 'Ordinary – Young RO'], ['senior', 'Senior (non-voting)'], ['honorary', 'Honorary (non-voting)']] },
          { key: 'plan', label: 'Plan', type: 'select', options: [['annual', 'Annual ₹500'], ['lifetime', 'Lifetime ₹5,000'], ['founding', 'Founding ₹1,000']] },
          { key: 'paid_until', label: 'Paid until (annual plan)', type: 'date' },
          { key: 'payment_ref', label: 'Payment reference (UTR / receipt no.)' },
          { key: 'clock_pause_months', label: 'Approved clock pause (months, max 24)', type: 'number' },
          { key: 'pg_start', label: 'PG start date', type: 'date' },
          { key: 'pg_completion', label: 'PG completion date', type: 'date', hint: 'Add it when the member qualifies; it fixes their voting window.' },
          { key: 'fee_deferred', label: 'Fee deferred (Article 8J)', type: 'checkbox' },
          { key: 'rejection_reason', label: 'Reasons for refusal (shown to the applicant)', type: 'textarea', rows: 3 },
          { key: 'notes', label: 'Private notes', type: 'textarea', rows: 3 },
        ],
        validate: (v, r) => {
          if (v.status === 'rejected' && !(v.rejection_reason || '').trim()) return 'A refusal must give reasons (Article 10).';
          const pause = +v.clock_pause_months || 0;
          if (pause < 0 || pause > 24) return 'The clock pause can be at most 24 months in total.';
          if (v.plan === 'founding' && r.plan !== 'founding' && founding >= 20) return 'All 20 Founding Member places are taken.';
          if (v.status === 'approved' && (!r.id_card_path || !r.proof_path)) return 'Both documents are required before approval.';
          return null;
        },
        beforeSave: async (v, r) => {
          v.clock_pause_months = +v.clock_pause_months || 0;
          if (!v.category) v.category = R.category({ applying_as: r.applying_as, pg_completion: v.pg_completion || r.pg_completion });
          if (!LIVE && v.status === 'approved' && r.status !== 'approved') {   // the database trigger does this when live
            v.approved_at = new Date().toISOString(); v.reviewed_by = me.email;
            if (!r.member_no) v.member_no = 'ROAR-' + String((Demo.s.members || []).filter(m => m.member_no).length + 1).padStart(4, '0');
          }
          return v;
        },
        actions: () => [
          ...(me.is_admin ? [{ label: open ? 'Close applications' : 'Open applications', onClick: async () => {
            if (!confirm(open ? 'Stop accepting new membership applications?' : 'Open membership applications on the website? Do this only after registration and opening the bank account.')) return;
            try { await DB.setSetting('membership_open', !open); toast(open ? 'Applications closed' : 'Applications open'); route(); } catch (e) { fail(e); }
          } }] : []),
          { label: 'Electoral roll CSV', onClick: () => exportRows(voters, 'electoral-roll') },
          { label: 'All members CSV', onClick: () => exportRows(rows, 'members') },
        ],
        empty: 'No applications yet. They arrive from the member portal once applications are open.',
      });
    },

    // ---------------- Elections & ballots (Part VI) ----------------
    async elections() {
      const rows = await DB.list('elections', ['opens_at', false]);
      const stats = {};
      await Promise.all(rows.map(async e => { try { stats[e.id] = await DB.electionStats(e); } catch (err) { stats[e.id] = null; } }));
      const leading = s => { if (!s || !s.results) return ''; const e = Object.entries(s.results).sort((a, b) => b[1] - a[1]); return e.length ? `${esc(e[0][0])} (${e[0][1]})` : 'No votes'; };
      await crudView({
        table: 'elections', order: ['opens_at', false], eyebrow: 'Part VI · secret e-ballots for members', title: 'Elections & ballots',
        intro: 'Ballots appear in every approved member’s portal. Votes are secret: the database keeps who voted separately from how they voted, so nobody, including founders, can link the two. Results show only after a ballot is closed.',
        columns: [
          { key: 'title', label: 'Ballot' }, { key: 'kind', label: 'Type' },
          { key: 'opens_at', label: 'Opens', fmt: v => fmtDate(v, true) }, { key: 'closes_at', label: 'Closes', fmt: v => fmtDate(v, true) },
          { key: 'status', label: 'Status', fmt: v => pill(v) },
          { key: 'id', label: 'Turnout', fmt: v => stats[v] ? `${stats[v].voted} of ${stats[v].eligible}` : '—' },
          { key: 'id', label: 'Result', fmt: v => leading(stats[v]) },
        ],
        filters: [{ key: 'status', label: 'status', options: ['draft', 'open', 'closed'] }, { key: 'kind', label: 'type', options: ['election', 'referendum', 'poll'] }],
        fields: [
          { key: 'title', label: 'Ballot', required: true, full: true, hint: 'e.g. "Election of the President, 2028–29" or "Consultation on survey topics"' },
          { key: 'kind', label: 'Type', type: 'select', options: [['poll', 'Poll / consultation'], ['referendum', 'Referendum (e.g. an amendment)'], ['election', 'Election (Article 23 rules apply)']],
            hint: 'Elections need members enrolled 60+ days before polling, a fresh PG-date confirmation, and at least 72 hours of voting.' },
          { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft (hidden from members)'], ['open', 'Open'], ['closed', 'Closed (results shown)']] },
          { key: 'options', label: 'Choices (comma-separated)', type: 'list', full: true, required: true, hint: 'For an election, list the candidates.' },
          { key: 'opens_at', label: 'Voting opens', type: 'datetime', required: true },
          { key: 'closes_at', label: 'Voting closes', type: 'datetime', required: true },
          { key: 'description', label: 'Description / manifestos', type: 'textarea', rows: 5 },
        ],
        defaults: { kind: 'poll', status: 'draft', options: ['Yes', 'No', 'Abstain'] },
        validate: v => {
          if (!v.options || v.options.length < 2) return 'Give at least two choices.';
          if (!v.opens_at || !v.closes_at || v.closes_at <= v.opens_at) return 'Voting must close after it opens.';
          if (v.kind === 'election' && new Date(v.closes_at) - new Date(v.opens_at) < 72 * 3600e3) return 'An election must stay open for at least 72 hours (Article 25).';
          return null;
        },
        info: r => stats[r.id] ? `<dl class="info-kv"><dt>Turnout</dt><dd>${stats[r.id].voted} of ${stats[r.id].eligible} eligible members</dd>
          ${stats[r.id].results ? `<dt>Results</dt><dd>${Object.entries(stats[r.id].results).map(([k, n]) => `${esc(k)}: <b>${n}</b>`).join(' · ') || 'No votes'}</dd>` : '<dt>Results</dt><dd>Shown after the ballot closes</dd>'}</dl>` : '',
        addLabel: 'New ballot', editTitle: r => r.title,
      });
    },

    // ---------------- Career help requests (Article 8O) ----------------
    async help() {
      const fnames = founders.map(f => f.name);
      await crudView({
        table: 'support_requests', order: ['created_at', false], eyebrow: 'Article 8O · from the members’ area', title: 'Career help',
        intro: 'Requests from registered users for CV reviews, fellowship and job guidance, exam help and mentoring. Assign each one to a founder or mentor, reply by email, and close it when done.',
        columns: [
          { key: 'name', label: 'From', fmt: (v, r) => esc(v || r.email) }, { key: 'kind', label: 'Help with' },
          { key: 'details', label: 'Request', fmt: v => esc(String(v || '').slice(0, 80)) + (String(v || '').length > 80 ? '…' : '') },
          { key: 'status', label: 'Status', fmt: v => `<span class="pill ${esc(v)}">${esc({ new: 'new', assigned: 'assigned', in_progress: 'in progress', closed: 'closed' }[v] || v)}</span>` },
          { key: 'assigned_to', label: 'Assigned to' },
          { key: 'created_at', label: 'Received', fmt: v => fmtDate(v) },
          { key: 'email', label: 'Reply', fmt: (v, r) => `<a href="mailto:${esc(v)}?subject=${encodeURIComponent('ROAR career help: ' + r.kind)}">Email ↗</a>` },
        ],
        search: ['name', 'email', 'kind', 'details', 'assigned_to'],
        filters: [{ key: 'status', label: 'status', options: ['new', 'assigned', 'in_progress', 'closed'] },
          { key: 'kind', label: 'type', options: HELP_KINDS }],
        fields: [
          { key: 'name', label: 'From', readOnly: true }, { key: 'email', label: 'Email', readOnly: true },
          { key: 'kind', label: 'Help with', readOnly: true }, { key: 'contact_pref', label: 'How to contact them', readOnly: true },
          { key: 'details', label: 'Request', type: 'textarea', readOnly: true, rows: 6 },
          { key: 'status', label: 'Status', type: 'select', options: [['new', 'New'], ['assigned', 'Assigned'], ['in_progress', 'In progress'], ['closed', 'Closed']] },
          { key: 'assigned_to', label: 'Assigned to', type: 'select', options: [['', '—'], ...fnames.map(n => [n, n]), ['A mentor (see notes)', 'A mentor (see notes)']] },
          { key: 'notes', label: 'Founders’ notes (private)', type: 'textarea', rows: 3 },
        ],
        noAdd: true, editTitle: r => `${r.name || r.email} · ${r.kind}`,
        beforeSave: async v => { if (v.assigned_to && v.status === 'new') v.status = 'assigned'; return v; },
        empty: 'No requests yet. Registered users ask for help from the Careers help tab in the member portal.',
      });
    },

    // ---------------- Inbox (contact form) ----------------
    async inbox() {
      await crudView({
        table: 'messages', order: ['created_at', false], eyebrow: 'From the contact page', title: 'Inbox',
        intro: 'Messages from the website\'s contact form. Reply by email, then mark them replied.',
        columns: [
          { key: 'name', label: 'From' }, { key: 'topic', label: 'Topic' },
          { key: 'message', label: 'Message', fmt: v => esc(String(v || '').slice(0, 90)) + (String(v || '').length > 90 ? '…' : '') },
          { key: 'status', label: 'Status', fmt: pill }, { key: 'created_at', label: 'Received', fmt: v => fmtDate(v) },
          { key: 'email', label: 'Reply', fmt: (v, r) => `<a href="mailto:${esc(v)}?subject=${encodeURIComponent('Re: ' + (r.topic || 'your message to ROAR'))}">Email ↗</a>` },
        ],
        search: ['name', 'email', 'topic', 'message'],
        filters: [{ key: 'status', label: 'status', options: ['new', 'replied', 'archived'] },
          { key: 'topic', label: 'topic', options: ['General question', 'Membership', 'Partnership or MoU', 'Media', 'Suggest an event', 'Post an opportunity', 'Suggest a resource'] }],
        fields: [
          { key: 'name', label: 'From', readOnly: true }, { key: 'email', label: 'Email', readOnly: true },
          { key: 'topic', label: 'Topic', readOnly: true }, { key: 'message', label: 'Message', type: 'textarea', readOnly: true, rows: 7 },
          { key: 'status', label: 'Status', type: 'select', options: ['new', 'replied', 'archived'] },
          { key: 'notes', label: 'Founders’ notes (private)', type: 'textarea', rows: 3 },
        ],
        noAdd: true, editTitle: r => `${r.name} · ${r.topic || 'Message'}`,
        empty: 'No messages yet.',
      });
    },

    // ---------------- Events ----------------
    async events() {
      await crudView({
        table: 'events', order: ['starts_on', false], eyebrow: 'Academic calendar on the website', title: 'Events',
        intro: 'List ROAR\'s own sessions and other bodies\' events residents should know about. Only published events appear on the website.',
        columns: [
          { key: 'title', label: 'Event' }, { key: 'starts_on', label: 'Date', fmt: (v, r) => fmtDate(v) + (r.ends_on && r.ends_on !== v ? ' – ' + fmtDate(r.ends_on) : '') },
          { key: 'kind', label: 'Type' }, { key: 'city', label: 'City' }, { key: 'organiser', label: 'Organiser' },
          { key: 'published', label: 'Status', fmt: v => pill(v ? 'published' : 'draft') },
        ],
        filters: [{ key: 'kind', label: 'type', options: EVENT_KINDS }],
        fields: [
          { key: 'title', label: 'Event', required: true, full: true },
          { key: 'kind', label: 'Type', type: 'select', options: EVENT_KINDS },
          { key: 'format', label: 'Format', type: 'select', options: ['In person', 'Online', 'Hybrid'] },
          { key: 'starts_on', label: 'Starts', type: 'date', required: true }, { key: 'ends_on', label: 'Ends (optional)', type: 'date' },
          { key: 'city', label: 'City' }, { key: 'organiser', label: 'Organiser' },
          { key: 'url', label: 'Link for details/registration (https://…)', type: 'url', full: true },
          { key: 'description', label: 'Short description', type: 'textarea', rows: 3 },
          { key: 'roar_event', label: 'Organised by ROAR', type: 'checkbox' },
          { key: 'members_only', label: 'Members only (shown in the member portal, hidden from the public site)', type: 'checkbox' },
          { key: 'published', label: 'Published on the website', type: 'checkbox' },
        ],
        defaults: { kind: 'Conference', format: 'In person', published: false, roar_event: false },
        addLabel: 'Add event', editTitle: r => r.title,
        actions: () => [{ label: 'View on website ↗', onClick: () => window.open('../events.html', '_blank') }],
      });
    },

    // ---------------- Opportunities ----------------
    async opportunities() {
      await crudView({
        table: 'opportunities', order: ['created_at', false], eyebrow: 'Jobs & fellowships board on the website', title: 'Opportunities',
        intro: 'Jobs, fellowships, observerships and research openings. Listings disappear from the website automatically after their deadline. Prefer listings that state the pay.',
        columns: [
          { key: 'title', label: 'Opportunity' }, { key: 'kind', label: 'Type' }, { key: 'organisation', label: 'Organisation' },
          { key: 'deadline', label: 'Deadline', fmt: v => v ? fmtDate(v) : 'Open' },
          { key: 'published', label: 'Status', fmt: v => pill(v ? 'published' : 'draft') },
        ],
        filters: [{ key: 'kind', label: 'type', options: ['Job', 'Fellowship', 'Observership', 'Research', 'Scholarship'] }],
        fields: [
          { key: 'title', label: 'Title', required: true, full: true, hint: 'e.g. "Senior Resident, Radiation Oncology (3 posts)"' },
          { key: 'kind', label: 'Type', type: 'select', options: ['Job', 'Fellowship', 'Observership', 'Research', 'Scholarship'] },
          { key: 'deadline', label: 'Apply by', type: 'date' },
          { key: 'organisation', label: 'Organisation' }, { key: 'location', label: 'Location' },
          { key: 'url', label: 'Link to apply (https://…)', type: 'url', full: true },
          { key: 'description', label: 'Details (include stipend/salary if known)', type: 'textarea', rows: 4 },
          { key: 'members_only', label: 'Members only (shown in the member portal, hidden from the public site)', type: 'checkbox' },
          { key: 'published', label: 'Published on the website', type: 'checkbox' },
        ],
        defaults: { kind: 'Job', published: false }, addLabel: 'Add opportunity', editTitle: r => r.title,
        actions: () => [{ label: 'View on website ↗', onClick: () => window.open('../opportunities.html', '_blank') }],
      });
    },

    // ---------------- Learning resources ----------------
    async resources() {
      await crudView({
        table: 'resources', order: ['title'], eyebrow: 'Learn page library', title: 'Learning resources',
        intro: 'Curated by the Academic Society. Link only to free, reputable sources, and never upload copyrighted material.',
        columns: [
          { key: 'title', label: 'Resource' }, { key: 'kind', label: 'Type' }, { key: 'level', label: 'Level' },
          { key: 'published', label: 'Status', fmt: v => pill(v ? 'published' : 'draft') },
        ],
        filters: [{ key: 'kind', label: 'type', options: RES_KINDS }],
        fields: [
          { key: 'title', label: 'Title', required: true, full: true },
          { key: 'kind', label: 'Type', type: 'select', options: RES_KINDS },
          { key: 'level', label: 'Level', type: 'select', options: ['All residents', 'Junior residents', 'Senior residents', 'Early-career'] },
          { key: 'url', label: 'Link (https://…)', type: 'url', required: true, full: true },
          { key: 'description', label: 'Why it is useful', type: 'textarea', rows: 3 },
          { key: 'members_only', label: 'Members only (recordings, case files and other member resources)', type: 'checkbox' },
          { key: 'published', label: 'Published on the website', type: 'checkbox' },
        ],
        defaults: { kind: 'Reading', level: 'All residents', published: false }, addLabel: 'Add resource', editTitle: r => r.title,
        actions: () => [{ label: 'View on website ↗', onClick: () => window.open('../learn.html', '_blank') }],
      });
    },

    // ---------------- Founders ----------------
    async founders() {
      await crudView({
        table: 'founders', key: 'email', order: ['sort'], eyebrow: 'Article 15A', title: "Founders' Council",
        intro: me.is_admin ? 'Only these accounts can open the console. Every other registered user, including members, can use only the member portal. A new founder also needs a matching login created in Supabase (SETUP.md, step 5).' : 'Only these accounts can open the console. Ask an admin founder to make changes.',
        canEdit: () => me.is_admin || me.can_reset_passwords,
        columns: [{ key: 'founder_id', label: 'Founder ID' }, { key: 'name', label: 'Name', fmt: (v, r) => `<span class="fc-name"><span class="avatar xs"${r.founder_id ? ` data-founder="${esc(r.founder_id)}"` : ''}>${esc(initials(v))}</span>${esc(v)}</span>` }, { key: 'username', label: 'Username' }, { key: 'cabinet_role', label: 'Cabinet role' },
          { key: 'password_set', label: 'Password', fmt: v => v ? '<span class="pill done">chosen</span>' : '<span class="pill todo">not yet chosen</span>' },
          { key: 'is_admin', label: 'Admin', fmt: v => v ? '✓' : '' }],
        info: r => me.can_reset_passwords && r.username && r.username !== me.username ? `<dl class="info-kv"><dt>Password</dt><dd>${r.password_set ? 'Chosen by the founder' : 'Not chosen yet: they choose one at their next sign-in'}<br>
          <button type="button" class="btn btn-glass small" data-pw-action="reset" data-user="${esc(r.username)}" style="margin-top:8px">Reset: they choose a new one</button>
          <button type="button" class="btn btn-glass small" data-pw-action="set" data-user="${esc(r.username)}" style="margin-top:8px">Set a new password</button></dd></dl>` : '',
        fields: [{ key: 'name', label: 'Name', required: true }, { key: 'founder_id', label: 'Founder ID', hint: 'FC-01 … FC-09' },
          { key: 'username', label: 'Username (lower case, e.g. akash.bellige)', required: true },
          { key: 'cabinet_role', label: 'Cabinet role', full: true }, { key: 'sort', label: 'Order', type: 'number' },
          { key: 'is_admin', label: 'Admin: can edit this list, open applications and surveys', type: 'checkbox' }],
        validate: v => /^[a-z0-9._-]{3,40}$/.test(v.username || '') ? null : 'Usernames use 3–40 lower-case letters, numbers, dots, dashes or underscores.',
        beforeSave: async v => (LIVE ? { ...v, email: `${v.username}@${cfg.founderLoginDomain || 'founders.roar.invalid'}` } : v),
        addLabel: 'Add founder', editTitle: r => r.name,
      });
    },
  };

  // ---------------- Registration helpers ----------------
  function exportCSV(rows) {
    const cols = ['created_at', 'name', 'email', 'phone', 'stage', 'institution', 'state', 'ambassador', 'message', 'status', 'notes'];
    const cell = v => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = `roar-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function promoteVolunteers(rows) {
    try {
      const insts = await DB.list('institutions');
      const taken = new Set(insts.map(i => (i.ambassador_email || '').toLowerCase()).filter(Boolean));
      const todo = rows.filter(r => r.ambassador && !taken.has((r.email || '').toLowerCase()));
      if (!todo.length) return toast('All ambassador volunteers are already in Ambassadors');
      if (!confirm(`Add ${todo.length} volunteer${todo.length === 1 ? '' : 's'} to Ambassadors as "proposed"?`)) return;
      for (const r of todo) {
        const existing = insts.find(i => i.name && r.institution && i.name.toLowerCase() === r.institution.toLowerCase() && !i.ambassador_email);
        const patch = { ambassador_name: r.name, ambassador_email: r.email, ambassador_phone: r.phone, status: 'proposed' };
        if (existing) await DB.update('institutions', existing.id, patch);
        else await DB.insert('institutions', { name: r.institution || '(institution not given)', state: STATES.includes(r.state) ? r.state : null, show_public: false, ...patch });
        await DB.update('registrations', r.id, { status: 'ambassador' });
      }
      toast(`Added ${todo.length} to Ambassadors`);
      location.hash = '#/ambassadors';
    } catch (e) { fail(e); }
  }


  // Chairman's password controls (buttons inside the Founders editor)
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-pw-action]');
    if (!b || !me || !me.can_reset_passwords) return;
    const u = b.dataset.user;
    if (b.dataset.pwAction === 'reset') {
      if (!confirm(`Reset ${u}? Their current password stops working, and they choose a new one at their next sign-in.`)) return;
      try { await Auth.reset(u); dlg.close(); toast(`${u} will choose a new password at their next sign-in`); route(); } catch (err) { fail(err); }
    } else {
      dlg.close();
      openEditor({
        title: `Set a new password for ${u}`,
        fields: [{ key: 'pw', label: 'New password (at least 10 characters)', type: 'password', required: true, full: true },
          { key: 'pw2', label: 'Type it again', type: 'password', required: true, full: true }],
        onSave: async v => {
          if ((v.pw || '').length < 10) throw new Error('Use at least 10 characters.');
          if (v.pw !== v.pw2) throw new Error('The two passwords do not match.');
          await Auth.setFor(u, v.pw);
        },
      });
    }
  });

  // Hooks for the console's add-on modules (council/surveys.js)
  window.ROAR_COUNCIL = {
    DB, Demo, LIVE, R, esc, toast, fail, fmtDate, pill, openEditor, setHeader, route,
    get sb() { return sb; }, get me() { return me; }, get founders() { return founders; },
    register(name, fn) {
      RENDER[name] = fn;
      if (me && (location.hash.match(/^#\/([\w-]+)/) || [])[1] === name) route();
    },
  };

  init().catch(fail);
})();
