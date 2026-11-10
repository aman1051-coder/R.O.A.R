// Founders' console: ROAR Community moderation.
//   #/community    reports queue, hidden posts, and counts
// Founders can hide or delete any post or comment (schema PART 11). Members see hidden posts only if they wrote them.
(() => {
  'use strict';
  const C = window.ROAR_COUNCIL;
  if (!C) return;
  const { Demo, LIVE, esc, toast, fail, fmtDate, setHeader } = C;
  const $ = s => document.querySelector(s);
  const portal = h => new URL('../portal/#community/' + h, location.href).href;
  let show = 'open';

  const unwrap = ({ data, error }) => { if (error) throw error; return data || []; };
  const S = () => { const c = Demo.s.community = Demo.s.community || {}; ['profiles', 'posts', 'comments', 'likes', 'reports'].forEach(k => { c[k] = c[k] || []; }); return c; };

  async function load() {
    if (LIVE) {
      const sb = C.sb;
      const [reports, hidden, nPosts, nProfiles] = await Promise.all([
        sb.from('post_reports').select('*, post:posts!post_reports_post_id_fkey(id, kind, title, body, image_paths, hidden, hidden_reason, author_id, created_at), comment:comments!post_reports_comment_id_fkey(id, body, hidden, author_id, created_at)').order('created_at', { ascending: false }).then(unwrap),
        sb.from('posts').select('id, kind, title, body, hidden_reason, author_id, created_at').eq('hidden', true).order('created_at', { ascending: false }).limit(50).then(unwrap),
        sb.from('posts').select('id', { count: 'exact', head: true }),
        sb.from('profiles').select('id', { count: 'exact', head: true }),
      ]);
      const ids = [...new Set([...reports.flatMap(r => [r.reporter_id, r.post && r.post.author_id, r.comment && r.comment.author_id]), ...hidden.map(p => p.author_id)].filter(Boolean))];
      const people = ids.length ? unwrap(await sb.from('profiles').select('id, username, display_name').in('id', ids)) : [];
      return { reports, hidden, people: Object.fromEntries(people.map(p => [p.id, p])), nPosts: nPosts.count || 0, nProfiles: nProfiles.count || 0 };
    }
    const c = S();
    const reports = c.reports.map(r => ({ ...r, post: c.posts.find(p => p.id === r.post_id) || null, comment: r.comment_id ? c.comments.find(x => x.id === r.comment_id) || null : null }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { reports, hidden: c.posts.filter(p => p.hidden), people: Object.fromEntries(c.profiles.map(p => [p.id, p])), nPosts: c.posts.length, nProfiles: c.profiles.length };
  }

  const act = {
    async hide(table, id, hidden, reason) {
      const patch = table === 'posts' ? { hidden, hidden_reason: hidden ? reason || null : null } : { hidden };
      if (LIVE) { unwrap(await C.sb.from(table).update(patch).eq('id', id)); return; }
      const r = S()[table].find(x => x.id === id); if (r) Object.assign(r, patch); Demo.save();
    },
    async remove(table, id) {
      if (LIVE) {
        if (table === 'posts') {   // also remove its photos from storage
          const p = unwrap(await C.sb.from('posts').select('image_paths').eq('id', id).maybeSingle());
          if (p && p.image_paths && p.image_paths.length) await C.sb.storage.from('community').remove(p.image_paths);
        }
        unwrap(await C.sb.from(table).delete().eq('id', id)); return;
      }
      const c = S(); c[table] = c[table].filter(x => x.id !== id);
      if (table === 'posts') { c.comments = c.comments.filter(x => x.post_id !== id); c.reports = c.reports.filter(x => x.post_id !== id); }
      else c.reports = c.reports.filter(x => x.comment_id !== id);
      Demo.save();
    },
    async status(id, status) {
      if (LIVE) { unwrap(await C.sb.from('post_reports').update({ status }).eq('id', id)); return; }
      const r = S().reports.find(x => x.id === id); if (r) r.status = status; Demo.save();
    },
  };

  const who = (people, id) => { const p = people[id]; return p ? `${esc(p.display_name)} <span class="muted">@${esc(p.username)}</span>` : '<span class="muted">a deleted account</span>'; };
  const excerpt = t => esc(String(t || '').slice(0, 280)) + (String(t || '').length > 280 ? '…' : '');

  async function view() {
    setHeader('ROAR Community', 'Community moderation', [{ label: 'Open Community', onClick: () => window.open(portal(''), '_blank', 'noopener') }]);
    $('#view').innerHTML = '<div class="panel glass empty">Loading…</div>';
    const d = await load();
    const open = d.reports.filter(r => r.status === 'open');
    const list = show === 'open' ? open : d.reports;
    $('#view').innerHTML = `
      <p class="lead" style="margin-top:-6px">Members report posts and comments here. Hide anything that breaks the community guidelines (the author still sees it, with your reason). Delete only what must not stay, such as identifiable patient details. Reporters' names are for the Council only.</p>
      <div class="grid k4" style="margin-bottom:20px">
        <div class="kpi glass"><div class="n">${open.length}</div><div class="l">Open reports</div></div>
        <div class="kpi glass"><div class="n">${d.hidden.length}</div><div class="l">Hidden posts</div></div>
        <div class="kpi glass"><div class="n">${d.nPosts}</div><div class="l">Posts</div></div>
        <div class="kpi glass"><div class="n">${d.nProfiles}</div><div class="l">Member profiles</div></div>
      </div>
      <div class="panel glass">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <h2 style="margin:0">Reports</h2>
          <div class="chips seg"><button type="button" data-show="open" class="chip${show === 'open' ? ' on' : ''}">Open (${open.length})</button><button type="button" data-show="all" class="chip${show === 'all' ? ' on' : ''}">All (${d.reports.length})</button></div>
        </div>
        ${list.length ? list.map(r => {
          const target = r.comment_id ? r.comment : r.post;
          const table = r.comment_id ? 'comments' : 'posts';
          return `<div class="mod-item" data-id="${esc(r.id)}" data-table="${table}" data-target="${esc(target ? target.id : '')}" data-hidden="${target && target.hidden ? 1 : 0}">
            <div class="meta-row"><span class="pill ${r.status === 'open' ? 'open' : 'closed'}">${r.status}</span><span class="tag">${esc(r.reason)}</span><span class="tag tag-quiet">${r.comment_id ? 'Comment' : 'Post'}</span>${target && target.hidden ? '<span class="tag tag-quiet">Hidden</span>' : ''}</div>
            ${target ? `<div class="mod-quote">${r.post && !r.comment_id && r.post.title ? `<b>${esc(r.post.title)}</b><br>` : ''}${excerpt(target.body)}${!r.comment_id && r.post && r.post.image_paths && r.post.image_paths.length ? `<div class="muted" style="font-size:.84rem;margin-top:4px">+ ${r.post.image_paths.length} photo${r.post.image_paths.length > 1 ? 's' : ''}: open the post to check them</div>` : ''}</div>
              <div class="muted" style="font-size:.86rem">By ${who(d.people, target.author_id)} · reported by ${who(d.people, r.reporter_id)} on ${fmtDate(r.created_at)}</div>`
              : '<div class="mod-quote muted">This content has been deleted.</div>'}
            ${r.details ? `<div style="font-size:.9rem;margin-top:6px"><b>Reporter's note:</b> ${esc(r.details)}</div>` : ''}
            <div class="mod-actions">
              ${target ? `<a class="btn btn-glass small" href="${portal('p/' + encodeURIComponent(r.post_id || (r.comment && r.comment.post_id) || ''))}" target="_blank" rel="noopener">Open ↗</a>
                <button type="button" class="btn btn-glass small" data-do="hide">${target.hidden ? 'Unhide' : 'Hide'}</button>
                <button type="button" class="btn btn-glass small" data-do="delete">Delete ${r.comment_id ? 'comment' : 'post'}</button>` : ''}
              <button type="button" class="btn ${r.status === 'open' ? 'btn-primary' : 'btn-glass'} small" data-do="status">${r.status === 'open' ? 'Mark resolved' : 'Reopen'}</button>
            </div>
          </div>`;
        }).join('') : `<p class="muted" style="margin:0">${show === 'open' ? 'No open reports.' : 'No reports yet.'}</p>`}
      </div>
      <div class="panel glass">
        <h2>Hidden posts</h2>
        ${d.hidden.length ? d.hidden.map(p => `<div class="mod-item" data-table="posts" data-target="${esc(p.id)}" data-hidden="1">
          <div class="mod-quote">${p.title ? `<b>${esc(p.title)}</b><br>` : ''}${excerpt(p.body)}</div>
          <div class="muted" style="font-size:.86rem">By ${who(d.people, p.author_id)} · ${fmtDate(p.created_at)}${p.hidden_reason ? ' · reason: ' + esc(p.hidden_reason) : ''}</div>
          <div class="mod-actions"><a class="btn btn-glass small" href="${portal('p/' + encodeURIComponent(p.id))}" target="_blank" rel="noopener">Open ↗</a><button type="button" class="btn btn-glass small" data-do="hide">Unhide</button><button type="button" class="btn btn-glass small" data-do="delete">Delete post</button></div>
        </div>`).join('') : '<p class="muted" style="margin:0">Nothing is hidden.</p>'}
      </div>`;

    document.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => { show = b.dataset.show; view().catch(fail); }));
    document.querySelectorAll('.mod-item [data-do]').forEach(b => b.addEventListener('click', async () => {
      const it = b.closest('.mod-item'), table = it.dataset.table, id = it.dataset.target, hidden = it.dataset.hidden === '1';
      try {
        if (b.dataset.do === 'hide') {
          let reason = null;
          if (!hidden) { reason = prompt('Reason shown to the author (optional):', 'Breaks the community guidelines'); if (reason === null) return; }
          await act.hide(table, id, !hidden, reason);
          if (!hidden && it.dataset.id) await act.status(it.dataset.id, 'resolved');
          toast(hidden ? 'Visible again' : 'Hidden');
        } else if (b.dataset.do === 'delete') {
          if (!confirm(`Delete this ${table === 'posts' ? 'post, its photos and its comments' : 'comment'} permanently? This cannot be undone.`)) return;
          await act.remove(table, id); toast('Deleted');
        } else {
          const r = d.reports.find(x => x.id === it.dataset.id);
          await act.status(r.id, r.status === 'open' ? 'resolved' : 'open'); toast(r.status === 'open' ? 'Marked resolved' : 'Reopened');
        }
        view().catch(fail);
      } catch (e) { fail(e); }
    }));
  }

  C.register('community', () => view());
})();
