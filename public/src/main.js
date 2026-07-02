// ===== ProfScout Main Application =====
// Single-file SPA with router, data loading, and three pages

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
  };

  // ===== Data Loader =====
  async function loadData() {
    const loadingBar = document.getElementById('loading-bar-fill');
    try {
      loadingBar.style.width = '20%';

      const [profRes, instRes, areaRes] = await Promise.all([
        fetch('data/professors.json'),
        fetch('data/institutions.json'),
        fetch('data/areas.json'),
      ]);

      loadingBar.style.width = '60%';

      state.professors = await profRes.json();
      state.institutions = await instRes.json();
      const areaData = await areaRes.json();
      state.areas = areaData.areas || {};
      state.categories = areaData.categories || {};

      loadingBar.style.width = '100%';
      state.loaded = true;

      // Update header stats
      document.getElementById('stat-professors').textContent =
        `${state.professors.length.toLocaleString()} Professors`;

      // Small delay for animation
      await new Promise(r => setTimeout(r, 300));
      route();
    } catch (err) {
      console.error('Failed to load data:', err);
      document.getElementById('loading-screen').innerHTML =
        `<div class="empty-state"><div class="empty-state-icon">!</div>
         <div class="empty-state-text">Failed to load data</div>
         <div class="empty-state-hint">${err.message}<br>Make sure to run the data pipeline first: python scripts/build_data.py</div></div>`;
    }
  }

  // ===== Router =====
  function route() {
    if (!state.loaded) return;
    const hash = window.location.hash.replace('#/', '') || 'discover';
    state.currentPage = hash;

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === hash);
    });

    const main = document.getElementById('main-content');
    switch (hash) {
      case 'stipends': main.innerHTML = renderStipendsPage(); initStipendsPage(); break;
      case 'match': main.innerHTML = renderMatchPage(); initMatchPage(); break;
      default: main.innerHTML = renderDiscoverPage(); initDiscoverPage(); break;
    }
  }

  // ===== Utility Functions =====
  function getAreaLabel(code) {
    return state.areas[code] ? state.areas[code].label : code;
  }

  function getAreaCategory(code) {
    return state.areas[code] ? state.areas[code].category : 'Other';
  }

  function formatMoney(n) {
    if (n === undefined || n === null) return '---';
    return (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString();
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ===== DISCOVER PAGE =====
  function getFilteredProfessors() {
    const q = state.searchQuery.toLowerCase().trim();
    const { countries, categories, minPubs, univType } = state.filters;

    let results = state.professors;

    // Text search
    if (q) {
      results = results.filter(p => {
        const name = p.n.toLowerCase();
        const aff = p.a.toLowerCase();
        // Fuzzy: check if all query words appear in name or affiliation
        const words = q.split(/\s+/);
        return words.every(w => name.includes(w) || aff.includes(w));
      });
    }

    // Country filter
    if (countries.size > 0) {
      results = results.filter(p => countries.has(p.c));
    }

    // Category filter - professor must have at least one area in selected categories
    if (categories.size > 0) {
      results = results.filter(p => {
        return p.ar.some(area => {
          const cat = getAreaCategory(area);
          return categories.has(cat);
        });
      });
    }

    // Min publications
    if (minPubs > 0) {
      results = results.filter(p => p.tp >= minPubs);
    }

    // University type
    if (univType) {
      results = results.filter(p => {
        const inst = state.institutions[p.a];
        if (!inst || !inst.stipend) return false;
        return inst.stipend.type === univType;
      });
    }

    // Sort
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
    state.professors.forEach(p => {
      if (p.c) counts[p.c] = (counts[p.c] || 0) + 1;
    });
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

  const COUNTRY_NAMES = {
    us: 'USA', gb: 'UK', ca: 'Canada', de: 'Germany', cn: 'China', fr: 'France',
    au: 'Australia', in: 'India', sg: 'Singapore', ch: 'Switzerland', il: 'Israel',
    kr: 'South Korea', jp: 'Japan', nl: 'Netherlands', it: 'Italy', hk: 'Hong Kong',
    se: 'Sweden', br: 'Brazil', es: 'Spain', tr: 'Turkey', dk: 'Denmark',
    ie: 'Ireland', fi: 'Finland', be: 'Belgium', at: 'Austria', no: 'Norway',
    nz: 'New Zealand', tw: 'Taiwan', pt: 'Portugal', cz: 'Czechia', ir: 'Iran',
    pl: 'Poland', bd: 'Bangladesh', sa: 'Saudi Arabia', pk: 'Pakistan', qa: 'Qatar',
    ae: 'UAE', my: 'Malaysia', lk: 'Sri Lanka', cl: 'Chile', co: 'Colombia',
    ar: 'Argentina', th: 'Thailand', ph: 'Philippines', cy: 'Cyprus', ro: 'Romania',
    gr: 'Greece', hu: 'Hungary', ee: 'Estonia', mo: 'Macau', lv: 'Latvia',
    mt: 'Malta', bg: 'Bulgaria', za: 'South Africa', ru: 'Russia', jo: 'Jordan',
    lu: 'Luxembourg', lb: 'Lebanon', id: 'Indonesia', vn: 'Vietnam',
    eg: 'Egypt', ma: 'Morocco', sk: 'Slovakia'
  };

  function renderDiscoverPage() {
    const countryCounts = getCountryCounts().slice(0, 15); // Top 15
    const categoryCounts = getCategoryCounts();

    return `
      <div class="page-header">
        <h1 class="page-title">Discover Professors</h1>
        <p class="page-subtitle">Search ${state.professors.length.toLocaleString()} CS faculty across ${Object.keys(state.institutions).length.toLocaleString()} institutions worldwide</p>
      </div>
      <div class="search-container">
        <span class="search-icon">&#128270;</span>
        <input type="text" class="search-input" id="search-input"
               placeholder="Search by professor name or university..."
               value="${escapeHtml(state.searchQuery)}" autocomplete="off">
        <span class="search-count" id="search-count"></span>
      </div>
      <div class="discover-layout">
        <aside class="filter-panel" id="filter-panel">
          <div class="filter-section">
            <div class="filter-title" data-target="cat-options">Research Area</div>
            <div class="filter-options" id="cat-options">
              ${categoryCounts.map(([cat, count]) => `
                <label class="filter-option">
                  <input type="checkbox" data-filter="category" value="${cat}"
                    ${state.filters.categories.has(cat) ? 'checked' : ''}>
                  <span>${cat}</span>
                  <span class="count">${count.toLocaleString()}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="filter-section">
            <div class="filter-title" data-target="country-options">Country</div>
            <div class="filter-options" id="country-options">
              ${countryCounts.map(([code, count]) => `
                <label class="filter-option">
                  <input type="checkbox" data-filter="country" value="${code}"
                    ${state.filters.countries.has(code) ? 'checked' : ''}>
                  <span>${COUNTRY_NAMES[code] || code.toUpperCase()}</span>
                  <span class="count">${count.toLocaleString()}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="filter-section">
            <div class="filter-title">Min Publications</div>
            <div class="range-container">
              <input type="range" class="range-slider" id="min-pubs-slider"
                     min="0" max="100" step="5" value="${state.filters.minPubs}">
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
    if (profs.length === 0) {
      return `<div class="empty-state"><div class="empty-state-icon">&#128270;</div>
              <div class="empty-state-text">No professors found</div>
              <div class="empty-state-hint">Try adjusting your search or filters</div></div>`;
    }

    return profs.slice(0, count).map(p => {
      const inst = state.institutions[p.a] || {};
      const hasStipend = inst.stipend;
      const areas = p.ar.slice(0, 6).map(a => `<span class="area-tag">${getAreaLabel(a)}</span>`).join('');
      const moreAreas = p.ar.length > 6 ? `<span class="area-tag">+${p.ar.length - 6} more</span>` : '';

      const scholarUrl = p.s && p.s !== 'NOSCHOLARPAGE'
        ? `<a href="https://scholar.google.com/citations?user=${p.s}" target="_blank" rel="noopener" class="prof-link">Scholar</a>`
        : '';
      const homepageUrl = p.h
        ? `<a href="${p.h}" target="_blank" rel="noopener" class="prof-link">Homepage</a>`
        : '';

      const stipendLink = hasStipend
        ? `<a href="#/stipends" class="prof-link" style="border-color: rgba(16,185,129,0.3); color: #6ee7b7 !important;">${formatMoney(inst.stipend.preQual)}/yr</a>`
        : '';

      return `
        <div class="prof-card">
          <div class="prof-card-header">
            <div>
              <div class="prof-name">${escapeHtml(p.n)}</div>
              <div class="prof-affiliation">${escapeHtml(p.a)}</div>
            </div>
            <span class="prof-country">${COUNTRY_NAMES[p.c] || p.c || '?'}</span>
          </div>
          <div class="prof-areas">${areas}${moreAreas}</div>
          <div class="prof-stats">
            <span class="prof-stat"><strong>${Math.round(p.tp)}</strong> total pubs</span>
            <span class="prof-stat"><strong>${Math.round(p.rp)}</strong> since 2020</span>
            ${p.yr[0] ? `<span class="prof-stat">${p.yr[0]}\u2013${p.yr[1]}</span>` : ''}
          </div>
          <div class="prof-links">${homepageUrl}${scholarUrl}${stipendLink}</div>
        </div>
      `;
    }).join('');
  }

  function updateDiscoverResults() {
    const filtered = getFilteredProfessors();
    const listEl = document.getElementById('professor-list');
    const countEl = document.getElementById('results-count');
    const searchCountEl = document.getElementById('search-count');
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (listEl) listEl.innerHTML = renderProfCards(filtered, state.displayCount);
    if (countEl) countEl.innerHTML = `Showing <strong>${Math.min(state.displayCount, filtered.length)}</strong> of <strong>${filtered.length.toLocaleString()}</strong> professors`;
    if (searchCountEl) searchCountEl.textContent = `${filtered.length.toLocaleString()} results`;
    if (loadMoreBtn) loadMoreBtn.style.display = state.displayCount < filtered.length ? 'block' : 'none';
  }

  function initDiscoverPage() {
    state.displayCount = 25;

    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.searchQuery = e.target.value;
        state.displayCount = 25;
        updateDiscoverResults();
      }, 200);
    });
    searchInput.focus();

    // Filter checkboxes
    document.getElementById('filter-panel').addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.filter === 'country') {
        el.checked ? state.filters.countries.add(el.value) : state.filters.countries.delete(el.value);
      } else if (el.dataset.filter === 'category') {
        el.checked ? state.filters.categories.add(el.value) : state.filters.categories.delete(el.value);
      }
      state.displayCount = 25;
      updateDiscoverResults();
    });

    // Min pubs slider
    const slider = document.getElementById('min-pubs-slider');
    slider.addEventListener('input', (e) => {
      state.filters.minPubs = parseInt(e.target.value);
      document.getElementById('min-pubs-value').textContent = `${state.filters.minPubs}+ publications`;
      state.displayCount = 25;
      updateDiscoverResults();
    });

    // Sort
    document.getElementById('sort-select').addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      updateDiscoverResults();
    });

    // Load more
    document.getElementById('load-more-btn').addEventListener('click', () => {
      state.displayCount += 25;
      updateDiscoverResults();
    });

    // Collapsible filter sections
    document.querySelectorAll('.filter-title[data-target]').forEach(title => {
      title.addEventListener('click', () => {
        const target = document.getElementById(title.dataset.target);
        title.classList.toggle('collapsed');
        target.classList.toggle('collapsed');
      });
    });

    updateDiscoverResults();
  }

  // ===== STIPENDS PAGE =====
  function getStipendData() {
    const data = [];
    for (const [name, inst] of Object.entries(state.institutions)) {
      if (inst.stipend) {
        const lc = inst.livingCost;
        const stipend = inst.stipend.preQual;
        const fee = inst.stipend.fee;
        const living = lc ? lc.annual : null;
        const net = living !== null ? stipend - fee - living : null;

        data.push({
          name,
          stipend,
          fee,
          livingCost: living,
          net,
          type: inst.stipend.type,
          summerGtd: inst.stipend.summerGtd,
          county: lc ? lc.county : '',
        });
      }
    }
    return data.sort((a, b) => (b.net || -99999) - (a.net || -99999));
  }

  function renderStipendsPage() {
    const data = getStipendData();
    const withNet = data.filter(d => d.net !== null);
    const avgStipend = Math.round(data.reduce((s, d) => s + d.stipend, 0) / data.length);
    const bestNet = withNet.length ? withNet[0] : null;
    const worstNet = withNet.length ? withNet[withNet.length - 1] : null;
    const maxAbsNet = Math.max(...withNet.map(d => Math.abs(d.net)), 1);

    return `
      <div class="page-header">
        <h1 class="page-title">PhD Stipend Dashboard</h1>
        <p class="page-subtitle">Compare ${data.length} US university stipends adjusted for cost of living</p>
      </div>
      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-card-value">${formatMoney(avgStipend)}</div>
          <div class="stat-card-label">Average Stipend</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${bestNet ? formatMoney(bestNet.net) : '---'}</div>
          <div class="stat-card-label">Best Net: ${bestNet ? bestNet.name : '---'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value" style="-webkit-text-fill-color: ${worstNet && worstNet.net < 0 ? '#ef4444' : 'inherit'}">${worstNet ? formatMoney(worstNet.net) : '---'}</div>
          <div class="stat-card-label">Worst Net: ${worstNet ? worstNet.name : '---'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${data.length}</div>
          <div class="stat-card-label">Universities with Data</div>
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-title">Stipend After Fees & Living Cost (Annual)</div>
        <div class="bar-chart" id="stipend-chart">
          ${withNet.map(d => {
            const pct = Math.min(Math.abs(d.net) / maxAbsNet * 100, 100);
            const isPos = d.net >= 0;
            return `
              <div class="bar-row">
                <div class="bar-label" title="${d.name}">${d.name}</div>
                <div class="bar-track">
                  <div class="bar-fill ${isPos ? 'positive' : 'negative'}" style="width: ${pct}%"></div>
                </div>
                <div class="bar-value ${isPos ? 'positive' : 'negative'}">${formatMoney(d.net)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="stipend-table-container">
        <table class="stipend-table" id="stipend-table">
          <thead>
            <tr>
              <th data-sort="name">University <span class="sort-arrow"></span></th>
              <th data-sort="stipend">Stipend <span class="sort-arrow"></span></th>
              <th data-sort="fee">Fees <span class="sort-arrow"></span></th>
              <th data-sort="livingCost">Living Cost <span class="sort-arrow"></span></th>
              <th data-sort="net" class="sorted">Net <span class="sort-arrow">\u25BC</span></th>
              <th>Type</th>
              <th>Summer</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(d => `
              <tr>
                <td><strong style="color:var(--text-primary)">${escapeHtml(d.name)}</strong></td>
                <td class="money">${formatMoney(d.stipend)}</td>
                <td class="money">${formatMoney(d.fee)}</td>
                <td class="money">${d.livingCost !== null ? formatMoney(d.livingCost) : '---'}</td>
                <td class="money ${d.net !== null ? (d.net >= 0 ? 'positive' : 'negative') : ''}">${d.net !== null ? formatMoney(d.net) : '---'}</td>
                <td><span class="type-badge ${d.type}">${d.type || '?'}</span></td>
                <td class="summer-badge">${d.summerGtd ? '\u2705' : '\u2753'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function initStipendsPage() {
    // Sortable table headers
    const table = document.getElementById('stipend-table');
    if (!table) return;

    table.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const data = getStipendData();

        // Toggle sort direction
        const isAsc = th.classList.contains('sorted-asc');

        table.querySelectorAll('th').forEach(h => {
          h.classList.remove('sorted', 'sorted-asc');
          const arrow = h.querySelector('.sort-arrow');
          if (arrow) arrow.textContent = '';
        });
        th.classList.add('sorted', isAsc ? '' : 'sorted-asc');
        th.querySelector('.sort-arrow').textContent = isAsc ? '\u25B2' : '\u25BC';

        data.sort((a, b) => {
          let va = a[key], vb = b[key];
          if (va === null) va = isAsc ? Infinity : -Infinity;
          if (vb === null) vb = isAsc ? Infinity : -Infinity;
          if (typeof va === 'string') return isAsc ? va.localeCompare(vb) : vb.localeCompare(va);
          return isAsc ? va - vb : vb - va;
        });

        tbody.innerHTML = data.map(d => `
          <tr>
            <td><strong style="color:var(--text-primary)">${escapeHtml(d.name)}</strong></td>
            <td class="money">${formatMoney(d.stipend)}</td>
            <td class="money">${formatMoney(d.fee)}</td>
            <td class="money">${d.livingCost !== null ? formatMoney(d.livingCost) : '---'}</td>
            <td class="money ${d.net !== null ? (d.net >= 0 ? 'positive' : 'negative') : ''}">${d.net !== null ? formatMoney(d.net) : '---'}</td>
            <td><span class="type-badge ${d.type}">${d.type || '?'}</span></td>
            <td class="summer-badge">${d.summerGtd ? '\u2705' : '\u2753'}</td>
          </tr>
        `).join('');
      });
    });

    // Animate bars
    setTimeout(() => {
      document.querySelectorAll('.bar-fill').forEach(bar => {
        const w = bar.style.width;
        bar.style.width = '0%';
        requestAnimationFrame(() => { bar.style.width = w; });
      });
    }, 100);
  }

  // ===== MATCH PAGE =====
  function computeMatches() {
    if (state.selectedInterests.size === 0) return [];

    // Get all area codes for selected categories
    const selectedAreaCodes = new Set();
    for (const cat of state.selectedInterests) {
      const codes = state.categories[cat] || [];
      codes.forEach(c => selectedAreaCodes.add(c));
    }

    // Score each professor
    const results = [];
    for (const p of state.professors) {
      const profAreas = new Set(p.ar);
      const overlap = [];
      let overlapPubs = 0;

      for (const area of profAreas) {
        if (selectedAreaCodes.has(area)) {
          overlap.push(area);
        }
      }

      if (overlap.length === 0) continue;

      // Score = (matching areas / selected areas) * log(total pubs + 1)
      const areaScore = overlap.length / selectedAreaCodes.size;
      const pubScore = Math.log2(p.tp + 1) / 15; // Normalize
      const recencyBonus = p.rp > 0 ? 0.1 : 0;
      const score = Math.min((areaScore * 0.7 + pubScore * 0.2 + recencyBonus) * 100, 99);

      const inst = state.institutions[p.a] || {};

      results.push({
        prof: p,
        score: Math.round(score),
        matchingAreas: overlap,
        stipend: inst.stipend ? inst.stipend.preQual : null,
        net: inst.stipend && inst.livingCost
          ? inst.stipend.preQual - inst.stipend.fee - inst.livingCost.annual
          : null,
      });
    }

    results.sort((a, b) => b.score - a.score || b.prof.tp - a.prof.tp);
    return results;
  }

  function renderMatchPage() {
    const catEntries = Object.entries(state.categories);

    return `
      <div class="page-header">
        <h1 class="page-title">Find Your Research Match</h1>
        <p class="page-subtitle">Select your research interests and we'll find the best-matching professors</p>
      </div>

      <div class="interest-selector" id="interest-selector">
        ${catEntries.map(([cat, codes]) => `
          <div class="interest-category">
            <div class="interest-category-title">${cat}</div>
            <div class="interest-tags">
              <div class="interest-tag ${state.selectedInterests.has(cat) ? 'selected' : ''}"
                   data-category="${cat}">${cat} (${codes.length} venues)</div>
            </div>
          </div>
        `).join('')}

        <div class="match-controls">
          <button class="match-btn" id="match-btn"
                  ${state.selectedInterests.size === 0 ? 'disabled' : ''}>
            Find Matches (${state.selectedInterests.size} selected)
          </button>
          <span style="font-size:0.85rem; color:var(--text-muted)">
            ${state.selectedInterests.size > 0 ? 'Click "Find Matches" to see results' : 'Select at least one research area'}
          </span>
        </div>
      </div>

      <div id="match-results"></div>
    `;
  }

  function renderMatchResults(results) {
    if (results.length === 0) {
      return `<div class="empty-state"><div class="empty-state-icon">&#129517;</div>
              <div class="empty-state-text">No matches found</div>
              <div class="empty-state-hint">Try selecting different research areas</div></div>`;
    }

    const display = results.slice(0, 50);
    return `
      <div class="results-header">
        <div class="results-count">Top <strong>${display.length}</strong> of <strong>${results.length.toLocaleString()}</strong> matching professors</div>
      </div>
      <div class="professor-list">
        ${display.map((r, i) => {
          const p = r.prof;
          const medal = i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : '';
          const matchAreas = r.matchingAreas.map(a => `<span class="area-tag">${getAreaLabel(a)}</span>`).join('');

          const scholarUrl = p.s && p.s !== 'NOSCHOLARPAGE'
            ? `<a href="https://scholar.google.com/citations?user=${p.s}" target="_blank" rel="noopener" class="prof-link">Scholar</a>`
            : '';

          return `
            <div class="prof-card">
              <div class="prof-card-header">
                <div>
                  <div class="prof-name">${medal} ${escapeHtml(p.n)}</div>
                  <div class="prof-affiliation">${escapeHtml(p.a)}</div>
                </div>
                <div class="match-score">${r.score}% match</div>
              </div>
              <div class="match-areas-label">Matching areas:</div>
              <div class="prof-areas">${matchAreas}</div>
              <div class="prof-stats">
                <span class="prof-stat"><strong>${Math.round(p.tp)}</strong> total pubs</span>
                <span class="prof-stat"><strong>${Math.round(p.rp)}</strong> since 2020</span>
                ${r.stipend ? `<span class="match-stipend">Stipend: <strong>${formatMoney(r.stipend)}</strong></span>` : ''}
                ${r.net !== null ? `<span class="match-stipend">Net: <strong class="${r.net >= 0 ? 'positive' : 'negative'}">${formatMoney(r.net)}</strong></span>` : ''}
              </div>
              <div class="prof-links">
                ${p.h ? `<a href="${p.h}" target="_blank" rel="noopener" class="prof-link">Homepage</a>` : ''}
                ${scholarUrl}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function initMatchPage() {
    // Interest tag selection
    document.getElementById('interest-selector').addEventListener('click', (e) => {
      const tag = e.target.closest('.interest-tag');
      if (!tag) return;
      const cat = tag.dataset.category;
      if (state.selectedInterests.has(cat)) {
        state.selectedInterests.delete(cat);
        tag.classList.remove('selected');
      } else {
        state.selectedInterests.add(cat);
        tag.classList.add('selected');
      }
      const btn = document.getElementById('match-btn');
      btn.textContent = `Find Matches (${state.selectedInterests.size} selected)`;
      btn.disabled = state.selectedInterests.size === 0;
    });

    // Match button
    document.getElementById('match-btn').addEventListener('click', () => {
      const results = computeMatches();
      document.getElementById('match-results').innerHTML = renderMatchResults(results);
    });

    // Auto-run if interests are already selected
    if (state.selectedInterests.size > 0) {
      const results = computeMatches();
      document.getElementById('match-results').innerHTML = renderMatchResults(results);
    }
  }

  // ===== Initialize =====
  window.addEventListener('hashchange', route);

  // Load data and start
  loadData();
})();
