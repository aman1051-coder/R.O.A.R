// ROAR membership rules from the constitution, in one place.
// The database (supabase/schema.sql) enforces the same rules; keep the two in step.
window.ROAR_RULES = (function () {
  const FEES = { annual: 500, lifetime: 5000, founding: 1000 };
  const FOUNDING_LIMIT = 20;          // Article 9
  const MAX_PAUSE_MONTHS = 24;        // Article 11: pause on the 6-year clock
  const PG_YEARS_ESTIMATE = 3;        // MD/DNB length, used until the completion date is known
  const VERIFY_DAYS = 30;             // Article 10
  const ENROL_BEFORE_ELECTION_DAYS = 60; // Article 23

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const parse = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

  // Add months the way Postgres does (31 Jan + 1 month = 28/29 Feb)
  function addMonths(s, months) {
    const d = parse(s);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + months, day = d.getUTCDate();
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return iso(new Date(Date.UTC(y, m, Math.min(day, last))));
  }
  // End of the Indian financial year (31 March) that contains the date
  function fyEnd(s) {
    const d = parse(s);
    const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
    return `${y}-03-31`;
  }

  // Article 5 and 11: voting from 1 year after PG start until the end of the financial year
  // in which 6 years after completion (plus any approved pause) falls.
  function votingWindow({ pg_start, pg_completion, clock_pause_months }) {
    if (!pg_start) return null;
    const pause = Math.min(Math.max(+clock_pause_months || 0, 0), MAX_PAUSE_MONTHS);
    const completion = pg_completion || addMonths(pg_start, PG_YEARS_ESTIMATE * 12);
    return {
      from: addMonths(pg_start, 12),
      until: fyEnd(addMonths(completion, 72 + pause)),
      estimated: !pg_completion,
      completion,
    };
  }

  // Which category an applicant falls in, from what they told us
  function category({ applying_as, pg_completion }, today = todayIST()) {
    if (applying_as === 'honorary') return 'honorary';
    if (!pg_completion || pg_completion > today) return 'resident';
    const w = votingWindow({ pg_start: '1900-01-01', pg_completion });
    return today <= w.until ? 'young_ro' : 'senior';
  }

  const CATEGORY_LABEL = {
    resident: 'Ordinary – Resident', young_ro: 'Ordinary – Young Radiation Oncologist',
    senior: 'Senior Member (non-voting)', honorary: 'Honorary Member (non-voting)',
  };
  const PLAN_LABEL = { annual: 'Annual (₹500/year)', lifetime: 'Lifetime (₹5,000)', founding: 'Founding Member (₹1,000, life)' };
  const STATUS_LABEL = { submitted: 'Submitted', under_review: 'Under verification', approved: 'Approved', rejected: 'Not approved', lapsed: 'Lapsed' };

  function isCurrent(m, today = todayIST()) {
    // Lifetime and Founding plans count once the Treasurer has recorded the payment
    if (m.fee_deferred) return true;
    if (m.plan === 'lifetime' || m.plan === 'founding') return !!m.payment_ref;
    return !!m.paid_until && m.paid_until >= today;
  }

  // Can this member vote in this ballot? Mirrors public.member_can_vote() in the database.
  function canVote(m, e, { isFounder = false, today = todayIST() } = {}) {
    if (!m || m.status !== 'approved') return { ok: false, reason: 'Your membership is not approved yet.' };
    if (isFounder) return { ok: true, reason: "Founders' Council: voting rights for life (Article 15A)." };
    if (!['resident', 'young_ro'].includes(m.category)) return { ok: false, reason: 'Senior and Honorary Members do not vote.' };
    if (!isCurrent(m, today)) return { ok: false, reason: m.plan === 'annual' && m.paid_until ? 'Your annual membership needs renewing.' : 'Your payment has not been recorded yet.' };
    const w = votingWindow(m);
    if (!w || today < w.from) return { ok: false, reason: `Your vote starts on ${w ? w.from : '—'}, 1 year after your PG start date.` };
    if (today > w.until) return { ok: false, reason: 'You have passed the 6-year voting limit.' };
    if (e && e.kind === 'election') {
      const cutoff = addMonths(String(e.opens_at).slice(0, 10), 0);
      const enrolBy = iso(new Date(parse(cutoff).getTime() - ENROL_BEFORE_ELECTION_DAYS * 864e5));
      if (!m.approved_at || String(m.approved_at).slice(0, 10) > enrolBy) return { ok: false, reason: 'You joined less than 60 days before polling (Article 23).' };
      if (!m.redeclared_at || m.redeclared_at < e.created_at) return { ok: false, reason: 'Confirm your PG dates first (Article 11).', needsRedeclare: true };
    }
    return { ok: true, reason: 'You are on the electoral roll.' };
  }

  const STATES = ['Andaman & Nicobar', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

  return { STATES, FEES, FOUNDING_LIMIT, MAX_PAUSE_MONTHS, VERIFY_DAYS, addMonths, fyEnd, votingWindow, category, isCurrent, canVote, todayIST, CATEGORY_LABEL, PLAN_LABEL, STATUS_LABEL };
})();
