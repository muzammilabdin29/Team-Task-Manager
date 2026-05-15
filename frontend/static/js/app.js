// ── API CLIENT ──────────────────────────────────────────────────────────────
const BASE_URL = '/api';

const api = {
  token: () => localStorage.getItem('token'),

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token()) h['Authorization'] = `Bearer ${this.token()}`;
    return h;
  },

  async request(method, path, body = null) {
    const opts = { method, headers: this.headers() };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(BASE_URL + path, opts);

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.app?.showAuth();
      return null;
    }

    if (res.status === 204) return null;

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    return data;
  },

  get:    (path)        => api.request('GET',    path),
  post:   (path, body)  => api.request('POST',   path, body),
  put:    (path, body)  => api.request('PUT',    path, body),
  delete: (path)        => api.request('DELETE', path),

  // Auth
  signup: (data) => api.post('/auth/register', data),
  verifyOtp: (data) => api.post('/auth/verify-otp', data),
  resendOtp: (data) => api.post('/auth/resend-otp', data),
  login:  (data) => api.post('/auth/login',  data),
  me:     ()     => api.get('/auth/me'),

  // Projects
  getProjects:   ()          => api.get('/projects'),
  getProject:    (id)        => api.get(`/projects/${id}`),
  createProject: (data)      => api.post('/projects', data),
  updateProject: (id, data)  => api.put(`/projects/${id}`, data),
  deleteProject: (id)        => api.delete(`/projects/${id}`),
  addMember:     (pid, data) => api.post(`/projects/${pid}/members`, data),
  removeMember:  (pid, uid)  => api.delete(`/projects/${pid}/members/${uid}`),

  // Tasks
  getTasks:    (pid, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/projects/${pid}/tasks${q ? '?' + q : ''}`);
  },
  createTask:  (pid, data)  => api.post(`/projects/${pid}/tasks`, data),
  updateTask:  (pid, tid, data) => api.put(`/projects/${pid}/tasks/${tid}`, data),
  deleteTask:  (pid, tid)   => api.delete(`/projects/${pid}/tasks/${tid}`),

  // Users
  getUsers:  () => api.get('/users'),
  getDashboardStats: () => api.get('/users/dashboard/stats'),
};


// ── STATE ────────────────────────────────────────────────────────────────────
const state = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  projects: [],
  currentProject: null,
  tasks: [],
  users: [],
  currentPage: 'dashboard',
};


// ── UTILS ────────────────────────────────────────────────────────────────────
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function el(tag, cls = '', inner = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (inner) e.innerHTML = inner;
  return e;
}

function avatar(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(due, status) {
  if (!due || status === 'done') return false;
  return new Date(due) < new Date();
}

function statusBadge(s) {
  const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  return `<span class="badge badge-${s}">${labels[s] || s}</span>`;
}

function priorityBadge(p) {
  return `<span class="badge badge-${p}">● ${p}</span>`;
}

function showAlert(msg, type = 'error', container = null) {
  const div = el('div', `alert alert-${type}`, msg);
  const target = container || $('#alert-container');
  if (target) {
    target.innerHTML = '';
    target.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }
}


// ── MODAL ────────────────────────────────────────────────────────────────────
function openModal(title, bodyHTML, onSubmit, submitLabel = 'Save') {
  const overlay = el('div', 'modal-overlay');
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close" id="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div id="modal-alert"></div>
        ${bodyHTML}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" id="cancel-modal">Cancel</button>
        <button class="btn btn-primary btn-sm" id="submit-modal" style="width:auto">${submitLabel}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#close-modal').onclick = close;
  overlay.querySelector('#cancel-modal').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  overlay.querySelector('#submit-modal').onclick = async () => {
    const btn = overlay.querySelector('#submit-modal');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await onSubmit(overlay, close);
    } catch (e) {
      showAlert(e.message, 'error', overlay.querySelector('#modal-alert'));
      btn.disabled = false;
      btn.textContent = submitLabel;
    }
  };

  return overlay;
}


// ── AUTH ─────────────────────────────────────────────────────────────────────
function renderAuth() {
  document.body.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="logo-icon">✦</div>
          <h1>TaskFlow</h1>
          <p>Team project & task management</p>
        </div>
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Sign In</button>
          <button class="auth-tab" data-tab="signup">Create Account</button>
        </div>
        <div id="auth-alert"></div>
        <div id="auth-form-container"></div>
      </div>
    </div>`;

  renderLoginForm();

  $$('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      $$('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tab.dataset.tab === 'login' ? renderLoginForm() : renderSignupForm();
    };
  });
}

