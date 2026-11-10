-- =====================================================================
-- ROAR: database for the website and the Founders' Council console
-- Run this whole file once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Before running, put each founder's real email in the FOUNDERS block near the bottom.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Founders' Council (Article 15A). Only people listed here can use the console.
-- ---------------------------------------------------------------------
create table if not exists public.founders (
  email        text primary key check (email = lower(email)),   -- the login: <username>@founders.roar.invalid
  username     text unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  founder_id   text unique,                                        -- FC-01 … FC-09
  name         text not null,
  cabinet_role text,                         -- e.g. President, General Secretary
  is_admin     boolean not null default false, -- can edit this list
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_founder() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.founders where email = public.my_email())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.founders where email = public.my_email() and is_admin)
$$;

-- ---------------------------------------------------------------------
-- Launch tracker (Annexure C roadmap, Article 44 early tasks, Annexure B checklist)
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) <= 300),
  phase      text not null default 'first-3-months'
             check (phase in ('first-3-months','after-registration','year-2')),
  portfolio  text,
  owner      text,
  status     text not null default 'todo' check (status in ('todo','doing','done','blocked')),
  due        date,
  notes      text check (char_length(notes) <= 5000),
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Interest / ambassador registrations from the public website form
-- ---------------------------------------------------------------------
create table if not exists public.registrations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 200),
  email       text not null check (char_length(email) between 3 and 320),
  phone       text check (char_length(phone) <= 40),
  stage       text check (char_length(stage) <= 100),
  institution text check (char_length(institution) <= 300),
  state       text check (char_length(state) <= 100),
  ambassador  boolean not null default false,
  message     text check (char_length(message) <= 3000),
  consent     boolean not null default false,
  status      text not null default 'new' check (status in ('new','contacted','ambassador','archived')),
  notes       text
);

-- ---------------------------------------------------------------------
-- Institutions and their Institutional Ambassadors (Article 22A)
-- ---------------------------------------------------------------------
create table if not exists public.institutions (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  city             text,
  state            text,
  region           text check (region in ('North','South','East','West','Central','North-East')),
  ambassador_name  text,
  ambassador_email text,
  ambassador_phone text,
  status           text not null default 'vacant' check (status in ('vacant','proposed','appointed')),
  show_public      boolean not null default false,  -- list on the public website?
  notes            text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Motions and votes (Article 32A: decisions by vote, quorum of 5 founders)
-- ---------------------------------------------------------------------
create table if not exists public.motions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  created_by   text not null default public.my_email(),
  title        text not null check (char_length(title) <= 300),
  details      text check (char_length(details) <= 8000),
  options      text[] not null default array['Yes','No','Abstain'],
  secret       boolean not null default false,
  status       text not null default 'open' check (status in ('open','closed')),
  meeting_date date,
  outcome      text
);

create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  motion_id   uuid not null references public.motions(id) on delete cascade,
  voter_email text not null default public.my_email(),
  choice      text not null,
  created_at  timestamptz not null default now(),
  unique (motion_id, voter_email)
);

-- ---------------------------------------------------------------------
-- Meetings and minutes
-- ---------------------------------------------------------------------
create table if not exists public.meetings (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null,
  title      text not null,
  location   text,
  agenda     text,
  attendees  text,
  minutes    text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Announcements shown on the public website ("Latest from ROAR")
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title      text not null check (char_length(title) <= 200),
  body       text not null check (char_length(body) <= 4000),
  published  boolean not null default false
);

-- ---------------------------------------------------------------------
-- Library: links to key documents (constitution drafts, legal papers, designs)
-- ---------------------------------------------------------------------
create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  url        text not null,
  category   text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Row Level Security: founders can manage everything; the public can only
-- submit the interest form and read published announcements / ambassadors.
-- =====================================================================
alter table public.founders      enable row level security;
alter table public.tasks         enable row level security;
alter table public.registrations enable row level security;
alter table public.institutions  enable row level security;
alter table public.motions       enable row level security;
alter table public.votes         enable row level security;
alter table public.meetings      enable row level security;
alter table public.announcements enable row level security;
alter table public.documents     enable row level security;

