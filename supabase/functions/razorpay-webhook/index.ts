// razorpay-webhook: Razorpay calls this when a payment succeeds. It checks Razorpay's signature,
// then records the payment on the member's record (schema: record_online_payment).
// NOT ACTIVE until ROAR has a Razorpay account. To switch on:
//   1. In Razorpay: Settings -> Webhooks, add this function's URL, choose the "payment.captured" event,
//      and set a webhook secret.
//   2. In Supabase: Edge Functions -> Secrets, add RAZORPAY_WEBHOOK_SECRET. Deploy with "verify JWT" turned off
//      (Razorpay can't sign in; the signature check below protects it instead).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

Deno.serve(async (req) => {
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  if (!secret) return new Response('Not configured', { status: 503 });
  const body = await req.text();
  const given = req.headers.get('x-razorpay-signature') ?? '';
  if (!same(await hmacHex(secret, body), given)) return new Response('Bad signature', { status: 401 });

  const event = JSON.parse(body);
  if (event.event !== 'payment.captured') return new Response('Ignored');
  const p = event.payload?.payment?.entity;
  if (!p?.order_id || !p?.id) return new Response('No payment', { status: 400 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await db.rpc('record_online_payment', { p_order: p.order_id, p_payment: p.id });
  if (error) return new Response(error.message, { status: 500 });
  return new Response('Recorded');
});
