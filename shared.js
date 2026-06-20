// City Metro Transit - Shared JS
const API = 'https://city-metro-bus-api.felixfeger46.workers.dev';

// ── AUTH ──────────────────────────────────────────────────────
const Auth = {
  getToken() { return localStorage.getItem('cm_token'); },
  getUser() { try { return JSON.parse(localStorage.getItem('cm_user')); } catch { return null; } },
  setSession(token, user) {
    localStorage.setItem('cm_token', token);
    localStorage.setItem('cm_user', JSON.stringify(user));
  },
  clear() { localStorage.removeItem('cm_token'); localStorage.removeItem('cm_user'); },
  isLoggedIn() { return !!this.getToken(); }
};

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(API + path, { ...opts, headers });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg, duration = 2500) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

function toggleMenu() { document.getElementById('navDrawer')?.classList.toggle('open'); }
document.addEventListener('click', e => {
  const drawer = document.getElementById('navDrawer');
  if (drawer && !e.target.closest('.navbar') && !e.target.closest('.nav-drawer')) drawer.classList.remove('open');
});

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
    loginForm.classList.add('hidden'); userView.classList.remove('hidden');
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userEmail').textContent = user.email;
    loadSavedJourneys();
  } else {
    loginForm.classList.remove('hidden'); userView.classList.add('hidden');
  }
}

async function loadSavedJourneys() {
  const list = document.getElementById('savedList');
  if (!list) return;
  list.innerHTML = '<div class="spinner" style="margin:.5rem auto"></div>';
  try {
    const journeys = await apiFetch('/api/journeys');
    if (!journeys.length) { list.innerHTML = '<p style="font-size:.8rem;color:var(--gray);padding:.5rem 0">No saved journeys yet.</p>'; return; }
    list.innerHTML = journeys.map(j => `
      <div class="saved-item" onclick='loadJourney(${JSON.stringify({id:j.id, from_station_id:j.from_station_id, to_station_id:j.to_station_id, from_name:j.from_name, to_name:j.to_name, name:j.name})})'>
        <div class="saved-icon">🚌</div>
        <div><div class="saved-name">${j.name}</div><div class="saved-sub">${j.from_name} → ${j.to_name}</div></div>
        <button onclick="event.stopPropagation();deleteJourney(${j.id})" style="margin-left:auto;background:none;border:none;color:var(--gray);font-size:1rem;padding:.25rem">×</button>
      </div>
    `).join('');
  } catch { list.innerHTML = '<p style="font-size:.8rem;color:var(--gray)">Failed to load.</p>'; }
}

async function deleteJourney(id) {
  try { await apiFetch(`/api/journeys/${id}`, { method:'DELETE' }); loadSavedJourneys(); toast('Journey removed'); }
  catch(e) { toast(e.message); }
}

function loadJourney(j) {
  document.getElementById('loginOverlay')?.classList.remove('open');
  if (window.location.pathname.includes('planner')) {
    window.dispatchEvent(new CustomEvent('loadJourney', { detail: j }));
  } else {
    sessionStorage.setItem('pendingJourney', JSON.stringify(j));
    window.location.href = 'planner.html';
  }
}

function initLoginForms() {
  let mode = 'login';
  document.getElementById('tabLogin')?.addEventListener('click', () => {
    mode='login';
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabSignup').classList.remove('active');
    document.getElementById('nameField')?.classList.add('hidden');
    document.getElementById('authBtn').textContent='Sign in';
    document.getElementById('loginError').textContent='';
  });
  document.getElementById('tabSignup')?.addEventListener('click', () => {
    mode='signup';
    document.getElementById('tabSignup').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('nameField')?.classList.remove('hidden');
    document.getElementById('authBtn').textContent='Create account';
    document.getElementById('loginError').textContent='';
  });
  document.getElementById('authBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.textContent='';
    if (!email||!password) { errEl.textContent='Please fill all fields.'; return; }
    const btn = document.getElementById('authBtn');
    btn.textContent='...'; btn.disabled=true;
    try {
      let data;
      if (mode==='signup') {
        const name = document.getElementById('authName').value.trim();
        if (!name) { errEl.textContent='Name required.'; btn.textContent='Create account'; btn.disabled=false; return; }
        data = await apiFetch('/api/auth/signup',{method:'POST',body:JSON.stringify({email,name,password})});
      } else {
        data = await apiFetch('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});
      }
      Auth.setSession(data.token,data.user);
      renderLoginState();
      toast(`Welcome, ${data.user.name}!`);
    } catch(e) { errEl.textContent=e.message; }
    finally { btn.textContent = mode==='login'?'Sign in':'Create account'; btn.disabled=false; }
  });
  document.getElementById('logoutBtn')?.addEventListener('click', () => { Auth.clear(); renderLoginState(); toast('Signed out'); });
  document.getElementById('loginOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('loginOverlay').classList.remove('open');
  });
}