-- Founders list: founders read, admins edit
drop policy if exists founders_read  on public.founders;
drop policy if exists founders_write on public.founders;
create policy founders_read  on public.founders for select using (public.is_founder());
create policy founders_write on public.founders for all    using (public.is_admin()) with check (public.is_admin());

-- Founder-only tables
do $$
declare t text;
begin
  foreach t in array array['tasks','institutions','meetings','documents'] loop
    execute format('drop policy if exists %1$s_founders on public.%1$s', t);
    execute format('create policy %1$s_founders on public.%1$s for all using (public.is_founder()) with check (public.is_founder())', t);
  end loop;
end $$;

-- Motions: any founder reads and raises; only the founder who raised it, or an admin, closes or deletes it
drop policy if exists motions_read   on public.motions;
drop policy if exists motions_insert on public.motions;
drop policy if exists motions_manage on public.motions;
drop policy if exists motions_delete on public.motions;
create policy motions_read   on public.motions for select using (public.is_founder());
create policy motions_insert on public.motions for insert with check (public.is_founder() and created_by = public.my_email());
create policy motions_manage on public.motions for update
  using (public.is_founder() and (created_by = public.my_email() or public.is_admin()))
  with check (public.is_founder());
create policy motions_delete on public.motions for delete
  using (public.is_founder() and (created_by = public.my_email() or public.is_admin()));

-- Registrations: anyone may submit (with consent); only founders read or change
drop policy if exists registrations_submit   on public.registrations;
drop policy if exists registrations_founders on public.registrations;
create policy registrations_submit on public.registrations for insert to anon, authenticated
  with check (consent = true and status = 'new' and notes is null);
create policy registrations_founders on public.registrations for all
  using (public.is_founder()) with check (public.is_founder());
-- The public can only fill in the form's own fields
revoke insert on public.registrations from anon;
grant  insert (name, email, phone, stage, institution, state, ambassador, message, consent) on public.registrations to anon;

-- Announcements: public reads published ones
drop policy if exists announcements_public   on public.announcements;
drop policy if exists announcements_founders on public.announcements;
create policy announcements_public on public.announcements for select to anon, authenticated using (published);
create policy announcements_founders on public.announcements for all
  using (public.is_founder()) with check (public.is_founder());

-- Votes: one per founder per motion, changeable while the motion is open.
-- For secret ballots, a founder sees only their own vote; totals come from motion_tallies.
drop policy if exists votes_read   on public.votes;
drop policy if exists votes_insert on public.votes;
drop policy if exists votes_update on public.votes;
drop policy if exists votes_delete on public.votes;
create policy votes_read on public.votes for select using (
  public.is_founder() and (
    voter_email = public.my_email()
    or not (select m.secret from public.motions m where m.id = motion_id)
  ));
create policy votes_insert on public.votes for insert with check (
  public.is_founder() and voter_email = public.my_email()
  and exists (select 1 from public.motions m where m.id = motion_id and m.status = 'open'));
create policy votes_update on public.votes for update using (
  voter_email = public.my_email()
  and exists (select 1 from public.motions m where m.id = motion_id and m.status = 'open'))
  with check (voter_email = public.my_email());
create policy votes_delete on public.votes for delete using (
  voter_email = public.my_email()
  and exists (select 1 from public.motions m where m.id = motion_id and m.status = 'open'));

-- Vote totals (works for secret ballots too), visible to founders only
create or replace view public.motion_tallies as
  select motion_id, choice, count(*)::int as n
  from public.votes
  where public.is_founder()
  group by motion_id, choice;
revoke all on public.motion_tallies from anon;
grant select on public.motion_tallies to authenticated;

-- Public list of appointed ambassadors (no contact details)
create or replace view public.public_ambassadors as
  select name as institution, city, state, region, ambassador_name
  from public.institutions
  where status = 'appointed' and show_public and ambassador_name is not null
  order by state, name;
grant select on public.public_ambassadors to anon, authenticated;

-- =====================================================================
-- SEED DATA
-- =====================================================================

