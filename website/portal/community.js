// ROAR Community: the members' social space inside the portal.
// Profiles (unique @username, profile picture, bio), posts with up to 4 photos, likes, comments and reports.
// Live mode uses Supabase (schema.sql PART 11, private 'community' bucket). Demo mode keeps everything
// in this browser. portal.js calls ROAR_COMMUNITY.view(ctx, route) for #community routes.
(() => {
  'use strict';
  const KINDS = [['question', 'Question'], ['article', 'Article'], ['case', 'Case discussion'], ['news', 'News'], ['general', 'General']];
  const KIND = Object.fromEntries(KINDS);
  const REASONS = ['Patient privacy', 'Harassment or disrespect', 'Misinformation', 'Spam or advertising', 'Other'];
  const PAGE = 15;
  const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

  let ctx, D, me = null, myId = null, filter = 'all';
  const esc = v => ctx.esc(v);
  const root = () => ctx.root;
  const $ = s => ctx.root.querySelector(s);

  // ------------------------------------------------------------------ helpers
  const ago = v => {
    const s = (Date.now() - new Date(v).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 7 * 86400) return Math.floor(s / 86400) + 'd';
    return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: new Date(v).getFullYear() === new Date().getFullYear() ? undefined : 'numeric', timeZone: 'Asia/Kolkata' });
  };
  const richText = t => esc(t)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener nofollow ugc">$1</a>')
    .replace(/\n/g, '<br>');
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? esc(u) : '';
  const initials = n => String(n || '?').replace(/^dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/^dr\.?\s+/, '').replace(/[^a-z0-9._]+/g, '.').replace(/^[._]+|[._]+$/g, '').replace(/\.{2,}/g, '.').slice(0, 30);
  const go = h => { if (location.hash === h) ctx.rerender(); else location.hash = h; };

  function avatar(p, size) {
    const cls = `cm-av${size ? ' ' + size : ''}`;
    if (p && p.avatar_path) return `<span class="${cls}"><img alt="" data-path="${esc(p.avatar_path)}"></span>`;
    return `<span class="${cls}" aria-hidden="true">${esc(initials(p && p.display_name))}</span>`;
  }
  function badges(b) {
    if (!b) return '';
    return (b.founder ? `<span class="cm-badge f" title="Founders' Council">Founder${b.founder_id ? ' · ' + esc(b.founder_id) : ''}</span>` : '')
      + (b.member ? '<span class="cm-badge m" title="Approved ROAR member">Member</span>' : '');
  }

  // Resize in the browser before upload. Re-encoding also strips EXIF data such as GPS location.
  async function shrink(file, max, square, quality) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Please choose a JPG, PNG or WebP picture.');
    if (file.size > 25 * 1024 * 1024) throw new Error('That picture is too large (over 25 MB).');
    const img = await new Promise((res, rej) => {
      const i = new Image(); const u = URL.createObjectURL(file);
      i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Couldn't read that picture.")); };
      i.src = u;
    });
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
    const k = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, 'image/jpeg', quality));
  }
  const blobToDataUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

  // Fill in <img data-path> once the HTML is on the page (signed links for the private bucket)
  async function hydrate(scope) {
    const imgs = [...(scope || root()).querySelectorAll('img[data-path]:not([src])')];
    if (!imgs.length) return;
    try {
      const map = await D.urls([...new Set(imgs.map(i => i.dataset.path))]);
      imgs.forEach(i => { const u = map[i.dataset.path]; if (u) i.src = u; else i.closest('.cm-av, .cm-shot, .cm-tile') && i.remove(); });
    } catch (e) { console.warn(e); }
  }

  // ------------------------------------------------------------------ data layers
  function liveLayer(sb) {
    const AUTHOR = 'id, username, display_name, avatar_path';
    const POST_SEL = `*, author:profiles!posts_author_id_fkey(${AUTHOR}), likes:post_likes(count), ncomments:comments(count)`;
    const cache = new Map();
    const unwrap = ({ data, error }) => { if (error) throw error; return data; };
    const shape = async rows => {
      const ids = rows.map(r => r.id);
      const mine = ids.length ? unwrap(await sb.from('post_likes').select('post_id').eq('user_id', myId).in('post_id', ids)) : [];
      const liked = new Set(mine.map(r => r.post_id));
      return rows.map(r => ({ ...r, nlikes: (r.likes && r.likes[0] && r.likes[0].count) || 0, ncomments: (r.ncomments && r.ncomments[0] && r.ncomments[0].count) || 0, liked: liked.has(r.id) }));
    };
    const upload = async blob => {
      const path = `${myId}/${ctx.uid()}.jpg`;
      unwrap(await sb.storage.from('community').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
      return path;
    };
    const removeFiles = async paths => { const own = paths.filter(p => p && p.startsWith(myId + '/')); if (own.length) await sb.storage.from('community').remove(own); };
    return {
      async myProfile() { return unwrap(await sb.from('profiles').select('*').eq('id', myId).maybeSingle()); },
      async profile(u) { return unwrap(await sb.from('profiles').select('*').eq('username', u.toLowerCase()).maybeSingle()); },
      async usernameTaken(u) { const r = unwrap(await sb.from('profiles').select('id').eq('username', u).maybeSingle()); return !!(r && r.id !== myId); },
      async saveProfile(f, av) {
        const old = me && me.avatar_path;
        if (av === 'remove') f.avatar_path = null;
        else if (av) f.avatar_path = await upload(av);
        f.updated_at = new Date().toISOString();
        const row = me ? unwrap(await sb.from('profiles').update(f).eq('id', myId).select().single())
          : unwrap(await sb.from('profiles').insert(f).select().single());
        if (old && av) removeFiles([old]).catch(() => { });
        return row;
      },
      async feed({ kind, author, before }) {
        let q = sb.from('posts').select(POST_SEL).order('created_at', { ascending: false }).limit(PAGE);
        if (kind && kind !== 'all') q = q.eq('kind', kind);
        if (author) q = q.eq('author_id', author);
        if (before) q = q.lt('created_at', before);
        return shape(unwrap(await q));
      },
      async post(id) { const r = unwrap(await sb.from('posts').select(POST_SEL).eq('id', id).maybeSingle()); return r ? (await shape([r]))[0] : null; },
      async createPost(f, blobs) {
        const paths = [];
        try { for (const b of blobs) paths.push(await upload(b)); } catch (e) { removeFiles(paths).catch(() => { }); throw e; }
        return unwrap(await sb.from('posts').insert({ ...f, image_paths: paths }).select('id').single());
      },
      async deletePost(p) { unwrap(await sb.from('posts').delete().eq('id', p.id)); removeFiles(p.image_paths || []).catch(() => { }); },
      async setHidden(table, id, hidden, reason) {
        const patch = table === 'posts' ? { hidden, hidden_reason: hidden ? (reason || null) : null } : { hidden };
        unwrap(await sb.from(table).update(patch).eq('id', id));
      },
      async like(p, on) {
        if (on) { const { error } = await sb.from('post_likes').insert({ post_id: p.id }); if (error && error.code !== '23505') throw error; }
        else unwrap(await sb.from('post_likes').delete().eq('post_id', p.id).eq('user_id', myId));
      },
      async comments(pid) { return unwrap(await sb.from('comments').select(`*, author:profiles!comments_author_id_fkey(${AUTHOR})`).eq('post_id', pid).order('created_at')); },
      async addComment(pid, body) { unwrap(await sb.from('comments').insert({ post_id: pid, body })); },
      async deleteComment(c) { unwrap(await sb.from('comments').delete().eq('id', c.id)); },
      async report(r) { unwrap(await sb.from('post_reports').insert(r)); },
      async badges(ids) { if (!ids.length) return {}; return unwrap(await sb.rpc('community_badges_for', { p_users: ids })) || {}; },
      async urls(paths) {
        const out = {}, need = [];
        paths.forEach(p => { const c = cache.get(p); if (c && c.exp > Date.now()) out[p] = c.url; else need.push(p); });
        if (need.length) {
          const rows = unwrap(await sb.storage.from('community').createSignedUrls(need, 3600));
          rows.forEach(r => { if (r.signedUrl) { out[r.path] = r.signedUrl; cache.set(r.path, { url: r.signedUrl, exp: Date.now() + 50 * 60000 }); } });
        }
        return out;
      },
    };
  }

  function demoLayer() {
    const S = () => {
      const s = ctx.Demo.s;
      s.community = s.community || { profiles: [], posts: [], comments: [], likes: [], reports: [] };
      ['profiles', 'posts', 'comments', 'likes', 'reports'].forEach(k => { s.community[k] = s.community[k] || []; });
      return s.community;
    };
    const save = () => { try { ctx.Demo.save(); } catch (e) { throw new Error('This browser is out of space for demo pictures. Delete a few demo posts and try again.'); } };
    const check = () => { const k = 'roar-cm-probe'; localStorage.setItem(k, JSON.stringify(ctx.Demo.s)); localStorage.removeItem(k); };
    const prof = id => S().profiles.find(p => p.id === id) || null;
    const author = p => { const a = prof(p.author_id); return a ? { id: a.id, username: a.username, display_name: a.display_name, avatar_path: a.avatar_path } : null; };
    const visible = p => !p.hidden || p.author_id === myId || ctx.isFounder;
    const shape = p => ({ ...p, author: author(p), nlikes: S().likes.filter(l => l.post_id === p.id).length,
      ncomments: S().comments.filter(c => c.post_id === p.id && (!c.hidden || c.author_id === myId || ctx.isFounder)).length,
      liked: S().likes.some(l => l.post_id === p.id && l.user_id === myId) });
    // A welcome post so the demo feed isn't empty
    if (!S().posts.length) {
      const f = (ctx.Demo.s.founders || []).find(x => x.founder_id === 'FC-02') || (ctx.Demo.s.founders || [])[0];
      if (f && !prof(f.email)) S().profiles.push({ id: f.email, username: slug(f.username || f.email.split('@')[0]), display_name: f.name || 'ROAR Founder', bio: "Founders' Council, ROAR.", institution: null, stage: null, avatar_path: null, created_at: new Date().toISOString() });
      if (f) S().posts.push({ id: ctx.uid(), author_id: f.email, kind: 'general', title: 'Welcome to ROAR Community',
        body: 'This is a space for radiation oncology residents and young consultants across India to ask questions, share articles and discuss cases.\n\nBe kind, cite your sources, and never post anything that could identify a patient.',
        image_paths: [], link_url: null, created_at: new Date(Date.now() - 3600e3).toISOString(), edited_at: null, hidden: false, hidden_reason: null });
      ctx.Demo.save();
    }
    return {
      async myProfile() { return prof(myId); },
      async profile(u) { return S().profiles.find(p => p.username === u.toLowerCase()) || null; },
      async usernameTaken(u) { return S().profiles.some(p => p.username === u && p.id !== myId); },
      async saveProfile(f, av) {
        if (av === 'remove') f.avatar_path = null; else if (av) f.avatar_path = await blobToDataUrl(av);
        let p = prof(myId);
        if (p) Object.assign(p, f, { updated_at: new Date().toISOString() });
        else { p = { id: myId, created_at: new Date().toISOString(), bio: null, institution: null, stage: null, avatar_path: null, ...f }; S().profiles.push(p); }
        check(); save(); return { ...p };
      },
      async feed({ kind, author, before }) {
        return S().posts.filter(p => visible(p) && (!kind || kind === 'all' || p.kind === kind) && (!author || p.author_id === author) && (!before || p.created_at < before))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, PAGE).map(shape);
      },
      async post(id) { const p = S().posts.find(x => x.id === id); return p && visible(p) ? shape(p) : null; },
      async createPost(f, blobs) {
        const paths = []; for (const b of blobs) paths.push(await blobToDataUrl(b));
        const p = { id: ctx.uid(), author_id: myId, created_at: new Date().toISOString(), edited_at: null, hidden: false, hidden_reason: null, title: null, link_url: null, ...f, image_paths: paths };
        S().posts.push(p);
        try { check(); } catch (e) { S().posts.pop(); throw new Error('This browser is out of space for demo pictures. Try fewer or smaller pictures.'); }
        save(); return { id: p.id };
      },
      async deletePost(p) { const s = S(); s.posts = s.posts.filter(x => x.id !== p.id); s.comments = s.comments.filter(c => c.post_id !== p.id); s.likes = s.likes.filter(l => l.post_id !== p.id); save(); },
      async setHidden(table, id, hidden, reason) {
        const r = S()[table].find(x => x.id === id); if (!r) return;
        r.hidden = hidden; if (table === 'posts') r.hidden_reason = hidden ? (reason || null) : null; save();
      },
      async like(p, on) { const s = S(); s.likes = s.likes.filter(l => !(l.post_id === p.id && l.user_id === myId)); if (on) s.likes.push({ post_id: p.id, user_id: myId, created_at: new Date().toISOString() }); save(); },
      async comments(pid) { return S().comments.filter(c => c.post_id === pid && (!c.hidden || c.author_id === myId || ctx.isFounder)).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(c => ({ ...c, author: author(c) })); },
      async addComment(pid, body) { S().comments.push({ id: ctx.uid(), post_id: pid, author_id: myId, body, created_at: new Date().toISOString(), hidden: false }); save(); },
      async deleteComment(c) { const s = S(); s.comments = s.comments.filter(x => x.id !== c.id); save(); },
      async report(r) { S().reports.push({ id: ctx.uid(), reporter_id: myId, status: 'open', created_at: new Date().toISOString(), details: null, comment_id: null, post_id: null, ...r }); save(); },
      async badges(ids) {
        const out = {};
        ids.forEach(id => {
          const f = (ctx.Demo.s.founders || []).find(x => x.email === id);
          out[id] = { founder: !!f, founder_id: f ? f.founder_id : null, member: (ctx.Demo.s.members || []).some(m => m.email === id && m.status === 'approved') };
        });
        return out;
      },
      async urls(paths) { return Object.fromEntries(paths.map(p => [p, p])); },
    };
  }

  // ------------------------------------------------------------------ entry
  async function view(c, route) {
    ctx = c;
    myId = ctx.LIVE ? ctx.sess.id : ctx.sess.email;
    D = D || (ctx.LIVE ? liveLayer(ctx.sb) : demoLayer());
    me = await D.myProfile();
    const [what, arg] = route;
    if (!me) return setupView();
    if (what === 'edit') return setupView(true);
    if (what === 'p' && arg) return postView(arg);
    if (what === 'u' && arg) return profileView(decodeURIComponent(arg));
    return feedView();
  }

  // ------------------------------------------------------------------ create / edit profile
  function setupView(editing) {
    const p = me || {};
    const sess = ctx.sess;
    const suggest = slug(sess.email.endsWith('@' + (ctx.cfg.founderLoginDomain || 'founders.roar.invalid')) ? sess.email.split('@')[0] : (sess.name || sess.email.split('@')[0]));
    let avBlob = null, avPreview = null;
    root().innerHTML = `
      <div class="dash-head"><div><span class="eyebrow">ROAR Community</span><h1>${editing ? 'Edit your profile' : 'Create your profile'}</h1></div>
        ${editing ? '<a class="btn btn-glass small" href="#community/u/' + esc(p.username) + '">Back to profile</a>' : ''}</div>
      ${editing ? '' : '<p class="lead" style="margin-top:-8px">Your profile is how other residents and young consultants find you. Only signed-in ROAR accounts can see it.</p>'}
      <form class="panel glass pform cm-setup" id="cm-prof" novalidate>
        <div class="cm-av-edit">
          <div id="cm-av-prev">${avatar(p, 'xl')}</div>
          <div>
            <label class="btn btn-glass small" for="cm-av-file" style="cursor:pointer">${p.avatar_path ? 'Change picture' : 'Upload a picture'}</label>
            <input type="file" id="cm-av-file" accept="image/jpeg,image/png,image/webp" hidden>
            ${p.avatar_path ? '<button type="button" class="linklike" id="cm-av-rm">Remove picture</button>' : ''}
            <p class="muted" style="font-size:.84rem;margin:8px 0 0">A clear photo of you. We crop it to a square and remove location data from the file.</p>
          </div>
        </div>
        <div class="row">
          <div><label for="cm-name">Display name</label><input id="cm-name" required minlength="2" maxlength="80" value="${esc(p.display_name || sess.name || '')}" placeholder="Dr. Your Name"></div>
          <div><label for="cm-user">Username</label><div class="cm-at"><span>@</span><input id="cm-user" required pattern="[a-z0-9._]{3,30}" maxlength="30" value="${esc(p.username || suggest)}" autocapitalize="none" spellcheck="false"></div>
            <small class="muted" id="cm-user-msg">3–30 characters: lowercase letters, numbers, dots and underscores.</small></div>
        </div>
        <div class="row">
          <div><label for="cm-stage">Stage of training</label><input id="cm-stage" maxlength="80" value="${esc(p.stage || '')}" placeholder="e.g. MD resident, year 2"></div>
          <div><label for="cm-inst">Institution</label><input id="cm-inst" maxlength="200" value="${esc(p.institution || '')}" placeholder="Optional"></div>
        </div>
        <div class="row one"><div><label for="cm-bio">About you</label><textarea id="cm-bio" maxlength="500" rows="3" placeholder="Interests, sites you treat, what you'd like to learn or share.">${esc(p.bio || '')}</textarea></div></div>
        <button class="btn btn-primary" type="submit">${editing ? 'Save profile' : 'Create profile'}</button>
        <p class="msg" id="cm-msg" role="status"></p>
      </form>`;
    const msg = (t, k) => { const m = $('#cm-msg'); m.textContent = t; m.className = 'msg ' + (k || ''); };
    const userIn = $('#cm-user');
    userIn.addEventListener('input', () => { userIn.value = userIn.value.toLowerCase().replace(/[^a-z0-9._]/g, ''); });
    $('#cm-av-file').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        avBlob = await shrink(f, 480, true, 0.86);
        if (avPreview) URL.revokeObjectURL(avPreview);
        avPreview = URL.createObjectURL(avBlob);
        $('#cm-av-prev').innerHTML = `<span class="cm-av xl"><img alt="" src="${avPreview}"></span>`;
      } catch (err) { msg(err.message, 'err'); }
    });
    const rm = $('#cm-av-rm');
    if (rm) rm.addEventListener('click', () => { avBlob = 'remove'; $('#cm-av-prev').innerHTML = avatar({ display_name: $('#cm-name').value }, 'xl'); rm.remove(); });
    $('#cm-prof').addEventListener('submit', async e => {
      e.preventDefault();
      if (!e.target.reportValidity()) return;
      const username = userIn.value.trim();
      if (!USERNAME_RE.test(username)) return msg('Usernames use 3–30 lowercase letters, numbers, dots or underscores.', 'err');
      try {
        msg('Saving…');
        if (await D.usernameTaken(username)) return msg(`@${username} is taken. Try another.`, 'err');
        me = await D.saveProfile({ username, display_name: $('#cm-name').value.trim(), stage: $('#cm-stage').value.trim() || null, institution: $('#cm-inst').value.trim() || null, bio: $('#cm-bio').value.trim() || null }, avBlob);
        ctx.toast(editing ? 'Profile saved' : 'Welcome to ROAR Community');
        go(editing ? '#community/u/' + me.username : '#community');
      } catch (err) { msg(/duplicate|unique/i.test(err.message) ? `@${username} is taken. Try another.` : err.message, 'err'); }
    });
    hydrate();
  }

  // ------------------------------------------------------------------ feed
  async function feedView() {
    root().innerHTML = `
      <div class="dash-head"><div><span class="eyebrow">Members' area</span><h1>Community</h1></div></div>
      <div class="cm-layout">
        <div class="cm-main">
          ${composerHtml()}
          <div class="cm-chips" role="toolbar" aria-label="Show">${[['all', 'Everything'], ...KINDS.slice(0, 4).map(([k, l]) => [k, l === 'Case discussion' ? 'Cases' : l + 's'])].map(([k, l]) => `<button type="button" data-k="${k}" class="${filter === k ? 'on' : ''}" aria-pressed="${filter === k}">${l}</button>`).join('')}</div>
          <div id="cm-feed"><div class="card empty-state">Loading…</div></div>
          <div id="cm-more"></div>
        </div>
        <aside class="cm-side">
          <a class="panel glass cm-me" href="#community/u/${esc(me.username)}">${avatar(me, 'lg')}<div><b>${esc(me.display_name)}</b><span class="muted">@${esc(me.username)}</span></div></a>
          <div class="panel glass"><h2>Community guidelines</h2>
            <ul class="promise">
              <li><b>Protect patients.</b> No names, faces, hospital numbers, dates of birth or anything else that could identify a patient, in text or pictures.</li>
              <li><b>Respect everyone.</b> Disagree with ideas, never with people. Seniors, peers and other specialties included.</li>
              <li><b>Cite sources.</b> Link the trial, guideline or paper you're quoting.</li>
              <li><b>No advertising.</b> Courses and products need the Founders' Council's approval.</li>
            </ul>
            <p class="muted" style="font-size:.84rem;margin:10px 0 0">Posts are visible only to signed-in ROAR accounts. The Founders' Council reviews reports.</p>
          </div>
        </aside>
      </div>`;
    wireComposer();
    root().querySelectorAll('.cm-chips button').forEach(b => b.addEventListener('click', () => { filter = b.dataset.k; feedView(); }));
    hydrate(root().querySelector('.cm-side'));
    await loadFeed();
  }

  async function loadFeed(before) {
    const box = $('#cm-feed'), more = $('#cm-more');
    const posts = await D.feed({ kind: filter, before });
    const b = await D.badges([...new Set(posts.map(p => p.author_id))]);
    if (!before) box.innerHTML = '';
    if (!posts.length && !before) box.innerHTML = `<div class="panel glass cm-empty"><h2>${filter === 'all' ? 'No posts yet' : 'Nothing here yet'}</h2><p class="muted" style="margin:0">Be the first to ${filter === 'question' ? 'ask a question' : 'share something'}.</p></div>`;
    const frag = document.createElement('div');
    frag.innerHTML = posts.map(p => postHtml(p, b[p.author_id], true)).join('');
    const nodes = [...frag.children];
    nodes.forEach(n => box.appendChild(n));
    nodes.forEach(n => wirePost(n, posts.find(p => p.id === n.dataset.id), b));
    hydrate(box);
    more.innerHTML = posts.length === PAGE ? '<button class="btn btn-glass wide" id="cm-load">Show older posts</button>' : '';
    const lb = $('#cm-load'); if (lb) lb.addEventListener('click', () => { lb.disabled = true; loadFeed(posts[posts.length - 1].created_at).catch(ctx.fail); });
  }

  // ------------------------------------------------------------------ composer
  function composerHtml() {
    return `<form class="panel glass cm-compose" id="cm-new" novalidate>
      <div class="cm-compose-top">${avatar(me)}<button type="button" class="cm-start" id="cm-open">Ask a question or share something…</button></div>
      <div class="cm-compose-body" hidden>
        <div class="cm-kinds" role="radiogroup" aria-label="Type of post">${KINDS.map(([k, l], i) => `<label><input type="radio" name="cm-kind" value="${k}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <input id="cm-title" maxlength="200" placeholder="Title (optional)" aria-label="Title">
        <textarea id="cm-body" rows="5" maxlength="10000" placeholder="What's your question? Include the site, stage and what you've considered." aria-label="Post"></textarea>
        <div class="cm-thumbs" id="cm-thumbs"></div>
        <input id="cm-link" type="url" placeholder="Link to a paper, guideline or article (optional)" aria-label="Link">
        <label class="cm-consent" id="cm-consent" hidden><input type="checkbox" id="cm-ok"><span>I confirm nothing in this post or its pictures can identify a patient: no names, faces, hospital or ID numbers, dates of birth, or burned-in scan details.</span></label>
        <div class="cm-compose-actions">
          <label class="btn btn-glass small" for="cm-files" style="cursor:pointer">Add photos</label>
          <input type="file" id="cm-files" accept="image/jpeg,image/png,image/webp" multiple hidden>
          <span class="muted" style="font-size:.84rem">Up to 4</span>
          <span class="spacer"></span>
          <button type="button" class="btn btn-glass small" id="cm-cancel">Cancel</button>
          <button class="btn btn-primary small" type="submit">Post</button>
        </div>
        <p class="msg" id="cm-pmsg" role="status"></p>
      </div>
    </form>`;
  }
  function wireComposer() {
    const form = $('#cm-new'), body = form.querySelector('.cm-compose-body');
    const blobs = [];
    const msg = (t, k) => { const m = $('#cm-pmsg'); m.textContent = t; m.className = 'msg ' + (k || ''); };
    const kind = () => (form.querySelector('[name="cm-kind"]:checked') || {}).value || 'general';
    const syncConsent = () => { $('#cm-consent').hidden = !(blobs.length || kind() === 'case'); };
    const PH = { question: "What's your question? Include the site, stage and what you've considered.", article: 'Share an article or paper and why it matters.', case: 'Describe the case without anything that could identify the patient.', news: 'What happened, and where can members read more?', general: 'Share something with the community.' };
    const drawThumbs = () => {
      $('#cm-thumbs').innerHTML = blobs.map((b, i) => `<span class="cm-thumb"><img alt="" src="${b.url}"><button type="button" data-i="${i}" aria-label="Remove photo ${i + 1}">×</button></span>`).join('');
      $('#cm-thumbs').querySelectorAll('button').forEach(x => x.addEventListener('click', () => { URL.revokeObjectURL(blobs[x.dataset.i].url); blobs.splice(+x.dataset.i, 1); drawThumbs(); syncConsent(); }));
    };
    $('#cm-open').addEventListener('click', () => { body.hidden = false; $('#cm-open').hidden = true; $('#cm-body').focus(); });
    $('#cm-cancel').addEventListener('click', () => { body.hidden = true; $('#cm-open').hidden = false; });
    form.querySelectorAll('[name="cm-kind"]').forEach(r => r.addEventListener('change', () => { $('#cm-body').placeholder = PH[kind()]; syncConsent(); }));
    $('#cm-files').addEventListener('change', async e => {
      const files = [...e.target.files]; e.target.value = '';
      for (const f of files) {
        if (blobs.length >= 4) { msg('You can add up to 4 photos.', 'err'); break; }
        try { const b = await shrink(f, ctx.LIVE ? 1600 : 900, false, ctx.LIVE ? 0.85 : 0.72); b.url = URL.createObjectURL(b); blobs.push(b); } catch (err) { msg(err.message, 'err'); }
      }
      drawThumbs(); syncConsent();
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = $('#cm-body').value.trim(), title = $('#cm-title').value.trim(), link = $('#cm-link').value.trim();
      if (!text) return msg('Write something first.', 'err');
      if (link && !/^https?:\/\//i.test(link)) return msg('Links start with http:// or https://', 'err');
      if (kind() === 'article' && !title && !link) return msg('Give the article a title or a link.', 'err');
      if (!$('#cm-consent').hidden && !$('#cm-ok').checked) return msg('Please confirm that no patient can be identified.', 'err');
      const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
      try {
        msg(blobs.length ? 'Uploading photos…' : 'Posting…');
        await D.createPost({ kind: kind(), title: title || null, body: text, link_url: link || null }, blobs);
        blobs.forEach(b => URL.revokeObjectURL(b.url));
        ctx.toast('Posted');
        filter = 'all'; feedView();
      } catch (err) { msg(err.message, 'err'); btn.disabled = false; }
    });
  }

  // ------------------------------------------------------------------ a post
  function postHtml(p, b, inFeed) {
    const a = p.author || { display_name: 'Former member', username: '' };
    const long = inFeed && p.body.length > 700;
    const body = long ? p.body.slice(0, 600).replace(/\s+\S*$/, '') + '…' : p.body;
    const imgs = p.image_paths || [];
    const own = p.author_id === myId;
    return `<article class="panel glass cm-post${p.hidden ? ' is-hidden' : ''}" data-id="${esc(p.id)}">
      ${p.hidden ? `<div class="notice warn" style="margin:0 0 12px">Hidden by the Founders' Council${p.hidden_reason ? ': ' + esc(p.hidden_reason) : ''}. Only you${own ? '' : ', the author'} and the founders can see it.</div>` : ''}
      <header class="cm-ph">
        <div class="cm-who"><a href="#community/u/${esc(a.username)}" tabindex="-1" aria-hidden="true">${avatar(a)}</a><span><a href="#community/u/${esc(a.username)}" class="cm-cname"><b>${esc(a.display_name)}</b></a>${badges(b)}<small class="muted">@${esc(a.username)} · <a href="#community/p/${esc(p.id)}" class="cm-time" title="${esc(ctx.fmtTime(p.created_at))}">${ago(p.created_at)}</a>${p.edited_at ? ' · edited' : ''}</small></span></div>
        <span class="tag${p.kind === 'question' ? '' : ' tag-quiet'}">${esc(KIND[p.kind] || p.kind)}</span>
      </header>
      ${p.title ? `<h3 class="cm-title">${inFeed ? `<a href="#community/p/${esc(p.id)}">${esc(p.title)}</a>` : esc(p.title)}</h3>` : ''}
      <div class="cm-body">${richText(body)}${long ? ` <a href="#community/p/${esc(p.id)}" class="more">Read more</a>` : ''}</div>
      ${imgs.length ? `<div class="cm-shots n${Math.min(imgs.length, 4)}">${imgs.map((src, i) => `<button type="button" class="cm-shot" data-i="${i}" aria-label="Open photo ${i + 1}"><img alt="" loading="lazy" data-path="${esc(src)}"></button>`).join('')}</div>` : ''}
      ${safeUrl(p.link_url) ? `<a class="cm-link" href="${safeUrl(p.link_url)}" target="_blank" rel="noopener nofollow ugc">${esc(p.link_url.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 80))} ↗</a>` : ''}
      <footer class="cm-pf">
        <button type="button" class="cm-act cm-like${p.liked ? ' on' : ''}" aria-pressed="${p.liked}"><span aria-hidden="true">${p.liked ? '♥' : '♡'}</span> <span class="n">${p.nlikes || ''}</span><span class="sr-only">likes</span></button>
        <a class="cm-act" href="#community/p/${esc(p.id)}"><span aria-hidden="true">💬</span> ${p.ncomments || ''}<span class="sr-only">${p.ncomments === 1 ? 'comment' : 'comments'}</span>${p.kind === 'question' && !p.ncomments ? ' Answer' : ''}</a>
        <span class="spacer"></span>
        ${ctx.isFounder ? `<button type="button" class="linklike cm-hide">${p.hidden ? 'Unhide' : 'Hide'}</button>` : ''}
        ${own || ctx.isFounder ? '<button type="button" class="linklike cm-del">Delete</button>' : ''}
        ${!own ? '<button type="button" class="linklike cm-rep">Report</button>' : ''}
      </footer>
    </article>`;
  }

  function wirePost(el, p, b, onGone) {
    if (!el || !p) return;
    const like = el.querySelector('.cm-like');
    like.addEventListener('click', async () => {
      const on = !p.liked; p.liked = on; p.nlikes = (p.nlikes || 0) + (on ? 1 : -1);
      like.classList.toggle('on', on); like.setAttribute('aria-pressed', on);
      like.querySelector('[aria-hidden]').textContent = on ? '♥' : '♡'; like.querySelector('.n').textContent = p.nlikes || '';
      try { await D.like(p, on); } catch (e) { ctx.fail(e); }
    });
    el.querySelectorAll('.cm-shot').forEach(s => s.addEventListener('click', () => lightbox(el, +s.dataset.i)));
    const del = el.querySelector('.cm-del');
    if (del) del.addEventListener('click', async () => {
      if (!confirm(p.author_id === myId ? 'Delete this post? This cannot be undone.' : 'Delete this member\'s post permanently? Hiding it is usually enough.')) return;
      try { await D.deletePost(p); ctx.toast('Post deleted'); onGone ? onGone() : el.remove(); } catch (e) { ctx.fail(e); }
    });
    const hide = el.querySelector('.cm-hide');
    if (hide) hide.addEventListener('click', async () => {
      let reason = null;
      if (!p.hidden) { reason = prompt('Reason shown to the author (optional):', 'Under review'); if (reason === null) return; }
      try { await D.setHidden('posts', p.id, !p.hidden, reason); ctx.toast(p.hidden ? 'Post visible again' : 'Post hidden'); ctx.rerender(); } catch (e) { ctx.fail(e); }
    });
    const rep = el.querySelector('.cm-rep');
    if (rep) rep.addEventListener('click', () => reportDialog({ post_id: p.id }));
  }

  function lightbox(el, i) {
    const imgs = [...el.querySelectorAll('.cm-shot img')].map(x => x.src).filter(Boolean);
    if (!imgs.length) return;
    let k = Math.min(i, imgs.length - 1);
    const d = document.createElement('dialog'); d.className = 'cm-lightbox';
    const draw = () => { d.innerHTML = `<img alt="Photo ${k + 1} of ${imgs.length}" src="${imgs[k]}">${imgs.length > 1 ? `<button class="cm-lb prev" aria-label="Previous">‹</button><button class="cm-lb next" aria-label="Next">›</button>` : ''}<button class="cm-lb close" aria-label="Close">×</button>`;
      d.querySelector('.close').onclick = () => d.close();
      if (imgs.length > 1) { d.querySelector('.prev').onclick = () => { k = (k + imgs.length - 1) % imgs.length; draw(); }; d.querySelector('.next').onclick = () => { k = (k + 1) % imgs.length; draw(); }; } };
    draw();
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    d.addEventListener('keydown', e => { if (imgs.length > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { k = (k + (e.key === 'ArrowRight' ? 1 : imgs.length - 1)) % imgs.length; draw(); } });
    d.addEventListener('close', () => d.remove());
    document.body.appendChild(d); d.showModal();
  }

  function reportDialog(target) {
    const d = document.createElement('dialog'); d.className = 'cm-dialog';
    d.innerHTML = `<form method="dialog" class="pform">
      <h2>Report ${target.comment_id ? 'this comment' : 'this post'}</h2>
      <p class="muted" style="margin:-6px 0 14px;font-size:.9rem">Only the Founders' Council sees reports. The author isn't told who reported.</p>
      <div class="cm-reasons">${REASONS.map((r, i) => `<label><input type="radio" name="r" value="${esc(r)}"${i === 0 ? ' checked' : ''}> ${esc(r)}</label>`).join('')}</div>
      <label for="cm-rdet" style="margin-top:12px">Anything else? (optional)</label>
      <textarea id="cm-rdet" rows="3" maxlength="1000"></textarea>
      <div class="cm-compose-actions" style="margin-top:16px"><span class="spacer"></span><button value="cancel" class="btn btn-glass small" formnovalidate>Cancel</button><button value="send" class="btn btn-primary small">Send report</button></div>
    </form>`;
    d.addEventListener('close', async () => {
      if (d.returnValue === 'send') {
        try { await D.report({ ...target, reason: d.querySelector('[name="r"]:checked').value, details: d.querySelector('#cm-rdet').value.trim() || null }); ctx.toast('Thanks. The Founders\' Council will review it.'); } catch (e) { ctx.fail(e); }
      }
      d.remove();
    });
    document.body.appendChild(d); d.showModal();
  }

  // ------------------------------------------------------------------ post page with comments
  async function postView(id) {
    const p = await D.post(id);
    if (!p) { root().innerHTML = `<div class="panel glass cm-empty"><h2>Post not found</h2><p class="muted">It may have been deleted.</p><a class="btn btn-glass small" href="#community">Back to Community</a></div>`; return; }
    const cs = await D.comments(id);
    const b = await D.badges([...new Set([p.author_id, ...cs.map(c => c.author_id)])]);
    root().innerHTML = `
      <p style="margin:0 0 14px"><a class="more" href="#community">← Community</a></p>
      <div class="cm-layout single">
        <div class="cm-main">
          ${postHtml(p, b[p.author_id], false)}
          <section class="panel glass" aria-labelledby="cm-ch"><h2 id="cm-ch">${p.kind === 'question' ? 'Answers' : 'Comments'}${cs.length ? ' · ' + cs.length : ''}</h2>
            <div id="cm-comments">${cs.length ? cs.map(c => commentHtml(c, b[c.author_id])).join('') : `<p class="muted" style="margin:0 0 12px">${p.kind === 'question' ? 'No answers yet. Share what you know.' : 'No comments yet.'}</p>`}</div>
            ${p.hidden ? '' : `<form id="cm-cform" class="cm-cform">${avatar(me)}<textarea id="cm-ctext" rows="2" maxlength="3000" placeholder="${p.kind === 'question' ? 'Write an answer…' : 'Write a comment…'}" aria-label="Comment" required></textarea><button class="btn btn-primary small" type="submit">Send</button></form>`}
          </section>
        </div>
      </div>`;
    wirePost(root().querySelector('.cm-post'), p, b, () => go('#community'));
    const f = $('#cm-cform');
    if (f) f.addEventListener('submit', async e => {
      e.preventDefault();
      const t = $('#cm-ctext').value.trim(); if (!t) return;
      f.querySelector('button').disabled = true;
      try { await D.addComment(id, t); postView(id); } catch (err) { ctx.fail(err); f.querySelector('button').disabled = false; }
    });
    root().querySelectorAll('.cm-comment').forEach(el => {
      const c = cs.find(x => x.id === el.dataset.id);
      const del = el.querySelector('.cm-cdel'); if (del) del.addEventListener('click', async () => { if (!confirm('Delete this comment?')) return; try { await D.deleteComment(c); postView(id); } catch (e) { ctx.fail(e); } });
      const hide = el.querySelector('.cm-chide'); if (hide) hide.addEventListener('click', async () => { try { await D.setHidden('comments', c.id, !c.hidden); postView(id); } catch (e) { ctx.fail(e); } });
      const rep = el.querySelector('.cm-crep'); if (rep) rep.addEventListener('click', () => reportDialog({ comment_id: c.id, post_id: id }));
    });
    hydrate();
  }
  function commentHtml(c, b) {
    const a = c.author || { display_name: 'Former member', username: '' };
    const own = c.author_id === myId;
    return `<div class="cm-comment${c.hidden ? ' is-hidden' : ''}" data-id="${esc(c.id)}">
      <a href="#community/u/${esc(a.username)}">${avatar(a, 'sm')}</a>
      <div class="cm-cbody">
        <div><a href="#community/u/${esc(a.username)}" class="cm-cname"><b>${esc(a.display_name)}</b></a>${badges(b)}<small class="muted"> · ${ago(c.created_at)}</small>${c.hidden ? ' <span class="tag tag-quiet">Hidden</span>' : ''}</div>
        <div class="cm-body">${richText(c.body)}</div>
        <div class="cm-cacts">${ctx.isFounder ? `<button type="button" class="linklike cm-chide">${c.hidden ? 'Unhide' : 'Hide'}</button>` : ''}${own || ctx.isFounder ? '<button type="button" class="linklike cm-cdel">Delete</button>' : ''}${!own ? '<button type="button" class="linklike cm-crep">Report</button>' : ''}</div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ profile page
  async function profileView(username) {
    const p = await D.profile(username);
    if (!p) { root().innerHTML = `<div class="panel glass cm-empty"><h2>@${esc(username)} isn't on ROAR Community</h2><a class="btn btn-glass small" href="#community">Back to Community</a></div>`; return; }
    const [posts, b] = await Promise.all([D.feed({ author: p.id }), D.badges([p.id])]);
    const self = p.id === myId;
    root().innerHTML = `
      <p style="margin:0 0 14px"><a class="more" href="#community">← Community</a></p>
      <section class="panel glass cm-profile">
        ${avatar(p, 'xxl')}
        <div class="cm-pinfo">
          <div class="cm-pname"><h1>${esc(p.display_name)}</h1>${badges(b[p.id])}</div>
          <div class="muted">@${esc(p.username)}</div>
          ${p.stage || p.institution ? `<div class="cm-pmeta">${[p.stage, p.institution].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
          ${p.bio ? `<p class="cm-bio">${richText(p.bio)}</p>` : ''}
          <div class="cm-stats"><span><b>${posts.length}${posts.length === PAGE ? '+' : ''}</b> ${posts.length === 1 ? 'post' : 'posts'}</span><span>Joined ${esc(new Date(p.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }))}</span></div>
          ${self ? '<a class="btn btn-glass small" href="#community/edit">Edit profile</a>' : ''}
        </div>
      </section>
      ${posts.length ? `<div class="cm-grid">${posts.map(x => tileHtml(x)).join('')}</div>` : `<div class="panel glass cm-empty"><p class="muted" style="margin:0">${self ? "You haven't posted yet." : 'No posts yet.'}</p>${self ? '<a class="btn btn-primary small" href="#community" style="margin-top:12px">Write your first post</a>' : ''}</div>`}`;
    hydrate();
  }
  function tileHtml(p) {
    const imgs = p.image_paths || [];
    const label = esc((p.title || p.body).slice(0, 140));
    return `<a class="cm-tile${imgs.length ? ' pic' : ''}${p.hidden ? ' is-hidden' : ''}" href="#community/p/${esc(p.id)}" aria-label="${esc(KIND[p.kind] || 'Post')}: ${label}">
      ${imgs.length ? `<img alt="" loading="lazy" data-path="${esc(imgs[0])}">${imgs.length > 1 ? '<span class="cm-multi" aria-hidden="true">❐</span>' : ''}` : `<span class="cm-tkind">${esc(KIND[p.kind] || '')}</span><span class="cm-ttext">${label}</span>`}
      <span class="cm-tover" aria-hidden="true">♥ ${p.nlikes || 0} · 💬 ${p.ncomments || 0}</span>
    </a>`;
  }

  window.ROAR_COMMUNITY = { view };
})();