function renderLoginForm() {
  $('#auth-form-container').innerHTML = `
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="email" placeholder="you@example.com" autocomplete="email">
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" id="password" placeholder="••••••••" autocomplete="current-password">
    </div>
    <button class="btn btn-primary" id="auth-submit">Sign In →</button>`;

  $('#auth-submit').onclick = handleLogin;
  $('#password').onkeydown = (e) => { if (e.key === 'Enter') handleLogin(); };
}

function renderSignupForm() {
  $('#auth-form-container').innerHTML = `
    <div id="signup-step-1">
      <div class="form-group">
        <label>Full Name</label>
        <input type="text" id="name" placeholder="Jane Smith">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="email" placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="password" placeholder="Min. 6 characters">
      </div>
      <div class="form-group">
        <label>Role</label>
        <select id="role">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button class="btn btn-primary" id="auth-submit">Create Account →</button>
    </div>
    <div id="signup-step-2" style="display:none">
      <div class="alert alert-success" style="margin-bottom:16px">
        OTP sent to your email! Please enter it below.
      </div>
      <div class="form-group">
        <label>Enter 6-digit OTP</label>
        <input type="text" id="otp-code" placeholder="123456" maxlength="6" style="letter-spacing:4px;font-size:20px;text-align:center">
      </div>
      <button class="btn btn-primary" id="verify-submit">Verify & Login →</button>
      <div style="margin-top:16px;text-align:center;font-size:13px">
        <button id="resend-otp-btn" class="btn btn-ghost btn-sm">Resend OTP</button>
        <span id="resend-timer" style="color:var(--text-muted);display:none"></span>
      </div>
    </div>`;

  $('#auth-submit').onclick = handleSignup;
}

async function handleLogin() {
  const btn = $('#auth-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in…';
  try {
    const data = await api.login({ email: $('#email').value, password: $('#password').value });
    if (data) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      state.user = data.user;
      renderApp();
    }
  } catch (e) {
    showAlert(e.message, 'error', $('#auth-alert'));
    btn.disabled = false;
    btn.textContent = 'Sign In →';
  }
}

