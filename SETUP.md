# Going live: logins, the database and the member portal

The website works without a database. Until you connect one:
- the interest form saves to **Netlify Forms**;
- the Founders' console (`/council/`) and the member portal (`/portal/`) run in **demo mode**, and anything you do there stays in your own browser.

To give the nine founders real logins and shared data, connect a free **Supabase** project. It takes about 20 minutes, done once by one founder.

## 1. Create the project

1. Sign up at https://supabase.com and click **New project**.
2. Name it `roar`. Choose the **Mumbai (ap-south-1)** region, and save the database password somewhere safe.

## 2. Create the tables and security rules

1. Open [`supabase/schema.sql`](supabase/schema.sql) in a text editor.
2. Check the **FOUNDERS** block near the bottom. It lists the nine founders with their usernames and Founder IDs (FC-01 to FC-09). Change a username there if a founder prefers a different one.
3. In Supabase, go to **SQL Editor → New query**, paste the whole file, and click **Run**. You should see "Success".

This creates the launch tracker with the roadmap tasks, both founders' meetings, the member portal, private storage for members' documents, and the security rules. The rules mean:
- only the nine founders can read or change anything in the console;
- a member can see and edit only their own application, and can't change their own verification, payment or voting fields;
- members' ID cards and certificates are private: only the member and the founders can open them;
- ballots are secret: the database stores *who voted* and *how people voted* in separate tables with no link between them, so nobody can see an individual's vote, including the founders;
- the public can only *submit* the interest and contact forms, and read published content.

## 3. Sign-up settings

Go to **Authentication → Sign In / Providers**:
- Keep **Email** turned on.
- Keep **"Allow new users to sign up"** turned on, because members create their own accounts in the portal.
- Keep **"Confirm email"** turned on, so every account has a working email.

Anyone can create an account, but an account on its own can do nothing: only people on the founders list can use the console, and a member's access is limited to their own application.

## 4. Set the website address

Go to **Authentication → URL Configuration**:
- **Site URL:** `https://YOUR-SITE.netlify.app/portal/`
- **Redirect URLs:** add both `https://YOUR-SITE.netlify.app/portal/` and `https://YOUR-SITE.netlify.app/council/`, plus the same two on your own domain later.

## 5. The nine founder logins

Nothing to do here: running `schema.sql` in step 2 creates a login for each of the nine founders, with a random password nobody knows. Founders sign in to the console with a **username** (or their Founder ID) and claim their account by choosing their own password the first time. Only these nine accounts can open the console.

| Founder ID | Founder | Username |
|---|---|---|
| FC-01 | Dr. Akash Bellige | `akash.bellige` |
| FC-02 | Dr. Aman Gupta | `aman.gupta` |
| FC-03 | Dr. Kratika Bhatia | `kratika.bhatia` |
| FC-04 | Dr. Shriya Dhingra | `shriya.dhingra` |
| FC-05 | Dr. Deepika Sharma | `deepika.sharma` |
| FC-06 | Dr. Arshida P | `arshida.p` |
| FC-07 | Dr. Arsheya Gupta | `arsheya.gupta` |
| FC-08 | Dr. Honey Sharma | `honey.sharma` |
| FC-09 | Dr. Abhishek Bhadri | `abhishek.bhadri` |

**First sign-in:** each founder opens `/council/`, enters their username, chooses a password of at least 10 characters, and is signed in. From then on that username asks for their password.

> **Do this soon.** By the founders' decision, the first sign-in has no other check. Until a founder has chosen their password, anyone who knows the username could choose it first. Ask all nine to sign in as soon as the database is live, and check the **Password** column on the console's **Founders** page shows "chosen" for everyone.

**Forgotten or compromised passwords:** only the **Chairman** can help. On the console's **Founders** page, open the founder and choose either:
- **Reset**, so the old password stops working and the founder chooses a new one at their next sign-in; or
- **Set a new password**, then pass it on by phone.

To give this power to someone else later, change `can_reset_passwords` for that founder in Supabase (**Table Editor → founders**).

**Everyone else** (residents, members, mentors) creates their own account in the member portal at `/portal/`. Those accounts can use the members' area (Education, Careers, Welfare and their membership) but can never open the console.

## 6. Connect the website

1. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
2. Paste both into [`website/js/config.js`](website/js/config.js).
3. Redeploy the `website` folder to Netlify (drag it onto **Deploys** again).

Never paste the `service_role` key anywhere in the website. Only the anon key belongs there.

## 7. Open membership applications (after registration)

