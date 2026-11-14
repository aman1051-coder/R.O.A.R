// Founders' console: programmes for members (schema PART 15).
//   #/mentors     approve, pause or remove mentors; see mentorship activity
//   #/cme         CME hours and check-in codes for ROAR sessions; attendance and certificates
//   #/research    Research Collective projects and who has expressed interest
//   #/outbox      emails waiting to be sent (job alerts, mentorship), once the email service is connected
(() => {
  'use strict';
  const C = window.ROAR_COUNCIL;
  if (!C) return;
  const { DB, LIVE, esc, toast, fail, fmtDate, setHeader } = C;
  const $ = s => document.querySelector(s);
  const view = () => $('#view');
  const pill = v => `<span class="pill ${esc(v)}">${esc(v)}</span>`;
  const cell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = (name, rows) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' })); a.download = name; a.click(); };
  const code = () => 'ROAR' + Math.random().toString(36).slice(2, 6).toUpperCase();

  // ---------------------------------------------------------------- Mentors
  async function mentors() {
    setHeader('Programmes', 'Mentors');
    view().innerHTML = '<div class="panel glass empty">Loading…</div>';
    const [ms, reqs] = await Promise.all([DB.list('mentors', ['created_at', false]), DB.list('mentorship_requests', ['created_at', false])]);
    const count = (id, st) => reqs.filter(r => r.mentor_id === id && (!st || r.status === st)).length;
    const order = { pending: 0, approved: 1, paused: 2 };
    ms.sort((a, b) => order[a.status] - order[b.status]);
    view().innerHTML = `
      <p class="lead" style="margin-top:-6px">Members offer to mentor in My ROAR. Approve each mentor before they are listed. Members see a mentor's email only after the mentor accepts their request.</p>
      <div class="grid k4" style="margin-bottom:20px">
        <div class="kpi glass"><div class="n">${ms.filter(m => m.status === 'pending').length}</div><div class="l">Waiting for approval</div></div>
        <div class="kpi glass"><div class="n">${ms.filter(m => m.status === 'approved').length}</div><div class="l">Listed mentors</div></div>
        <div class="kpi glass"><div class="n">${reqs.filter(r => r.status === 'pending').length}</div><div class="l">Requests waiting</div></div>
        <div class="kpi glass"><div class="n">${reqs.filter(r => r.status === 'accepted' || r.status === 'closed').length}</div><div class="l">Matches made</div></div>
      </div>
      <div class="panel glass">${ms.length ? ms.map(m => `<div class="mod-item" data-id="${esc(m.user_id)}">
          <div class="meta-row">${pill(m.status)}${(m.offers || []).map(o => `<span class="tag tag-quiet">${esc(o)}</span>`).join('')}</div>
          <h3 style="margin:8px 0 2px">${esc(m.display_name)}</h3>
          <div class="muted" style="font-size:.9rem">${[m.headline, m.institution, m.city].filter(Boolean).map(esc).join(' · ')}</div>
          ${m.areas && m.areas.length ? `<div style="font-size:.88rem;margin-top:4px">Areas: ${m.areas.map(esc).join(', ')}</div>` : ''}
          ${m.bio ? `<div class="mod-quote">${esc(m.bio)}</div>` : ''}
          <div class="muted" style="font-size:.86rem">Up to ${esc(m.capacity)} mentees · ${count(m.user_id, 'pending')} waiting · ${count(m.user_id, 'accepted')} active · offered ${fmtDate(m.created_at)}</div>
          <div class="mod-actions">
            ${m.status !== 'approved' ? '<button class="btn btn-primary small" data-do="approved">Approve and list</button>' : '<button class="btn btn-glass small" data-do="paused">Pause</button>'}
            <button class="btn btn-glass small" data-do="remove">Remove</button>
          </div></div>`).join('') : '<p class="muted" style="margin:0">No one has offered to mentor yet. Members can offer in My ROAR → Mentorship.</p>'}</div>`;
    view().querySelectorAll('.mod-item [data-do]').forEach(b => b.addEventListener('click', async () => {
      const id = b.closest('.mod-item').dataset.id;
      try {
        if (b.dataset.do === 'remove') { if (!confirm('Remove this mentor? Their open requests are removed too.')) return; await DB.remove('mentors', id, 'user_id'); }
        else await DB.update('mentors', id, { status: b.dataset.do }, 'user_id');
        toast('Updated'); mentors();
      } catch (e) { fail(e); }
    }));
  }

  // ---------------------------------------------------------------- Sessions, CME and certificates
  let openEvent = null;
  async function cme() {
    setHeader('Programmes', 'Sessions & CME');
    view().innerHTML = '<div class="panel glass empty">Loading…</div>';
    const [events, checkins, att] = await Promise.all([DB.list('events', ['starts_on', false]), DB.list('event_checkins'), DB.list('attendance', ['created_at', false])]);
    const roar = events.filter(e => e.roar_event || checkins.some(c => c.event_id === e.id));
    const others = events.filter(e => !roar.includes(e));
    const ck = id => checkins.find(c => c.event_id === id);
    const row = e => {
      const c = ck(e.id), n = att.filter(a => a.event_id === e.id).length;
      return `<div class="mod-item" data-id="${esc(e.id)}">
        <div class="meta-row"><span class="tag">${esc(e.kind)}</span>${e.published ? pill('published') : pill('draft')}${e.cme_hours ? `<span class="tag tag-quiet">${esc(e.cme_hours)} CME h</span>` : ''}${c ? `<span class="tag tag-roar">Code ${esc(c.code)}</span>` : ''}</div>
        <h3 style="margin:8px 0 2px">${esc(e.title)}</h3><div class="muted" style="font-size:.9rem">${fmtDate(e.starts_on)} · ${n} checked in</div>
        <div class="mod-actions">
          <button class="btn btn-glass small" data-do="hours">CME hours</button>
          <button class="btn btn-${c ? 'glass' : 'primary'} small" data-do="code">${c ? 'Change code' : 'Set check-in code'}</button>
          ${c ? `<button class="btn btn-glass small" data-do="${c.closes_at && new Date(c.closes_at) < new Date() ? 'reopen' : 'close'}">${c.closes_at && new Date(c.closes_at) < new Date() ? 'Reopen check-in' : 'Close check-in'}</button>` : ''}
          <button class="btn btn-glass small" data-do="list">Attendance (${n})</button>
        </div>
        ${openEvent === e.id ? `<div class="att-list">${n ? att.filter(a => a.event_id === e.id).map(a => `<div class="att-row"><span>${esc(a.name_on_certificate)}</span><code>${esc(a.certificate_no)}</code><span class="muted">${a.method === 'founder' ? 'added by a founder' : 'checked in'} · ${fmtDate(a.created_at)}</span></div>`).join('') : '<p class="muted">No one has checked in yet.</p>'}
          <div class="mod-actions"><button class="btn btn-glass small" data-do="mark">Record attendance by email</button>${n ? '<button class="btn btn-glass small" data-do="csv">Export CSV</button>' : ''}</div></div>` : ''}
      </div>`;
    };
    view().innerHTML = `
      <p class="lead" style="margin-top:-6px">Give a ROAR session CME hours and a check-in code. Show the code at the end of the session: members enter it in My ROAR → Learning and get a numbered certificate that anyone can check at /certificate.html. Close check-in when you're done.</p>
      <div class="panel glass"><h2>ROAR sessions</h2>${roar.length ? roar.map(row).join('') : '<p class="muted" style="margin:0">Mark an event as a ROAR event on the Events page to see it here.</p>'}</div>
      ${others.length ? `<details class="panel glass"><summary style="cursor:pointer;font-weight:600">Other events (${others.length})</summary>${others.map(row).join('')}</details>` : ''}`;
    view().querySelectorAll('.mod-item [data-do]').forEach(b => b.addEventListener('click', async () => {
      const id = b.closest('.mod-item').dataset.id, e = events.find(x => x.id === id), c = ck(id);
      try {
        switch (b.dataset.do) {
          case 'hours': { const h = prompt('CME hours for this session (0 for none):', e.cme_hours || ''); if (h === null) return; await DB.update('events', id, { cme_hours: h === '' || +h === 0 ? null : +h }); break; }
          case 'code': {
            const v = prompt('Check-in code (4-20 letters, numbers or dashes):', c ? c.code : code()); if (v === null) return;
            if (!/^[A-Za-z0-9-]{4,20}$/.test(v.trim())) return toast('Use 4-20 letters, numbers or dashes', true);
            if (c) await DB.update('event_checkins', id, { code: v.trim().toUpperCase(), closes_at: null }, 'event_id');
            else await DB.insert('event_checkins', { event_id: id, code: v.trim().toUpperCase() });
            break;
          }
          case 'close': await DB.update('event_checkins', id, { closes_at: new Date().toISOString() }, 'event_id'); break;
          case 'reopen': await DB.update('event_checkins', id, { closes_at: null }, 'event_id'); break;
          case 'list': openEvent = openEvent === id ? null : id; break;
          case 'mark': {
            const email = prompt("The member's email address (the one they sign in with):"); if (!email) return;
            const name = prompt('Name on the certificate:'); if (!name) return;
            if (LIVE) { const { error } = await C.sb.rpc('founder_mark_attendance', { p_event: id, p_email: email, p_name: name }); if (error) throw error; }
            else await DB.insert('attendance', { event_id: id, user_id: email.trim().toLowerCase(), name_on_certificate: name, method: 'founder', certificate_no: 'ROAR-' + new Date().getFullYear() + '-' + Math.random().toString(16).slice(2, 10).toUpperCase() });
            break;
          }
          case 'csv': return csv(`roar-attendance-${(e.title || 'session').replace(/\W+/g, '-').slice(0, 40)}.csv`, [['Name', 'Certificate', 'How', 'Date'], ...att.filter(a => a.event_id === id).map(a => [a.name_on_certificate, a.certificate_no, a.method, a.created_at])]);
        }
        toast('Saved'); cme();
      } catch (err) { fail(err); }
    }));
  }

  // ---------------------------------------------------------------- Research projects
  async function research() {
    setHeader('Programmes', 'Research projects', [{ label: 'New project', primary: true, onClick: () => edit() }]);
    view().innerHTML = '<div class="panel glass empty">Loading…</div>';
    const [ps, interest] = await Promise.all([DB.list('research_projects', ['created_at', false]), DB.list('research_interest', ['created_at', false])]);
    view().innerHTML = `
      <p class="lead" style="margin-top:-6px">Projects of the Research Collective. Published projects appear on the public Research page, where members can express interest.</p>
      <div class="panel glass">${ps.length ? ps.map(p => {
        const iv = interest.filter(i => i.project_id === p.id);
        return `<div class="mod-item" data-id="${esc(p.id)}">
          <div class="meta-row">${pill(p.status)}${p.published ? pill('published') : pill('draft')}${p.area ? `<span class="tag tag-quiet">${esc(p.area)}</span>` : ''}</div>
          <h3 style="margin:8px 0 2px">${esc(p.title)}</h3><div class="mod-quote">${esc(p.summary)}</div>
          <div class="muted" style="font-size:.86rem">${p.lead ? 'Lead: ' + esc(p.lead) + ' · ' : ''}${iv.length} interested</div>
          ${iv.length ? `<details style="margin-top:8px"><summary style="cursor:pointer">People interested</summary>${iv.map(i => `<div class="att-row"><span>${esc(i.name)}</span><span>${esc(i.institution || '')}</span><span class="muted">${esc(i.role || '')}${i.message ? ' · ' + esc(i.message) : ''}</span></div>`).join('')}</details>` : ''}
          <div class="mod-actions"><button class="btn btn-glass small" data-do="edit">Edit</button><button class="btn btn-glass small" data-do="pub">${p.published ? 'Unpublish' : 'Publish'}</button><button class="btn btn-glass small" data-do="del">Delete</button></div>
        </div>`;
      }).join('') : '<p class="muted" style="margin:0">No projects yet. Add the first one with "New project".</p>'}</div>`;
    view().querySelectorAll('.mod-item [data-do]').forEach(b => b.addEventListener('click', async () => {
      const id = b.closest('.mod-item').dataset.id, p = ps.find(x => x.id === id);
      try {
        if (b.dataset.do === 'edit') return edit(p);
        if (b.dataset.do === 'pub') await DB.update('research_projects', id, { published: !p.published });
        if (b.dataset.do === 'del') { if (!confirm('Delete this project and the list of people interested?')) return; await DB.remove('research_projects', id); }
        toast('Saved'); research();
      } catch (e) { fail(e); }
    }));
  }
  function edit(p) {
    C.openEditor({
      title: p ? 'Edit project' : 'New research project', values: p || { status: 'recruiting' },
      fields: [{ key: 'title', label: 'Title', required: true, full: true }, { key: 'summary', label: 'Summary', type: 'textarea', required: true, full: true },
        { key: 'area', label: 'Area (e.g. Head & Neck)' }, { key: 'lead', label: 'Project lead' },
        { key: 'status', label: 'Status', type: 'select', options: ['proposed', 'recruiting', 'ongoing', 'completed', 'published'] },
        { key: 'sites_wanted', label: 'Sites wanted', type: 'number' }, { key: 'link_url', label: 'Link to protocol (optional)', full: true },
        { key: 'published', label: 'Show on the public Research page', type: 'checkbox' }],
      onSave: async v => {
        const row = { title: v.title, summary: v.summary, area: v.area || null, lead: v.lead || null, status: v.status || 'recruiting', sites_wanted: v.sites_wanted ? +v.sites_wanted : null, link_url: v.link_url || null, published: !!v.published };
        if (row.link_url && !/^https?:\/\//i.test(row.link_url)) throw new Error('Links start with http:// or https://');
        if (p) await DB.update('research_projects', p.id, row); else await DB.insert('research_projects', row);
        research();
      },
    });
  }

  // ---------------------------------------------------------------- Email outbox
  async function outbox() {
    setHeader('Programmes', 'Email outbox');
    view().innerHTML = '<div class="panel glass empty">Loading…</div>';
    const rows = await DB.list('email_outbox', ['created_at', false]).catch(() => []);
    const waiting = rows.filter(r => !r.sent_at);
    view().innerHTML = `
      <p class="lead" style="margin-top:-6px">Job alerts and mentorship emails are queued here. They are sent once ROAR connects an email service (see SETUP.md, "Email notifications"). Until then they wait safely.</p>
      <div class="grid k4" style="margin-bottom:20px">
        <div class="kpi glass"><div class="n">${waiting.length}</div><div class="l">Waiting to send</div></div>
        <div class="kpi glass"><div class="n">${rows.filter(r => r.sent_at).length}</div><div class="l">Sent</div></div>
        <div class="kpi glass"><div class="n">${rows.filter(r => r.error).length}</div><div class="l">Failed</div></div>
        <div class="kpi glass"><div class="n">${new Set(rows.map(r => r.to_email)).size}</div><div class="l">People</div></div>
      </div>
      <div class="panel glass">${rows.length ? rows.slice(0, 100).map(r => `<div class="att-row"><span>${pill(r.sent_at ? 'sent' : r.error ? 'failed' : 'waiting')}</span><span><b>${esc(r.subject)}</b><br><span class="muted">${esc(r.kind)} · ${fmtDate(r.created_at)}</span></span><span class="muted">${esc(String(r.to_email).replace(/^(.).*(@.*)$/, '$1…$2'))}</span></div>`).join('') : '<p class="muted" style="margin:0">Nothing queued yet.</p>'}</div>`;
  }

  C.register('mentors', () => mentors().catch(fail));
  C.register('cme', () => cme().catch(fail));
  C.register('research', () => research().catch(fail));
  C.register('outbox', () => outbox().catch(fail));
})();