-- FOUNDERS: each founder signs in to the console with a USERNAME (no real email needed).
-- Their Supabase login address is <username>@founders.roar.invalid (a reserved domain that can never
-- receive mail). See SETUP.md step 5. Usernames can be changed here before you run the file.
insert into public.founders (email, username, founder_id, name, cabinet_role, is_admin, sort) values
  ('aakash.bellige@founders.roar.invalid', 'aakash.bellige', 'FC-01', 'Dr. Aakash Bellige', 'President', true, 1),
  ('aman.gupta@founders.roar.invalid', 'aman.gupta', 'FC-02', 'Dr. Aman Gupta', 'Chairman', true, 2),
  ('kratika.bhatia@founders.roar.invalid', 'kratika.bhatia', 'FC-03', 'Dr. Kratika Bhatia', 'General Secretary', true, 3),
  ('shriya.dhingra@founders.roar.invalid', 'shriya.dhingra', 'FC-04', 'Dr. Shriya Dhingra', 'Additional Secretary – Spokesperson', false, 4),
  ('deepika.sharma@founders.roar.invalid', 'deepika.sharma', 'FC-05', 'Dr. Deepika Sharma', 'Additional Secretary – Social Media & Surveys', false, 5),
  ('arshida.pulimala@founders.roar.invalid', 'arshida.pulimala', 'FC-06', 'Dr. Arshida Pulimala', 'Additional Secretary – Academic Society & Graphics', false, 6),
  ('arsheya.gupta@founders.roar.invalid', 'arsheya.gupta', 'FC-07', 'Dr. Arsheya Gupta', 'Additional Secretary – Research Society', false, 7),
  ('honey.sharma@founders.roar.invalid', 'honey.sharma', 'FC-08', 'Dr. Honey Sharma', 'Additional Secretary – Grievances & Legalities', false, 8),
  ('abhishek.bhadri@founders.roar.invalid', 'abhishek.bhadri', 'FC-09', 'Dr. Abhishek Bhadri', 'Additional Secretary – Treasurer & Memberships', false, 9)
on conflict (email) do nothing;

-- Launch tracker, from the 5 Nov 2026 minutes, Article 44 and Annexures B and C
insert into public.tasks (title, phase, portfolio, sort) values
  ('Appoint a resident Institutional Ambassador in every RO training institution', 'first-3-months', 'Spokesperson', 10),
  ('Design the national survey of RO residents',                                  'first-3-months', 'Social Media & Surveys', 20),
  ('Consult a lawyer on the registration pathway',                                'first-3-months', 'Grievances & Legalities', 30),
  ('Consult a CA (registration, PAN, 12A/80G)',                                   'first-3-months', 'Treasurer & Memberships', 40),
  ('Final name check: Registrar and trademark records for "ROAR"',                'first-3-months', 'Grievances & Legalities', 50),
  ('File trademark for the name and logo',                                        'first-3-months', 'Grievances & Legalities', 60),
  ('Logo design and founders'' vote',                                             'first-3-months', 'Academic Society & Graphics', 70),
  ('Open social media accounts',                                                  'first-3-months', 'Social Media & Surveys', 80),
  ('Finalise the Member Welfare Charter',                                         'first-3-months', 'Grievances & Legalities', 90),
  ('Collect ID and address proof of every founder',                               'first-3-months', 'General Secretary', 100),
  ('Registered-office proof and owner NOC',                                       'first-3-months', 'General Secretary', 110),
  ('Memorandum signed by at least 7 founders, witnessed',                         'first-3-months', 'General Secretary', 120),
  ('Affidavit on stamp paper by President or Secretary',                          'first-3-months', 'General Secretary', 130),
  ('Submit registration to the Registrar of Societies with fee',                  'first-3-months', 'General Secretary', 140),
  ('Get PAN and open the bank account (joint operation)',                         'after-registration', 'Treasurer & Memberships', 200),
  ('Apply for 12A and 80G registration',                                          'after-registration', 'Treasurer & Memberships', 210),
  ('Register the domain name',                                                    'after-registration', 'Social Media & Surveys', 220),
  ('Open online membership with document verification',                           'after-registration', 'Treasurer & Memberships', 230),
  ('Enrol the first 20 Founding Members at Rs 1,000',                             'after-registration', 'Treasurer & Memberships', 240),
  ('Circulate the first national survey',                                         'after-registration', 'Social Media & Surveys', 250),
  ('Open the grievance cell and Education Standards Desk',                        'after-registration', 'Grievances & Legalities', 260),
  ('Run the first national election under Part VI',                               'year-2', 'General Secretary', 300),
  ('Publish the first State of Young Radiation Oncologists in India report',      'year-2', 'Social Media & Surveys', 310);

