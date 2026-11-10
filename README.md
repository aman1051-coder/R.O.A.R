# ROAR – Rising Oncologists' Alliance in Radiation Oncology

The website, member portal and Founders' Council console for ROAR, India's community of radiation oncology residents and young radiation oncologists.

| Folder | What it is |
|---|---|
| [`website/`](website/) | The site: public pages, the member portal (`/portal/`), the national survey (`/survey/`) and the Founders' console (`/council/`). Plain HTML, CSS and JavaScript, with no build step. See [`website/README.md`](website/README.md). |
| [`supabase/schema.sql`](supabase/schema.sql) | The database, logins and security rules. |
| [`SETUP.md`](SETUP.md) | How to connect the database and create the founders' logins. |
| [`tools/serve.py`](tools/serve.py) | Preview on your computer: `python tools/serve.py`, then open http://localhost:8790 |

**Hosting:** while ROAR waits for its own domain, every push to `main` publishes the `website/` folder to GitHub Pages ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)).

Until the database is connected (`website/js/config.js`), the forms, member accounts and console are switched off on the public site. To try the demo with sample data, add `?demo` to a page address, for example `/council/?demo`.
