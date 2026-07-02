// ===== ProfScout Main Application =====
// Single-file SPA with router, data loading, and pages

(function() {
  'use strict';

  // ===== State =====
  const state = {
    professors: [],
    institutions: {},
    areas: {},
    loaded: false,
    currentPage: 'discover',
    // Discover page state
    searchQuery: '',
    filters: { countries: new Set(), categories: new Set(), minPubs: 0, univType: '' },
    sortBy: 'pubs',
    displayCount: 25,
    // Match page state
    selectedInterests: new Set(),
    // Storage State
    templates: JSON.parse(localStorage.getItem('profscout_templates')) || [
      { id: '1', name: 'Standard Cold Email', subject: 'Prospective PhD Student - {{my_name}}', body: 'Dear Prof. {{prof_lastName}},\n\nI am a prospective PhD student interested in your work at {{univ_name}}, specifically in {{research_area}}.\n\nI recently read your paper on [insert paper here] and was fascinated by the approach. I would love to discuss potential opportunities in your lab.\n\nBest regards,\n{{my_name}}' }
    ],
    activeTemplateId: '1',
    applications: JSON.parse(localStorage.getItem('profscout_applications')) || {}
  };

  // ===== Local Storage =====
  function saveTemplates() {
    localStorage.setItem('profscout_templates', JSON.stringify(state.templates));
  }
  function saveApplications() {
    localStorage.setItem('profscout_applications', JSON.stringify(state.applications));
  }

  // ===== Data Loader =====
  async function loadData() {
    const loadingBar = document.getElementById('loading-bar-fill');
    try {
      loadingBar.style.width = '20%';
      const [profRes, instRes, areaRes] = await Promise.all([
        fetch('data/professors.json'), fetch('data/institutions.json'), fetch('data/areas.json')
      ]);
      loadingBar.style.width = '60%';
      state.professors = await profRes.json();
      state.institutions = await instRes.json();
      const areaData = await areaRes.json();
      state.areas = areaData.areas || {};
      state.categories = areaData.categories || {};
      loadingBar.style.width = '100%';
      state.loaded = true;
      document.getElementById('stat-professors').textContent = `${state.professors.length.toLocaleString()} Professors`;
      await new Promise(r => setTimeout(r, 300));
      initModals();
      route();
    } catch (err) {
      console.error('Failed to load data:', err);
      document.getElementById('loading-screen').innerHTML = `<div class="empty-state"><div class="empty-state-icon">!</div><div class="empty-state-text">Failed to load data</div><div class="empty-state-hint">${err.message}</div></div>`;
    }
  }

  // ===== Router =====
  function route() {
    if (!state.loaded) return;
    const hash = window.location.hash.replace('#/', '') || 'discover';
    state.currentPage = hash;
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === hash);
    });
    const main = document.getElementById('main-content');
    switch (hash) {
      case 'stipends': main.innerHTML = renderStipendsPage(); initStipendsPage(); break;
      case 'match': main.innerHTML = renderMatchPage(); initMatchPage(); break;
      case 'templates': main.innerHTML = renderTemplatesPage(); initTemplatesPage(); break;
      case 'tracker': main.innerHTML = renderTrackerPage(); initTrackerPage(); break;
      default: main.innerHTML = renderDiscoverPage(); initDiscoverPage(); break;
    }
  }

  // ===== Utility Functions =====
  function getAreaLabel(code) { return state.areas[code] ? state.areas[code].label : code; }
  function getAreaCategory(code) { return state.areas[code] ? state.areas[code].category : 'Other'; }
  function formatMoney(n) { return n === undefined || n === null ? '---' : (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString(); }
  function escapeHtml(s) { const div = document.createElement('div'); div.textContent = s; return div.innerHTML; }
  function generateId() { return Math.random().toString(36).substr(2, 9); }

  const COUNTRY_NAMES = {
    us: 'USA', gb: 'UK', ca: 'Canada', de: 'Germany', cn: 'China', fr: 'France', au: 'Australia', in: 'India', sg: 'Singapore', ch: 'Switzerland', il: 'Israel', kr: 'South Korea', jp: 'Japan', nl: 'Netherlands', it: 'Italy', hk: 'Hong Kong', se: 'Sweden', br: 'Brazil', es: 'Spain', tr: 'Turkey', dk: 'Denmark', ie: 'Ireland', fi: 'Finland', be: 'Belgium', at: 'Austria', no: 'Norway', nz: 'New Zealand', tw: 'Taiwan', pt: 'Portugal', cz: 'Czechia', ir: 'Iran', pl: 'Poland', bd: 'Bangladesh', sa: 'Saudi Arabia', pk: 'Pakistan', qa: 'Qatar', ae: 'UAE', my: 'Malaysia', lk: 'Sri Lanka', cl: 'Chile', co: 'Colombia', ar: 'Argentina', th: 'Thailand', ph: 'Philippines', cy: 'Cyprus', ro: 'Romania', gr: 'Greece', hu: 'Hungary', ee: 'Estonia', mo: 'Macau', lv: 'Latvia', mt: 'Malta', bg: 'Bulgaria', za: 'South Africa', ru: 'Russia', jo: 'Jordan', lu: 'Luxembourg', lb: 'Lebanon', id: 'Indonesia', vn: 'Vietnam', eg: 'Egypt', ma: 'Morocco', sk: 'Slovakia'
  };

  // ===== Modals =====
  function initModals() {
    const modalHtml = `
      <div class="modal-overlay" id="app-modal">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-title" id="modal-title">Title</div>
            <button class="modal-close" id="modal-close">&times;</button>
          </div>
          <div class="modal-body" id="modal-body"></div>
          <div class="modal-footer" id="modal-footer"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('app-modal').addEventListener('click', (e) => {
      if (e.target.id === 'app-modal') closeModal();
    });
  }

  function openModal(title, bodyHtml, footerHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('app-modal').classList.add('active');
  }

  function closeModal() {
    document.getElementById('app-modal').classList.remove('active');
  }

  function renderEmailPreview(profName, univName, profAreasStr) {
    const template = state.templates.find(t => t.id === state.activeTemplateId) || state.templates[0];
    if (!template) return { subject: '', body: '' };

    const parts = profName.split(' ');
    const lastName = parts[parts.length - 1];
    const firstName = parts[0];

    const context = {
      prof_name: profName,
      prof_lastName: lastName,
      prof_firstName: firstName,
      univ_name: univName,
      research_area: profAreasStr || 'your research',
      my_name: '[Your Name]'
    };

    let subject = template.subject;
    let body = template.body;

    for (const [key, val] of Object.entries(context)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, val);
      body = body.replace(regex, val);
    }
    return { subject, body };
  }

  function openEmailModal(prof) {
    const profName = prof.n;
    const univName = prof.a;
    const profAreasStr = prof.ar.slice(0,2).map(getAreaLabel).join(' and ');

    const updatePreview = () => {
      const { subject, body } = renderEmailPreview(profName, univName, profAreasStr);
      document.getElementById('email-preview-subject').value = subject;
      document.getElementById('email-preview-body').value = body;
    };

    const templateOptions = state.templates.map(t =>
      `<option value="${t.id}" ${t.id === state.activeTemplateId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
    ).join('');

    const bodyHtml = `
      <div class="form-group">
        <label class="form-label">Select Template</label>
        <select class="form-input" id="email-template-select">
          ${templateOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Subject</label>
        <input type="text" class="form-input" id="email-preview-subject" readonly>
      </div>
      <div class="form-group">
        <label class="form-label">Body</label>
        <textarea class="form-textarea" id="email-preview-body" style="min-height: 200px" readonly></textarea>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-send-btn">Open in Email Client</button>
    `;

    openModal(`Email ${profName}`, bodyHtml, footerHtml);
    updatePreview();

    document.getElementById('email-template-select').addEventListener('change', (e) => {
      state.activeTemplateId = e.target.value;
      updatePreview();
    });

    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('modal-send-btn').addEventListener('click', () => {
      const sub = encodeURIComponent(document.getElementById('email-preview-subject').value);
      const bod = encodeURIComponent(document.getElementById('email-preview-body').value);
      window.open(`mailto:?subject=${sub}&body=${bod}`);
      closeModal();
    });
  }

  function toggleTrackProfessor(prof) {
    const profId = prof.n + '_' + prof.a;
    if (state.applications[profId]) {
      delete state.applications[profId];
    } else {
      state.applications[profId] = {
        id: profId, prof: prof, status: 'saved', addedAt: Date.now()
      };
    }
    saveApplications();
    if (state.currentPage === 'discover') updateDiscoverResults();
    else if (state.currentPage === 'match') {
      document.getElementById('match-results').innerHTML = renderMatchResults(computeMatches());
      initMatchListEvents();
    }
  }

  // ===== DISCOVER PAGE =====
  function getFilteredProfessors() {
    const q = state.searchQuery.toLowerCase().trim();
    const { countries, categories, minPubs, univType } = state.filters;
    let results = state.professors;
    if (q) {
      results = results.filter(p => {
        const name = p.n.toLowerCase(), aff = p.a.toLowerCase();
        return q.split(/\s+/).every(w => name.includes(w) || aff.includes(w));
      });
    }
    if (countries.size > 0) results = results.filter(p => countries.has(p.c));
    if (categories.size > 0) results = results.filter(p => p.ar.some(area => categories.has(getAreaCategory(area))));
    if (minPubs > 0) results = results.filter(p => p.tp >= minPubs);
    if (univType) results = results.filter(p => { const i = state.institutions[p.a]; return i && i.stipend && i.stipend.type === univType; });

    switch (state.sortBy) {
      case 'name': results.sort((a, b) => a.n.localeCompare(b.n)); break;
      case 'recent': results.sort((a, b) => b.rp - a.rp); break;
      case 'affiliation': results.sort((a, b) => a.a.localeCompare(b.a)); break;
      default: results.sort((a, b) => b.tp - a.tp); break;
    }
    return results;
  }

  function getCountryCounts() {
    const counts = {};
    state.professors.forEach(p => { if (p.c) counts[p.c] = (counts[p.c] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }
  function getCategoryCounts() {
    const counts = {};
    state.professors.forEach(p => {
      const seen = new Set();
      p.ar.forEach(area => {
        const cat = getAreaCategory(area);
        if (!seen.has(cat)) { counts[cat] = (counts[cat] || 0) + 1; seen.add(cat); }
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  function renderDiscoverPage() {
    const countryCounts = getCountryCounts().slice(0, 15);
    const categoryCounts = getCategoryCounts();
    return `
      <div class="page-header">
        <h1 class="page-title">Discover Professors</h1>
        <p class="page-subtitle">Search ${state.professors.length.toLocaleString()} CS faculty across ${Object.keys(state.institutions).length.toLocaleString()} institutions worldwide</p>
      </div>
      <div class="search-container">
        <span class="search-icon">&#128270;</span>
        <input type="text" class="search-input" id="search-input" placeholder="Search by professor name or university..." value="${escapeHtml(state.searchQuery)}" autocomplete="off">
        <span class="search-count" id="search-count"></span>
      </div>
      <div class="discover-layout">
        <aside class="filter-panel" id="filter-panel">
          <div class="filter-section">
            <div class="filter-title" data-target="cat-options">Research Area</div>
            <div class="filter-options" id="cat-options">
              ${categoryCounts.map(([cat, count]) => `
                <label class="filter-option"><input type="checkbox" data-filter="category" value="${cat}" ${state.filters.categories.has(cat) ? 'checked' : ''}><span>${cat}</span><span class="count">${count.toLocaleString()}</span></label>
              `).join('')}
            </div>
          </div>
          <div class="filter-section">
            <div class="filter-title" data-target="country-options">Country</div>
            <div class="filter-options" id="country-options">
              ${countryCounts.map(([code, count]) => `
                <label class="filter-option"><input type="checkbox" data-filter="country" value="${code}" ${state.filters.countries.has(code) ? 'checked' : ''}><span>${COUNTRY_NAMES[code] || code.toUpperCase()}</span><span class="count">${count.toLocaleString()}</span></label>
              `).join('')}
            </div>
          </div>
          <div class="filter-section">
            <div class="filter-title">Min Publications</div>
            <div class="range-container">
              <input type="range" class="range-slider" id="min-pubs-slider" min="0" max="100" step="5" value="${state.filters.minPubs}">
              <div class="range-value" id="min-pubs-value">${state.filters.minPubs}+ publications</div>
            </div>
          </div>
        </aside>
        <section id="results-section">
          <div class="results-header">
            <div class="results-count" id="results-count"></div>
            <select class="sort-select" id="sort-select">
              <option value="pubs" ${state.sortBy === 'pubs' ? 'selected' : ''}>Sort: Most Publications</option>
              <option value="recent" ${state.sortBy === 'recent' ? 'selected' : ''}>Sort: Recent Publications</option>
              <option value="name" ${state.sortBy === 'name' ? 'selected' : ''}>Sort: Name A-Z</option>
              <option value="affiliation" ${state.sortBy === 'affiliation' ? 'selected' : ''}>Sort: University A-Z</option>
            </select>
          </div>
          <div class="professor-list" id="professor-list"></div>
          <button class="load-more-btn" id="load-more-btn" style="display:none">Load More</button>
        </section>
      </div>
    `;
  }

  function renderProfCards(profs, count) {
    if (profs.length === 0) return `<div class="empty-state"><div class="empty-state-icon">&#128270;</div><div class="empty-state-text">No professors found</div></div>`;
    return profs.slice(0, count).map(p => {
      const profId = p.n + '_' + p.a;
      const isTracked = !!state.applications[profId];
      const inst = state.institutions[p.a] || {};
      const areas = p.ar.slice(0, 6).map(a => `<span class="area-tag">${getAreaLabel(a)}</span>`).join('');
      const moreAreas = p.ar.length > 6 ? `<span class="area-tag">+${p.ar.length - 6} more</span>` : '';
      const scholarUrl = p.s && p.s !== 'NOSCHOLARPAGE' ? `<a href="https://scholar.google.com/citations?user=${p.s}" target="_blank" class="prof-link">Scholar</a>` : '';
      const homepageUrl = p.h ? `<a href="${p.h}" target="_blank" class="prof-link">Homepage</a>` : '';
      const stipendLink = inst.stipend ? `<a href="#/stipends" class="prof-link" style="border-color: rgba(16,185,129,0.3); color: #6ee7b7 !important;">${formatMoney(inst.stipend.preQual)}/yr</a>` : '';

      return `
        <div class="prof-card">
          <div class="prof-card-header">
            <div><div class="prof-name">${escapeHtml(p.n)}</div><div class="prof-affiliation">${escapeHtml(p.a)}</div></div>
            <span class="prof-country">${COUNTRY_NAMES[p.c] || p.c || '?'}</span>
          </div>
          <div class="prof-areas">${areas}${moreAreas}</div>
          <div class="prof-stats">
            <span class="prof-stat"><strong>${Math.round(p.tp)}</strong> total pubs</span>
            <span class="prof-stat"><strong>${Math.round(p.rp)}</strong> since 2020</span>
          </div>
          <div class="prof-links">${homepageUrl}${scholarUrl}${stipendLink}</div>
          <div class="prof-actions">
            <button class="action-btn email-btn" data-prof='${JSON.stringify(p).replace(/'/g, "&apos;")}'>&#9993; Email</button>
            <button class="action-btn track-btn ${isTracked ? 'tracked' : ''}" data-prof='${JSON.stringify(p).replace(/'/g, "&apos;")}'>
              ${isTracked ? '&#10003; Tracked' : '&#128161; Track'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateDiscoverResults() {
    if(state.currentPage !== 'discover') return;
    const filtered = getFilteredProfessors();
    const listEl = document.getElementById('professor-list');
    if (listEl) listEl.innerHTML = renderProfCards(filtered, state.displayCount);
    const countEl = document.getElementById('results-count');
    if (countEl) countEl.innerHTML = `Showing <strong>${Math.min(state.displayCount, filtered.length)}</strong> of <strong>${filtered.length.toLocaleString()}</strong> professors`;
    const searchCountEl = document.getElementById('search-count');
    if (searchCountEl) searchCountEl.textContent = `${filtered.length.toLocaleString()} results`;
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) loadMoreBtn.style.display = state.displayCount < filtered.length ? 'block' : 'none';

    initDiscoverListEvents();
  }

  function initDiscoverListEvents() {
    const listEl = document.getElementById('professor-list');
    if (!listEl) return;
    listEl.querySelectorAll('.email-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prof = JSON.parse(e.target.dataset.prof);
        openEmailModal(prof);
      });
    });
    listEl.querySelectorAll('.track-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prof = JSON.parse(e.target.dataset.prof);
        toggleTrackProfessor(prof);
      });
    });
  }

  function initDiscoverPage() {
    state.displayCount = 25;
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { state.searchQuery = e.target.value; state.displayCount = 25; updateDiscoverResults(); }, 200);
    });
    document.getElementById('filter-panel').addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.filter === 'country') el.checked ? state.filters.countries.add(el.value) : state.filters.countries.delete(el.value);
      else if (el.dataset.filter === 'category') el.checked ? state.filters.categories.add(el.value) : state.filters.categories.delete(el.value);
      state.displayCount = 25; updateDiscoverResults();
    });
    document.getElementById('min-pubs-slider').addEventListener('input', (e) => {
      state.filters.minPubs = parseInt(e.target.value);
      document.getElementById('min-pubs-value').textContent = `${state.filters.minPubs}+ publications`;
      state.displayCount = 25; updateDiscoverResults();
    });
    document.getElementById('sort-select').addEventListener('change', (e) => { state.sortBy = e.target.value; updateDiscoverResults(); });
    document.getElementById('load-more-btn').addEventListener('click', () => { state.displayCount += 25; updateDiscoverResults(); });
    document.querySelectorAll('.filter-title[data-target]').forEach(title => {
      title.addEventListener('click', () => {
        const target = document.getElementById(title.dataset.target);
        title.classList.toggle('collapsed'); target.classList.toggle('collapsed');
      });
    });
    updateDiscoverResults();
  }

  // ===== STIPENDS PAGE =====
  function getStipendData() {
    const data = [];
    for (const [name, inst] of Object.entries(state.institutions)) {
      if (inst.stipend) {
        const lc = inst.livingCost, stipend = inst.stipend.preQual, fee = inst.stipend.fee;
        const living = lc ? lc.annual : null;
        data.push({ name, stipend, fee, livingCost: living, net: living !== null ? stipend - fee - living : null, type: inst.stipend.type, summerGtd: inst.stipend.summerGtd });
      }
    }
    return data.sort((a, b) => (b.net || -99999) - (a.net || -99999));
  }
  function renderStipendsPage() {
    const data = getStipendData();
    const withNet = data.filter(d => d.net !== null);
    const avgStipend = Math.round(data.reduce((s, d) => s + d.stipend, 0) / data.length);
    const maxAbsNet = Math.max(...withNet.map(d => Math.abs(d.net)), 1);

    return `
      <div class="page-header"><h1 class="page-title">PhD Stipend Dashboard</h1></div>
      <div class="stat-cards">
        <div class="stat-card"><div class="stat-card-value">${formatMoney(avgStipend)}</div><div class="stat-card-label">Average Stipend</div></div>
      </div>
      <div class="chart-container">
        <div class="chart-title">Stipend After Fees & Living Cost</div>
        <div class="bar-chart">
          ${withNet.map(d => {
            const pct = Math.min(Math.abs(d.net) / maxAbsNet * 100, 100), isPos = d.net >= 0;
            return `<div class="bar-row"><div class="bar-label">${d.name}</div><div class="bar-track"><div class="bar-fill ${isPos?'positive':'negative'}" style="width: ${pct}%"></div></div><div class="bar-value ${isPos?'positive':'negative'}">${formatMoney(d.net)}</div></div>`;
          }).join('')}
        </div>
      </div>
    `;
  }
  function initStipendsPage() {
    setTimeout(() => {
      document.querySelectorAll('.bar-fill').forEach(bar => { const w = bar.style.width; bar.style.width = '0%'; requestAnimationFrame(() => bar.style.width = w); });
    }, 100);
  }

  // ===== MATCH PAGE =====
  function computeMatches() {
    if (state.selectedInterests.size === 0) return [];
    const selectedAreaCodes = new Set();
    for (const cat of state.selectedInterests) { (state.categories[cat] || []).forEach(c => selectedAreaCodes.add(c)); }
    const results = [];
    for (const p of state.professors) {
      const profAreas = new Set(p.ar), overlap = [];
      for (const area of profAreas) if (selectedAreaCodes.has(area)) overlap.push(area);
      if (overlap.length === 0) continue;
      const areaScore = overlap.length / selectedAreaCodes.size, pubScore = Math.log2(p.tp + 1) / 15, recencyBonus = p.rp > 0 ? 0.1 : 0;
      const score = Math.min((areaScore * 0.7 + pubScore * 0.2 + recencyBonus) * 100, 99);
      const inst = state.institutions[p.a] || {};
      results.push({ prof: p, score: Math.round(score), matchingAreas: overlap, stipend: inst.stipend ? inst.stipend.preQual : null, net: inst.stipend && inst.livingCost ? inst.stipend.preQual - inst.stipend.fee - inst.livingCost.annual : null });
    }
    return results.sort((a, b) => b.score - a.score || b.prof.tp - a.prof.tp);
  }
  function renderMatchPage() {
    const catEntries = Object.entries(state.categories);
    return `
      <div class="page-header"><h1 class="page-title">Find Your Research Match</h1></div>
      <div class="interest-selector" id="interest-selector">
        ${catEntries.map(([cat, codes]) => `<div class="interest-category"><div class="interest-category-title">${cat}</div><div class="interest-tags">${codes.map(c => '').join('')}<div class="interest-tag ${state.selectedInterests.has(cat)?'selected':''}" data-category="${cat}">${cat}</div></div></div>`).join('')}
        <div class="match-controls"><button class="match-btn" id="match-btn" ${state.selectedInterests.size===0?'disabled':''}>Find Matches</button></div>
      </div>
      <div id="match-results"></div>
    `;
  }
  function renderMatchResults(results) {
    if (results.length === 0) return `<div class="empty-state"><div class="empty-state-text">No matches found</div></div>`;
    return `<div class="professor-list">${results.slice(0, 50).map((r, i) => {
      const p = r.prof, profId = p.n + '_' + p.a, isTracked = !!state.applications[profId];
      return `
        <div class="prof-card">
          <div class="prof-card-header"><div><div class="prof-name">${escapeHtml(p.n)}</div><div class="prof-affiliation">${escapeHtml(p.a)}</div></div><div class="match-score">${r.score}% match</div></div>
          <div class="prof-areas">${r.matchingAreas.map(a => `<span class="area-tag">${getAreaLabel(a)}</span>`).join('')}</div>
          <div class="prof-actions">
            <button class="action-btn email-btn" data-prof='${JSON.stringify(p).replace(/'/g, "&apos;")}'>&#9993; Email</button>
            <button class="action-btn track-btn ${isTracked?'tracked':''}" data-prof='${JSON.stringify(p).replace(/'/g, "&apos;")}'>${isTracked ? '&#10003; Tracked' : '&#128161; Track'}</button>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  }
  function initMatchListEvents() {
    const listEl = document.getElementById('match-results');
    if (!listEl) return;
    listEl.querySelectorAll('.email-btn').forEach(btn => {
      btn.addEventListener('click', (e) => openEmailModal(JSON.parse(e.target.dataset.prof)));
    });
    listEl.querySelectorAll('.track-btn').forEach(btn => {
      btn.addEventListener('click', (e) => toggleTrackProfessor(JSON.parse(e.target.dataset.prof)));
    });
  }
  function initMatchPage() {
    document.getElementById('interest-selector').addEventListener('click', (e) => {
      const tag = e.target.closest('.interest-tag');
      if (!tag) return;
      const cat = tag.dataset.category;
      if (state.selectedInterests.has(cat)) { state.selectedInterests.delete(cat); tag.classList.remove('selected'); }
      else { state.selectedInterests.add(cat); tag.classList.add('selected'); }
      document.getElementById('match-btn').disabled = state.selectedInterests.size === 0;
    });
    document.getElementById('match-btn').addEventListener('click', () => {
      document.getElementById('match-results').innerHTML = renderMatchResults(computeMatches());
      initMatchListEvents();
    });
    if (state.selectedInterests.size > 0) {
      document.getElementById('match-results').innerHTML = renderMatchResults(computeMatches());
      initMatchListEvents();
    }
  }

  // ===== TEMPLATES PAGE =====
  function renderTemplatesPage() {
    const template = state.templates.find(t => t.id === state.activeTemplateId) || state.templates[0] || {};
    return `
      <div class="page-header"><h1 class="page-title">Email Templates</h1></div>
      <div class="templates-layout">
        <aside class="templates-sidebar">
          <div class="templates-sidebar-header">
            <strong>Templates</strong>
            <button class="btn btn-secondary" id="add-template-btn" style="padding:4px 8px; font-size:0.8rem">+ New</button>
          </div>
          <div class="templates-list" id="templates-list">
            ${state.templates.map(t => `
              <div class="template-item ${t.id === state.activeTemplateId ? 'active' : ''}" data-id="${t.id}">
                <span class="template-item-name">${escapeHtml(t.name)}</span>
                <button class="template-delete-btn" data-id="${t.id}">&times;</button>
              </div>
            `).join('')}
          </div>
        </aside>
        <section class="template-editor" id="template-editor-section">
          ${template.id ? `
            <div class="form-group">
              <label class="form-label">Template Name</label>
              <input type="text" class="form-input" id="tpl-name" value="${escapeHtml(template.name)}">
            </div>
            <div class="form-group">
              <label class="form-label">Email Subject</label>
              <input type="text" class="form-input" id="tpl-subject" value="${escapeHtml(template.subject)}">
            </div>
            <div class="form-group" style="flex:1; display:flex; flex-direction:column">
              <label class="form-label">Email Body</label>
              <textarea class="form-textarea" id="tpl-body">${escapeHtml(template.body)}</textarea>
              <div class="merge-tags">
                <span class="merge-tag" data-tag="{{prof_name}}">+ {{prof_name}}</span>
                <span class="merge-tag" data-tag="{{prof_lastName}}">+ {{prof_lastName}}</span>
                <span class="merge-tag" data-tag="{{univ_name}}">+ {{univ_name}}</span>
                <span class="merge-tag" data-tag="{{research_area}}">+ {{research_area}}</span>
                <span class="merge-tag" data-tag="{{my_name}}">+ {{my_name}}</span>
              </div>
            </div>
            <div style="text-align:right">
              <button class="btn btn-primary" id="save-template-btn">Save Template</button>
            </div>
          ` : '<div class="empty-state">No templates. Create one.</div>'}
        </section>
      </div>
    `;
  }
  function initTemplatesPage() {
    document.getElementById('add-template-btn')?.addEventListener('click', () => {
      const newTpl = { id: generateId(), name: 'New Template', subject: '', body: '' };
      state.templates.push(newTpl);
      state.activeTemplateId = newTpl.id;
      saveTemplates();
      route();
    });
    document.getElementById('templates-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.template-item');
      const delBtn = e.target.closest('.template-delete-btn');
      if (delBtn) {
        const id = delBtn.dataset.id;
        state.templates = state.templates.filter(t => t.id !== id);
        if (state.activeTemplateId === id) state.activeTemplateId = state.templates[0]?.id || null;
        saveTemplates();
        route();
      } else if (item) {
        state.activeTemplateId = item.dataset.id;
        route();
      }
    });
    const editor = document.getElementById('template-editor-section');
    if (editor) {
      document.getElementById('save-template-btn')?.addEventListener('click', () => {
        const tpl = state.templates.find(t => t.id === state.activeTemplateId);
        if (tpl) {
          tpl.name = document.getElementById('tpl-name').value;
          tpl.subject = document.getElementById('tpl-subject').value;
          tpl.body = document.getElementById('tpl-body').value;
          saveTemplates();
          route(); // re-render list
        }
      });
      document.querySelectorAll('.merge-tag').forEach(tag => {
        tag.addEventListener('click', () => {
          const bodyEl = document.getElementById('tpl-body');
          const cursor = bodyEl.selectionStart;
          const text = bodyEl.value;
          bodyEl.value = text.substring(0, cursor) + tag.dataset.tag + text.substring(cursor);
          bodyEl.focus();
        });
      });
    }
  }

  // ===== TRACKER PAGE =====
  const KANBAN_COLS = ['saved', 'contacted', 'interviewing', 'accepted', 'rejected'];
  const COL_NAMES = { saved: 'Saved', contacted: 'Contacted', interviewing: 'Interviewing', accepted: 'Accepted', rejected: 'Rejected' };

  function renderTrackerPage() {
    const appsByCol = {};
    KANBAN_COLS.forEach(c => appsByCol[c] = []);
    Object.values(state.applications).forEach(app => {
      if (appsByCol[app.status]) appsByCol[app.status].push(app);
      else appsByCol['saved'].push(app);
    });

    return `
      <div class="page-header"><h1 class="page-title">Application Tracker</h1></div>
      <div class="kanban-board">
        ${KANBAN_COLS.map(col => `
          <div class="kanban-column" data-status="${col}">
            <div class="kanban-column-header">
              <span>${COL_NAMES[col]}</span>
              <span class="kanban-count">${appsByCol[col].length}</span>
            </div>
            <div class="kanban-cards" ondragover="event.preventDefault()" data-status="${col}">
              ${appsByCol[col].map(app => `
                <div class="kanban-card" draggable="true" data-id="${app.id}">
                  <div class="kanban-card-title">${escapeHtml(app.prof.n)}</div>
                  <div class="kanban-card-subtitle">${escapeHtml(app.prof.a)}</div>
                  <div class="kanban-card-actions">
                    <select class="status-select" data-id="${app.id}">
                      ${KANBAN_COLS.map(c => `<option value="${c}" ${app.status===c?'selected':''}>${COL_NAMES[c]}</option>`).join('')}
                    </select>
                    <button class="action-btn email-btn" style="padding:2px 6px; font-size:0.7rem" data-prof='${JSON.stringify(app.prof).replace(/'/g, "&apos;")}'>&#9993;</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  function initTrackerPage() {
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (state.applications[id]) {
          state.applications[id].status = e.target.value;
          saveApplications();
          route();
        }
      });
    });
    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', card.dataset.id); });
    });
    document.querySelectorAll('.kanban-cards').forEach(col => {
      col.addEventListener('drop', e => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (id && state.applications[id]) {
          state.applications[id].status = col.dataset.status;
          saveApplications();
          route();
        }
      });
    });
    document.querySelectorAll('.email-btn').forEach(btn => {
      btn.addEventListener('click', (e) => openEmailModal(JSON.parse(e.target.dataset.prof)));
    });
  }

  // ===== Initialize =====
  window.addEventListener('hashchange', route);
  loadData();
})();