function setActiveNav(page) {
  document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page + '.html');
  });
}

function fmtSeconds(s) {
  const m = Math.round(s/60);
  return m < 1 ? '<1 min' : `${m} min`;
}

// ═══════════════════════════════════════════════════════════════
// CANVAS ENGINE — pan/zoom/draw on a blank canvas (no map tiles)
// ═══════════════════════════════════════════════════════════════
class CanvasEngine {
  constructor(wrapId, canvasId, opts = {}) {
    this.wrap = document.getElementById(wrapId);
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.scale = opts.scale || 1;
    this.minScale = opts.minScale || 0.2;
    this.maxScale = opts.maxScale || 4;
    this.offsetX = opts.offsetX || 0;
    this.offsetY = opts.offsetY || 0;
    this.worldW = opts.worldW || 3000;
    this.worldH = opts.worldH || 3000;
    this.gridSize = opts.gridSize || 100;
    this.drawFn = opts.onDraw || (()=>{});
    this.onClick = opts.onClick || null;
    this.onDrag = opts.onDrag || null; // for dragging stations
    this.disablePan = false;

    this._isPanning = false;
    this._panStart = {x:0,y:0};
    this._offsetStart = {x:0,y:0};
    this._lastTouchDist = null;
    this._dragTarget = null;

    this._bindEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.wrap.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.viewW = rect.width; this.viewH = rect.height;
    this.render();
  }

  // Convert screen coords -> world (canvas-space) coords
  screenToWorld(sx, sy) {
    const rect = this.wrap.getBoundingClientRect();
    const x = (sx - rect.left - this.offsetX) / this.scale;
    const y = (sy - rect.top - this.offsetY) / this.scale;
    return { x, y };
  }

  worldToScreen(wx, wy) {
    return { x: wx*this.scale + this.offsetX, y: wy*this.scale + this.offsetY };
  }

  centerOn(wx, wy, scale) {
    if (scale) this.scale = Math.max(this.minScale, Math.min(this.maxScale, scale));
    this.offsetX = this.viewW/2 - wx*this.scale;
    this.offsetY = this.viewH/2 - wy*this.scale;
    this.render();
  }