-- Meetings
insert into public.meetings (starts_at, title, agenda, attendees, minutes) values
  ('2026-11-05 14:40+05:30', 'Founders'' meeting 1',
   'Vision and agenda; constitution amendments (Article 5); legalities; who can join; voting rights; membership fees; member welfare charter; executive cabinet; first 3 months.',
   'Dr A Bellige, Dr A Gupta, Dr K Bhatia, Dr D Sharma, Dr H Sharma, Dr Arshida P, Dr S Dhingra',
   'Agreed the vision, membership rules (0–6 years post PG vote; honorary members non-voting), fees (Rs 500/yr, Rs 5,000 life, first 20 founding members Rs 1,000), the executive cabinet, and first-3-month activities. Pending for next meeting: Member Welfare Charter; who can join. Adjourned 4.05 PM.'),
  ('2026-11-11 16:30+05:30', 'Founders'' meeting 2',
   'Member Welfare Charter; who can join; Minus 2 contouring.', null, null);

-- =====================================================================
-- PART 2: public portal content managed from the console
-- If you already ran an earlier version of this file, run only from here to the end.
-- =====================================================================

-- Academic calendar: ROAR's own events and other bodies' events useful to residents
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null check (char_length(title) <= 300),
  kind        text not null default 'Conference'
              check (kind in ('Conference','Workshop','Webinar','Course','Contouring session','Deadline','Meeting')),
  starts_on   date not null,
  ends_on     date,
  city        text,
  format      text not null default 'In person' check (format in ('In person','Online','Hybrid')),
  organiser   text,
  url         text check (url is null or url ~* '^https?://'),
  description text check (char_length(description) <= 4000),
  roar_event  boolean not null default false,   -- organised by ROAR itself
  published   boolean not null default false
);

-- Opportunities board: jobs, fellowships, observerships, research (Article 8O)
create table if not exists public.opportunities (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  title        text not null check (char_length(title) <= 300),
  kind         text not null default 'Job'
               check (kind in ('Job','Fellowship','Observership','Research','Scholarship')),
  organisation text,
  location     text,
  deadline     date,
  url          text check (url is null or url ~* '^https?://'),
  description  text check (char_length(description) <= 4000),
  published    boolean not null default false
);

-- Learning resources
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null check (char_length(title) <= 300),
  kind        text not null default 'Reading'
              check (kind in ('Guideline','Contouring atlas','Course','Exam prep','Tool','Reading','Video')),
  level       text not null default 'All residents' check (level in ('All residents','Junior residents','Senior residents','Early-career')),
  url         text not null check (url ~* '^https?://'),
  description text check (char_length(description) <= 2000),
  published   boolean not null default false
);

-- Contact form inbox
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 200),
  email      text not null check (char_length(email) between 3 and 320),
  topic      text check (char_length(topic) <= 60),
  message    text not null check (char_length(message) between 1 and 5000),
  consent    boolean not null default false,
  status     text not null default 'new' check (status in ('new','replied','archived')),
  notes      text
);

alter table public.events        enable row level security;
alter table public.opportunities enable row level security;
alter table public.resources     enable row level security;
alter table public.messages      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['events','opportunities','resources'] loop
    execute format('drop policy if exists %1$s_public on public.%1$s', t);
    execute format('drop policy if exists %1$s_founders on public.%1$s', t);
    execute format('create policy %1$s_public on public.%1$s for select to anon, authenticated using (published)', t);
    execute format('create policy %1$s_founders on public.%1$s for all using (public.is_founder()) with check (public.is_founder())', t);
  end loop;
