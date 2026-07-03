// ===== ProfScout Main Application =====
// Single-file SPA with router, data loading, and pages

(function() {
  'use strict';
  
  let isFirstLoad = true;
  let hasScrolledData = false;
  
  // ===== Theme Management =====
  const toggleBtn = document.getElementById('theme-toggle');
  const root = document.documentElement;
  
  // Default to system preference, overridden by localStorage if set
  let isLightMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  if (localStorage.getItem('theme') === 'light') isLightMode = true;
  if (localStorage.getItem('theme') === 'dark') isLightMode = false;

  function applyTheme() {
    if (isLightMode) {
      root.setAttribute('data-theme', 'light');
      toggleBtn.innerHTML = '🌙';
      toggleBtn.title = "Switch to Dark Mode";
    } else {
      root.setAttribute('data-theme', 'dark');
      toggleBtn.innerHTML = '☀️';
      toggleBtn.title = "Switch to Light Mode";
    }
  }
  applyTheme();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isLightMode = !isLightMode;
      localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
      applyTheme();
    });
  }

  // Listen for system theme changes if user hasn't overridden
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
      isLightMode = e.matches;
      applyTheme();
    }
  });

  // ===== Mail Page =====
  function renderOutboxPage() {
    if (state.isStatic) {
      return `
        <div style="text-align:center; padding:4rem; max-width:600px; margin:0 auto;">
          <h2 style="color:var(--text-primary); margin-bottom:1rem;">Desktop App Required</h2>
          <p style="color:var(--text-secondary); line-height:1.6; margin-bottom:2rem;">
            Sending and scheduling AI-generated emails requires the local Python backend to communicate with SMTP servers and sync with your Gmail IMAP. This feature is not available in the static web preview.
          </p>
          <a href="https://github.com/satyam-thakur/mail_automation" target="_blank" class="action-btn" style="text-decoration:none; display:inline-block; font-size:1.1rem; padding:0.75rem 1.5rem;">
            Download Desktop Version
          </a>
        </div>
      `;
    }
    return `
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h1 class="page-title">Mail</h1>
          <div style="color:var(--text-muted); margin-top:0.5rem; font-size:0.9rem;">Emails are synced directly with your Gmail.</div>
        </div>
        <button class="btn btn-secondary" id="sync-gmail-btn">Sync Gmail Status</button>
      </div>
      
      <h2 style="margin-top: 1rem; margin-bottom: 1rem; font-size: 1.2rem; color: var(--text-primary); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Scheduled Emails</h2>
      <div style="background-color: rgba(255, 152, 0, 0.1); border-left: 4px solid var(--accent-3); padding: 1rem; margin-bottom: 1rem; border-radius: 4px; color: var(--text-primary);">
        <strong>⚠️ Important Note:</strong> Gmail does not natively support API scheduling. These emails are scheduled <strong>locally</strong>. Your Python terminal server (<code>serve.py</code>) <strong>must remain running</strong> at the scheduled time in order for the emails to be sent!
      </div>
      <div id="outbox-scheduled-list" class="tracker-grid">
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">Loading...</div>
      </div>
      
      <h2 style="margin-top: 2rem; margin-bottom: 1rem; font-size: 1.2rem; color: var(--text-primary); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Sent Emails</h2>
      <div id="outbox-sent-list" class="tracker-grid">
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">Loading...</div>
      </div>
    `;
  }
  
  async function initOutboxPage() {
    const scheduledListEl = document.getElementById('outbox-scheduled-list');
    const sentListEl = document.getElementById('outbox-sent-list');
    
    document.getElementById('sync-gmail-btn')?.addEventListener('click', async (e) => {
      const btn = e.target;
      btn.textContent = 'Syncing...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/sync-imap', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          alert('✅ ' + data.message);
          initOutboxPage();
        } else {
          alert('❌ Failed to sync with Gmail.');
          btn.textContent = 'Sync Gmail Status';
          btn.disabled = false;
        }
      } catch (err) {
        alert('❌ Network error during sync.');
        btn.textContent = 'Sync Gmail Status';
        btn.disabled = false;
      }
    });

    try {
      const res = await fetch('/api/outbox');
      const data = await res.json();
      const outbox = data.outbox || [];
      
      const scheduled = outbox.filter(e => e.status === 'pending');
      const sent = outbox.filter(e => e.status !== 'pending');
      
      const renderEmailCard = (email) => {
        const d = new Date(email.sendAt);
        const statusColor = email.status === 'sent' ? 'var(--accent-4)' : (email.status === 'failed' ? 'var(--accent-danger)' : 'var(--accent-5)');
        return `
          <div class="prof-card">
            <h3 class="prof-name" style="font-size:1.1rem; margin-bottom: 0.5rem;">To: ${escapeHtml(email.profName || email.to)}</h3>
            <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom: 0.5rem;">${escapeHtml(email.to)}</div>
            <div class="prof-uni" style="color:var(--text-primary); margin-bottom: 0.5rem;"><strong>Subject:</strong> ${escapeHtml(email.subject)}</div>
            <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom: 1rem;">
              <strong>Scheduled for:</strong> ${d.toLocaleString()}<br>
              <strong>Status:</strong> <span style="color:${statusColor}">${email.status.toUpperCase()}</span>
              ${email.errorMsg ? '<br><span style="color:var(--accent-danger)">Error: ' + escapeHtml(email.errorMsg) + '</span>' : ''}
            </div>
            <div style="display:flex; gap:0.5rem;">
              <a href="https://mail.google.com/mail/u/0/#search/rfc822msgid%3A%3C${email.id}%40profscout.local%3E" target="_blank" class="btn btn-primary" style="text-decoration:none; display:inline-block; font-size: 0.8rem; padding: 4px 8px;" title="View in Gmail">📧 Gmail</a>
              ${email.status === 'pending' ? `<button class="btn btn-secondary" onclick="cancelEmail('${email.id}')" style="font-size: 0.8rem; padding: 4px 8px;">Cancel</button>` : ''}
            </div>
          </div>
        `;
      };
      
      if (scheduled.length === 0) {
        scheduledListEl.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 1rem;">No scheduled emails.</div>';
      } else {
        scheduledListEl.innerHTML = scheduled.map(renderEmailCard).join('');
      }
      
      if (sent.length === 0) {
        sentListEl.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 1rem;">No sent emails found.</div>';
      } else {
        sentListEl.innerHTML = sent.map(renderEmailCard).join('');
      }
      
    } catch(err) {
      scheduledListEl.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--accent-danger);">Failed to load outbox.</div>';
      sentListEl.innerHTML = '';
    }
  }
  
  window.cancelEmail = async (id) => {
    if (!confirm('Are you sure you want to cancel this scheduled email?')) return;
    try {
      await fetch('/api/outbox/' + id, { method: 'DELETE' });
      initOutboxPage();
    } catch(err) {
      alert('Failed to cancel email.');
    }
  };

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
    openAlexMode: false,
    openAlexResults: [],
    displayCount: 25,
    templates: [],
    activeTemplateId: null,
    applications: {},
    settings: { llmProvider: 'openai', apiKey: '', userName: '', userBackground: '', smtpEmail: '', smtpPassword: '' }
  };

  // ===== Backend Storage =====
  async function saveTemplates() {
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.templates)
    });
  }
  async function saveApplications() {
    await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.applications)
    });
  }
  async function saveSettings() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.settings)
    });
  }

  // ===== Data Loader =====
  async function loadData() {
    const loadingBar = document.getElementById('loading-bar-fill');
    try {
      loadingBar.style.width = '20%';
      const [profRes, instRes, areaRes, stateRes] = await Promise.all([
        fetch('data/professors.json'), fetch('data/institutions.json'), fetch('data/areas.json'), fetch('/api/state').catch(() => null)
      ]);
      loadingBar.style.width = '60%';
      state.professors = await profRes.json();
      state.institutions = await instRes.json();
      const areaData = await areaRes.json();
      state.areas = areaData.areas || {};
      state.categories = areaData.categories || {};
      
      try {
        if (!stateRes || !stateRes.ok) throw new Error("Backend not available");
        const serverState = await stateRes.json();
        state.settings = serverState.settings;
        state.templates = serverState.templates;
        if (state.templates.length > 0) {
          state.activeTemplateId = state.templates[0].id;
        }
        state.applications = serverState.applications;
      } catch (e) {
        // Fallback for static hosting (GitHub Pages / Netlify)
        state.isStatic = true;
        state.settings = { provider: 'openai', openaiKey: '', anthropicKey: '', geminiKey: '', senderName: '', senderEmail: '', smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpUser: '', smtpPass: '', imapHost: 'imap.gmail.com', imapPort: 993, smtpProtocol: 'tls' };
        state.templates = [];
        state.applications = {};
      }

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
      case 'outbox': main.innerHTML = renderOutboxPage(); initOutboxPage(); break;
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
    const settingsBtn = document.getElementById('nav-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openSettingsModal();
      });
    }
  }

  function openSettingsModal() {
    const provider = state.settings.llmProvider || 'openai';
    const bodyHtml = `
      <div class="form-group">
        <label class="form-label">LLM Provider</label>
        <select class="form-input" id="setting-llm-provider">
          <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI</option>
          <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
          <option value="anthropic" ${provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
        </select>
      </div>
      <div class="form-group" style="position: relative;">
        <label class="form-label">API Key</label>
        <div style="display: flex; gap: 0.5rem;">
          <input type="password" class="form-input" id="setting-api-key" value="${escapeHtml(state.settings.apiKey || '')}" placeholder="Your API Key" style="flex:1;">
          <button class="btn btn-secondary" id="test-llm-btn" style="white-space: nowrap;">Test API</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Your Name</label>
        <input type="text" class="form-input" id="setting-name" value="${escapeHtml(state.settings.userName || '')}" placeholder="e.g. Jane Doe">
      </div>
      <div class="form-group">
        <label class="form-label">Your Background & Interests</label>
        <textarea class="form-textarea" id="setting-background" placeholder="e.g. I am a master's student with 2 years of research experience in computer vision..." style="min-height: 80px">${escapeHtml(state.settings.userBackground || '')}</textarea>
      </div>
      <div class="form-group" style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
        <label class="form-label">Gmail Address (for sending emails)</label>
        <input type="email" class="form-input" id="setting-smtp-email" value="${escapeHtml(state.settings.smtpEmail || '')}" placeholder="your.email@gmail.com">
      </div>
      <div class="form-group">
        <label class="form-label">Google App Password</label>
        <div style="display: flex; gap: 0.5rem;">
          <input type="password" class="form-input" id="setting-smtp-password" value="${escapeHtml(state.settings.smtpPassword || '')}" placeholder="16-character app password" style="flex:1;">
          <button class="btn btn-secondary" id="test-smtp-btn" style="white-space: nowrap;">Test SMTP</button>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Standard Gmail passwords do not work. Generate an App Password in your Google Account settings.</div>
      </div>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-save-settings-btn">Save Settings</button>
    `;
    openModal('Settings', bodyHtml, footerHtml);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('modal-save-settings-btn').addEventListener('click', () => {
      state.settings.llmProvider = document.getElementById('setting-llm-provider').value;
      state.settings.apiKey = document.getElementById('setting-api-key').value.trim();
      state.settings.userName = document.getElementById('setting-name').value.trim();
      state.settings.userBackground = document.getElementById('setting-background').value.trim();
      state.settings.smtpEmail = document.getElementById('setting-smtp-email').value.trim();
      state.settings.smtpPassword = document.getElementById('setting-smtp-password').value.trim();
      saveSettings();
      closeModal();
    });

    document.getElementById('test-llm-btn').addEventListener('click', async (e) => {
      const btn = e.target;
      const originalText = btn.textContent;
      btn.textContent = 'Testing...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/test-llm', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            llmProvider: document.getElementById('setting-llm-provider').value,
            apiKey: document.getElementById('setting-api-key').value.trim()
          })
        });
        const data = await res.json();
        if (res.ok) alert('✅ ' + data.message);
        else alert('❌ ' + (data.detail || 'Test failed'));
      } catch (err) {
        alert('❌ Network error testing API key.');
      }
      btn.textContent = originalText;
      btn.disabled = false;
    });

    document.getElementById('test-smtp-btn').addEventListener('click', async (e) => {
      const btn = e.target;
      const originalText = btn.textContent;
      btn.textContent = 'Testing...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/test-smtp', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            smtpEmail: document.getElementById('setting-smtp-email').value.trim(),
            smtpPassword: document.getElementById('setting-smtp-password').value.trim()
          })
        });
        const data = await res.json();
        if (res.ok) alert('✅ ' + data.message);
        else alert('❌ ' + (data.detail || 'Test failed'));
      } catch (err) {
        alert('❌ Network error testing SMTP login.');
      }
      btn.textContent = originalText;
      btn.disabled = false;
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
        <input type="text" class="form-input" id="email-preview-subject">
      </div>
      <div class="form-group">
        <label class="form-label">Body</label>
        <textarea class="form-textarea" id="email-preview-body" style="min-height: 200px"></textarea>
      </div>
      <div class="form-group" style="margin-top: 1rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
        <label class="form-label">Schedule Send (Optional)</label>
        <input type="datetime-local" class="form-input" id="email-schedule-time">
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Leave blank to send immediately. (Ensure ProfScout server is running at the scheduled time).</div>
      </div>
    `;

    const footerHtml = `
      <div style="flex:1">
        <button class="btn btn-secondary ai-btn" id="modal-ai-btn">✨ Generate with AI</button>
      </div>
      <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-send-btn">Send Now</button>
      <button class="btn btn-primary" id="modal-schedule-btn" style="display:none; background:var(--accent-4);">Schedule Send</button>
    `;

    openModal(`Email ${profName}`, bodyHtml, footerHtml);
    updatePreview();

    document.getElementById('email-template-select').addEventListener('change', (e) => {
      state.activeTemplateId = e.target.value;
      updatePreview();
    });

    const scheduleInput = document.getElementById('email-schedule-time');
    const sendBtn = document.getElementById('modal-send-btn');
    const scheduleBtn = document.getElementById('modal-schedule-btn');

    scheduleInput.addEventListener('change', (e) => {
      if (e.target.value) {
        sendBtn.style.display = 'none';
        scheduleBtn.style.display = 'inline-block';
      } else {
        sendBtn.style.display = 'inline-block';
        scheduleBtn.style.display = 'none';
      }
    });

    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

    const handleSend = async (isScheduled, btnElement) => {
      if (!state.settings.smtpEmail || !state.settings.smtpPassword) {
        alert('Please configure your Gmail Address and App Password in Settings first.');
        closeModal();
        openSettingsModal();
        return;
      }
      
      btnElement.disabled = true;
      const originalHtml = btnElement.innerHTML;
      btnElement.innerHTML = '<span class="btn-spinner"></span> ' + (isScheduled ? 'Scheduling...' : 'Sending...');
      
      try {
        const sub = document.getElementById('email-preview-subject').value;
        const bod = document.getElementById('email-preview-body').value;
        const fakeEmail = profName.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') + '@example.edu';
        
        let sendAtMs = null;
        if (isScheduled && scheduleInput.value) {
          sendAtMs = new Date(scheduleInput.value).getTime();
          if (sendAtMs <= Date.now()) {
            throw new Error("Scheduled time must be in the future.");
          }
        }
        
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: fakeEmail,
            profName: profName,
            subject: sub,
            body: bod,
            sendAt: sendAtMs
          })
        });
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || 'Failed to process email request');
        }
        
        alert(isScheduled ? 'Email scheduled successfully!' : 'Email sent successfully via Gmail!');
        
        const profId = prof.n + '_' + prof.a;
        if (!state.applications[profId]) toggleTrackProfessor(prof);
        state.applications[profId].status = 'contacted';
        saveApplications();
        route();
        closeModal();
      } catch (err) {
        console.error(err);
        alert('Failed: ' + err.message);
        btnElement.disabled = false;
        btnElement.innerHTML = originalHtml;
      }
    };

    sendBtn.addEventListener('click', (e) => handleSend(false, e.target));
    scheduleBtn.addEventListener('click', (e) => handleSend(true, e.target));

    document.getElementById('modal-ai-btn').addEventListener('click', (e) => {
      const subjectInput = document.getElementById('email-preview-subject');
      const bodyInput = document.getElementById('email-preview-body');
      generateEmailWithAI(prof, profAreasStr, subjectInput, bodyInput, e.target);
    });
  }

  async function generateEmailWithAI(prof, profAreasStr, subjectInput, bodyInput, btn) {
    if (!state.settings.apiKey) {
      alert('Please configure your OpenAI API Key in Settings first.');
      closeModal();
      openSettingsModal();
      return;
    }
    
    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="btn-spinner"></span> Generating...';

    try {
      const systemPrompt = "You are an expert academic advisor helping a prospective grad student write a cold email to a professor. The email must be concise (under 150 words), professional, and highly specific to the professor's research. Avoid cliches. Output ONLY a JSON object with 'subject' and 'body' keys.";
      const userPrompt = `
