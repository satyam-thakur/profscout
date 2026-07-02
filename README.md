# ProfScout

**Discover Professors. Match Research. Compare Stipends.**

An open-source platform to help PhD/MS applicants discover 34,000+ CS professors, match research interests, compare stipend packages, and plan their graduate school outreach — all from a single, beautiful interface.

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11+-green)
![Data](https://img.shields.io/badge/professors-34%2C280-purple)

---

## Features

| Page | Description |
|------|-------------|
| **Discover** | Search & filter 34,000+ professors by name, university, research area, country, and publication count |
| **Stipends** | Visual dashboard comparing 82 US university PhD stipends vs. cost of living with sortable tables and bar charts |
| **Match** | Select your research interests and get ranked professor recommendations with match scores |

### Data Sources

- **[CSrankings](https://csrankings.org)** — Faculty names, affiliations, homepages, Google Scholar IDs, and publication records at top CS venues
- **[CSStipendRankings](https://csstipendrankings.org)** — PhD stipend amounts, fees, and cost of living data for US universities

Both datasets are included as git submodules under `data/`.

---

## Quick Start

### Prerequisites

- **Python 3.11+**
- **[uv](https://docs.astral.sh/uv/)** (recommended) or pip
- **Git** (for cloning submodules)

### 1. Clone the Repository

```bash
git clone --recursive https://github.com/YOUR_USERNAME/profscout.git
cd profscout
```

If you already cloned without `--recursive`, initialize the submodules:

```bash
git submodule update --init --recursive
```

### 2. Set Up the Environment

Using **uv** (recommended):

```bash
uv venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
```

Or using plain Python:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
```

### 3. Build the Data

This transforms the raw CSVs from the submodules into optimized JSON files for the frontend:

```bash
# Windows
.venv\Scripts\python.exe scripts\build_data.py

# macOS/Linux
python scripts/build_data.py
```

You should see output like:

```
============================================================
ProfScout Data Pipeline
============================================================

[1/3] Building areas metadata...
  Wrote public/data/areas.json (5.3 KB)

[2/3] Building institutions data...
  Built 762 institution records
  82 institutions have stipend data

[3/3] Building professors data...
  Built 34280 unique professor records
  Wrote public/data/professors.json (6.7 MB)

============================================================
[OK] Data pipeline complete! 34280 professors, 762 institutions
============================================================
```

### 4. Start the Dev Server

```bash
# Windows
.venv\Scripts\python.exe scripts\serve.py

# macOS/Linux
python scripts/serve.py
```

### 5. Open in Browser

Navigate to **http://localhost:8080** and start exploring!

---

## Project Structure

```
profscout/
├── .gitmodules              # Git submodule configuration
├── pyproject.toml           # Python project config
├── data/                    # Data sources (git submodules)
│   ├── CSrankings/          # Faculty & publication data
│   └── CSStipendRankings/   # Stipend & living cost data
├── scripts/
│   ├── build_data.py        # CSV → JSON data pipeline
│   └── serve.py             # Local dev server (port 8080)
└── public/                  # Static frontend (served by dev server)
    ├── index.html           # Main HTML shell
    ├── data/                # Generated JSON files (from build_data.py)
    │   ├── professors.json  # 34K+ professor records
    │   ├── institutions.json# 762 institutions with stipend data
    │   └── areas.json       # Research area categories & mappings
    └── src/
        ├── style.css        # Design system (dark mode, glassmorphism)
        └── main.js          # SPA application (router, pages, components)
```

---

## Updating Data

To pull the latest data from CSrankings and CSStipendRankings:

```bash
git submodule update --remote --merge
python scripts/build_data.py
```

---

## Roadmap

- [x] **v0.1** — Professor Discovery (search, filter, sort)
- [x] **v0.2** — Stipend Dashboard (charts, tables, comparisons)
- [x] **v0.3** — Research Interest Matcher (scoring algorithm)
- [ ] **v0.4** — Email Template Engine (merge fields, personalization)
- [ ] **v0.5** — Application Tracker (kanban board, status tracking)
- [ ] **v1.0** — AI Email Generation (OpenAI integration)
- [ ] **v1.1** — Gmail/SMTP email sending via API
- [ ] **v1.2** — GitHub Actions for automated data updates

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

## License & Attribution

ProfScout is open source under the MIT License.

Data from:
- **CSrankings** — [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) by [Emery Berger](https://emeryberger.com)
- **CSStipendRankings** — [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) by its [contributors](https://github.com/CSStipendRankings/CSStipendRankings/contributors)
