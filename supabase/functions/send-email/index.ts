// send-email: sends the emails waiting in public.email_outbox (job alerts, mentorship), using Resend.
// NOT ACTIVE until ROAR has an email service. To switch on (see SETUP.md, "Email notifications"):
//   1. Create a Resend account, verify ROAR's domain, and create an API key.
//   2. In Supabase: Edge Functions -> Secrets, add RESEND_API_KEY, EMAIL_FROM (e.g. "ROAR <hello@roarindia.org>")
//      and SITE_URL (e.g. https://aman1051-coder.github.io/R.O.A.R/).
//   3. Deploy this function, then schedule it every 10 minutes (Integrations -> Cron).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async () => {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  const site = (Deno.env.get('SITE_URL') || '').replace(/\/?$/, '/');
  if (!key || !from) return new Response('Email service not configured', { status: 503 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: rows, error } = await db.from('email_outbox').select('*').is('sent_at', null).is('error', null).order('created_at').limit(50);
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const m of rows ?? []) {
    const link = m.link ? site + m.link : site;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#15233f">
      <p style="font-size:13px;letter-spacing:.2em;color:#b4500d">ROAR · RISING ONCOLOGISTS' ALLIANCE IN RADIATION ONCOLOGY</p>
      <h2 style="margin:8px 0 12px">${esc(m.subject)}</h2>
      <p style="white-space:pre-line;line-height:1.6">${esc(m.body)}</p>
      <p><a href="${esc(link)}" style="display:inline-block;background:#e8792b;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open ROAR</a></p>
      <p style="font-size:12px;color:#5c6a7f">You get this email because of your notification settings in My ROAR. <a href="${esc(site)}portal/#settings">Change them</a>.</p></div>`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [m.to_email], subject: m.subject, html, text: `${m.body}\n\n${link}` }),
    });
    if (res.ok) { sent++; await db.from('email_outbox').update({ sent_at: new Date().toISOString() }).eq('id', m.id); }
    else await db.from('email_outbox').update({ error: (await res.text()).slice(0, 500) }).eq('id', m.id);
  }
  return Response.json({ sent, checked: rows?.length ?? 0 });
});
