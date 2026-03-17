/**
 * ============================================================
 * AI-Powered Domestic Worker Registration & Management System
 * Ministry of Labour & Employment, Government of India
 * Version 3.0 — Real MongoDB Backend
 * ============================================================
 */

const API = 'http://localhost:3001/api';

/* ============================================================
   AUTH TOKEN HELPERS
   ============================================================ */
function getToken() { return localStorage.getItem('dwrms_token'); }
function saveToken(t) { localStorage.setItem('dwrms_token', t); }
function clearToken() { localStorage.removeItem('dwrms_token'); }
function saveUser(u) { localStorage.setItem('dwrms_user', JSON.stringify(u)); }
function getSavedUser() { return JSON.parse(localStorage.getItem('dwrms_user') || 'null'); }
function clearUser() { localStorage.removeItem('dwrms_user'); }

/* ============================================================
   GENERIC API FETCH HELPER
   ============================================================ */
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ============================================================
   CURRENT USER
   ============================================================ */
let currentUser = null;

/* ============================================================
   AUTH — LOGIN
   ============================================================ */
async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!email || !pass) {
    errEl.textContent = '⚠ Please enter email and password.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.querySelector('#form-login .btn-primary');
  setLoading(btn, 'Signing in...');

  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass })
    });
    saveToken(data.token);
    saveUser(data.user);
    startSession(data.user);
  } catch (err) {
    errEl.textContent = `⚠ ${err.message}`;
    errEl.classList.remove('hidden');
  } finally {
    setLoading(btn, null, 'Sign In →');
  }
}

/* ============================================================
   AUTH — REGISTER
   ============================================================ */
async function doRegister() {
  const name = document.getElementById('reg-fullname').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const role = document.getElementById('reg-role').value;
  const pass = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const errEl = document.getElementById('register-error');
  const sucEl = document.getElementById('register-success');
  errEl.classList.add('hidden');
  sucEl.classList.add('hidden');

  if (!name) { errEl.textContent = '⚠ Full name is required.'; errEl.classList.remove('hidden'); return; }
  if (!email.includes('@')) { errEl.textContent = '⚠ Enter a valid email.'; errEl.classList.remove('hidden'); return; }
  if (!role) { errEl.textContent = '⚠ Please select a role.'; errEl.classList.remove('hidden'); return; }
  if (pass.length < 6) { errEl.textContent = '⚠ Password must be ≥ 6 characters.'; errEl.classList.remove('hidden'); return; }
  if (pass !== confirm) { errEl.textContent = '⚠ Passwords do not match.'; errEl.classList.remove('hidden'); return; }

  const btn = document.querySelector('#form-register .btn-primary');
  setLoading(btn, 'Registering...');

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: pass, role })
    });

    sucEl.textContent = `✅ Account created for "${name}" as ${role}. Please log in.`;
    sucEl.classList.remove('hidden');

    setTimeout(() => {
      ['reg-fullname', 'reg-email', 'reg-password', 'reg-confirm'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('reg-role').value = '';
      sucEl.classList.add('hidden');
      switchAuthTab('login');
      document.getElementById('login-email').value = email;
    }, 1800);
  } catch (err) {
    errEl.textContent = `⚠ ${err.message}`;
    errEl.classList.remove('hidden');
  } finally {
    setLoading(btn, null, 'Register Account →');
  }
}

/* ============================================================
   AUTH — LOGOUT
   ============================================================ */
function doLogout() {
  clearToken();
  clearUser();
  currentUser = null;
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

/* ============================================================
   SESSION
   ============================================================ */
function startSession(user) {
  currentUser = user;
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  setupRoleUI(user);
}

/* ============================================================
   ROLE-BASED UI SETUP
   ============================================================ */
function setupRoleUI(user) {
  const roleLabels = { worker: 'Worker', employer: 'Employer / Govt. Official', admin: 'Administrator' };
  document.getElementById('user-display').textContent = `👤 ${user.name}  |  ${roleLabels[user.role] || user.role}`;

  const roleBadge = document.getElementById('role-badge');
  roleBadge.textContent = roleLabels[user.role];
  roleBadge.className = `badge-role role-${user.role}`;

  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.add('hidden'));
  document.querySelectorAll(`.role-${user.role}`).forEach(btn => btn.classList.remove('hidden'));

  const defaults = { worker: 'my-profile', employer: 'jobs', admin: 'admin' };
  navigateTo(defaults[user.role] || 'my-profile');

  if (user.role === 'worker') prefillWorkerForm();
  if (user.role === 'employer') { populateComplaintWorkerSelect(); renderMyJobs(); }
  if (user.role === 'admin') { renderAdmin(); renderAdminStats(); }
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  const navEl = document.getElementById(`nav-${page}`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');

  if (page === 'my-dashboard') renderMyDashboard();
  if (page === 'all-workers') renderDirectory();
  if (page === 'my-jobs') renderMyJobs();
  if (page === 'admin') { renderAdmin(); renderAdminStats(); }
  if (page === 'registry') renderRegistry();
  if (page === 'activity') renderActivityLog();
  if (page === 'complaints') { populateComplaintWorkerSelect(); renderComplaintLog(); }
}

/* ============================================================
   AUTH UI HELPERS
   ============================================================ */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`form-${tab}`).classList.add('active');
}

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