The portal accepts sign-ups from day one, but applications stay **closed** until an admin founder opens them. Do this only once ROAR is registered and has a bank account:
1. In the console, go to **Members** and click **Open applications**.
2. Applicants fill in a four-step form and upload their PG college ID card and allotment letter or degree certificate.
3. The Treasurer & Memberships secretary checks the documents in **Members** and approves or refuses within 30 days. A refusal must give reasons, and the applicant can appeal.
4. On approval the member gets a member number (ROAR-0001, ROAR-0002…) and a digital membership card.
5. **Payment is manual for now.** The Treasurer emails bank details, and records the payment reference (and "paid until" date for annual members) in **Members**. An online payment gateway such as Razorpay can be added once the bank account is open.

## One login for the whole site

Everyone has a single account for the whole website. A founder can sign in on the Founders' console or the member portal with their **username or Founder ID** (for example `FC-02`). The first time, they choose their own password there. After that they stay signed in everywhere:
- the console;
- the members' area (Education, Careers, Welfare and their membership);
- ROAR Community.

Once signed in, every page shows an account button (their photo or initials) in the header, with links to the members' area, Community, their profile, the Founders' console (founders only) and **Sign out**. Signing out anywhere signs out everywhere. Members sign in with their email address as before.

## Renaming a founder

Change a founder's username or name on the console's **Founders** page. Their login moves to the new username automatically, together with their votes and the records they created. If they hadn't chosen a password yet, they still can.
- Usernames are not case-sensitive, so `Arshida.P` and `arshida.p` both work.
- Founder IDs (`FC-06`) always work for signing in.
- The About page reads names and roles from the database, so a change shows on the website straight away.

Schema PART 14 does this.

## Founders' photos

When a founder uploads a profile picture to ROAR Community, it replaces their initials wherever the founders are listed: the About page's Founders' Council section, and the console's sidebar and Founders page. Schema PART 13 makes **only founders' current profile pictures** readable on the public site; every other Community photo stays private.

## The logo

The logo files are in `website/assets/logo/`:
- `roar-logo.svg`: the full logo with the name, for light backgrounds;
- `roar-logo-white.svg` and `roar-logo-on-navy.svg`: versions for dark backgrounds;
- `roar-wordmark.svg`: just the ROAR wordmark;
- `roar-mark.svg`: the gantry O on its own;
- `website/favicon.svg`: the app and browser icon.

The O is a linac gantry, with five weighted treatment beams converging on the isocentre. To change the shapes, edit and run `tools/make_logo.py`.

## How the site is organised

Like ESTRO, ASTRO and the Royal College of Radiologists, the public site has seven areas, each with a dropdown:
- **About:** who we are, governance, leadership, partnerships, news and contact.
- **Membership:** why join, who can join, fees, how to join, the FAQ and My ROAR.
- **Education:** programmes, the events calendar, the learning library, CME and certificates, and checking a certificate.
- **Careers:** jobs and fellowships, mentorship, career help and job alerts.
- **Welfare:** the Member Welfare Charter, support desks and the national survey.
- **Research:** the Research Collective and its open projects.
- **Community.**

The menu lives in `website/js/layout.js` (the `NAV` list).

## My ROAR (the members' hub)

Signing in at `/portal/` opens My ROAR, with these tabs:
- **Home:** a dashboard showing membership, CME hours this year, mentorship, Community, upcoming events, new openings and quick actions.
- **Membership:** the application, card and ballots.
- **Community.**
- **Learning:** check in to sessions, certificates, the CME log and the learning library.
- **Careers.**
- **Mentorship.**
- **Welfare.**
- **Settings:** email notifications, job alerts and password.

Founders see a link to the console on Home.

## Mentorship

1. Members offer to mentor in My ROAR → Mentorship. They choose the areas they cover, what they help with and how many mentees they take.
2. A founder approves each mentor on the console's **Mentors** page before they are listed. Mentors can pause themselves at any time.
3. Members browse mentors and send a request. Up to 3 requests can wait for an answer at a time.
4. When the mentor accepts, both see each other's email address.

## CME and certificates

1. On the console's **Sessions & CME** page, give a ROAR session its CME hours and a check-in code.
2. Show the code at the end of the session.
3. Members enter the code in My ROAR → Learning and get a numbered certificate (for example `ROAR-2026-1A2B3C4D`).
4. The member can print the certificate or save it as a PDF. Anyone can check it is genuine at `/certificate.html`; the check shows the name, session and date, but no account details.
5. Close check-in when you're done. If someone couldn't check in, record their attendance by their email address.