async function handleSignup() {
  const btn = $('#auth-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating account…';
  try {
    const email = $('#email').value;
    const data = await api.signup({
      name: $('#name').value,
      email: email,
      password: $('#password').value,
      role: $('#role').value,
    });
    
    // Switch to step 2 (OTP verification)
    $('#signup-step-1').style.display = 'none';
    $('#signup-step-2').style.display = 'block';
    
    $('#verify-submit').onclick = () => handleVerifyOtp(email);
    $('#resend-otp-btn').onclick = () => handleResendOtp(email);
    startResendTimer();
  } catch (e) {
    showAlert(e.message, 'error', $('#auth-alert'));
    btn.disabled = false;
    btn.textContent = 'Create Account →';
  }
}

async function handleVerifyOtp(email) {
  const btn = $('#verify-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Verifying…';
  try {
    const data = await api.verifyOtp({
      email: email,
      otp_code: $('#otp-code').value,
    });
    if (data) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      state.user = data.user;
      renderApp();
    }
  } catch (e) {
    showAlert(e.message, 'error', $('#auth-alert'));
    btn.disabled = false;
    btn.textContent = 'Verify & Login →';
  }
}

let resendInterval;
function startResendTimer() {
  let timeLeft = 30;
  const btn = $('#resend-otp-btn');
  const timer = $('#resend-timer');
  
  btn.style.display = 'none';
  timer.style.display = 'inline-block';
  timer.textContent = `Wait ${timeLeft}s to resend`;
  
  clearInterval(resendInterval);
  resendInterval = setInterval(() => {
    timeLeft--;
    timer.textContent = `Wait ${timeLeft}s to resend`;
    if (timeLeft <= 0) {
      clearInterval(resendInterval);
      btn.style.display = 'inline-block';
      timer.style.display = 'none';
    }
  }, 1000);
}

async function handleResendOtp(email) {
  const btn = $('#resend-otp-btn');
  btn.disabled = true;
  btn.textContent = 'Resending...';
  try {
    await api.resendOtp({ email: email });
    showAlert('A new OTP has been sent!', 'success', $('#auth-alert'));
    startResendTimer();
  } catch (e) {
    showAlert(e.message, 'error', $('#auth-alert'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Resend OTP';
  }
}


// ── APP SHELL ─────────────────────────────────────────────────────────────────
function renderApp() {
  document.body.innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <div class="logo-mark">✦</div>
          <span>TaskFlow</span>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section-label">Workspace</div>
          <button class="nav-item active" data-page="dashboard">
            <span class="nav-icon">⬛</span> Dashboard
          </button>
          <button class="nav-item" data-page="projects">
            <span class="nav-icon">📁</span> Projects
          </button>
          <button class="nav-item" data-page="my-tasks">
            <span class="nav-icon">✅</span> My Tasks
          </button>
          ${state.user?.role === 'admin' ? `
          <div class="nav-section-label" style="margin-top:8px">Admin</div>
          <button class="nav-item" data-page="users">
            <span class="nav-icon">👥</span> All Users
          </button>` : ''}
        </nav>
        <div class="sidebar-user">
          <div class="user-avatar">${avatar(state.user?.name)}</div>
          <div class="user-info">
            <div class="user-name">${state.user?.name}</div>
            <div class="user-role">${state.user?.role}</div>
          </div>
          <button class="logout-btn" id="logout-btn" title="Sign out">⎋</button>
        </div>
      </aside>
      <main class="main">
        <div id="alert-container"></div>
        <div id="page-content"></div>
      </main>
    </div>`;

  $$('[data-page]').forEach(btn => {
    btn.onclick = () => navigateTo(btn.dataset.page);
  });

  $('#logout-btn').onclick = () => {
    localStorage.clear();
    state.user = null;
    renderAuth();
  };

  navigateTo('dashboard');
}

function setActivePage(page) {
  $$('[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  state.currentPage = page;
}

async function navigateTo(page, params = {}) {
  setActivePage(page);
  const content = $('#page-content');
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div><p>Loading…</p></div>';

  try {
    if (page === 'dashboard')        await renderDashboard();
    else if (page === 'projects')    await renderProjects();
    else if (page === 'project')     await renderProject(params.id);
    else if (page === 'my-tasks')    await renderMyTasks();
    else if (page === 'users')       await renderUsers();
  } catch (e) {
    content.innerHTML = `<div class="content"><div class="alert alert-error">Error: ${e.message}</div></div>`;
  }
}


// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const stats = await api.getDashboardStats();
  const projects = await api.getProjects();
  state.projects = projects || [];

  $('#page-content').innerHTML = `
    <div class="topbar">
      <div>
        <div class="topbar-title">Dashboard</div>
        <div style="font-size:12px;color:var(--text-muted)">Welcome back, ${state.user?.name} 👋</div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-primary btn-sm" id="new-project-btn">+ New Project</button>
      </div>
    </div>
    <div class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📁</div>
          <div class="stat-label">Projects</div>
          <div class="stat-value">${stats?.total_projects ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-label">Total Tasks</div>
          <div class="stat-value">${stats?.total_tasks ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚡</div>
          <div class="stat-label">In Progress</div>
          <div class="stat-value">${stats?.tasks_in_progress ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Completed</div>
          <div class="stat-value">${stats?.tasks_done ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔴</div>
          <div class="stat-label">Overdue</div>
          <div class="stat-value" style="color:var(--danger)">${stats?.overdue_tasks ?? 0}</div>
        </div>
        ${stats?.total_users != null ? `
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-label">Users</div>
          <div class="stat-value">${stats.total_users}</div>
        </div>` : ''}
      </div>

      <div class="section-card">
        <div class="section-card-header">
          Recent Projects
          <button class="btn btn-ghost btn-sm" onclick="navigateTo('projects')">View All →</button>
        </div>
        <div class="section-card-body">
          ${state.projects.length === 0
            ? '<div class="empty-state"><div class="empty-icon">📁</div><p>No projects yet. Create your first one!</p></div>'
            : `<div class="projects-grid">${state.projects.slice(0, 6).map(projectCard).join('')}</div>`
          }
        </div>
      </div>
    </div>`;

  $('#new-project-btn')?.addEventListener('click', openCreateProjectModal);
  $$('.project-card').forEach(card => {
    card.addEventListener('click', () => navigateTo('project', { id: card.dataset.id }));
  });
}


// ── PROJECTS ──────────────────────────────────────────────────────────────────
function projectCard(p) {
  return `
    <div class="project-card" data-id="${p.id}">
      <div class="project-card-header">
        <div class="project-name">${p.name}</div>
        <span class="badge badge-member">${p.task_count ?? 0} tasks</span>
      </div>
      <div class="project-desc">${p.description || '<em style="opacity:.5">No description</em>'}</div>
      <div class="project-meta">
        <span class="project-owner">
          <span style="width:20px;height:20px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white">${avatar(p.owner?.name)}</span>
          ${p.owner?.name}
        </span>
        <span>👥 ${p.members?.length ?? 0} members</span>
      </div>
    </div>`;
}

async function renderProjects() {
  const projects = await api.getProjects();
  state.projects = projects || [];

  $('#page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Projects</div>
      <div class="topbar-actions">
        <button class="btn btn-primary btn-sm" id="new-project-btn">+ New Project</button>
      </div>
    </div>
    <div class="content">
      ${state.projects.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📁</div><p>No projects yet.</p><button class="btn btn-primary btn-sm" id="create-first">Create Your First Project</button></div>'
        : `<div class="projects-grid">${state.projects.map(projectCard).join('')}</div>`
      }
    </div>`;

  $('#new-project-btn')?.addEventListener('click', openCreateProjectModal);
  $('#create-first')?.addEventListener('click', openCreateProjectModal);
  $$('.project-card').forEach(card => {
    card.addEventListener('click', () => navigateTo('project', { id: card.dataset.id }));
  });
}

function openCreateProjectModal() {
  openModal('Create New Project', `
    <div class="form-group">
      <label>Project Name *</label>
      <input type="text" id="proj-name" placeholder="e.g. Website Redesign">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="proj-desc" placeholder="What is this project about?"></textarea>
    </div>`, async (modal, close) => {
    const name = modal.querySelector('#proj-name').value.trim();
    if (!name) throw new Error('Project name is required');
    await api.createProject({ name, description: modal.querySelector('#proj-desc').value });
    close();
    navigateTo(state.currentPage);
  }, 'Create Project');
}


// ── PROJECT DETAIL ────────────────────────────────────────────────────────────
async function renderProject(projectId) {
  const [project, tasks, users] = await Promise.all([
    api.getProject(projectId),
    api.getTasks(projectId),
    api.getUsers(),
  ]);
  state.currentProject = project;
  state.tasks = tasks || [];
  state.users = users || [];

  const isOwnerOrAdmin = state.user?.role === 'admin' || project.owner_id === state.user?.id;

  $('#page-content').innerHTML = `
    <div class="topbar">
      <div>
        <div class="breadcrumb">
          <a href="#" onclick="navigateTo('projects');return false">Projects</a>
          <span>›</span>
          <span>${project.name}</span>
        </div>
        <div class="topbar-title">${project.name}</div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-primary btn-sm" id="new-task-btn">+ New Task</button>
        ${isOwnerOrAdmin ? `<button class="btn btn-ghost btn-sm" id="edit-project-btn">Edit</button>` : ''}
        ${isOwnerOrAdmin ? `<button class="btn btn-icon btn-sm" id="delete-project-btn" title="Delete project">🗑</button>` : ''}
      </div>
    </div>
    <div class="content">
      <div style="display:grid;grid-template-columns:1fr 280px;gap:20px;align-items:start">
        <div>
          <!-- Task filters -->
          <div class="tasks-header">
            <div class="tasks-filters">
              <button class="filter-chip active" data-status="">All</button>
              <button class="filter-chip" data-status="todo">To Do</button>
              <button class="filter-chip" data-status="in_progress">In Progress</button>
              <button class="filter-chip" data-status="done">Done</button>
            </div>
            <div class="tasks-filters">
              <button class="filter-chip active" data-view="list" id="view-list">≡ List</button>
              <button class="filter-chip" data-view="kanban" id="view-kanban">⊞ Board</button>
            </div>
          </div>
          <div id="task-container"></div>
        </div>
        <!-- Sidebar panel -->
        <div>
          <div class="section-card">
            <div class="section-card-header">About</div>
            <div class="section-card-body" style="font-size:13px;color:var(--text-muted)">
              ${project.description || '<em>No description</em>'}
            </div>
          </div>
          <div class="section-card">
            <div class="section-card-header">
              Members
              ${isOwnerOrAdmin ? `<button class="btn btn-ghost btn-sm" id="add-member-btn">+ Add</button>` : ''}
            </div>
            <div class="section-card-body">
              <div class="members-list" id="members-list">
                ${project.members.map(m => `
                  <div class="member-row">
                    <div class="user-avatar">${avatar(m.user?.name)}</div>
                    <div class="member-info">
                      <div class="member-name">${m.user?.name}</div>
                      <div class="member-email">${m.user?.email}</div>
                    </div>
                    <span class="badge badge-${m.role}">${m.role}</span>
                    ${isOwnerOrAdmin && m.user_id !== project.owner_id ? `
                      <button class="btn btn-icon btn-sm" onclick="removeMember(${projectId},${m.user_id})" title="Remove">✕</button>` : ''}
                  </div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  renderTaskList(state.tasks);

  // Filter chips
  let activeStatus = '';
  $$('.filter-chip[data-status]').forEach(chip => {
    chip.onclick = async () => {
      $$('.filter-chip[data-status]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeStatus = chip.dataset.status;
      const filtered = activeStatus
        ? state.tasks.filter(t => t.status === activeStatus)
        : state.tasks;
      if (currentView === 'kanban') renderKanban(filtered);
      else renderTaskList(filtered);
    };
  });

  let currentView = 'list';
  $('#view-list').onclick = () => {
    currentView = 'list';
    $$('[data-view]').forEach(b => b.classList.remove('active'));
    $('#view-list').classList.add('active');
    renderTaskList(activeStatus ? state.tasks.filter(t => t.status === activeStatus) : state.tasks);
  };
  $('#view-kanban').onclick = () => {
    currentView = 'kanban';
    $$('[data-view]').forEach(b => b.classList.remove('active'));
    $('#view-kanban').classList.add('active');
    renderKanban(activeStatus ? state.tasks.filter(t => t.status === activeStatus) : state.tasks);
  };

  $('#new-task-btn').onclick = () => openCreateTaskModal(projectId);
  $('#add-member-btn')?.addEventListener('click', () => openAddMemberModal(projectId));
  $('#edit-project-btn')?.addEventListener('click', () => openEditProjectModal(project));
  $('#delete-project-btn')?.addEventListener('click', () => confirmDeleteProject(project));
}

function renderTaskList(tasks) {
  const container = $('#task-container');
  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>No tasks here.</p></div>`;
    return;
  }
  container.innerHTML = `<div class="task-list">${tasks.map(taskCard).join('')}</div>`;
  container.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.onclick = (e) => {
      e.stopPropagation();
      const taskId = cb.dataset.tid;
      const pid = cb.dataset.pid;
      const status = cb.dataset.status === 'done' ? 'todo' : 'done';
      toggleTaskDone(pid, taskId, status);
    };
  });
  container.querySelectorAll('.task-edit-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const task = state.tasks.find(t => t.id == btn.dataset.tid);
      if (task) openEditTaskModal(task);
    };
  });
  container.querySelectorAll('.task-delete-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteTask(btn.dataset.pid, btn.dataset.tid);
    };
  });
}

function taskCard(t) {
  const overdue = isOverdue(t.due_date, t.status);
  return `
    <div class="task-card">
      <div class="task-checkbox ${t.status === 'done' ? 'done' : ''}"
           data-tid="${t.id}" data-pid="${t.project_id}" data-status="${t.status}">
        ${t.status === 'done' ? '✓' : ''}
      </div>
      <div class="task-info">
        <div class="task-title ${t.status === 'done' ? 'done' : ''}">${t.title}</div>
        <div class="task-meta">
          ${statusBadge(t.status)}
          ${priorityBadge(t.priority)}
          ${t.due_date ? `<span class="${overdue ? 'badge badge-overdue' : ''}">📅 ${formatDate(t.due_date)}${overdue ? ' Overdue' : ''}</span>` : ''}
        </div>
        ${t.assignees && t.assignees.length ? `
          <div style="margin-top:8px;display:flex;gap:4px">
            ${t.assignees.map(a => `<div class="user-avatar" style="width:24px;height:24px;font-size:10px" title="${a.name}">${avatar(a.name)}</div>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="task-actions">
        <button class="btn btn-icon btn-sm task-edit-btn" data-tid="${t.id}" title="Edit">✏</button>
        <button class="btn btn-icon btn-sm task-delete-btn" data-pid="${t.project_id}" data-tid="${t.id}" title="Delete">🗑</button>
      </div>
    </div>`;
}

function renderKanban(tasks) {
  const cols = { todo: [], in_progress: [], done: [] };
  tasks.forEach(t => { if (cols[t.status]) cols[t.status].push(t); });

  const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  const colors = { todo: 'var(--text-muted)', in_progress: 'var(--accent)', done: 'var(--success)' };

  $('#task-container').innerHTML = `
    <div class="kanban-board">
      ${Object.entries(cols).map(([status, items]) => `
        <div class="kanban-col">
          <div class="kanban-col-header" style="color:${colors[status]}">
            ${labels[status]}
            <span class="count-pill">${items.length}</span>
          </div>
          <div class="kanban-tasks">
            ${items.length === 0 ? '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px">Empty</div>' :
              items.map(t => `
                <div class="kanban-task">
                  <div class="kanban-task-title">${t.title}</div>
                  <div class="kanban-task-meta">
                    ${priorityBadge(t.priority)}
                  </div>
                  ${t.assignees && t.assignees.length ? `
                    <div style="margin-top:8px;display:flex;gap:4px;justify-content:flex-end">
                      ${t.assignees.map(a => `<div class="user-avatar" style="width:20px;height:20px;font-size:9px" title="${a.name}">${avatar(a.name)}</div>`).join('')}
                    </div>
                  ` : ''}
                </div>`).join('')
            }
          </div>
        </div>`).join('')}
    </div>`;
}


// ── MY TASKS ──────────────────────────────────────────────────────────────────
async function renderMyTasks() {
  const projects = await api.getProjects();
  state.projects = projects || [];

  let allTasks = [];
  for (const p of state.projects) {
    try {
      const tasks = await api.getTasks(p.id, { assignee_id: state.user?.id });
      if (tasks) allTasks = allTasks.concat(tasks.map(t => ({ ...t, _projectName: p.name })));
    } catch (_) {}
  }

  $('#page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">My Tasks</div>
    </div>
    <div class="content">
      ${allTasks.length === 0
        ? '<div class="empty-state"><div class="empty-icon">✅</div><p>No tasks assigned to you yet.</p></div>'
        : `<div class="task-list">${allTasks.map(t => `
            <div class="task-card">
              <div class="task-checkbox ${t.status === 'done' ? 'done' : ''}"
                   data-tid="${t.id}" data-pid="${t.project_id}" data-status="${t.status}">
                ${t.status === 'done' ? '✓' : ''}
              </div>
              <div class="task-info">
                <div class="task-title ${t.status === 'done' ? 'done' : ''}">${t.title}</div>
                <div class="task-meta">
                  ${statusBadge(t.status)}
                  ${priorityBadge(t.priority)}
                  <span style="color:var(--accent)">📁 ${t._projectName}</span>
                  ${t.due_date ? `<span class="${isOverdue(t.due_date, t.status) ? 'badge badge-overdue' : ''}">📅 ${formatDate(t.due_date)}</span>` : ''}
                </div>
                ${t.assignees && t.assignees.length ? `
                  <div style="margin-top:8px;display:flex;gap:4px">
                    ${t.assignees.map(a => `<div class="user-avatar" style="width:24px;height:24px;font-size:10px" title="${a.name}">${avatar(a.name)}</div>`).join('')}
                  </div>
                ` : ''}
              </div>
            </div>`).join('')}</div>`
      }
    </div>`;

  $$('.task-checkbox').forEach(cb => {
    cb.onclick = () => toggleTaskDone(cb.dataset.pid, cb.dataset.tid,
      cb.dataset.status === 'done' ? 'todo' : 'done');
  });
}


// ── USERS (ADMIN) ─────────────────────────────────────────────────────────────
async function renderUsers() {
  if (state.user?.role !== 'admin') {
    $('#page-content').innerHTML = '<div class="content"><div class="alert alert-error">Admin access required</div></div>';
    return;
  }
  const users = await api.getUsers();

  $('#page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">All Users</div>
    </div>
    <div class="content">
      <div class="section-card">
        <div class="section-card-body table-wrapper">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <div class="user-avatar" style="width:30px;height:30px;font-size:11px">${avatar(u.name)}</div>
                      <span>${u.name}</span>
                    </div>
                  </td>
                  <td style="color:var(--text-muted)">${u.email}</td>
                  <td><span class="badge badge-${u.role}">${u.role}</span></td>
                  <td><span class="badge ${u.is_active ? 'badge-done' : 'badge-high'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style="color:var(--text-muted)">${formatDate(u.created_at)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}


// ── TASK ACTIONS ──────────────────────────────────────────────────────────────
function openCreateTaskModal(projectId) {
  const memberOptions = (state.currentProject?.members || [])
    .map(m => `<option value="${m.user_id}">${m.user?.name}</option>`).join('');

  openModal('Create Task', `
    <div class="form-group">
      <label>Title *</label>
      <input type="text" id="task-title" placeholder="What needs to be done?">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="task-desc" placeholder="Add details…"></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Status</label>
        <select id="task-status">
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div class="form-group">
        <label>Priority</label>
        <select id="task-priority">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Assignees (Ctrl+Click to select multiple)</label>
        <select id="task-assignee" multiple size="3" style="height:auto">
          ${memberOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Due Date</label>
        <input type="date" id="task-due">
      </div>
    </div>`, async (modal, close) => {
    const title = modal.querySelector('#task-title').value.trim();
    if (!title) throw new Error('Title is required');
    const assignees = Array.from(modal.querySelector('#task-assignee').selectedOptions).map(opt => parseInt(opt.value));
    await api.createTask(projectId, {
      title,
      description: modal.querySelector('#task-desc').value,
      status: modal.querySelector('#task-status').value,
      priority: modal.querySelector('#task-priority').value,
      assignee_ids: assignees,
      due_date: modal.querySelector('#task-due').value || null,
    });
    const tasks = await api.getTasks(projectId);
    state.tasks = tasks || [];
    close();
    renderTaskList(state.tasks);
  }, 'Create Task');
}

function openEditTaskModal(task) {
  const assigneeIds = (task.assignees || []).map(a => a.id);
  const memberOptions = (state.currentProject?.members || [])
    .map(m => `<option value="${m.user_id}" ${assigneeIds.includes(m.user_id) ? 'selected' : ''}>${m.user?.name}</option>`).join('');

  openModal('Edit Task', `
    <div class="form-group">
      <label>Title *</label>
      <input type="text" id="task-title" value="${task.title}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="task-desc">${task.description || ''}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Status</label>
        <select id="task-status">
          <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
          <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
        </select>
      </div>
      <div class="form-group">
        <label>Priority</label>
        <select id="task-priority">
          <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
          <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Assignees (Ctrl+Click to select multiple)</label>
        <select id="task-assignee" multiple size="3" style="height:auto">
          ${memberOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Due Date</label>
        <input type="date" id="task-due" value="${task.due_date || ''}">
      </div>
    </div>`, async (modal, close) => {
    const title = modal.querySelector('#task-title').value.trim();
    if (!title) throw new Error('Title is required');
    const assignees = Array.from(modal.querySelector('#task-assignee').selectedOptions).map(opt => parseInt(opt.value));
    await api.updateTask(task.project_id, task.id, {
      title,
      description: modal.querySelector('#task-desc').value,
      status: modal.querySelector('#task-status').value,
      priority: modal.querySelector('#task-priority').value,
      assignee_ids: assignees,
      due_date: modal.querySelector('#task-due').value || null,
    });
    const tasks = await api.getTasks(task.project_id);
    state.tasks = tasks || [];
    close();
    renderTaskList(state.tasks);
  }, 'Save Changes');
}

async function toggleTaskDone(projectId, taskId, newStatus) {
  await api.updateTask(projectId, taskId, { status: newStatus });
  const tasks = await api.getTasks(projectId);
  state.tasks = tasks || [];
  renderTaskList(state.tasks);
}

async function deleteTask(projectId, taskId) {
  if (!confirm('Delete this task?')) return;
  await api.deleteTask(projectId, taskId);
  state.tasks = state.tasks.filter(t => t.id != taskId);
  renderTaskList(state.tasks);
}


// ── PROJECT ACTIONS ───────────────────────────────────────────────────────────
function openEditProjectModal(project) {
  openModal('Edit Project', `
    <div class="form-group">
      <label>Project Name *</label>
      <input type="text" id="proj-name" value="${project.name}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="proj-desc">${project.description || ''}</textarea>
    </div>`, async (modal, close) => {
    const name = modal.querySelector('#proj-name').value.trim();
    if (!name) throw new Error('Name is required');
    await api.updateProject(project.id, { name, description: modal.querySelector('#proj-desc').value });
    close();
    navigateTo('project', { id: project.id });
  }, 'Save Changes');
}

async function confirmDeleteProject(project) {
  if (!confirm(`Delete project "${project.name}"? This will delete all tasks too.`)) return;
  await api.deleteProject(project.id);
  navigateTo('projects');
}

function openAddMemberModal(projectId) {
  const existingIds = (state.currentProject?.members || []).map(m => m.user_id);
  const available = state.users.filter(u => !existingIds.includes(u.id));

  if (!available.length) {
    showAlert('All users are already members of this project', 'error');
    return;
  }

  openModal('Add Member', `
    <div class="form-group">
      <label>Select User</label>
      <select id="add-user-id">
        ${available.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Role in Project</label>
      <select id="add-user-role">
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
    </div>`, async (modal, close) => {
    const userId = parseInt(modal.querySelector('#add-user-id').value);
    const role = modal.querySelector('#add-user-role').value;
    await api.addMember(projectId, { user_id: userId, role });
    close();
    navigateTo('project', { id: projectId });
  }, 'Add Member');
}

async function removeMember(projectId, userId) {
  if (!confirm('Remove this member?')) return;
  await api.removeMember(projectId, userId);
  navigateTo('project', { id: projectId });
}


// ── INIT ──────────────────────────────────────────────────────────────────────
window.app = {
  showAuth: renderAuth,
  navigateTo,
  removeMember,
};

if (state.user && localStorage.getItem('token')) {
  renderApp();
} else {
  renderAuth();
}