end $$;

drop policy if exists messages_submit   on public.messages;
drop policy if exists messages_founders on public.messages;
create policy messages_submit on public.messages for insert to anon, authenticated
  with check (consent = true and status = 'new' and notes is null);
create policy messages_founders on public.messages for all
  using (public.is_founder()) with check (public.is_founder());
revoke insert on public.messages from anon;
grant  insert (name, email, topic, message, consent) on public.messages to anon;

-- Starter learning resources, saved as drafts for the Academic Society to review and publish
insert into public.resources (title, kind, level, url, description, published) values
  ('eContour', 'Contouring atlas', 'All residents', 'https://www.econtour.org', 'Free interactive contouring cases and atlases across disease sites.', false),
  ('ESTRO FALCON', 'Course', 'All residents', 'https://falcon.estro.org', 'ESTRO''s online contouring workshops with feedback.', false),
  ('NRG Oncology contouring atlases', 'Contouring atlas', 'Senior residents', 'https://www.nrgoncology.org', 'Consensus atlases from NRG/RTOG trials (see the CIRO section).', false);

-- =====================================================================
-- PART 3: member portal (applications, documents, membership, e-voting)
-- If you already ran an earlier version of this file, run only from here to the end.
-- =====================================================================

-- Site settings readable by everyone (e.g. whether membership applications are open)
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);
alter table public.settings enable row level security;
drop policy if exists settings_public   on public.settings;
drop policy if exists settings_founders on public.settings;
create policy settings_public   on public.settings for select to anon, authenticated using (true);
create policy settings_founders on public.settings for all using (public.is_founder()) with check (public.is_founder());
insert into public.settings (key, value) values ('membership_open', 'false') on conflict (key) do nothing;

-- Members (Part III). One row per person, linked to their login.
create sequence if not exists public.member_no_seq;

create table if not exists public.members (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid unique references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  email              text not null unique check (email = lower(email)),
  full_name          text not null check (char_length(full_name) between 2 and 200),
  phone              text check (char_length(phone) <= 40),
  applying_as        text not null default 'resident' check (applying_as in ('resident','post_pg','honorary')),
  specialty          text,                               -- honorary applicants
  course             text check (course in ('MD','DNB','Equivalent abroad','Other')),
  institution        text check (char_length(institution) <= 300),
  city               text,
  state              text,
  pg_start           date,
  pg_completion      date,                               -- null while still in PG
  id_card_path       text,                               -- files in the private 'member-docs' bucket
  proof_path         text,
  plan               text not null default 'annual' check (plan in ('annual','lifetime','founding')),
  fee_deferral_requested boolean not null default false, -- Article 8J
  declarations_at    timestamptz,                        -- accuracy, code of conduct, consent
  redeclared_at      timestamptz,                        -- Article 11(5) pre-election confirmation
  clock_pause_request text check (char_length(clock_pause_request) <= 2000),
  appeal             text check (char_length(appeal) <= 4000),

  -- Set only by founders (protected by the trigger below)
  status             text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected','lapsed')),
  category           text check (category in ('resident','young_ro','senior','honorary')),
  member_no          text unique,
  approved_at        timestamptz,
  reviewed_by        text,
  rejection_reason   text,
  paid_until         date,
  payment_ref        text,
  fee_deferred       boolean not null default false,
  clock_pause_months int not null default 0 check (clock_pause_months between 0 and 24),
  notes              text,

  -- Voting window (Articles 5 and 11), worked out by the database
  vote_from date generated always as ((pg_start + interval '1 year')::date) stored,
  vote_until date generated always as (
    make_date(
      extract(year from (coalesce(pg_completion, (pg_start + interval '3 years')::date) + make_interval(years => 6, months => clock_pause_months)))::int
      + case when extract(month from (coalesce(pg_completion, (pg_start + interval '3 years')::date) + make_interval(years => 6, months => clock_pause_months))) >= 4 then 1 else 0 end,
      3, 31)
  ) stored
);

