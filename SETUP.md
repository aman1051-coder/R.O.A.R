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
| FC-01 | Dr. Aakash Bellige | `aakash.bellige` |
| FC-02 | Dr. Aman Gupta | `aman.gupta` |
| FC-03 | Dr. Kratika Bhatia | `kratika.bhatia` |
| FC-04 | Dr. Shriya Dhingra | `shriya.dhingra` |
| FC-05 | Dr. Deepika Sharma | `deepika.sharma` |
| FC-06 | Dr. Arshida Pulimala | `arshida.pulimala` |
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

## The members' area

Every account created in the member portal gets three tabs: **My membership** (their application, card and ballots), **Education**, and **Careers help**.
- **Members-only content:** in the console, tick **Members only** on a learning resource, event or career listing. It then appears in the members' area and is hidden from the public website.
- **Career help requests:** requests for CV reviews, fellowship or job guidance, exam help, observership placements and research mentoring arrive in the console's **Career help** page. Assign each to a founder or mentor, reply by email, and close it when done.

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

## The members' area

Every account created in the member portal gets three tabs: **My membership** (their application, card and ballots), **Education**, and **Careers help**.
- **Members-only content:** in the console, tick **Members only** on a learning resource, event or career listing. It then appears in the members' area and is hidden from the public website.
- **Career help requests:** requests for CV reviews, fellowship or job guidance, exam help, observership placements and research mentoring arrive in the console's **Career help** page. Assign each to a founder or mentor, reply by email, and close it when done.

## Running a ballot

In **Elections & ballots**, create a ballot as a draft, add the choices, set when voting opens and closes, then set it to **Open**. It appears in every approved member's portal.
- **Poll / referendum:** every member within the voting window, with their fee paid, can vote.
- **Election:** Article 23 also applies. Members must have joined at least 60 days before polling and must confirm their PG dates (the portal asks them), and voting must stay open for at least 72 hours.
- Results appear only after you set the ballot to **Closed**. Turnout is visible to founders throughout.
- **Electoral roll CSV** in **Members** downloads everyone eligible to vote today.

## Running the national survey

The questionnaire lives in [`website/js/survey-def.js`](website/js/survey-def.js). Founders can read the whole thing at `/survey/?review=1` and print it or save it as a PDF.
1. Agree the final questions, then change `version` in that file (for example to `1.0`).
2. If you plan to publish the results in a journal, get approval from an Institutional Ethics Committee first. The survey's consent screen is written with that in mind.
3. In the console, go to **National survey** and click **Open survey**. Only admin founders can do this.
4. Share the link `/survey/`. Responses are anonymous: no name, email or IP address is stored, only the date.
5. Watch results in the console, and download them with **Export CSV**. Never report a group with fewer than 5 responses.

## Who can do what

| | Any founder | Admin founder (President, Chairman, General Secretary) |
|---|---|---|
| Launch tracker, meetings, registrations, ambassadors, announcements, library | ✓ | ✓ |
| Raise motions and vote (one vote each) | ✓ | ✓ |
| Close or delete a motion | only their own | any |
| Verify members, record payments, run ballots | ✓ | ✓ |
| Open or close membership applications | | ✓ |
| Add or remove founders | | ✓ |

To change who is an admin, edit the founder in the console's **Founders** page.

## Adding a founder later

This covers, for example, a past President filling a vacancy under Article 15A.
1. An admin adds them on the console's **Founders** page, with a Founder ID and username.
2. Their login is created automatically. They claim it by choosing their own password at their first sign-in.
