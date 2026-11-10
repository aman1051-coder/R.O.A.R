// Founders' console: Surveys & polls.
// Only the Founders' Council can use this (the console is founders-only, and the database rules
// in schema PART 9 allow only founders to create, edit, open, close or delete surveys and read responses).
//   #/surveys                     dashboard
//   #/surveys/edit/<slug>         survey builder
//   #/surveys/results/<slug>      responses
(() => {
  'use strict';
  const C = window.ROAR_COUNCIL;
  const E = window.ROAR_SURVEY_ENGINE;
  const TEMPLATE = window.ROAR_SURVEY;
  if (!C || !E) return;
  const { DB, esc, toast, fail, fmtDate, openEditor, setHeader } = C;
  const $ = s => document.querySelector(s);
  const MIN_GROUP = 5;

  const TYPES = [['single', 'One choice'], ['multi', 'Several choices'], ['scale', 'Scale (one row of choices)'], ['matrix', 'Grid (rows × columns)'],
    ['nps', '0–10 rating'], ['select', 'Dropdown'], ['text', 'Written answer']];
  const typeLabel = t => (TYPES.find(x => x[0] === t) || [t, t])[1];
  const surveyUrl = (slug, extra) => new URL(`../survey/?s=${encodeURIComponent(slug)}${extra || ''}`, location.href).href;
  const clone = o => JSON.parse(JSON.stringify(o));
  const linesToOptions = txt => String(txt || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.includes(' | ') ? l.split(' | ').map(x => x.trim()) : l);
  const optionsToLines = opts => (opts || []).map(o => Array.isArray(o) ? `${o[0]} | ${o[1]}` : o).join('\n');
  const uniqueId = (base, taken) => { let id = E.slugify(base).replace(/-/g, '_').slice(0, 30) || 'q'; let n = 2, out = id; while (taken.includes(out)) out = `${id}_${n++}`; return out; };

  const blankDefinition = () => ({ minutes: 10, sections: [{ id: 'about', title: 'About you', intro: 'We don\'t ask for your name or institution.', questions: [clone(E.ROLE_QUESTION)] }] });
  const pollDefinition = (question, options, multi, max) => ({ minutes: 1, sections: [{ id: 'poll', title: question, questions: [{ id: 'answer', type: multi ? 'multi' : 'single', label: question, options, required: true, ...(multi && max ? { max: +max } : {}) }] }] });

  async function loadAll() {
    const [surveys, responses] = await Promise.all([DB.list('surveys', ['created_at', false]), DB.list('survey_responses')]);
    const counts = {};
    responses.forEach(r => { counts[r.survey_id] = (counts[r.survey_id] || 0) + 1; });
    return { surveys, responses, counts };
  }
  const findBySlug = async slug => (await DB.list('surveys')).find(s => s.slug === slug);

  // =====================================================================
  // Dashboard
  // =====================================================================
  async function dashboard() {
    const { surveys, counts, responses } = await loadAll();
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const open = surveys.filter(s => s.status === 'open');
    setHeader("Founders' Council only", 'Surveys & polls', [
      { label: 'New poll', onClick: newPoll },
      { label: 'New survey', primary: true, onClick: () => newSurvey(surveys) },
    ]);

    const card = s => {
      const n = counts[s.slug] || 0;
      const isPoll = s.kind === 'poll';
      return `<article class="sv-card glass" data-id="${esc(s.id)}">
        <div class="sv-card-head">
          <div class="meta-row"><span class="tag">${isPoll ? 'Poll' : 'Survey'}</span><span class="tag tag-quiet">${s.audience === 'members' ? 'Members only' : 'Everyone'}</span>
            <span class="pill ${s.status === 'open' ? 'open' : s.status === 'closed' ? 'closed' : 'draft'}">${s.status}</span></div>
          <h3>${esc(s.title)}</h3>
          <div class="sv-meta">${n} response${n === 1 ? '' : 's'} · version ${esc(s.version)} · updated ${fmtDate(s.updated_at || s.created_at)}</div>
        </div>
        <div class="sv-actions">
          <button class="btn btn-glass small" data-act="results">Responses</button>
          <button class="btn btn-glass small" data-act="edit">${isPoll ? 'Edit poll' : 'Edit questions'}</button>
          ${s.status === 'open' ? '<button class="btn btn-glass small" data-act="close">Close</button>' : `<button class="btn btn-primary small" data-act="open">${s.status === 'closed' ? 'Reopen' : 'Open'}</button>`}
          <button class="btn btn-glass small" data-act="link">Copy link</button>
          <button class="btn btn-glass small" data-act="preview">Preview ↗</button>
          <button class="btn btn-glass small" data-act="copy">Duplicate</button>
          <button class="btn btn-glass small danger" data-act="delete">Delete</button>
        </div>
      </article>`;
    };

    const polls = surveys.filter(s => s.kind === 'poll'), full = surveys.filter(s => s.kind !== 'poll');
    $('#view').innerHTML = `
      <div class="grid k4">
        <div class="kpi glass"><div class="n">${full.length}</div><div class="l">Surveys</div><div class="sub">${full.filter(s => s.status === 'draft').length} in draft</div></div>
        <div class="kpi glass"><div class="n">${polls.length}</div><div class="l">Polls</div><div class="sub">${polls.filter(s => s.status === 'open').length} open</div></div>
        <div class="kpi glass"><div class="n">${open.length}</div><div class="l">Open now</div><div class="sub">${open.filter(s => s.audience === 'members').length} members only</div></div>
        <div class="kpi glass"><div class="n">${responses.length}</div><div class="l">Responses</div><div class="sub">${responses.filter(r => (r.submitted_on || '') >= weekAgo).length} in the last 7 days</div></div>
      </div>
      ${!surveys.some(s => s.slug === TEMPLATE.id) ? `<div class="panel glass" style="margin-top:18px"><h2>The national survey draft</h2>
        <p style="margin:0 0 12px">ROAR's first national survey (10 sections, about 70 questions) is ready as a draft. Add it here to edit, open and track it like any other survey.</p>
        <button class="btn btn-primary small" id="add-national">Add the national survey draft</button></div>` : ''}
      <h2 class="sv-h">Surveys</h2>
      ${full.length ? `<div class="sv-grid">${full.map(card).join('')}</div>` : '<div class="panel glass empty">No surveys yet. Create one, or add the national survey draft.</div>'}
      <h2 class="sv-h">Polls</h2>
      ${polls.length ? `<div class="sv-grid">${polls.map(card).join('')}</div>` : '<div class="panel glass empty">No polls yet. A poll is one quick question, for everyone or for members.</div>'}
      <p class="note">Surveys for <b>everyone</b> can be answered by anyone with the link. Surveys for <b>members</b> need a member-portal account; answers stay anonymous either way. Never report results for groups of fewer than ${MIN_GROUP}.</p>`;

    const nat = $('#add-national');
    if (nat) nat.addEventListener('click', async () => {
      try { await createFrom({ title: TEMPLATE.title, slug: TEMPLATE.id, intro: TEMPLATE.intro, audience: 'everyone', kind: 'survey', version: TEMPLATE.version, definition: templateDefinition() }); toast('National survey added as a draft'); C.route(); } catch (e) { fail(e); }
    });

    $('#view').querySelectorAll('.sv-card').forEach(el => {
      const s = surveys.find(x => x.id === el.dataset.id);
      el.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act;
        try {
          if (act === 'results') location.hash = `#/surveys/results/${encodeURIComponent(s.slug)}`;
          else if (act === 'edit') s.kind === 'poll' ? editPoll(s) : (location.hash = `#/surveys/edit/${encodeURIComponent(s.slug)}`);
          else if (act === 'open') {
            if (!confirm(`Open "${s.title}" to ${s.audience === 'members' ? 'signed-in members' : 'everyone with the link'}?`)) return;
            await DB.update('surveys', s.id, { status: 'open', updated_at: new Date().toISOString() }); toast('Open. Copy the link to share it.'); C.route();
          } else if (act === 'close') {
            if (!confirm(`Close "${s.title}"? No more responses will be accepted.`)) return;
            await DB.update('surveys', s.id, { status: 'closed', updated_at: new Date().toISOString() }); C.route();
          } else if (act === 'link') {
            const url = surveyUrl(s.slug);
            try { await navigator.clipboard.writeText(url); toast('Link copied: ' + url); } catch (err) { prompt('Copy this link', url); }
          } else if (act === 'preview') window.open(surveyUrl(s.slug, '&preview=1'), '_blank');
          else if (act === 'copy') {
            const slug = await freeSlug(s.slug + '-copy');
            await createFrom({ ...s, title: s.title + ' (copy)', slug, status: 'draft', definition: clone(s.definition) });
            toast('Duplicated as a draft'); C.route();
          } else if (act === 'delete') {
            if (!confirm(`Delete "${s.title}"? Its ${counts[s.slug] || 0} responses are kept, but the survey can no longer be answered or edited.`)) return;
            await DB.remove('surveys', s.id); toast('Deleted'); C.route();
          }
        } catch (err) { fail(err); }
      });
    });
  }

  function templateDefinition() {
    const d = clone(TEMPLATE);
    return { minutes: d.minutes, helpline: d.helpline, sections: d.sections };
  }
  async function freeSlug(base) {
    const taken = (await DB.list('surveys')).map(s => s.slug);
    let slug = E.slugify(base) || 'survey', n = 2, out = slug;
    while (taken.includes(out) || out.length < 3) out = `${slug}-${n++}`;
    return out;
  }
  async function createFrom(row) {
    const now = new Date().toISOString();
    return DB.insert('surveys', {
      slug: row.slug, kind: row.kind || 'survey', title: row.title, intro: row.intro || null, version: row.version || '0.1',
      definition: row.definition, status: row.status || 'draft', audience: row.audience || 'everyone', show_results: !!row.show_results,
      created_by: C.me.email, updated_at: now,
    });
  }

  function newSurvey(surveys) {
    openEditor({
      title: 'New survey',
      fields: [
        { key: 'title', label: 'Title', required: true, full: true, hint: 'e.g. "Stipend and pay survey 2027"' },
        { key: 'slug', label: 'Link name (optional)', full: true, hint: 'Used in the link: /survey/?s=link-name. Letters, numbers and dashes. Leave empty to make one from the title.' },
        { key: 'audience', label: 'Who can answer', type: 'select', options: [['everyone', 'Everyone with the link'], ['members', 'Members only (signed in)']] },
        { key: 'start', label: 'Start from', type: 'select', options: [['blank', 'A blank survey (with the standard role question)'], ['national', 'A copy of the national survey'], ...surveys.filter(s => s.kind !== 'poll').map(s => [s.slug, 'A copy of: ' + s.title])] },
        { key: 'intro', label: 'Introduction shown before the questions', type: 'textarea', rows: 3 },
      ],
      values: { audience: 'everyone', start: 'blank' },
      onSave: async v => {
        const slug = await freeSlug(v.slug || v.title);
        let definition = blankDefinition();
        if (v.start === 'national') definition = templateDefinition();
        else if (v.start !== 'blank') { const src = surveys.find(s => s.slug === v.start); if (src) definition = clone(src.definition); }
        await createFrom({ title: v.title, slug, audience: v.audience, intro: v.intro, definition });
        setTimeout(() => { location.hash = `#/surveys/edit/${encodeURIComponent(slug)}`; }, 50);
      },
    });
  }

  function pollFields(isNew) {
    return [
      { key: 'title', label: 'Question', required: true, full: true, hint: 'e.g. "Which day suits you best for Contour Club?"' },
      { key: 'options', label: 'Choices (one per line)', type: 'textarea', required: true, rows: 5 },
      { key: 'multi', label: 'Let people choose more than one', type: 'checkbox' },
      { key: 'max', label: 'Most choices allowed (optional)', type: 'number' },
      { key: 'audience', label: 'Who can answer', type: 'select', options: [['everyone', 'Everyone with the link'], ['members', 'Members only (signed in)']] },
      { key: 'show_results', label: 'Show the totals to people after they answer', type: 'checkbox' },
      { key: 'intro', label: 'Short note under the question (optional)', type: 'textarea', rows: 2 },
      ...(isNew ? [{ key: 'open_now', label: 'Open it straight away', type: 'checkbox' }] : []),
    ];
  }
  function newPoll() {
    openEditor({
      title: 'New poll', fields: pollFields(true), values: { audience: 'everyone', show_results: true, open_now: false },
      onSave: async v => {
        const options = linesToOptions(v.options);
        if (options.length < 2) throw new Error('Give at least two choices.');
        const slug = await freeSlug('poll-' + v.title);
        await createFrom({ kind: 'poll', title: v.title, slug, intro: v.intro, audience: v.audience, show_results: v.show_results, status: v.open_now ? 'open' : 'draft', definition: pollDefinition(v.title, options, v.multi, v.max) });
      },
    });
  }
  function editPoll(s) {
    const q = s.definition.sections[0].questions[0];
    openEditor({
      title: 'Edit poll', fields: pollFields(false),
      values: { title: s.title, options: optionsToLines(q.options), multi: q.type === 'multi', max: q.max || '', audience: s.audience, show_results: s.show_results, intro: s.intro },
      onSave: async v => {
        const options = linesToOptions(v.options);
        if (options.length < 2) throw new Error('Give at least two choices.');
        await DB.update('surveys', s.id, { title: v.title, intro: v.intro, audience: v.audience, show_results: v.show_results, definition: pollDefinition(v.title, options, v.multi, v.max), updated_at: new Date().toISOString() });
      },
    });
  }

  // =====================================================================
  // Builder
  // =====================================================================
  async function builder(slug) {
    const s = await findBySlug(slug);
    if (!s) { $('#view').innerHTML = '<div class="panel glass empty">That survey was not found.</div>'; return; }
    if (s.kind === 'poll') { location.hash = '#/surveys'; editPoll(s); return; }
    const def = clone(s.definition || { sections: [] });
    def.sections = def.sections || [];
    const nResponses = (await DB.list('survey_responses')).filter(r => r.survey_id === s.slug).length;
    const save = async (msg) => {
      await DB.update('surveys', s.id, { definition: def, updated_at: new Date().toISOString() });
      s.definition = clone(def);
      if (msg) toast(msg);
      draw();
    };

    setHeader('Survey builder · Founders\' Council only', s.title, [
      { label: '← All surveys', onClick: () => { location.hash = '#/surveys'; } },
      { label: 'Survey settings', onClick: () => settings(s) },
      { label: 'Review copy ↗', onClick: () => window.open(surveyUrl(s.slug, '&review=1'), '_blank') },
      { label: 'Preview ↗', primary: true, onClick: () => window.open(surveyUrl(s.slug, '&preview=1'), '_blank') },
    ]);

    const qLine = (q, si, qi) => `<li class="bq">
      <div class="bq-main"><span class="bq-num">${si + 1}.${qi + 1}</span><div><b>${esc(q.label)}</b>
        <div class="bq-meta">${esc(typeLabel(q.type))}${q.required ? ' · required' : ''}${q.when ? ' · ' + esc(E.describe(q.when, def)) : ''}${q.options ? ` · ${q.options.length} choices` : ''}${q.rows ? ` · ${q.rows.length} rows` : ''}</div></div></div>
      <div class="bq-tools">
        <button class="icon-btn" data-q="edit" data-s="${si}" data-i="${qi}" title="Edit">Edit</button>
        <button class="icon-btn" data-q="up" data-s="${si}" data-i="${qi}" title="Move up" aria-label="Move up">↑</button>
        <button class="icon-btn" data-q="down" data-s="${si}" data-i="${qi}" title="Move down" aria-label="Move down">↓</button>
        <button class="icon-btn danger" data-q="del" data-s="${si}" data-i="${qi}" title="Delete" aria-label="Delete">✕</button>
      </div></li>`;

    function draw() {
      $('#view').innerHTML = `
        <div class="panel glass sv-settings-line">
          <div><span class="tag">${s.audience === 'members' ? 'Members only' : 'Everyone'}</span> <span class="pill ${s.status === 'open' ? 'open' : s.status === 'closed' ? 'closed' : 'draft'}">${s.status}</span>
            <span class="muted" style="margin-left:8px">Link: <code>${esc(surveyUrl(s.slug))}</code> · version ${esc(s.version)}</span></div>
        </div>
        ${nResponses ? `<div class="notice warn">This survey already has ${nResponses} response${nResponses === 1 ? '' : 's'}. Changing questions now makes answers harder to compare: raise the version in Survey settings when you do.</div>` : ''}
        ${!E.hasRoleQuestion(def) ? '<div class="notice">This survey has no "role" question, so "Shown to" rules by role won\'t apply. Add the standard role question to section 1 to use them.</div>' : ''}
        ${def.sections.map((sec, si) => `<div class="panel glass bsec">
          <div class="bsec-head">
            <div><span class="crumb">Section ${si + 1}${sec.when ? ' · ' + esc(E.describe(sec.when, def)) : ' · Everyone'}</span><h2>${esc(sec.title)}</h2>${sec.intro ? `<p class="muted" style="margin:0">${esc(sec.intro)}</p>` : ''}</div>
            <div class="bq-tools">
              <button class="icon-btn" data-sec="edit" data-s="${si}">Edit</button>
              <button class="icon-btn" data-sec="up" data-s="${si}" aria-label="Move section up">↑</button>
              <button class="icon-btn" data-sec="down" data-s="${si}" aria-label="Move section down">↓</button>
              <button class="icon-btn danger" data-sec="del" data-s="${si}" aria-label="Delete section">✕</button>
            </div>
          </div>
          <ol class="bq-list">${(sec.questions || []).map((q, qi) => qLine(q, si, qi)).join('') || '<li class="muted" style="padding:8px 0">No questions yet.</li>'}</ol>
          <button class="btn btn-glass small" data-q="add" data-s="${si}">+ Add question</button>
        </div>`).join('')}
        <button class="btn btn-primary" id="add-section">+ Add section</button>`;

      $('#add-section').addEventListener('click', () => sectionEditor(null));
      $('#view').querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', async () => {
        const si = +b.dataset.s, act = b.dataset.sec;
        try {
          if (act === 'edit') return sectionEditor(si);
          if (act === 'del') { if (!confirm(`Delete section "${def.sections[si].title}" and its ${def.sections[si].questions.length} questions?`)) return; def.sections.splice(si, 1); }
          if (act === 'up' && si > 0) [def.sections[si - 1], def.sections[si]] = [def.sections[si], def.sections[si - 1]];
          if (act === 'down' && si < def.sections.length - 1) [def.sections[si + 1], def.sections[si]] = [def.sections[si], def.sections[si + 1]];
          await save();
        } catch (e) { fail(e); }
      }));
      $('#view').querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', async () => {
        const si = +b.dataset.s, qi = +b.dataset.i, act = b.dataset.q, list = def.sections[si].questions;
        try {
          if (act === 'add') return questionEditor(si, null);
          if (act === 'edit') return questionEditor(si, qi);
          if (act === 'del') { if (!confirm(`Delete the question "${list[qi].label}"?`)) return; list.splice(qi, 1); }
          if (act === 'up' && qi > 0) [list[qi - 1], list[qi]] = [list[qi], list[qi - 1]];
          if (act === 'down' && qi < list.length - 1) [list[qi + 1], list[qi]] = [list[qi], list[qi + 1]];
          await save();
        } catch (e) { fail(e); }
      }));
    }

    const audienceField = (label) => ({ key: 'aud', label, type: 'select', options: E.AUDIENCES.map(([k, l]) => [k, l]), hint: 'Needs the standard "role" question in section 1.' });

    function sectionEditor(si) {
      const sec = si === null ? { title: '', intro: '', questions: [] } : def.sections[si];
      openEditor({
        title: si === null ? 'Add section' : 'Edit section',
        fields: [{ key: 'title', label: 'Section title', required: true, full: true }, { key: 'intro', label: 'Short introduction (optional)', type: 'textarea', rows: 2 }, audienceField('Who sees this section')],
        values: { title: sec.title, intro: sec.intro, aud: E.audienceKey(sec.when) === 'custom' ? '' : E.audienceKey(sec.when) },
        onSave: async v => {
          const roles = E.rolesFor(v.aud);
          const next = { ...sec, title: v.title, intro: v.intro || '', when: roles ? { roles } : undefined };
          if (!next.when) delete next.when;
          if (si === null) { next.id = uniqueId(v.title, def.sections.map(x => x.id)); next.questions = []; def.sections.push(next); }
          else def.sections[si] = next;
          await DB.update('surveys', s.id, { definition: def, updated_at: new Date().toISOString() });
          s.definition = clone(def);
          setTimeout(draw, 30);
        },
      });
    }

    function questionEditor(si, qi) {
      const q = qi === null ? { type: 'single', label: '', options: [] } : def.sections[si].questions[qi];
      const earlier = def.sections.slice(0, si + 1).flatMap((sec, i) => (sec.questions || []).filter((x, j) => i < si || j < (qi === null ? Infinity : qi)).map(x => [x.id, `${x.label.slice(0, 50)}${x.label.length > 50 ? '…' : ''}`]));
      const w = q.when || {};
      const op = 'eq' in w ? 'eq' : 'ne' in w ? 'ne' : 'anyNot' in w ? 'anyNot' : 'includes' in w ? 'includes' : 'eq';
      openEditor({
        title: qi === null ? `Add a question to "${def.sections[si].title}"` : 'Edit question',
        fields: [
          { key: 'label', label: 'Question', required: true, full: true },
          { key: 'type', label: 'Answer type', type: 'select', options: TYPES },
          { key: 'required', label: 'People must answer it', type: 'checkbox' },
          { key: 'options', label: 'Choices, one per line (one choice, several choices, dropdown, scale)', type: 'textarea', rows: 6, hint: 'For a stored code different from the label, write "code | Label".' },
          { key: 'rows', label: 'Grid rows, one per line (grid only)', type: 'textarea', rows: 4 },
          { key: 'cols', label: 'Grid columns, one per line (grid only)', type: 'textarea', rows: 3 },
          { key: 'max', label: 'Most choices allowed (several choices only)', type: 'number' },
          { key: 'help', label: 'Help text under the question (optional)', full: true },
          audienceField('Who sees this question'),
          { key: 'cond_q', label: 'Show only if this earlier question…', type: 'select', options: [['', '— no condition —'], ...earlier] },
          { key: 'cond_op', label: '…', type: 'select', options: [['eq', 'is'], ['ne', 'is answered and is not'], ['anyNot', 'has any grid row that is not'], ['includes', 'includes']] },
          { key: 'cond_val', label: '…this answer', full: true },
        ],
        values: {
          label: q.label, type: q.type, required: !!q.required, help: q.help || '', max: q.max || '',
          options: q.type === 'scale' ? (q.scale || []).join('\n') : optionsToLines(q.options),
          rows: (q.rows || []).join('\n'), cols: (q.cols || []).join('\n'),
          aud: E.audienceKey(w.roles ? { roles: w.roles } : null) === 'custom' ? '' : E.audienceKey(w.roles ? { roles: w.roles } : null),
          cond_q: w.q || '', cond_op: op, cond_val: w.q ? String(w[op] ?? '') : '',
        },
        onSave: async v => {
          const taken = E.allQuestions(def).map(x => x.id).filter(id => id !== q.id);
          const next = { id: q.id || uniqueId(v.label, taken), type: v.type, label: v.label };
          if (v.required) next.required = true;
          if (v.help) next.help = v.help;
          const lines = linesToOptions(v.options);
          if (['single', 'multi', 'select'].includes(v.type)) { if (lines.length < 2) throw new Error('Give at least two choices.'); next.options = lines; }
          if (v.type === 'scale') { const pts = lines.map(o => Array.isArray(o) ? o[1] : o); if (pts.length < 2) throw new Error('Give at least two scale points.'); next.scale = pts; }
          if (v.type === 'matrix') {
            next.rows = String(v.rows || '').split('\n').map(x => x.trim()).filter(Boolean);
            next.cols = String(v.cols || '').split('\n').map(x => x.trim()).filter(Boolean);
            if (next.rows.length < 1 || next.cols.length < 2) throw new Error('A grid needs at least one row and two columns.');
          }
          if (v.type === 'multi' && +v.max) next.max = +v.max;
          if (v.type === 'nps') { next.low = q.low || 'Not at all likely'; next.high = q.high || 'Extremely likely'; }
          const roles = E.rolesFor(v.aud);
          const when = {};
          if (roles) when.roles = roles;
          if (v.cond_q) {
            if (v.cond_q === next.id) throw new Error('A question can\'t depend on itself.');
            if (!v.cond_val) throw new Error('Type the answer the condition checks for.');
            when.q = v.cond_q; when[v.cond_op] = v.cond_val;
          }
          if (Object.keys(when).length) next.when = when;
          const list = def.sections[si].questions;
          if (qi === null) list.push(next); else list[qi] = next;
          await DB.update('surveys', s.id, { definition: def, updated_at: new Date().toISOString() });
          s.definition = clone(def);
          setTimeout(draw, 30);
        },
      });
    }

    draw();
  }

  function settings(s) {
    openEditor({
      title: 'Survey settings',
      fields: [
        { key: 'title', label: 'Title', required: true, full: true },
        { key: 'intro', label: 'Introduction', type: 'textarea', rows: 4 },
        { key: 'audience', label: 'Who can answer', type: 'select', options: [['everyone', 'Everyone with the link'], ['members', 'Members only (signed in)']] },
        { key: 'version', label: 'Version', hint: 'Raise it (for example 1.0 → 1.1) when you change questions after launch.' },
        { key: 'minutes', label: 'About how many minutes it takes', type: 'number' },
      ],
      values: { title: s.title, intro: s.intro, audience: s.audience, version: s.version, minutes: (s.definition && s.definition.minutes) || 10 },
      onSave: async v => {
        const def = { ...(s.definition || {}), minutes: +v.minutes || 10 };
        await DB.update('surveys', s.id, { title: v.title, intro: v.intro, audience: v.audience, version: v.version || s.version, definition: def, updated_at: new Date().toISOString() });
      },
    });
  }

  // =====================================================================
  // Responses
  // =====================================================================
  const STATE = { group: 'all' };
  async function results(slug) {
    const s = await findBySlug(slug);
    const S = s ? { ...(s.definition || {}), title: s.title, id: s.slug } : null;
    if (!S) { $('#view').innerHTML = '<div class="panel glass empty">That survey was not found.</div>'; return; }
    const all = (await DB.list('survey_responses', ['submitted_on', false])).filter(r => r.survey_id === s.slug);
    const useGroups = E.hasRoleQuestion(S);
    const GROUPS = { all: ['All respondents', () => true], res: ['Residents', a => E.RESIDENT.includes(a.role)], post: ['Up to 6 years after PG', a => E.POSTPG.includes(a.role)], senior: ['Senior ROs', a => a.role === 'senior'] };
    if (!useGroups) STATE.group = 'all';
    const resp = all.filter(r => GROUPS[STATE.group][1](r.answers || {}));

    const sample = () => {
      const pick = a => a[Math.floor(Math.random() * a.length)];
      const val = o => Array.isArray(o) ? o[0] : o;
      const roles = ['pg1', 'pg1', 'pg2', 'pg2', 'pg3', 'pg3', 'sr', 'sr', 'fellow', 'consultant', 'senior'];
      for (let n = 0; n < 40; n++) {
        const a = useGroups ? { role: pick(roles) } : {};
        S.sections.forEach(sec => {
          if (!E.cond(sec.when, a)) return;
          sec.questions.forEach(q => {
            if (q.id === 'role' || !E.cond(q.when, a) || (!q.required && Math.random() < .08)) return;
            if (q.type === 'single' || q.type === 'select') a[q.id] = val(pick(q.options));
            else if (q.type === 'scale') a[q.id] = pick(q.scale);
            else if (q.type === 'nps') a[q.id] = Math.floor(Math.random() * 11);
            else if (q.type === 'multi') { const k = 1 + Math.floor(Math.random() * Math.min(q.max || 3, q.options.length)); a[q.id] = [...q.options].sort(() => Math.random() - .5).slice(0, k).map(val); }
            else if (q.type === 'matrix') { a[q.id] = {}; q.rows.forEach(r => { a[q.id][r] = pick(q.cols); }); }
            else if (q.type === 'text' && Math.random() < .3) a[q.id] = 'SAMPLE: ' + pick(['More hands-on brachytherapy.', 'Structured contouring teaching.', 'On-time stipends.', 'Protected study time.']);
          });
        });
        C.Demo.s.survey_responses = C.Demo.s.survey_responses || [];
        C.Demo.s.survey_responses.push({ id: 'sample-' + Date.now() + '-' + n, survey_id: s.slug, version: s.version, submitted_on: new Date(Date.now() - Math.random() * 14 * 864e5).toISOString().slice(0, 10), answers: a });
      }
      C.Demo.save(); toast('Added 40 sample responses'); C.route();
    };

    const exportCSV = () => {
      const cols = ['submitted_on', 'version'];
      S.sections.forEach(sec => sec.questions.forEach(q => { if (q.type === 'matrix') q.rows.forEach(r => cols.push(`${q.id}[${r}]`)); else cols.push(q.id); }));
      const get = (r, c) => {
        if (c === 'submitted_on' || c === 'version') return r[c];
        const m = c.match(/^(.+)\[(.+)\]$/);
        const v = m ? (r.answers[m[1]] || {})[m[2]] : r.answers[c];
        return Array.isArray(v) ? v.join('; ') : v;
      };
      const cell = v => { let x = String(v ?? ''); if (/^[=+\-@]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
      const csv = [cols.map(cell).join(','), ...resp.map(r => cols.map(c => cell(get(r, c))).join(','))].join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
      a.download = `roar-${s.slug}-${STATE.group}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const clearAll = async () => {
      if (!confirm(`Delete all ${all.length} responses to "${s.title}"? Use this only for test answers before launch. This can't be undone.`)) return;
      try {
        if (C.LIVE) { const { error } = await C.sb.from('survey_responses').delete().eq('survey_id', s.slug); if (error) throw error; }
        else { C.Demo.s.survey_responses = (C.Demo.s.survey_responses || []).filter(r => r.survey_id !== s.slug); C.Demo.save(); }
        toast('Responses deleted'); C.route();
      } catch (e) { fail(e); }
    };

    setHeader(`${s.kind === 'poll' ? 'Poll' : 'Survey'} responses · Founders' Council only`, s.title, [
      { label: '← All surveys', onClick: () => { location.hash = '#/surveys'; } },
      ...(C.LIVE ? [] : [{ label: 'Add 40 sample responses', onClick: sample }]),
      ...(all.length ? [{ label: 'Delete all responses', onClick: clearAll }] : []),
      { label: 'Export CSV', primary: true, onClick: exportCSV },
    ]);

    const bar = (label, n, total) => {
      const pct = total ? Math.round(n / total * 100) : 0;
      return `<div class="res-bar"><span class="rb-label">${esc(label)}</span><span class="rb-track"><i style="width:${pct}%"></i></span><span class="rb-n">${n} <em>${pct}%</em></span></div>`;
    };
    const summary = q => {
      const vals = resp.map(r => r.answers[q.id]).filter(v => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length));
      const n = vals.length;
      if (!n) return '<p class="muted" style="margin:0">No answers yet.</p>';
      if (q.type === 'single' || q.type === 'select' || q.type === 'scale') {
        const options = q.scale || (q.options || []).map(o => Array.isArray(o) ? o : [o, o]);
        return options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return bar(l, vals.filter(x => x === v).length, n); }).join('');
      }
      if (q.type === 'multi') return (q.options || []).map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return bar(l, vals.filter(x => x.includes(v)).length, n); }).join('') + '<p class="hint">Percent of people who answered; they could choose more than one.</p>';
      if (q.type === 'nps') {
        const pro = vals.filter(v => v >= 9).length, det = vals.filter(v => v <= 6).length;
        return `<div class="nps-score"><b>${Math.round((pro - det) / n * 100)}</b><span>Net score (−100 to +100): ${pro} would recommend (9–10), ${det} would not (0–6)</span></div>` +
          Array.from({ length: 11 }, (_, i) => bar(String(i), vals.filter(v => +v === i).length, n)).join('');
      }
      if (q.type === 'matrix') {
        return `<div class="table-wrap"><table class="data mx"><thead><tr><th></th>${q.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
          ${q.rows.map(r => { const rv = vals.map(v => v[r]).filter(Boolean); return `<tr><td class="strong">${esc(r)}</td>${q.cols.map(c => { const k = rv.filter(x => x === c).length; const p = rv.length ? Math.round(k / rv.length * 100) : 0; return `<td style="background:rgba(240,138,60,${(p / 100 * .55).toFixed(2)})">${p}%<span class="muted"> (${k})</span></td>`; }).join('')}</tr>`; }).join('')}
        </tbody></table></div>`;
      }
      if (q.type === 'text') return `<details><summary class="linklike">${n} written answer${n === 1 ? '' : 's'}. Read with care, and never quote anything identifying.</summary><ul class="text-answers">${vals.slice(0, 200).map(v => `<li>${esc(v)}</li>`).join('')}</ul></details>`;
      return '';
    };

    const counts = Object.entries(GROUPS).map(([k, [l, f]]) => [k, l, all.filter(r => f(r.answers || {})).length]);
    const days = {};
    all.forEach(r => { days[r.submitted_on] = (days[r.submitted_on] || 0) + 1; });
    const last = Object.keys(days).sort().pop();
    $('#view').innerHTML = `
      <div class="grid k4">
        <div class="kpi glass"><div class="n">${all.length}</div><div class="l">Responses</div><div class="sub">${s.status} · ${s.audience === 'members' ? 'members only' : 'everyone'}</div></div>
        ${useGroups ? counts.slice(1).map(([, l, n]) => `<div class="kpi glass"><div class="n">${n}</div><div class="l">${esc(l)}</div><div class="sub">${all.length ? Math.round(n / all.length * 100) : 0}% of responses</div></div>`).join('')
          : `<div class="kpi glass"><div class="n">${last ? fmtDate(last) : '—'}</div><div class="l">Latest response</div></div>`}
      </div>
      ${useGroups ? `<div class="toolbar" style="margin-top:18px"><select id="sv-group" aria-label="Show results for">${counts.map(([k, l, n]) => `<option value="${k}"${STATE.group === k ? ' selected' : ''}>${esc(l)} (${n})</option>`).join('')}</select></div>` : ''}
      ${resp.length && resp.length < MIN_GROUP ? `<div class="notice warn" style="margin-top:14px">Only ${resp.length} responses here. Don't report or share results for groups smaller than ${MIN_GROUP}: people could be identified.</div>` : ''}
      ${!all.length ? `<div class="panel glass empty" style="margin-top:18px">No responses yet. ${s.status === 'open' ? 'Share the link to start collecting answers.' : 'Open the survey from the dashboard to start collecting answers.'}</div>` : ''}
      ${all.length ? S.sections.map(sec => `<div class="panel glass" style="margin-top:18px">
        <h2>${esc(s.kind === 'poll' ? 'Results' : sec.title)}</h2>
        ${sec.questions.filter(q => q.id !== 'role' || STATE.group === 'all').map(q => `<div class="sv-q"><h3>${esc(q.label)}</h3>${summary(q)}</div>`).join('')}
      </div>`).join('') : ''}`;
    const g = $('#sv-group');
    if (g) g.addEventListener('change', e => { STATE.group = e.target.value; C.route(); });
  }

  // ---------------------------------------------------------------------
  C.register('surveys', arg => {
    if (!arg) return dashboard();
    const [mode, ...rest] = arg.split('/');
    const slug = decodeURIComponent(rest.join('/'));
    if (mode === 'edit') return builder(slug);
    if (mode === 'results') return results(slug);
    return dashboard();
  });
})();