-- Members can't change verification, payment or voting fields; founders can.
create or replace function public.protect_member_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_founder() then
    if tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
      new.approved_at := coalesce(new.approved_at, now());
      new.reviewed_by := public.my_email();
      if new.member_no is null then new.member_no := 'ROAR-' || lpad(nextval('public.member_no_seq')::text, 4, '0'); end if;
    end if;
    if new.status = 'rejected' and coalesce(trim(new.rejection_reason), '') = '' then
      raise exception 'A refusal must give reasons (Article 10)';
    end if;
    if new.plan = 'founding' and (select count(*) from public.members where plan = 'founding' and id <> new.id) >= 20 then
      raise exception 'All 20 Founding Member places are taken';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.email := public.my_email();
    new.status := 'submitted'; new.category := null; new.member_no := null; new.approved_at := null;
    new.reviewed_by := null; new.rejection_reason := null; new.paid_until := null; new.payment_ref := null;
    new.fee_deferred := false; new.clock_pause_months := 0; new.notes := null;
    if new.plan = 'founding' and (select count(*) from public.members where plan = 'founding') >= 20 then
      new.plan := 'lifetime';
    end if;
    return new;
  end if;

  -- UPDATE by the member themself
  new.user_id := old.user_id; new.email := old.email; new.category := old.category; new.member_no := old.member_no;
  new.approved_at := old.approved_at; new.reviewed_by := old.reviewed_by; new.paid_until := old.paid_until;
  new.payment_ref := old.payment_ref; new.fee_deferred := old.fee_deferred; new.clock_pause_months := old.clock_pause_months;
  new.notes := old.notes; new.rejection_reason := old.rejection_reason;
  if old.status = 'approved' then
    -- training dates and plan are locked once verified
    new.pg_start := old.pg_start; new.pg_completion := old.pg_completion; new.plan := old.plan;
    new.id_card_path := old.id_card_path; new.proof_path := old.proof_path; new.applying_as := old.applying_as;
    new.status := old.status;
  elsif old.status = 'rejected' and new.status = 'submitted' then
    null; -- resubmitting or appealing is allowed
  else
    new.status := old.status;
  end if;
  if new.plan = 'founding' and old.plan <> 'founding' then new.plan := old.plan; end if;
  return new;
end $$;

drop trigger if exists members_protect on public.members;
create trigger members_protect before insert or update on public.members
  for each row execute function public.protect_member_fields();

alter table public.members enable row level security;
drop policy if exists members_own_read   on public.members;
drop policy if exists members_own_insert on public.members;
drop policy if exists members_own_update on public.members;
drop policy if exists members_founders   on public.members;
create policy members_own_read   on public.members for select using (user_id = auth.uid() or public.is_founder());
create policy members_own_insert on public.members for insert to authenticated with check (user_id = auth.uid() or public.is_founder());
create policy members_own_update on public.members for update using (user_id = auth.uid() or public.is_founder())
  with check (user_id = auth.uid() or public.is_founder());
create policy members_founders   on public.members for delete using (public.is_founder());

-- Founding places left, for the application form
create or replace function public.founding_places_left() returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, 20 - (select count(*) from public.members where plan = 'founding' and status <> 'rejected'))::int
$$;
grant execute on function public.founding_places_left() to anon, authenticated;

-- Private storage for ID cards and allotment letters / degree certificates
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-docs', 'member-docs', false, 5242880, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

drop policy if exists member_docs_insert on storage.objects;
drop policy if exists member_docs_read   on storage.objects;
drop policy if exists member_docs_update on storage.objects;
create policy member_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'member-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy member_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'member-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_founder()));
create policy member_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'member-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- E-voting (Part VI). Secret ballot: who voted and how they voted are stored
-- in separate tables with no link and no timestamps.
-- ---------------------------------------------------------------------
create table if not exists public.elections (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  created_by  text default public.my_email(),
  title       text not null check (char_length(title) <= 300),
  description text check (char_length(description) <= 6000),
  kind        text not null default 'poll' check (kind in ('election','referendum','poll')),
  options     text[] not null,
  opens_at    timestamptz not null,
  closes_at   timestamptz not null,
  status      text not null default 'draft' check (status in ('draft','open','closed')),
  check (closes_at > opens_at + interval '72 hours' or kind <> 'election')   -- Article 25: at least 72 hours
);

