// ROAR Community: the members' social space inside the portal.
//   Instagram: 24-hour stories, photo carousels, double-tap to like, saved posts, profile grid, explore.
//   Reddit:    topic communities, threaded replies, up/down votes on answers, accepted answers, pinned posts.
//   Twitter:   follow, quote posts, polls, #hashtags, @mentions, trending, notifications.
// Live mode uses Supabase (schema.sql PARTs 11-12, private 'community' bucket). Demo mode keeps everything
// in this browser. portal.js calls ROAR_COMMUNITY.view(ctx, route) for #community routes:
//   #community  #community/explore  #community/notifications  #community/saved  #community/edit
//   #community/p/<id>  #community/u/<username>  #community/t/<topic>  #community/tag/<hashtag>
(() => {
  'use strict';
  const KINDS = [['question', 'Question'], ['article', 'Article'], ['case', 'Case discussion'], ['news', 'News'], ['general', 'General']];
  const KIND = Object.fromEntries(KINDS);
  const TOPICS = [
    ['general', 'General', 210, 'Anything about life and work in radiation oncology'],
    ['headneck', 'Head & Neck', 12, 'Oral cavity, oropharynx, larynx, nasopharynx, salivary and thyroid'],
    ['breast', 'Breast', 330, 'Whole breast, partial breast, nodal and post-mastectomy RT'],
    ['cns', 'CNS', 265, 'Gliomas, metastases, meningiomas and benign tumours'],
    ['thoracic', 'Thoracic', 195, 'Lung, oesophagus, thymus and mesothelioma'],
    ['gi', 'GI', 28, 'Rectum, anal canal, pancreas, liver and stomach'],
    ['gu', 'GU', 175, 'Prostate, bladder, kidney and testis'],
    ['gynae', 'Gynae', 300, 'Cervix, endometrium, vulva and vagina'],
    ['heme', 'Lymphoma & Haem', 350, 'Lymphoma, myeloma, TBI and TMLI'],
    ['paeds', 'Paediatrics', 45, 'Paediatric tumours, sedation and late effects'],
    ['palliative', 'Palliative', 145, 'Bone and brain metastases, SVCO, bleeding and pain'],
    ['sbrt', 'SBRT & SRS', 225, 'Stereotactic radiosurgery and body radiotherapy'],
    ['brachy', 'Brachytherapy', 15, 'Intracavitary, interstitial and intraluminal brachy'],
    ['physics', 'Physics & Planning', 240, 'Planning, QA, imaging, IGRT and dosimetry'],
    ['contouring', 'Contouring', 160, 'Target and organ-at-risk delineation'],
    ['exams', 'Exams & Training', 50, 'MD/DNB exams, viva, curriculum and logbooks'],
    ['careers', 'Careers', 100, 'Jobs, fellowships, observerships and contracts'],
    ['research', 'Research', 280, 'Theses, trials, statistics and publishing'],
    ['wellbeing', 'Wellbeing', 125, 'Burnout, balance and looking after each other'],
  ];
  const TOPIC = Object.fromEntries(TOPICS.map(t => [t[0], t]));
  const REASONS = ['Patient privacy', 'Harassment or disrespect', 'Misinformation', 'Spam or advertising', 'Other'];
  const PAGE = 15;
  const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
  const TAG_RE = /(^|[^A-Za-z0-9_&/])#([A-Za-z][A-Za-z0-9_]{1,39})/g;
  const MENTION_RE = /(^|[^A-Za-z0-9_.])@([A-Za-z0-9._]{3,30})/g;

  let ctx, D, me = null, myId = null;
  const cache = { badges: {}, following: new Set(), storyAuthors: new Set(), posts: new Map() };
  const state = { home: pref('home', 'foryou'), topicSort: 'hot', profileTab: 'grid', q: '', commentSort: 'best' };
  const esc = v => ctx.esc(v);
  const root = () => ctx.root;
  const $ = s => ctx.root.querySelector(s);
  function pref(k, d) { try { return localStorage.getItem('roar-cm-' + k) || d; } catch (e) { return d; } }
  function setPref(k, v) { try { localStorage.setItem('roar-cm-' + k, v); } catch (e) { } }

  // ------------------------------------------------------------------ icons
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    explore: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    heart: '<path d="M12 20.5s-7.5-4.6-9.6-9.4A5.2 5.2 0 0 1 12 6.3a5.2 5.2 0 0 1 9.6 4.8c-2.1 4.8-9.6 9.4-9.6 9.4z"/>',
    comment: '<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.8A8.5 8.5 0 1 1 21 11.5z"/>',
    quote: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    share: '<path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/><path d="M12 3v12M7 8l5-5 5 5"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    poll: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    up: '<path d="M12 4l7 9h-4.5v7h-5v-7H5z"/>',
    down: '<path d="M12 20l7-9h-4.5V4h-5v7H5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    pin: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    hash: '<path d="M5 9h14M4 15h14M10 3L8 21M16 3l-2 18"/>',
    flame: '<path d="M12 22a7 7 0 0 0 7-7c0-4.5-3.5-6.5-4.5-11-2 2-3.5 4.5-3.5 7-1-.8-2-2-2.2-3.8C6.6 9.4 5 12 5 15a7 7 0 0 0 7 7z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c2 .7 3.2 2.5 3.6 5.3"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chevl: '<path d="M15 5l-7 7 7 7"/>',
    chevr: '<path d="M9 5l7 7-7 7"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  };
  const ic = (n, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

  // ------------------------------------------------------------------ helpers
  const now = () => new Date().toISOString();
  const daysAgo = d => new Date(Date.now() - d * 864e5).toISOString();
  const ago = v => {
    const s = (Date.now() - new Date(v).getTime()) / 1000;
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 7 * 86400) return Math.floor(s / 86400) + 'd';
    const d = new Date(v);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric', timeZone: 'Asia/Kolkata' });
  };
  const left = v => { const s = (new Date(v).getTime() - Date.now()) / 1000; if (s <= 0) return 'Final results'; if (s < 3600) return Math.ceil(s / 60) + ' minutes left'; if (s < 86400) return Math.ceil(s / 3600) + ' hours left'; return Math.ceil(s / 86400) + ' days left'; };
  const num = n => n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n || 0);
  const plural = (n, w) => `${num(n)} ${w}${n === 1 ? '' : 's'}`;
  const extractTags = t => [...new Set([...String(t || '').matchAll(TAG_RE)].map(m => m[2].toLowerCase()))].slice(0, 20);
  const extractMentions = t => [...new Set([...String(t || '').matchAll(MENTION_RE)].map(m => m[2].toLowerCase().replace(/\.+$/, '')))].slice(0, 10);
  const TOKEN_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|((?<=^|[^A-Za-z0-9_&/])#[A-Za-z][A-Za-z0-9_]{1,39})|((?<=^|[^A-Za-z0-9_.])@[A-Za-z0-9._]{3,30})/g;
  function richText(t) {
    const s = String(t || ''); let out = '', i = 0;
    for (const m of s.matchAll(TOKEN_RE)) {
      out += esc(s.slice(i, m.index)); i = m.index + m[0].length;
      if (m[1]) out += `<a href="${esc(m[1])}" target="_blank" rel="noopener nofollow ugc">${esc(m[1].replace(/^https?:\/\/(www\.)?/, '').slice(0, 60))}${m[1].length > 70 ? '…' : ''}</a>`;
      else if (m[2]) out += `<a class="cx-tag" href="#community/tag/${esc(m[2].slice(1).toLowerCase())}">${esc(m[2])}</a>`;
      else { const u = m[3].slice(1).replace(/\.+$/, ''); const dots = m[3].slice(1 + u.length); out += `<a class="cx-mention" href="#community/u/${esc(u.toLowerCase())}">@${esc(u)}</a>${esc(dots)}`; }
    }
    return (out + esc(s.slice(i))).replace(/\n/g, '<br>');
  }
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? esc(u) : '';
  const initials = n => String(n || '?').replace(/^dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/^dr\.?\s+/, '').replace(/[^a-z0-9._]+/g, '.').replace(/^[._]+|[._]+$/g, '').replace(/\.{2,}/g, '.').slice(0, 30);
  const go = h => { if (location.hash === h) ctx.rerender(); else location.hash = h; };
  const postUrl = id => location.origin + location.pathname + '#community/p/' + id;
  const topicChip = k => { const t = TOPIC[k] || TOPIC.general; return `<a class="cx-topic" href="#community/t/${t[0]}" style="--h:${t[2]}">${esc(t[1])}</a>`; };
  const seen = { get() { try { return new Set(JSON.parse(localStorage.getItem('roar-cm-seen') || '[]')); } catch (e) { return new Set(); } },
    add(ids) { const s = this.get(); ids.forEach(i => s.add(i)); try { localStorage.setItem('roar-cm-seen', JSON.stringify([...s].slice(-400))); } catch (e) { } } };

  function avatar(p, size, opts) {
    const cls = `cm-av${size ? ' ' + size : ''}`;
    const inner = p && p.avatar_path ? `<img alt="" data-path="${esc(p.avatar_path)}">` : esc(initials(p && p.display_name));
    const ring = opts !== false && p && cache.storyAuthors.has(p.id);
    return ring ? `<span class="cx-ring"><span class="${cls}" aria-hidden="true">${inner}</span></span>` : `<span class="${cls}" aria-hidden="true">${inner}</span>`;
  }
  function badges(b) {
    if (!b) return '';
    return (b.founder ? `<span class="cm-badge f" title="Founders' Council">Founder${b.founder_id ? ' · ' + esc(b.founder_id) : ''}</span>` : '')
      + (b.member ? `<span class="cm-badge m" title="Approved ROAR member">${ic('check')}Member</span>` : '');
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
  const pickFiles = (multiple) => new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/jpeg,image/png,image/webp'; i.multiple = !!multiple;
    i.addEventListener('change', () => res([...i.files])); i.click();
  });

  // Fill in <img data-path> once the HTML is on the page (signed links for the private bucket)
  async function hydrate(scope) {
    const imgs = [...(scope || root()).querySelectorAll('img[data-path]:not([src])')];
    if (!imgs.length) return;
    try {
      const map = await D.urls([...new Set(imgs.map(i => i.dataset.path))]);
      imgs.forEach(i => { const u = map[i.dataset.path]; if (u) i.src = u; else if (i.closest('.cm-av')) i.remove(); });
    } catch (e) { console.warn(e); }
  }

  // ------------------------------------------------------------------ live data layer (Supabase)
  function liveLayer(sb) {
    const AUTHOR = 'id, username, display_name, avatar_path';
    const POST_SEL = `*, author:profiles!posts_author_id_fkey(${AUTHOR}), likes:post_likes(count), ncomments:comments!comments_post_id_fkey(count)`;
    const urlCache = new Map();
    const unwrap = ({ data, error }) => { if (error) throw error; return data; };
    const clean = s => String(s || '').replace(/[^\p{L}\p{N} ._-]/gu, ' ').trim().slice(0, 60);
    const upload = async (blob, prefix) => {
      const path = `${myId}/${prefix || ''}${ctx.uid()}.jpg`;
      unwrap(await sb.storage.from('community').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
      return path;
    };
    const removeFiles = async paths => { const own = paths.filter(p => p && p.startsWith(myId + '/')); if (own.length) await sb.storage.from('community').remove(own); };
    const shape = async rows => {
      if (!rows.length) return [];
      const ids = rows.map(r => r.id);
      const qids = [...new Set(rows.map(r => r.quote_of).filter(Boolean))];
      const [mine, saved, quotes, quoted] = await Promise.all([
        sb.from('post_likes').select('post_id').eq('user_id', myId).in('post_id', ids).then(unwrap),
        sb.from('bookmarks').select('post_id').eq('user_id', myId).in('post_id', ids).then(unwrap),
        sb.from('posts').select('quote_of').in('quote_of', ids).then(unwrap),
        qids.length ? sb.from('posts').select(`id, kind, topic, title, body, image_paths, created_at, author_id, author:profiles!posts_author_id_fkey(${AUTHOR})`).in('id', qids).then(unwrap) : [],
      ]);
      const liked = new Set(mine.map(r => r.post_id)), sv = new Set(saved.map(r => r.post_id));
      const qc = {}; quotes.forEach(q => { qc[q.quote_of] = (qc[q.quote_of] || 0) + 1; });
      const qm = Object.fromEntries(quoted.map(q => [q.id, q]));
      return rows.map(r => ({ ...r, nlikes: (r.likes && r.likes[0] && r.likes[0].count) || 0, ncomments: (r.ncomments && r.ncomments[0] && r.ncomments[0].count) || 0,
        nquotes: qc[r.id] || 0, liked: liked.has(r.id), saved: sv.has(r.id), quoted: r.quote_of ? qm[r.quote_of] || { missing: true } : null }));
    };
    return {
      async myProfile() { return unwrap(await sb.from('profiles').select('*').eq('id', myId).maybeSingle()); },
      async profile(u) { return unwrap(await sb.from('profiles').select('*').eq('username', u.toLowerCase()).maybeSingle()); },
      async usernameTaken(u) { const r = unwrap(await sb.from('profiles').select('id').eq('username', u).maybeSingle()); return !!(r && r.id !== myId); },
      async saveProfile(f, av) {
        const old = me && me.avatar_path;
        if (av === 'remove') f.avatar_path = null; else if (av) f.avatar_path = await upload(av, 'avatar-');
        f.updated_at = now();
        const row = me ? unwrap(await sb.from('profiles').update(f).eq('id', myId).select().single()) : unwrap(await sb.from('profiles').insert(f).select().single());
        if (old && av) removeFiles([old]).catch(() => { });
        return row;
      },
      async posts(o = {}) {
        let q = sb.from('posts').select(POST_SEL).order('created_at', { ascending: false }).limit(o.limit || PAGE);
        if (o.ids) q = q.in('id', o.ids);
        if (o.topic) q = q.eq('topic', o.topic);
        if (o.tag) q = q.contains('hashtags', [o.tag]);
        if (o.author) q = q.eq('author_id', o.author);
        if (o.authors) q = q.in('author_id', o.authors);
        if (o.since) q = q.gte('created_at', o.since);
        if (o.before) q = q.lt('created_at', o.before);
        if (o.pinned) q = q.eq('pinned', true);
        if (o.imagesOnly) q = q.neq('image_paths', '{}');
        if (o.search) { const s = clean(o.search); if (!s) return []; q = q.or(`body.ilike.%${s}%,title.ilike.%${s}%`); }
        return shape(unwrap(await q));
      },
      async count(o) {
        let q = sb.from('posts').select('id', { count: 'exact', head: true });
        if (o.topic) q = q.eq('topic', o.topic); if (o.tag) q = q.contains('hashtags', [o.tag]); if (o.author) q = q.eq('author_id', o.author);
        const { count, error } = await q; if (error) throw error; return count || 0;
      },
      async saved() { const rows = unwrap(await sb.from('bookmarks').select('post_id, created_at').eq('user_id', myId).order('created_at', { ascending: false }).limit(60)); return rows.length ? this.posts({ ids: rows.map(r => r.post_id), limit: 60 }) : []; },
      async createPost(f, blobs) {
        const paths = [];
        try { for (const b of blobs) paths.push(await upload(b)); } catch (e) { removeFiles(paths).catch(() => { }); throw e; }
        return unwrap(await sb.from('posts').insert({ ...f, image_paths: paths }).select('id').single());
      },
      async updatePost(id, patch) { unwrap(await sb.from('posts').update(patch).eq('id', id)); },
      async deletePost(p) { unwrap(await sb.from('posts').delete().eq('id', p.id)); removeFiles(p.image_paths || []).catch(() => { }); },
      async setHidden(table, id, hidden, reason) { unwrap(await sb.from(table).update(table === 'posts' ? { hidden, hidden_reason: hidden ? (reason || null) : null } : { hidden }).eq('id', id)); },
      async like(p, on) {
        if (on) { const { error } = await sb.from('post_likes').insert({ post_id: p.id }); if (error && error.code !== '23505') throw error; }
        else unwrap(await sb.from('post_likes').delete().eq('post_id', p.id).eq('user_id', myId));
      },
      async save(p, on) {
        if (on) { const { error } = await sb.from('bookmarks').insert({ post_id: p.id }); if (error && error.code !== '23505') throw error; }
        else unwrap(await sb.from('bookmarks').delete().eq('post_id', p.id).eq('user_id', myId));
      },
      async pollResults(ids) { return ids.length ? unwrap(await sb.rpc('post_poll_results', { p_posts: ids })) || {} : {}; },
      async votePoll(pid, option) { unwrap(await sb.from('poll_votes').insert({ post_id: pid, option })); },
      async comments(pid) {
        const rows = unwrap(await sb.from('comments').select(`*, author:profiles!comments_author_id_fkey(${AUTHOR}), votes:comment_votes(value, user_id)`).eq('post_id', pid).order('created_at'));
        return rows.map(c => ({ ...c, score: (c.votes || []).reduce((s, v) => s + v.value, 0), myVote: ((c.votes || []).find(v => v.user_id === myId) || {}).value || 0 }));
      },
      async addComment(pid, body, parent) { unwrap(await sb.from('comments').insert({ post_id: pid, body, parent_id: parent || null })); },
      async deleteComment(c) { unwrap(await sb.from('comments').delete().eq('id', c.id)); },
      async voteComment(c, v) {
        if (!v) unwrap(await sb.from('comment_votes').delete().eq('comment_id', c.id).eq('user_id', myId));
        else unwrap(await sb.from('comment_votes').upsert({ comment_id: c.id, user_id: myId, value: v }, { onConflict: 'comment_id,user_id' }));
      },
      async report(r) { unwrap(await sb.from('post_reports').insert(r)); },
      async badges(ids) { return ids.length ? unwrap(await sb.rpc('community_badges_for', { p_users: ids })) || {} : {}; },
      async followingIds() { return unwrap(await sb.from('follows').select('followee_id').eq('follower_id', myId)).map(r => r.followee_id); },
      async follow(id, on) {
        if (on) { const { error } = await sb.from('follows').insert({ followee_id: id }); if (error && error.code !== '23505') throw error; }
        else unwrap(await sb.from('follows').delete().eq('follower_id', myId).eq('followee_id', id));
      },
      async followCounts(id) {
        const [a, b] = await Promise.all([sb.from('follows').select('followee_id', { count: 'exact', head: true }).eq('followee_id', id), sb.from('follows').select('follower_id', { count: 'exact', head: true }).eq('follower_id', id)]);
        return { followers: a.count || 0, following: b.count || 0 };
      },
      async followList(id, which) {
        const rows = which === 'followers'
          ? unwrap(await sb.from('follows').select(`p:profiles!follows_follower_id_fkey(${AUTHOR}, stage)`).eq('followee_id', id).order('created_at', { ascending: false }).limit(200))
          : unwrap(await sb.from('follows').select(`p:profiles!follows_followee_id_fkey(${AUTHOR}, stage)`).eq('follower_id', id).order('created_at', { ascending: false }).limit(200));
        return rows.map(r => r.p).filter(Boolean);
      },
      async people(o = {}) {
        let q = sb.from('profiles').select(`${AUTHOR}, stage, institution`).order('created_at', { ascending: false }).limit(o.limit || 30);
        if (o.search) { const s = clean(o.search); if (!s) return []; q = q.or(`username.ilike.%${s}%,display_name.ilike.%${s}%,institution.ilike.%${s}%`); }
        return unwrap(await q);
      },
      async trending() { return unwrap(await sb.rpc('community_trending', { p_days: 14 })) || []; },
      async stories() { return unwrap(await sb.from('stories').select(`*, author:profiles!stories_author_id_fkey(${AUTHOR})`).gt('expires_at', now()).order('created_at')); },
      async addStory(blob, caption) { const path = await upload(blob, 'story-'); unwrap(await sb.from('stories').insert({ image_path: path, caption: caption || null })); },
      async deleteStory(s) { unwrap(await sb.from('stories').delete().eq('id', s.id)); removeFiles([s.image_path]).catch(() => { }); },
      async notifications() {
        return unwrap(await sb.from('notifications').select(`*, actor:profiles!notifications_actor_id_fkey(${AUTHOR}), post:posts!notifications_post_id_fkey(id, title, body, image_paths), comment:comments!notifications_comment_id_fkey(id, body)`)
          .order('created_at', { ascending: false }).limit(80));
      },
      async unread() { const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false); return count || 0; },
      async markRead() { unwrap(await sb.from('notifications').update({ read: true }).eq('read', false)); },
      async urls(paths) {
        const out = {}, need = [];
        paths.forEach(p => { const c = urlCache.get(p); if (c && c.exp > Date.now()) out[p] = c.url; else need.push(p); });
        if (need.length) {
          const rows = unwrap(await sb.storage.from('community').createSignedUrls(need, 3600));
          rows.forEach(r => { if (r.signedUrl) { out[r.path] = r.signedUrl; urlCache.set(r.path, { url: r.signedUrl, exp: Date.now() + 50 * 60000 }); } });
        }
        return out;
      },
    };
  }

  // ------------------------------------------------------------------ demo data layer (this browser only)
  function demoLayer() {
    const TABLES = ['profiles', 'posts', 'comments', 'likes', 'reports', 'follows', 'bookmarks', 'poll_votes', 'comment_votes', 'stories', 'notifications'];
    const S = () => { const s = ctx.Demo.s; s.community = s.community || {}; TABLES.forEach(k => { s.community[k] = s.community[k] || []; }); return s.community; };
    const save = () => { try { localStorage.setItem('roar-cm-probe', JSON.stringify(ctx.Demo.s)); localStorage.removeItem('roar-cm-probe'); } catch (e) { throw new Error('This browser is out of space for demo pictures. Delete a few demo posts or stories and try again.'); } ctx.Demo.save(); };
    const prof = id => S().profiles.find(p => p.id === id) || null;
    const author = id => { const a = prof(id); return a ? { id: a.id, username: a.username, display_name: a.display_name, avatar_path: a.avatar_path, stage: a.stage, institution: a.institution } : null; };
    const visible = p => !p.hidden || p.author_id === myId || ctx.isFounder;
    const notify = (user, actor, kind, post_id, comment_id) => {
      if (!user || user === actor || !prof(user)) return;
      const s = S();
      if (kind === 'like' || kind === 'follow') s.notifications = s.notifications.filter(n => !(n.user_id === user && n.actor_id === actor && n.kind === kind && (n.post_id || null) === (post_id || null)));
      s.notifications.push({ id: ctx.uid(), user_id: user, actor_id: actor, kind, post_id: post_id || null, comment_id: comment_id || null, read: false, created_at: now() });
    };
    const mentions = (text, actor, pid, cid) => extractMentions(text).forEach(u => { const p = S().profiles.find(x => x.username === u); if (p) notify(p.id, actor, 'mention', pid, cid); });
    const shape = p => {
      const s = S(); const q = p.quote_of ? s.posts.find(x => x.id === p.quote_of && visible(x)) : null;
      return { topic: 'general', hashtags: [], pinned: false, poll: null, quote_of: null, accepted_comment_id: null, ...p, author: author(p.author_id),
        nlikes: s.likes.filter(l => l.post_id === p.id).length,
        ncomments: s.comments.filter(c => c.post_id === p.id && (!c.hidden || c.author_id === myId || ctx.isFounder)).length,
        nquotes: s.posts.filter(x => x.quote_of === p.id && visible(x)).length,
        liked: s.likes.some(l => l.post_id === p.id && l.user_id === myId), saved: s.bookmarks.some(b => b.post_id === p.id && b.user_id === myId),
        quoted: p.quote_of ? (q ? { ...q, author: author(q.author_id) } : { missing: true }) : null };
    };
    seedDemo(S());
    return {
      async myProfile() { return prof(myId); },
      async profile(u) { return S().profiles.find(p => p.username === u.toLowerCase()) || null; },
      async usernameTaken(u) { return S().profiles.some(p => p.username === u && p.id !== myId); },
      async saveProfile(f, av) {
        if (av === 'remove') f.avatar_path = null; else if (av) f.avatar_path = await blobToDataUrl(av);
        let p = prof(myId);
        if (p) Object.assign(p, f, { updated_at: now() });
        else { p = { id: myId, created_at: now(), bio: null, institution: null, stage: null, avatar_path: null, ...f }; S().profiles.push(p); }
        save(); return { ...p };
      },
      async posts(o = {}) {
        const q = o.search ? o.search.toLowerCase() : null;
        return S().posts.filter(p => visible(p) && (!o.ids || o.ids.includes(p.id)) && (!o.topic || (p.topic || 'general') === o.topic) && (!o.tag || (p.hashtags || []).includes(o.tag))
          && (!o.author || p.author_id === o.author) && (!o.authors || o.authors.includes(p.author_id)) && (!o.since || p.created_at >= o.since) && (!o.before || p.created_at < o.before)
          && (!o.pinned || p.pinned) && (!o.imagesOnly || (p.image_paths || []).length) && (!q || (p.body + ' ' + (p.title || '')).toLowerCase().includes(q)))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, o.limit || PAGE).map(shape);
      },
      async count(o) { return (await this.posts({ ...o, limit: 1e6 })).length; },
      async saved() { const ids = S().bookmarks.filter(b => b.user_id === myId).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(b => b.post_id); return ids.length ? this.posts({ ids, limit: 60 }) : []; },
      async createPost(f, blobs) {
        const paths = []; for (const b of blobs) paths.push(await blobToDataUrl(b));
        const p = { id: ctx.uid(), author_id: myId, created_at: now(), edited_at: null, hidden: false, hidden_reason: null, title: null, link_url: null, topic: 'general', poll: null, quote_of: null, pinned: false, accepted_comment_id: null,
          ...f, image_paths: paths, hashtags: extractTags((f.title || '') + ' ' + f.body) };
        S().posts.push(p);
        try { save(); } catch (e) { S().posts.pop(); throw e; }
        if (p.quote_of) { const q = S().posts.find(x => x.id === p.quote_of); if (q) notify(q.author_id, myId, 'quote', p.id); }
        mentions((p.title || '') + ' ' + p.body, myId, p.id); save();
        return { id: p.id };
      },
      async updatePost(id, patch) {
        const p = S().posts.find(x => x.id === id); if (!p) return;
        if (!ctx.isFounder) delete patch.pinned;
        if ('accepted_comment_id' in patch && patch.accepted_comment_id && patch.accepted_comment_id !== p.accepted_comment_id) {
          const c = S().comments.find(x => x.id === patch.accepted_comment_id && x.post_id === id); if (!c) throw new Error('That answer belongs to another post');
          notify(c.author_id, myId, 'accepted', id, c.id);
        }
        Object.assign(p, patch); save();
      },
      async deletePost(p) { const s = S(); s.posts = s.posts.filter(x => x.id !== p.id); s.comments = s.comments.filter(c => c.post_id !== p.id); s.likes = s.likes.filter(l => l.post_id !== p.id); s.bookmarks = s.bookmarks.filter(b => b.post_id !== p.id); s.notifications = s.notifications.filter(n => n.post_id !== p.id); s.posts.forEach(x => { if (x.quote_of === p.id) x.quote_of = null; }); save(); },
      async setHidden(table, id, hidden, reason) { const r = S()[table].find(x => x.id === id); if (!r) return; r.hidden = hidden; if (table === 'posts') r.hidden_reason = hidden ? (reason || null) : null; save(); },
      async like(p, on) { const s = S(); s.likes = s.likes.filter(l => !(l.post_id === p.id && l.user_id === myId)); if (on) { s.likes.push({ post_id: p.id, user_id: myId, created_at: now() }); notify(p.author_id, myId, 'like', p.id); } save(); },
      async save(p, on) { const s = S(); s.bookmarks = s.bookmarks.filter(b => !(b.post_id === p.id && b.user_id === myId)); if (on) s.bookmarks.push({ post_id: p.id, user_id: myId, created_at: now() }); save(); },
      async pollResults(ids) {
        const out = {}; ids.forEach(id => { const p = S().posts.find(x => x.id === id); if (!p || !p.poll) return; const v = S().poll_votes.filter(x => x.post_id === id);
          out[id] = { counts: p.poll.options.map((_, i) => v.filter(x => x.option === i).length), total: v.length, mine: (v.find(x => x.user_id === myId) || { option: null }).option }; });
        return out;
      },
      async votePoll(pid, option) { const s = S(); if (s.poll_votes.some(v => v.post_id === pid && v.user_id === myId)) throw new Error('You have already voted in this poll.'); s.poll_votes.push({ post_id: pid, user_id: myId, option, created_at: now() }); save(); },
      async comments(pid) {
        const s = S();
        return s.comments.filter(c => c.post_id === pid && (!c.hidden || c.author_id === myId || ctx.isFounder)).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(c => {
          const v = s.comment_votes.filter(x => x.comment_id === c.id);
          return { parent_id: null, ...c, author: author(c.author_id), score: v.reduce((n, x) => n + x.value, 0), myVote: (v.find(x => x.user_id === myId) || {}).value || 0 };
        });
      },
      async addComment(pid, body, parent) {
        const s = S(); const c = { id: ctx.uid(), post_id: pid, parent_id: parent || null, author_id: myId, body, created_at: now(), hidden: false }; s.comments.push(c);
        const post = s.posts.find(x => x.id === pid); const par = parent ? s.comments.find(x => x.id === parent) : null;
        if (par) notify(par.author_id, myId, 'reply', pid, c.id);
        if (post && (!par || par.author_id !== post.author_id)) notify(post.author_id, myId, 'comment', pid, c.id);
        mentions(body, myId, pid, c.id); save();
      },
      async deleteComment(c) { const s = S(); const gone = new Set([c.id]); let grew = true; while (grew) { grew = false; s.comments.forEach(x => { if (x.parent_id && gone.has(x.parent_id) && !gone.has(x.id)) { gone.add(x.id); grew = true; } }); } s.comments = s.comments.filter(x => !gone.has(x.id)); s.posts.forEach(p => { if (gone.has(p.accepted_comment_id)) p.accepted_comment_id = null; }); save(); },
      async voteComment(c, v) { const s = S(); s.comment_votes = s.comment_votes.filter(x => !(x.comment_id === c.id && x.user_id === myId)); if (v) s.comment_votes.push({ comment_id: c.id, user_id: myId, value: v, created_at: now() }); save(); },
      async report(r) { S().reports.push({ id: ctx.uid(), reporter_id: myId, status: 'open', created_at: now(), details: null, comment_id: null, post_id: null, ...r }); save(); },
      async badges(ids) {
        const out = {};
        ids.forEach(id => { const f = (ctx.Demo.s.founders || []).find(x => x.email === id); out[id] = { founder: !!f, founder_id: f ? f.founder_id : null, member: (ctx.Demo.s.members || []).some(m => m.email === id && m.status === 'approved') }; });
        return out;
      },
      async followingIds() { return S().follows.filter(f => f.follower_id === myId).map(f => f.followee_id); },
      async follow(id, on) { const s = S(); s.follows = s.follows.filter(f => !(f.follower_id === myId && f.followee_id === id)); if (on && id !== myId) { s.follows.push({ follower_id: myId, followee_id: id, created_at: now() }); notify(id, myId, 'follow'); } save(); },
      async followCounts(id) { const f = S().follows; return { followers: f.filter(x => x.followee_id === id).length, following: f.filter(x => x.follower_id === id).length }; },
      async followList(id, which) { return S().follows.filter(f => which === 'followers' ? f.followee_id === id : f.follower_id === id).map(f => author(which === 'followers' ? f.follower_id : f.followee_id)).filter(Boolean); },
      async people(o = {}) { const q = (o.search || '').toLowerCase(); return S().profiles.filter(p => !q || (p.username + ' ' + p.display_name + ' ' + (p.institution || '')).toLowerCase().includes(q)).slice().reverse().slice(0, o.limit || 30).map(p => author(p.id)); },
      async trending() { const c = {}; S().posts.filter(p => visible(p) && p.created_at >= daysAgo(14)).forEach(p => (p.hashtags || []).forEach(t => { c[t] = (c[t] || 0) + 1; })); return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([tag, n]) => ({ tag, n })); },
      async stories() { const t = now(); return S().stories.filter(s => s.expires_at > t).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(s => ({ ...s, author: author(s.author_id) })); },
      async addStory(blob, caption) { const s = S(); s.stories.push({ id: ctx.uid(), author_id: myId, image_path: await blobToDataUrl(blob), caption: caption || null, created_at: now(), expires_at: new Date(Date.now() + 864e5).toISOString() }); try { save(); } catch (e) { s.stories.pop(); throw e; } },
      async deleteStory(st) { const s = S(); s.stories = s.stories.filter(x => x.id !== st.id); save(); },
      async notifications() {
        const s = S();
        return s.notifications.filter(n => n.user_id === myId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 80)
          .map(n => ({ ...n, actor: author(n.actor_id), post: n.post_id ? s.posts.find(p => p.id === n.post_id) || null : null, comment: n.comment_id ? s.comments.find(c => c.id === n.comment_id) || null : null }));
      },
      async unread() { return S().notifications.filter(n => n.user_id === myId && !n.read).length; },
      async markRead() { S().notifications.forEach(n => { if (n.user_id === myId) n.read = true; }); save(); },
      async urls(paths) { return Object.fromEntries(paths.map(p => [p, p])); },
    };
  }

  // Sample conversations so the demo community isn't empty
  function seedDemo(c) {
    if (c.seeded2) return;
    c.seeded2 = true;
    const art = (h1, h2, label) => { try { const cv = document.createElement('canvas'); cv.width = 720; cv.height = 720; const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 720, 720); gr.addColorStop(0, `hsl(${h1} 60% 32%)`); gr.addColorStop(1, `hsl(${h2} 70% 55%)`); g.fillStyle = gr; g.fillRect(0, 0, 720, 720);
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; for (let r = 60; r < 330; r += 55) { g.beginPath(); g.ellipse(360, 380, r * 1.15, r, 0, 0, 7); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '600 46px Inter, sans-serif'; g.fillText(label, 40, 80); return cv.toDataURL('image/jpeg', 0.7); } catch (e) { return null; } };
    const t = h => new Date(Date.now() - h * 36e5).toISOString();
    const f = (ctx.Demo.s.founders || []).find(x => x.founder_id === 'FC-02') || (ctx.Demo.s.founders || [])[0];
    const add = p => { if (!c.profiles.some(x => x.id === p.id)) c.profiles.push({ bio: null, institution: null, stage: null, avatar_path: null, created_at: t(400), ...p }); };
    if (f) add({ id: f.email, username: slug(f.username || f.email.split('@')[0]), display_name: f.name || 'ROAR Founder', bio: "Founders' Council, ROAR. Ask me about #ROARsurvey and the Contour Club.", stage: 'Founder' });
    add({ id: 'riya@demo.roar', username: 'dr.riya', display_name: 'Dr. Riya Menon', stage: 'MD resident, year 3', institution: 'Demo Medical College', bio: 'Head and neck, brachy, and too much coffee.', avatar_path: art(330, 20, 'RM') });
    add({ id: 'kabir@demo.roar', username: 'kabir.sbrt', display_name: 'Dr. Kabir Rao', stage: 'Senior resident', institution: 'Demo Cancer Centre', bio: 'SBRT nerd. Planning, QA and #contouring tips.', avatar_path: art(200, 250, 'KR') });
    const fid = f ? f.email : 'riya@demo.roar';
    const P = (o) => { const p = { id: ctx.uid(), title: null, link_url: null, image_paths: [], kind: 'general', topic: 'general', poll: null, quote_of: null, pinned: false, accepted_comment_id: null, hidden: false, hidden_reason: null, edited_at: null, ...o }; p.hashtags = extractTags((p.title || '') + ' ' + p.body); c.posts.push(p); return p; };
    const welcome = c.posts.find(p => /Welcome to ROAR Community/.test(p.title || ''));
    if (welcome) Object.assign(welcome, { pinned: true, topic: 'general', hashtags: [] }); else P({ author_id: fid, created_at: t(90), pinned: true, title: 'Welcome to ROAR Community', body: 'A space for radiation oncology residents and young consultants across India to ask questions, share articles and discuss cases.\n\nBe kind, cite your sources, and never post anything that could identify a patient. #ROAR' });
    const q1 = P({ author_id: 'riya@demo.roar', created_at: t(5), kind: 'question', topic: 'palliative', title: 'Single 8 Gy or 20 Gy in 5 for painful bone mets?', body: 'Unit protocol says 8 Gy single for most uncomplicated bone mets, but some consultants still prefer 20/5. What do you follow and why? #bonemets #palliativeRT', poll: { options: ['8 Gy × 1', '20 Gy / 5', '30 Gy / 10', 'Depends on the case'], ends_at: new Date(Date.now() + 2 * 864e5).toISOString() } });
    const pics = [art(210, 260, 'PTV'), art(160, 200, 'OAR'), art(20, 45, 'DVH')].filter(Boolean);
    const p2 = P({ author_id: 'kabir@demo.roar', created_at: t(9), kind: 'case', topic: 'sbrt', title: 'Lung SBRT: central tumour planning', body: 'Anonymised plan from this week: 60 Gy in 8 fractions for a central lesion. Swipe for the PTV, organs at risk and the DVH. How would you handle the proximal bronchial tree? #SBRT #contouring', image_paths: pics });
    P({ author_id: fid, created_at: t(26), kind: 'news', topic: 'research', title: 'National survey of radiation oncology residents', body: "ROAR's first national survey is being finalised. It covers training, duty hours, stipends and wellbeing. Tag what you'd like us to ask. #ROARsurvey" });
    P({ author_id: 'riya@demo.roar', created_at: t(3), kind: 'general', topic: 'contouring', body: 'This is exactly what I needed before my viva. Thanks @kabir.sbrt! #contouring', quote_of: p2.id });
    const c1 = { id: ctx.uid(), post_id: q1.id, parent_id: null, author_id: 'kabir@demo.roar', body: '8 Gy single for uncomplicated mets. Same pain relief, fewer visits, slightly more retreatment. Fractionate for neuropathic pain or cord compression.', created_at: t(4), hidden: false };
    const c2 = { id: ctx.uid(), post_id: q1.id, parent_id: c1.id, author_id: 'riya@demo.roar', body: 'Thanks. What about long bones with a high fracture risk?', created_at: t(3.5), hidden: false };
    const c3 = { id: ctx.uid(), post_id: q1.id, parent_id: c2.id, author_id: 'kabir@demo.roar', body: 'Get an ortho opinion first (Mirels score). Post-op RT is usually 20/5.', created_at: t(3.2), hidden: false };
    c.comments.push(c1, c2, c3);
    c.comment_votes.push({ comment_id: c1.id, user_id: 'riya@demo.roar', value: 1, created_at: t(3) });
    q1.accepted_comment_id = c1.id;
    c.likes.push({ post_id: p2.id, user_id: 'riya@demo.roar', created_at: t(8) }, { post_id: q1.id, user_id: 'kabir@demo.roar', created_at: t(4) });
    c.poll_votes.push({ post_id: q1.id, user_id: 'kabir@demo.roar', option: 0, created_at: t(4) }, { post_id: q1.id, user_id: 'riya@demo.roar', option: 3, created_at: t(4) });
    c.follows.push({ follower_id: 'riya@demo.roar', followee_id: 'kabir@demo.roar', created_at: t(30) });
    const s1 = art(280, 330, 'Contour Club'), s2 = art(30, 60, 'Tumour board');
    if (s1) c.stories.push({ id: ctx.uid(), author_id: 'kabir@demo.roar', image_path: s1, caption: 'Contour Club tonight, 8 pm. Bring your head and neck cases!', created_at: t(2), expires_at: new Date(Date.now() + 20 * 36e5).toISOString() });
    if (s2) c.stories.push({ id: ctx.uid(), author_id: 'riya@demo.roar', image_path: s2, caption: 'Tumour board prep 📚', created_at: t(1), expires_at: new Date(Date.now() + 22 * 36e5).toISOString() });
    ctx.Demo.save();
  }

  // ------------------------------------------------------------------ shared loading
  async function decorate(posts) {
    const need = [...new Set(posts.flatMap(p => [p.author_id, p.quoted && p.quoted.author_id]).filter(id => id && !cache.badges[id]))];
    const polls = posts.filter(p => p.poll).map(p => p.id);
    const [b, pr] = await Promise.all([need.length ? D.badges(need) : {}, D.pollResults(polls)]);
    Object.assign(cache.badges, b);
    posts.forEach(p => { p.pollRes = pr[p.id] || null; cache.posts.set(p.id, p); });
    return posts;
  }
  const engagement = p => (p.nlikes || 0) + 2 * (p.ncomments || 0) + 3 * (p.nquotes || 0);
  function rankHot(ps) {
    const t = Date.now();
    const score = p => (cache.following.has(p.author_id) ? 1.4 : 1) * (engagement(p) + 1) / Math.pow((t - new Date(p.created_at)) / 36e5 + 2, 1.35);
    return ps.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || score(b) - score(a));
  }
  async function loadPosts(mode, o, before) {
    let ps;
    if (mode === 'hot') ps = rankHot(await D.posts({ ...o, since: daysAgo(45), limit: 100 })).slice(0, 40);
    else if (mode === 'top') ps = (await D.posts({ ...o, since: daysAgo(7), limit: 100 })).sort((a, b) => engagement(b) - engagement(a)).slice(0, 40);
    else ps = await D.posts({ ...o, before });
    return decorate(ps);
  }

  // ------------------------------------------------------------------ entry
  async function view(c, route) {
    ctx = c;
    myId = ctx.LIVE ? ctx.sess.id : ctx.sess.email;
    D = D || (ctx.LIVE ? liveLayer(ctx.sb) : demoLayer());
    me = await D.myProfile();
    const [what, arg] = route;
    if (!me) return setupView(false);
    shareMe();
    const [fol, st] = await Promise.all([D.followingIds(), D.stories()]);
    cache.following = new Set(fol);
    cache.stories = st;
    cache.storyAuthors = new Set(st.map(s => s.author_id));
    if (what === 'edit') return setupView(true);
    if (what === 'p' && arg) return postView(arg);
    if (what === 'u' && arg) { if (state.profileTab === 'saved') state.profileTab = 'grid'; return profileView(decodeURIComponent(arg)); }
    if (what === 'saved') { state.profileTab = 'saved'; return profileView(me.username); }
    if (what === 't' && arg) return topicView(arg);
    if (what === 'tag' && arg) return tagView(decodeURIComponent(arg).toLowerCase());
    if (what === 'explore') return exploreView();
    if (what === 'notifications') return notificationsView();
    return homeView();
  }

  // ------------------------------------------------------------------ app shell: left rail, centre, right rail, phone tab bar
  function shell(active, center) {
    const nav = (key, href, label, icon) => `<a href="${href}" class="cx-nav${active === key ? ' on' : ''}"${active === key ? ' aria-current="page"' : ''}>${ic(icon)}<span>${label}</span>${key === 'notifications' ? '<b class="cx-dot" data-unread hidden></b>' : ''}</a>`;
    root().innerHTML = `<div class="cx">
      <nav class="cx-rail" aria-label="Community">
        <a class="cx-brand" href="#community"><img class="cx-logo" src="../favicon.svg" alt=""><span>Community</span></a>
        ${nav('home', '#community', 'Home', 'home')}
        ${nav('explore', '#community/explore', 'Explore', 'explore')}
        ${nav('notifications', '#community/notifications', 'Notifications', 'bell')}
        ${nav('saved', '#community/saved', 'Saved', 'bookmark')}
        ${nav('profile', '#community/u/' + esc(me.username), 'Profile', 'user')}
        <button type="button" class="cx-post-btn" data-compose>${ic('plus')}<span>Post</span></button>
        <a class="cx-mecard" href="#community/u/${esc(me.username)}">${avatar(me, 'sm')}<span><b>${esc(me.display_name)}</b><small>@${esc(me.username)}</small></span></a>
      </nav>
      <section class="cx-center" id="cx-center">${center}</section>
      <aside class="cx-right" id="cx-right" aria-label="Trending and suggestions"></aside>
      <nav class="cx-tabbar" aria-label="Community">
        <a href="#community" class="${active === 'home' ? 'on' : ''}" aria-label="Home">${ic('home')}</a>
        <a href="#community/explore" class="${active === 'explore' ? 'on' : ''}" aria-label="Explore">${ic('explore')}</a>
        <button type="button" class="cx-tab-post" data-compose aria-label="New post">${ic('plus')}</button>
        <a href="#community/notifications" class="${active === 'notifications' ? 'on' : ''}" aria-label="Notifications">${ic('bell')}<b class="cx-dot" data-unread hidden></b></a>
        <a href="#community/u/${esc(me.username)}" class="${active === 'profile' ? 'on' : ''}" aria-label="Profile">${avatar(me, 'xs', false)}</a>
      </nav>
    </div>`;
    root().querySelectorAll('[data-compose]').forEach(b => b.addEventListener('click', () => compose({ topic: shell.topic })));
    const center_ = $('#cx-center');
    center_.addEventListener('click', onCenterClick);
    if (active !== 'notifications') D.unread().then(n => root().querySelectorAll('[data-unread]').forEach(d => { d.hidden = !n; d.textContent = n > 9 ? '9+' : n; })).catch(() => { });
    rightRail().catch(e => console.warn(e));
    hydrate(root().querySelector('.cx-rail')); hydrate(root().querySelector('.cx-tabbar'));
    window.scrollTo({ top: Math.min(window.scrollY, (document.getElementById('portal-tabs') || {}).offsetTop || 0) });
    return center_;
  }
  const head = (title, sub, backHref) => `<header class="cx-head">${backHref ? `<a class="cx-back" href="${backHref}" aria-label="Back">${ic('back')}</a>` : ''}<div><h1>${title}</h1>${sub ? `<small>${sub}</small>` : ''}</div></header>`;

  async function rightRail() {
    const box = $('#cx-right'); if (!box) return;
    const [tr, people] = await Promise.all([D.trending(), D.people({ limit: 30 })]);
    const sugg = people.filter(p => p.id !== myId && !cache.following.has(p.id)).slice(0, 3);
    const nb = sugg.filter(p => !cache.badges[p.id]).map(p => p.id);
    if (nb.length) Object.assign(cache.badges, await D.badges(nb));
    box.innerHTML = `
      <form class="cx-search" role="search" id="cx-rsearch">${ic('search')}<input type="search" placeholder="Search Community" aria-label="Search Community" value="${esc(state.q)}"></form>
      <section class="cx-card"><h2>Trending</h2>
        ${tr.length ? tr.slice(0, 6).map((t, i) => `<a class="cx-trend" href="#community/tag/${esc(t.tag)}"><small>${i + 1} · Trending in ROAR</small><b>#${esc(t.tag)}</b><small>${plural(Number(t.n), 'post')}</small></a>`).join('') : '<p class="muted cx-pad">Hashtags you use in posts show up here. Try #contouring.</p>'}
      </section>
      ${sugg.length ? `<section class="cx-card"><h2>Who to follow</h2>${sugg.map(personRow).join('')}<a class="cx-more" href="#community/explore">Show more</a></section>` : ''}
      <section class="cx-card"><h2>Topics</h2><div class="cx-topic-cloud">${TOPICS.slice(1, 11).map(t => topicChip(t[0])).join('')}</div><a class="cx-more" href="#community/explore">All topics</a></section>
      <details class="cx-card cx-rules"><summary>${ic('shield')} Community guidelines</summary>
        <ul><li><b>Protect patients.</b> No names, faces, hospital numbers, dates of birth or anything else that could identify a patient.</li>
        <li><b>Respect everyone:</b> seniors, peers and other specialties. Disagree with ideas, not people.</li>
        <li><b>Cite sources.</b> Link the trial or guideline you're quoting.</li>
        <li><b>No advertising</b> without the Founders' Council's approval.</li></ul>
        <p class="muted">Only signed-in ROAR accounts can see Community. The Founders' Council reviews reports.</p></details>`;
    box.querySelector('#cx-rsearch').addEventListener('submit', e => { e.preventDefault(); state.q = e.target.querySelector('input').value.trim(); go('#community/explore'); });
    wireFollow(box);
    hydrate(box);
  }
  function personRow(p) {
    const f = cache.following.has(p.id);
    return `<div class="cx-person"><a href="#community/u/${esc(p.username)}">${avatar(p, 'sm')}</a><a class="cx-pname" href="#community/u/${esc(p.username)}"><b>${esc(p.display_name)}</b>${badges(cache.badges[p.id])}<small>@${esc(p.username)}${p.stage ? ' · ' + esc(p.stage) : ''}</small></a>
      ${p.id === myId ? '' : `<button type="button" class="cx-follow${f ? ' on' : ''}" data-follow="${esc(p.id)}">${f ? 'Following' : 'Follow'}</button>`}</div>`;
  }
  function wireFollow(scope) {
    scope.querySelectorAll('[data-follow]').forEach(b => b.addEventListener('click', async e => {
      e.stopPropagation();
      const id = b.dataset.follow, on = !cache.following.has(id);
      on ? cache.following.add(id) : cache.following.delete(id);
      root().querySelectorAll(`[data-follow="${CSS.escape(id)}"]`).forEach(x => { x.classList.toggle('on', on); x.textContent = on ? 'Following' : 'Follow'; });
      try { await D.follow(id, on); const el = b.dataset.counts && $('#cx-nfollowers'); if (el) { el.dataset.n = +el.dataset.n + (on ? 1 : -1); el.textContent = num(+el.dataset.n); } } catch (err) { ctx.fail(err); }
    }));
  }

  // One account for the whole site: the header on every page shows this name and picture
  async function thumbOf(url) {
    const blob = await (await fetch(url)).blob();
    const u = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 96, 96);
      return c.toDataURL('image/jpeg', 0.82);
    } finally { URL.revokeObjectURL(u); }
  }
  async function shareMe() {
    try {
      let prev = JSON.parse(localStorage.getItem('roar-me') || '{}') || {};
      if (prev.email !== ctx.sess.email) prev = { email: ctx.sess.email };
      Object.assign(prev, { name: me.display_name, username: me.username });
      if (ctx.isFounder) prev.founder = true;
      if (!me.avatar_path) { delete prev.avatar; delete prev.avatarPath; }
      else if (prev.avatarPath !== me.avatar_path || !prev.avatar) {
        const url = (await D.urls([me.avatar_path]))[me.avatar_path];
        if (url) { prev.avatar = await thumbOf(url); prev.avatarPath = me.avatar_path; }
      }
      localStorage.setItem('roar-me', JSON.stringify(prev));
      if (window.ROAR_ACCOUNT) window.ROAR_ACCOUNT.refresh();
    } catch (e) { console.warn(e); }
  }

  // ------------------------------------------------------------------ profile setup / edit
  function setupView(editing) {
    const p = me || {};
    const sess = ctx.sess;
    const fd = '@' + (ctx.cfg.founderLoginDomain || 'founders.roar.invalid');
    const suggest = slug(sess.email.endsWith(fd) ? sess.email.split('@')[0] : (sess.name || sess.email.split('@')[0]));
    let avBlob = null, avPreview = null;
    const form = `
      <form class="cx-card cx-setup pform" id="cm-prof" novalidate>
        ${editing ? '' : `<div class="cx-setup-hero"><img class="cx-logo big" src="../favicon.svg" alt=""><h1>Join ROAR Community</h1><p>Ask questions, share articles and cases, follow colleagues, and post stories, with radiation oncology residents and young consultants across India. Only signed-in ROAR accounts can see it.</p></div>`}
        <div class="cm-av-edit">
          <button type="button" class="cx-av-pick" id="cm-av-pick" aria-label="Choose a profile picture"><span id="cm-av-prev">${avatar(me ? p : { display_name: sess.name || sess.email }, 'xl', false)}</span><span class="cx-av-cam">${ic('image')}</span></button>
          <div><b>Profile picture</b><p class="muted" style="font-size:.86rem;margin:4px 0 8px">A clear photo of you. We crop it to a square and remove location data from the file.${ctx.isFounder ? " <b>As a member of the Founders' Council, your picture is also shown on the public website wherever the founders are listed.</b>" : ''}</p>
            ${p.avatar_path ? '<button type="button" class="linklike" id="cm-av-rm">Remove picture</button>' : ''}</div>
        </div>
        <div class="row">
          <div><label for="cm-name">Display name</label><input id="cm-name" required minlength="2" maxlength="80" value="${esc(p.display_name || sess.name || '')}" placeholder="Dr. Your Name"></div>
          <div><label for="cm-user">Username</label><div class="cm-at"><span>@</span><input id="cm-user" required pattern="[a-z0-9._]{3,30}" maxlength="30" value="${esc(p.username || suggest)}" autocapitalize="none" spellcheck="false"></div>
            <small class="muted">3–30 characters: lowercase letters, numbers, dots and underscores.</small></div>
        </div>
        <div class="row">
          <div><label for="cm-stage">Stage of training</label><input id="cm-stage" maxlength="80" value="${esc(p.stage || '')}" placeholder="e.g. MD resident, year 2"></div>
          <div><label for="cm-inst">Institution</label><input id="cm-inst" maxlength="200" value="${esc(p.institution || '')}" placeholder="Optional"></div>
        </div>
        <div class="row one"><div><label for="cm-bio">Bio</label><textarea id="cm-bio" maxlength="500" rows="3" placeholder="Interests, sites you treat, what you'd like to learn or share. #hashtags and @mentions work here.">${esc(p.bio || '')}</textarea></div></div>
        <div class="cx-form-actions">${editing ? `<a class="btn btn-glass small" href="#community/u/${esc(p.username)}">Cancel</a>` : ''}<button class="btn btn-primary" type="submit">${editing ? 'Save profile' : 'Create my profile'}</button></div>
        <p class="msg" id="cm-msg" role="status"></p>
      </form>`;
    if (editing) shell('profile', head('Edit profile', '', '#community/u/' + esc(p.username)) + form); else root().innerHTML = `<div class="cx-solo">${form}</div>`;
    const msg = (t, k) => { const m = $('#cm-msg'); m.textContent = t; m.className = 'msg ' + (k || ''); };
    const userIn = $('#cm-user');
    userIn.addEventListener('input', () => { userIn.value = userIn.value.toLowerCase().replace(/[^a-z0-9._]/g, ''); });
    $('#cm-av-pick').addEventListener('click', async () => {
      const [f] = await pickFiles(false); if (!f) return;
      try {
        avBlob = await shrink(f, 480, true, 0.86);
        if (avPreview) URL.revokeObjectURL(avPreview);
        avPreview = URL.createObjectURL(avBlob);
        $('#cm-av-prev').innerHTML = `<span class="cm-av xl"><img alt="" src="${avPreview}"></span>`;
      } catch (err) { msg(err.message, 'err'); }
    });
    const rm = $('#cm-av-rm');
    if (rm) rm.addEventListener('click', () => { avBlob = 'remove'; $('#cm-av-prev').innerHTML = `<span class="cm-av xl">${esc(initials($('#cm-name').value))}</span>`; rm.remove(); });
    $('#cm-prof').addEventListener('submit', async e => {
      e.preventDefault();
      if (!e.target.reportValidity()) return;
      const username = userIn.value.trim();
      if (!USERNAME_RE.test(username)) return msg('Usernames use 3–30 lowercase letters, numbers, dots or underscores.', 'err');
      try {
        msg('Saving…');
        if (await D.usernameTaken(username)) return msg(`@${username} is taken. Try another.`, 'err');
        me = await D.saveProfile({ username, display_name: $('#cm-name').value.trim(), stage: $('#cm-stage').value.trim() || null, institution: $('#cm-inst').value.trim() || null, bio: $('#cm-bio').value.trim() || null }, avBlob);
        shareMe();
        ctx.toast(editing ? 'Profile saved' : 'Welcome to ROAR Community');
        go(editing ? '#community/u/' + me.username : '#community');
      } catch (err) { msg(/duplicate|unique/i.test(err.message) ? `@${username} is taken. Try another.` : err.message, 'err'); }
    });
    hydrate();
  }

  // ------------------------------------------------------------------ home
  async function homeView() {
    shell.topic = null;
    const TABS = [['foryou', 'For you', 'flame'], ['following', 'Following', 'users'], ['latest', 'Latest', 'clock'], ['top', 'Top this week', 'trophy']];
    const c = shell('home', `
      <header class="cx-head cx-head-tabs"><h1>Home</h1>
        <div class="cx-tabs" role="tablist">${TABS.map(([k, l, i]) => `<button type="button" role="tab" data-home="${k}" aria-selected="${state.home === k}" class="${state.home === k ? 'on' : ''}">${ic(i)}<span>${l}</span></button>`).join('')}</div></header>
      <div class="cx-stories" id="cx-stories" aria-label="Stories"></div>
      <div class="cx-quick" data-act="compose">${avatar(me, 'md', false)}<span class="cx-qtext">What's on your mind, ${esc(me.display_name.split(' ').slice(0, 2).join(' '))}?</span>
        <i>${ic('image')}${ic('poll')}</i></div>
      <div id="cx-feed" class="cx-feed"></div><div id="cx-more"></div>`);
    drawStories();
    c.querySelectorAll('[data-home]').forEach(b => b.addEventListener('click', () => { state.home = b.dataset.home; setPref('home', state.home); homeView(); }));
    await feedInto($('#cx-feed'), $('#cx-more'), async before => {
      if (state.home === 'foryou') return loadPosts('hot', {});
      if (state.home === 'top') return loadPosts('top', {});
      if (state.home === 'following') return cache.following.size ? loadPosts('new', { authors: [...cache.following, myId] }, before) : [];
      return loadPosts('new', {}, before);
    }, state.home === 'latest' || state.home === 'following', state.home === 'following' && !cache.following.size
      ? `<div class="cx-empty">${ic('users', 'big')}<h2>Follow people to fill this feed</h2><p>Posts from people you follow appear here, newest first.</p><a class="btn btn-primary small" href="#community/explore">Find people</a></div>` : null);
  }

  async function feedInto(box, more, loader, paged, emptyHtml) {
    box.innerHTML = skeleton(3);
    const first = await loader();
    box.innerHTML = '';
    if (!first.length) { box.innerHTML = emptyHtml || `<div class="cx-empty">${ic('comment', 'big')}<h2>Nothing here yet</h2><p>Be the first to start the conversation.</p><button type="button" class="btn btn-primary small" data-act="compose">Write a post</button></div>`; return; }
    const append = ps => {
      const tmp = document.createElement('div'); tmp.innerHTML = ps.map(p => postCard(p)).join('');
      const nodes = [...tmp.children]; nodes.forEach(n => box.appendChild(n));
      nodes.forEach(wireMedia); hydrate(box);
    };
    append(first);
    let last = first;
    const btn = () => {
      more.innerHTML = paged && last.length === PAGE ? '<button type="button" class="btn btn-glass wide" id="cx-load">Show older posts</button>' : (first.length > 3 ? '<p class="cx-end">You\'re all caught up</p>' : '');
      const b = more.querySelector('#cx-load');
      if (b) b.addEventListener('click', async () => { b.disabled = true; b.textContent = 'Loading…'; try { last = await loader(last[last.length - 1].created_at); append(last); btn(); } catch (e) { ctx.fail(e); b.disabled = false; } });
    };
    btn();
  }
  const skeleton = n => Array.from({ length: n }, () => '<div class="cx-post cx-skel"><div class="cx-ph"><span class="cm-av"></span><span class="cx-sk-line" style="width:40%"></span></div><span class="cx-sk-line"></span><span class="cx-sk-line" style="width:80%"></span><span class="cx-sk-line" style="width:60%"></span></div>').join('');

  // ------------------------------------------------------------------ stories (Instagram)
  function drawStories() {
    const box = $('#cx-stories'); if (!box) return;
    const groups = storyGroups();
    const s = seen.get();
    const mine = groups.find(g => g.author.id === myId);
    const others = groups.filter(g => g.author.id !== myId).sort((a, b) => (a.items.every(i => s.has(i.id)) ? 1 : 0) - (b.items.every(i => s.has(i.id)) ? 1 : 0));
    box.innerHTML = `<button type="button" class="cx-story mine" data-story="${mine ? esc(myId) : ''}" aria-label="${mine ? 'View your story' : 'Add to your story'}">
        <span class="cx-sring${mine ? '' : ' none'}">${avatar(me, 'lg', false)}</span><span class="cx-splus" data-add-story>${ic('plus')}</span><small>Your story</small></button>
      ${others.map(g => `<button type="button" class="cx-story${g.items.every(i => s.has(i.id)) ? ' seen' : ''}" data-story="${esc(g.author.id)}"><span class="cx-sring">${avatar(g.author, 'lg', false)}</span><small>${esc(g.author.username)}</small></button>`).join('')}`;
    box.querySelectorAll('[data-story]').forEach(b => b.addEventListener('click', e => {
      if (e.target.closest('[data-add-story]') || !b.dataset.story) return addStory();
      const order = [...(mine ? [mine] : []), ...others];
      openStories(order, order.findIndex(g => g.author.id === b.dataset.story));
    }));
    hydrate(box);
  }
  function storyGroups() {
    const m = new Map();
    (cache.stories || []).forEach(s => { if (!s.author) return; if (!m.has(s.author_id)) m.set(s.author_id, { author: s.author, items: [] }); m.get(s.author_id).items.push(s); });
    return [...m.values()];
  }
  async function addStory() {
    const [f] = await pickFiles(false); if (!f) return;
    let blob; try { blob = await shrink(f, ctx.LIVE ? 1440 : 900, false, ctx.LIVE ? 0.85 : 0.72); } catch (e) { return ctx.fail(e); }
    const url = URL.createObjectURL(blob);
    const d = dialog('cx-dialog cx-story-new', `<form method="dialog">
      <header class="cx-dhead"><button value="cancel" class="cx-icon-btn" aria-label="Cancel" formnovalidate>${ic('x')}</button><h2>New story</h2><span></span></header>
      <div class="cx-story-prev"><img alt="" src="${url}"><input id="cx-scap" maxlength="200" placeholder="Add a caption…" aria-label="Caption"></div>
      <p class="muted cx-pad" style="font-size:.84rem;margin:0">Stories disappear after 24 hours. Never share anything that could identify a patient.</p>
      <footer class="cx-dfoot"><span class="spacer"></span><button value="share" class="btn btn-primary small">Share to story</button></footer></form>`);
    d.addEventListener('close', async () => {
      if (d.returnValue === 'share') {
        try { await D.addStory(blob, d.querySelector('#cx-scap').value.trim()); ctx.toast('Added to your story'); ctx.rerender(); } catch (e) { ctx.fail(e); }
      }
      URL.revokeObjectURL(url);
    });
  }
  function openStories(groups, gi) {
    if (gi < 0 || !groups.length) return;
    let si = 0, timer = null, paused = false, t0 = 0, elapsed = 0;
    const DUR = 6000;
    const d = document.createElement('dialog'); d.className = 'cx-sviewer'; document.body.appendChild(d);
    const close = () => { clearTimeout(timer); cancelAnimationFrame(raf); d.close(); };
    let raf = 0;
    const draw = () => {
      const g = groups[gi], s = g.items[si];
      seen.add([s.id]);
      const own = s.author_id === myId;
      d.innerHTML = `<div class="cx-sv">
        <div class="cx-sv-bars">${g.items.map((x, i) => `<span><i style="width:${i < si ? 100 : 0}%"></i></span>`).join('')}</div>
        <div class="cx-sv-top"><a href="#community/u/${esc(g.author.username)}" class="cx-sv-who">${avatar(g.author, 'sm', false)}<b>${esc(g.author.display_name)}</b><small>${ago(s.created_at)}</small></a>
          <span class="spacer"></span>${own || ctx.isFounder ? `<button class="cx-icon-btn" data-sdel aria-label="Delete story">${ic('trash')}</button>` : ''}<button class="cx-icon-btn" data-sclose aria-label="Close">${ic('x')}</button></div>
        <img class="cx-sv-img" alt="${esc(s.caption || 'Story')}" data-path="${esc(s.image_path)}">
        ${s.caption ? `<p class="cx-sv-cap">${richText(s.caption)}</p>` : ''}
        <button class="cx-sv-nav prev" aria-label="Previous"></button><button class="cx-sv-nav next" aria-label="Next"></button>
      </div>`;
      hydrate(d);
      d.querySelector('[data-sclose]').onclick = close;
      d.querySelector('.cx-sv-who').onclick = close;
      const del = d.querySelector('[data-sdel]');
      if (del) del.onclick = async () => { if (!confirm('Delete this story?')) return; try { await D.deleteStory(s); close(); ctx.toast('Story deleted'); ctx.rerender(); } catch (e) { ctx.fail(e); } };
      d.querySelector('.prev').onclick = () => step(-1);
      d.querySelector('.next').onclick = () => step(1);
      const v = d.querySelector('.cx-sv');
      v.onpointerdown = e => { if (e.target.closest('button,a')) return; paused = true; };
      v.onpointerup = v.onpointercancel = () => { paused = false; };
      elapsed = 0; t0 = performance.now(); tick();
    };
    const tick = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(ts => {
        if (!d.open) return;
        if (paused) { t0 = ts - elapsed; } else elapsed = ts - t0;
        const bar = d.querySelectorAll('.cx-sv-bars i')[si]; if (bar) bar.style.width = Math.min(100, elapsed / DUR * 100) + '%';
        if (elapsed >= DUR) step(1); else tick();
      });
    };
    const step = k => {
      si += k;
      if (si >= groups[gi].items.length) { gi++; si = 0; }
      else if (si < 0) { gi--; si = gi >= 0 ? groups[gi].items.length - 1 : 0; }
      if (gi < 0) { gi = 0; si = 0; }
      if (gi >= groups.length) return close();
      draw();
    };
    d.addEventListener('keydown', e => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
    d.addEventListener('close', () => { cancelAnimationFrame(raf); d.remove(); drawStories(); });
    d.showModal(); draw();
  }

  // ------------------------------------------------------------------ a post card
  function postCard(p, full) {
    const a = p.author || { display_name: 'Former member', username: '' };
    const b = cache.badges[p.author_id];
    const long = !full && p.body.length > 480;
    const body = long ? p.body.slice(0, 400).replace(/\s+\S*$/, '') + '…' : p.body;
    const imgs = p.image_paths || [];
    const answered = p.kind === 'question' && p.accepted_comment_id;
    return `<article class="cx-post${full ? ' full' : ''}${p.hidden ? ' is-hidden' : ''}" data-id="${esc(p.id)}"${full ? '' : ' data-open'}>
      ${p.pinned ? `<div class="cx-pinned">${ic('pin')}Pinned by the Founders' Council</div>` : ''}
      ${p.hidden ? `<div class="notice warn" style="margin:0 0 12px">Hidden by the Founders' Council${p.hidden_reason ? ': ' + esc(p.hidden_reason) : ''}. Only the author and the founders can see it.</div>` : ''}
      <header class="cx-ph">
        <a href="#community/u/${esc(a.username)}" class="cx-ph-av" tabindex="-1" aria-hidden="true">${avatar(a, 'md')}</a>
        <div class="cx-ph-who"><a href="#community/u/${esc(a.username)}" class="cx-name">${esc(a.display_name)}</a>${badges(b)}
          <div class="cx-ph-sub"><span>@${esc(a.username)}</span> · <a href="#community/p/${esc(p.id)}" title="${esc(ctx.fmtTime(p.created_at))}">${ago(p.created_at)}</a>${p.edited_at ? ' · edited' : ''}</div></div>
        <button type="button" class="cx-icon-btn" data-act="menu" aria-label="More options">${ic('more')}</button>
      </header>
      <div class="cx-flair">${topicChip(p.topic)}${p.kind !== 'general' ? `<span class="cx-kind k-${esc(p.kind)}">${esc(KIND[p.kind] || p.kind)}</span>` : ''}${answered ? `<span class="cx-answered">${ic('check')}Answered</span>` : ''}</div>
      ${p.title ? `<h3 class="cx-title">${full ? esc(p.title) : `<a href="#community/p/${esc(p.id)}">${esc(p.title)}</a>`}</h3>` : ''}
      <div class="cx-body${full ? ' big' : ''}">${richText(body)}${long ? ` <a href="#community/p/${esc(p.id)}" class="cx-more-link">Show more</a>` : ''}</div>
      ${imgs.length ? carousel(imgs) : ''}
      ${p.poll ? pollHtml(p) : ''}
      ${p.quoted ? quoteCard(p.quoted) : ''}
      ${safeUrl(p.link_url) ? `<a class="cx-linkcard" href="${safeUrl(p.link_url)}" target="_blank" rel="noopener nofollow ugc">${ic('link')}<span><b>${esc(p.link_url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0])}</b><small>${esc(p.link_url.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 90))}</small></span></a>` : ''}
      <footer class="cx-acts">
        <button type="button" class="cx-act like${p.liked ? ' on' : ''}" data-act="like" aria-pressed="${!!p.liked}" aria-label="Like">${ic('heart', p.liked ? 'fill' : '')}<span>${p.nlikes ? num(p.nlikes) : ''}</span></button>
        <a class="cx-act" href="#community/p/${esc(p.id)}" aria-label="${p.kind === 'question' ? 'Answers' : 'Comments'}">${ic('comment')}<span>${p.ncomments ? num(p.ncomments) : ''}</span></a>
        <button type="button" class="cx-act" data-act="quote" aria-label="Quote this post">${ic('quote')}<span>${p.nquotes ? num(p.nquotes) : ''}</span></button>
        <span class="spacer"></span>
        <button type="button" class="cx-act save${p.saved ? ' on' : ''}" data-act="save" aria-pressed="${!!p.saved}" aria-label="${p.saved ? 'Remove from saved' : 'Save'}">${ic('bookmark', p.saved ? 'fill' : '')}</button>
        <button type="button" class="cx-act" data-act="share" aria-label="Share">${ic('share')}</button>
      </footer>
      ${!full && p.ncomments ? `<a class="cx-viewall" href="#community/p/${esc(p.id)}">View ${p.ncomments === 1 ? 'the' : 'all ' + p.ncomments} ${p.kind === 'question' ? (p.ncomments === 1 ? 'answer' : 'answers') : (p.ncomments === 1 ? 'comment' : 'comments')}</a>` : ''}
    </article>`;
  }
  function carousel(imgs) {
    return `<div class="cx-car${imgs.length > 1 ? ' multi' : ''}">
      <div class="cx-car-track" tabindex="0" aria-label="${imgs.length} photo${imgs.length > 1 ? 's' : ''}">${imgs.map((src, i) => `<div class="cx-slide" data-act="media" data-i="${i}"><img alt="Photo ${i + 1} of ${imgs.length}" loading="lazy" data-path="${esc(src)}"></div>`).join('')}</div>
      ${imgs.length > 1 ? `<span class="cx-car-n">1/${imgs.length}</span><button type="button" class="cx-car-btn prev" aria-label="Previous photo" hidden>${ic('chevl')}</button><button type="button" class="cx-car-btn next" aria-label="Next photo">${ic('chevr')}</button>
        <div class="cx-dots">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
      <span class="cx-burst" aria-hidden="true">${ic('heart', 'fill')}</span>
    </div>`;
  }
  function wireMedia(scope) {
    scope.querySelectorAll('.cx-car').forEach(car => {
      const tr = car.querySelector('.cx-car-track'); const n = tr.children.length;
      if (n < 2) return;
      const upd = () => { const i = Math.round(tr.scrollLeft / tr.clientWidth); car.querySelectorAll('.cx-dots i').forEach((d, k) => d.classList.toggle('on', k === i)); car.querySelector('.cx-car-n').textContent = `${i + 1}/${n}`; car.querySelector('.prev').hidden = i === 0; car.querySelector('.next').hidden = i === n - 1; };
      tr.addEventListener('scroll', () => { cancelAnimationFrame(tr._r); tr._r = requestAnimationFrame(upd); }, { passive: true });
      car.querySelector('.prev').addEventListener('click', e => { e.stopPropagation(); tr.scrollBy({ left: -tr.clientWidth, behavior: 'smooth' }); });
      car.querySelector('.next').addEventListener('click', e => { e.stopPropagation(); tr.scrollBy({ left: tr.clientWidth, behavior: 'smooth' }); });
    });
  }
  function quoteCard(q) {
    if (q.missing) return '<div class="cx-quote muted">This post is unavailable.</div>';
    const a = q.author || { display_name: 'Former member', username: '' };
    const img = (q.image_paths || [])[0];
    return `<a class="cx-quote" href="#community/p/${esc(q.id)}">
      <span class="cx-quote-head">${avatar(a, 'xs', false)}<b>${esc(a.display_name)}</b>${badges(cache.badges[q.author_id])}<small>@${esc(a.username)} · ${ago(q.created_at)}</small></span>
      <span class="cx-quote-body">${img ? `<img alt="" data-path="${esc(img)}">` : ''}<span>${q.title ? `<b>${esc(q.title)}</b> ` : ''}${esc(String(q.body).slice(0, 220))}${q.body.length > 220 ? '…' : ''}</span></span></a>`;
  }
  function pollHtml(p) {
    const r = p.pollRes || { counts: p.poll.options.map(() => 0), total: 0, mine: null };
    const ended = p.poll.ends_at && new Date(p.poll.ends_at) < new Date();
    const voted = r.mine !== null && r.mine !== undefined;
    const showRes = voted || ended || p.author_id === myId;
    const max = Math.max(...r.counts, 0);
    return `<div class="cx-poll" data-poll="${esc(p.id)}">
      ${p.poll.options.map((o, i) => showRes
        ? `<div class="cx-poll-row${r.counts[i] === max && max ? ' lead' : ''}${r.mine === i ? ' mine' : ''}"><i style="width:${r.total ? Math.round(r.counts[i] / r.total * 100) : 0}%"></i><span>${esc(o)}${r.mine === i ? ` ${ic('check')}` : ''}</span><b>${r.total ? Math.round(r.counts[i] / r.total * 100) : 0}%</b></div>`
        : `<button type="button" class="cx-poll-opt" data-act="vote" data-opt="${i}">${esc(o)}</button>`).join('')}
      <small class="muted">${plural(r.total, 'vote')}${p.poll.ends_at ? ' · ' + left(p.poll.ends_at) : ''}${!showRes ? ' · Results show after you vote' : ''}</small>
    </div>`;
  }

  // One click handler for every card in the centre column
  let tapT = 0, tapTimer = null;
  async function onCenterClick(e) {
    const t = e.target;
    if (t.closest('[data-act="compose"]')) return compose({ topic: shell.topic });
    const card = t.closest('.cx-post'); if (!card) return;
    const p = cache.posts.get(card.dataset.id); if (!p) return;
    const act = t.closest('[data-act]');
    if (!act) {
      if (card.hasAttribute('data-open') && !t.closest('a, button, input, textarea, .cx-car, .cx-poll, .cx-quote') && !String(getSelection())) go('#community/p/' + p.id);
      return;
    }
    const a = act.dataset.act;
    if (a === 'like') return toggleLike(p, card);
    if (a === 'save') return toggleSave(p, card);
    if (a === 'quote') return compose({ quote: p, topic: p.topic });
    if (a === 'share') return share(p);
    if (a === 'menu') return postMenu(p, act, card);
    if (a === 'vote') { try { await D.votePoll(p.id, +act.dataset.opt); const res = await D.pollResults([p.id]); p.pollRes = res[p.id]; card.querySelector('.cx-poll').outerHTML = pollHtml(p); } catch (err) { ctx.fail(err); } return; }
    if (a === 'media') {   // Instagram: double-tap to like, single tap to view
      const nowT = Date.now();
      if (nowT - tapT < 320) { clearTimeout(tapTimer); tapT = 0; burst(act.closest('.cx-car')); if (!p.liked) toggleLike(p, card); return; }
      tapT = nowT; clearTimeout(tapTimer);
      tapTimer = setTimeout(() => lightbox(card, +act.dataset.i), 320);
    }
  }
  function burst(car) { const b = car && car.querySelector('.cx-burst'); if (!b) return; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
  async function toggleLike(p, card) {
    const on = !p.liked; p.liked = on; p.nlikes = Math.max(0, (p.nlikes || 0) + (on ? 1 : -1));
    const btn = card.querySelector('.cx-act.like');
    btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); btn.querySelector('svg').classList.toggle('fill', on); btn.querySelector('span').textContent = p.nlikes ? num(p.nlikes) : '';
    if (on) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    try { await D.like(p, on); } catch (e) { ctx.fail(e); }
  }
  async function toggleSave(p, card) {
    const on = !p.saved; p.saved = on;
    const btn = card.querySelector('.cx-act.save');
    btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); btn.querySelector('svg').classList.toggle('fill', on);
    try { await D.save(p, on); ctx.toast(on ? 'Saved. Find it under Saved.' : 'Removed from saved'); } catch (e) { ctx.fail(e); }
  }
  async function share(p) {
    const url = postUrl(p.id);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: p.title || 'ROAR Community', url }); return; }
      await navigator.clipboard.writeText(url); ctx.toast('Link copied. Only signed-in ROAR accounts can open it.');
    } catch (e) { if (e && e.name !== 'AbortError') prompt('Copy this link:', url); }
  }
  function menu(anchor, items) {
    document.querySelectorAll('.cx-menu').forEach(m => m.remove());
    const m = document.createElement('div'); m.className = 'cx-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = items.filter(Boolean).map((it, i) => `<button type="button" role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}">${ic(it.icon)}${esc(it.label)}</button>`).join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = (window.scrollY + r.bottom + 6) + 'px';
    m.style.left = Math.max(8, Math.min(window.scrollX + r.right - m.offsetWidth, window.scrollX + document.documentElement.clientWidth - m.offsetWidth - 8)) + 'px';
    const list = items.filter(Boolean);
    const off = e => { if (!m.contains(e.target)) close(); };
    const key = e => { if (e.key === 'Escape') close(); };
    const close = () => { m.remove(); document.removeEventListener('pointerdown', off, true); document.removeEventListener('keydown', key); anchor.focus(); };
    m.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; close(); list[+b.dataset.i].run(); });
    setTimeout(() => { document.addEventListener('pointerdown', off, true); document.addEventListener('keydown', key); }, 0);
    m.querySelector('button').focus();
  }
  function postMenu(p, anchor, card) {
    const own = p.author_id === myId, F = ctx.isFounder;
    menu(anchor, [
      { icon: 'copy', label: 'Copy link', run: () => share(p) },
      { icon: 'bookmark', label: p.saved ? 'Remove from saved' : 'Save', run: () => toggleSave(p, card) },
      !own && { icon: 'users', label: (cache.following.has(p.author_id) ? 'Unfollow @' : 'Follow @') + (p.author ? p.author.username : ''), run: async () => { const on = !cache.following.has(p.author_id); on ? cache.following.add(p.author_id) : cache.following.delete(p.author_id); try { await D.follow(p.author_id, on); ctx.toast(on ? 'Following' : 'Unfollowed'); } catch (e) { ctx.fail(e); } } },
      F && { icon: 'pin', label: p.pinned ? 'Unpin' : 'Pin to the top', run: async () => { try { await D.updatePost(p.id, { pinned: !p.pinned }); ctx.toast(p.pinned ? 'Unpinned' : 'Pinned'); ctx.rerender(); } catch (e) { ctx.fail(e); } } },
      F && { icon: p.hidden ? 'eye' : 'eyeoff', label: p.hidden ? 'Unhide' : 'Hide (moderation)', run: async () => { let reason = null; if (!p.hidden) { reason = prompt('Reason shown to the author (optional):', 'Under review'); if (reason === null) return; } try { await D.setHidden('posts', p.id, !p.hidden, reason); ctx.toast(p.hidden ? 'Visible again' : 'Hidden'); ctx.rerender(); } catch (e) { ctx.fail(e); } } },
      (own || F) && { icon: 'trash', label: 'Delete', danger: true, run: async () => { if (!confirm(own ? 'Delete this post? This cannot be undone.' : "Delete this member's post permanently? Hiding it is usually enough.")) return; try { await D.deletePost(p); ctx.toast('Post deleted'); if (card.classList.contains('full')) go('#community'); else card.remove(); } catch (e) { ctx.fail(e); } } },
      !own && { icon: 'flag', label: 'Report', danger: true, run: () => reportDialog({ post_id: p.id }) },
    ]);
  }

  function dialog(cls, html) {
    const d = document.createElement('dialog'); d.className = cls; d.innerHTML = html;
    d.addEventListener('click', e => { if (e.target === d) d.close('cancel'); });
    d.addEventListener('close', () => setTimeout(() => d.remove(), 0));
    document.body.appendChild(d); d.showModal(); hydrate(d);
    return d;
  }
  function lightbox(card, i) {
    const imgs = [...card.querySelectorAll('.cx-slide img')].map(x => x.src).filter(Boolean);
    if (!imgs.length) return;
    let k = Math.min(i, imgs.length - 1);
    const d = dialog('cm-lightbox', '');
    const draw = () => {
      d.innerHTML = `<img alt="Photo ${k + 1} of ${imgs.length}" src="${imgs[k]}">${imgs.length > 1 ? `<button class="cm-lb prev" aria-label="Previous">‹</button><button class="cm-lb next" aria-label="Next">›</button>` : ''}<button class="cm-lb close" aria-label="Close">×</button>`;
      d.querySelector('.close').onclick = () => d.close();
      if (imgs.length > 1) { d.querySelector('.prev').onclick = () => { k = (k + imgs.length - 1) % imgs.length; draw(); }; d.querySelector('.next').onclick = () => { k = (k + 1) % imgs.length; draw(); }; }
    };
    draw();
    d.addEventListener('keydown', e => { if (imgs.length > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { k = (k + (e.key === 'ArrowRight' ? 1 : imgs.length - 1)) % imgs.length; draw(); } });
  }
  function reportDialog(target) {
    const d = dialog('cx-dialog', `<form method="dialog" class="pform cx-pad2">
      <h2>Report ${target.comment_id ? 'this comment' : 'this post'}</h2>
      <p class="muted" style="margin:-6px 0 14px;font-size:.9rem">Only the Founders' Council sees reports. The author isn't told who reported.</p>
      <div class="cm-reasons">${REASONS.map((r, i) => `<label><input type="radio" name="r" value="${esc(r)}"${i === 0 ? ' checked' : ''}> ${esc(r)}</label>`).join('')}</div>
      <label for="cm-rdet" style="margin-top:12px">Anything else? (optional)</label>
      <textarea id="cm-rdet" rows="3" maxlength="1000"></textarea>
      <div class="cx-form-actions"><button value="cancel" class="btn btn-glass small" formnovalidate>Cancel</button><button value="send" class="btn btn-primary small">Send report</button></div>
    </form>`);
    d.addEventListener('close', async () => {
      if (d.returnValue !== 'send') return;
      try { await D.report({ ...target, reason: d.querySelector('[name="r"]:checked').value, details: d.querySelector('#cm-rdet').value.trim() || null }); ctx.toast("Thanks. The Founders' Council will review it."); } catch (e) { ctx.fail(e); }
    });
  }

  // ------------------------------------------------------------------ composer (Twitter-style dialog)
  function compose(o = {}) {
    const blobs = [];
    let kind = o.quote ? 'general' : 'question', pollOn = false;
    const topics = TOPICS.map(t => `<option value="${t[0]}"${(o.topic || 'general') === t[0] ? ' selected' : ''}>${esc(t[1])}</option>`).join('');
    const d = dialog('cx-dialog cx-compose', `<form method="dialog" novalidate>
      <header class="cx-dhead"><button value="cancel" class="cx-icon-btn" aria-label="Close" formnovalidate>${ic('x')}</button><h2>${o.quote ? 'Quote post' : 'New post'}</h2><span></span></header>
      <div class="cx-cbody">
        <div class="cx-cside">${avatar(me, 'md', false)}</div>
        <div class="cx-cmain">
          <div class="cx-crow"><label class="cx-select">${ic('hash')}<select id="cx-topic" aria-label="Topic">${topics}</select></label>
            <div class="cm-kinds" role="radiogroup" aria-label="Type of post">${KINDS.map(([k, l]) => `<label><input type="radio" name="cx-kind" value="${k}"${k === kind ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
          <input id="cx-title" class="cx-ctitle" maxlength="200" placeholder="Title (optional)" aria-label="Title">
          <textarea id="cx-text" class="cx-ctext" rows="4" maxlength="10000" placeholder="${o.quote ? 'Add your thoughts…' : "What's your question? Add the site, stage and what you've considered."}" aria-label="Post"></textarea>
          ${o.quote ? quoteCard(o.quote) : ''}
          <div class="cm-thumbs" id="cx-thumbs"></div>
          <div class="cx-pollb" id="cx-pollb" hidden>
            <div id="cx-popts">${[0, 1].map(i => `<input class="cx-popt" maxlength="60" placeholder="Choice ${i + 1}" aria-label="Choice ${i + 1}">`).join('')}</div>
            <div class="cx-crow"><button type="button" class="linklike" id="cx-padd">+ Add a choice</button><span class="spacer"></span>
              <label class="cx-select small">${ic('clock')}<select id="cx-plen" aria-label="Poll length"><option value="1">1 day</option><option value="3" selected>3 days</option><option value="7">1 week</option></select></label>
              <button type="button" class="linklike" id="cx-prm">Remove poll</button></div>
          </div>
          <input id="cx-link" type="url" class="cx-clink" placeholder="Paste a link to a paper, guideline or article" aria-label="Link" hidden>
          <label class="cm-consent" id="cx-consent" hidden><input type="checkbox" id="cx-ok"><span>I confirm nothing in this post or its photos can identify a patient: no names, faces, hospital or ID numbers, dates of birth, or burned-in scan details.</span></label>
          <p class="msg" id="cx-cmsg" role="status"></p>
        </div>
      </div>
      <footer class="cx-dfoot">
        <button type="button" class="cx-icon-btn accent" id="cx-addimg" aria-label="Add photos" title="Photos (up to 4)">${ic('image')}</button>
        <button type="button" class="cx-icon-btn accent" id="cx-addpoll" aria-label="Add a poll" title="Poll">${ic('poll')}</button>
        <button type="button" class="cx-icon-btn accent" id="cx-addlink" aria-label="Add a link" title="Link">${ic('link')}</button>
        <span class="spacer"></span><span class="cx-count" id="cx-count"></span>
        <button value="post" class="btn btn-primary small" id="cx-send">Post</button>
      </footer></form>`);
    const q = s => d.querySelector(s);
    d.querySelector('form').addEventListener('submit', e => { if (!e.submitter || e.submitter.value !== 'cancel') e.preventDefault(); });   // Enter in a field must not close the dialog
    const msg = (t, k) => { const m = q('#cx-cmsg'); m.textContent = t; m.className = 'msg ' + (k || ''); };
    const text = q('#cx-text');
    const grow = () => { text.style.height = 'auto'; text.style.height = Math.min(text.scrollHeight, 420) + 'px'; const n = text.value.length; q('#cx-count').textContent = n > 8000 ? `${10000 - n}` : ''; };
    text.addEventListener('input', grow); setTimeout(() => text.focus(), 30);
    const sync = () => {
      kind = (q('[name="cx-kind"]:checked') || {}).value || 'general';
      q('#cx-consent').hidden = !(blobs.length || kind === 'case');
      q('#cx-addimg').disabled = pollOn || blobs.length >= 4; q('#cx-addpoll').disabled = !!blobs.length;
    };
    d.querySelectorAll('[name="cx-kind"]').forEach(r => r.addEventListener('change', sync));
    const drawThumbs = () => {
      q('#cx-thumbs').innerHTML = blobs.map((b, i) => `<span class="cm-thumb"><img alt="" src="${b.url}"><button type="button" data-i="${i}" aria-label="Remove photo ${i + 1}">×</button></span>`).join('');
      q('#cx-thumbs').querySelectorAll('button').forEach(x => x.addEventListener('click', () => { URL.revokeObjectURL(blobs[x.dataset.i].url); blobs.splice(+x.dataset.i, 1); drawThumbs(); sync(); }));
    };
    q('#cx-addimg').addEventListener('click', async () => {
      const files = await pickFiles(true);
      for (const f of files) {
        if (blobs.length >= 4) { msg('You can add up to 4 photos.', 'err'); break; }
        try { const b = await shrink(f, ctx.LIVE ? 1600 : 900, false, ctx.LIVE ? 0.85 : 0.72); b.url = URL.createObjectURL(b); blobs.push(b); } catch (err) { msg(err.message, 'err'); }
      }
      drawThumbs(); sync();
    });
    q('#cx-addpoll').addEventListener('click', () => { pollOn = true; q('#cx-pollb').hidden = false; q('.cx-popt').focus(); sync(); });
    q('#cx-prm').addEventListener('click', () => { pollOn = false; q('#cx-pollb').hidden = true; sync(); });
    q('#cx-padd').addEventListener('click', () => { const n = d.querySelectorAll('.cx-popt').length; if (n >= 4) return; q('#cx-popts').insertAdjacentHTML('beforeend', `<input class="cx-popt" maxlength="60" placeholder="Choice ${n + 1} (optional)" aria-label="Choice ${n + 1}">`); if (n + 1 >= 4) q('#cx-padd').hidden = true; });
    q('#cx-addlink').addEventListener('click', () => { const l = q('#cx-link'); l.hidden = !l.hidden; if (!l.hidden) l.focus(); });
    sync();
    q('#cx-send').addEventListener('click', async e => {
      e.preventDefault();
      const body = text.value.trim(), title = q('#cx-title').value.trim(), link = q('#cx-link').value.trim();
      if (!body) return msg('Write something first.', 'err');
      if (link && !/^https?:\/\//i.test(link)) return msg('Links start with http:// or https://', 'err');
      let poll = null;
      if (pollOn) {
        const opts = [...d.querySelectorAll('.cx-popt')].map(x => x.value.trim()).filter(Boolean);
        if (opts.length < 2) return msg('A poll needs at least 2 choices.', 'err');
        poll = { options: opts, ends_at: new Date(Date.now() + (+q('#cx-plen').value) * 864e5).toISOString() };
      }
      if (!q('#cx-consent').hidden && !q('#cx-ok').checked) return msg('Please confirm that no patient can be identified.', 'err');
      const btn = q('#cx-send'); btn.disabled = true;
      try {
        msg(blobs.length ? 'Uploading photos…' : 'Posting…');
        const r = await D.createPost({ kind, topic: q('#cx-topic').value, title: title || null, body, link_url: link || null, poll, quote_of: o.quote ? o.quote.id : null }, blobs);
        blobs.forEach(b => URL.revokeObjectURL(b.url));
        d.close('done');
        ctx.toast('Posted');
        if (location.hash === '#community' || location.hash === '') { state.home = 'latest'; setPref('home', 'latest'); ctx.rerender(); } else go('#community/p/' + r.id);
      } catch (err) { msg(err.message, 'err'); btn.disabled = false; }
    });
  }

  // ------------------------------------------------------------------ post page with threaded comments (Reddit)
  async function postView(id) {
    const c = shell('', head('Post', '', '#community') + skeleton(1));
    const [ps, cs] = await Promise.all([D.posts({ ids: [id], limit: 1 }), D.comments(id)]);
    const p = ps[0];
    if (!p) { c.innerHTML = head('Post', '', '#community') + `<div class="cx-empty">${ic('comment', 'big')}<h2>Post not found</h2><p>It may have been deleted.</p><a class="btn btn-glass small" href="#community">Back to Community</a></div>`; return; }
    await decorate([p]);
    const nb = [...new Set(cs.map(x => x.author_id))].filter(x => !cache.badges[x]);
    if (nb.length) Object.assign(cache.badges, await D.badges(nb));
    const isQ = p.kind === 'question';
    c.innerHTML = head(isQ ? 'Question' : 'Post', '', '#community') + postCard(p, true) + `
      <section class="cx-thread" aria-labelledby="cx-th">
        <div class="cx-thread-head"><h2 id="cx-th">${cs.length ? plural(cs.length, isQ ? 'answer' : 'comment') : (isQ ? 'Answers' : 'Comments')}</h2>
          <label class="cx-select small">${ic('list')}<select id="cx-csort" aria-label="Sort"><option value="best"${state.commentSort === 'best' ? ' selected' : ''}>Best</option><option value="new"${state.commentSort === 'new' ? ' selected' : ''}>Newest</option><option value="old"${state.commentSort === 'old' ? ' selected' : ''}>Oldest</option></select></label></div>
        ${p.hidden ? '' : `<form class="cx-reply root" data-parent="">${avatar(me, 'sm', false)}<textarea rows="1" maxlength="3000" placeholder="${isQ ? 'Write an answer…' : 'Add a comment…'}" aria-label="${isQ ? 'Answer' : 'Comment'}"></textarea><button class="btn btn-primary small" type="submit">${isQ ? 'Answer' : 'Reply'}</button></form>`}
        <div id="cx-tree">${tree(cs, p)}</div>
      </section>`;
    wireMedia(c); hydrate(c);
    const reload = () => postView(id);
    $('#cx-csort').addEventListener('change', e => { state.commentSort = e.target.value; $('#cx-tree').innerHTML = tree(cs, p); hydrate($('#cx-tree')); });
    const wireReply = f => {
      const ta = f.querySelector('textarea');
      ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 300) + 'px'; });
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) f.requestSubmit(); });
      f.addEventListener('submit', async e => {
        e.preventDefault(); const t = ta.value.trim(); if (!t) return;
        f.querySelector('button').disabled = true;
        try { await D.addComment(id, t, f.dataset.parent || null); reload(); } catch (err) { ctx.fail(err); f.querySelector('button').disabled = false; }
      });
    };
    const rootForm = c.querySelector('.cx-reply.root'); if (rootForm) wireReply(rootForm);
    $('#cx-tree').addEventListener('click', async e => {
      const el = e.target.closest('[data-cact]'); if (!el) return;
      const node = el.closest('.cx-c'); const cm = cs.find(x => x.id === node.dataset.cid);
      const a = el.dataset.cact;
      if (a === 'collapse') { node.classList.toggle('collapsed'); el.setAttribute('aria-expanded', !node.classList.contains('collapsed')); return; }
      if (a === 'up' || a === 'down') {
        const v = a === 'up' ? 1 : -1; const nv = cm.myVote === v ? 0 : v;
        cm.score += nv - cm.myVote; cm.myVote = nv;
        const box = el.closest('.cx-vote'); box.querySelector('b').textContent = num(cm.score); box.dataset.v = nv;
        try { await D.voteComment(cm, nv); } catch (err) { ctx.fail(err); } return;
      }
      if (a === 'reply') {
        const slot = node.querySelector(':scope > .cx-c-main > .cx-c-slot');
        if (slot.innerHTML) { slot.innerHTML = ''; return; }
        slot.innerHTML = `<form class="cx-reply" data-parent="${esc(cm.id)}">${avatar(me, 'xs', false)}<textarea rows="1" maxlength="3000" aria-label="Reply to ${esc(cm.author ? cm.author.display_name : '')}">${cm.author ? '@' + esc(cm.author.username) + ' ' : ''}</textarea><button class="btn btn-primary small" type="submit">Reply</button></form>`;
        const f = slot.querySelector('form'); wireReply(f); hydrate(f); const ta = f.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); return;
      }
      if (a === 'accept') { try { await D.updatePost(p.id, { accepted_comment_id: p.accepted_comment_id === cm.id ? null : cm.id }); ctx.toast(p.accepted_comment_id === cm.id ? 'Answer unmarked' : 'Marked as the accepted answer'); reload(); } catch (err) { ctx.fail(err); } return; }
      if (a === 'more') {
        const own = cm.author_id === myId, F = ctx.isFounder;
        menu(el, [
          F && { icon: cm.hidden ? 'eye' : 'eyeoff', label: cm.hidden ? 'Unhide' : 'Hide (moderation)', run: async () => { try { await D.setHidden('comments', cm.id, !cm.hidden); reload(); } catch (err) { ctx.fail(err); } } },
          (own || F) && { icon: 'trash', label: 'Delete', danger: true, run: async () => { if (!confirm('Delete this comment and its replies?')) return; try { await D.deleteComment(cm); reload(); } catch (err) { ctx.fail(err); } } },
          !own && { icon: 'flag', label: 'Report', danger: true, run: () => reportDialog({ comment_id: cm.id, post_id: p.id }) },
          { icon: 'copy', label: 'Copy link to post', run: () => share(p) },
        ]);
      }
    });
  }
  function tree(cs, p) {
    if (!cs.length) return `<div class="cx-empty small">${ic('comment', 'big')}<p>${p.kind === 'question' ? 'No answers yet. Share what you know.' : 'No comments yet. Start the conversation.'}</p></div>`;
    const kids = {}; cs.forEach(c => { const k = c.parent_id || 'root'; (kids[k] = kids[k] || []).push(c); });
    const sorter = list => {
      const l = [...list];
      if (state.commentSort === 'new') l.sort((a, b) => b.created_at.localeCompare(a.created_at));
      else if (state.commentSort === 'old') l.sort((a, b) => a.created_at.localeCompare(b.created_at));
      else l.sort((a, b) => (b.id === p.accepted_comment_id) - (a.id === p.accepted_comment_id) || b.score - a.score || a.created_at.localeCompare(b.created_at));
      return l;
    };
    const count = id => (kids[id] || []).reduce((n, c) => n + 1 + count(c.id), 0);
    const node = (c, depth) => {
      const a = c.author || { display_name: 'Former member', username: '' };
      const acc = c.id === p.accepted_comment_id;
      const canAccept = p.kind === 'question' && p.author_id === myId && !c.parent_id && c.author_id !== myId;
      const n = count(c.id);
      return `<div class="cx-c${acc ? ' accepted' : ''}${c.hidden ? ' is-hidden' : ''}${depth > 5 ? ' flat' : ''}" data-cid="${esc(c.id)}">
        <div class="cx-c-side"><a href="#community/u/${esc(a.username)}" tabindex="-1" aria-hidden="true">${avatar(a, 'sm')}</a>${n ? `<button type="button" class="cx-c-line" data-cact="collapse" aria-expanded="true" aria-label="Collapse ${n} ${n === 1 ? 'reply' : 'replies'}"></button>` : ''}</div>
        <div class="cx-c-main">
          ${acc ? `<div class="cx-acc">${ic('check')}Accepted answer</div>` : ''}
          <div class="cx-c-head"><a href="#community/u/${esc(a.username)}" class="cx-name">${esc(a.display_name)}</a>${badges(cache.badges[c.author_id])}${c.author_id === p.author_id ? '<span class="cx-op" title="Original poster">OP</span>' : ''}<small>· ${ago(c.created_at)}</small>${c.hidden ? '<span class="tag tag-quiet">Hidden</span>' : ''}<span class="cx-c-folded">${n ? plural(n, 'reply').replace('replys', 'replies') : ''}</span></div>
          <div class="cx-c-body">${richText(c.body)}</div>
          <div class="cx-c-acts">
            <span class="cx-vote" data-v="${c.myVote}"><button type="button" data-cact="up" aria-label="Upvote">${ic('up')}</button><b>${num(c.score)}</b><button type="button" data-cact="down" aria-label="Downvote">${ic('down')}</button></span>
            ${p.hidden ? '' : `<button type="button" data-cact="reply">${ic('comment')}Reply</button>`}
            ${canAccept ? `<button type="button" data-cact="accept" class="${acc ? 'on' : ''}">${ic('check')}${acc ? 'Accepted' : 'Accept answer'}</button>` : ''}
            <button type="button" data-cact="more" aria-label="More options">${ic('more')}</button>
          </div>
          <div class="cx-c-slot"></div>
          ${n ? `<div class="cx-c-kids">${sorter(kids[c.id]).map(k => node(k, depth + 1)).join('')}</div>` : ''}
        </div>
      </div>`;
    };
    return sorter(kids.root || []).map(c => node(c, 0)).join('');
  }

  // ------------------------------------------------------------------ profile (Instagram grid + Twitter follows)
  async function profileView(username) {
    const p = await D.profile(username);
    const self = p && p.id === myId;
    if (!p) { shell('', head('Profile', '', '#community') + `<div class="cx-empty">${ic('user', 'big')}<h2>@${esc(username)} isn't on ROAR Community</h2><a class="btn btn-glass small" href="#community/explore">Find people</a></div>`); return; }
    if (state.profileTab === 'saved' && !self) state.profileTab = 'grid';
    const [n, fc, b] = await Promise.all([D.count({ author: p.id }), D.followCounts(p.id), cache.badges[p.id] ? cache.badges : D.badges([p.id])]);
    Object.assign(cache.badges, b);
    const hasStory = cache.storyAuthors.has(p.id);
    const fol = cache.following.has(p.id);
    const tabs = [['grid', 'Posts', 'grid'], ['list', 'Threads', 'list'], ...(self ? [['saved', 'Saved', 'bookmark']] : [])];
    const c = shell(self ? (state.profileTab === 'saved' ? 'saved' : 'profile') : '', `${head(esc(p.display_name), plural(n, 'post'), '#community')}
      <section class="cx-prof">
        <div class="cx-prof-top">
          <button type="button" class="cx-prof-av${hasStory ? ' story' : ''}" ${hasStory ? 'data-pstory' : 'disabled'} aria-label="${hasStory ? 'View story' : 'Profile picture'}">${hasStory ? '<span class="cx-sring big">' : ''}${avatar(p, 'xxl', false)}${hasStory ? '</span>' : ''}</button>
          <div class="cx-prof-stats">
            <span><b>${num(n)}</b><small>posts</small></span>
            <button type="button" data-flist="followers"><b id="cx-nfollowers" data-n="${fc.followers}">${num(fc.followers)}</b><small>followers</small></button>
            <button type="button" data-flist="following"><b>${num(fc.following)}</b><small>following</small></button>
          </div>
        </div>
        <div class="cx-prof-name"><h2>${esc(p.display_name)}</h2>${badges(cache.badges[p.id])}</div>
        <div class="cx-prof-user">@${esc(p.username)}${p.stage ? ` · <span>${esc(p.stage)}</span>` : ''}</div>
        ${p.institution ? `<div class="cx-prof-inst">${esc(p.institution)}</div>` : ''}
        ${p.bio ? `<p class="cx-prof-bio">${richText(p.bio)}</p>` : ''}
        <div class="cx-prof-joined muted">${ic('clock')}Joined ${esc(new Date(p.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }))}</div>
        <div class="cx-prof-btns">
          ${self ? `<a class="btn btn-glass small" href="#community/edit">${ic('edit')} Edit profile</a><button type="button" class="btn btn-glass small" id="cx-addstory">${ic('plus')} Add story</button>`
            : `<button type="button" class="btn ${fol ? 'btn-glass' : 'btn-primary'} small cx-follow-big${fol ? ' on' : ''}" data-follow="${esc(p.id)}" data-counts="1">${fol ? 'Following' : 'Follow'}</button>`}
          <button type="button" class="btn btn-glass small" id="cx-pshare">${ic('share')} Share</button>
        </div>
      </section>
      <div class="cx-ptabs" role="tablist">${tabs.map(([k, l, i]) => `<button type="button" role="tab" data-ptab="${k}" aria-selected="${state.profileTab === k}" class="${state.profileTab === k ? 'on' : ''}">${ic(i)}<span>${l}</span></button>`).join('')}</div>
      <div id="cx-pbody"></div><div id="cx-more"></div>`);
    wireFollow(c);
    c.querySelectorAll('[data-ptab]').forEach(t => t.addEventListener('click', () => { state.profileTab = t.dataset.ptab; profileView(username); }));
    c.querySelectorAll('[data-flist]').forEach(t => t.addEventListener('click', () => followDialog(p, t.dataset.flist)));
    const ps = c.querySelector('[data-pstory]');
    if (ps) ps.addEventListener('click', () => { const g = storyGroups(); openStories(g, g.findIndex(x => x.author.id === p.id)); });
    const as = $('#cx-addstory'); if (as) as.addEventListener('click', addStory);
    $('#cx-pshare').addEventListener('click', async () => { const url = location.origin + location.pathname + '#community/u/' + p.username; try { await navigator.clipboard.writeText(url); ctx.toast('Profile link copied'); } catch (e) { prompt('Copy this link:', url); } });
    hydrate(c);
    const body = $('#cx-pbody');
    if (state.profileTab === 'list') return feedInto(body, $('#cx-more'), before => loadPosts('new', { author: p.id }, before), true,
      `<div class="cx-empty">${ic('list', 'big')}<p>${self ? "You haven't posted yet." : 'No posts yet.'}</p></div>`);
    body.innerHTML = '<div class="cx-grid">' + Array.from({ length: 6 }, () => '<span class="cx-tile cx-skel"></span>').join('') + '</div>';
    const posts = await decorate(state.profileTab === 'saved' ? await D.saved() : await D.posts({ author: p.id, limit: 60 }));
    body.innerHTML = posts.length ? `<div class="cx-grid">${posts.map(tileHtml).join('')}</div>`
      : `<div class="cx-empty">${ic(state.profileTab === 'saved' ? 'bookmark' : 'image', 'big')}<h2>${state.profileTab === 'saved' ? 'Nothing saved yet' : self ? 'Share your first post' : 'No posts yet'}</h2><p>${state.profileTab === 'saved' ? 'Tap the bookmark on any post to keep it here. Only you can see what you save.' : self ? 'Questions, articles, cases and photos you share appear here.' : ''}</p>${self && state.profileTab !== 'saved' ? '<button type="button" class="btn btn-primary small" data-act="compose">Write a post</button>' : ''}</div>`;
    hydrate(body);
  }
  function tileHtml(p) {
    const imgs = p.image_paths || [];
    const t = TOPIC[p.topic] || TOPIC.general;
    const label = esc((p.title || p.body).slice(0, 140));
    return `<a class="cx-tile${imgs.length ? ' pic' : ''}${p.hidden ? ' is-hidden' : ''}" href="#community/p/${esc(p.id)}" style="--h:${t[2]}" aria-label="${esc(KIND[p.kind] || 'Post')}: ${label}">
      ${imgs.length ? `<img alt="" loading="lazy" data-path="${esc(imgs[0])}">${imgs.length > 1 ? `<span class="cx-multi">${ic('copy')}</span>` : ''}` : `<span class="cx-tkind">${esc(KIND[p.kind] || '')}</span><span class="cx-ttext">${label}</span><span class="cx-ttopic">${esc(t[1])}</span>`}
      ${p.poll ? `<span class="cx-multi">${ic('poll')}</span>` : ''}
      <span class="cx-tover" aria-hidden="true"><span>${ic('heart', 'fill')} ${num(p.nlikes)}</span><span>${ic('comment', 'fill')} ${num(p.ncomments)}</span></span>
    </a>`;
  }
  async function followDialog(p, which) {
    const d = dialog('cx-dialog', `<div class="cx-dhead"><span></span><h2>${which === 'followers' ? 'Followers' : 'Following'}</h2><button class="cx-icon-btn" data-x aria-label="Close">${ic('x')}</button></div><div class="cx-dlist">${skeleton(1)}</div>`);
    d.querySelector('[data-x]').onclick = () => d.close();
    const list = await D.followList(p.id, which);
    const nb = list.map(x => x.id).filter(x => !cache.badges[x]); if (nb.length) Object.assign(cache.badges, await D.badges(nb));
    const box = d.querySelector('.cx-dlist');
    box.innerHTML = list.length ? list.map(personRow).join('') : `<p class="muted cx-pad">${which === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p>`;
    box.querySelectorAll('a').forEach(a => a.addEventListener('click', () => d.close()));
    wireFollow(box); hydrate(box);
  }

  // ------------------------------------------------------------------ explore (Instagram explore + search)
  async function exploreView() {
    shell.topic = null;
    const c = shell('explore', `<header class="cx-head cx-head-search"><form class="cx-search big" role="search" id="cx-esearch">${ic('search')}<input type="search" id="cx-q" placeholder="Search people, posts and #hashtags" aria-label="Search" value="${esc(state.q)}" autocomplete="off"></form></header><div id="cx-ebody"></div>`);
    const input = $('#cx-q');
    let tmr;
    input.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { state.q = input.value.trim(); drawExplore(); }, 280); });
    $('#cx-esearch').addEventListener('submit', e => { e.preventDefault(); state.q = input.value.trim(); drawExplore(); });
    if (state.q) input.focus();
    await drawExplore();
    c.querySelector('#cx-ebody').addEventListener('click', e => { if (e.target.closest('a')) state.q = ''; });
  }
  async function drawExplore() {
    const box = $('#cx-ebody'); if (!box) return;
    const q = state.q;
    if (q) {
      box.innerHTML = skeleton(2);
      const tag = q.replace(/^#/, '').toLowerCase();
      const [people, posts, tr] = await Promise.all([D.people({ search: q.replace(/^[@#]/, ''), limit: 8 }), loadPosts('new', { search: q.replace(/^[@#]/, '') }), D.trending()]);
      const tags = tr.filter(t => t.tag.includes(tag)).slice(0, 5);
      if (/^[a-z][a-z0-9_]{1,39}$/i.test(tag) && !tags.some(t => t.tag === tag)) tags.unshift({ tag, n: null });
      const nb = people.map(x => x.id).filter(x => !cache.badges[x]); if (nb.length) Object.assign(cache.badges, await D.badges(nb));
      box.innerHTML = `
        ${people.length ? `<section class="cx-sec"><h2>People</h2>${people.map(personRow).join('')}</section>` : ''}
        ${tags.length ? `<section class="cx-sec"><h2>Hashtags</h2>${tags.map(t => `<a class="cx-tagrow" href="#community/tag/${esc(t.tag)}"><span class="cx-hashic">${ic('hash')}</span><span><b>#${esc(t.tag)}</b><small>${t.n === null ? 'See posts' : plural(Number(t.n), 'recent post')}</small></span></a>`).join('')}</section>` : ''}
        <section class="cx-sec"><h2>Posts</h2><div class="cx-feed">${posts.length ? posts.map(p => postCard(p)).join('') : `<p class="muted cx-pad">No posts match “${esc(q)}”.</p>`}</div></section>`;
      wireFollow(box); box.querySelectorAll('.cx-post').forEach(wireMedia); hydrate(box);
      return;
    }
    box.innerHTML = `<section class="cx-sec"><h2>Topics</h2><div class="cx-topics">${TOPICS.map(t => `<a class="cx-topic-card" href="#community/t/${t[0]}" style="--h:${t[2]}"><b>${esc(t[1])}</b><small>${esc(t[3])}</small></a>`).join('')}</div></section>
      <section class="cx-sec" id="cx-etrend"></section><section class="cx-sec" id="cx-epics"></section><section class="cx-sec" id="cx-epeople"></section>`;
    const [tr, pics, people] = await Promise.all([D.trending(), D.posts({ imagesOnly: true, limit: 30 }), D.people({ limit: 12 })]);
    if (tr.length) $('#cx-etrend').innerHTML = `<h2>Trending hashtags</h2><div class="cx-topic-cloud">${tr.map(t => `<a class="cx-hashchip" href="#community/tag/${esc(t.tag)}">#${esc(t.tag)}<small>${num(Number(t.n))}</small></a>`).join('')}</div>`;
    await decorate(pics);
    if (pics.length) $('#cx-epics').innerHTML = `<h2>Photos</h2><div class="cx-grid mosaic">${pics.map(tileHtml).join('')}</div>`;
    const others = people.filter(p => p.id !== myId);
    const nb = others.map(x => x.id).filter(x => !cache.badges[x]); if (nb.length) Object.assign(cache.badges, await D.badges(nb));
    if (others.length) $('#cx-epeople').innerHTML = `<h2>New on ROAR Community</h2>${others.slice(0, 8).map(personRow).join('')}`;
    wireFollow(box); hydrate(box);
  }

  // ------------------------------------------------------------------ topic (Reddit community) and hashtag pages
  async function topicView(key) {
    const t = TOPIC[key]; if (!t) return go('#community/explore');
    shell.topic = key;
    const SORTS = [['hot', 'Hot', 'flame'], ['new', 'New', 'clock'], ['top', 'Top', 'trophy']];
    const c = shell('explore', `${head(esc(t[1]), 'Topic', '#community/explore')}
      <section class="cx-banner" style="--h:${t[2]}"><div><h2>${esc(t[1])}</h2><p>${esc(t[3])}</p><small id="cx-tcount"></small></div><button type="button" class="btn btn-primary small" data-act="compose">${ic('plus')} Post in ${esc(t[1])}</button></section>
      <div class="cx-tabs bar" role="tablist">${SORTS.map(([k, l, i]) => `<button type="button" role="tab" data-tsort="${k}" aria-selected="${state.topicSort === k}" class="${state.topicSort === k ? 'on' : ''}">${ic(i)}<span>${l}</span></button>`).join('')}</div>
      <div id="cx-feed" class="cx-feed"></div><div id="cx-more"></div>`);
    D.count({ topic: key }).then(n => { const el = $('#cx-tcount'); if (el) el.textContent = plural(n, 'post'); }).catch(() => { });
    c.querySelectorAll('[data-tsort]').forEach(b => b.addEventListener('click', () => { state.topicSort = b.dataset.tsort; topicView(key); }));
    await feedInto($('#cx-feed'), $('#cx-more'), before => loadPosts(state.topicSort, { topic: key }, before), state.topicSort === 'new',
      `<div class="cx-empty">${ic('comment', 'big')}<h2>No posts in ${esc(t[1])} yet</h2><p>Start the first discussion.</p><button type="button" class="btn btn-primary small" data-act="compose">Write a post</button></div>`);
  }
  async function tagView(tag) {
    shell.topic = null;
    shell('explore', `${head('#' + esc(tag), '<span id="cx-tcount"></span>', '#community/explore')}<div id="cx-feed" class="cx-feed"></div><div id="cx-more"></div>`);
    D.count({ tag }).then(n => { const el = $('#cx-tcount'); if (el) el.textContent = plural(n, 'post'); }).catch(() => { });
    await feedInto($('#cx-feed'), $('#cx-more'), before => loadPosts('new', { tag }, before), true,
      `<div class="cx-empty">${ic('hash', 'big')}<h2>No posts with #${esc(tag)} yet</h2><p>Add #${esc(tag)} to a post to start the conversation.</p></div>`);
  }

  // ------------------------------------------------------------------ notifications (Twitter)
  async function notificationsView() {
    shell.topic = null;
    const c = shell('notifications', head('Notifications') + skeleton(2));
    const list = await D.notifications();
    const nb = [...new Set(list.map(n => n.actor_id).filter(x => x && !cache.badges[x]))]; if (nb.length) Object.assign(cache.badges, await D.badges(nb));
    const TXT = { like: ['heart', 'liked your post'], comment: ['comment', 'commented on your post'], reply: ['comment', 'replied to you'], follow: ['users', 'followed you'],
      mention: ['hash', 'mentioned you'], quote: ['quote', 'quoted your post'], accepted: ['check', 'accepted your answer'] };
    const groups = [['Today', n => Date.now() - new Date(n.created_at) < 864e5], ['This week', n => Date.now() - new Date(n.created_at) < 7 * 864e5], ['Earlier', () => true]];
    const used = new Set();
    const rows = groups.map(([label, test]) => { const g = list.filter(n => !used.has(n.id) && test(n)); g.forEach(n => used.add(n.id)); return g.length ? `<h2 class="cx-ngroup">${label}</h2>` + g.map(n => {
      const [icon, verb] = TXT[n.kind] || ['bell', n.kind];
      const a = n.actor || { display_name: 'Someone', username: '' };
      const href = n.kind === 'follow' ? '#community/u/' + esc(a.username) : '#community/p/' + esc(n.post_id || '');
      const snip = n.comment ? n.comment.body : n.post ? (n.post.title || n.post.body) : '';
      const img = n.post && (n.post.image_paths || [])[0];
      return `<a class="cx-notif${n.read ? '' : ' unread'} k-${esc(n.kind)}" href="${href}">
        <span class="cx-nic">${ic(icon, n.kind === 'like' ? 'fill' : '')}</span>
        ${avatar(a, 'sm')}
        <span class="cx-ntext"><span><b>${esc(a.display_name)}</b>${badges(cache.badges[n.actor_id])} ${verb} <small class="muted">${ago(n.created_at)}</small></span>${snip ? `<small class="muted">${esc(String(snip).slice(0, 140))}</small>` : ''}</span>
        ${img ? `<span class="cx-nthumb"><img alt="" data-path="${esc(img)}"></span>` : ''}
      </a>`; }).join('') : ''; }).join('');
    c.innerHTML = head('Notifications') + (list.length ? `<div class="cx-notifs">${rows}</div>` : `<div class="cx-empty">${ic('bell', 'big')}<h2>No notifications yet</h2><p>Likes, replies, mentions, quotes and new followers show up here.</p></div>`);
    hydrate(c);
    if (list.some(n => !n.read)) D.markRead().catch(() => { });
  }

  window.ROAR_COMMUNITY = { view, TOPICS };
})();
