// razorpay-order: creates a Razorpay order for a member's fee, so they can pay online in My ROAR.
// NOT ACTIVE until ROAR has a Razorpay account (needs registration and a bank account). To switch on:
//   1. In Supabase: Edge Functions -> Secrets, add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.
//   2. Deploy this function and razorpay-webhook.
//   3. Put the *public* key id in website/js/config.js as payments.razorpayKeyId.
// The amount always comes from here (never from the browser), matching js/rules.js.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const FEES_RUPEES: Record<string, number> = { annual: 500, lifetime: 5000, founding: 1000 };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const keyId = Deno.env.get('RAZORPAY_KEY_ID'), secret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !secret) return Response.json({ error: 'Online payment is not set up yet.' }, { status: 503, headers: cors });

  // Who is paying: the signed-in member, from their own session token
  const userDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: cors });
  const { data: member } = await userDb.from('members').select('id, plan, status, payment_ref, paid_until').eq('user_id', user.id).maybeSingle();
  if (!member || member.status !== 'approved') return Response.json({ error: 'Your membership must be approved before you pay.' }, { status: 400, headers: cors });
  const amount = (FEES_RUPEES[member.plan] ?? 0) * 100;
  if (!amount) return Response.json({ error: 'Unknown plan.' }, { status: 400, headers: cors });

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${keyId}:${secret}`), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'INR', receipt: `roar-${member.id.slice(0, 8)}-${Date.now()}`, notes: { member_id: member.id, plan: member.plan } }),
  });
  const order = await res.json();
  if (!res.ok) return Response.json({ error: order?.error?.description || 'Could not start the payment.' }, { status: 502, headers: cors });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  await admin.from('payments').insert({ user_id: user.id, member_id: member.id, plan: member.plan, amount_paise: amount, order_id: order.id });
  return Response.json({ order_id: order.id, amount, currency: 'INR', key_id: keyId, email: user.email }, { headers: cors });
});