Student: ${state.settings.userName || '[Student Name]'}
Student Background: ${state.settings.userBackground || 'Interested in CS research.'}
Professor: ${prof.n} at ${prof.a}
Professor's Focus Areas: ${profAreasStr}
Instructions: Draft the cold email. Do not use bracketed placeholders.
      `;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'API request failed');
      }

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);
      
      subjectInput.value = result.subject || 'Prospective PhD Student';
      bodyInput.value = result.body || '';
      
      // Select custom option in dropdown to indicate template override
      const select = document.getElementById('email-template-select');
      select.value = '';
    } catch (err) {
      console.error(err);
      alert('Failed to generate AI draft: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
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
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1rem;">
        <div>
          <h1 class="page-title">Discover Professors</h1>
          <p class="page-subtitle">${state.openAlexMode ? 'Search millions of faculty across all STEM fields via OpenAlex' : `Search ${state.professors.length.toLocaleString()} CS faculty across ${Object.keys(state.institutions).length.toLocaleString()} institutions worldwide`}</p>
        </div>
        <div style="display:flex; gap:0.25rem; background: var(--bg-alt); padding: 4px; border-radius: 6px; border: 1px solid var(--border);">
          <button class="btn ${!state.openAlexMode ? 'btn-primary' : 'btn-secondary'}" id="mode-cs-btn" style="padding: 6px 12px; font-size:0.85rem; border:none; box-shadow:none;">CS Rankings</button>
          <button class="btn ${state.openAlexMode ? 'btn-primary' : 'btn-secondary'}" id="mode-oa-btn" style="padding: 6px 12px; font-size:0.85rem; border:none; box-shadow:none;" title="Search all STEM fields via OpenAlex">Global STEM</button>
        </div>
      </div>
      <div class="search-container">
        <span class="search-icon">&#128270;</span>
        <input type="text" class="search-input" id="search-input" placeholder="${state.openAlexMode ? 'Search by name or institution (e.g. Mechanical Engineering MIT)...' : 'Search by professor name or university...'}" value="${escapeHtml(state.searchQuery)}" autocomplete="off">
        <span class="search-count" id="search-count"></span>
      </div>
      <div class="discover-layout" ${state.openAlexMode ? 'style="grid-template-columns: 1fr;"' : ''}>
        <aside class="filter-panel" id="filter-panel" ${state.openAlexMode ? 'style="display:none;"' : ''}>
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
          <div class="results-header" ${state.openAlexMode ? 'style="display:none;"' : ''}>
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
            <span class="prof-stat"><strong>${Math.round(p.tp || 0)}</strong> total pubs</span>
            <span class="prof-stat"><strong>${Math.round(p.rp || 0)}</strong> ${state.openAlexMode ? 'citations' : 'since 2020'}</span>
          </div>
          <div class="prof-links">${homepageUrl}${scholarUrl}${stipendLink}</div>
          <div class="prof-actions">
            <button class="action-btn email-btn" ${state.isStatic ? 'onclick="alert(\'This feature requires the desktop app. Please download ProfScout locally.\')"' : `data-prof='${JSON.stringify(p).replace(/'/g, "&apos;")}'`}>&#9993; Email</button>
            <button class="action-btn track-btn ${isTracked ? 'tracked' : ''}" ${state.isStatic ? 'onclick="alert(\'This feature requires the desktop app. Please download ProfScout locally.\')"' : `data-prof='${JSON.stringify(p).replace(/'/g, "&apos;")}'`}>
              ${isTracked ? '&#10003; Tracked' : '&#128161; Track'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function updateDiscoverResults() {
    if(state.currentPage !== 'discover') return;
    
    const listEl = document.getElementById('professor-list');
    const countEl = document.getElementById('results-count');
    const searchCountEl = document.getElementById('search-count');
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (state.openAlexMode) {
      if (!state.searchQuery.trim()) {
        if (listEl) listEl.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Type a name or institution to search across all STEM fields.</div>';
        if (countEl) countEl.innerHTML = '';
        if (searchCountEl) searchCountEl.textContent = '0 results';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
      }
      
      if (listEl) listEl.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Searching OpenAlex...</div>';
      
      try {
        const url = 'https://api.openalex.org/authors?search=' + encodeURIComponent(state.searchQuery) + '&sort=cited_by_count:desc&per-page=25';
        const res = await fetch(url, { headers: { 'User-Agent': 'mailto:profscout@example.com' } });
        if (res.ok) {
          const data = await res.json();
          // Map OpenAlex response directly in the client
          state.openAlexResults = (data.results || []).map(author => {
            const inst = author.last_known_institution;
            const areas = author.x_concepts ? author.x_concepts.slice(0, 6).map(c => c.display_name) : [];
            return {
              n: author.display_name || '',
              a: inst ? inst.display_name : 'Unknown Institution',
              h: author.id || '',
              c: inst ? (inst.country_code || 'US') : 'US',
              tp: author.works_count || 0,
              rp: author.cited_by_count || 0,
              ar: areas
            };
          });
          if (listEl) listEl.innerHTML = renderProfCards(state.openAlexResults, state.displayCount);
          if (countEl) countEl.innerHTML = `Showing top <strong>${state.openAlexResults.length}</strong> results from OpenAlex`;
          if (searchCountEl) searchCountEl.textContent = `${state.openAlexResults.length} results`;
          if (loadMoreBtn) loadMoreBtn.style.display = 'none'; // OpenAlex just returns top 25
          initDiscoverListEvents();
        }
      } catch (e) {
        if (listEl) listEl.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--accent-danger);">Failed to search OpenAlex.</div>';
      }
      return;
    }

    const filtered = getFilteredProfessors();
    if (listEl) listEl.innerHTML = renderProfCards(filtered, state.displayCount);
    if (countEl) countEl.innerHTML = `Showing <strong>${Math.min(state.displayCount, filtered.length)}</strong> of <strong>${filtered.length.toLocaleString()}</strong> professors`;
    if (searchCountEl) searchCountEl.textContent = `${filtered.length.toLocaleString()} results`;
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
    
    document.getElementById('mode-cs-btn')?.addEventListener('click', () => {
      state.openAlexMode = false;
      route();
    });
    document.getElementById('mode-oa-btn')?.addEventListener('click', () => {
      state.openAlexMode = true;
      route();
    });

    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { state.searchQuery = e.target.value; state.displayCount = 25; updateDiscoverResults(); }, state.openAlexMode ? 600 : 200);
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
        ${catEntries.map(([cat, codes]) => `<div class="interest-category"><div class="interest-category-title">${cat}</div><div class="interest-tags">${codes.map(c => `<div class="interest-tag ${state.selectedInterests.has(cat)?'selected':''}" data-category="${cat}">${getAreaLabel(c)}</div>`).join('')}</div></div>`).join('')}
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
    if (state.isStatic) {
      return `
        <div style="text-align:center; padding:4rem; max-width:600px; margin:0 auto;">
          <h2 style="color:var(--text-primary); margin-bottom:1rem;">Desktop App Required</h2>
          <p style="color:var(--text-secondary); line-height:1.6; margin-bottom:2rem;">
            The Application Tracker saves your data to a secure, local SQLite database on your machine to ensure privacy and cross-session persistence. This feature is not available in the static web preview.
          </p>
          <a href="https://github.com/satyam-thakur/mail_automation" target="_blank" class="action-btn" style="text-decoration:none; display:inline-block; font-size:1.1rem; padding:0.75rem 1.5rem;">
            Download Desktop Version
          </a>
        </div>
      `;
    }
    const appsByCol = {};
    KANBAN_COLS.forEach(c => appsByCol[c] = []);
    Object.values(state.applications).forEach(app => {
      if (appsByCol[app.status]) appsByCol[app.status].push(app);
      else appsByCol['saved'].push(app);
    });

    return `
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h1 class="page-title">Application Tracker</h1>
        <button class="btn btn-primary" id="bulk-schedule-btn" style="background:var(--accent-2);">🗓️ Bulk Schedule Selected</button>
      </div>
      <div class="kanban-board">
        ${KANBAN_COLS.map(col => `
          <div class="kanban-column" data-status="${col}">
            <div class="kanban-column-header">
              <input type="checkbox" class="kanban-select-all" data-status="${col}" title="Select All" style="margin-right: 6px; transform: scale(1.1); cursor:pointer;">
              <span>${COL_NAMES[col]}</span>
              <span class="kanban-count">${appsByCol[col].length}</span>
            </div>
            <div class="kanban-cards" ondragover="event.preventDefault()" data-status="${col}">
              ${appsByCol[col].map(app => `
                <div class="kanban-card" draggable="true" data-id="${app.id}">
                  <div style="display:flex; align-items:flex-start;">
                    <input type="checkbox" class="bulk-select-cb" value="${app.id}" style="margin-right:6px; margin-top:4px; transform:scale(1.2); cursor:pointer;">
                    <div>
                      <div class="kanban-card-title">${escapeHtml(app.prof.n)}</div>
                      <div class="kanban-card-subtitle">${escapeHtml(app.prof.a)}</div>
                    </div>
                  </div>
                  <div class="kanban-card-actions" style="margin-top:0.5rem;">
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
    document.querySelectorAll('.kanban-cards').forEach(zone => {
      zone.addEventListener('drop', e => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const newStatus = zone.dataset.status;
        if (state.applications[id] && state.applications[id].status !== newStatus) {
          state.applications[id].status = newStatus;
          saveApplications();
          route();
        }
      });
    });

    document.querySelectorAll('.kanban-select-all').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const colStatus = e.target.dataset.status;
        const column = document.querySelector(`.kanban-cards[data-status="${colStatus}"]`);
        if (column) {
          column.querySelectorAll('.bulk-select-cb').forEach(cardCb => {
            cardCb.checked = isChecked;
          });
        }
      });
    });
    
    document.getElementById('bulk-schedule-btn').addEventListener('click', () => {
      const selectedIds = Array.from(document.querySelectorAll('.bulk-select-cb:checked')).map(cb => cb.value);
      if (selectedIds.length === 0) {
        alert("Please select at least one professor to bulk schedule emails.");
        return;
      }
      openBulkScheduleModal(selectedIds);
    });

    document.querySelectorAll('.email-btn').forEach(btn => {
      btn.addEventListener('click', (e) => openEmailModal(JSON.parse(e.target.dataset.prof)));
    });
  }

  function openBulkScheduleModal(selectedIds) {
    if (state.templates.length === 0) {
      alert("You need to create an Email Template first!");
      route('/templates');
      return;
    }
    
    const templateOptions = state.templates.map(t =>
      `<option value="${t.id}">${escapeHtml(t.name)}</option>`
    ).join('');
    
    const bodyHtml = `
      <div style="margin-bottom:1rem;">You are about to schedule emails for <strong>${selectedIds.length}</strong> professor(s).</div>
      <div class="form-group">
        <label class="form-label">Select Template</label>
        <select class="form-input" id="bulk-template-select">
          ${templateOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Schedule Date & Time</label>
        <input type="datetime-local" class="form-input" id="bulk-schedule-time">
      </div>
    `;
    
    const footerHtml = `
      <button class="btn btn-secondary" id="modal-cancel-bulk-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm-bulk-btn" style="background:var(--accent-4);">Confirm Bulk Schedule</button>
    `;
    
    openModal('Bulk Schedule Emails', bodyHtml, footerHtml);
    
    document.getElementById('modal-cancel-bulk-btn').addEventListener('click', closeModal);
    document.getElementById('modal-confirm-bulk-btn').addEventListener('click', async (e) => {
      const scheduleVal = document.getElementById('bulk-schedule-time').value;
      if (!scheduleVal) {
        alert("Please select a date and time for bulk scheduling.");
        return;
      }
      
      const sendAtMs = new Date(scheduleVal).getTime();
      if (sendAtMs <= Date.now()) {
        alert("Scheduled time must be in the future.");
        return;
      }
      
      const templateId = document.getElementById('bulk-template-select').value;
      const template = state.templates.find(t => t.id === templateId);
      
      const btn = e.target;
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-spinner"></span> Scheduling...';
      
      let successCount = 0;
      
      for (const appId of selectedIds) {
        const app = state.applications[appId];
        if (!app) continue;
        const prof = app.prof;
        const profAreasStr = prof.ar.slice(0,2).map(getAreaLabel).join(' and ');
        
        let subject = template.subject;
        let body = template.body;
        const context = {
          my_name: state.settings.userName || '[Your Name]',
          my_background: state.settings.userBackground || '[Your Background]',
          prof_lastName: prof.n.split(' ').pop(),
          prof_fullName: prof.n,
          univ_name: prof.a,
          research_area: profAreasStr
        };
        for (const [key, val] of Object.entries(context)) {
          const regex = new RegExp(`{{${key}}}`, 'g');
          subject = subject.replace(regex, val);
          body = body.replace(regex, val);
        }
        
        const fakeEmail = prof.n.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') + '@example.edu';
        
        try {
          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: fakeEmail,
              profName: prof.n,
              subject: subject,
              body: body,
              sendAt: sendAtMs
            })
          });
          if (response.ok) successCount++;
        } catch(err) {
          console.error("Failed to bulk schedule for " + prof.n, err);
        }
      }
      
      alert(`Successfully scheduled ${successCount} out of ${selectedIds.length} emails! They will appear in your Mail tab and Gmail Drafts.`);
      
      for (const appId of selectedIds) {
        if (state.applications[appId]) {
          state.applications[appId].status = 'contacted';
        }
      }
      saveApplications();
      route();
      closeModal();
    });
  }

  // ===== Initialize =====
  window.addEventListener('hashchange', route);
  loadData();
})();
