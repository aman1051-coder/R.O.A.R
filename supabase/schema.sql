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
  ('arshida.p@founders.roar.invalid', 'arshida.p', 'FC-06', 'Dr. Arshida P', 'Additional Secretary – Academic Society & Graphics', false, 6),
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

-- =====================================================================
-- PART 8: founders choose their own password at first sign-in;
-- only the Chairman can reset or change a founder's password
-- If you already ran an earlier version of this file, run only from here to the end.
-- =====================================================================
alter table public.founders add column if not exists password_set boolean not null default false;
alter table public.founders add column if not exists can_reset_passwords boolean not null default false;
update public.founders set can_reset_passwords = true where cabinet_role = 'Chairman';

-- These two columns change only through the functions below, never by editing the founders list
revoke insert, update on public.founders from authenticated;
grant  insert (email, username, founder_id, name, cabinet_role, is_admin, sort) on public.founders to authenticated;
grant  update (email, username, founder_id, name, cabinet_role, is_admin, sort) on public.founders to authenticated;

-- Before sign-in: does this username exist, and has its founder chosen a password yet?
create or replace function public.founder_login_status(p_username text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select case when f.password_set then 'password' else 'choose_password' end
                   from public.founders f where f.username = lower(trim(p_username))), 'unknown')
$$;
grant execute on function public.founder_login_status(text) to anon, authenticated;

-- First sign-in: a founder who has not chosen a password yet sets one (no other check, by decision of the founders)
create or replace function public.founder_first_login(p_username text, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare f public.founders;
begin
  if char_length(coalesce(p_password, '')) < 10 then raise exception 'Use at least 10 characters.'; end if;
  select * into f from public.founders where username = lower(trim(p_username)) for update;
  if f.email is null then raise exception 'That username is not on the Founders'' Council list.'; end if;
  if f.password_set then raise exception 'This account already has a password. Sign in with it, or ask the Chairman to reset it.'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where lower(email) = f.email;
  if not found then raise exception 'This founder''s login has not been created in Supabase yet (SETUP.md, step 5).'; end if;
  update public.founders set password_set = true where email = f.email;
end $$;
grant execute on function public.founder_first_login(text, text) to anon, authenticated;

create or replace function public.can_reset_passwords() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.founders where email = public.my_email() and can_reset_passwords)
$$;

