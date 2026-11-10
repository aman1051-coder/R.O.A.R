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

## 5. Create the nine founder logins

Founders sign in to the console with a **username** (or their Founder ID) and a password. No real email address is needed. Only these nine accounts can open the console.

For each founder, go to **Authentication → Users → Add user → Create new user**:
- **Email:** their username followed by `@founders.roar.invalid`, for example `aakash.bellige@founders.roar.invalid`. The `.invalid` domain is reserved and can never receive mail, so nothing is ever sent there.
- **Password:** a temporary password. Give it to the founder in person or by phone.
- Tick **Auto Confirm User**.

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

Each founder then signs in at `/council/` with their username (or Founder ID, such as `FC-01`) and the temporary password. They should change it straight away with **Change my password** in the sidebar.

**Forgotten passwords:** there's no email reset for founder accounts. An admin founder resets it in **Authentication → Users**: open the user, choose **Reset password** or set a new one, and pass it on by phone.

> If Supabase refuses the `.invalid` address, use any address ROAR controls instead (for example `founders+aakash@roarindia.org`). Then set `founderLoginDomain` in `website/js/config.js` and the `email` values in the FOUNDERS block to match.

**Everyone else** (residents, members, mentors) creates their own account in the member portal at `/portal/`. Those accounts can use the members' area (Education, Careers help, and their membership) but can never open the console.

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
2. Create their login in Supabase as in step 5 (`<username>@founders.roar.invalid`, Auto Confirm User).