/* ============================================================
   AGENT 1 — REGISTRATION AGENT  (client-side AI extraction)
   ============================================================ */
async function runRegistrationAgent() {
  const text = document.getElementById('ai-text-input').value.trim();
  if (!text) { showAiResult({ error: 'Please enter your work experience description.' }); return; }

  const btn = document.getElementById('btn-extract');
  setLoading(btn, 'Analysing with AI...');

  try {
    const result = await apiFetch('/agents/extract-text', {
      method: 'POST',
      body: JSON.stringify({ text })
    });

    // Auto-fill ALL extracted fields into the form
    if (result.name) document.getElementById('wp-name').value = result.name;
    if (result.experience) document.getElementById('wp-experience').value = result.experience;
    if (result.phone) document.getElementById('wp-phone').value = result.phone;
    if (result.location) document.getElementById('wp-location').value = result.location;
    if (result.skills?.length) checkSkillBoxes(result.skills);

    // Sync availability toggle
    const avail = result.availability !== false;
    document.getElementById('wp-availability').checked = avail;
    document.getElementById('avail-label').textContent = avail ? 'Available' : 'Unavailable';

    showAiResult(result);
  } catch (err) {
    showAiResult({ error: `AI Agent failed: ${err.message}` });
  } finally {
    setLoading(btn, null, '🤖 Extract with AI Agent');
  }
}

function extractExperienceData(text) {
  const lower = text.toLowerCase();
  const skills = [];
  const skillKeywords = {
    'Cooking': ['cook', 'cooking', 'chef', 'kitchen', 'food', 'meal', 'bake'],
    'Babysitting': ['babysit', 'baby', 'child', 'children', 'toddler', 'infant', 'nanny', 'kids'],
    'Driving': ['drive', 'driver', 'driving', 'chauffeur', 'car', 'vehicle'],
    'Cleaning': ['clean', 'cleaning', 'housekeep', 'mop', 'sweep', 'household'],
    'Elderly Care': ['elderly', 'senior', 'old age', 'elder', 'aged', 'geriatric'],
    'Gardening': ['garden', 'gardening', 'plant', 'plants', 'lawn', 'outdoor'],
    'Carpenter': ['carpenter', 'carpentry', 'wood', 'furniture', 'cabinet', 'joinery'],
    'Painter': ['paint', 'painter', 'painting', 'color', 'colour', 'wall paint', 'coating'],
    'Tile & Flooring': ['tile', 'tiling', 'flooring', 'floor', 'marble', 'mosaic', 'grout'],
    'Plumber': ['plumb', 'plumber', 'plumbing', 'pipe', 'drainage', 'tap', 'faucet', 'water line'],
    'Electrician': ['electric', 'electrician', 'wiring', 'circuit', 'switch', 'fuse', 'electrical'],
    'Welder': ['weld', 'welder', 'welding', 'metal', 'fabricat', 'iron work'],
    'Cement Worker': ['cement', 'concrete', 'mason', 'masonry', 'plastering', 'construction'],
    'Road Worker': ['road', 'highway', 'bitumen', 'asphalt', 'tar', 'paving', 'street work'],
    'Security Guard': ['security', 'guard', 'watchman', 'bouncer', 'patrol', 'surveillance'],
    'Sweeper': ['sweep', 'sweeper', 'sanitation', 'sanitary', 'garbage', 'waste', 'clean road'],
    'Packers & Movers': ['pack', 'packer', 'mover', 'moving', 'shifting', 'relocation', 'loading', 'unloading'],
    'Laundry & Ironing': ['laundry', 'ironing', 'iron', 'wash clothes', 'dry clean', 'press']
  };
  for (const [skill, keywords] of Object.entries(skillKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) skills.push(skill);
  }
  if (skills.length === 0) skills.push('Cleaning');
  const yearMatch = lower.match(/(\d+)\s*(?:year|yr)/);
  const experience = yearMatch ? parseInt(yearMatch[1]) : Math.floor(Math.random() * 5) + 1;
  return { skills, experience, confidence: skills.length > 1 ? 'High' : 'Medium' };
}

function checkSkillBoxes(skills) {
  document.querySelectorAll('#reg-skills input[type="checkbox"]').forEach(cb => {
    cb.checked = skills.includes(cb.value);
  });
}