-- Chairman: reset, so the founder chooses a new password at their next sign-in (the old one stops working)
create or replace function public.founder_reset_password(p_username text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare f public.founders;
begin
  if not public.can_reset_passwords() then raise exception 'Only the Chairman can reset passwords.'; end if;
  select * into f from public.founders where username = lower(trim(p_username)) for update;
  if f.email is null then raise exception 'Unknown username.'; end if;
  update auth.users set encrypted_password = crypt(gen_random_uuid()::text || clock_timestamp()::text, gen_salt('bf')), updated_at = now() where lower(email) = f.email;
  update public.founders set password_set = false where email = f.email;
end $$;
grant execute on function public.founder_reset_password(text) to authenticated;

-- Chairman: set a specific password for a founder
create or replace function public.founder_set_password(p_username text, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare f public.founders;
begin
  if not public.can_reset_passwords() then raise exception 'Only the Chairman can change other founders'' passwords.'; end if;
  if char_length(coalesce(p_password, '')) < 10 then raise exception 'Use at least 10 characters.'; end if;
  select * into f from public.founders where username = lower(trim(p_username)) for update;
  if f.email is null then raise exception 'Unknown username.'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where lower(email) = f.email;
  if not found then raise exception 'This founder''s login has not been created in Supabase yet.'; end if;
  update public.founders set password_set = true where email = f.email;
end $$;
grant execute on function public.founder_set_password(text, text) to authenticated;

-- =====================================================================
-- PART 9: national surveys and polls created by the Founders' Council
-- If you already ran an earlier version of this file, run only from here to the end.
-- =====================================================================
-- Only founders can create, edit, open, close or delete surveys and polls, and read responses.
-- Each survey is for "everyone" (anyone with the link) or "members" (signed-in portal accounts only).
create table if not exists public.surveys (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),   -- used in the link: /survey/?s=<slug>
  kind         text not null default 'survey' check (kind in ('survey','poll')),
  title        text not null check (char_length(title) between 3 and 300),
  intro        text check (char_length(intro) <= 4000),
  version      text not null default '0.1',
  definition   jsonb not null default '{"sections":[]}'::jsonb check (jsonb_typeof(definition) = 'object' and pg_column_size(definition) < 500000),
  status       text not null default 'draft' check (status in ('draft','open','closed')),
  audience     text not null default 'everyone' check (audience in ('everyone','members')),
  show_results boolean not null default false,   -- polls: show totals to people after they answer
  created_by   text default public.my_email(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.surveys enable row level security;
drop policy if exists surveys_read     on public.surveys;
drop policy if exists surveys_founders on public.surveys;
-- Anyone can read a survey that is open or closed (to answer it); drafts are visible to founders only
create policy surveys_read on public.surveys for select to anon, authenticated
  using (status <> 'draft' or public.is_founder());
create policy surveys_founders on public.surveys for all using (public.is_founder()) with check (public.is_founder());

-- Responses: only to an open survey; members-only surveys need a signed-in account
drop policy if exists survey_submit on public.survey_responses;
create policy survey_submit on public.survey_responses for insert to anon, authenticated
  with check (exists (
    select 1 from public.surveys s
    where s.slug = survey_id and s.status = 'open' and (s.audience = 'everyone' or auth.uid() is not null)));
-- Founders can delete responses (for example test answers), not only admins
drop policy if exists survey_founders_delete on public.survey_responses;
create policy survey_founders_delete on public.survey_responses for delete using (public.is_founder());

-- Poll totals for respondents, only when the founders chose to show them
create or replace function public.poll_results(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.surveys; q text;
begin
  select * into s from public.surveys where slug = p_slug;
  if s.id is null or s.kind <> 'poll' or s.status = 'draft' or not s.show_results then return null; end if;
  q := s.definition -> 'sections' -> 0 -> 'questions' -> 0 ->> 'id';
  return jsonb_build_object(
    'total', (select count(*) from public.survey_responses where survey_id = p_slug),
    'counts', (select coalesce(jsonb_object_agg(choice, n), '{}'::jsonb) from (
      select choice, count(*) as n from (
        select r.answers ->> q as choice from public.survey_responses r
          where r.survey_id = p_slug and jsonb_typeof(r.answers -> q) = 'string'
        union all
        select e from public.survey_responses r, jsonb_array_elements_text(r.answers -> q) e
          where r.survey_id = p_slug and jsonb_typeof(r.answers -> q) = 'array') x
      group by choice) t));
end $$;
grant execute on function public.poll_results(text) to anon, authenticated;

-- =====================================================================
-- PART 10: create the founders' logins
-- Creates a Supabase login for every founder on the list who doesn't have one yet,
-- with a random password nobody knows. Each founder then claims their account by
-- choosing their own password at their first sign-in (PART 8).
-- Safe to run again: it only adds logins that are missing.
-- =====================================================================
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', f.email,
       crypt(gen_random_uuid()::text || clock_timestamp()::text, gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', f.name, 'founder_id', f.founder_id),
       now(), now(), '', '', '', ''
from public.founders f
where not exists (select 1 from auth.users u where lower(u.email) = f.email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
join public.founders f on lower(u.email) = f.email
where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

-- Founders who are added later (e.g. a past President filling a vacancy) get a login automatically
create or replace function public.create_founder_login() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  if exists (select 1 from auth.users where lower(email) = new.email) then return new; end if;
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', new.email,
          crypt(gen_random_uuid()::text || clock_timestamp()::text, gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', new.name, 'founder_id', new.founder_id),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', new.email, 'email_verified', true), 'email', now(), now(), now());
  return new;
end $$;
drop trigger if exists founders_create_login on public.founders;
create trigger founders_create_login after insert on public.founders
  for each row execute function public.create_founder_login();

-- =====================================================================
-- PART 11: ROAR Community (members' social space)
-- Profiles with unique usernames and profile pictures, posts with photos,
-- comments, likes, and reports. Visible only to signed-in accounts.
-- Founders moderate (hide posts and comments, review reports).
-- If you already ran an earlier version of this file, run only from here to the end.
-- =====================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  username      text not null check (username ~ '^[a-z0-9._]{3,30}$'),
  display_name  text not null check (char_length(display_name) between 2 and 80),
  bio           text check (char_length(bio) <= 500),
  institution   text check (char_length(institution) <= 200),
  stage         text check (char_length(stage) <= 80),        -- e.g. "PG resident, year 2"
  avatar_path   text,                                         -- in the private 'community' bucket
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null default 'general' check (kind in ('question','article','case','news','general')),
  title       text check (char_length(title) <= 200),
  body        text not null check (char_length(body) between 1 and 10000),
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 4),
  link_url    text check (link_url is null or link_url ~* '^https?://'),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  hidden      boolean not null default false,                 -- set by founders (moderation)
  hidden_reason text
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now(),
  hidden     boolean not null default false
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.posts(id) on delete cascade,
  comment_id  uuid references public.comments(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason      text not null check (reason in ('Patient privacy','Harassment or disrespect','Misinformation','Spam or advertising','Other')),
  details     text check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open','resolved')),
  created_at  timestamptz not null default now(),
  check (post_id is not null or comment_id is not null)
);

-- Badges shown next to names: Founder (Founders' Council) and Member (approved membership)
create or replace function public.community_badges(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'founder', exists (select 1 from auth.users u join public.founders f on f.email = lower(u.email) where u.id = p_user),
    'founder_id', (select f.founder_id from auth.users u join public.founders f on f.email = lower(u.email) where u.id = p_user),
    'member', exists (select 1 from public.members m where m.user_id = p_user and m.status = 'approved'))
$$;
grant execute on function public.community_badges(uuid) to authenticated;
-- The same for many people at once (one call per page of the feed): { "<user id>": {founder, founder_id, member} }
create or replace function public.community_badges_for(p_users uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(u.id, jsonb_build_object(
    'founder', f.founder_id is not null,
    'founder_id', f.founder_id,
    'member', exists (select 1 from public.members m where m.user_id = u.id and m.status = 'approved'))), '{}'::jsonb)
  from auth.users u left join public.founders f on f.email = lower(u.email)
  where u.id = any(p_users) and auth.uid() is not null
$$;
grant execute on function public.community_badges_for(uuid[]) to authenticated;

-- Members can't hide or un-hide their own content; only founders can
create or replace function public.protect_community_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_founder() then return new; end if;
  if tg_op = 'INSERT' then
    new.hidden := false;
    if tg_table_name = 'posts' then new.hidden_reason := null; new.edited_at := null; end if;
    return new;
  end if;
  new.hidden := old.hidden;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  if tg_table_name = 'posts' then new.hidden_reason := old.hidden_reason; new.edited_at := now(); end if;
  return new;
end $$;
drop trigger if exists posts_protect on public.posts;
create trigger posts_protect before insert or update on public.posts for each row execute function public.protect_community_fields();
drop trigger if exists comments_protect on public.comments;
create trigger comments_protect before insert or update on public.comments for each row execute function public.protect_community_fields();

alter table public.profiles     enable row level security;
alter table public.posts        enable row level security;
alter table public.comments     enable row level security;
alter table public.post_likes   enable row level security;
alter table public.post_reports enable row level security;

drop policy if exists profiles_read  on public.profiles;
drop policy if exists profiles_own   on public.profiles;
drop policy if exists profiles_edit  on public.profiles;
drop policy if exists profiles_del   on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (auth.uid() is not null);
create policy profiles_own  on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_edit on public.profiles for update to authenticated using (id = auth.uid() or public.is_founder()) with check (id = auth.uid() or public.is_founder());
create policy profiles_del  on public.profiles for delete to authenticated using (id = auth.uid() or public.is_founder());

drop policy if exists posts_read   on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_update on public.posts;
drop policy if exists posts_delete on public.posts;
create policy posts_read   on public.posts for select to authenticated using (not hidden or author_id = auth.uid() or public.is_founder());
create policy posts_insert on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy posts_update on public.posts for update to authenticated using (author_id = auth.uid() or public.is_founder()) with check (true);
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid() or public.is_founder());

drop policy if exists comments_read   on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_update on public.comments;
drop policy if exists comments_delete on public.comments;
create policy comments_read   on public.comments for select to authenticated using (not hidden or author_id = auth.uid() or public.is_founder());
create policy comments_insert on public.comments for insert to authenticated with check (author_id = auth.uid()
  and exists (select 1 from public.posts p where p.id = post_id and not p.hidden));
create policy comments_update on public.comments for update to authenticated using (author_id = auth.uid() or public.is_founder()) with check (true);
create policy comments_delete on public.comments for delete to authenticated using (author_id = auth.uid() or public.is_founder());

drop policy if exists likes_read   on public.post_likes;
drop policy if exists likes_insert on public.post_likes;
drop policy if exists likes_delete on public.post_likes;
create policy likes_read   on public.post_likes for select to authenticated using (auth.uid() is not null);
create policy likes_insert on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy likes_delete on public.post_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists reports_insert   on public.post_reports;
drop policy if exists reports_founders on public.post_reports;
create policy reports_insert on public.post_reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy reports_founders on public.post_reports for all using (public.is_founder()) with check (public.is_founder());

-- Private photo storage: anyone signed in can view; you can add or remove only your own files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists community_read   on storage.objects;
drop policy if exists community_insert on storage.objects;
drop policy if exists community_delete on storage.objects;
create policy community_read on storage.objects for select to authenticated
  using (bucket_id = 'community' and auth.uid() is not null);
create policy community_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);
create policy community_delete on storage.objects for delete to authenticated
  using (bucket_id = 'community' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_founder()));

-- =====================================================================
-- PART 12: ROAR Community, second release
-- Topics, hashtags, quote posts, polls, pinned posts and accepted answers on posts;
-- threaded replies and up/down votes on comments; follows, saved posts, 24-hour stories
-- and notifications. Needs PART 11. Safe to run again. If the rest is already in place,
-- run only from here to the end.
-- =====================================================================
alter table public.posts add column if not exists topic text not null default 'general';
alter table public.posts drop constraint if exists posts_topic_check;
alter table public.posts add constraint posts_topic_check check (topic in ('general','headneck','breast','cns','thoracic','gi','gu','gynae','heme','paeds','palliative','sbrt','brachy','physics','contouring','exams','careers','research','wellbeing'));
alter table public.posts add column if not exists hashtags text[] not null default '{}';
alter table public.posts add column if not exists quote_of uuid references public.posts(id) on delete set null;
alter table public.posts add column if not exists poll jsonb;     -- {"options": ["A","B"], "ends_at": "..."}
alter table public.posts drop constraint if exists posts_poll_check;
alter table public.posts add constraint posts_poll_check check (poll is null or (jsonb_typeof(poll->'options') = 'array' and jsonb_array_length(poll->'options') between 2 and 4));
alter table public.posts add column if not exists pinned boolean not null default false;   -- founders only
alter table public.posts add column if not exists accepted_comment_id uuid references public.comments(id) on delete set null;
create index if not exists posts_hashtags_idx on public.posts using gin (hashtags);
create index if not exists posts_topic_idx on public.posts (topic, created_at desc);
create index if not exists posts_quote_idx on public.posts (quote_of);

alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments (parent_id);

-- Hashtags are read from the text; members can't pin, hide or change a poll; answers and replies must belong to the post
create or replace function public.protect_community_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'posts' then
    new.hashtags := coalesce((select array_agg(distinct t) from (
      select lower(m[2]) t from regexp_matches(coalesce(new.title, '') || ' ' || new.body, '(^|[^A-Za-z0-9_&/])#([A-Za-z][A-Za-z0-9_]{1,39})', 'g') m limit 20) s), '{}');
    if new.accepted_comment_id is not null and (tg_op = 'INSERT' or new.accepted_comment_id is distinct from old.accepted_comment_id)
       and not exists (select 1 from public.comments c where c.id = new.accepted_comment_id and c.post_id = new.id) then
      raise exception 'That answer belongs to another post';
    end if;
  elsif tg_op = 'INSERT' and new.parent_id is not null
       and not exists (select 1 from public.comments c where c.id = new.parent_id and c.post_id = new.post_id) then
    raise exception 'That reply belongs to another post';
  end if;
  if public.is_founder() then return new; end if;
  if tg_op = 'INSERT' then
    new.hidden := false;
    if tg_table_name = 'posts' then new.hidden_reason := null; new.edited_at := null; new.pinned := false; new.accepted_comment_id := null; end if;
    return new;
  end if;
  new.hidden := old.hidden;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  if tg_table_name = 'posts' then
    new.hidden_reason := old.hidden_reason; new.pinned := old.pinned; new.quote_of := old.quote_of; new.poll := old.poll;
    if new.body is distinct from old.body or new.title is distinct from old.title then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  else
    new.post_id := old.post_id; new.parent_id := old.parent_id;
  end if;
  return new;
end $$;

create table if not exists public.comment_votes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create table if not exists public.follows (
  follower_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);
create table if not exists public.bookmarks (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.poll_votes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  option     smallint not null check (option between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.stories (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  image_path text not null,
  caption    text check (char_length(caption) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists stories_live_idx on public.stories (expires_at desc);
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('like','comment','reply','follow','mention','quote','accepted')),
  post_id    uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- Stories always last 24 hours from when they're shared
create or replace function public.stories_fix_times() returns trigger language plpgsql as $$
begin new.created_at := now(); new.expires_at := now() + interval '24 hours'; return new; end $$;
drop trigger if exists stories_times on public.stories;
create trigger stories_times before insert on public.stories for each row execute function public.stories_fix_times();

alter table public.comment_votes enable row level security;
alter table public.follows       enable row level security;
alter table public.bookmarks     enable row level security;
alter table public.poll_votes    enable row level security;
alter table public.stories       enable row level security;
alter table public.notifications enable row level security;

drop policy if exists cvotes_read on public.comment_votes;
drop policy if exists cvotes_own  on public.comment_votes;
create policy cvotes_read on public.comment_votes for select to authenticated using (auth.uid() is not null);
create policy cvotes_own  on public.comment_votes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists follows_read   on public.follows;
drop policy if exists follows_insert on public.follows;
drop policy if exists follows_delete on public.follows;
create policy follows_read   on public.follows for select to authenticated using (auth.uid() is not null);
create policy follows_insert on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

drop policy if exists bookmarks_own on public.bookmarks;
create policy bookmarks_own on public.bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Poll votes are secret: you see only your own; totals come from post_poll_results(). One vote per poll, no changes.
drop policy if exists pvotes_read   on public.poll_votes;
drop policy if exists pvotes_insert on public.poll_votes;
create policy pvotes_read   on public.poll_votes for select to authenticated using (user_id = auth.uid());
create policy pvotes_insert on public.poll_votes for insert to authenticated with check (user_id = auth.uid()
  and exists (select 1 from public.posts p where p.id = post_id and p.poll is not null and not p.hidden
    and option < jsonb_array_length(p.poll->'options')
    and (p.poll->>'ends_at' is null or (p.poll->>'ends_at')::timestamptz > now())));

drop policy if exists stories_read   on public.stories;
drop policy if exists stories_insert on public.stories;
drop policy if exists stories_delete on public.stories;
create policy stories_read   on public.stories for select to authenticated using (expires_at > now() or author_id = auth.uid() or public.is_founder());
create policy stories_insert on public.stories for insert to authenticated with check (author_id = auth.uid());
create policy stories_delete on public.stories for delete to authenticated using (author_id = auth.uid() or public.is_founder());

-- Notifications are written only by the triggers below; you read and clear your own
drop policy if exists notif_read   on public.notifications;
drop policy if exists notif_update on public.notifications;
drop policy if exists notif_delete on public.notifications;
create policy notif_read   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Poll totals for a page of posts: { "<post id>": {counts: [..], total, mine} }
create or replace function public.post_poll_results(p_posts uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(x.id, jsonb_build_object('counts', x.counts, 'total', x.total, 'mine', x.mine)), '{}'::jsonb)
  from (
    select p.id,
      (select coalesce(jsonb_agg((select count(*) from public.poll_votes v where v.post_id = p.id and v.option = i) order by i), '[]'::jsonb)
         from generate_series(0, jsonb_array_length(p.poll->'options') - 1) i) counts,
      (select count(*) from public.poll_votes v where v.post_id = p.id) total,
      (select v.option from public.poll_votes v where v.post_id = p.id and v.user_id = auth.uid()) mine
    from public.posts p
    where p.id = any(p_posts) and p.poll is not null and auth.uid() is not null
      and (not p.hidden or p.author_id = auth.uid() or public.is_founder())
  ) x
$$;
grant execute on function public.post_poll_results(uuid[]) to authenticated;

-- Trending hashtags (only posts the caller can see count)
create or replace function public.community_trending(p_days int default 7) returns table (tag text, n bigint)
language sql stable set search_path = public as $$
  select t, count(*) from public.posts, unnest(hashtags) t
  where created_at > now() - make_interval(days => p_days)
  group by t order by 2 desc, 1 limit 10
$$;
grant execute on function public.community_trending(int) to authenticated;

-- Notifications
create or replace function public.community_notify(p_user uuid, p_actor uuid, p_kind text, p_post uuid, p_comment uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_kind in ('like', 'follow') then   -- like, unlike, like again: one notification
    delete from public.notifications where user_id = p_user and actor_id = p_actor and kind = p_kind and post_id is not distinct from p_post;
  end if;
  insert into public.notifications (user_id, actor_id, kind, post_id, comment_id) values (p_user, p_actor, p_kind, p_post, p_comment);
end $$;
create or replace function public.community_mentions(p_text text, p_actor uuid, p_post uuid, p_comment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct pr.id from (
      select rtrim(lower(m[2]), '.') u from regexp_matches(coalesce(p_text, ''), '(^|[^A-Za-z0-9_.])@([A-Za-z0-9._]{3,30})', 'g') m limit 10) s
    join public.profiles pr on pr.username = s.u loop
    perform public.community_notify(r.id, p_actor, 'mention', p_post, p_comment);
  end loop;
end $$;
revoke execute on function public.community_notify(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.community_mentions(text, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.community_on_like() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.community_notify((select author_id from public.posts where id = new.post_id), new.user_id, 'like', new.post_id, null);
  return null;
end $$;
create or replace function public.community_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare post_author uuid; parent_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    perform public.community_notify(parent_author, new.author_id, 'reply', new.post_id, new.id);
  end if;
  if post_author is distinct from parent_author then
    perform public.community_notify(post_author, new.author_id, 'comment', new.post_id, new.id);
  end if;
  perform public.community_mentions(new.body, new.author_id, new.post_id, new.id);
  return null;
end $$;
create or replace function public.community_on_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.quote_of is not null then
      perform public.community_notify((select author_id from public.posts where id = new.quote_of), new.author_id, 'quote', new.id, null);
    end if;
    perform public.community_mentions(coalesce(new.title, '') || ' ' || new.body, new.author_id, new.id, null);
  elsif new.accepted_comment_id is not null and new.accepted_comment_id is distinct from old.accepted_comment_id then
    perform public.community_notify((select author_id from public.comments where id = new.accepted_comment_id), new.author_id, 'accepted', new.id, new.accepted_comment_id);
  end if;
  return null;
end $$;
create or replace function public.community_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.community_notify(new.followee_id, new.follower_id, 'follow', null, null);
  return null;
end $$;
revoke execute on function public.community_on_like() from public, anon, authenticated;
revoke execute on function public.community_on_comment() from public, anon, authenticated;
revoke execute on function public.community_on_post() from public, anon, authenticated;
revoke execute on function public.community_on_follow() from public, anon, authenticated;

drop trigger if exists post_likes_notify on public.post_likes;
create trigger post_likes_notify after insert on public.post_likes for each row execute function public.community_on_like();
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute function public.community_on_comment();
drop trigger if exists posts_notify on public.posts;
create trigger posts_notify after insert or update of accepted_comment_id on public.posts for each row execute function public.community_on_post();
drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows for each row execute function public.community_on_follow();

-- =====================================================================
-- PART 13: Founders' photos on the public website
-- The profile picture a founder uploads to ROAR Community is shown wherever the founders are listed
-- (the About page and the Founders' console). Only founders' current profile pictures become readable
-- without signing in; every other Community photo stays private. Needs PART 11. Safe to run again.
-- =====================================================================
create or replace function public.is_founder_avatar(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join auth.users u on u.id = p.id
    join public.founders f on f.email = lower(u.email)
    where p.avatar_path = p_path)
$$;
grant execute on function public.is_founder_avatar(text) to anon, authenticated;

create or replace function public.public_founder_photos() returns table (founder_id text, avatar_path text)
language sql stable security definer set search_path = public as $$
  select f.founder_id, p.avatar_path
  from public.founders f
  join auth.users u on lower(u.email) = f.email
  join public.profiles p on p.id = u.id
  where p.avatar_path is not null and f.founder_id is not null
  order by f.founder_id
$$;
grant execute on function public.public_founder_photos() to anon, authenticated;

drop policy if exists community_founder_photos on storage.objects;
create policy community_founder_photos on storage.objects for select to anon, authenticated
  using (bucket_id = 'community' and public.is_founder_avatar(name));

-- =====================================================================
-- PART 14: renaming founders safely, and the public list of founders
-- * Usernames are stored in lower case and matched without regard to case ("Arshida.P" = "arshida.p").
-- * When a founder's username (and so their login address) changes, their login moves with it,
--   along with their votes and the records they created, so they can still sign in and set a password.
-- * Repairs any founder whose username was changed before this part existed.
-- * public_founders(): names, roles and photos for the public website, so a change in the console
--   shows everywhere without editing the site.
-- Safe to run again.
-- =====================================================================
create or replace function public.founders_normalise() returns trigger
language plpgsql as $$
begin
  new.username := lower(trim(new.username));
  new.email := lower(trim(new.email));
  return new;
end $$;
drop trigger if exists founders_normalise on public.founders;
create trigger founders_normalise before insert or update on public.founders
  for each row execute function public.founders_normalise();

-- Move a founder's login and records from one address to another
create or replace function public.founder_move_login(p_old text, p_new text, p_founder_id text, p_name text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  if p_old is null or p_new is null or lower(p_old) = lower(p_new) then return; end if;
  select id into uid from auth.users where lower(email) = lower(p_new);
  if uid is null then
    select id into uid from auth.users where lower(email) = lower(p_old);
    if uid is null and p_founder_id is not null then   -- found by the Founder ID stored when the login was created
      select id into uid from auth.users where raw_user_meta_data ->> 'founder_id' = p_founder_id
        and lower(email) like '%@founders.roar.invalid' order by created_at limit 1;
    end if;
    if uid is not null then
      update auth.users set email = lower(p_new), updated_at = now(),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', p_name, 'founder_id', p_founder_id)
        where id = uid;
      update auth.identities set identity_data = identity_data || jsonb_build_object('email', lower(p_new)), updated_at = now()
        where user_id = uid and provider = 'email';
    end if;
  end if;
  -- Records that point at a founder by address
  update public.votes    set voter_email = lower(p_new) where voter_email = lower(p_old);
  update public.motions  set created_by  = lower(p_new) where created_by  = lower(p_old);
  update public.surveys  set created_by  = lower(p_new) where created_by  = lower(p_old);
  update public.members  set reviewed_by = lower(p_new) where reviewed_by = lower(p_old);
end $$;
revoke execute on function public.founder_move_login(text, text, text, text) from public, anon, authenticated;

create or replace function public.founders_follow_rename() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.email is distinct from old.email then
    perform public.founder_move_login(old.email, new.email, new.founder_id, new.name);
  end if;
  return new;
end $$;
revoke execute on function public.founders_follow_rename() from public, anon, authenticated;
drop trigger if exists founders_follow_rename on public.founders;
create trigger founders_follow_rename after update of email on public.founders
  for each row execute function public.founders_follow_rename();

-- Look up usernames without regard to case
create or replace function public.founder_login_status(p_username text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select case when f.password_set then 'password' else 'choose_password' end
                   from public.founders f where lower(f.username) = lower(trim(p_username))), 'unknown')
$$;
create or replace function public.founder_first_login(p_username text, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare f public.founders;
begin
  if char_length(coalesce(p_password, '')) < 10 then raise exception 'Use at least 10 characters.'; end if;
  select * into f from public.founders where lower(username) = lower(trim(p_username)) for update;
  if f.email is null then raise exception 'That username is not on the Founders'' Council list.'; end if;
  if f.password_set then raise exception 'This account already has a password. Sign in with it, or ask the Chairman to reset it.'; end if;
  if not exists (select 1 from auth.users where lower(email) = f.email) then   -- login still under an older address: bring it back
    perform public.founder_move_login('missing@founders.roar.invalid', f.email, f.founder_id, f.name);
  end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where lower(email) = f.email;
  if not found then raise exception 'This founder''s login could not be found. Ask the Chairman to check the Founders page.'; end if;
  update public.founders set password_set = true where email = f.email;
end $$;
create or replace function public.founder_reset_password(p_username text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare f public.founders;
begin
  if not public.can_reset_passwords() then raise exception 'Only the Chairman can reset passwords.'; end if;
  select * into f from public.founders where lower(username) = lower(trim(p_username)) for update;
  if f.email is null then raise exception 'Unknown username.'; end if;
  update auth.users set encrypted_password = crypt(gen_random_uuid()::text || clock_timestamp()::text, gen_salt('bf')), updated_at = now() where lower(email) = f.email;
  update public.founders set password_set = false where email = f.email;
end $$;
create or replace function public.founder_set_password(p_username text, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare f public.founders;
begin
  if not public.can_reset_passwords() then raise exception 'Only the Chairman can change other founders'' passwords.'; end if;
  if char_length(coalesce(p_password, '')) < 10 then raise exception 'Use at least 10 characters.'; end if;
  select * into f from public.founders where lower(username) = lower(trim(p_username)) for update;
  if f.email is null then raise exception 'Unknown username.'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where lower(email) = f.email;
  if not found then raise exception 'This founder''s login could not be found.'; end if;
  update public.founders set password_set = true where email = f.email;
end $$;

-- Repair: founders whose username was changed before this part existed get their login back
do $$
declare f record;
begin
  for f in select * from public.founders fo where not exists (select 1 from auth.users u where lower(u.email) = fo.email) loop
    perform public.founder_move_login('unknown@founders.roar.invalid', f.email, f.founder_id, f.name);
  end loop;
end $$;
-- Founders with still no login at all (never created): create one, as PART 10 does
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', f.email,
       crypt(gen_random_uuid()::text || clock_timestamp()::text, gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', f.name, 'founder_id', f.founder_id),
       now(), now(), '', '', '', ''
from public.founders f where not exists (select 1 from auth.users u where lower(u.email) = f.email);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u join public.founders f on lower(u.email) = f.email
where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

-- Founder ID sign-in (FC-06) is resolved by the database, so renaming a founder never breaks it
create or replace function public.founder_username(p_login text) returns text
language sql stable security definer set search_path = public as $$
  select f.username from public.founders f
  where lower(f.username) = lower(trim(p_login))
     or upper(replace(f.founder_id, ' ', '')) = upper(regexp_replace(trim(p_login), '^fc-?0?([1-9])$', 'FC-0\1', 'i'))
  order by (lower(f.username) = lower(trim(p_login))) desc
  limit 1
$$;
grant execute on function public.founder_username(text) to anon, authenticated;

-- The public list of founders (names, roles and Community photos) for the website
create or replace function public.public_founders() returns table (founder_id text, name text, cabinet_role text, avatar_path text, sort int)
language sql stable security definer set search_path = public as $$
  select f.founder_id, f.name, f.cabinet_role, p.avatar_path, f.sort::int
  from public.founders f
  left join auth.users u on lower(u.email) = f.email
  left join public.profiles p on p.id = u.id
  where f.founder_id is not null
  order by f.sort nulls last, f.founder_id
$$;
grant execute on function public.public_founders() to anon, authenticated;

-- =====================================================================
-- PART 15: My ROAR — mentorship, CME and certificates, research projects,
-- job alerts and email notifications, and online payments
-- Needs PARTs 1-14. Safe to run again.
-- =====================================================================

-- ---------------------------------------------------------------- Mentorship
-- Experienced members offer to mentor; the Founders' Council approves each mentor before they are listed.
create table if not exists public.mentors (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  headline     text check (char_length(headline) <= 160),            -- e.g. "Consultant, thoracic and SBRT"
  areas        text[] not null default '{}' check (cardinality(areas) <= 10),
  offers       text[] not null default '{}' check (cardinality(offers) <= 8 and offers <@ array['CV review','Fellowship guidance','Exam preparation','Research','Career planning','Observership','Wellbeing']),
  institution  text check (char_length(institution) <= 200),
  city         text check (char_length(city) <= 80),
  capacity     int not null default 2 check (capacity between 0 and 10),
  bio          text check (char_length(bio) <= 1200),
  status       text not null default 'pending' check (status in ('pending','approved','paused')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create table if not exists public.mentorship_requests (
  id          uuid primary key default gen_random_uuid(),
  mentee_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mentee_name text not null check (char_length(mentee_name) between 2 and 120),
  mentor_id   uuid not null references public.mentors(user_id) on delete cascade,
  topic       text not null check (topic in ('CV review','Fellowship guidance','Exam preparation','Research','Career planning','Observership','Wellbeing')),
  message     text not null check (char_length(message) between 10 and 2000),
  status      text not null default 'pending' check (status in ('pending','accepted','declined','closed','withdrawn')),
  mentor_note text check (char_length(mentor_note) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (mentee_id <> mentor_id)
);
create index if not exists mentorship_mentor_idx on public.mentorship_requests (mentor_id, status);
create index if not exists mentorship_mentee_idx on public.mentorship_requests (mentee_id, created_at desc);

create or replace function public.mentors_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.is_founder() then return new; end if;
  if tg_op = 'INSERT' then new.status := 'pending'; new.user_id := auth.uid(); return new; end if;
  -- A mentor can pause or resume themselves, but only founders approve
  if not (old.status in ('approved','paused') and new.status in ('approved','paused')) then new.status := old.status; end if;
  new.user_id := old.user_id; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists mentors_guard on public.mentors;
create trigger mentors_guard before insert or update on public.mentors for each row execute function public.mentors_guard();

create or replace function public.mentorship_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.mentors; open_count int;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    select * into m from public.mentors where user_id = new.mentor_id;
    if m.user_id is null or m.status <> 'approved' then raise exception 'That mentor is not taking requests right now.'; end if;
    select count(*) into open_count from public.mentorship_requests where mentee_id = new.mentee_id and status = 'pending';
    if open_count >= 3 then raise exception 'You already have 3 requests waiting for an answer. Withdraw one, or wait for a reply.'; end if;
    new.status := 'pending'; new.mentor_note := null;
    return new;
  end if;
  if public.is_founder() then return new; end if;
  new.mentee_id := old.mentee_id; new.mentor_id := old.mentor_id; new.topic := old.topic; new.message := old.message;
  new.mentee_name := old.mentee_name; new.created_at := old.created_at;
  if auth.uid() = old.mentor_id then
    if new.status not in ('accepted','declined','closed') or (old.status not in ('pending','accepted') ) then new.status := old.status; end if;
  elsif auth.uid() = old.mentee_id then
    new.mentor_note := old.mentor_note;
    if new.status not in ('withdrawn','closed') or old.status not in ('pending','accepted') then new.status := old.status; end if;
  else
    raise exception 'Not your request.';
  end if;
  return new;
end $$;
drop trigger if exists mentorship_guard on public.mentorship_requests;
create trigger mentorship_guard before insert or update on public.mentorship_requests for each row execute function public.mentorship_guard();

alter table public.mentors enable row level security;
alter table public.mentorship_requests enable row level security;
drop policy if exists mentors_read on public.mentors;
drop policy if exists mentors_own on public.mentors;
drop policy if exists mentors_edit on public.mentors;
drop policy if exists mentors_founders on public.mentors;
create policy mentors_read on public.mentors for select to authenticated using (status = 'approved' or user_id = auth.uid() or public.is_founder());
create policy mentors_own on public.mentors for insert to authenticated with check (user_id = auth.uid());
create policy mentors_edit on public.mentors for update to authenticated using (user_id = auth.uid() or public.is_founder()) with check (user_id = auth.uid() or public.is_founder());
create policy mentors_founders on public.mentors for delete to authenticated using (user_id = auth.uid() or public.is_founder());
drop policy if exists mreq_read on public.mentorship_requests;
drop policy if exists mreq_insert on public.mentorship_requests;
drop policy if exists mreq_update on public.mentorship_requests;
create policy mreq_read on public.mentorship_requests for select to authenticated using (mentee_id = auth.uid() or mentor_id = auth.uid() or public.is_founder());
create policy mreq_insert on public.mentorship_requests for insert to authenticated with check (mentee_id = auth.uid());
create policy mreq_update on public.mentorship_requests for update to authenticated using (mentee_id = auth.uid() or mentor_id = auth.uid() or public.is_founder()) with check (true);

-- Once a request is accepted, mentor and mentee can see each other's email address
create or replace function public.mentorship_contacts(p_request uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('mentee_email', me.email, 'mentor_email', mo.email)
  from public.mentorship_requests r join auth.users me on me.id = r.mentee_id join auth.users mo on mo.id = r.mentor_id
  where r.id = p_request and r.status = 'accepted' and auth.uid() in (r.mentee_id, r.mentor_id)
$$;
grant execute on function public.mentorship_contacts(uuid) to authenticated;

-- ---------------------------------------------------------------- CME: check-in codes, attendance, certificates, personal log
alter table public.events add column if not exists cme_hours numeric(4,1) check (cme_hours is null or cme_hours between 0 and 100);

-- Check-in codes are secret, so they live in their own founders-only table
create table if not exists public.event_checkins (
  event_id   uuid primary key references public.events(id) on delete cascade,
  code       text not null check (code ~ '^[A-Za-z0-9-]{4,20}$'),
  opens_at   timestamptz,
  closes_at  timestamptz
);
alter table public.event_checkins enable row level security;
drop policy if exists checkins_founders on public.event_checkins;
create policy checkins_founders on public.event_checkins for all using (public.is_founder()) with check (public.is_founder());

create table if not exists public.attendance (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  name_on_certificate text not null check (char_length(name_on_certificate) between 2 and 120),
  method             text not null default 'code' check (method in ('code','founder')),
  certificate_no     text not null unique default ('ROAR-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  created_at         timestamptz not null default now(),
  unique (event_id, user_id)
);
alter table public.attendance enable row level security;
drop policy if exists attendance_read on public.attendance;
drop policy if exists attendance_founders on public.attendance;
create policy attendance_read on public.attendance for select to authenticated using (user_id = auth.uid() or public.is_founder());
create policy attendance_founders on public.attendance for all to authenticated using (public.is_founder()) with check (public.is_founder());

-- A member checks in with the code shown during a ROAR session and gets a numbered certificate
create or replace function public.event_checkin(p_event uuid, p_code text, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare c public.event_checkins; e public.events; existing text;
begin
  if auth.uid() is null then raise exception 'Sign in to check in.'; end if;
  select * into e from public.events where id = p_event and published;
  if e.id is null then raise exception 'That session was not found.'; end if;
  select * into c from public.event_checkins where event_id = p_event;
  if c.event_id is null or upper(trim(p_code)) <> upper(c.code) then raise exception 'That code is not right. Check the code shown in the session.'; end if;
  if (c.opens_at is not null and now() < c.opens_at) or (c.closes_at is not null and now() > c.closes_at) then raise exception 'Check-in for this session is closed.'; end if;
  select certificate_no into existing from public.attendance where event_id = p_event and user_id = auth.uid();
  if existing is not null then return existing; end if;
  insert into public.attendance (event_id, user_id, name_on_certificate, method)
    values (p_event, auth.uid(), coalesce(nullif(trim(p_name), ''), 'ROAR member'), 'code') returning certificate_no into existing;
  return existing;
end $$;
grant execute on function public.event_checkin(uuid, text, text) to authenticated;

-- Founders can record attendance for someone who could not check in
create or replace function public.founder_mark_attendance(p_event uuid, p_email text, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid; no text;
begin
  if not public.is_founder() then raise exception 'Only founders can record attendance.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No ROAR account uses that email address.'; end if;
  insert into public.attendance (event_id, user_id, name_on_certificate, method) values (p_event, uid, p_name, 'founder')
    on conflict (event_id, user_id) do update set name_on_certificate = excluded.name_on_certificate
    returning certificate_no into no;
  return no;
end $$;
grant execute on function public.founder_mark_attendance(uuid, text, text) to authenticated;

-- Anyone can check that a certificate is genuine (no email or account details are shown)
create or replace function public.verify_certificate(p_no text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('certificate_no', a.certificate_no, 'name', a.name_on_certificate, 'event', e.title, 'kind', e.kind,
    'starts_on', e.starts_on, 'ends_on', e.ends_on, 'format', e.format, 'cme_hours', e.cme_hours, 'issued', a.created_at)
  from public.attendance a join public.events e on e.id = a.event_id
  where a.certificate_no = upper(trim(p_no))
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- A member's own record of learning, including activities outside ROAR
create table if not exists public.cme_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title         text not null check (char_length(title) between 2 and 300),
  provider      text check (char_length(provider) <= 200),
  category      text not null default 'Conference' check (category in ('Conference','Workshop','Course','Webinar','Journal club','Teaching','Research','Other')),
  activity_date date not null,
  hours         numeric(4,1) not null check (hours > 0 and hours <= 100),
  evidence_url  text check (evidence_url is null or evidence_url ~* '^https?://'),
  notes         text check (char_length(notes) <= 1000),
  created_at    timestamptz not null default now()
);
alter table public.cme_entries enable row level security;
drop policy if exists cme_own on public.cme_entries;
create policy cme_own on public.cme_entries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- Research projects (the Research Collective)
create table if not exists public.research_projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 300),
  summary     text not null check (char_length(summary) between 10 and 3000),
  area        text check (char_length(area) <= 80),
  lead        text check (char_length(lead) <= 200),
  status      text not null default 'recruiting' check (status in ('proposed','recruiting','ongoing','completed','published')),
  sites_wanted int check (sites_wanted between 0 and 500),
  link_url    text check (link_url is null or link_url ~* '^https?://'),
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
create table if not exists public.research_interest (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.research_projects(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 120),
  institution text check (char_length(institution) <= 200),
  role        text check (char_length(role) <= 120),
  message     text check (char_length(message) <= 1500),
  created_at  timestamptz not null default now(),
  unique (project_id, user_id)
);
alter table public.research_projects enable row level security;
alter table public.research_interest enable row level security;
drop policy if exists research_read on public.research_projects;
drop policy if exists research_founders on public.research_projects;
create policy research_read on public.research_projects for select to anon, authenticated using (published or public.is_founder());
create policy research_founders on public.research_projects for all to authenticated using (public.is_founder()) with check (public.is_founder());
drop policy if exists rinterest_own on public.research_interest;
drop policy if exists rinterest_founders on public.research_interest;
create policy rinterest_own on public.research_interest for all to authenticated using (user_id = auth.uid() or public.is_founder()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- Notification settings, job alerts and the email outbox
create table if not exists public.alert_prefs (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  email_jobs       boolean not null default false,
  job_kinds        text[] not null default '{}',
  job_keywords     text check (char_length(job_keywords) <= 200),
  email_mentorship boolean not null default true,
  email_events     boolean not null default false,
  updated_at       timestamptz not null default now()
);
alter table public.alert_prefs enable row level security;
drop policy if exists alerts_own on public.alert_prefs;
create policy alerts_own on public.alert_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Emails waiting to be sent. Written only by the triggers below; sent by the send-email function
-- (supabase/functions/send-email) once an email service is connected. Nobody can read or change it except founders.
create table if not exists public.email_outbox (
  id         uuid primary key default gen_random_uuid(),
  to_user    uuid references auth.users(id) on delete cascade,
  to_email   text not null,
  kind       text not null,
  subject    text not null,
  body       text not null,
  link       text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  error      text
);
create index if not exists email_outbox_unsent on public.email_outbox (created_at) where sent_at is null;
alter table public.email_outbox enable row level security;
drop policy if exists outbox_founders on public.email_outbox;
create policy outbox_founders on public.email_outbox for select to authenticated using (public.is_founder());

create or replace function public.queue_email(p_user uuid, p_kind text, p_subject text, p_body text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
declare addr text;
begin
  select email into addr from auth.users where id = p_user;
  if addr is null or addr like '%.invalid' then return; end if;     -- founders' sign-in addresses can't receive email
  insert into public.email_outbox (to_user, to_email, kind, subject, body, link) values (p_user, addr, p_kind, p_subject, p_body, p_link);
end $$;
revoke execute on function public.queue_email(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.mentorship_emails() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if coalesce((select email_mentorship from public.alert_prefs where user_id = new.mentor_id), true) then
      perform public.queue_email(new.mentor_id, 'mentor_request', 'New mentorship request: ' || new.topic,
        new.mentee_name || ' would like your help with ' || lower(new.topic) || E'.\n\n' || new.message, 'portal/#mentorship');
    end if;
  elsif new.status is distinct from old.status and new.status in ('accepted','declined') then
    if coalesce((select email_mentorship from public.alert_prefs where user_id = new.mentee_id), true) then
      perform public.queue_email(new.mentee_id, 'mentor_reply', 'Your mentorship request was ' || new.status,
        'Your request for help with ' || lower(new.topic) || ' was ' || new.status || '.' || coalesce(E'\n\nNote from your mentor: ' || new.mentor_note, ''), 'portal/#mentorship');
    end if;
  end if;
  return null;
end $$;
drop trigger if exists mentorship_emails on public.mentorship_requests;
create trigger mentorship_emails after insert or update of status on public.mentorship_requests for each row execute function public.mentorship_emails();

-- Job alerts: when a listing is published, members whose alert matches get an email
create or replace function public.job_alert_emails() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if not new.published or (tg_op = 'UPDATE' and old.published) then return null; end if;
  for p in select * from public.alert_prefs a where a.email_jobs
      and (cardinality(a.job_kinds) = 0 or new.kind = any(a.job_kinds))
      and (coalesce(trim(a.job_keywords), '') = '' or exists (
        select 1 from unnest(string_to_array(lower(a.job_keywords), ',')) k
        where trim(k) <> '' and lower(coalesce(new.title, '') || ' ' || coalesce(new.organisation, '') || ' ' || coalesce(new.location, '') || ' ' || coalesce(new.description, '')) like '%' || trim(k) || '%')) loop
    perform public.queue_email(p.user_id, 'job_alert', 'New ' || lower(new.kind) || ': ' || new.title,
      new.title || coalesce(E'\n' || new.organisation, '') || coalesce(' · ' || new.location, '') || coalesce(E'\nApply by ' || to_char(new.deadline, 'DD Mon YYYY'), ''), 'opportunities.html');
  end loop;
  return null;
end $$;
drop trigger if exists job_alert_emails on public.opportunities;
create trigger job_alert_emails after insert or update of published on public.opportunities for each row execute function public.job_alert_emails();
revoke execute on function public.mentorship_emails() from public, anon, authenticated;
revoke execute on function public.job_alert_emails() from public, anon, authenticated;

-- ---------------------------------------------------------------- Online payments (Razorpay), switched on once ROAR has an account
-- Rows are created and updated only by the payment functions (supabase/functions/razorpay-*), never by the website.
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  member_id   uuid references public.members(id) on delete set null,
  purpose     text not null default 'membership',
  plan        text,
  amount_paise int not null check (amount_paise > 0),
  currency    text not null default 'INR',
  order_id    text unique,
  payment_id  text,
  status      text not null default 'created' check (status in ('created','paid','failed')),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
alter table public.payments enable row level security;
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (user_id = auth.uid() or public.is_founder());

-- Members guard, with the exception for confirmed online payments (see record_online_payment below)
create or replace function public.protect_member_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('roar.trusted', true) = '1' then return new; end if;   -- set only by record_online_payment()
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

-- Online payments are recorded by the payment function only (it runs with the service key, never from the website).
-- The members guard trusts a change only when record_online_payment() has set the flag for that one transaction.
create or replace function public.record_online_payment(p_order text, p_payment text) returns void
language plpgsql security definer set search_path = public as $$
declare pay public.payments; m public.members; fy date;
begin
  select * into pay from public.payments where order_id = p_order for update;
  if pay.id is null then raise exception 'Unknown order'; end if;
  if pay.status = 'paid' then return; end if;
  update public.payments set status = 'paid', payment_id = p_payment, paid_at = now() where id = pay.id;
  select * into m from public.members where id = pay.member_id;
  if m.id is null then return; end if;
  fy := make_date(extract(year from (now() at time zone 'Asia/Kolkata'))::int + case when extract(month from (now() at time zone 'Asia/Kolkata')) >= 4 then 1 else 0 end, 3, 31);
  perform set_config('roar.trusted', '1', true);
  update public.members set payment_ref = 'Razorpay ' || p_payment,
    paid_until = case when m.plan = 'annual' then greatest(coalesce(m.paid_until, fy), fy) else m.paid_until end
    where id = m.id;
  perform set_config('roar.trusted', '', true);
end $$;
revoke execute on function public.record_online_payment(text, text) from public, anon, authenticated;
grant execute on function public.record_online_payment(text, text) to service_role;
