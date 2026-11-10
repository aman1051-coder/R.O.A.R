// ROAR national survey: anonymous, one section per page, answers kept in this browser until submitted.
// Modes: /survey/ (take it), /survey/?review=1 (all questions on one printable page, for review).
// Live mode saves to Supabase table survey_responses (no names, emails or IP addresses).
// Demo mode (js/config.js empty) keeps responses in this browser, where the console demo can read them.
(() => {
  'use strict';
  const S = window.ROAR_SURVEY;
  const cfg = window.ROAR_CONFIG || {};
  const LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const DEMO_KEY = 'roar-council-demo-v3';
  const DRAFT_KEY = `roar-survey-${S.id}-${S.version}`;
  const DONE_KEY = `roar-survey-${S.id}-done`;
  const params = new URLSearchParams(location.search);
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

  // ---------------- Data ----------------
  let sb = null;
  function client() {
    if (sb || !LIVE) return Promise.resolve(sb);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
      s.onload = () => { sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false } }); res(sb); };
      s.onerror = rej; document.head.appendChild(s);
    });
  }
  async function surveyOpen() {
    if (!LIVE) return !!window.ROAR_DEMO_OK;   // preview on your own computer (or ?demo); closed to the public until connected
    const c = await client();
    const { data } = await c.from('settings').select('value').eq('key', 'survey_open').maybeSingle();
    return !!(data && data.value === true);
  }
  async function save(answers) {
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

  // ---------------- Logic ----------------
  let answers = store.get(DRAFT_KEY) || {};
  const visibleSections = () => S.sections.filter(s => !s.when || s.when(answers));
  const qVisible = q => !q.when || q.when(answers);
  const answered = (q, v) => q.type === 'multi' ? Array.isArray(v) && v.length > 0 : q.type === 'matrix' ? v && Object.keys(v).length > 0 : v !== undefined && v !== null && v !== '';

  // Keep only answers to questions the respondent actually saw
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
    if (q.type === 'single' || q.type === 'multi') {
      const t = q.type === 'single' ? 'radio' : 'checkbox';
      body = `<div class="opts ${q.options.length > 6 ? 'cols2' : ''}">${q.options.map(o => { const [val, label] = opt(o); const on = q.type === 'single' ? v === val : Array.isArray(v) && v.includes(val);
        return `<label class="o"><input type="${t}" name="${name}" value="${esc(val)}"${on ? ' checked' : ''}${review ? ' disabled' : ''}><span>${esc(label)}</span></label>`; }).join('')}</div>`;
      if (q.max) body = `<div class="hint">Choose up to ${q.max}.</div>` + body;
    } else if (q.type === 'scale') {
      body = `<div class="scale" role="radiogroup">${q.scale.map(o => `<label class="s"><input type="radio" name="${name}" value="${esc(o)}"${v === o ? ' checked' : ''}${review ? ' disabled' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;
    } else if (q.type === 'nps') {
      body = `<div class="nps" role="radiogroup">${Array.from({ length: 11 }, (_, i) => `<label class="s"><input type="radio" name="${name}" value="${i}"${String(v) === String(i) ? ' checked' : ''}${review ? ' disabled' : ''}><span>${i}</span></label>`).join('')}</div>
        <div class="nps-ends"><span>${esc(q.low)}</span><span>${esc(q.high)}</span></div>`;
    } else if (q.type === 'matrix') {
      body = `<div class="matrix"><table><thead><tr><th></th>${q.cols.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>
        ${q.rows.map((r, ri) => `<tr><th scope="row">${esc(r)}</th>${q.cols.map(c => `<td data-col="${esc(c)}"><label><input type="radio" name="${name}__${ri}" value="${esc(c)}"${v && v[r] === c ? ' checked' : ''}${review ? ' disabled' : ''} aria-label="${esc(r)}: ${esc(c)}"><span class="mc-label">${esc(c)}</span></label></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
    } else if (q.type === 'select') {
      body = `<select name="${name}"${review ? ' disabled' : ''}><option value="">Choose</option>${q.options.map(o => { const [val, label] = opt(o); return `<option value="${esc(val)}"${v === val ? ' selected' : ''}>${esc(label)}</option>`; }).join('')}</select>`;
    } else if (q.type === 'text') {
      body = `<textarea name="${name}" maxlength="2000" rows="4"${review ? ' disabled' : ''}>${esc(v || '')}</textarea>`;
    }
    const who = review && q.when ? `<div class="who">${esc(audience(q.when))}</div>` : '';
    return `<fieldset class="q" data-q="${q.id}"${!review && !qVisible(q) ? ' hidden' : ''}>
      <legend>${esc(q.label)} ${review ? '' : req}</legend>${who}${q.help ? `<div class="hint">${esc(q.help)}</div>` : ''}${body}
    </fieldset>`;
  }

  // For the review page: who sees a conditional section or question
  function audience(when) {
    const groups = [['residents', { role: 'pg2' }], ['ROs up to 6 years after PG', { role: 'sr' }], ['senior ROs', { role: 'senior' }]];
    const who = groups.filter(([, a]) => { try { return when(a); } catch (e) { return false; } }).map(g => g[0]);
    return who.length ? 'Shown to: ' + who.join(', ') : 'Follow-up: shown only when it applies to an earlier answer';
  }

  function readSection(sec) {
    sec.questions.forEach(q => {
      const name = `q-${q.id}`;
      if (q.type === 'multi') answers[q.id] = [...root.querySelectorAll(`[name="${name}"]:checked`)].map(i => i.value);
      else if (q.type === 'matrix') {
        const m = {};
        q.rows.forEach((r, ri) => { const c = root.querySelector(`[name="${name}__${ri}"]:checked`); if (c) m[r] = c.value; });
        answers[q.id] = m;
      } else if (q.type === 'text' || q.type === 'select') { const el = root.querySelector(`[name="${name}"]`); if (el) answers[q.id] = el.value.trim(); }
      else { const c = root.querySelector(`[name="${name}"]:checked`); if (c) answers[q.id] = q.type === 'nps' ? +c.value : c.value; }
    });
    store.set(DRAFT_KEY, answers);
  }

  // ---------------- Screens ----------------
  function previewBanner() {
    return LIVE ? '' : '<div class="notice">Preview mode: no database is connected, so answers stay in this browser. Founders can see preview results in the console demo.</div>';
  }

  function intro() {
    const resumed = Object.keys(answers).length > 0;
    root.innerHTML = `<div class="survey-wrap">
      ${previewBanner()}
      <div class="step-card glass">
        <span class="eyebrow">National survey · ${esc(S.version)}</span>
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
            <a class="btn btn-glass" href="?review=1">See all questions first</a>
            <button class="btn btn-primary" type="submit">${resumed ? 'Continue where I left off' : 'Start the survey'}</button>
          </div>
        </form>
      </div>
    </div>`;
    $('#consent').addEventListener('submit', e => { e.preventDefault(); if (!e.target.reportValidity()) return; section(Math.max(0, store.get(DRAFT_KEY + '-step') || 0)); });
  }

  function section(i) {
    const secs = visibleSections();
    if (i >= secs.length) i = secs.length - 1;
    const sec = secs[i];
    store.set(DRAFT_KEY + '-step', i);
    const pct = Math.round(i / secs.length * 100);
    root.innerHTML = `<div class="survey-wrap">
      ${previewBanner()}
      <div class="progress-head"><span>Section ${i + 1} of ${secs.length}</span><span>${pct}% complete</span></div>
      <div class="sv-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
      <form class="step-card glass pform" id="sec" novalidate>
        <span class="eyebrow">${esc(sec.title)}</span>
        <h2>${esc(sec.title)}</h2>
        ${sec.intro ? `<p class="muted">${esc(sec.intro)}</p>` : ''}
        ${sec.questions.map(q => qHTML(q)).join('')}
        <p class="msg" id="sec-msg" role="status"></p>
        <div class="step-actions">
          <button type="button" class="btn btn-glass" id="back">${i === 0 ? 'Back to start' : 'Back'}</button>
          <button type="submit" class="btn btn-primary">${i === secs.length - 1 ? 'Submit my answers' : 'Next'}</button>
        </div>
      </form>
      ${sec.id === 'environment' || sec.id === 'wellbeing' ? `<p class="hint" style="margin-top:14px">${esc(S.helpline)}</p>` : ''}
    </div>`;
    window.scrollTo({ top: 0 });

    const form = $('#sec');
    form.addEventListener('change', e => {
      // enforce "choose up to N"
      const fs = e.target.closest('.q');
      const q = sec.questions.find(x => x.id === (fs && fs.dataset.q));
      if (q && q.type === 'multi' && q.max && e.target.checked && form.querySelectorAll(`[name="q-${q.id}"]:checked`).length > q.max) {
        e.target.checked = false; toast(`Choose up to ${q.max}.`);
      }
      readSection(sec);
      sec.questions.forEach(x => { const el = form.querySelector(`[data-q="${x.id}"]`); if (el) el.hidden = !qVisible(x); });
    });
    $('#back').addEventListener('click', () => { readSection(sec); i === 0 ? intro() : section(i - 1); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      readSection(sec);
      const missing = sec.questions.filter(q => q.required && qVisible(q) && !answered(q, answers[q.id]));
      form.querySelectorAll('.q').forEach(el => el.classList.toggle('missing', missing.some(m => m.id === el.dataset.q)));
      if (missing.length) { const m = $('#sec-msg'); m.textContent = 'Please answer the questions marked *.'; m.className = 'msg err'; form.querySelector('.q.missing').scrollIntoView({ block: 'center' }); return; }
      const secsNow = visibleSections();          // the role answer can change which sections apply
      const idx = secsNow.findIndex(s => s.id === sec.id);
      if (idx < secsNow.length - 1) return section(idx + 1);
      const btn = e.submitter; btn.disabled = true; btn.textContent = 'Sending…';
      try {
        await save(cleanAnswers());
        store.del(DRAFT_KEY); store.del(DRAFT_KEY + '-step'); store.set(DONE_KEY, true);
        answers = {};
        done();
      } catch (err) { btn.disabled = false; btn.textContent = 'Submit my answers'; const m = $('#sec-msg'); m.textContent = err.message || 'Could not send. Please try again.'; m.className = 'msg err'; }
    });
  }

  function done() {
    root.innerHTML = `<div class="survey-wrap"><div class="step-card glass" style="text-align:center">
      <span class="eyebrow">Thank you</span>
      <h1 class="survey-title">Your answers are in.</h1>
      <p class="lead" style="margin:0 auto 18px">Thank you for helping build an accurate picture of radiation oncology training in India. The results will be published in the State of Young Radiation Oncologists in India report.</p>
      <p class="hint">${esc(S.helpline)}</p>
      <p>Please share the survey with the other residents in your department.</p>
      <div class="step-actions" style="justify-content:center">
        <button class="btn btn-glass" id="share">Copy survey link</button>
        <a class="btn btn-primary" href="../index.html#join">Stay updated or become an ambassador</a>
      </div>
      <p class="hint" style="margin-top:14px">That form is separate, so your survey answers stay anonymous.</p>
    </div></div>`;
    $('#share').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.origin + location.pathname); toast('Link copied'); } catch (e) { toast(location.origin + location.pathname); }
    });
  }

  function closedView() {
    root.innerHTML = `<div class="survey-wrap"><div class="step-card glass" style="text-align:center">
      <span class="eyebrow">National survey</span>
      <h1 class="survey-title">The survey opens soon.</h1>
      <p class="lead" style="margin:0 auto 18px">ROAR's first national survey of radiation oncology residents and young radiation oncologists will open after ROAR is registered.</p>
      <div class="step-actions" style="justify-content:center">
        <a class="btn btn-glass" href="?review=1">Preview the questions</a>
        <a class="btn btn-primary" href="../index.html#join">Tell me when it opens</a>
      </div>
    </div></div>`;
  }

  function review() {
    document.body.classList.add('survey-review');
    root.innerHTML = `<div class="survey-wrap wide">
      <div class="review-head">
        <div><span class="eyebrow">Review copy · ${esc(S.version)}</span><h1 class="survey-title">${esc(S.title)}</h1></div>
        <div class="step-actions no-print"><button class="btn btn-glass" onclick="window.print()">Print or save as PDF</button><a class="btn btn-primary" href="./">Take the survey</a></div>
      </div>
      <p class="lead">${esc(S.intro)}</p>
      <p class="hint">${esc(S.helpline)} Questions marked "optional" can be skipped. About ${S.minutes} minutes.</p>
      ${S.sections.map((s, i) => `<section class="step-card glass review-sec">
        <span class="eyebrow">Section ${i + 1}${s.when ? ' · ' + esc(audience(s.when)) : ' · Everyone'}</span>
        <h2>${esc(s.title)}</h2>${s.intro ? `<p class="muted">${esc(s.intro)}</p>` : ''}
        ${s.questions.map((q, qi) => qHTML({ ...q, label: `${i + 1}.${qi + 1}  ${q.label}${q.required ? ' *' : ''}` }, true)).join('')}
      </section>`).join('')}
      <p class="hint">Sources: the burnout item is the single-item measure from the Physician Worklife Study (Rohland et al., 2004); the two mood items are the PHQ-2 screener (Kroenke et al., 2003), which is free to use.</p>
    </div>`;
  }

  // ---------------- Start ----------------
  (async () => {
    if (params.get('review')) return review();
    if (store.get(DONE_KEY) && !params.get('again')) {
      done();
      root.querySelector('.step-card').insertAdjacentHTML('beforeend', '<p class="hint" style="margin-top:10px">You have already taken part from this device. Sharing a device with a colleague? <a href="?again=1">Start a new response</a>.</p>');
      return;
    }
    try { (await surveyOpen()) ? intro() : closedView(); }
    catch (e) { closedView(); }
  })();
})();
