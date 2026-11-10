# ROAR website

This is the public website for ROAR (Rising Oncologists' Alliance in Radiation Oncology). It is plain HTML and CSS, with no build step and no database. Anyone can edit it in a text editor.

| File | What it is |
|---|---|
| `index.html` | The home page. Each section is marked with a `<!-- ==== NAME ==== -->` comment. |
| `about.html`, `membership.html`, `desks.html` | Content pages: vision and governance, membership rules and FAQ, support desks. |
| `events.html`, `opportunities.html`, `learn.html`, `news.html` | Listing pages. Their content is managed in the Founders' console, not in these files. |
| `contact.html`, `sent.html` | Contact form and FAQ, and the page shown after sending. |
| `js/layout.js` | **The menu and footer for every page.** Edit links here once. |
| `404.html`, `robots.txt`, `_headers` | Not-found page, search-engine rules, and security headers (Netlify reads `_headers`). |
| `styles.css` | Colours and layout. The dark theme's colours are in the first `:root` block; the light theme's are in `:root[data-theme="light"]` just below it. |
| `js/theme.js` | Light/dark switching. It follows the visitor's device setting until they press the sun/moon button. |
| `js/search.js` | Site search (magnifier button, or press `/`). **When you add a page or section, add a line to its `PAGES` list.** |
| `main.js` | Mobile menu, glass light effects and scroll reveal. |
| `shader.js` | The animated WebGL background. If a browser can't run it, a static gradient shows instead. |
| `desks.html` | The support desks page (grievance cell, Education Standards Desk, dignity at work). |
| `survey/`, `js/survey-engine.js`, `js/survey-def.js` | Surveys and polls. Founders build them in the console (**Surveys & polls**); `js/survey-def.js` holds the built-in national survey draft. Links look like `/survey/?s=<name>`, and adding `&review=1` gives a printable copy. |
| `council/surveys.js` | The console's Surveys & polls dashboard, builder and results. |
| `portal/` | The member portal at `/portal/`: sign-up, application with document upload, membership card, voting window and ballots. |
| `js/rules.js` | The membership rules (voting window, eligibility, fees) used by the portal, the console and the membership page. The database enforces the same rules. |
| `council/` | The Founders' Council console at `/council/`. It needs Supabase for real logins; see `../SETUP.md`. |
| `js/config.js` | Where the Supabase address and public key go. |
| `js/public.js` | Live parts of the home page: saving the form, "Latest from ROAR", "Find your ambassador". |
| `thank-you.html` | Shown after someone submits the interest form. |
| `privacy.html` | Privacy note for the form. Ask the lawyer to review it. |
| `favicon.svg` | Placeholder logo. Replace it after the logo vote. |

## Preview on your computer

Run `python tools/serve.py` from the ROAR folder, then open http://localhost:8790. It never caches, so every edit shows on reload.

## Put it online (free, about 5 minutes)

1. Create a free account at https://app.netlify.com.
2. Go to **Sites → Add new site → Deploy manually**, and drag the whole `website` folder onto the page.
3. Netlify gives you a link like `roar-xyz.netlify.app`. The site is live.
4. In **Site configuration → Change site name**, set it to something like `roar-india`.
5. Optional: once you buy a domain (for example `roarindia.org`), add it under **Domain management**.

To update the site later, edit the files and drag the folder onto **Deploys** again.

## See form submissions

The interest/ambassador form uses **Netlify Forms**, which is free for up to 100 submissions a month.

- Submissions appear in Netlify under **Forms → interest**.
- You can export them as CSV, or turn on email notifications under **Forms → Form notifications** so the Treasurer & Memberships secretary gets an email for each submission.
- The form only works on the live Netlify site, not when you open the file on your computer.

## Before launch: checklist

- [ ] Replace `contact@example.org` in `index.html` and `privacy.html` with ROAR's official email.
- [ ] Add the real Instagram, X and LinkedIn links in the footer of `index.html`.
- [ ] Replace `favicon.svg` with the chosen logo. Keep the same file name, or update the references.
- [ ] Confirm the cabinet names and titles in the **TEAM** section.
- [ ] Have the lawyer review `privacy.html` and the AROI comparison table.
- [ ] Once ROAR is registered, update the line "Registration as a Society is under way" in the hero and footer.
