// My ROAR: the members' hub in the portal.
//   #home        dashboard: membership, CME this year, mentorship, what's next, new openings, quick actions
//   #learning    check in to a ROAR session, certificates, personal CME log, learning library
//   #mentorship  find a mentor, my requests, mentoring others, become a mentor
//   #settings    email notifications and job alerts, password
// Live mode uses Supabase (schema PART 15). Demo mode keeps everything in this browser.
(() => {
  'use strict';
  const OFFERS = ['CV review', 'Fellowship guidance', 'Exam preparation', 'Research', 'Career planning', 'Observership', 'Wellbeing'];
  const CME_CATS = ['Conference', 'Workshop', 'Course', 'Webinar', 'Journal club', 'Teaching', 'Research', 'Other'];
  const JOB_KINDS = ['Job', 'Fellowship', 'Observership', 'Research', 'Scholarship'];
  const AREAS = ['Head & Neck', 'Breast', 'CNS', 'Thoracic', 'GI', 'GU', 'Gynae', 'Lymphoma & Haem', 'Paediatrics', 'Palliative', 'SBRT & SRS', 'Brachytherapy', 'Physics & Planning', 'Contouring', 'Research methods', 'Exams'];
  let ctx, D, uid;
  const esc = v => ctx.esc(v);
  const root = () => ctx.root;
  const $ = s => ctx.root.querySelector(s);
  const todayIST = () => new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
  const year = () => todayIST().slice(0, 4);
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? esc(u) : '';
  const num = n => (Math.round((+n || 0) * 10) / 10).toString();
  const head = (eyebrow, title, lead) => `<div class="dash-head"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1></div></div>${lead ? `<p class="lead" style="margin-top:-8px">${lead}</p>` : ''}`;
  const tag = (t, cls) => `<span class="tag${cls ? ' ' + cls : ''}">${esc(t)}</span>`;
  const certUrl = no => `../certificate.html?no=${encodeURIComponent(no)}`;

  // ---------------------------------------------------------------- data layers
  function live(sb) {
    const get = async q => { const { data, error } = await q; if (error) throw error; return data || []; };
    const one = async q => { const { data, error } = await q; if (error) throw error; return data; };
    return {
      member: () => one(sb.from('members').select('*').eq('user_id', uid).maybeSingle()),
      events: () => get(sb.from('events').select('*').eq('published', true).gte('starts_on', new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)).order('starts_on').limit(30)),
      recentRoarEvents: () => get(sb.from('events').select('id, title, kind, starts_on, cme_hours').eq('published', true).eq('roar_event', true).lte('starts_on', todayIST()).gte('starts_on', new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10)).order('starts_on', { ascending: false })),
      opportunities: () => get(sb.from('opportunities').select('*').eq('published', true).order('created_at', { ascending: false }).limit(20)),
      resources: () => get(sb.from('resources').select('*').eq('published', true)),
      attendance: () => get(sb.from('attendance').select('certificate_no, created_at, name_on_certificate, event:events(title, kind, starts_on, cme_hours)').eq('user_id', uid).order('created_at', { ascending: false })),
      checkin: async (eventId, code, name) => { const { data, error } = await sb.rpc('event_checkin', { p_event: eventId, p_code: code, p_name: name }); if (error) throw error; return data; },
      cme: () => get(sb.from('cme_entries').select('*').eq('user_id', uid).order('activity_date', { ascending: false })),
      addCme: r => one(sb.from('cme_entries').insert(r)),
      delCme: id => one(sb.from('cme_entries').delete().eq('id', id)),
      mentors: () => get(sb.from('mentors').select('*').eq('status', 'approved').order('updated_at', { ascending: false })),
      myMentor: () => one(sb.from('mentors').select('*').eq('user_id', uid).maybeSingle()),
      saveMentor: async (row, exists) => exists ? one(sb.from('mentors').update(row).eq('user_id', uid)) : one(sb.from('mentors').insert(row)),
      requestsOut: () => get(sb.from('mentorship_requests').select('*, mentor:mentors(display_name, headline)').eq('mentee_id', uid).order('created_at', { ascending: false })),
      requestsIn: () => get(sb.from('mentorship_requests').select('*').eq('mentor_id', uid).order('created_at', { ascending: false })),
      ask: r => one(sb.from('mentorship_requests').insert(r)),
      setRequest: (id, patch) => one(sb.from('mentorship_requests').update(patch).eq('id', id)),
      contacts: async id => { const { data } = await sb.rpc('mentorship_contacts', { p_request: id }); return data; },
      prefs: () => one(sb.from('alert_prefs').select('*').eq('user_id', uid).maybeSingle()),
      savePrefs: r => one(sb.from('alert_prefs').upsert({ ...r, user_id: uid, updated_at: new Date().toISOString() })),
      unread: async () => { const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false); return count || 0; },
      setPassword: async pw => { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; },
    };
  }

  function demo() {
    const S = () => {
      const s = ctx.Demo.s;
      ['mentors', 'mentorship_requests', 'attendance', 'cme_entries', 'alert_prefs', 'event_checkins'].forEach(k => { s[k] = s[k] || []; });
      return s;
    };
    const save = () => ctx.Demo.save();
    const s0 = S();
    // Sample mentors and a check-in code so the demo has something to try
    if (!s0.mentors.length) {
      s0.mentors.push({ user_id: 'kabir@demo.roar', display_name: 'Dr. Kabir Rao', headline: 'Senior resident · SBRT and thoracic', areas: ['SBRT & SRS', 'Thoracic', 'Physics & Planning'], offers: ['Exam preparation', 'Research', 'CV review'], institution: 'Demo Cancer Centre', city: 'Pune', capacity: 3, bio: 'Happy to help with DNB exam prep, a first research project or planning questions.', status: 'approved', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { user_id: 'meera@demo.roar', display_name: 'Dr. Meera Iyer', headline: 'Consultant · Breast and gynae brachytherapy', areas: ['Breast', 'Gynae', 'Brachytherapy'], offers: ['Fellowship guidance', 'Career planning', 'Observership'], institution: 'Demo Institute', city: 'Chennai', capacity: 2, bio: 'Did a brachytherapy fellowship abroad; can guide applications and observerships.', status: 'approved', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    const roar = (s0.events || []).filter(e => e.published).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
    if (roar && !s0.event_checkins.length) s0.event_checkins.push({ event_id: roar.id, code: 'ROAR26' });
    save();
    const ev = id => (S().events || []).find(e => e.id === id) || {};
    return {
      member: async () => (S().members || []).find(m => m.email === ctx.sess.email) || null,
      events: async () => (S().events || []).filter(e => e.published && (e.ends_on || e.starts_on) >= todayIST()).sort((a, b) => a.starts_on.localeCompare(b.starts_on)),
      recentRoarEvents: async () => (S().events || []).filter(e => e.published && S().event_checkins.some(c => c.event_id === e.id)),
      opportunities: async () => (S().opportunities || []).filter(o => o.published),
      resources: async () => (S().resources || []).filter(r => r.published),
      attendance: async () => S().attendance.filter(a => a.user_id === uid).map(a => ({ ...a, event: ev(a.event_id) })),
      checkin: async (eventId, code, name) => {
        const c = S().event_checkins.find(x => x.event_id === eventId);
        if (!c || c.code.toUpperCase() !== String(code).trim().toUpperCase()) throw new Error('That code is not right. Check the code shown in the session. (Demo code: ROAR26)');
        const had = S().attendance.find(a => a.event_id === eventId && a.user_id === uid);
        if (had) return had.certificate_no;
        const no = 'ROAR-' + year() + '-' + Math.random().toString(16).slice(2, 10).toUpperCase();
        S().attendance.push({ id: ctx.uid(), event_id: eventId, user_id: uid, name_on_certificate: name, method: 'code', certificate_no: no, created_at: new Date().toISOString() });
        save(); return no;
      },
      cme: async () => S().cme_entries.filter(e => e.user_id === uid).sort((a, b) => b.activity_date.localeCompare(a.activity_date)),
      addCme: async r => { S().cme_entries.push({ id: ctx.uid(), user_id: uid, created_at: new Date().toISOString(), ...r }); save(); },
      delCme: async id => { const s = S(); s.cme_entries = s.cme_entries.filter(e => e.id !== id); save(); },
      mentors: async () => S().mentors.filter(m => m.status === 'approved'),
      myMentor: async () => S().mentors.find(m => m.user_id === uid) || null,
      saveMentor: async (row, exists) => {
        const s = S();
        if (exists) Object.assign(s.mentors.find(m => m.user_id === uid), row, { updated_at: new Date().toISOString(), status: ['approved', 'paused'].includes(row.status) && ['approved', 'paused'].includes(s.mentors.find(m => m.user_id === uid).status) ? row.status : s.mentors.find(m => m.user_id === uid).status });
        else s.mentors.push({ ...row, user_id: uid, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        save();
      },
      requestsOut: async () => S().mentorship_requests.filter(r => r.mentee_id === uid).map(r => ({ ...r, mentor: S().mentors.find(m => m.user_id === r.mentor_id) })),
      requestsIn: async () => S().mentorship_requests.filter(r => r.mentor_id === uid),
      ask: async r => {
        if (S().mentorship_requests.filter(x => x.mentee_id === uid && x.status === 'pending').length >= 3) throw new Error('You already have 3 requests waiting for an answer.');
        S().mentorship_requests.push({ id: ctx.uid(), mentee_id: uid, status: 'pending', mentor_note: null, created_at: new Date().toISOString(), ...r }); save();
      },
      setRequest: async (id, patch) => { Object.assign(S().mentorship_requests.find(r => r.id === id), patch, { updated_at: new Date().toISOString() }); save(); },
      contacts: async id => { const r = S().mentorship_requests.find(x => x.id === id); return r && r.status === 'accepted' ? { mentee_email: r.mentee_id, mentor_email: r.mentor_id } : null; },
      prefs: async () => S().alert_prefs.find(p => p.user_id === uid) || null,
      savePrefs: async r => { const s = S(); s.alert_prefs = s.alert_prefs.filter(p => p.user_id !== uid); s.alert_prefs.push({ ...r, user_id: uid }); save(); },
      unread: async () => ((S().community || {}).notifications || []).filter(n => n.user_id === uid && !n.read).length,
      setPassword: async () => { throw new Error('Demo mode: passwords are not stored.'); },
    };
  }

  // ---------------------------------------------------------------- shared bits
  function dialog(html) {
    const d = document.createElement('dialog'); d.className = 'hub-dialog'; d.innerHTML = html;
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => setTimeout(() => d.remove(), 0));
    document.body.appendChild(d); d.showModal();
    return d;
  }
  const cmeTotal = (att, entries, y) =>
    att.filter(a => (a.event && a.event.starts_on || a.created_at || '').startsWith(y)).reduce((n, a) => n + (+(a.event && a.event.cme_hours) || 0), 0)
    + entries.filter(e => e.activity_date.startsWith(y)).reduce((n, e) => n + (+e.hours || 0), 0);

  // ---------------------------------------------------------------- entry
  async function view(c, tab, route) {
    ctx = c;
    uid = ctx.LIVE ? ctx.sess.id : ctx.sess.email;
    D = D || (ctx.LIVE ? live(ctx.sb) : demo());
    if (tab === 'learning') return learning(route);
    if (tab === 'mentorship') return mentorship(route);
    if (tab === 'settings') return settings();
    return home();
  }

  // ---------------------------------------------------------------- Home
  async function home() {
    root().innerHTML = '<div class="card empty-state">Loading your dashboard…</div>';
    const [member, events, opps, att, entries, out, inn, mine, unread] = await Promise.all([
      D.member(), D.events(), D.opportunities(), D.attendance(), D.cme(), D.requestsOut(), D.requestsIn(), D.myMentor(), D.unread().catch(() => 0)]);
    const R = window.ROAR_RULES;
    const name = (member && member.full_name) || (JSON.parse(localStorage.getItem('roar-me') || '{}').name) || '';
    const hours = cmeTotal(att, entries, year());
    const today = todayIST();
    const next = events.filter(e => (e.ends_on || e.starts_on) >= today).slice(0, 3);
    const fresh = opps.filter(o => !o.deadline || o.deadline >= today).slice(0, 3);
    const pendingIn = inn.filter(r => r.status === 'pending').length;
    const openOut = out.filter(r => ['pending', 'accepted'].includes(r.status)).length;
    let memLine = 'Not a member yet', memLink = '#membership', memCta = 'Apply';
    if (member) {
      memLine = (R && R.STATUS_LABEL && R.STATUS_LABEL[member.status]) || member.status;
      if (member.status === 'approved') memLine = member.member_no ? `Member ${member.member_no}` : 'Approved member';
      memCta = 'View card';
    }
    const tile = (label, value, sub, href, cta) => `<a class="hub-tile glass" href="${href}"><span class="hub-tile-l">${label}</span><b>${value}</b><span class="hub-tile-s">${sub}</span><span class="hub-tile-cta">${cta} →</span></a>`;
    root().innerHTML = `
      ${head('My ROAR', name ? `Welcome, ${esc(name.replace(/^Dr\.?\s+/i, 'Dr. ').split(' ').slice(0, 2).join(' '))}` : 'Welcome to My ROAR')}
      <div class="hub-tiles">
        ${tile('Membership', esc(memLine), member && member.paid_until ? `Paid until ${ctx.fmt(member.paid_until)}` : member ? esc(R && R.PLAN_LABEL ? R.PLAN_LABEL[member.plan] || '' : '') : 'Join to vote and access all programmes', memLink, memCta)}
        ${tile(`CME in ${year()}`, `${num(hours)} h`, `${att.length} certificate${att.length === 1 ? '' : 's'} · ${entries.length} logged`, '#learning', 'Learning record')}
        ${tile('Mentorship', pendingIn ? `${pendingIn} waiting` : openOut ? `${openOut} active` : mine ? (mine.status === 'approved' ? 'Mentoring' : mine.status === 'pending' ? 'Awaiting approval' : 'Paused') : 'Find a mentor', pendingIn ? 'Requests waiting for your reply' : openOut ? 'Your mentorship requests' : 'One-to-one help from experienced colleagues', '#mentorship', pendingIn ? 'Reply' : 'Open')}
        ${tile('Community', unread ? `${unread} new` : 'Join in', unread ? 'Notifications waiting' : 'Questions, cases and articles', '#community', 'Open Community')}
      </div>
      <div class="dash">
        <div>
          <div class="panel glass"><h2>Coming up</h2>
            ${next.length ? next.map(e => `<div class="hub-row"><div class="mz-date"><b>${esc(new Date(e.starts_on + 'T00:00:00+05:30').getDate())}</b><span>${esc(new Date(e.starts_on + 'T00:00:00+05:30').toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }))}</span></div>
              <div><div class="meta-row">${tag(e.kind || 'Event')}${e.roar_event ? tag('ROAR', 'tag-roar') : ''}${e.cme_hours ? tag(num(e.cme_hours) + ' CME h', 'tag-quiet') : ''}</div><b>${esc(e.title)}</b><div class="when">${ctx.fmt(e.starts_on)}${e.city ? ' · ' + esc(e.city) : ''}</div></div></div>`).join('') : '<p class="muted" style="margin:0">Nothing scheduled yet.</p>'}
            <p style="margin:12px 0 0"><a class="more" href="../events.html">All events →</a></p>
          </div>
          <div class="panel glass"><h2>New openings</h2>
            ${fresh.length ? fresh.map(o => `<div class="hub-row"><div><div class="meta-row">${tag(o.kind)}${o.deadline ? tag('Apply by ' + ctx.fmt(o.deadline), 'tag-quiet') : ''}</div><b>${safeUrl(o.url) ? `<a href="${safeUrl(o.url)}" target="_blank" rel="noopener">${esc(o.title)} ↗</a>` : esc(o.title)}</b><div class="when">${[o.organisation, o.location].filter(Boolean).map(esc).join(' · ')}</div></div></div>`).join('') : '<p class="muted" style="margin:0">No open positions right now.</p>'}
            <p style="margin:12px 0 0"><a class="more" href="#careers">Careers →</a> · <a class="more" href="#settings">Get job alerts →</a></p>
          </div>
        </div>
        <div>
          <div class="panel glass"><h2>Quick actions</h2>
            <div class="hub-actions">
              <a href="#learning" class="hub-act"><b>Check in to a session</b><span>Get your certificate</span></a>
              <a href="#learning/log" class="hub-act"><b>Log CME</b><span>Add a course or conference</span></a>
              <a href="#mentorship" class="hub-act"><b>Find a mentor</b><span>CV, fellowships, exams</span></a>
              <a href="#careers" class="hub-act"><b>Ask for career help</b><span>One-to-one guidance</span></a>
              <a href="#welfare" class="hub-act"><b>Raise a concern</b><span>In confidence</span></a>
              <a href="../research.html" class="hub-act"><b>Join a research project</b><span>Research Collective</span></a>
            </div>
          </div>
          ${ctx.isFounder ? `<div class="panel glass"><h2>Founders' Council</h2><p style="margin:0 0 12px">Manage members, events, mentors, research projects and more.</p><a class="btn btn-primary small" href="../council/">Open the Founders' console</a></div>` : ''}
          <div class="panel glass"><h2>Settings</h2><p style="margin:0 0 12px">Choose which emails you get, including job alerts.</p><a class="btn btn-glass small" href="#settings">Notification settings</a></div>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- Learning: check-in, certificates, CME log, library
  async function learning(route) {
    root().innerHTML = '<div class="card empty-state">Loading…</div>';
    const [att, entries, sessions, res] = await Promise.all([D.attendance(), D.cme(), D.recentRoarEvents(), D.resources()]);
    const y = year();
    const name = JSON.parse(localStorage.getItem('roar-me') || '{}').name || '';
    const years = [...new Set([y, ...att.map(a => (a.event && a.event.starts_on || '').slice(0, 4)), ...entries.map(e => e.activity_date.slice(0, 4))].filter(Boolean))].sort().reverse();
    root().innerHTML = `
      ${head('My ROAR', 'Learning', 'Check in to ROAR sessions for a certificate, keep a record of all your learning, and browse the library.')}
      <div class="hub-tiles three">
        ${years.slice(0, 3).map(yy => `<div class="hub-tile glass static"><span class="hub-tile-l">CME in ${yy}</span><b>${num(cmeTotal(att, entries, yy))} h</b><span class="hub-tile-s">${att.filter(a => (a.event && a.event.starts_on || '').startsWith(yy)).length} ROAR · ${entries.filter(e => e.activity_date.startsWith(yy)).length} other</span></div>`).join('')}
      </div>
      <div class="dash">
        <div>
          <form class="panel glass pform" id="hub-checkin">
            <h2>Check in to a ROAR session</h2>
            <p class="muted" style="margin:-4px 0 12px;font-size:.92rem">Enter the code shown during the session. You'll get a numbered certificate that anyone can verify.</p>
            ${sessions.length ? `<div class="row one"><div><label for="ci-ev">Session</label><select id="ci-ev">${sessions.map(e => `<option value="${esc(e.id)}">${esc(e.title)} · ${ctx.fmt(e.starts_on)}</option>`).join('')}</select></div></div>
            <div class="row"><div><label for="ci-code">Check-in code</label><input id="ci-code" required autocapitalize="characters" autocomplete="off" maxlength="20"></div>
              <div><label for="ci-name">Name on certificate</label><input id="ci-name" required maxlength="120" value="${esc(name)}"></div></div>
            <button class="btn btn-primary" type="submit">Check in</button><p class="msg" id="ci-msg" role="status"></p>`
            : '<p class="muted" style="margin:0">No ROAR sessions are open for check-in right now. Codes are shared at the end of each session.</p>'}
          </form>
          <div class="panel glass"><h2>My certificates</h2>
            ${att.length ? att.map(a => `<div class="hub-row"><div><b>${esc(a.event && a.event.title || 'ROAR session')}</b><div class="when">${a.event && a.event.starts_on ? ctx.fmt(a.event.starts_on) : ''}${a.event && a.event.cme_hours ? ' · ' + num(a.event.cme_hours) + ' CME hours' : ''} · <code>${esc(a.certificate_no)}</code></div></div>
              <a class="btn btn-glass small" href="${certUrl(a.certificate_no)}" target="_blank" rel="noopener">Certificate</a></div>`).join('') : '<p class="muted" style="margin:0">Your certificates from ROAR sessions will appear here.</p>'}
          </div>
        </div>
        <div>
          <div class="panel glass" id="hub-log"><div class="hub-h"><h2>CME log</h2><button class="btn btn-glass small" type="button" id="cme-csv">Download CSV</button></div>
            <form class="pform hub-cme-form" id="cme-form">
              <div class="row one"><div><label for="cme-t">Activity</label><input id="cme-t" required maxlength="300" placeholder="e.g. ESTRO course on SBRT"></div></div>
              <div class="row"><div><label for="cme-c">Type</label><select id="cme-c">${CME_CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
                <div><label for="cme-p">Provider</label><input id="cme-p" maxlength="200" placeholder="Optional"></div></div>
              <div class="row"><div><label for="cme-d">Date</label><input id="cme-d" type="date" required max="${todayIST()}" value="${todayIST()}"></div>
                <div><label for="cme-h">Hours</label><input id="cme-h" type="number" required min="0.5" max="100" step="0.5" value="1"></div></div>
              <div class="row one"><div><label for="cme-u">Link to certificate or programme</label><input id="cme-u" type="url" placeholder="Optional, https://…"></div></div>
              <button class="btn btn-primary small" type="submit">Add to my log</button><p class="msg" id="cme-msg" role="status"></p>
            </form>
            <div id="cme-list">${entries.length ? entries.map(e => `<div class="hub-row"><div><b>${esc(e.title)}</b><div class="when">${ctx.fmt(e.activity_date)} · ${esc(e.category)}${e.provider ? ' · ' + esc(e.provider) : ''} · ${num(e.hours)} h${safeUrl(e.evidence_url) ? ` · <a href="${safeUrl(e.evidence_url)}" target="_blank" rel="noopener">evidence ↗</a>` : ''}</div></div>
              <button class="linklike" data-del="${esc(e.id)}" aria-label="Delete ${esc(e.title)}">Delete</button></div>`).join('') : '<p class="muted" style="margin:0">Add conferences, courses and other learning to keep a complete record.</p>'}</div>
          </div>
        </div>
      </div>
      <div class="panel glass"><div class="hub-h"><h2>Learning library</h2><input type="search" id="lib-q" placeholder="Search the library" aria-label="Search the library" class="hub-search"></div><div id="lib-list" class="hub-lib"></div></div>`;
    // check-in
    const ci = $('#hub-checkin');
    if (sessions.length) ci.addEventListener('submit', async e => {
      e.preventDefault();
      const m = $('#ci-msg');
      try {
        m.textContent = 'Checking…'; m.className = 'msg';
        const no = await D.checkin($('#ci-ev').value, $('#ci-code').value, $('#ci-name').value.trim());
        ctx.toast('Checked in. Your certificate is ready.');
        learning(); setTimeout(() => window.open(certUrl(no), '_blank', 'noopener'), 300);
      } catch (err) { m.textContent = err.message; m.className = 'msg err'; }
    });
    // CME log
    $('#cme-form').addEventListener('submit', async e => {
      e.preventDefault();
      const m = $('#cme-msg');
      const u = $('#cme-u').value.trim();
      if (u && !/^https?:\/\//i.test(u)) { m.textContent = 'Links start with http:// or https://'; m.className = 'msg err'; return; }
      try {
        await D.addCme({ title: $('#cme-t').value.trim(), category: $('#cme-c').value, provider: $('#cme-p').value.trim() || null, activity_date: $('#cme-d').value, hours: +$('#cme-h').value, evidence_url: u || null });
        ctx.toast('Added to your CME log'); learning('log');
      } catch (err) { m.textContent = err.message; m.className = 'msg err'; }
    });
    root().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this entry from your log?')) return;
      try { await D.delCme(b.dataset.del); learning('log'); } catch (err) { ctx.fail(err); }
    }));
    $('#cme-csv').addEventListener('click', () => {
      const cell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
      const rows = [['Date', 'Activity', 'Type', 'Provider', 'Hours', 'Certificate or evidence'],
        ...att.map(a => [a.event && a.event.starts_on, a.event && a.event.title, 'ROAR session', 'ROAR', a.event && a.event.cme_hours || '', a.certificate_no]),
        ...entries.map(x => [x.activity_date, x.title, x.category, x.provider, x.hours, x.evidence_url])];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' }));
      a.download = `roar-cme-log-${todayIST()}.csv`; a.click();
    });
    // library
    const draw = () => {
      const q = ($('#lib-q').value || '').toLowerCase();
      const rows = res.filter(r => !q || (r.title + ' ' + (r.description || '') + ' ' + r.kind).toLowerCase().includes(q)).sort((a, b) => (b.members_only ? 1 : 0) - (a.members_only ? 1 : 0) || a.title.localeCompare(b.title));
      $('#lib-list').innerHTML = rows.length ? rows.map(r => `<a class="hub-libitem" href="${safeUrl(r.url) || '#'}" target="_blank" rel="noopener"><div class="meta-row">${tag(r.kind)}${r.level ? tag(r.level, 'tag-quiet') : ''}${r.members_only ? tag('Members', 'tag-roar') : ''}</div><b>${esc(r.title)} ↗</b>${r.description ? `<span>${esc(r.description)}</span>` : ''}</a>`).join('') : `<p class="muted" style="margin:0">${res.length ? 'Nothing matches that search.' : 'The Academic Society is preparing the first resources.'}</p>`;
    };
    $('#lib-q').addEventListener('input', draw); draw();
    if (route && route[0] === 'log') { const el = $('#hub-log'); if (el) el.scrollIntoView({ block: 'start' }); }
  }

  // ---------------------------------------------------------------- Mentorship
  let mentorFilter = { area: '', offer: '' };
  async function mentorship() {
    root().innerHTML = '<div class="card empty-state">Loading…</div>';
    const [mentors, out, inn, mine] = await Promise.all([D.mentors(), D.requestsOut(), D.requestsIn(), D.myMentor()]);
    const others = mentors.filter(m => m.user_id !== uid);
    const ST = { pending: 'Waiting for reply', accepted: 'Accepted', declined: 'Declined', closed: 'Closed', withdrawn: 'Withdrawn' };
    const list = others.filter(m => (!mentorFilter.area || (m.areas || []).includes(mentorFilter.area)) && (!mentorFilter.offer || (m.offers || []).includes(mentorFilter.offer)));
    root().innerHTML = `
      ${head('My ROAR', 'Mentorship', 'One-to-one help from experienced colleagues: CVs, fellowships, exams, research and careers. Every mentor is approved by the Founders\' Council.')}
      ${inn.length || mine ? `<div class="panel glass"><div class="hub-h"><h2>Mentoring others</h2>${mine ? `<span class="pill ${esc(mine.status)}">${esc({ pending: 'Awaiting approval', approved: 'Listed', paused: 'Paused' }[mine.status])}</span>` : ''}</div>
        ${inn.length ? inn.map(r => `<div class="hub-req" data-req="${esc(r.id)}"><div><div class="meta-row">${tag(r.topic)}<span class="pill ${esc(r.status)}">${esc(ST[r.status])}</span></div>
            <b>${esc(r.mentee_name)}</b><p>${esc(r.message)}</p>${r.mentor_note ? `<p class="muted">Your note: ${esc(r.mentor_note)}</p>` : ''}<div class="hub-contact"></div></div>
          <div class="hub-req-acts">${r.status === 'pending' ? '<button class="btn btn-primary small" data-act="accepted">Accept</button><button class="btn btn-glass small" data-act="declined">Decline</button>' : r.status === 'accepted' ? '<button class="btn btn-glass small" data-act="contact">Contact details</button><button class="btn btn-glass small" data-act="closed">Mark done</button>' : ''}</div></div>`).join('') : '<p class="muted" style="margin:0">No requests yet. Members will find you once the Founders\' Council approves your profile.</p>'}
      </div>` : ''}
      ${out.length ? `<div class="panel glass"><h2>My requests</h2>${out.map(r => `<div class="hub-req" data-req="${esc(r.id)}"><div><div class="meta-row">${tag(r.topic)}<span class="pill ${esc(r.status)}">${esc(ST[r.status])}</span></div>
          <b>${esc(r.mentor ? r.mentor.display_name : 'Mentor')}</b>${r.mentor && r.mentor.headline ? `<span class="when"> · ${esc(r.mentor.headline)}</span>` : ''}${r.mentor_note ? `<p>“${esc(r.mentor_note)}”</p>` : ''}<div class="hub-contact"></div></div>
        <div class="hub-req-acts">${r.status === 'pending' ? '<button class="btn btn-glass small" data-act="withdrawn">Withdraw</button>' : r.status === 'accepted' ? '<button class="btn btn-primary small" data-act="contact">Contact details</button><button class="btn btn-glass small" data-act="closed">Mark done</button>' : ''}</div></div>`).join('')}</div>` : ''}
      <div class="panel glass"><div class="hub-h"><h2>Find a mentor</h2>
          <div class="hub-filters"><select id="mf-area" aria-label="Area"><option value="">All areas</option>${AREAS.map(a => `<option${mentorFilter.area === a ? ' selected' : ''}>${a}</option>`).join('')}</select>
          <select id="mf-offer" aria-label="Help with"><option value="">Any help</option>${OFFERS.map(a => `<option${mentorFilter.offer === a ? ' selected' : ''}>${a}</option>`).join('')}</select></div></div>
        <div class="hub-mentors">${list.length ? list.map(m => `<article class="hub-mentor">
            <div class="hub-mentor-top"><span class="hub-av">${esc(m.display_name.replace(/^Dr\.?\s*/i, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>
              <div><b>${esc(m.display_name)}</b><span>${esc(m.headline || '')}</span><span class="when">${[m.institution, m.city].filter(Boolean).map(esc).join(' · ')}</span></div></div>
            ${m.bio ? `<p>${esc(m.bio)}</p>` : ''}
            <div class="meta-row">${(m.areas || []).map(a => tag(a, 'tag-quiet')).join('')}</div>
            <div class="meta-row">${(m.offers || []).map(a => tag(a)).join('')}</div>
            <button class="btn btn-primary small" data-ask="${esc(m.user_id)}">Ask for help</button>
          </article>`).join('') : `<p class="muted" style="margin:0">${others.length ? 'No mentor matches those filters yet.' : 'The first mentors are being approved. Check back soon, or offer to mentor below.'}</p>`}</div>
      </div>
      <form class="panel glass pform" id="mentor-form">
        <h2>${mine ? 'My mentor profile' : 'Offer to mentor'}</h2>
        <p class="muted" style="margin:-4px 0 12px;font-size:.92rem">${mine ? 'Changes are saved straight away. You can pause new requests at any time.' : 'Senior residents, consultants and alumni can offer an hour a month. The Founders\' Council approves each mentor before they appear here.'}</p>
        <div class="row"><div><label for="mt-name">Name shown to members</label><input id="mt-name" required minlength="2" maxlength="80" value="${esc(mine ? mine.display_name : (JSON.parse(localStorage.getItem('roar-me') || '{}').name || ''))}"></div>
          <div><label for="mt-head">Headline</label><input id="mt-head" maxlength="160" placeholder="e.g. Consultant · thoracic and SBRT" value="${esc(mine && mine.headline || '')}"></div></div>
        <div class="row"><div><label for="mt-inst">Institution</label><input id="mt-inst" maxlength="200" value="${esc(mine && mine.institution || '')}"></div>
          <div><label for="mt-city">City</label><input id="mt-city" maxlength="80" value="${esc(mine && mine.city || '')}"></div></div>
        <label>Areas</label><div class="hub-checks">${AREAS.map(a => `<label><input type="checkbox" name="mt-area" value="${a}"${mine && (mine.areas || []).includes(a) ? ' checked' : ''}> ${a}</label>`).join('')}</div>
        <label style="margin-top:12px">I can help with</label><div class="hub-checks">${OFFERS.map(a => `<label><input type="checkbox" name="mt-offer" value="${a}"${mine && (mine.offers || []).includes(a) ? ' checked' : ''}> ${a}</label>`).join('')}</div>
        <div class="row" style="margin-top:12px"><div><label for="mt-cap">Mentees at a time</label><input id="mt-cap" type="number" min="0" max="10" value="${mine ? mine.capacity : 2}"></div>
          ${mine && mine.status !== 'pending' ? `<div><label for="mt-status">Taking new requests?</label><select id="mt-status"><option value="approved"${mine.status === 'approved' ? ' selected' : ''}>Yes</option><option value="paused"${mine.status === 'paused' ? ' selected' : ''}>Pause for now</option></select></div>` : '<div></div>'}</div>
        <div class="row one"><div><label for="mt-bio">About you</label><textarea id="mt-bio" maxlength="1200" rows="3" placeholder="Your experience, and what kind of help you enjoy giving.">${esc(mine && mine.bio || '')}</textarea></div></div>
        <button class="btn btn-primary" type="submit">${mine ? 'Save' : 'Offer to mentor'}</button><p class="msg" id="mt-msg" role="status"></p>
      </form>`;
    $('#mf-area').addEventListener('change', e => { mentorFilter.area = e.target.value; mentorship(); });
    $('#mf-offer').addEventListener('change', e => { mentorFilter.offer = e.target.value; mentorship(); });
    root().querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => askDialog(others.find(m => m.user_id === b.dataset.ask))));
    root().querySelectorAll('.hub-req').forEach(el => el.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = el.dataset.req, act = b.dataset.act;
      try {
        if (act === 'contact') {
          const c = await D.contacts(id);
          el.querySelector('.hub-contact').innerHTML = c ? `<p class="hub-contact-box">Mentor: <a href="mailto:${esc(c.mentor_email)}">${esc(c.mentor_email)}</a><br>Mentee: <a href="mailto:${esc(c.mentee_email)}">${esc(c.mentee_email)}</a></p>` : '<p class="muted">Contact details are shared once the request is accepted.</p>';
          return;
        }
        const patch = { status: act };
        if (act === 'accepted' || act === 'declined') { const note = prompt(act === 'accepted' ? 'A short note for your mentee (optional), e.g. how to reach you:' : 'A short note explaining why (optional):', ''); if (note === null) return; if (note.trim()) patch.mentor_note = note.trim(); }
        if (act === 'withdrawn' && !confirm('Withdraw this request?')) return;
        await D.setRequest(id, patch); ctx.toast('Updated'); mentorship();
      } catch (err) { ctx.fail(err); }
    }));
    $('#mentor-form').addEventListener('submit', async e => {
      e.preventDefault();
      const m = $('#mt-msg');
      const offers = [...root().querySelectorAll('[name="mt-offer"]:checked')].map(x => x.value);
      if (!offers.length) { m.textContent = 'Choose at least one thing you can help with.'; m.className = 'msg err'; return; }
      const row = { display_name: $('#mt-name').value.trim(), headline: $('#mt-head').value.trim() || null, institution: $('#mt-inst').value.trim() || null, city: $('#mt-city').value.trim() || null,
        areas: [...root().querySelectorAll('[name="mt-area"]:checked')].map(x => x.value), offers, capacity: +$('#mt-cap').value || 0, bio: $('#mt-bio').value.trim() || null };
      const st = $('#mt-status'); if (st) row.status = st.value;
      try { await D.saveMentor(row, !!mine); ctx.toast(mine ? 'Saved' : "Thank you. The Founders' Council will review your profile."); mentorship(); }
      catch (err) { m.textContent = err.message; m.className = 'msg err'; }
    });
  }
  function askDialog(m) {
    if (!m) return;
    const name = JSON.parse(localStorage.getItem('roar-me') || '{}').name || '';
    const d = dialog(`<form method="dialog" class="pform hub-dpad">
      <h2>Ask ${esc(m.display_name)}</h2>
      <p class="muted" style="margin:-6px 0 12px;font-size:.9rem">Your mentor sees your name, topic and message. You'll both see each other's email once they accept.</p>
      <div class="row one"><div><label for="ak-topic">Help with</label><select id="ak-topic">${(m.offers || OFFERS).map(o => `<option>${esc(o)}</option>`).join('')}</select></div></div>
      <div class="row one"><div><label for="ak-name">Your name</label><input id="ak-name" required minlength="2" maxlength="120" value="${esc(name)}"></div></div>
      <div class="row one"><div><label for="ak-msg">Message</label><textarea id="ak-msg" rows="5" required minlength="10" maxlength="2000" placeholder="Your stage of training, what you're aiming for, and any deadlines."></textarea></div></div>
      <p class="msg" id="ak-err" role="status"></p>
      <div class="hub-dacts"><button value="cancel" class="btn btn-glass small" formnovalidate>Cancel</button><button value="send" class="btn btn-primary small" id="ak-send">Send request</button></div>
    </form>`);
    d.querySelector('#ak-send').addEventListener('click', async e => {
      e.preventDefault();
      const f = d.querySelector('form'); if (!f.reportValidity()) return;
      try {
        await D.ask({ mentor_id: m.user_id, topic: d.querySelector('#ak-topic').value, mentee_name: d.querySelector('#ak-name').value.trim(), message: d.querySelector('#ak-msg').value.trim() });
        d.close(); ctx.toast('Request sent'); mentorship();
      } catch (err) { const x = d.querySelector('#ak-err'); x.textContent = err.message; x.className = 'msg err'; }
    });
  }

  // ---------------------------------------------------------------- Settings
  async function settings() {
    const p = (await D.prefs()) || { email_jobs: false, job_kinds: [], job_keywords: '', email_mentorship: true, email_events: false };
    const founderLogin = /\.invalid$/.test(ctx.sess.email);
    root().innerHTML = `
      ${head('My ROAR', 'Settings', 'Choose which emails ROAR sends you.')}
      ${founderLogin ? '<div class="notice">Founders sign in with a username, which has no email inbox, so ROAR can\'t email you at this login. Your notifications still appear on the site.</div>' : ''}
      <div class="dash">
        <form class="panel glass pform" id="prefs">
          <h2>Email notifications</h2>
          <label class="hub-switch"><input type="checkbox" id="p-mentor"${p.email_mentorship ? ' checked' : ''}><span><b>Mentorship</b><br><small class="muted">New requests if you mentor, and replies to your requests.</small></span></label>
          <label class="hub-switch"><input type="checkbox" id="p-events"${p.email_events ? ' checked' : ''}><span><b>ROAR sessions</b><br><small class="muted">Reminders about upcoming ROAR sessions.</small></span></label>
          <label class="hub-switch"><input type="checkbox" id="p-jobs"${p.email_jobs ? ' checked' : ''}><span><b>Job alerts</b><br><small class="muted">An email when a matching opening is posted.</small></span></label>
          <div id="p-jobopts"${p.email_jobs ? '' : ' hidden'}>
            <label>Types of opening</label><div class="hub-checks">${JOB_KINDS.map(k => `<label><input type="checkbox" name="p-kind" value="${k}"${(p.job_kinds || []).includes(k) ? ' checked' : ''}> ${k}</label>`).join('')}</div>
            <small class="muted">Leave all unticked for every type.</small>
            <div class="row one" style="margin-top:12px"><div><label for="p-kw">Keywords (optional, separated by commas)</label><input id="p-kw" maxlength="200" value="${esc(p.job_keywords || '')}" placeholder="e.g. SBRT, brachytherapy, Delhi"></div></div>
          </div>
          <button class="btn btn-primary" type="submit">Save settings</button><p class="msg" id="p-msg" role="status"></p>
          <p class="muted" style="font-size:.84rem;margin:12px 0 0">Emails start once ROAR connects its email service. Your choices are saved now and apply from then.</p>
        </form>
        <div>
          ${ctx.LIVE && !founderLogin ? `<form class="panel glass pform" id="pw"><h2>Change password</h2>
            <div class="row one"><div><label for="pw1">New password (at least 10 characters)</label><input id="pw1" type="password" required minlength="10" autocomplete="new-password"></div></div>
            <div class="row one"><div><label for="pw2">Type it again</label><input id="pw2" type="password" required minlength="10" autocomplete="new-password"></div></div>
            <button class="btn btn-glass" type="submit">Change password</button><p class="msg" id="pw-msg" role="status"></p></form>` : ''}
          ${founderLogin ? '<div class="panel glass"><h2>Password</h2><p style="margin:0 0 12px">Founders change their password in the Founders\' console.</p><a class="btn btn-glass small" href="../council/">Open the console</a></div>' : ''}
          <div class="panel glass"><h2>Your data</h2><p style="margin:0">ROAR keeps your details private and never sells or shares them. Read the <a href="../privacy.html">privacy note</a>, or write to us through <a href="../contact.html">Contact</a> to have your account deleted.</p></div>
        </div>
      </div>`;
    $('#p-jobs').addEventListener('change', e => { $('#p-jobopts').hidden = !e.target.checked; });
    $('#prefs').addEventListener('submit', async e => {
      e.preventDefault();
      const m = $('#p-msg');
      try {
        await D.savePrefs({ email_mentorship: $('#p-mentor').checked, email_events: $('#p-events').checked, email_jobs: $('#p-jobs').checked,
          job_kinds: [...root().querySelectorAll('[name="p-kind"]:checked')].map(x => x.value), job_keywords: $('#p-kw').value.trim() || null });
        m.textContent = 'Saved.'; m.className = 'msg ok';
      } catch (err) { m.textContent = err.message; m.className = 'msg err'; }
    });
    const pw = $('#pw');
    if (pw) pw.addEventListener('submit', async e => {
      e.preventDefault();
      const m = $('#pw-msg'), a = $('#pw1').value, b = $('#pw2').value;
      if (a.length < 10) { m.textContent = 'Use at least 10 characters.'; m.className = 'msg err'; return; }
      if (a !== b) { m.textContent = 'The two passwords do not match.'; m.className = 'msg err'; return; }
      try { await D.setPassword(a); m.textContent = 'Password changed.'; m.className = 'msg ok'; pw.reset(); } catch (err) { m.textContent = err.message; m.className = 'msg err'; }
    });
  }

  window.ROAR_HUB = { view };
})();
