// City Metro Transit - Shared JS
const API = 'https://city-metro-bus-api.felixfeger46.workers.dev';

// ── AUTH ──────────────────────────────────────────────────────
const Auth = {
  getToken() { return localStorage.getItem('cm_token'); },
  getUser() {
    try { return JSON.parse(localStorage.getItem('cm_user')); } catch { return null; }
  },
  setSession(token, user) {
    localStorage.setItem('cm_token', token);
    localStorage.setItem('cm_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('cm_token');
    localStorage.removeItem('cm_user');
  },
  isLoggedIn() { return !!this.getToken(); }
};

// ── API HELPERS ───────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(API + path, { ...opts, headers });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg, duration = 2500) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

// ── NAV MENU ─────────────────────────────────────────────────
function toggleMenu() {
  document.getElementById('navDrawer')?.classList.toggle('open');
}
document.addEventListener('click', e => {
  const drawer = document.getElementById('navDrawer');
  if (drawer && !e.target.closest('.navbar') && !e.target.closest('.nav-drawer')) {
    drawer.classList.remove('open');
  }
});

// ── LOGIN POPUP ───────────────────────────────────────────────
function toggleLogin() {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  overlay.classList.toggle('open');
  if (overlay.classList.contains('open')) renderLoginState();
}

function renderLoginState() {
  const user = Auth.getUser();
  const loginForm = document.getElementById('loginForm');
  const userView = document.getElementById('userView');
  if (!loginForm || !userView) return;
  if (user) {
    loginForm.classList.add('hidden');
    userView.classList.remove('hidden');
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userEmail').textContent = user.email;
    loadSavedJourneys();
  } else {
    loginForm.classList.remove('hidden');
    userView.classList.add('hidden');
  }
}

async function loadSavedJourneys() {
  const list = document.getElementById('savedList');
  if (!list) return;
  list.innerHTML = '<div class="spinner" style="margin:.5rem auto"></div>';
  try {
    const journeys = await apiFetch('/api/journeys');
    if (!journeys.length) {
      list.innerHTML = '<p style="font-size:.8rem;color:var(--gray);padding:.5rem 0">No saved journeys yet.</p>';
      return;
    }
    list.innerHTML = journeys.map(j => `
      <div class="saved-item" onclick="loadJourney(${JSON.stringify(j).replace(/"/g,'&quot;')})">
        <div class="saved-icon">🚌</div>
        <div>
          <div class="saved-name">${j.name}</div>
          <div class="saved-sub">${j.from_name} → ${j.to_name}</div>
        </div>
        <button onclick="event.stopPropagation();deleteJourney(${j.id})" style="margin-left:auto;background:none;border:none;color:var(--gray);font-size:1rem;padding:.25rem">×</button>
      </div>
    `).join('');
  } catch { list.innerHTML = '<p style="font-size:.8rem;color:var(--gray)">Failed to load.</p>'; }
}

async function deleteJourney(id) {
  try {
    await apiFetch(`/api/journeys/${id}`, { method: 'DELETE' });
    loadSavedJourneys();
    toast('Journey removed');
  } catch(e) { toast(e.message); }
}

function loadJourney(j) {
  document.getElementById('loginOverlay')?.classList.remove('open');
  // Dispatch event for planner page to pick up
  window.dispatchEvent(new CustomEvent('loadJourney', { detail: j }));
  if (!window.location.pathname.includes('planner')) {
    sessionStorage.setItem('pendingJourney', JSON.stringify(j));
    window.location.href = 'planner.html';
  }
}

// Auth form handling
function initLoginForms() {
  let mode = 'login';

  document.getElementById('tabLogin')?.addEventListener('click', () => {
    mode = 'login';
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabSignup').classList.remove('active');
    document.getElementById('nameField')?.classList.add('hidden');
    document.getElementById('authBtn').textContent = 'Sign in';
    document.getElementById('loginError').textContent = '';
  });

  document.getElementById('tabSignup')?.addEventListener('click', () => {
    mode = 'signup';
    document.getElementById('tabSignup').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('nameField')?.classList.remove('hidden');
    document.getElementById('authBtn').textContent = 'Create account';
    document.getElementById('loginError').textContent = '';
  });

  document.getElementById('authBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    if (!email || !password) { errEl.textContent = 'Please fill all fields.'; return; }
    const btn = document.getElementById('authBtn');
    btn.textContent = '...'; btn.disabled = true;
    try {
      let data;
      if (mode === 'signup') {
        const name = document.getElementById('authName').value.trim();
        if (!name) { errEl.textContent = 'Name required.'; btn.textContent = 'Create account'; btn.disabled = false; return; }
        data = await apiFetch('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, name, password }) });
      } else {
        data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      }
      Auth.setSession(data.token, data.user);
      renderLoginState();
      toast(`Welcome, ${data.user.name}!`);
    } catch(e) {
      errEl.textContent = e.message;
    } finally {
      btn.textContent = mode === 'login' ? 'Sign in' : 'Create account';
      btn.disabled = false;
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    Auth.clear();
    renderLoginState();
    toast('Signed out');
  });

  document.getElementById('loginOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('loginOverlay').classList.remove('open');
  });
}

// Set active nav link
function setActiveNav(page) {
  document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page + '.html' || a.getAttribute('href') === page);
  });
}

// Distance helper (km)
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function walkMinutes(km) { return Math.max(1, Math.round(km / 0.083)); } // ~5km/h

// Minutes until time string "HH:MM"
function minsUntil(timeStr) {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const then = new Date(now); then.setHours(h, m, 0);
  if (then < now) then.setDate(then.getDate() + 1);
  return Math.round((then - now) / 60000);
}

// ETA from speed (km/h) and distance (km)
function etaFromSpeed(distKm, speedKmh) {
  if (!speedKmh || speedKmh < 1) return null;
  return Math.round((distKm / speedKmh) * 60);
}
