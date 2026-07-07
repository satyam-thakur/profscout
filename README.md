# ProfScout 🎓

**Discover professors. Match research. Compare stipends. Reach out — efficiently.**

ProfScout is a free, open-source, privacy-first web app that helps PhD/MS applicants run their entire graduate-school outreach from one place: find advisors across 34,000+ CS faculty (or millions of global STEM researchers), rank them by research fit, compare PhD stipends against cost of living, and draft & send personalized emails straight from your own Gmail.

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11+-green)
![Frontend](https://img.shields.io/badge/frontend-vanilla%20JS-yellow)
![Professors](https://img.shields.io/badge/professors-34%2C280-6366f1)
![Hosting](https://img.shields.io/badge/hosting-GitHub%20Pages-black)

> **Live demo:** https://satyam-thakur.github.io/profscout/ · 100% client-side — your data never leaves your browser (unless you opt into private Google Drive sync).

---

## ✨ Features

| Page | What it does |
|------|--------------|
| 🧭 **Discover** | Search & filter 34,000+ CS faculty locally, or flip to **Global STEM** to search millions of researchers across all fields live via OpenAlex. Every result links out to the professor's homepage, Google Scholar, ORCID, or OpenAlex profile. |
| 🎯 **Match** | Select the specific research areas you care about and get professors ranked by fit, using publication counts and recency. |
| 📄 **Templates** | A built-in, always-available default outreach template plus your own custom templates, powered by `{{merge tags}}`. |
| 📨 **Mail** | Compose a personalized email, refine it with one-click **AI** actions (Enhance, Shorten, Formal, Friendly…), and **send or draft directly from your Gmail** — no SMTP setup. Bulk-compose to your whole shortlist. |
| 📋 **Tracker** | A Kanban board (Saved → Contacted → Interviewing → Accepted → Rejected) with drag-and-drop and bulk actions. |
| 💰 **Stipends** | A sortable, searchable table comparing PhD stipends, fees, cost of living, and net income across 82 US universities. |

**Also:**

- **Reusable applicant profile** — fill your details once in Settings (degree, university, experience, skills, interests, contact) and every template auto-completes.
- **Trust-first sending** — ProfScout never fabricates recipient addresses; it points you to the professor's homepage and blocks sends to made-up/invalid emails.
- **Minimal, accessible UI** — clean light/dark themes, keyboard-friendly, reduced-motion aware.
- **Private cloud sync (optional)** — templates, tracker, and settings back up to a hidden folder in *your* Google Drive so they follow you across devices.

---

## 🚀 How it works

1. **Set up your profile once** (Settings) — name, degree, university, experience, skills, and contact info.
2. **Find advisors** in Discover or Match, and **save** promising ones to your Tracker.
3. **Pick a template** — start from the built-in default or create your own.
4. **Compose** — professor-specific fields fill from the card; your profile fills the rest. Polish with AI if you like.
5. **Send from your Gmail**, and watch the professor move to *Contacted* on your board automatically.

---

## 🗂️ Data Sources

- **[CSrankings](https://csrankings.org)** — faculty names, affiliations, homepages, Google Scholar IDs, and publication records at top CS venues (34k+, stored locally).
- **[CSStipendRankings](https://csstipendrankings.org)** — PhD stipend, fee, and cost-of-living data for US universities.
- **[OpenAlex](https://openalex.org/)** — live global API spanning millions of researchers across *all* STEM fields.

The two local datasets are included as git submodules under `data/`.

---

## 🛠️ Quick Start

### Prerequisites

- **Python 3.11+**
- **[uv](https://docs.astral.sh/uv/)** (recommended) or pip
- **Git** (for the data submodules)

### 1. Clone (with submodules)

```bash
git clone --recursive https://github.com/satyam-thakur/profscout.git
cd profscout
```

Already cloned without `--recursive`? Initialize the submodules:

```bash
git submodule update --init --recursive
```

### 2. Set up the environment

```bash
# Using uv (recommended)
uv sync

# …or plain Python
python -m venv .venv
pip install -e .
```

Activate it — Windows: `.venv\Scripts\activate` · macOS/Linux: `source .venv/bin/activate`

### 3. Build the data

Transforms the raw submodule CSVs into optimized JSON for the frontend:

```bash
python scripts/build_data.py
```

```
[OK] Data pipeline complete! 34280 professors, 762 institutions
```

### 4. Serve the static frontend

ProfScout is 100% client-side — any static file server works:

```bash
python -m http.server 8081 --directory public
```

### 5. Open in your browser

Visit **http://localhost:8081**. Open **Settings** to fill your profile and (optionally) add an AI API key, then **Sign in with Google** to enable 1-click sending and private cloud sync.

---

## ⚙️ Configuration

Everything is configured in-app under **Settings** (stored locally in your browser):

- **Your Profile** — merged into every email template via `{{my_*}}` tags.
- **Google OAuth Client ID** — required for Gmail sending & Drive sync. Create one in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and authorize your origin (e.g. `http://localhost:8081`).
- **AI provider & API key** — optional, for AI drafting. Supports **Google Gemini** (free key from [AI Studio](https://aistudio.google.com/app/apikey)), **OpenAI**, or **Anthropic**.

### Email merge tags

Templates support these `{{tags}}`:

- **Professor (from the compose form):** `prof_name`, `prof_firstName`, `prof_lastName`, `prof_interests`, `paper_title`, `projects`, `univ_name`
- **You (from your Settings profile):** `my_name`, `my_degree`, `my_university`, `my_interests`, `my_experience_years`, `my_job_title`, `my_company`, `my_skills`, `my_contact`, `my_background`

---

## 🏗️ Project Structure

```
profscout/
├── .github/workflows/       # CI: Pages deploy + weekly data auto-update
├── data/                    # Data sources (git submodules)
│   ├── CSrankings/          #   faculty & publication data
│   └── CSStipendRankings/   #   stipend & cost-of-living data
├── scripts/
│   └── build_data.py        # CSV → optimized JSON pipeline
├── public/                  # Static frontend (deploy root)
│   ├── index.html           #   app shell + metadata/icons
│   ├── assets/              #   favicon, PWA icons, social preview
│   ├── data/                #   generated JSON (built by build_data.py)
│   └── src/
│       ├── style.css        #   minimal light/dark design system
│       └── main.js          #   single-file SPA (router, pages, services)
└── pyproject.toml
```

---

## 🔄 Updating the data

Pull the latest upstream data and rebuild:

```bash
git submodule update --remote --merge
python scripts/build_data.py
```

This also runs automatically every week via the **Automated Data Update** GitHub Action, which commits refreshed data as `github-actions[bot]`.

---

## ☁️ Deployment

Pushing to the default branch triggers the **Deploy to GitHub Pages** workflow, which regenerates the JSON data and publishes `public/` — so the generated data is intentionally *not* committed to the repo.

---

## 🔒 Privacy

ProfScout has no backend. Your profile, templates, tracker, and outbox live in your browser's `localStorage`. Signing in with Google is optional and only used to (a) send email from your own account and (b) back up your data to a private *App Data* folder in your own Google Drive. Nothing is sent to any third-party server operated by this project.

---

## 🤝 Contributing

Contributions are welcome — please open an issue or submit a pull request. For data corrections, contribute upstream to [CSrankings](https://github.com/emeryberger/CSrankings) or [CSStipendRankings](https://github.com/CSStipendRankings/CSStipendRankings).

---

## 📄 License & Attribution

ProfScout is open source under the **MIT License**.

Data provided by:

- **CSrankings** — [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) by [Emery Berger](https://emeryberger.com)
- **CSStipendRankings** — [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) by its [contributors](https://github.com/CSStipendRankings/CSStipendRankings/graphs/contributors)