  fitToContent(points, padding=80) {
    if (!points.length) { this.centerOn(this.worldW/2, this.worldH/2, 1); return; }
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    points.forEach(([x,y]) => { minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y); });
    const w = Math.max(50, maxX-minX), h = Math.max(50, maxY-minY);
    const scale = Math.min((this.viewW-padding*2)/w, (this.viewH-padding*2)/h, this.maxScale);
    this.centerOn((minX+maxX)/2, (minY+maxY)/2, Math.max(this.minScale,scale));
  }

  zoomBy(factor, cx, cy) {
    cx = cx ?? this.viewW/2; cy = cy ?? this.viewH/2;
    const before = this.screenToWorldView(cx,cy);
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale*factor));
    const after = this.screenToWorldView(cx,cy);
    this.offsetX += (after.x-before.x)*this.scale;
    this.offsetY += (after.y-before.y)*this.scale;
    this.render();
  }

  screenToWorldView(sx, sy) {
    return { x:(sx-this.offsetX)/this.scale, y:(sy-this.offsetY)/this.scale };
  }

  _bindEvents() {
    const wrap = this.wrap;

    // Mouse pan
    wrap.addEventListener('mousedown', e => {
      if (this.disablePan) return;
      if (e.target.closest('[data-no-pan]')) return;
      this._isPanning = true;
      wrap.classList.add('panning');
      this._panStart = { x: e.clientX, y: e.clientY };
      this._offsetStart = { x: this.offsetX, y: this.offsetY };
      this._moved = false;
    });
    window.addEventListener('mousemove', e => {
      if (!this._isPanning) return;
      const dx = e.clientX - this._panStart.x, dy = e.clientY - this._panStart.y;
      if (Math.abs(dx)>3||Math.abs(dy)>3) this._moved = true;
      this.offsetX = this._offsetStart.x + dx;
      this.offsetY = this._offsetStart.y + dy;
      this.render();
    });
    window.addEventListener('mouseup', e => {
      if (this._isPanning && !this._moved && this.onClick) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        this.onClick(w.x, w.y, e);
      }
      this._isPanning = false;
      wrap.classList.remove('panning');
    });

    // Wheel zoom
    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomBy(factor, e.clientX-rect.left, e.clientY-rect.top);
    }, { passive:false });

    // Touch pan/pinch
    wrap.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this._isPanning = true;
        this._panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this._offsetStart = { x: this.offsetX, y: this.offsetY };
        this._moved = false;
      } else if (e.touches.length === 2) {
        this._isPanning = false;
        this._lastTouchDist = this._touchDist(e.touches);
      }
    }, { passive:true });

    wrap.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && this._isPanning) {
        const dx = e.touches[0].clientX - this._panStart.x, dy = e.touches[0].clientY - this._panStart.y;
        if (Math.abs(dx)>3||Math.abs(dy)>3) this._moved = true;
        this.offsetX = this._offsetStart.x + dx;
        this.offsetY = this._offsetStart.y + dy;
        this.render();
      } else if (e.touches.length === 2) {
        const dist = this._touchDist(e.touches);
        const rect = wrap.getBoundingClientRect();
        const cx = (e.touches[0].clientX+e.touches[1].clientX)/2 - rect.left;
        const cy = (e.touches[0].clientY+e.touches[1].clientY)/2 - rect.top;
        if (this._lastTouchDist) this.zoomBy(dist/this._lastTouchDist, cx, cy);
        this._lastTouchDist = dist;
      }
    }, { passive:true });

    wrap.addEventListener('touchend', e => {
      if (this._isPanning && !this._moved && this.onClick && e.changedTouches.length) {
        const t = e.changedTouches[0];
        const w = this.screenToWorld(t.clientX, t.clientY);
        this.onClick(w.x, w.y, e);
      }
      this._isPanning = false;
      this._lastTouchDist = null;
    });
  }

  _touchDist(touches) {
    const dx = touches[0].clientX-touches[1].clientX, dy = touches[0].clientY-touches[1].clientY;
    return Math.hypot(dx,dy);
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    ctx.clearRect(0,0,this.viewW,this.viewH);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg') || '#F3F4F6';
    ctx.fillRect(0,0,this.viewW,this.viewH);

    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    this._drawGrid(ctx);
    this.drawFn(ctx, this);

    ctx.restore();
  }

  _drawGrid(ctx) {
    const gs = this.gridSize;
    const startX = Math.floor(-this.offsetX/this.scale/gs)*gs - gs;
    const startY = Math.floor(-this.offsetY/this.scale/gs)*gs - gs;
    const endX = startX + (this.viewW/this.scale) + gs*2;
    const endY = startY + (this.viewH/this.scale) + gs*2;

    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1/this.scale;
    ctx.beginPath();
    for (let x=startX; x<endX; x+=gs) { ctx.moveTo(x,startY); ctx.lineTo(x,endY); }
    for (let y=startY; y<endY; y+=gs) { ctx.moveTo(startX,y); ctx.lineTo(endX,y); }
    ctx.stroke();
  }

  // Hit test: find nearest point within radius (world units)
  hitTestPoint(wx, wy, points, radiusWorld) {
    let best = null, bestDist = Infinity;
    for (const p of points) {
      const d = Math.hypot(p.x-wx, p.y-wy);
      if (d < radiusWorld && d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }
}

// Distance along a polyline path (world units)
function polylineLength(points) {
  let total = 0;
  for (let i=1;i<points.length;i++) total += Math.hypot(points[i][0]-points[i-1][0], points[i][1]-points[i-1][1]);
  return total;
}

// Get point at fraction along a polyline (0-1), used for vehicle ETA animation
function pointAtFraction(points, frac) {
  const total = polylineLength(points);
  let target = total * frac, acc = 0;
  for (let i=1;i<points.length;i++) {
    const segLen = Math.hypot(points[i][0]-points[i-1][0], points[i][1]-points[i-1][1]);
    if (acc+segLen >= target) {
      const t = segLen ? (target-acc)/segLen : 0;
      return [points[i-1][0]+(points[i][0]-points[i-1][0])*t, points[i-1][1]+(points[i][1]-points[i-1][1])*t];
    }
    acc += segLen;
  }
  return points[points.length-1];
}