create table if not exists public.ballot_receipts (
  election_id uuid not null references public.elections(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  primary key (election_id, member_id)
);

create table if not exists public.ballot_votes (
  id          uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  choice      text not null
);

alter table public.elections       enable row level security;
alter table public.ballot_receipts enable row level security;
alter table public.ballot_votes    enable row level security;

drop policy if exists elections_founders on public.elections;
drop policy if exists elections_members  on public.elections;
create policy elections_founders on public.elections for all using (public.is_founder()) with check (public.is_founder());
create policy elections_members on public.elections for select to authenticated using (
  status <> 'draft' and exists (select 1 from public.members m where m.user_id = auth.uid() and m.status = 'approved'));

drop policy if exists receipts_own on public.ballot_receipts;
create policy receipts_own on public.ballot_receipts for select using (
  member_id in (select id from public.members where user_id = auth.uid()) or public.is_founder());
-- ballot_votes has no policies at all: nobody can read or write it directly.

-- Mirrors ROAR_RULES.canVote() in js/rules.js
create or replace function public.member_can_vote(p_member uuid, p_election uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m, public.elections e
    where m.id = p_member and e.id = p_election and m.status = 'approved'
      and (
        exists (select 1 from public.founders f where f.email = m.email)
        or (
          m.category in ('resident','young_ro')
          and (m.fee_deferred or (m.plan in ('lifetime','founding') and m.payment_ref is not null) or m.paid_until >= current_date)
          and current_date between m.vote_from and m.vote_until
          and (e.kind <> 'election' or (
                m.approved_at::date <= (e.opens_at::date - 60)
                and m.redeclared_at >= e.created_at))
        )
      )
  )
$$;

create or replace function public.cast_ballot(p_election uuid, p_choice text) returns void
language plpgsql security definer set search_path = public as $$
declare e public.elections; mid uuid;
begin
  select * into e from public.elections where id = p_election;
  if e.id is null or e.status <> 'open' or now() < e.opens_at or now() > e.closes_at then
    raise exception 'This ballot is not open';
  end if;
  if not (p_choice = any (e.options)) then raise exception 'Not a valid choice'; end if;
  select id into mid from public.members where user_id = auth.uid();
  if mid is null then raise exception 'No membership found for this account'; end if;
  if not public.member_can_vote(mid, p_election) then raise exception 'You are not on the electoral roll for this ballot'; end if;
  begin
    insert into public.ballot_receipts (election_id, member_id) values (p_election, mid);
  exception when unique_violation then
    raise exception 'You have already voted in this ballot';
  end;
  insert into public.ballot_votes (election_id, choice) values (p_election, p_choice);
end $$;
grant execute on function public.cast_ballot(uuid, text) to authenticated;

-- Turnout for founders at any time; results for everyone only after closing
create or replace function public.election_stats(p_election uuid)
returns table (voted int, eligible int, results jsonb)
language plpgsql stable security definer set search_path = public as $$
declare e public.elections;
begin
  select * into e from public.elections where id = p_election;
  if e.id is null then return; end if;
  if not public.is_founder() and not (e.status = 'closed' and exists (select 1 from public.members where user_id = auth.uid() and status = 'approved')) then
    return;
  end if;
  return query select
    (select count(*)::int from public.ballot_receipts r where r.election_id = p_election),
    (select count(*)::int from public.members m where public.member_can_vote(m.id, p_election)),
    case when e.status = 'closed' then
      (select coalesce(jsonb_object_agg(choice, n), '{}'::jsonb) from (select choice, count(*) n from public.ballot_votes where election_id = p_election group by choice) t)
    else null end;
end $$;
grant execute on function public.election_stats(uuid) to authenticated;

-- Lets the portal know whether the signed-in member is a founder (lifetime vote)
create or replace function public.am_i_founder() returns boolean
language sql stable security definer set search_path = public as $$ select public.is_founder() $$;
grant execute on function public.am_i_founder() to authenticated;

-- =====================================================================
-- PART 4: national survey (anonymous responses)
-- If you already ran an earlier version of this file, run only from here to the end.
-- =====================================================================
-- No name, email, user id or IP address is stored. Only the date (not the time) is kept,
-- so responses can't be matched to when someone was seen online.
insert into public.settings (key, value) values ('survey_open', 'false') on conflict (key) do nothing;

create table if not exists public.survey_responses (
  id           uuid primary key default gen_random_uuid(),
  survey_id    text not null check (char_length(survey_id) <= 80),
  version      text not null check (char_length(version) <= 40),
  submitted_on date not null default current_date,
  answers      jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 60000)
);