function showAiResult(data) {
  const box = document.getElementById('ai-extraction-result');
  box.classList.remove('hidden');
  if (data.error) { box.innerHTML = `<span style="color:var(--gov-red)">⚠️ ${data.error}</span>`; return; }

  const aiLabel = data.aiPowered
    ? `<span class="ai-label" style="background:var(--ai-purple);color:#fff">✨ Gemini AI</span>`
    : `<span class="ai-label">⚙️ Regex Fallback</span>`;

  const rows = [
    { label: '📛 Full Name', value: data.name ? `<strong>${data.name}</strong>` : '<em style="color:var(--text-muted)">Not found</em>' },
    { label: '🛠 Skills', value: data.skills?.length ? data.skills.map(s => `<span class="skill-tag">${s}</span>`).join('') : '<em style="color:var(--text-muted)">None detected</em>' },
    { label: '🏅 Experience', value: data.experience ? `<strong>${data.experience}</strong> year(s)` : '<em style="color:var(--text-muted)">Not mentioned</em>' },
    { label: '📞 Phone', value: data.phone ? `<strong>${data.phone}</strong>` : '<em style="color:var(--text-muted)">Not found</em>' },
    { label: '📍 Location', value: data.location ? `<strong>${data.location}</strong>` : '<em style="color:var(--text-muted)">Not found</em>' },
    { label: '✅ Available', value: data.availability !== false ? '<strong style="color:var(--gov-green)">Yes</strong>' : '<strong style="color:var(--gov-red)">No</strong>' },
  ];

  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      ${aiLabel}
      <span style="font-size:0.78rem;color:var(--text-muted)">Fields auto-filled below ↓</span>
    </div>
    <table style="width:100%;font-size:0.85rem;border-collapse:collapse">
      ${rows.map(r => `
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:6px 10px 6px 0;color:var(--text-muted);white-space:nowrap">${r.label}</td>
          <td style="padding:6px 0">${r.value}</td>
        </tr>`).join('')}
    </table>
    <p style="margin-top:10px;font-size:0.78rem;color:var(--ai-purple)">✅ Review and adjust the form fields, then save your profile.</p>
  `;
}

/* ============================================================
   WORKER PROFILE — prefill from API
   ============================================================ */
async function prefillWorkerForm() {
  try {
    const worker = await apiFetch('/workers/me');
    document.getElementById('wp-name').value = worker.name;
    document.getElementById('wp-phone').value = worker.phone;
    document.getElementById('wp-experience').value = worker.experience;
    document.getElementById('wp-location').value = worker.location;
    document.getElementById('wp-availability').checked = worker.availability;
    document.getElementById('avail-label').textContent = worker.availability ? 'Available' : 'Unavailable';
    checkSkillBoxes(worker.skills);
  } catch (e) {
    // No profile yet — just prefill name from login data
    if (currentUser?.name) document.getElementById('wp-name').value = currentUser.name;
  }
}

/* ============================================================
   WORKER PROFILE — save/update via API
   ============================================================ */
async function submitWorkerProfile() {
  const name = document.getElementById('wp-name').value.trim();
  const phone = document.getElementById('wp-phone').value.trim();
  const experience = parseFloat(document.getElementById('wp-experience').value) || 0;
  const availability = document.getElementById('wp-availability').checked;
  const location = document.getElementById('wp-location').value.trim() || 'Not specified';
  const skills = Array.from(document.querySelectorAll('#reg-skills input[type="checkbox"]:checked')).map(cb => cb.value);

  const errEl = document.getElementById('profile-error');
  const sucEl = document.getElementById('profile-success');
  errEl.classList.add('hidden');
  sucEl.classList.add('hidden');

  if (!name) { errEl.textContent = '⚠ Full name is required.'; errEl.classList.remove('hidden'); return; }
  if (!phone || !/^\d{10}$/.test(phone)) { errEl.textContent = '⚠ Enter a valid 10-digit phone number.'; errEl.classList.remove('hidden'); return; }
  if (skills.length === 0) { errEl.textContent = '⚠ Please select at least one skill.'; errEl.classList.remove('hidden'); return; }

  try {
    await apiFetch('/workers/me', {
      method: 'PATCH',
      body: JSON.stringify({ name, phone, skills, experience, availability, location })
    });
    sucEl.textContent = '✅ Profile updated successfully.';
    sucEl.classList.remove('hidden');
  } catch (err) {
    errEl.textContent = `⚠ ${err.message}`;
    errEl.classList.remove('hidden');
  }
}

function clearProfileForm() {
  ['wp-name', 'wp-phone', 'wp-experience', 'wp-location'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('wp-availability').checked = true;
  document.getElementById('avail-label').textContent = 'Available';
  document.querySelectorAll('#reg-skills input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById('ai-text-input').value = '';
  document.getElementById('ai-extraction-result').classList.add('hidden');
}

/* ============================================================
   WORKER MY DASHBOARD — from API
   ============================================================ */
async function renderMyDashboard() {
  const el = document.getElementById('my-dashboard-content');
  el.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const w = await apiFetch('/workers/me');
    el.innerHTML = `
      <div class="section-card">
        <div class="profile-card-header">
          <div>
            <div class="profile-name">👤 ${w.name}</div>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px">Registered: ${new Date(w.registeredAt || w.createdAt).toLocaleDateString()}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
            <span class="status-badge ${w.flagged ? 'status-flagged' : 'status-active'}">${w.flagged ? '🚩 Flagged' : '✓ Clear Record'}</span>
            <span class="status-badge ${w.availability ? 'status-active' : 'status-inactive'}">${w.availability ? '● Available' : '○ Unavailable'}</span>
          </div>
        </div>
        <div class="profile-meta">
          <div class="profile-meta-item">📞 <strong>${w.phone}</strong></div>
          <div class="profile-meta-item">📍 <strong>${w.location}</strong></div>
          <div class="profile-meta-item">⭐ Rating: <strong>${(w.rating || 0).toFixed(1)}/5</strong></div>
          <div class="profile-meta-item">🛡 Trust Score: <strong>${w.trustScore}/100</strong></div>
          <div class="profile-meta-item">🏅 Experience: <strong>${w.experience} years</strong></div>
        </div>
        <div style="margin-top:16px">
          <label style="display:block;margin-bottom:8px">Skills</label>
          ${(w.skills || []).map(s => `<span class="skill-tag">${s}</span>`).join('')}
        </div>
        ${w.flagged ? `<div class="alert alert-error" style="margin-top:16px">⚠️ <strong>Your account has been flagged.</strong> You are currently ineligible for job assignments. Please contact the administrator.</div>` : ''}
        <div style="margin-top:16px">
          <button class="btn btn-outline" onclick="navigateTo('my-profile')">✏️ Edit Profile</button>
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = `
      <div class="section-card" style="text-align:center;padding:40px">
        <div style="font-size:2.5rem;margin-bottom:12px">📋</div>
        <h3 style="border:none;margin-bottom:8px">No Profile Found</h3>
        <p style="color:var(--text-muted);margin-bottom:20px">You haven't saved your worker profile yet.</p>
        <button class="btn btn-primary" onclick="navigateTo('my-profile')">Create My Profile →</button>
      </div>`;
  }
}

