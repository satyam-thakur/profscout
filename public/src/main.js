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

  const MOON_SVG = '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  const SUN_SVG = '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  function applyTheme() {
    if (isLightMode) {
      root.setAttribute('data-theme', 'light');
      if (toggleBtn) { toggleBtn.innerHTML = MOON_SVG; toggleBtn.title = 'Switch to dark mode'; }
    } else {
      root.setAttribute('data-theme', 'dark');
      if (toggleBtn) { toggleBtn.innerHTML = SUN_SVG; toggleBtn.title = 'Switch to light mode'; }
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

  // Get Client ID from settings or use the one from .env
  const getClientId = () => state.settings.googleClientId || '843814437429-a2kb6qn2ros3i97mqjk64dab9rv5vnvv.apps.googleusercontent.com';

  // ===== Google Auth =====
  // openid/email/profile are required for the userinfo endpoint to return the user's
  // name and avatar — without them the signed-in button has no name or picture to show.
  const GOOGLE_SCOPES = 'openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/drive.appdata';

  const GoogleAuth = {
    tokenClient: null,
    init() {
      if (typeof google === 'undefined' || !google.accounts) return;
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: getClientId(),
        scope: GOOGLE_SCOPES,
        callback: (resp) => {
          if (resp.error) { console.error('OAuth error:', resp); showToast('Google sign-in failed: ' + (resp.error_description || resp.error), 'error'); return; }
          state.googleToken = resp.access_token;
          // Fetch user info
          fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + resp.access_token }
          }).then(r => r.json()).then(u => {
            state.googleUser = u;
            updateAuthUI();
            CloudBackup.loadFromCloud().then(ensureDefaultTemplate);
          });
        }
      });
    },
    async requestToken() {
      return new Promise((resolve, reject) => {
        if (state.googleToken) { resolve(state.googleToken); return; }
        if (!this.tokenClient) { 
          if (typeof google !== 'undefined' && google.accounts) {
            this.init(); // Try init again just in case
          }
          if (!this.tokenClient) {
            showToast('Google Sign-In is unavailable. Check your connection or disable ad-blockers (uBlock, Brave Shields) that may block Google scripts.', 'error', 8000);
            reject(new Error('Google Sign-In unavailable'));
            return;
          }
        }
        const origCallback = this.tokenClient.callback;
        this.tokenClient.callback = (resp) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          state.googleToken = resp.access_token;
          fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + resp.access_token }
          }).then(r => r.json()).then(u => {
            state.googleUser = u;
            StorageManager.save('auth', { token: resp.access_token, user: u, expiresAt: Date.now() + 3500 * 1000 });
            updateAuthUI();
            CloudBackup.loadFromCloud().then(ensureDefaultTemplate);
          });
          resolve(resp.access_token);
        };
        this.tokenClient.requestAccessToken();
      });
    },
    signOut() {
      if (state.googleToken) {
        google.accounts.oauth2.revoke(state.googleToken, () => {});
      }
      state.googleToken = null;
      state.googleUser = null;
      StorageManager.remove('auth');
      updateAuthUI();
    }
  };

  // Official multi-color Google "G" logo (used on the sign-in button).
  const GOOGLE_G_SVG = `<svg class="g-logo" width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
  // Logout glyph (stroke follows currentColor).
  const SIGN_OUT_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
  // Generic person silhouette used when no avatar is available (or it fails to load).
  const AVATAR_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"/></svg>`;
  const fallbackAvatarHtml = `<span class="auth-avatar auth-avatar-fallback">${AVATAR_ICON_SVG}</span>`;

  function updateAuthUI() {
    const btn = document.getElementById('google-signin-btn');
    if (!btn) return;
    // Clear inline styles from any previous state; styling lives in CSS classes.
    btn.removeAttribute('style');
    if (state.googleUser) {
      const avatar = state.googleUser.picture
        ? `<img class="auth-avatar" src="${escapeHtml(state.googleUser.picture)}" alt="" referrerpolicy="no-referrer">`
        : fallbackAvatarHtml;
      btn.className = 'btn btn-secondary btn-google signed-in';
      btn.innerHTML = `
        ${avatar}
        <span class="auth-name">${escapeHtml(state.googleUser.given_name || state.googleUser.name || 'Account')}</span>
        <span class="auth-signout" aria-hidden="true">${SIGN_OUT_SVG}</span>
      `;
      // If the avatar image fails to load (Google can rate-limit it), swap to the icon.
      const img = btn.querySelector('img.auth-avatar');
      if (img) img.addEventListener('error', () => { img.outerHTML = fallbackAvatarHtml; });
      btn.title = `Sign out of ${state.googleUser.email || 'Google'}`;
      btn.setAttribute('aria-label', `Signed in as ${state.googleUser.email || state.googleUser.given_name || 'user'}. Click to sign out.`);
    } else {
      btn.className = 'btn btn-secondary btn-google';
      btn.innerHTML = `${GOOGLE_G_SVG}<span>Sign in with Google</span>`;
      btn.title = 'Sign in to send emails and back up your data';
      btn.setAttribute('aria-label', 'Sign in with Google');
    }
  }

  // ===== Gmail Service =====
  const GmailService = {
    async send(to, subject, body) {
      const token = await GoogleAuth.requestToken();
      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=UTF-8',
        'MIME-Version: 1.0',
        '',
        body
      ].join('\r\n');
      
      const encoded = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: encoded })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Gmail API error');
      }
      return await res.json();
    },
    async createDraft(to, subject, body) {
      const token = await GoogleAuth.requestToken();
      const email = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=UTF-8', 'MIME-Version: 1.0', '', body].join('\r\n');
      const encoded = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { raw: encoded } })
      });
      if (!res.ok) throw new Error('Failed to create draft');
      return await res.json();
    }
  };

  // ===== AI Service =====
  const AIService = {
    async call(prompt, systemInstruction) {
      const provider = state.settings.llmProvider || 'gemini';
      const apiKey = state.settings.apiKey;
      if (!apiKey) throw new Error(`Please enter your ${provider.toUpperCase()} API Key in Settings.`);
      
      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
              { role: 'user', content: prompt }
            ]
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'OpenAI API error');
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      } else if (provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerously-allow-browser': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1024,
            system: systemInstruction || '',
            messages: [{ role: 'user', content: prompt }]
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'Anthropic API error');
        }
        const data = await res.json();
        return data.content?.[0]?.text || '';
      } else {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            generationConfig: { responseMimeType: 'application/json' }
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'Gemini API error');
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    },
    async polish(emailBody, action) {
      const instructions = {
        enhance: 'You are an expert academic advisor. Rewrite this cold email to a professor to be more professional, specific, and compelling. Output only the improved email body text.',
        shorten: 'Shorten this email to be more concise while keeping all key points. Output only the shortened email body text.',
        expand: 'Expand this email with more detail and specificity while maintaining a professional tone. Output only the expanded email body text.',
        grammar: 'Fix all grammatical errors and improve clarity in this email. Output only the corrected email body text.',
        formal: 'Rewrite this email in a formal academic tone. Output only the rewritten email body text.',
        friendly: 'Rewrite this email in a warm, approachable, yet professional tone. Output only the rewritten email body text.'
      };
      const instruction = instructions[action] || instructions.grammar;
      const result = await this.call(emailBody, instruction);
      // Try to parse as JSON in case it wrapped the result
      try { const parsed = JSON.parse(result); return parsed.body || parsed.text || parsed.email || result; } catch { return result; }
    }
  };

  // ===== Cloud Backup (Google Drive AppData) =====
  const CloudBackup = {
    fileId: null,
    syncTimeout: null,
    isSyncing: false,
    sync() {
      // Debounced sync — reduced to 500ms to prevent data loss if user closes tab
      clearTimeout(this.syncTimeout);
      this.syncTimeout = setTimeout(() => this._upload(), 500);
    },
    async _upload() {
      if (!state.googleToken || this.isSyncing) return;
      this.isSyncing = true;
      try {
        let btn = document.getElementById('force-sync-btn');
        if (btn) btn.textContent = '☁️ Syncing up...';
        setSyncStatus('☁️ Syncing…');
        const data = {
          templates: state.templates,
          applications: state.applications,
          outbox: state.outbox,
          settings: {
            userName: state.settings.userName, userBackground: state.settings.userBackground,
            userInterests: state.settings.userInterests, userDegree: state.settings.userDegree,
            userUniversity: state.settings.userUniversity, userExpYears: state.settings.userExpYears,
            userJobTitle: state.settings.userJobTitle, userCompany: state.settings.userCompany,
            userSkills: state.settings.userSkills, userContact: state.settings.userContact
          }
        };
        const metadata = { name: 'profscout_backup.json', mimeType: 'application/json' };
        
        if (this.fileId) {
          // Update existing
          await fetch(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + state.googleToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        } else {
          // Create new in appDataFolder
          metadata.parents = ['appDataFolder'];
          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));
          const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + state.googleToken },
            body: form
          });
          const result = await res.json();
          this.fileId = result.id;
        }
        
        btn = document.getElementById('force-sync-btn');
        if (btn) btn.textContent = '✅ Synced to Cloud';
        setSyncStatus('✅ Synced', 'ok');
      } catch(e) {
        console.warn('Cloud backup failed:', e);
        let btn = document.getElementById('force-sync-btn');
        if (btn) btn.textContent = '❌ Sync Failed';
        setSyncStatus('⚠️ Sync failed', 'err');
      } finally {
        this.isSyncing = false;
      }
    },
    async loadFromCloud() {
      if (!state.googleToken || this.isSyncing) return;
      this.isSyncing = true;
      try {
        let btn = document.getElementById('force-sync-btn');
        if (btn) btn.textContent = '☁️ Downloading...';
        // Find the backup file
        const listRes = await fetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='profscout_backup.json'&fields=files(id,modifiedTime)", {
          headers: { Authorization: 'Bearer ' + state.googleToken }
        });
        const listData = await listRes.json();
        if (!listData.files || listData.files.length === 0) return;
        
        this.fileId = listData.files[0].id;
        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`, {
          headers: { Authorization: 'Bearer ' + state.googleToken }
        });
        const cloudData = await fileRes.json();
        
        // Merge: cloud wins for arrays, merge for objects
        if (cloudData.templates && cloudData.templates.length > 0) {
          state.templates = cloudData.templates;
          StorageManager.save('templates', state.templates);
          if (state.templates.length > 0) state.activeTemplateId = state.templates[0].id;
        }
        if (cloudData.applications && Object.keys(cloudData.applications).length > 0) {
          state.applications = { ...state.applications, ...cloudData.applications };
          StorageManager.save('applications', state.applications);
        }
        if (cloudData.outbox && cloudData.outbox.length > 0) {
          // Merge by id, cloud wins
          const existingIds = new Set(state.outbox.map(e => e.id));
          cloudData.outbox.forEach(e => { if (!existingIds.has(e.id)) state.outbox.push(e); });
          StorageManager.save('outbox', state.outbox);
        }
        if (cloudData.settings) {
          // Restore any saved profile fields that are present in the cloud copy.
          ['userName','userBackground','userInterests','userDegree','userUniversity',
           'userExpYears','userJobTitle','userCompany','userSkills','userContact'].forEach(k => {
            if (cloudData.settings[k]) state.settings[k] = cloudData.settings[k];
          });
          saveSettings();
        }
        
        // Re-render the active view to show the restored data
        if (window.location.hash.includes('outbox')) {
          renderOutboxPage();
        } else if (window.location.hash.includes('templates')) {
          renderTemplatesPage();
        } else {
          renderMatchPage();
        }
        console.log('Successfully restored data from Cloud Backup.');
        btn = document.getElementById('force-sync-btn');
        if (btn) btn.textContent = '✅ Synced to Cloud';
      } catch(e) { 
        console.warn('Cloud restore failed:', e);
        let btn = document.getElementById('force-sync-btn');
        if (btn) btn.textContent = '❌ Sync Failed';
      } finally {
        this.isSyncing = false;
      }
    }
  };

  // ===== Mail Page =====
  function renderOutboxPage() {
    const sent = state.outbox.filter(e => e.status === 'sent');
    const drafts = state.outbox.filter(e => e.status === 'draft');
    return `
      <div class="page-header">
        <h1 class="page-title">Mail</h1>
        <p class="page-subtitle">Emails sent and drafted via your Gmail account.</p>
      </div>

      <h2 class="section-heading">Sent (${sent.length})</h2>
      <div id="outbox-sent-list" class="tracker-grid">
        ${sent.length === 0
          ? '<div class="empty-state"><div class="empty-state-icon">&#128232;</div><div class="empty-state-text">No sent emails yet</div></div>'
          : sent.map(renderEmailCard).join('')}
      </div>

      <h2 class="section-heading">Drafts (${drafts.length})</h2>
      <div id="outbox-drafts-list" class="tracker-grid">
        ${drafts.length === 0
          ? '<div class="empty-state"><div class="empty-state-text">No drafts</div></div>'
          : drafts.map(renderEmailCard).join('')}
      </div>
    `;
  }

  function renderEmailCard(email) {
    const d = new Date(email.sentAt || email.createdAt);
    const statusCls = email.status === 'sent' ? 'positive' : '';
    return `
      <div class="prof-card">
        <div class="prof-name">To: ${escapeHtml(email.profName || email.to)}</div>
        <div class="email-card-addr">${escapeHtml(email.to)}</div>
        <div class="email-card-subject"><strong>Subject:</strong> ${escapeHtml(email.subject)}</div>
        <div class="email-card-meta">
          <strong>${email.status === 'sent' ? 'Sent:' : 'Created:'}</strong> ${d.toLocaleString()}<br>
          <strong>Status:</strong> <span class="${statusCls}">${email.status.toUpperCase()}</span>
        </div>
        <div class="prof-actions">
          <a href="https://mail.google.com/mail/u/0/#sent" target="_blank" rel="noopener" class="btn btn-primary btn-sm" title="View in Gmail">📧 Gmail</a>
          <button class="btn btn-secondary btn-sm delete-outbox-btn" data-id="${email.id}">🗑️ Remove</button>
        </div>
      </div>
    `;
  }

  function initOutboxPage() {
    document.querySelectorAll('.delete-outbox-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        state.outbox = state.outbox.filter(em => em.id !== id);
        saveOutbox();
        route();
      });
    });
  }

  // ===== State =====
  const state = {
    professors: [],
    institutions: {},
    areas: {},
    categories: {},
    selectedInterests: new Set(),
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
    settings: {
      userName: '', userBackground: '', apiKey: '', llmProvider: 'gemini',
      // Reusable applicant profile — fill once, merged into every email template.
      userInterests: '', userDegree: '', userUniversity: '',
      userExpYears: '', userJobTitle: '', userCompany: '', userSkills: '', userContact: ''
    },
    outbox: [],
    // Google Auth
    googleToken: null,
    googleUser: null
  };

  // ===== StorageManager (localStorage) =====
  const StorageManager = {
    save(key, data) { try { localStorage.setItem('ps_' + key, JSON.stringify(data)); } catch(e) { console.warn('Storage save failed:', e); } },
    load(key, fallback) { try { const raw = localStorage.getItem('ps_' + key); return raw ? JSON.parse(raw) : fallback; } catch(e) { return fallback; } },
    remove(key) { localStorage.removeItem('ps_' + key); }
  };

  function saveTemplates() {
    StorageManager.save('templates', state.templates);
    CloudBackup.sync();
  }
  function saveApplications() {
    StorageManager.save('applications', state.applications);
    CloudBackup.sync();
  }
  function saveSettings() {
    StorageManager.save('settings', state.settings);
    CloudBackup.sync();
  }
  function saveOutbox() {
    StorageManager.save('outbox', state.outbox);
    CloudBackup.sync();
  }

  // A permanent, always-available built-in template (fixed id so it is never duplicated
  // and can't be deleted). Users can edit it or add their own alongside it.
  const DEFAULT_TEMPLATE_ID = 'ps-default';
  const DEFAULT_TEMPLATE = {
    id: DEFAULT_TEMPLATE_ID,
    builtin: true,
    name: 'Default – Prospective Graduate Student',
    subject: 'Prospective Graduate Student – Need information on Research Opportunities & Assistantship',
    body: `Hello Prof. Dr. {{prof_name}},