alter table public.survey_responses enable row level security;
drop policy if exists survey_submit   on public.survey_responses;
drop policy if exists survey_founders on public.survey_responses;
drop policy if exists survey_founders_delete on public.survey_responses;
-- Anyone may submit while the survey is open; only founders can read results
create policy survey_submit on public.survey_responses for insert to anon, authenticated
  with check (exists (select 1 from public.settings s where s.key = 'survey_open' and s.value = 'true'::jsonb));
create policy survey_founders on public.survey_responses for select using (public.is_founder());
create policy survey_founders_delete on public.survey_responses for delete using (public.is_admin());
revoke insert on public.survey_responses from anon;
grant  insert (survey_id, version, answers) on public.survey_responses to anon;

-- =====================================================================
-- PART 5: founder usernames (for databases created before usernames existed)
-- =====================================================================
alter table public.founders add column if not exists username text unique;
alter table public.founders add column if not exists founder_id text unique;

-- =====================================================================
-- PART 6: members' area (members-only content and career help requests)
-- If you already ran an earlier version of this file, run only from here to the end.
-- =====================================================================
-- Anyone signed in to the member portal sees members-only items; the public sees only the rest.
alter table public.resources     add column if not exists members_only boolean not null default false;
alter table public.opportunities add column if not exists members_only boolean not null default false;
alter table public.events        add column if not exists members_only boolean not null default false;

do $$
declare t text;
begin
  foreach t in array array['events','opportunities','resources'] loop
    execute format('drop policy if exists %1$s_public on public.%1$s', t);
    execute format('create policy %1$s_public on public.%1$s for select to anon, authenticated using (published and (not members_only or auth.uid() is not null))', t);
  end loop;
end $$;

-- Career help desk (Article 8O): CV reviews, fellowship and job guidance, mentoring
create table if not exists public.support_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email           text not null default public.my_email(),
  name            text check (char_length(name) <= 200),
  kind            text not null check (kind in ('CV review','Fellowship guidance','Job search','Exam preparation','Observership placement','Research mentorship','Other')),
  details         text not null check (char_length(details) between 10 and 4000),
  contact_pref    text check (char_length(contact_pref) <= 200),
  status          text not null default 'new' check (status in ('new','assigned','in_progress','closed')),
  assigned_to     text,
  notes           text
);

alter table public.support_requests enable row level security;
drop policy if exists support_own_insert on public.support_requests;
drop policy if exists support_own_read   on public.support_requests;
drop policy if exists support_founders   on public.support_requests;
-- A signed-in user can ask for help and see their own requests; only founders can change them
create policy support_own_insert on public.support_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'new' and assigned_to is null and notes is null);
create policy support_own_read on public.support_requests for select using (user_id = auth.uid() or public.is_founder());
create policy support_founders on public.support_requests for all using (public.is_founder()) with check (public.is_founder());

-- =====================================================================
-- PART 7: Education and Careers are for signed-in users only
-- If you already ran an earlier version of this file, run only from here to the end.
-- =====================================================================
-- The public site shows ROAR's vision; the learning library and career listings are
-- visible only after signing in to the member portal. Events stay public (except members-only ones).
drop policy if exists resources_public on public.resources;
create policy resources_public on public.resources for select to authenticated
  using (published and auth.uid() is not null);

drop policy if exists opportunities_public on public.opportunities;
create policy opportunities_public on public.opportunities for select to authenticated
  using (published and auth.uid() is not null);