/* ============================================================
   EMPLOYER: WORKER DIRECTORY — from API
   ============================================================ */
async function renderDirectory() {
  const tbody = document.getElementById('dir-tbody');
  const empty = document.getElementById('dir-empty');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">Loading…</td></tr>';

  try {
    const workers = await apiFetch('/workers');
    const search = (document.getElementById('dir-search')?.value || '').toLowerCase();
    const visible = workers.filter(w =>
      !w.flagged && (!search || w.name.toLowerCase().includes(search) || (w.skills || []).some(s => s.toLowerCase().includes(search)))
    );

    document.getElementById('dir-total').textContent = workers.filter(w => !w.flagged).length;
    document.getElementById('dir-avail').textContent = workers.filter(w => !w.flagged && w.availability).length;

    if (visible.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    tbody.innerHTML = visible.map((w, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${w.name}</strong></td>
        <td>${(w.skills || []).map(s => `<span class="skill-tag">${s}</span>`).join('')}</td>
        <td>${w.experience} yrs</td>
        <td>⭐ ${(w.rating || 0).toFixed(1)}</td>
        <td>${w.trustScore}</td>
        <td>${w.location}</td>
        <td><span class="status-badge ${w.availability ? 'status-active' : 'status-inactive'}">${w.availability ? '● Available' : '○ Unavailable'}</span></td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--gov-red);text-align:center">⚠ Failed to load workers: ${e.message}</td></tr>`;
  }
}

/* ============================================================
   AGENT 2 — JOB ALLOCATOR (calls backend AI agent)
   ============================================================ */
async function runJobAllocator() {
  const checkedSkills = Array.from(document.querySelectorAll('#job-skills input[type="checkbox"]:checked')).map(cb => cb.value);
  const location = document.getElementById('job-location').value.trim();
  const resultEl = document.getElementById('job-result');
  resultEl.classList.add('hidden');

  if (checkedSkills.length === 0) { alert('Please select at least one required skill.'); return; }

  const btn = document.getElementById('btn-assign');
  setLoading(btn, 'Finding best worker...');
  await delay(1200);

  try {
    const data = await apiFetch('/agents/allocate', {
      method: 'POST',
      body: JSON.stringify({ jobType: checkedSkills[0], location, salary: 0 })
    });
    setLoading(btn, null, '🤖 Assign Best Worker (AI)');
    renderJobResult(data.worker, checkedSkills, location, data.allocation, data.relaxedLocation);
  } catch (err) {
    setLoading(btn, null, '🤖 Assign Best Worker (AI)');
    resultEl.classList.remove('hidden');
    document.getElementById('job-assigned-card').innerHTML = `
      <div class="alert alert-error" style="display:flex;flex-direction:column;gap:10px;padding:20px">
        <div style="display:flex;align-items:center;gap:10px;font-size:1.1rem">
          <span style="font-size:1.6rem">❌</span>
          <strong>No Worker Found for "${checkedSkills[0]}"</strong>
        </div>
        <p style="margin:0;color:var(--text-muted);font-size:0.88rem">${err.message}</p>
        <p style="margin:0;font-size:0.82rem;color:var(--text-muted)">
          💡 Try selecting a different skill, removing the location filter, or ask the admin to register more workers.
        </p>
      </div>`;
    document.getElementById('job-reason-box').innerHTML = '';
    document.getElementById('scoring-breakdown').innerHTML = '';
  }
}

function renderJobResult(w, requiredSkills, location, allocation, relaxedLocation) {
  const resultEl = document.getElementById('job-result');
  resultEl.classList.remove('hidden');

  const matchedSkills = requiredSkills.filter(rs => (w.skills || []).includes(rs));
  const missingSkills = requiredSkills.filter(rs => !(w.skills || []).includes(rs));

  document.getElementById('job-assigned-card').innerHTML = `
    <div class="assigned-worker-card">
      <div class="worker-card-header">
        <span class="worker-card-name">👤 ${w.name}</span>
        <span class="status-badge status-active">✓ Assigned</span>
      </div>
      <div class="worker-card-details">
        <span>📞 <span class="worker-detail-label">${w.phone}</span></span>
        <span>📍 <span class="worker-detail-label">${w.location}</span></span>
        <span>⭐ <span class="worker-detail-label">${(w.rating || 0).toFixed(1)}/5</span></span>
        <span>🛡 Trust: <span class="worker-detail-label">${w.trustScore}</span></span>
        <span>🏅 <span class="worker-detail-label">${w.experience} yrs</span></span>
      </div>
      <div style="font-size:0.82rem">
        <strong>Matched:</strong> ${matchedSkills.length ? matchedSkills.map(s => `<span class="skill-tag">${s}</span>`).join('') : '<em>None</em>'}
        ${missingSkills.length ? `&nbsp;<strong style="color:var(--text-muted)">Missing:</strong> ${missingSkills.map(s => `<span class="skill-tag" style="background:#ffeee8;color:#c45b2a">${s}</span>`).join('')}` : ''}
      </div>
    </div>`;

  document.getElementById('job-reason-box').innerHTML = `
    <div style="margin-bottom:6px"><span class="ai-label">AI Reason</span></div>
    <strong>${w.name}</strong> was selected by the AI Job Allocation Agent based on trust score (${w.trustScore}),
    rating (${(w.rating || 0).toFixed(1)}/5), skill match, and availability.
    Location: <strong>${location || 'Any'}</strong>.
    ${relaxedLocation ? `<br><span style="color:var(--gov-saffron)">⚠️ No worker found in "${location}" — location filter relaxed to find nearest available worker.</span>` : ''}
    ${missingSkills.length ? `Some skills (${missingSkills.join(', ')}) were not matched — no better candidate available.` : ''}
  `;

  document.getElementById('scoring-breakdown').innerHTML = `
    <div class="ai-label" style="margin-bottom:8px">Allocation ID: ${allocation?._id || 'N/A'}</div>
    <div style="font-size:0.82rem;color:var(--text-muted)">Job status: <strong>${allocation?.status || 'Pending'}</strong> · AI Assigned: ✓</div>
  `;
}

/* ============================================================
   EMPLOYER: MY JOBS (allocated by AI)
   ============================================================ */
async function renderMyJobs() {
  const el = document.getElementById('my-jobs-list');
  if (!el) return;
  el.innerHTML = '<p class="empty-msg">Loading…</p>';

  try {
    const jobs = await apiFetch('/agents/jobs/mine');

    if (jobs.length === 0) {
      el.innerHTML = `
        <div style="text-align:center;padding:40px">
          <div style="font-size:2.5rem;margin-bottom:12px">📋</div>
          <h3 style="border:none;margin-bottom:8px">No Job Allocations Yet</h3>
          <p style="color:var(--text-muted);margin-bottom:20px">Post a job first — the AI agent will assign the best worker.</p>
          <button class="btn btn-primary" onclick="navigateTo('jobs')">💼 Post a Job →</button>
        </div>`;
      return;
    }

    const statusClass = { Active: 'status-active', Pending: 'status-inactive', Completed: 'status-active', Cancelled: 'status-flagged' };
    const statusIcon = { Active: '🟢', Pending: '🟡', Completed: '✅', Cancelled: '❌' };

    el.innerHTML = jobs.map(job => `
      <div class="section-card" style="margin-bottom:16px;padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:1rem;font-weight:600;margin-bottom:4px">
              ${statusIcon[job.status] || '🔵'} ${job.jobType}
              <span style="font-size:0.78rem;font-weight:400;color:var(--text-muted);margin-left:8px">ID: ${job._id.slice(-6)}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:0.84rem;margin-top:8px;color:var(--text-secondary)">
              <span>👤 <strong>${job.workerName || '—'}</strong></span>
              <span>📍 ${job.location || '—'}</span>
              <span>💰 ₹${job.salary?.toLocaleString() || '0'}/mo</span>
              <span>🗓 ${new Date(job.createdAt).toLocaleDateString()}</span>
              ${job.aiAssigned ? '<span style="color:var(--ai-purple)">🤖 AI Assigned</span>' : ''}
            </div>
            ${job.notes ? `<div style="margin-top:8px;font-size:0.78rem;color:var(--gov-saffron)">⚠️ ${job.notes}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            <span class="status-badge ${statusClass[job.status] || 'status-inactive'}">${job.status}</span>
            ${job.status === 'Active' || job.status === 'Pending' ? `
              <div style="display:flex;gap:8px">
                <button class="btn btn-sm btn-primary" onclick="updateJobStatus('${job._id}', 'Completed')">
                  ✅ Release Worker
                </button>
                <button class="btn btn-sm btn-outline" style="color:var(--gov-red);border-color:var(--gov-red)" onclick="updateJobStatus('${job._id}', 'Cancelled')">
                  ✕ Cancel
                </button>
              </div>` : `<span style="font-size:0.78rem;color:var(--text-muted)">Worker has been released</span>`}
          </div>
        </div>
      </div>`).join('');

  } catch (e) {
    el.innerHTML = `<p class="empty-msg" style="color:var(--gov-red)">⚠ ${e.message}</p>`;
  }
}

async function updateJobStatus(jobId, status) {
  const label = status === 'Completed' ? 'release' : 'cancel';
  if (!confirm(`Are you sure you want to ${label} this job? The worker will be made available again.`)) return;
  try {
    await apiFetch(`/agents/jobs/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    renderMyJobs(); // refresh the list
  } catch (e) {
    alert(`⚠ Failed to update job: ${e.message}`);
  }
}

/* ============================================================
   AGENT 3 — COMPLAINT RESOLVER (calls backend)
   ============================================================ */
async function populateComplaintWorkerSelect() {
  const select = document.getElementById('complaint-worker');
  select.innerHTML = '<option value="">Loading workers…</option>';
  try {
    const workers = await apiFetch('/workers');
    select.innerHTML = '<option value="">-- Select Worker --</option>';
    workers.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w._id;
      opt.textContent = `${w.name} — ${(w.skills || []).join(', ')}${w.flagged ? ' 🚩' : ''}`;
      select.appendChild(opt);
    });
  } catch (e) {
    select.innerHTML = '<option value="">⚠ Could not load workers</option>';
  }
}

async function runComplaintAgent() {
  const workerId = document.getElementById('complaint-worker').value;
  const text = document.getElementById('complaint-text').value.trim();
  const resultEl = document.getElementById('complaint-result');
  resultEl.classList.add('hidden');

  if (!workerId) { alert('Please select a worker.'); return; }
  if (!text) { alert('Please enter a complaint description.'); return; }

  const btn = document.getElementById('btn-complaint');
  setLoading(btn, 'Analysing complaint...');
  await delay(1200);

  try {
    const complaint = await apiFetch('/complaints', {
      method: 'POST',
      body: JSON.stringify({ workerId, text })
    });
    setLoading(btn, null, '🤖 Submit & Analyse with AI Agent');
    renderComplaintResult(complaint);
    renderComplaintLog();
  } catch (err) {
    setLoading(btn, null, '🤖 Submit & Analyse with AI Agent');
    alert(`⚠ ${err.message}`);
  }
}

function renderComplaintResult(complaint) {
  const resultEl = document.getElementById('complaint-result');
  resultEl.classList.remove('hidden');
  const pClass = { High: 'priority-high', Medium: 'priority-medium', Low: 'priority-low' }[complaint.priority] || '';
  const aClass = { Flag: 'action-flag', Warn: 'action-warn', Ignore: 'action-ignore' }[complaint.action] || '';
  const aIcon = { Flag: '🚩', Warn: '⚠️', Ignore: '✓' }[complaint.action] || '';

  document.getElementById('complaint-output').innerHTML = `
    <div style="background:#f8f8f8;border:1px solid #eee;border-radius:4px;padding:10px;margin-bottom:12px">
      <span class="ai-label" style="margin-right:8px">AI Output</span>
    </div>
    <div class="complaint-output-grid">
      <div class="complaint-item"><div class="complaint-item-label">Type</div><div class="complaint-item-value">${complaint.type}</div></div>
      <div class="complaint-item"><div class="complaint-item-label">Priority</div><div class="complaint-item-value ${pClass}">${complaint.priority}</div></div>
      <div class="complaint-item"><div class="complaint-item-label">Action</div><div class="complaint-item-value ${aClass}">${aIcon} ${complaint.action}</div></div>
    </div>`;

  const noteMap = {
    Flag: `🤖 <strong>AI Agent Action:</strong> Worker <strong>${complaint.workerName}</strong> has been automatically <strong style="color:var(--gov-red)">FLAGGED</strong> and their trust score reduced. Ineligible for job assignments until unflagged.`,
    Warn: `🤖 <strong>AI Agent Action:</strong> A warning has been recorded. Trust score reduced by 10. No job restriction applied yet.`,
    Ignore: `🤖 <strong>AI Agent Action:</strong> Low priority complaint — no action taken against <strong>${complaint.workerName}</strong>.`
  };
  document.getElementById('complaint-action-note').innerHTML = noteMap[complaint.action] || '';
}

async function renderComplaintLog() {
  const logEl = document.getElementById('complaint-log');
  if (!logEl) return;
  logEl.innerHTML = '<p class="empty-msg">Loading…</p>';

  try {
    const endpoint = currentUser?.role === 'employer' ? '/complaints/mine' : '/complaints';
    const complaints = await apiFetch(endpoint);
    if (complaints.length === 0) { logEl.innerHTML = '<p class="empty-msg">No complaints filed yet.</p>'; return; }

    const pClass = { High: 'priority-high', Medium: 'priority-medium', Low: 'priority-low' };
    const aClass = { Flag: 'action-flag', Warn: 'action-warn', Ignore: 'action-ignore' };
    logEl.innerHTML = complaints.map(c => `
      <div class="complaint-log-item">
        <div class="complaint-log-text">
          <strong>${c.workerName}</strong> — ${c.text.length > 100 ? c.text.slice(0, 100) + '…' : c.text}<br>
          <span style="font-size:0.78rem;margin-top:3px;display:inline-block">
            Type: <strong>${c.type}</strong> &nbsp;|&nbsp;
            Priority: <strong class="${pClass[c.priority] || ''}">${c.priority}</strong> &nbsp;|&nbsp;
            Action: <strong class="${aClass[c.action] || ''}">${c.action}</strong>
          </span>
        </div>
        <span class="complaint-log-meta">${new Date(c.createdAt).toLocaleString()}</span>
      </div>`).join('');
  } catch (e) {
    logEl.innerHTML = `<p class="empty-msg" style="color:var(--gov-red)">⚠ ${e.message}</p>`;
  }
}

/* ============================================================
   ADMIN PANEL
   ============================================================ */
async function renderAdminStats() {
  const row = document.getElementById('admin-stats-row');
  try {
    const [workers, complaints] = await Promise.all([
      apiFetch('/workers'),
      apiFetch('/complaints')
    ]);
    const stats = [
      { label: 'Total Workers', value: workers.length, color: 'var(--gov-navy)' },
      { label: 'Available', value: workers.filter(w => w.availability && !w.flagged).length, color: 'var(--gov-green)' },
      { label: 'Flagged', value: workers.filter(w => w.flagged).length, color: 'var(--gov-red)' },
      { label: 'Total Complaints', value: complaints.length, color: '#6b4fcf' },
    ];
    row.innerHTML = stats.map(s => `
      <div class="admin-stat-card">
        <div class="stat-number" style="color:${s.color}">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join('');
  } catch (e) {
    row.innerHTML = `<p style="color:var(--gov-red)">⚠ Failed to load stats</p>`;
  }
}

async function renderAdmin() {
  const tbody = document.getElementById('admin-tbody');
  const search = (document.getElementById('admin-search')?.value || '').toLowerCase();
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted)">Loading…</td></tr>';
  renderAdminStats();

  try {
    const workers = await apiFetch('/workers');
    const filtered = workers.filter(w =>
      !search || w.name.toLowerCase().includes(search) || (w.skills || []).some(s => s.toLowerCase().includes(search))
    );
    tbody.innerHTML = filtered.map(w => `
      <tr class="${w.flagged ? 'flagged-row' : ''}">
        <td>${w._id.slice(-6)}</td>
        <td><strong>${w.name}</strong></td>
        <td>${w.phone}</td>
        <td>${(w.skills || []).map(s => `<span class="skill-tag">${s}</span>`).join('')}</td>
        <td>${w.experience} yrs</td>
        <td>⭐ ${(w.rating || 0).toFixed(1)}</td>
        <td>${w.trustScore}</td>
        <td><span class="status-badge ${w.availability ? 'status-active' : 'status-inactive'}">${w.availability ? '● Yes' : '○ No'}</span></td>
        <td><span class="status-badge ${w.flagged ? 'status-flagged' : 'status-active'}">${w.flagged ? '🚩 Flagged' : '✓ Clear'}</span></td>
        <td>${w.flagged
        ? `<button class="btn-unflag" onclick="adminToggleFlag('${w._id}', false)">✓ Unflag</button>`
        : `<button class="btn-flag"   onclick="adminToggleFlag('${w._id}', true)">🚩 Flag</button>`
      }</td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="10" style="color:var(--gov-red);text-align:center">⚠ ${e.message}</td></tr>`;
  }
}

async function adminToggleFlag(id, flag) {
  try {
    await apiFetch(`/workers/${id}/flag`, { method: 'PATCH' });
    renderAdmin();
  } catch (e) {
    alert(`⚠ ${e.message}`);
  }
}

/* ============================================================
   ADMIN: REGISTRY
   ============================================================ */
let registryFilter = 'all';
function setRegistryFilter(filter, btn) {
  registryFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderRegistry();
}

async function renderRegistry() {
  const tbody = document.getElementById('registry-tbody');
  const empty = document.getElementById('registry-empty');
  const search = (document.getElementById('registry-search')?.value || '').toLowerCase();
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted)">Loading…</td></tr>';

  try {
    const workers = await apiFetch('/workers');

    document.getElementById('reg-stat-total').textContent = workers.length;
    document.getElementById('reg-stat-avail').textContent = workers.filter(w => w.availability && !w.flagged).length;
    document.getElementById('reg-stat-flagged').textContent = workers.filter(w => w.flagged).length;

    const filtered = workers.filter(w => {
      const matchSearch = !search || w.name.toLowerCase().includes(search) || (w.skills || []).some(s => s.toLowerCase().includes(search));
      const matchFilter = registryFilter === 'all'
        || (registryFilter === 'available' && w.availability && !w.flagged)
        || (registryFilter === 'flagged' && w.flagged);
      return matchSearch && matchFilter;
    });

    if (filtered.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    tbody.innerHTML = filtered.map((w, i) => `
      <tr class="${w.flagged ? 'flagged-row' : ''}">
        <td>${i + 1}</td>
        <td><strong>${w.name}</strong></td>
        <td>${w.phone}</td>
        <td>${(w.skills || []).map(s => `<span class="skill-tag">${s}</span>`).join('')}</td>
        <td>${w.experience} yrs</td>
        <td>⭐ ${(w.rating || 0).toFixed(1)}</td>
        <td>${w.trustScore}</td>
        <td>${w.location}</td>
        <td><span class="status-badge ${w.availability ? 'status-active' : 'status-inactive'}">${w.availability ? '● Yes' : '○ No'}</span></td>
        <td><span class="status-badge ${w.flagged ? 'status-flagged' : 'status-active'}">${w.flagged ? '🚩 Flagged' : '✓ Clear'}</span></td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="10" style="color:var(--gov-red);text-align:center">⚠ ${e.message}</td></tr>`;
  }
}

/* ============================================================
   ADMIN: ACTIVITY LOG
   ============================================================ */
async function renderActivityLog() {
  const logEl = document.getElementById('agent-log');
  if (!logEl) return;
  logEl.innerHTML = '<p class="empty-msg">Loading…</p>';

  try {
    const logs = await apiFetch('/agents/logs');
    if (logs.length === 0) { logEl.innerHTML = '<p class="empty-msg">No agent activity yet.</p>'; return; }
    logEl.innerHTML = logs.map(entry => `
      <div class="agent-log-entry">
        <span class="agent-log-icon">${entry.icon}</span>
        <div class="agent-log-body">
          <div class="agent-log-title">${entry.agent}: ${entry.title}</div>
          <div class="agent-log-detail">${entry.detail}</div>
        </div>
        <span class="agent-log-time">${new Date(entry.createdAt).toLocaleString()}</span>
      </div>`).join('');
  } catch (e) {
    logEl.innerHTML = `<p class="empty-msg" style="color:var(--gov-red)">⚠ ${e.message}</p>`;
  }
}

/* ============================================================
   UTILITIES
   ============================================================ */
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function setLoading(btn, loadText, resetText) {
  if (!btn) return;
  if (loadText) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = `<span class="spinner"></span> ${loadText}`;
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = resetText;
  }
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Availability toggle label
  const availToggle = document.getElementById('wp-availability');
  const availLabel = document.getElementById('avail-label');
  if (availToggle) {
    availToggle.addEventListener('change', () => {
      availLabel.textContent = availToggle.checked ? 'Available' : 'Unavailable';
    });
  }

  // Allow Enter key on login
  document.getElementById('login-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  // Resume session if token + user exist
  const token = getToken();
  const savedUser = getSavedUser();
  if (token && savedUser) {
    // Verify token is still valid before restoring session
    apiFetch('/auth/me')
      .then(user => startSession({ ...savedUser, ...user }))
      .catch(() => { clearToken(); clearUser(); });
  }
});
