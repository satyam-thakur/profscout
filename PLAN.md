# ProfScout Plan & Roadmap

This document tracks the current progress, future roadmap, and recommended improvements for ProfScout.

## Current Features (v0.1 - v0.3)

| Page | Description |
|------|-------------|
| **Discover** | Search & filter 34,000+ professors by name, university, research area, country, and publication count |
| **Stipends** | Visual dashboard comparing 82 US university PhD stipends vs. cost of living with sortable tables and bar charts |
| **Match** | Select your research interests and get ranked professor recommendations with match scores |

## Roadmap

- [x] **v0.1** — Professor Discovery (search, filter, sort)
- [x] **v0.2** — Stipend Dashboard (charts, tables, comparisons)
- [x] **v0.3** — Research Interest Matcher (scoring algorithm)
- [ ] **v0.4** — Email Template Engine (merge fields, personalization)
- [ ] **v0.5** — Application Tracker (kanban board, status tracking)
- [ ] **v1.0** — AI Email Generation (OpenAI integration)
- [ ] **v1.1** — Gmail/SMTP email sending via API
- [ ] **v1.2** — GitHub Actions for automated data updates

## Recommendations & Future Improvements

1. **Broaden to all STEM Fields**
   - **Current:** CS-only (via CSrankings).
   - **Improvement:** Integrate with OpenAlex API or the Stanford/Elsevier Top Scientists dataset to include civil engineering, mechanical engineering, physics, and other STEM fields.

2. **Advanced Filtering & Metrics**
   - Incorporate h-index or citation metrics.
   - Filter by recent lab alumni or graduation rates (if data becomes available).

3. **User Accounts & Data Sync**
   - Allow users to sync their application tracker board and email templates across devices (e.g., via Firebase or Supabase).

4. **Community Contributions**
   - Allow applicants to anonymously submit missing stipend data or correct outdated professor information.
