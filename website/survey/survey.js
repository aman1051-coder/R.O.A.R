// ROAR surveys and polls: anonymous, one section per page, answers kept in this browser until submitted.
// Links:  /survey/?s=<slug>        take a survey or poll (default: the national survey)
//         /survey/?s=<slug>&review=1  every question on one printable page
//         /survey/?s=<slug>&preview=1 founders: try a draft without saving answers
// Surveys are created and edited by the Founders' Council in the console (table "surveys").
// Responses go to "survey_responses" with no name, email or IP address.
(() => {
  'use strict';
  const E = window.ROAR_SURVEY_ENGINE;
  const TEMPLATE = window.ROAR_SURVEY;                    // the national survey draft shipped with the site
  const cfg = window.ROAR_CONFIG || {};
  const LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const DEMO_OK = !!window.ROAR_DEMO_OK;
  const DEMO_KEY = 'roar-council-demo-v3';
  const params = new URLSearchParams(location.search);
  const SLUG = (params.get('s') || TEMPLATE.id).toLowerCase();
  const PREVIEW = params.has('preview');
  const root = document.getElementById('survey-root');
  const $ = s => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
  };
  const toast = (msg, err) => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 4000);
  };
  const opt = o => Array.isArray(o) ? o : [o, o];
  const HELPLINE = 'If any question brings up something difficult, you can call Tele-MANAS on 14416 (or 1-800-891-4416), India\'s free 24-hour mental health helpline.';

  // ---------------- Data ----------------
  let sb = null;
  function client() {
    if (sb || !LIVE) return Promise.resolve(sb);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
      s.onload = () => { sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey); res(sb); };   // shares the portal's sign-in
      s.onerror = rej; document.head.appendChild(s);
    });
  }
  const fromRow = r => ({
    ...(r.definition || {}), id: r.slug, kind: r.kind, title: r.title, intro: r.intro || '', version: r.version,
    status: r.status, audience: r.audience, show_results: !!r.show_results,
    minutes: (r.definition && r.definition.minutes) || (r.kind === 'poll' ? 1 : 10),
    helpline: (r.definition && r.definition.helpline) || HELPLINE,
  });

  async function loadSurvey() {
    if (LIVE) {
      const c = await client();
      const { data, error } = await c.from('surveys').select('*').eq('slug', SLUG).maybeSingle();
      if (error) throw error;
      if (data) return fromRow(data);
    } else if (DEMO_OK) {
      const d = store.get(DEMO_KEY) || {};
      const r = (d.surveys || []).find(x => x.slug === SLUG);
      if (r) return fromRow(r);
    }
    // The built-in national survey draft, until the founders add it in the console
    if (SLUG === TEMPLATE.id) return { ...TEMPLATE, kind: 'survey', audience: 'everyone', status: DEMO_OK && !LIVE ? 'open' : 'closed', builtIn: true };
    return null;
  }

  async function signedIn() {
    if (LIVE) { const c = await client(); const { data } = await c.auth.getSession(); return !!data.session; }
    return !!store.get('roar-portal-demo-user');
  }

  async function save(answers) {
    if (PREVIEW) return;                                  // founders' preview: nothing is saved
    if (!LIVE) {
      const d = store.get(DEMO_KEY) || {};
      d.survey_responses = d.survey_responses || [];
      d.survey_responses.push({ id: 'resp-' + Date.now() + '-' + Math.random().toString(16).slice(2), survey_id: S.id, version: S.version, submitted_on: new Date().toISOString().slice(0, 10), answers });
      store.set(DEMO_KEY, d);
      return;
    }
    const c = await client();
    const { error } = await c.from('survey_responses').insert({ survey_id: S.id, version: S.version, answers });
    if (error) throw error;
  }

  async function pollTotals() {
    if (!S.show_results) return null;
    if (LIVE) { const c = await client(); const { data } = await c.rpc('poll_results', { p_slug: S.id }); return data; }
    const d = store.get(DEMO_KEY) || {};
    const q = S.sections[0].questions[0].id;
    const counts = {}; let total = 0;
    (d.survey_responses || []).filter(r => r.survey_id === S.id).forEach(r => {
      total++; const v = r.answers[q];
      (Array.isArray(v) ? v : [v]).filter(Boolean).forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    });
    return { total, counts };
  }

  // ---------------- State ----------------
  let S = null, answers = {}, DRAFT_KEY = '', DONE_KEY = '';
  const visibleSections = () => S.sections.filter(s => E.cond(s.when, answers));
  const qVisible = q => E.cond(q.when, answers);
  const answered = (q, v) => q.type === 'multi' ? Array.isArray(v) && v.length > 0 : q.type === 'matrix' ? v && Object.keys(v).length > 0 : v !== undefined && v !== null && v !== '';
  function cleanAnswers() {
    const out = {};
    visibleSections().forEach(s => s.questions.forEach(q => { if (qVisible(q) && answered(q, answers[q.id])) out[q.id] = answers[q.id]; }));
    return out;
  }

  // ---------------- Rendering ----------------
  function qHTML(q, review) {
    const v = answers[q.id];
    const req = q.required ? '<span class="req" aria-label="required">*</span>' : '<span class="opt">optional</span>';
    let body = '';
    const name = `q-${q.id}`;
    const dis = review ? ' disabled' : '';
    if (q.type === 'single' || q.type === 'multi') {
      const t = q.type === 'single' ? 'radio' : 'checkbox';
      body = `<div class="opts ${(q.options || []).length > 6 ? 'cols2' : ''}">${(q.options || []).map(o => { const [val, label] = opt(o); const on = q.type === 'single' ? v === val : Array.isArray(v) && v.includes(val);
        return `<label class="o"><input type="${t}" name="${name}" value="${esc(val)}"${on ? ' checked' : ''}${dis}><span>${esc(label)}</span></label>`; }).join('')}</div>`;
      if (q.max) body = `<div class="hint">Choose up to ${q.max}.</div>` + body;
    } else if (q.type === 'scale') {
      body = `<div class="scale" role="radiogroup">${(q.scale || []).map(o => `<label class="s"><input type="radio" name="${name}" value="${esc(o)}"${v === o ? ' checked' : ''}${dis}><span>${esc(o)}</span></label>`).join('')}</div>`;
    } else if (q.type === 'nps') {
      body = `<div class="nps" role="radiogroup">${Array.from({ length: 11 }, (_, i) => `<label class="s"><input type="radio" name="${name}" value="${i}"${String(v) === String(i) ? ' checked' : ''}${dis}><span>${i}</span></label>`).join('')}</div>
        <div class="nps-ends"><span>${esc(q.low || 'Not at all likely')}</span><span>${esc(q.high || 'Extremely likely')}</span></div>`;
    } else if (q.type === 'matrix') {
      body = `<div class="matrix"><table><thead><tr><th></th>${(q.cols || []).map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>
        ${(q.rows || []).map((r, ri) => `<tr><th scope="row">${esc(r)}</th>${q.cols.map(c => `<td><label><input type="radio" name="${name}__${ri}" value="${esc(c)}"${v && v[r] === c ? ' checked' : ''}${dis} aria-label="${esc(r)}: ${esc(c)}"><span class="mc-label">${esc(c)}</span></label></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
    } else if (q.type === 'select') {
      body = `<select name="${name}"${dis}><option value="">Choose</option>${(q.options || []).map(o => { const [val, label] = opt(o); return `<option value="${esc(val)}"${v === val ? ' selected' : ''}>${esc(label)}</option>`; }).join('')}</select>`;
    } else if (q.type === 'text') {
      body = `<textarea name="${name}" maxlength="2000" rows="4"${dis}>${esc(v || '')}</textarea>`;
    }
    const who = review && q.when ? `<div class="who">${esc(E.describe(q.when, S))}</div>` : '';
    return `<fieldset class="q" data-q="${esc(q.id)}"${!review && !qVisible(q) ? ' hidden' : ''}>
      <legend>${esc(q.label)} ${review ? '' : req}</legend>${who}${q.help ? `<div class="hint">${esc(q.help)}</div>` : ''}${body}
    </fieldset>`;
  }

  function readSection(sec) {
    sec.questions.forEach(q => {
      const name = `q-${q.id}`;
      if (q.type === 'multi') answers[q.id] = [...root.querySelectorAll(`[name="${name}"]:checked`)].map(i => i.value);
      else if (q.type === 'matrix') {
        const m = {};
        (q.rows || []).forEach((r, ri) => { const c = root.querySelector(`[name="${name}__${ri}"]:checked`); if (c) m[r] = c.value; });
        answers[q.id] = m;
      } else if (q.type === 'text' || q.type === 'select') { const el = root.querySelector(`[name="${name}"]`); if (el) answers[q.id] = el.value.trim(); }
      else { const c = root.querySelector(`[name="${name}"]:checked`); if (c) answers[q.id] = q.type === 'nps' ? +c.value : c.value; }
    });
    store.set(DRAFT_KEY, answers);
  }

  // ---------------- Screens ----------------
  const banner = () => PREVIEW ? '<div class="notice warn">Founders\' preview: answers are not saved.</div>'
    : (!LIVE ? '<div class="notice">Preview mode: no database is connected, so answers stay in this browser.</div>' : '');
  const membersTag = () => S.audience === 'members' ? '<span class="tag tag-roar" style="margin-left:8px">Members</span>' : '';

  function intro() {
    if (S.kind === 'poll') return section(0);
    const resumed = Object.keys(answers).length > 0;
    root.innerHTML = `<div class="survey-wrap">
      ${banner()}
      <div class="step-card glass">
        <span class="eyebrow">National survey · ${esc(S.version)}${membersTag()}</span>
        <h1 class="survey-title">${esc(S.title)}</h1>
        <p class="lead">${esc(S.intro)}</p>
        <div class="facts">
          <div><b>About ${S.minutes} minutes</b><span>One section at a time. Your answers are saved in this browser, so you can stop and come back.</span></div>
          <div><b>Anonymous</b><span>No name, email, institution or IP address is collected. Results are reported only for groups of 5 or more.</span></div>
          <div><b>Voluntary</b><span>Answer only what you are comfortable with. Most questions are optional, and you can stop at any time.</span></div>
        </div>
        <p class="hint">${esc(S.helpline)}</p>
        <form id="consent" class="pform">
          <div class="check"><input type="checkbox" id="agree" required><label for="agree">I am a radiation oncology resident or radiation oncologist working in India, I am 18 or over, and I agree to take part. I understand my answers are anonymous and will be reported only in combined form.</label></div>
          <div class="step-actions">
            <a class="btn btn-glass" href="?s=${esc(S.id)}&review=1">See all questions first</a>
            <button class="btn btn-primary" type="submit">${resumed ? 'Continue where I left off' : 'Start the survey'}</button>
          </div>
        </form>
      </div>
    </div>`;
    $('#consent').addEventListener('submit', e => { e.preventDefault(); if (!e.target.reportValidity()) return; section(Math.max(0, store.get(DRAFT_KEY + '-step') || 0)); });
  }

  function section(i) {
    const secs = visibleSections();
    if (!secs.length) { root.innerHTML = '<div class="card empty-state">This survey has no questions yet.</div>'; return; }
    if (i >= secs.length) i = secs.length - 1;
    const sec = secs[i];
    store.set(DRAFT_KEY + '-step', i);
    const pct = Math.round(i / secs.length * 100);
    const poll = S.kind === 'poll';
    root.innerHTML = `<div class="survey-wrap">
      ${banner()}
      ${poll ? '' : `<div class="progress-head"><span>Section ${i + 1} of ${secs.length}</span><span>${pct}% complete</span></div>
      <div class="sv-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`}
      <form class="step-card glass pform" id="sec" novalidate>
        <span class="eyebrow">${poll ? 'Poll' : esc(sec.title)}${membersTag()}</span>
        <h2>${esc(poll ? S.title : sec.title)}</h2>
        ${poll ? (S.intro ? `<p class="muted">${esc(S.intro)}</p>` : '<p class="muted">Anonymous. One answer per person.</p>') : (sec.intro ? `<p class="muted">${esc(sec.intro)}</p>` : '')}
        ${sec.questions.map(q => qHTML(poll ? { ...q, label: q.label === S.title ? 'Your answer' : q.label } : q)).join('')}
        <p class="msg" id="sec-msg" role="status"></p>
        <div class="step-actions">
          ${poll ? '<span></span>' : `<button type="button" class="btn btn-glass" id="back">${i === 0 ? 'Back to start' : 'Back'}</button>`}
          <button type="submit" class="btn btn-primary">${poll ? 'Submit my answer' : i === secs.length - 1 ? 'Submit my answers' : 'Next'}</button>
        </div>
      </form>
      ${!poll && /environment|wellbeing/.test(sec.id) ? `<p class="hint" style="margin-top:14px">${esc(S.helpline)}</p>` : ''}
    </div>`;
    window.scrollTo({ top: 0 });

    const form = $('#sec');
    form.addEventListener('change', e => {
      const fs = e.target.closest('.q');
      const q = sec.questions.find(x => x.id === (fs && fs.dataset.q));
      if (q && q.type === 'multi' && q.max && e.target.checked && form.querySelectorAll(`[name="q-${q.id}"]:checked`).length > q.max) {
        e.target.checked = false; toast(`Choose up to ${q.max}.`);
      }
      readSection(sec);
      sec.questions.forEach(x => { const el = form.querySelector(`[data-q="${x.id}"]`); if (el) el.hidden = !qVisible(x); });
    });
    const back = $('#back');
    if (back) back.addEventListener('click', () => { readSection(sec); i === 0 ? intro() : section(i - 1); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      readSection(sec);
      const missing = sec.questions.filter(q => (q.required || poll) && qVisible(q) && !answered(q, answers[q.id]));
      form.querySelectorAll('.q').forEach(el => el.classList.toggle('missing', missing.some(m => m.id === el.dataset.q)));
      if (missing.length) { const m = $('#sec-msg'); m.textContent = poll ? 'Please choose an answer.' : 'Please answer the questions marked *.'; m.className = 'msg err'; form.querySelector('.q.missing').scrollIntoView({ block: 'center' }); return; }
      const secsNow = visibleSections();
      const idx = secsNow.findIndex(s => s.id === sec.id);
      if (idx < secsNow.length - 1) return section(idx + 1);
      const btn = e.submitter; btn.disabled = true; btn.textContent = 'Sending…';
      try {
        await save(cleanAnswers());
        store.del(DRAFT_KEY); store.del(DRAFT_KEY + '-step'); if (!PREVIEW) store.set(DONE_KEY, true);
        answers = {};
        done();
      } catch (err) { btn.disabled = false; btn.textContent = 'Submit'; const m = $('#sec-msg'); m.textContent = err.message || 'Could not send. Please try again.'; m.className = 'msg err'; }
    });
  }

  async function done(already) {
    const poll = S.kind === 'poll';
    root.innerHTML = `<div class="survey-wrap"><div class="step-card glass" style="text-align:center">
      <span class="eyebrow">Thank you</span>
      <h1 class="survey-title">${already ? 'You have already taken part.' : poll ? 'Your answer is in.' : 'Your answers are in.'}</h1>
      ${poll ? '<div id="poll-totals"></div>' : `<p class="lead" style="margin:0 auto 18px">Thank you for helping build an accurate picture of radiation oncology in India.</p><p class="hint">${esc(S.helpline)}</p>`}
      <p>Please share it with the other residents in your department.</p>
      <div class="step-actions" style="justify-content:center">
        <button class="btn btn-glass" id="share">Copy link</button>
        <a class="btn btn-primary" href="../index.html#join">Stay updated or become an ambassador</a>
      </div>
      ${already ? '<p class="hint" style="margin-top:10px">Sharing a device with a colleague? <a href="?s=' + esc(S.id) + '&again=1">Start a new response</a>.</p>' : ''}
    </div></div>`;
    $('#share').addEventListener('click', async () => {
      const url = location.origin + location.pathname + '?s=' + encodeURIComponent(S.id);
      try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch (e) { toast(url); }
    });
    if (poll) {
      const t = await pollTotals().catch(() => null);
      const box = $('#poll-totals');
      if (t && box) {
        const q = S.sections[0].questions[0];
        const total = t.total || 0;
        box.innerHTML = `<div class="poll-totals">${(q.options || []).map(o => { const [v, l] = opt(o); const n = (t.counts || {})[v] || 0; const p = total ? Math.round(n / total * 100) : 0;
          return `<div class="pt-row"><span>${esc(l)}</span><span class="pt-bar"><i style="width:${p}%"></i></span><b>${p}%</b></div>`; }).join('')}
          <p class="hint">${total} response${total === 1 ? '' : 's'} so far.</p></div>`;
      }
    }
  }

  function message(title, text, buttons) {
    root.innerHTML = `<div class="survey-wrap"><div class="step-card glass" style="text-align:center">
      <span class="eyebrow">${S && S.kind === 'poll' ? 'Poll' : 'National survey'}</span>
      <h1 class="survey-title">${title}</h1>
      <p class="lead" style="margin:0 auto 18px">${text}</p>
      <div class="step-actions" style="justify-content:center">${buttons || ''}</div>
    </div></div>`;
  }

  function review() {
    document.body.classList.add('survey-review');
    root.innerHTML = `<div class="survey-wrap wide">
      <div class="review-head">
        <div><span class="eyebrow">Review copy · ${esc(S.version)}${membersTag()}</span><h1 class="survey-title">${esc(S.title)}</h1></div>
        <div class="step-actions no-print"><button class="btn btn-glass" onclick="window.print()">Print or save as PDF</button><a class="btn btn-primary" href="?s=${esc(S.id)}">Take it</a></div>
      </div>
      <p class="lead">${esc(S.intro)}</p>
      <p class="hint">${esc(S.helpline)} Questions marked "optional" can be skipped. About ${S.minutes} minutes.</p>
      ${S.sections.map((s, i) => `<section class="step-card glass review-sec">
        <span class="eyebrow">Section ${i + 1} · ${s.when ? esc(E.describe(s.when, S)) : 'Everyone'}</span>
        <h2>${esc(s.title)}</h2>${s.intro ? `<p class="muted">${esc(s.intro)}</p>` : ''}
        ${s.questions.map((q, qi) => qHTML({ ...q, label: `${i + 1}.${qi + 1}  ${q.label}${q.required ? ' *' : ''}` }, true)).join('')}
      </section>`).join('')}
    </div>`;
  }

  // ---------------- Start ----------------
  (async () => {
    try { S = await loadSurvey(); } catch (e) { S = null; }
    if (!S) return message('Survey not found.', 'This link may be wrong, or the survey may have been removed.', '<a class="btn btn-primary" href="../index.html">Back to ROAR</a>');
    document.title = `${S.title} – ROAR`;
    DRAFT_KEY = `roar-survey-${S.id}-${S.version}`;
    DONE_KEY = `roar-survey-${S.id}-done`;
    answers = store.get(DRAFT_KEY) || {};
    if (params.get('review')) return review();
    if (S.status === 'draft' && !PREVIEW) return message('This survey isn\'t open yet.', 'The founders are still preparing it.', `<a class="btn btn-glass" href="?s=${esc(S.id)}&review=1">Preview the questions</a>`);
    if (S.status === 'closed' && !PREVIEW) return message(S.builtIn ? 'The survey opens soon.' : 'This survey has closed.', S.builtIn ? 'ROAR\'s first national survey will open after ROAR is registered.' : 'Thank you to everyone who took part. Results will be shared by ROAR.',
      `<a class="btn btn-glass" href="?s=${esc(S.id)}&review=1">See the questions</a><a class="btn btn-primary" href="../index.html#join">Tell me about future surveys</a>`);
    if (S.audience === 'members' && !PREVIEW && !(await signedIn().catch(() => false))) {
      return message('This survey is for members.', 'Sign in to the member portal, then come back to this link. Your answers stay anonymous: they are never linked to your account.',
        `<a class="btn btn-primary" href="../portal/">Sign in</a><a class="btn btn-glass" href="?s=${esc(S.id)}&review=1">See the questions</a>`);
    }
    if (store.get(DONE_KEY) && !params.get('again') && !PREVIEW) return done(true);
    intro();
  })();
})();