Members can also log other learning (conferences, courses, webinars) in their CME log and download it as a CSV.

## Research Collective

Add projects on the console's **Research projects** page. Published projects appear on `/research.html`, where signed-in members can express interest; the console lists who is interested in each project.

## Email notifications (switch on when ready)

Job alerts and mentorship emails are already **queued** in the database (console → **Email outbox**). Members choose what they receive in My ROAR → Settings. Nothing is sent until ROAR connects an email service:
1. Create an account with [Resend](https://resend.com) (free for low volumes), verify ROAR's domain, and create an API key.
2. In Supabase, go to **Edge Functions → Secrets** and add:
   - `RESEND_API_KEY`;
   - `EMAIL_FROM`, for example `ROAR <hello@roarindia.org>`;
   - `SITE_URL`.
3. Deploy the function in `supabase/functions/send-email/` (Edge Functions → Deploy a new function → paste the file).
4. Schedule it to run every 10 minutes (Integrations → Cron).

Founders' sign-in addresses (`@founders.roar.invalid`) can't receive email, so founders get on-site notifications only.

## Online fee payment (switch on when ROAR has a bank account)

Members can pay their fee by UPI, card or net banking through Razorpay. This needs a Razorpay account, which needs ROAR's registration and bank account first. Until it is switched on, members see the Treasurer's manual payment instructions.
1. Create a Razorpay account and complete its KYC.
2. In Supabase, go to **Edge Functions → Secrets** and add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`.
3. Deploy `supabase/functions/razorpay-order/` and `supabase/functions/razorpay-webhook/`. Turn off "verify JWT" for the webhook.
4. In Razorpay, go to **Settings → Webhooks** and add the webhook function's address, with the event `payment.captured` and the same secret.
5. Put the public Key ID in `website/js/config.js` as `payments: { razorpayKeyId: 'rzp_live_…' }`.

The fee is always worked out on the server from the member's plan: annual ₹500, lifetime ₹5,000, founding ₹1,000. Once a payment is confirmed, the member's payment reference is recorded, and annual members are marked paid until 31 March.

## Education, Careers, Welfare and Community pages

These four public pages show ROAR's vision to everyone. When a member is signed in, the same page also shows the live content in a members' panel near the top (`js/members-area.js`):
- **Education:** the learning library, with search, and upcoming sessions with **Add to calendar**.
- **Careers:** open positions, one-to-one help and the member's own requests.
- **Welfare:** a confidential way to raise a concern, plus the survey and helpline.
- **Community:** the latest posts and trending hashtags.

The menu no longer shows lock icons. The pages are generated by `tools/build_area_pages.py`, so edit the text there and run it.

## The app and link previews

The site can be installed as an app from the browser menu ("Add to Home screen" or "Install"). It opens full screen with the ROAR icon and still works without a connection for pages already visited. Links shared on WhatsApp, LinkedIn or X show the ROAR preview image.
- The icons and the preview image are drawn by `tools/make_png.py`.
- The app settings are in `website/manifest.webmanifest`, and offline support in `website/sw.js`.

## The members' area

Every account created in the member portal gets five tabs: **My membership** (their application, card and ballots), **Community**, **Education**, **Careers help** and **Welfare**. Founders can sign in to the portal too, with the same username and password they use for the console.
- **Members-only content:** in the console, tick **Members only** on a learning resource, event or career listing. It then appears in the members' area and is hidden from the public website.
- **Career help requests:** requests for CV reviews, fellowship or job guidance, exam help, observership placements and research mentoring arrive in the console's **Career help** page. Assign each to a founder or mentor, reply by email, and close it when done.

## ROAR Community

A members-only social space in the portal (`/portal/#community`) that brings together the best of Instagram, Reddit and Twitter. Only signed-in accounts can see anything in it; the public website shows none of it.

- **Profiles:** everyone (founders included) creates a profile the first time they open Community, with:
  - a unique **@username**;
  - a display name, stage of training, institution and a short bio;
  - a **profile picture** they upload themselves.

  Founders get a **Founder** badge with their Founder ID; approved members get a **Member** badge. A profile shows posts, followers and following, an Instagram-style grid of posts, a list view, and (for you only) your **Saved** posts.
- **Home feed:** **For you** ranks recent posts by likes, comments and quotes, and favours people you follow. **Following** shows only people you follow. **Latest** is newest first, and **Top this week** shows the most discussed posts.
- **Posts** can be:
  - a question, article, case discussion, news or a general post;
  - filed under a **topic** (Head & Neck, Breast, SBRT & SRS, Physics & Planning, Exams & Training, Careers, Wellbeing and others);
  - given up to 4 **photos** (a swipeable carousel, double-tap to like), a **poll** of 2–4 choices lasting 1 day to 1 week, a link, or a **quote** of another post.

  Writing `#hashtags` and `@usernames` in a post makes them links. A mentioned person is notified.
- **Answers and replies:** comments are threaded, so you can reply to a reply. They can be voted up or down. On a question, the person who asked can mark one answer as **accepted**.
- **Stories:** a photo with a caption that disappears after 24 hours. They appear in a row at the top of Home, and on the person's profile picture.
- **Explore:** search people, posts and hashtags, browse the topics, and see trending hashtags and recent photos. Each topic has its own page with Hot, New and Top sorting.
- **Notifications:** likes, comments, replies, mentions, quotes, new followers and accepted answers. They're created by the database itself, so nobody can fake one.
- **Privacy:**
  - Photos are resized in the browser and their location data is removed before upload. They're kept in a private storage bucket (`community`) that only signed-in accounts can read.
  - Poll votes are secret: people see only the totals.
  - Saved posts are private.
  - Anyone posting photos or a case must confirm that nothing could identify a patient.
- **Moderation:** founders can:
  - **pin** a post to the top of Home;
  - hide or unhide any post or comment (the author still sees it, with the reason);
  - delete posts, comments and stories.

  Reports arrive in the console's **Community** page, and reporters' names are visible only to the Founders' Council.
- **Setting it up:** run schema PARTs 11 to 15. If the rest of the schema is already in place, paste and run only the parts you haven't run yet.

## Running a ballot

In **Elections & ballots**, create a ballot as a draft, add the choices, set when voting opens and closes, then set it to **Open**. It appears in every approved member's portal.
- **Poll / referendum:** every member within the voting window, with their fee paid, can vote.
- **Election:** Article 23 also applies. Members must have joined at least 60 days before polling and must confirm their PG dates (the portal asks them), and voting must stay open for at least 72 hours.
- Results appear only after you set the ballot to **Closed**. Turnout is visible to founders throughout.
- **Electoral roll CSV** in **Members** downloads everyone eligible to vote today.

## Surveys and polls (Founders' Council only)

National surveys and polls are created and run from the console's **Surveys & polls** page. Only the nine founders can create, edit, open, close or delete them, or read the responses. The database enforces this (schema PART 9).

- **New survey:** start from a blank survey, a copy of the national survey, or a copy of any earlier survey. Then build it section by section in the builder:
  - Each question can be one choice, several choices, a scale, a grid, a 0–10 rating, a dropdown or a written answer.
  - Each section or question can be shown to everyone, or only to residents, young radiation oncologists or seniors.
  - A question can be a follow-up that appears only after a particular earlier answer.
- **New poll:** one question with its choices. It can show the totals to people after they answer.
- **Who can answer:** each survey and poll is for **everyone** (anyone with the link) or **members only** (signed in to the member portal). Answers stay anonymous either way: no name, email or IP address is stored, only the date.
- **Status:** a survey starts as a **draft**, which only founders can see; use **Preview** to try it without saving answers. **Open** it to collect answers, and **Close** it when you're done.
- **Sharing:** **Copy link** gives the address to share, for example `/survey/?s=stipend-check-2027`.
- **Responses:** charts per question, filters by respondent group, and **Export CSV**. Never report results for groups of fewer than 5.
- **National survey:** the first national survey's draft is built in. Click **Add the national survey draft** on the Surveys & polls page to edit and open it. If you plan to publish the results in a journal, get approval from an Institutional Ethics Committee before opening it.

## Who can do what

| | Any founder | Admin founder (President, Chairman, General Secretary) |
|---|---|---|
| Launch tracker, meetings, registrations, ambassadors, announcements, library | ✓ | ✓ |
| Raise motions and vote (one vote each) | ✓ | ✓ |
| Close or delete a motion | only their own | any |
| Verify members, record payments, run ballots | ✓ | ✓ |
| Open or close membership applications | | ✓ |
| Add or remove founders | | ✓ |
| Moderate ROAR Community (hide, unhide or delete posts; read reports) | ✓ | ✓ |

To change who is an admin, edit the founder in the console's **Founders** page.

## Adding a founder later

This covers, for example, a past President filling a vacancy under Article 15A.
1. An admin adds them on the console's **Founders** page, with a Founder ID and username.
2. Their login is created automatically. They claim it by choosing their own password at their first sign-in.