I hope this email finds you well.

I am {{my_name}}, a {{my_degree}} graduate from {{my_university}} with a strong academic background and a deep interest in {{my_interests}}.

For the past {{my_experience_years}} years, I have worked as a {{my_job_title}} at {{my_company}}. In this role, I have specialized in {{my_skills}} for large-scale enterprise clients. This hands-on industry experience has equipped me with a practical technical foundation that I am eager to apply to advanced academic research.

I recently read your paper, "{{paper_title}}," and explored your ongoing work on {{projects}}. I am highly drawn to your research focus on {{prof_interests}}, as it aligns perfectly with my professional background and future goals.

I would be thrilled to contribute to your lab and pursue my interests under your supervision. I have attached my CV for your review. I would appreciate the opportunity for a brief virtual interview to discuss how my skills could add value to your team.

Thank you for your time and consideration. Have a great day!

Yours sincerely,
{{my_name}}
{{my_contact}}`
  };

  // Guarantee the built-in default template is always present (prepended, never duplicated).
  // Runs on load and after cloud restore, so the user always has a ready-to-use template.
  function ensureDefaultTemplate() {
    if (!state.templates.some(t => t.id === DEFAULT_TEMPLATE_ID)) {
      state.templates.unshift({ ...DEFAULT_TEMPLATE });
      if (!state.activeTemplateId) state.activeTemplateId = DEFAULT_TEMPLATE_ID;
      saveTemplates();
    }
    if (state.currentPage === 'templates') route();
  }

  // Fetch JSON while reporting real download progress (used for the large professors file).
  async function fetchJsonWithProgress(url, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    const total = Number(res.headers.get('Content-Length')) || 0;
    if (!res.body || !total) return res.json(); // fall back if streaming/size unavailable
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress(received / total);
    }
    const buf = new Uint8Array(received);
    let pos = 0;
    for (const c of chunks) { buf.set(c, pos); pos += c.length; }
    return JSON.parse(new TextDecoder('utf-8').decode(buf));
  }

  // ===== Data Loader =====
  async function loadData() {
    const loadingBar = document.getElementById('loading-bar-fill');
    const setBar = (frac) => { if (loadingBar) loadingBar.style.width = Math.round(frac * 100) + '%'; };
    try {
      // Small files first (fast), then stream the big professors file with real progress.
      const [instRes, areaRes] = await Promise.all([
        fetch('data/institutions.json'), fetch('data/areas.json')
      ]);
      state.institutions = await instRes.json();
      const areaData = await areaRes.json();
      state.areas = areaData.areas || {};
      state.categories = areaData.categories || {};
      setBar(0.1);
      state.professors = await fetchJsonWithProgress('data/professors.json', f => setBar(0.1 + f * 0.85));
      
      // Load user data from localStorage
      state.settings = StorageManager.load('settings', state.settings);
      state.templates = StorageManager.load('templates', []);
      state.applications = StorageManager.load('applications', {});
      state.outbox = StorageManager.load('outbox', []);
      // Make sure a sample template is present by default (first run, before any sign-in).
      ensureDefaultTemplate();
      if (state.templates.length > 0) {
        state.activeTemplateId = state.templates[0].id;
      }

      const savedAuth = StorageManager.load('auth', null);
      if (savedAuth && savedAuth.expiresAt > Date.now()) {
        state.googleToken = savedAuth.token;
        state.googleUser = savedAuth.user;
        updateAuthUI();
        CloudBackup.loadFromCloud().then(ensureDefaultTemplate);
      }

      setBar(1);
      state.loaded = true;
      document.getElementById('stat-professors').textContent = `${state.professors.length.toLocaleString()} Professors`;
      document.getElementById('loading-screen').style.display = 'none';
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
  // Validate a recipient address before any Gmail send. Rejects blanks, malformed
  // addresses, and the fabricated example.edu placeholders this app used to generate.
  function isValidRecipient(email) {
    const e = (email || '').trim().toLowerCase();
    if (!e) return false;
    if (e.endsWith('@example.edu') || e.endsWith('@example.com')) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }
  function escapeHtml(s) { const div = document.createElement('div'); div.textContent = s; return div.innerHTML; }
  function generateId() { return Math.random().toString(36).substr(2, 9); }

  // ===== Email merge tags =====
  // The full set of {{tags}} templates can use. "Professor" tags come from the compose
  // form (per email); "You" tags come from your saved profile in Settings (fill once).
  const MERGE_TAGS = [
    { group: 'Professor', items: [
      ['prof_name', "Professor's full name"],
      ['prof_firstName', 'First name'],
      ['prof_lastName', 'Last name'],
      ['prof_interests', "Professor's research interests"],
      ['paper_title', 'A paper of theirs'],
      ['projects', 'Their ongoing projects'],
      ['univ_name', "Professor's university"]
    ]},
    { group: 'You (from Settings)', items: [
      ['my_name', 'Your name'],
      ['my_degree', 'Your degree'],
      ['my_university', 'Your university'],
      ['my_interests', 'Your research interests'],
      ['my_experience_years', 'Years of experience'],
      ['my_job_title', 'Your job title'],
      ['my_company', 'Your company'],
      ['my_skills', 'Your key skills / responsibilities'],
      ['my_contact', 'Your LinkedIn / contact info'],
      ['my_background', 'Freeform background blurb']
    ]}
  ];

  // Build the value map for merge tags from your saved profile plus the given per-professor fields.
  function buildMergeContext(fields) {
    fields = fields || {};
    const s = state.settings || {};
    const nameParts = (fields.prof_name || '').trim().split(/\s+/).filter(Boolean);
    return {
      prof_name: fields.prof_name || '',
      prof_firstName: nameParts[0] || '',
      prof_lastName: nameParts.length ? nameParts[nameParts.length - 1] : '',
      prof_interests: fields.prof_interests || '',
      research_area: fields.prof_interests || '', // legacy alias
      paper_title: fields.paper_title || '',
      projects: fields.projects || '',
      univ_name: fields.univ_name || '',
      my_name: s.userName || '',
      my_degree: s.userDegree || '',
      my_university: s.userUniversity || '',
      my_interests: s.userInterests || '',
      my_experience_years: s.userExpYears || '',
      my_job_title: s.userJobTitle || '',
      my_company: s.userCompany || '',
      my_skills: s.userSkills || '',
      my_contact: s.userContact || '',
      my_background: s.userBackground || ''
    };
  }

  // Replace {{tag}} tokens with context values. Known-but-empty tags become '';
  // unknown tags are left untouched so nothing is silently deleted.
  function applyMergeTags(text, ctx) {
    return (text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in ctx ? ctx[k] : m));
  }

  // ===== Non-blocking feedback (toasts) =====
  function getToastStack() {
    let stack = document.getElementById('toast-stack');
    if (!stack) {
      // Always live directly on <body> so toasts stack above modals.
      stack = document.createElement('div');
      stack.id = 'toast-stack';
      stack.className = 'toast-stack';
      stack.setAttribute('aria-live', 'assertive');
      document.body.appendChild(stack);
    } else if (stack.parentElement !== document.body) {
      document.body.appendChild(stack); // hoist out of any stacking context
    }
    return stack;
  }

  function showToast(message, type = 'info', ms) {
    if (ms === undefined) ms = type === 'error' ? 7000 : 4000;
    const stack = getToastStack();
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'success' ? ' success' : type === 'error' ? ' error' : '');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    // Message text + a dismiss button so long errors can be closed early.
    const text = document.createElement('span');
    text.className = 'toast-msg';
    text.textContent = message;
    const close = document.createElement('button');
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = '&times;';
    const remove = () => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); };
    close.addEventListener('click', remove);
    el.appendChild(text);
    el.appendChild(close);
    stack.appendChild(el);
    setTimeout(remove, ms);
  }

  // First-run welcome banner (dismissible, shown until the user opts out).
  function renderWelcomeBanner() {
    if (StorageManager.load('onboarded', false)) return '';
    return `
      <div class="welcome-banner" id="welcome-banner">
        <h2>Welcome to ProfScout &#127891;</h2>
        <p>Find PhD advisors and run your whole outreach from one place:
        <strong>Discover</strong> &amp; <strong>Match</strong> professors by research area,
        compare PhD <strong>Stipends</strong> vs. cost of living,
        save targets to your <strong>Tracker</strong>, and draft personalized emails in <strong>Mail</strong>.
        Everything is stored locally in your browser — sign in with Google only to send email or sync across devices.</p>
        <div class="welcome-actions">
          <button class="btn btn-primary" id="welcome-settings-btn">Set up your profile</button>
          <button class="btn btn-secondary" id="welcome-dismiss-btn">Got it</button>
        </div>
      </div>`;
  }
  function bindWelcomeBanner() {
    const dismiss = () => {
      StorageManager.save('onboarded', true);
      const b = document.getElementById('welcome-banner');
      if (b) b.remove();
    };
    document.getElementById('welcome-dismiss-btn')?.addEventListener('click', dismiss);
    document.getElementById('welcome-settings-btn')?.addEventListener('click', () => { dismiss(); openSettingsModal(); });
  }

  // Persistent header sync status (visible outside the Settings modal).
  function setSyncStatus(text, cls = '') {
    const el = document.getElementById('sync-indicator');
    if (!el) return;
    el.textContent = text;
    el.className = 'sync-indicator' + (cls ? ' ' + cls : '');
  }

  // Gently suggest signing in for cross-device sync — once per session, never blocking.
  let _nudgedSignIn = false;
  function maybeNudgeSignIn() {
    if (_nudgedSignIn || state.googleToken) return;
    _nudgedSignIn = true;
    showToast('Saved locally. Sign in with Google to sync across devices.', 'info', 5000);
  }

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
    const provider = state.settings.llmProvider || 'gemini';
    const s = state.settings;
    const bodyHtml = `
      <div class="settings-section-title">Your Profile</div>
      <div class="form-hint" style="margin-bottom: 0.75rem;">Fill this once — these values auto-fill the <code>{{my_*}}</code> merge tags in every email template.</div>
      <div class="settings-grid">
        <div class="form-group">
          <label class="form-label">Your Name</label>
          <input type="text" class="form-input" id="setting-name" value="${escapeHtml(s.userName || '')}" placeholder="e.g. Jane Doe">
        </div>
        <div class="form-group">
          <label class="form-label">Highest Degree</label>
          <input type="text" class="form-input" id="setting-degree" value="${escapeHtml(s.userDegree || '')}" placeholder="e.g. B.Eng. in Computer Engineering">
        </div>
        <div class="form-group">
          <label class="form-label">Your University</label>
          <input type="text" class="form-input" id="setting-university" value="${escapeHtml(s.userUniversity || '')}" placeholder="e.g. Tribhuvan University">
        </div>
        <div class="form-group">
          <label class="form-label">Years of Experience</label>
          <input type="text" class="form-input" id="setting-exp-years" value="${escapeHtml(s.userExpYears || '')}" placeholder="e.g. 3">
        </div>
        <div class="form-group">
          <label class="form-label">Job Title</label>
          <input type="text" class="form-input" id="setting-job-title" value="${escapeHtml(s.userJobTitle || '')}" placeholder="e.g. Network Engineer">
        </div>
        <div class="form-group">
          <label class="form-label">Company / Organization</label>
          <input type="text" class="form-input" id="setting-company" value="${escapeHtml(s.userCompany || '')}" placeholder="e.g. Huawei Technologies">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Your Research Interests</label>
        <input type="text" class="form-input" id="setting-interests" value="${escapeHtml(s.userInterests || '')}" placeholder="e.g. Intelligent Networks, IoT, network security">
      </div>
      <div class="form-group">
        <label class="form-label">Key Skills / Responsibilities</label>
        <input type="text" class="form-input" id="setting-skills" value="${escapeHtml(s.userSkills || '')}" placeholder="e.g. network deployment, automation, and troubleshooting">
      </div>
      <div class="form-group">
        <label class="form-label">LinkedIn / Contact Info</label>
        <input type="text" class="form-input" id="setting-contact" value="${escapeHtml(s.userContact || '')}" placeholder="e.g. linkedin.com/in/yourname · +1 555 0100">
      </div>
      <div class="form-group">
        <label class="form-label">Freeform Background <span class="form-hint" style="display:inline">(optional, for AI drafting)</span></label>
        <textarea class="form-textarea" id="setting-background" placeholder="Anything else worth mentioning about your experience..." style="min-height: 70px">${escapeHtml(s.userBackground || '')}</textarea>
      </div>
      <div class="form-group" style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
        <label class="form-label">Google OAuth Client ID (Required for Sign-In)</label>
        <input type="text" class="form-input" id="setting-google-client-id" value="${escapeHtml(state.settings.googleClientId || '')}" placeholder="...apps.googleusercontent.com">
      </div>
      <div class="form-group" style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
        <label class="form-label">AI Provider</label>
        <select class="form-input" id="setting-llm-provider">
          <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>Google Gemini (Free API Key)</option>
          <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI</option>
          <option value="anthropic" ${provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">API Key</label>
        <input type="password" class="form-input" id="setting-api-key" value="${escapeHtml(state.settings.apiKey || '')}" placeholder="Paste your API key here">
        <div style="font-size: 0.8rem; margin-top: 0.25rem; color: var(--text-muted);">
          Get a free Gemini API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--primary)">Google AI Studio</a>.
        </div>
      </div>
      <div class="form-group" style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
        <label class="form-label">Cloud Backup</label>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          Your data automatically syncs to a hidden Google Drive folder when you make changes. 
        </div>
        <button class="btn btn-secondary" id="force-sync-btn" style="width: 100%;">🔄 Force Sync Now</button>
      </div>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-save-settings-btn">Save Settings</button>
    `;
    openModal('Settings', bodyHtml, footerHtml);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('modal-save-settings-btn').addEventListener('click', () => {
      state.settings.googleClientId = document.getElementById('setting-google-client-id').value.trim();
      state.settings.llmProvider = document.getElementById('setting-llm-provider').value;
      state.settings.apiKey = document.getElementById('setting-api-key').value.trim();
      state.settings.userName = document.getElementById('setting-name').value.trim();
      state.settings.userBackground = document.getElementById('setting-background').value.trim();
      state.settings.userDegree = document.getElementById('setting-degree').value.trim();
      state.settings.userUniversity = document.getElementById('setting-university').value.trim();
      state.settings.userExpYears = document.getElementById('setting-exp-years').value.trim();
      state.settings.userJobTitle = document.getElementById('setting-job-title').value.trim();
      state.settings.userCompany = document.getElementById('setting-company').value.trim();
      state.settings.userInterests = document.getElementById('setting-interests').value.trim();
      state.settings.userSkills = document.getElementById('setting-skills').value.trim();
      state.settings.userContact = document.getElementById('setting-contact').value.trim();
      saveSettings();
      showToast('Profile saved.', 'success');
      closeModal();
    });
    document.getElementById('force-sync-btn').addEventListener('click', async () => {
      if (!state.googleToken) return showToast('Sign in with Google first.', 'error');
      await CloudBackup.loadFromCloud();
      await CloudBackup._upload();
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

  function openEmailModal(prof) {
    const profName = prof ? prof.n : '';
    const univName = prof ? prof.a : '';
    const profAreasStr = prof ? prof.ar.slice(0,2).map(getAreaLabel).join(', ') : '';
    const homepage = prof && prof.h ? prof.h : '';
    const savedEmail = prof && state.applications[prof.n + '_' + prof.a] ? (state.applications[prof.n + '_' + prof.a].email || '') : '';
    const findEmailHint = homepage
      ? `Find their real email on their <a href="${escapeHtml(homepage)}" target="_blank" rel="noopener">homepage &#8599;</a>`
      : `We don't store professor emails &mdash; look it up on their department page.`;

    const bodyHtml = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
        <div class="form-group">
          <label class="form-label">To (Email)</label>
          <input type="email" class="form-input" id="c-to" value="${escapeHtml(savedEmail)}" placeholder="professor@university.edu" autocomplete="off">
          <div class="form-hint">${findEmailHint}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Professor Name</label>
          <input type="text" class="form-input" id="c-name" value="${escapeHtml(profName)}">
        </div>
        <div class="form-group">
          <label class="form-label">Professor's University</label>
          <input type="text" class="form-input" id="c-univ" value="${escapeHtml(univName)}">
        </div>
        <div class="form-group">
          <label class="form-label">Prof's Research Interests</label>
          <input type="text" class="form-input" id="c-interests" value="${escapeHtml(profAreasStr)}">
        </div>
        <div class="form-group">
          <label class="form-label">A Paper of Theirs (optional)</label>
          <input type="text" class="form-input" id="c-paper" placeholder="e.g. Attention is All You Need">
        </div>
        <div class="form-group">
          <label class="form-label">Their Ongoing Projects (optional)</label>
          <input type="text" class="form-input" id="c-projects" placeholder="e.g. FedIoT federated learning">
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 0.5rem;">
        <label class="form-label">Template (auto-fills Subject &amp; Body)</label>
        <select class="form-input" id="c-template">
          <option value="">-- Start from scratch --</option>
          ${state.templates.map(t => `<option value="${t.id}" ${t.id === state.activeTemplateId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
        </select>
        ${state.settings.userName ? '' : '<div class="form-hint">Tip: fill <strong>your profile</strong> in Settings so the template auto-completes your name, degree, experience, etc.</div>'}
      </div>

      <div class="form-group">
        <label class="form-label">Subject</label>
        <input type="text" class="form-input" id="c-subject">
      </div>
      
      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
          <label class="form-label">Email Body</label>
          <div style="display:flex; gap:0.25rem; margin-bottom:0.25rem;">
            <button class="btn btn-secondary ai-polish-btn" data-action="enhance" title="Full Rewrite" style="padding: 2px 6px; font-size: 0.8rem;">✨ Enhance</button>
            <button class="btn btn-secondary ai-polish-btn" data-action="shorten" title="Make it shorter" style="padding: 2px 6px; font-size: 0.8rem;">📝 Shorten</button>
            <button class="btn btn-secondary ai-polish-btn" data-action="expand" title="Add detail" style="padding: 2px 6px; font-size: 0.8rem;">📖 Expand</button>
            <button class="btn btn-secondary ai-polish-btn" data-action="grammar" title="Fix grammar" style="padding: 2px 6px; font-size: 0.8rem;">🔤 Grammar</button>
            <button class="btn btn-secondary ai-polish-btn" data-action="formal" title="Formal tone" style="padding: 2px 6px; font-size: 0.8rem;">🎯 Formal</button>
            <button class="btn btn-secondary ai-polish-btn" data-action="friendly" title="Friendly tone" style="padding: 2px 6px; font-size: 0.8rem;">💬 Friendly</button>
          </div>
        </div>
        <textarea class="form-textarea" id="c-body" style="min-height: 250px"></textarea>
      </div>
    `;

    const footerHtml = `
      <div style="flex:1; font-size:0.8rem; color:var(--text-muted);">Emails are sent directly from your Gmail.</div>
      <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-secondary" id="modal-draft-btn">Save Draft</button>
      <button class="btn btn-primary" id="modal-send-btn">📧 Send Now</button>
    `;

    openModal(profName ? `Compose Email to ${profName}` : 'Compose Email', bodyHtml, footerHtml);

    const composeFields = () => ({
      prof_name: document.getElementById('c-name').value,
      univ_name: document.getElementById('c-univ').value,
      prof_interests: document.getElementById('c-interests').value,
      paper_title: document.getElementById('c-paper').value,
      projects: document.getElementById('c-projects').value
    });

    const updatePreview = () => {
      const templateId = document.getElementById('c-template').value;
      if (!templateId) return;
      const t = state.templates.find(x => x.id === templateId);
      if (!t) return;
      const ctx = buildMergeContext(composeFields());
      document.getElementById('c-subject').value = applyMergeTags(t.subject, ctx);
      document.getElementById('c-body').value = applyMergeTags(t.body, ctx);
    };

    document.getElementById('c-template').addEventListener('change', updatePreview);
    if (state.activeTemplateId) updatePreview();

    // Re-apply merge tags whenever a professor field changes
    ['c-name', 'c-univ', 'c-interests', 'c-paper', 'c-projects'].forEach(id => {
      document.getElementById(id).addEventListener('blur', updatePreview);
    });

    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

    // Handle AI Polish Buttons
    document.querySelectorAll('.ai-polish-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        const bodyEl = document.getElementById('c-body');
        const currentText = bodyEl.value.trim();
        if (!currentText) return showToast("Enter some email body text first.", 'error');
        
        e.target.disabled = true;
        const origText = e.target.textContent;
        e.target.textContent = '⏳';
        
        try {
          // If enhance, combine all inputs + your saved profile as context
          let prompt = currentText;
          if (action === 'enhance') {
            const c = buildMergeContext(composeFields());
            prompt = `Context:
Professor: ${c.prof_name} (${c.univ_name})
Professor's research interests: ${c.prof_interests}
Their paper: ${c.paper_title}
Their projects: ${c.projects}
Applicant: ${c.my_name}, ${c.my_degree} from ${c.my_university}
Applicant experience: ${c.my_experience_years} years as ${c.my_job_title} at ${c.my_company}
Applicant skills: ${c.my_skills}
Applicant interests: ${c.my_interests}
Extra background: ${c.my_background}

Current Draft:
${currentText}`;
          }
          
          const polished = await AIService.polish(prompt, action);
          bodyEl.value = polished;
          document.getElementById('c-template').value = ''; // Detach from template
        } catch(err) {
          console.error(err);
          showToast('AI error: ' + err.message, 'error', 6000);
        } finally {
          e.target.disabled = false;
          e.target.textContent = origText;
        }
      });
    });

    // Handle Send/Draft
    const processEmail = async (isDraft) => {
      if (!state.googleToken) return showToast('Sign in with Google (top-right) to send or draft emails.', 'error', 6000);
      const btnId = isDraft ? 'modal-draft-btn' : 'modal-send-btn';
      const btn = document.getElementById(btnId);
      const to = document.getElementById('c-to').value;
      const sub = document.getElementById('c-subject').value;
      const bod = document.getElementById('c-body').value;
      
      if (!to || !sub || !bod) return showToast("To, Subject, and Body are required.", 'error');
      if (!isValidRecipient(to)) return showToast("Enter the professor's real email — made-up addresses (e.g. name@example.edu) are blocked. Check their homepage.", 'error', 7000);

      btn.disabled = true;
      const origText = btn.textContent;
      btn.innerHTML = '<span class="btn-spinner"></span> ' + (isDraft ? 'Saving...' : 'Sending...');
      
      try {
        if (isDraft) {
          await GmailService.createDraft(to, sub, bod);
        } else {
          await GmailService.send(to, sub, bod);
        }
        
        // Save to outbox tracker
        state.outbox.unshift({
          id: generateId(),
          to: to,
          profName: document.getElementById('c-name').value,
          subject: sub,
          status: isDraft ? 'draft' : 'sent',
          createdAt: Date.now()
        });
        saveOutbox();
        
        // Update Kanban if tied to a prof
        if (prof) {
          const profId = prof.n + '_' + prof.a;
          if (!state.applications[profId]) toggleTrackProfessor(prof);
          if (state.applications[profId]) {
            state.applications[profId].email = to; // remember the verified address
            if (!isDraft) state.applications[profId].status = 'contacted';
          }
          saveApplications();
        }
        
        showToast(isDraft ? 'Draft saved to Gmail.' : 'Email sent via Gmail.', 'success');
        route();
        closeModal();
      } catch(err) {
        console.error(err);
        showToast('Failed: ' + err.message + '. Check you are signed in and popups are allowed.', 'error', 7000);
        btn.disabled = false;
        btn.textContent = origText;
      }
    };
    
    document.getElementById('modal-draft-btn').addEventListener('click', () => processEmail(true));
    document.getElementById('modal-send-btn').addEventListener('click', () => processEmail(false));
  }

  function toggleTrackProfessor(prof) {
    // Tracking is fully local — no sign-in required. Cloud sync is a bonus for signed-in users.
    const profId = prof.n + '_' + prof.a;
    if (state.applications[profId]) {
      delete state.applications[profId];
    } else {
      state.applications[profId] = {
        id: profId, prof: prof, status: 'saved', addedAt: Date.now()
      };
      if (!state.googleToken) maybeNudgeSignIn();
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

    // Sort a copy — never mutate state.professors (the no-filter path aliases it).
    if (results === state.professors) results = results.slice();
    switch (state.sortBy) {
      case 'name': results.sort((a, b) => a.n.localeCompare(b.n)); break;
      case 'recent': results.sort((a, b) => b.rp - a.rp); break;
      case 'affiliation': results.sort((a, b) => a.a.localeCompare(b.a)); break;
      default: results.sort((a, b) => b.tp - a.tp); break;
    }
    return results;
  }

  // Facet counts iterate all 34k professors, so compute once and cache.
  let _countryCounts = null, _categoryCounts = null;
  function getCountryCounts() {
    if (_countryCounts) return _countryCounts;
    const counts = {};
    state.professors.forEach(p => { if (p.c) counts[p.c] = (counts[p.c] || 0) + 1; });
    _countryCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return _countryCounts;
  }
  function getCategoryCounts() {
    if (_categoryCounts) return _categoryCounts;
    const counts = {};
    state.professors.forEach(p => {
      const seen = new Set();
      p.ar.forEach(area => {
        const cat = getAreaCategory(area);
        if (!seen.has(cat)) { counts[cat] = (counts[cat] || 0) + 1; seen.add(cat); }
      });
    });
    _categoryCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return _categoryCounts;
  }

  function renderDiscoverPage() {
    const countryCounts = getCountryCounts().slice(0, 15);
    const categoryCounts = getCategoryCounts();
    return `
      ${renderWelcomeBanner()}
      <div class="page-header discover-head">
        <div>
          <h1 class="page-title">Discover Professors</h1>
          <p class="page-subtitle">${state.openAlexMode ? 'Search millions of faculty across all STEM fields via OpenAlex' : `Search ${state.professors.length.toLocaleString()} CS faculty across ${Object.keys(state.institutions).length.toLocaleString()} institutions worldwide`}</p>
        </div>
        <div class="mode-toggle">
          <button class="mode-btn ${!state.openAlexMode ? 'active' : ''}" id="mode-cs-btn">CS Rankings</button>
          <button class="mode-btn ${state.openAlexMode ? 'active' : ''}" id="mode-oa-btn" title="Search all STEM fields via OpenAlex">Global STEM</button>
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
      const scholarHref = p.s && p.s !== 'NOSCHOLARPAGE' ? 'https://scholar.google.com/citations?user=' + encodeURIComponent(p.s) : '';
      const scholarUrl = scholarHref ? `<a href="${scholarHref}" target="_blank" rel="noopener" class="prof-link">Scholar</a>` : '';
      const homepageUrl = p.h ? `<a href="${escapeHtml(p.h)}" target="_blank" rel="noopener" class="prof-link">Homepage</a>` : '';
      const orcidUrl = p.orcid ? `<a href="${escapeHtml(p.orcid)}" target="_blank" rel="noopener" class="prof-link">ORCID</a>` : '';
      const oaUrl = p.oaId ? `<a href="${escapeHtml(p.oaId)}" target="_blank" rel="noopener" class="prof-link">Profile &#8599;</a>` : '';
      const stipendLink = inst.stipend ? `<a href="#/stipends" class="prof-link prof-link-stipend">${formatMoney(inst.stipend.preQual)}/yr</a>` : '';
      // Make the name itself a link to the best available profile (homepage → OpenAlex → Scholar).
      const profileUrl = p.h || p.oaId || scholarHref;
      const nameHtml = profileUrl
        ? `<a class="prof-name prof-name-link" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener">${escapeHtml(p.n)} <span class="prof-name-ext">&#8599;</span></a>`
        : `<div class="prof-name">${escapeHtml(p.n)}</div>`;

      return `
        <div class="prof-card">
          <div class="prof-card-header">
            <div>${nameHtml}<div class="prof-affiliation">${escapeHtml(p.a)}</div></div>
            <span class="prof-country">${COUNTRY_NAMES[p.c] || p.c || '?'}</span>
          </div>
          <div class="prof-areas">${areas}${moreAreas}</div>
          <div class="prof-stats">
            <span class="prof-stat"><strong>${Math.round(p.tp || 0)}</strong> total pubs</span>
            <span class="prof-stat"><strong>${Math.round(p.rp || 0)}</strong> ${state.openAlexMode ? 'citations' : 'since 2020'}</span>
          </div>
          <div class="prof-links">${homepageUrl}${scholarUrl}${orcidUrl}${oaUrl}${stipendLink}</div>
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

  async function updateDiscoverResults() {
    if(state.currentPage !== 'discover') return;
    
    const listEl = document.getElementById('professor-list');
    const countEl = document.getElementById('results-count');
    const searchCountEl = document.getElementById('search-count');
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (state.openAlexMode) {
      if (!state.searchQuery.trim()) {
        if (listEl) listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#127758;</div><div class="empty-state-text">Search all STEM fields</div><div class="empty-state-hint">Type a name or institution (e.g. "Mechanical Engineering MIT"). Local filters and sorting don\'t apply in Global STEM mode.</div></div>';
        if (countEl) countEl.innerHTML = '';
        if (searchCountEl) searchCountEl.textContent = '0 results';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
      }

      if (listEl) listEl.innerHTML = '<div class="empty-state"><div class="loading-spinner" style="width:32px;height:32px;margin:0 auto"></div><div class="empty-state-hint">Searching OpenAlex…</div></div>';
      
      try {
        // Request only the fields we render (smaller/faster payload) and rank the most-cited first.
        const fields = 'id,display_name,orcid,works_count,cited_by_count,last_known_institutions,x_concepts';
        const url = 'https://api.openalex.org/authors'
          + '?search=' + encodeURIComponent(state.searchQuery)
          + '&per_page=25&select=' + fields
          + '&sort=relevance_score:desc';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          // Map OpenAlex raw data to ProfScout format, keeping profile URLs so cards can link out.
          state.openAlexResults = (data.results || []).map(a => {
            const inst = (a.last_known_institutions && a.last_known_institutions[0]) || a.last_known_institution || null;
            return {
              n: a.display_name,
              a: inst ? inst.display_name : 'Unknown Institution',
              ar: (a.x_concepts || []).map(c => c.display_name).slice(0, 3),
              tp: a.works_count || 0,
              rp: a.cited_by_count || 0,
              c: inst && inst.country_code ? inst.country_code.toLowerCase() : '',
              oaId: a.id || '',            // OpenAlex author profile (e.g. https://openalex.org/A123)
              orcid: a.orcid || ''         // ORCID profile URL if the author has one
            };
          });

          if (listEl) listEl.innerHTML = renderProfCards(state.openAlexResults, state.displayCount);
          if (countEl) countEl.innerHTML = `Showing top <strong>${state.openAlexResults.length}</strong> results from OpenAlex &mdash; click a name to open their profile`;
          if (searchCountEl) searchCountEl.textContent = `${state.openAlexResults.length} results`;
          if (loadMoreBtn) loadMoreBtn.style.display = 'none'; // OpenAlex just returns top page
          initDiscoverListEvents();
        }
      } catch (e) {
        if (listEl) listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#9888;</div><div class="empty-state-text">Couldn\'t reach OpenAlex</div><div class="empty-state-hint">Check your connection and try again.</div></div>';
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
    bindWelcomeBanner();

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
  // Stipends page state (sortable/searchable table)
  const stipendView = { sortBy: 'net', dir: -1, query: '' };
  const STIPEND_COLS = [
    { key: 'name', label: 'University', num: false },
    { key: 'stipend', label: 'Stipend', num: true },
    { key: 'fee', label: 'Fees', num: true },
    { key: 'livingCost', label: 'Living Cost', num: true },
    { key: 'net', label: 'Net / yr', num: true },
    { key: 'type', label: 'Type', num: false },
    { key: 'summerGtd', label: 'Summer', num: true }
  ];

  function getSortedStipends() {
    let data = getStipendData();
    const q = stipendView.query.trim().toLowerCase();
    if (q) data = data.filter(d => d.name.toLowerCase().includes(q));
    const k = stipendView.sortBy, dir = stipendView.dir;
    data.sort((a, b) => {
      let av = a[k], bv = b[k];
      if (av === null || av === undefined) av = -Infinity;
      if (bv === null || bv === undefined) bv = -Infinity;
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return data;
  }

  function renderStipendsPage() {
    const all = getStipendData();
    const withNet = all.filter(d => d.net !== null);
    const avgStipend = all.length ? Math.round(all.reduce((s, d) => s + d.stipend, 0) / all.length) : 0;
    const bestNet = withNet.length ? withNet.reduce((m, d) => d.net > m.net ? d : m) : null;

    return `
      <div class="page-header">
        <h1 class="page-title">PhD Stipend Dashboard</h1>
        <p class="page-subtitle">${all.length} universities &middot; stipend, fees, and cost of living. Click a column to sort.</p>
      </div>
      <div class="stat-cards">
        <div class="stat-card"><div class="stat-card-value">${formatMoney(avgStipend)}</div><div class="stat-card-label">Average Stipend</div></div>
        ${bestNet ? `<div class="stat-card"><div class="stat-card-value">${formatMoney(bestNet.net)}</div><div class="stat-card-label">Best Net (${escapeHtml(bestNet.name)})</div></div>` : ''}
        <div class="stat-card"><div class="stat-card-value">${withNet.length}</div><div class="stat-card-label">With Cost-of-Living Data</div></div>
      </div>
      <div class="search-container">
        <span class="search-icon">&#128270;</span>
        <input type="text" class="search-input" id="stipend-search" placeholder="Filter universities..." value="${escapeHtml(stipendView.query)}" autocomplete="off">
      </div>
      <div class="stipend-table-container">
        <table class="stipend-table" id="stipend-table"><thead>${renderStipendHead()}</thead><tbody id="stipend-tbody">${renderStipendRows()}</tbody></table>
      </div>
    `;
  }

  function renderStipendHead() {
    return `<tr>${STIPEND_COLS.map(c => {
      const sorted = stipendView.sortBy === c.key;
      const arrow = sorted ? `<span class="sort-arrow">${stipendView.dir < 0 ? '▼' : '▲'}</span>` : '';
      return `<th data-key="${c.key}" class="${sorted ? 'sorted' : ''}">${c.label}${arrow}</th>`;
    }).join('')}</tr>`;
  }

  function renderStipendRows() {
    const data = getSortedStipends();
    if (data.length === 0) return `<tr><td colspan="${STIPEND_COLS.length}"><div class="empty-state"><div class="empty-state-text">No universities match your filter</div></div></td></tr>`;
    return data.map(d => {
      const netCls = d.net === null ? '' : (d.net >= 0 ? 'positive' : 'negative');
      return `<tr>
        <td style="color:var(--text-primary); font-weight:var(--weight-medium)">${escapeHtml(d.name)}</td>
        <td class="money">${formatMoney(d.stipend)}</td>
        <td class="money">${formatMoney(d.fee)}</td>
        <td class="money">${d.livingCost === null ? '—' : formatMoney(d.livingCost)}</td>
        <td class="money ${netCls}">${d.net === null ? '—' : formatMoney(d.net)}</td>
        <td>${d.type ? `<span class="type-badge ${d.type === 'private' ? 'private' : 'public'}">${escapeHtml(d.type)}</span>` : '—'}</td>
        <td>${d.summerGtd ? '✓' : '—'}</td>
      </tr>`;
    }).join('');
  }

  function bindStipendHead() {
    document.querySelectorAll('#stipend-table th').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (stipendView.sortBy === key) stipendView.dir *= -1;
        else { stipendView.sortBy = key; stipendView.dir = STIPEND_COLS.find(c => c.key === key).num ? -1 : 1; }
        document.querySelector('#stipend-table thead').innerHTML = renderStipendHead();
        document.getElementById('stipend-tbody').innerHTML = renderStipendRows();
        bindStipendHead();
      });
    });
  }

  function initStipendsPage() {
    const search = document.getElementById('stipend-search');
    let t;
    search?.addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        stipendView.query = e.target.value;
        document.getElementById('stipend-tbody').innerHTML = renderStipendRows();
      }, 150);
    });
    bindStipendHead();
  }

  // ===== MATCH PAGE =====
  function computeMatches() {
    if (state.selectedInterests.size === 0) return [];
    // selectedInterests now holds individual area codes selected by the user.
    const selectedAreaCodes = state.selectedInterests;
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
      <div class="page-header">
        <h1 class="page-title">Find Your Research Match</h1>
        <p class="page-subtitle">Select the specific research areas you care about, then rank professors by fit.</p>
      </div>
      <div class="interest-selector" id="interest-selector">
        ${catEntries.map(([cat, codes]) => `<div class="interest-category"><div class="interest-category-title">${cat}</div><div class="interest-tags">${codes.map(c => `<div class="interest-tag ${state.selectedInterests.has(c)?'selected':''}" data-area="${c}">${getAreaLabel(c)}</div>`).join('')}</div></div>`).join('')}
        <div class="match-controls">
          <button class="btn btn-secondary" id="match-clear-btn" ${state.selectedInterests.size===0?'disabled':''}>Clear</button>
          <button class="match-btn" id="match-btn" ${state.selectedInterests.size===0?'disabled':''}>Find Matches (<span id="match-sel-count">${state.selectedInterests.size}</span>)</button>
        </div>
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
    const syncControls = () => {
      const n = state.selectedInterests.size;
      document.getElementById('match-btn').disabled = n === 0;
      document.getElementById('match-clear-btn').disabled = n === 0;
      const c = document.getElementById('match-sel-count');
      if (c) c.textContent = n;
    };
    document.getElementById('interest-selector').addEventListener('click', (e) => {
      const tag = e.target.closest('.interest-tag');
      if (!tag) return;
      const area = tag.dataset.area;
      if (state.selectedInterests.has(area)) { state.selectedInterests.delete(area); tag.classList.remove('selected'); }
      else { state.selectedInterests.add(area); tag.classList.add('selected'); }
      syncControls();
    });
    document.getElementById('match-clear-btn').addEventListener('click', () => {
      state.selectedInterests.clear();
      document.querySelectorAll('.interest-tag.selected').forEach(t => t.classList.remove('selected'));
      document.getElementById('match-results').innerHTML = '';
      syncControls();
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
                <span class="template-item-name">${escapeHtml(t.name)}${t.builtin ? '<span class="template-badge">Default</span>' : ''}</span>
                ${t.builtin ? '' : `<button class="template-delete-btn" data-id="${t.id}" title="Delete template">&times;</button>`}
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
              <div class="merge-tag-help">Click a tag to insert it. <strong>Professor</strong> tags come from the compose form; <strong>You</strong> tags come from your profile in Settings.</div>
              ${MERGE_TAGS.map(g => `
                <div class="merge-tag-group">
                  <span class="merge-tag-group-label">${g.group}</span>
                  <div class="merge-tags">
                    ${g.items.map(([tag, desc]) => `<span class="merge-tag" data-tag="{{${tag}}}" title="${escapeHtml(desc)}">${'{{'}${tag}${'}}'}</span>`).join('')}
                  </div>
                </div>
              `).join('')}
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
      if (!state.googleToken) maybeNudgeSignIn();
    });
    document.getElementById('templates-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.template-item');
      const delBtn = e.target.closest('.template-delete-btn');
      if (delBtn) {
        const id = delBtn.dataset.id;
        if (id === DEFAULT_TEMPLATE_ID) return showToast("The default template can't be deleted.", 'error');
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
          showToast('Template saved.', 'success');
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
    const total = Object.keys(state.applications).length;
    return `
      <div class="page-header tracker-header">
        <div>
          <h1 class="page-title">Application Tracker</h1>
          <p class="page-subtitle">${total} saved. Drag a card between columns, or change its status dropdown. Tick cards to bulk-compose.</p>
        </div>
        <button class="btn btn-primary" id="bulk-schedule-btn">📧 Bulk Compose Selected</button>
      </div>
      <div class="kanban-board" id="kanban-board">${renderTrackerBoard()}</div>
    `;
  }

  function renderTrackerBoard() {
    const appsByCol = {};
    KANBAN_COLS.forEach(c => appsByCol[c] = []);
    Object.values(state.applications).forEach(app => {
      if (appsByCol[app.status]) appsByCol[app.status].push(app);
      else appsByCol['saved'].push(app);
    });
    return KANBAN_COLS.map(col => `
      <div class="kanban-column" data-status="${col}">
        <div class="kanban-column-header">
          <input type="checkbox" class="kanban-select-all" data-status="${col}" title="Select all in column">
          <span>${COL_NAMES[col]}</span>
          <span class="kanban-count">${appsByCol[col].length}</span>
        </div>
        <div class="kanban-cards" ondragover="event.preventDefault()" data-status="${col}">
          ${appsByCol[col].length === 0 ? '<div class="kanban-empty">Drop here</div>' : appsByCol[col].map(app => `
            <div class="kanban-card" draggable="true" data-id="${app.id}">
              <div class="kanban-card-main">
                <input type="checkbox" class="bulk-select-cb" value="${app.id}">
                <div>
                  <div class="kanban-card-title">${escapeHtml(app.prof.n)}</div>
                  <div class="kanban-card-subtitle">${escapeHtml(app.prof.a)}</div>
                </div>
              </div>
              <div class="kanban-card-actions">
                <select class="status-select" data-id="${app.id}" aria-label="Application status">
                  ${KANBAN_COLS.map(c => `<option value="${c}" ${app.status===c?'selected':''}>${COL_NAMES[c]}</option>`).join('')}
                </select>
                <button class="action-btn email-btn" title="Compose email" data-prof='${JSON.stringify(app.prof).replace(/'/g, "&apos;")}'>&#9993;</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // Re-render only the board, preserving the user's bulk-selection checkboxes.
  function refreshTrackerBoard() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    const checked = new Set(Array.from(board.querySelectorAll('.bulk-select-cb:checked')).map(cb => cb.value));
    board.innerHTML = renderTrackerBoard();
    checked.forEach(id => {
      const cb = board.querySelector(`.bulk-select-cb[value="${id}"]`);
      if (cb) cb.checked = true;
    });
    bindTrackerBoardEvents();
  }

  function bindTrackerBoardEvents() {
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (state.applications[id]) {
          state.applications[id].status = e.target.value;
          saveApplications();
          refreshTrackerBoard();
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
          refreshTrackerBoard();
        }
      });
    });
    document.querySelectorAll('.kanban-select-all').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const column = document.querySelector(`.kanban-cards[data-status="${e.target.dataset.status}"]`);
        if (column) column.querySelectorAll('.bulk-select-cb').forEach(c => { c.checked = e.target.checked; });
      });
    });
    document.querySelectorAll('#kanban-board .email-btn').forEach(btn => {
      btn.addEventListener('click', (e) => openEmailModal(JSON.parse(e.currentTarget.dataset.prof)));
    });
  }

  function initTrackerPage() {
    bindTrackerBoardEvents();
    document.getElementById('bulk-schedule-btn').addEventListener('click', () => {
      const selectedIds = Array.from(document.querySelectorAll('.bulk-select-cb:checked')).map(cb => cb.value);
      if (selectedIds.length === 0) return showToast('Select at least one professor to bulk-compose.', 'error');
      openBulkComposeModal(selectedIds);
    });
  }

  function openBulkComposeModal(selectedIds) {
    if (state.templates.length === 0) {
      showToast("Create an email template first.", 'error');
      window.location.hash = '#/templates';
      return;
    }

    const templateOptions = state.templates.map(t =>
      `<option value="${t.id}">${escapeHtml(t.name)}</option>`
    ).join('');

    // One row per professor so the user can supply/confirm a real email address.
    // Addresses are prefilled from any previously saved address on the application.
    const rows = selectedIds.map(id => {
      const app = state.applications[id];
      if (!app) return '';
      const homepage = app.prof.h ? `<a href="${escapeHtml(app.prof.h)}" target="_blank" rel="noopener" title="Open homepage to find email">&#8599;</a>` : '';
      return `
        <div class="bulk-row" data-id="${id}">
          <div class="bulk-row-prof">
            <div class="bulk-row-name">${escapeHtml(app.prof.n)} ${homepage}</div>
            <div class="bulk-row-univ">${escapeHtml(app.prof.a)}</div>
          </div>
          <input type="email" class="form-input bulk-row-email" data-id="${id}" value="${escapeHtml(app.email || '')}" placeholder="professor@university.edu" autocomplete="off">
        </div>`;
    }).join('');

    const bodyHtml = `
      <div style="margin-bottom:1rem;">Composing for <strong>${selectedIds.length}</strong> professor(s). Enter each real email address &mdash; rows without a valid address are skipped.</div>
      <div class="form-group">
        <label class="form-label">Template</label>
        <select class="form-input" id="bulk-template-select">${templateOptions}</select>
      </div>
      <div class="bulk-rows">${rows}</div>
      <div class="form-hint">A 2-second delay is added between messages to respect Gmail rate limits. "Save as Drafts" never sends — it just stages them in Gmail for review.</div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" id="modal-cancel-bulk-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-bulk-draft-btn">Save as Drafts</button>
      <button class="btn btn-secondary" id="modal-confirm-bulk-btn">Send All Now</button>
    `;

    openModal('Bulk Compose Emails', bodyHtml, footerHtml);
    document.getElementById('modal-cancel-bulk-btn').addEventListener('click', closeModal);

    const processBulk = async (isDraft, e) => {
      const templateId = document.getElementById('bulk-template-select').value;
      const template = state.templates.find(t => t.id === templateId);

      // Persist any addresses the user typed, and collect the sendable set.
      const jobs = [];
      const invalid = [];
      document.querySelectorAll('.bulk-row-email').forEach(input => {
        const id = input.dataset.id;
        const email = input.value.trim();
        if (state.applications[id]) state.applications[id].email = email;
        if (isValidRecipient(email)) jobs.push({ id, email });
        else if (email) invalid.push(email);
      });
      saveApplications();

      if (jobs.length === 0) {
        showToast("No valid email addresses entered. Add each professor's real email (example.edu is blocked).", 'error', 6000);
        return;
      }
      if (!isDraft && !confirm(`Send ${jobs.length} email(s) now via your Gmail account? This cannot be undone.`)) return;

      const btn = e.target;
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-spinner"></span> Processing...';

      let successCount = 0;
      for (const job of jobs) {
        const app = state.applications[job.id];
        if (!app) continue;
        const prof = app.prof;
        const profAreasStr = (prof.ar || []).slice(0,2).map(getAreaLabel).join(', ');
        const ctx = buildMergeContext({
          prof_name: prof.n,
          univ_name: prof.a,
          prof_interests: profAreasStr,
          paper_title: '',
          projects: ''
        });
        const subject = applyMergeTags(template.subject, ctx);
        const body = applyMergeTags(template.body, ctx);

        try {
          if (isDraft) await GmailService.createDraft(job.email, subject, body);
          else await GmailService.send(job.email, subject, body);

          state.outbox.unshift({
            id: generateId(),
            to: job.email,
            profName: prof.n,
            subject: subject,
            status: isDraft ? 'draft' : 'sent',
            createdAt: Date.now()
          });
          if (!isDraft) state.applications[job.id].status = 'contacted';
          successCount++;
          await new Promise(r => setTimeout(r, 2000));
        } catch(err) {
          console.error("Failed to bulk process for " + prof.n, err);
        }
      }

      saveOutbox();
      saveApplications();

      const skipped = selectedIds.length - jobs.length;
      showToast(`${isDraft ? 'Drafted' : 'Sent'} ${successCount} of ${jobs.length} email(s).` +
        (skipped ? ` ${skipped} skipped (no valid address).` : '') +
        (invalid.length ? ` ${invalid.length} invalid.` : ''), 'success', 6000);
      route();
      closeModal();
    };

    document.getElementById('modal-bulk-draft-btn').addEventListener('click', (e) => processBulk(true, e));
    document.getElementById('modal-confirm-bulk-btn').addEventListener('click', (e) => processBulk(false, e));
  }

  // ===== Initialize =====
  window.addEventListener('hashchange', route);
  
  // Google Auth init
  const signinBtn = document.getElementById('google-signin-btn');
  if (signinBtn) {
    signinBtn.addEventListener('click', () => {
      if (state.googleUser) {
        if(confirm('Sign out of Google?')) GoogleAuth.signOut();
      } else {
        GoogleAuth.requestToken().then(() => showToast('Signed in with Google.', 'success')).catch(e => { console.error(e); showToast('Sign-in was cancelled or failed. Please try again.', 'error'); });
      }
    });
  }
  // Wait for GIS script to load before init
  const checkGoogle = setInterval(() => {
    if (typeof google !== 'undefined' && google.accounts) {
      clearInterval(checkGoogle);
      GoogleAuth.init();
    }
  }, 100);

  loadData();
})();
