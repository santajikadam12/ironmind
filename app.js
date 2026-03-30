/* ══════════════════════════════════════════════════════════
   IRONMIND — Complete Application JavaScript
   AI-Powered Gym Workout Tracker with Ollama Integration
   ══════════════════════════════════════════════════════════ */

'use strict';

// ─── App State ──────────────────────────────────────────────────────────────
const STATE = {
  user: null,
  currentView: 'dashboard',
  ollamaModel: 'llama3',
  ollamaOnline: false,
  activeWorkout: null,
  workoutTimer: null,
  workoutSeconds: 0,
  workoutPaused: false,
  restTimer: null,
  restSeconds: 60,
  restTotal: 60,
  generatedWorkout: null,
  chatHistory: [],
  charts: {}
};

// ─── Local Storage Keys ──────────────────────────────────────────────────────
const KEYS = {
  USER: 'im_user',
  WORKOUTS: 'im_workouts',
  SETTINGS: 'im_settings'
};

// ─── Utility Functions ───────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function $$(sel) { return document.querySelectorAll(sel); }
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function pluralize(n, word) { return `${n} ${word}${n !== 1 ? 's' : ''}`; }
function randomBetween(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function showNotification(msg, type = 'info') {
  const toast = $('toast');
  toast.textContent = msg;
  toast.className = 'toast show';
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function getWorkouts() {
  try { return JSON.parse(localStorage.getItem(KEYS.WORKOUTS)) || []; }
  catch { return []; }
}
function saveWorkouts(arr) { localStorage.setItem(KEYS.WORKOUTS, JSON.stringify(arr)); }

function getSettings() {
  try { return JSON.parse(localStorage.getItem(KEYS.SETTINGS)) || {}; }
  catch { return {}; }
}
function saveSettings(s) { localStorage.setItem(KEYS.SETTINGS, JSON.stringify(s)); }

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning!';
  if (h < 17) return 'Good afternoon!';
  return 'Good evening!';
}

// ─── Page Routing ────────────────────────────────────────────────────────────
function showPage(pageId) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $(pageId).classList.add('active');
}

function navigateTo(view) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`view-${view}`).classList.add('active');
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = $(`nav-${view}`);
  if (navBtn) navBtn.classList.add('active');
  STATE.currentView = view;
  if (view === 'history') renderHistory();
  if (view === 'dashboard') updateDashboard();
}

// ─── SPLASH SCREEN ───────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    const splash = $('splash-screen');
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      initApp();
    }, 600);
  }, 1400);
});

function initApp() {
  const saved = localStorage.getItem(KEYS.USER);
  if (saved) {
    STATE.user = JSON.parse(saved);
    const settings = getSettings();
    STATE.ollamaModel = settings.model || 'llama3';
    enterApp();
  } else {
    showPage('page-landing');
  }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function showAuth(tab) {
  $('auth-modal').classList.add('active');
  switchAuthTab(tab);
}
function closeAuth() { $('auth-modal').classList.remove('active'); }
function closeAuthOnBg(e) { if (e.target === $('auth-modal')) closeAuth(); }
function switchAuthTab(tab) {
  $$('.auth-tab').forEach(t => t.classList.remove('active'));
  $$('.auth-form').forEach(f => f.classList.remove('active'));
  $(`tab-${tab}`).classList.add('active');
  $(`form-${tab}`).classList.add('active');
}

function handleLogin(e) {
  e.preventDefault();
  const email = $('login-email').value;
  const password = $('login-password').value;

  // Demo auth — in production connect to your backend
  const users = JSON.parse(localStorage.getItem('im_users') || '[]');
  const found = users.find(u => u.email === email);

  if (email === 'demo@ironmind.app' && password === 'demo123') {
    STATE.user = {
      name: 'Alex', email, level: 'Intermediate',
      goal: 'Build Muscle', freq: 4, plan: 'Pro',
      joined: Date.now()
    };
    localStorage.setItem(KEYS.USER, JSON.stringify(STATE.user));
    closeAuth();
    const settings = getSettings();
    if (settings.onboarded) { enterApp(); }
    else { showPage('page-onboarding'); }
  } else if (found && found.password === password) {
    STATE.user = found;
    localStorage.setItem(KEYS.USER, JSON.stringify(STATE.user));
    closeAuth();
    enterApp();
  } else {
    showNotification('❌ Invalid credentials. Try demo@ironmind.app / demo123');
  }
}

function handleSignup(e) {
  e.preventDefault();
  const name = $('signup-name').value.trim();
  const email = $('signup-email').value.trim();
  const password = $('signup-password').value;
  const level = $('signup-level').value;

  STATE.user = { name, email, level, goal: 'Build Muscle', freq: 4, plan: 'Free', joined: Date.now() };

  const users = JSON.parse(localStorage.getItem('im_users') || '[]');
  users.push({ ...STATE.user, password });
  localStorage.setItem('im_users', JSON.stringify(users));
  localStorage.setItem(KEYS.USER, JSON.stringify(STATE.user));

  closeAuth();
  showPage('page-onboarding');
}

function demoLogin() {
  STATE.user = {
    name: 'Alex', email: 'demo@ironmind.app', level: 'Intermediate',
    goal: 'Build Muscle', freq: 4, plan: 'Pro', joined: Date.now()
  };
  localStorage.setItem(KEYS.USER, JSON.stringify(STATE.user));
  const settings = getSettings();
  if (settings.onboarded) { enterApp(); }
  else { showPage('page-onboarding'); }
}

function handleLogout() {
  localStorage.removeItem(KEYS.USER);
  STATE.user = null;
  STATE.chatHistory = [];
  if (STATE.workoutTimer) clearInterval(STATE.workoutTimer);
  showPage('page-landing');
  showNotification('👋 Logged out successfully');
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
let selectedGoal = 'Build Muscle';
let selectedFreq = 4;

function selectGoal(btn) {
  $$('.goal-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedGoal = btn.dataset.goal;
}

function selectFreq(btn) {
  $$('.freq-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedFreq = parseInt(btn.dataset.freq);
}

function nextOnboardStep(step) {
  $$('.onboard-step').forEach(s => s.classList.remove('active'));
  $(`onboard-step-${step}`).classList.add('active');
  $$('.dot').forEach((d, i) => d.classList.toggle('active', i < step));
}

function finishOnboarding() {
  if (STATE.user) {
    STATE.user.goal = selectedGoal;
    STATE.user.freq = selectedFreq;
    STATE.user.level = $('signup-level') ? $('signup-level').value : STATE.user.level;
    localStorage.setItem(KEYS.USER, JSON.stringify(STATE.user));
  }
  const model = $('ollama-model-select').value;
  STATE.ollamaModel = model;
  saveSettings({ model, onboarded: true });
  enterApp();
}

async function checkOllamaStatus() {
  // Silent check — never show errors to the user
  try {
    const res = await fetch('/api/ollama/status');
    const data = await res.json();
    STATE.ollamaOnline = data.online || false;
    if (data.online && data.models && data.models.length) {
      const sel = $('ollama-model-select');
      if (sel) sel.innerHTML = data.models.map(m => `<option value="${m}">${m}</option>`).join('');
    }
  } catch { STATE.ollamaOnline = false; }
}

// ─── ENTER APP ────────────────────────────────────────────────────────────────
function enterApp() {
  showPage('page-app');
  updateProfileUI();
  updateDashboard();
  initCharts();
  checkOllamaOnlineStatus();
  // Set AI model selectors
  if ($('gen-model')) $('gen-model').value = STATE.ollamaModel;
  if ($('chat-model-select')) $('chat-model-select').value = STATE.ollamaModel;
  if ($('pf-model')) $('pf-model').value = STATE.ollamaModel;
}

async function checkOllamaOnlineStatus() {
  try {
    const res = await fetch('/api/ollama/status');
    const data = await res.json();
    STATE.ollamaOnline = data.online || false;
    const statusEl = $('pf-ollama-status');
    if (statusEl) {
      if (data.online) {
        statusEl.textContent = '✓ Connected';
        statusEl.style.background = 'rgba(16,185,129,0.1)';
        statusEl.style.color = '#10b981';
        statusEl.style.border = '1px solid rgba(16,185,129,0.3)';
      } else {
        statusEl.textContent = 'Using Smart Fallback';
        statusEl.style.background = 'rgba(108,63,255,0.1)';
        statusEl.style.color = '#a855f7';
        statusEl.style.border = '1px solid rgba(168,85,247,0.3)';
      }
    }
  } catch {
    STATE.ollamaOnline = false;
    const statusEl = $('pf-ollama-status');
    if (statusEl) {
      statusEl.textContent = 'Using Smart Fallback';
      statusEl.style.background = 'rgba(108,63,255,0.1)';
      statusEl.style.color = '#a855f7';
    }
  }
}

function updateModel(model) {
  STATE.ollamaModel = model;
  const settings = getSettings();
  settings.model = model;
  saveSettings(settings);
  // sync all selects
  ['gen-model', 'chat-model-select', 'pf-model'].forEach(id => {
    const el = $(id);
    if (el) el.value = model;
  });
  showNotification(`🤖 Switched to ${model}`);
}

function updateProfileUI() {
  if (!STATE.user) return;
  const initial = STATE.user.name.charAt(0).toUpperCase();
  const pf = $('profile-avatar-large');
  const av = $('user-avatar');
  if (pf) { pf.textContent = initial; $('profile-name').textContent = STATE.user.name; $('profile-email').textContent = STATE.user.email; }
  if (av) av.textContent = initial;
  if ($('pf-level')) $('pf-level').textContent = STATE.user.level;
  if ($('pf-goal')) $('pf-goal').textContent = STATE.user.goal;
  if ($('pf-freq')) $('pf-freq').textContent = `${STATE.user.freq}× per week`;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function updateDashboard() {
  const workouts = getWorkouts();
  const streak = calcStreak(workouts);
  const totalCalories = workouts.reduce((s, w) => s + (w.calories || 0), 0);
  const totalVolume = workouts.reduce((s, w) => s + (w.volume || 0), 0);

  // Greeting
  if ($('greeting-text')) {
    const name = STATE.user ? STATE.user.name.split(' ')[0] : 'Athlete';
    $('greeting-text').textContent = `${getGreeting()} ${name}! 💪`;
  }

  // Streak
  if ($('streak-count')) $('streak-count').textContent = streak;

  // Stats
  if ($('stat-workouts')) $('stat-workouts').textContent = workouts.length;
  if ($('stat-volume')) $('stat-volume').textContent = totalVolume > 1000 ? `${(totalVolume/1000).toFixed(1)}t` : `${totalVolume}kg`;
  if ($('stat-streak')) $('stat-streak').textContent = streak;
  if ($('stat-calories')) $('stat-calories').textContent = totalCalories > 1000 ? `${(totalCalories/1000).toFixed(1)}k` : totalCalories;

  // History stats
  if ($('hist-total-workouts')) $('hist-total-workouts').textContent = workouts.length;
  if ($('hist-total-calories')) $('hist-total-calories').textContent = totalCalories.toLocaleString();
  if ($('hist-best-streak')) $('hist-best-streak').textContent = streak;
  if ($('hist-total-volume')) $('hist-total-volume').textContent = `${totalVolume} kg`;

  // Today's workout
  const todayWorkout = workouts.find(w => formatDate(w.date) === 'Today');
  if (todayWorkout && $('today-workout-name')) {
    $('today-workout-name').textContent = todayWorkout.name;
    if ($('calories-today')) $('calories-today').textContent = todayWorkout.calories || 0;
  } else if (STATE.user) {
    const days = ['Full Body', 'Upper Body', 'Lower Body', 'Push', 'Pull', 'Legs', 'Core'];
    const dayIdx = new Date().getDay();
    if ($('today-workout-name')) $('today-workout-name').textContent = days[dayIdx % days.length];
  }

  // Update achievements
  updateAchievements(workouts, streak);

  // Recent workouts
  renderRecentWorkouts(workouts.slice(-5).reverse());

  // Chart empty state
  const chartEmpty = $('chart-empty-msg');
  if (chartEmpty) chartEmpty.style.display = workouts.length > 0 ? 'none' : 'flex';

  updateWeeklyChart(workouts);
}

function calcStreak(workouts) {
  if (!workouts.length) return 0;
  let streak = 0;
  const sorted = [...workouts].sort((a, b) => b.date - a.date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let checkDate = new Date(today);

  for (const w of sorted) {
    const wDate = new Date(w.date); wDate.setHours(0, 0, 0, 0);
    if (wDate.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (wDate < checkDate) break;
  }
  return streak;
}

function renderRecentWorkouts(workouts) {
  const container = $('recent-workouts-list');
  if (!container) return;

  if (!workouts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏋️</div>
        <p>No workouts yet. Generate one with AI!</p>
        <button class="btn-primary" onclick="navigateTo('ai-generator')">Generate Workout</button>
      </div>`;
    return;
  }

  container.innerHTML = workouts.map(w => `
    <div class="workout-item" onclick="navigateTo('history')">
      <div class="wi-icon">${getWorkoutEmoji(w.muscleGroups)}</div>
      <div class="wi-body">
        <div class="wi-name">${w.name}</div>
        <div class="wi-meta">${w.exercises || 0} exercises · ${formatTime(w.duration || 0)}</div>
      </div>
      <div class="wi-right">
        <div class="wi-cals">${w.calories || 0} kcal</div>
        <div class="wi-date">${formatDate(w.date)}</div>
      </div>
    </div>`).join('');
}

function getWorkoutEmoji(muscleGroups) {
  if (!muscleGroups) return '🏋️';
  const mg = muscleGroups.toLowerCase();
  if (mg.includes('chest')) return '🫁';
  if (mg.includes('back')) return '🔙';
  if (mg.includes('leg')) return '🦵';
  if (mg.includes('arm') || mg.includes('bicep') || mg.includes('tricep')) return '💪';
  if (mg.includes('shoulder')) return '🔝';
  if (mg.includes('core') || mg.includes('abs')) return '⚡';
  if (mg.includes('cardio')) return '🏃';
  return '🏋️';
}

function updateAchievements(workouts, streak) {
  const grid = $('achievements-grid');
  if (!grid) return;
  const total = workouts.length;
  const totalSets = workouts.reduce((s, w) => s + (w.setsCompleted || 0), 0);

  const achievements = [
    { emoji: '🏋️', label: 'First Rep', unlocked: total >= 1 },
    { emoji: '🔥', label: 'Week Warrior', unlocked: streak >= 7 },
    { emoji: '⚡', label: '10 Strong', unlocked: total >= 10 },
    { emoji: '💯', label: 'Century Sets', unlocked: totalSets >= 100 },
    { emoji: '🏆', label: 'Iron Month', unlocked: streak >= 30 },
    { emoji: '🤖', label: 'AI Athlete', unlocked: total >= 1 }
  ];

  grid.innerHTML = achievements.map(a => `
    <div class="achievement ${a.unlocked ? 'unlocked' : 'locked'}" title="${a.label}">
      ${a.emoji}<br><small>${a.label}</small>
    </div>`).join('');
}

// ─── CHARTS ───────────────────────────────────────────────────────────────────
function initCharts() {
  initWeeklyChart();
  initHistoryChart();
}

function initWeeklyChart() {
  const ctx = $('weeklyChart');
  if (!ctx) return;
  if (STATE.charts.weekly) STATE.charts.weekly.destroy();

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  STATE.charts.weekly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Calories',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(124,58,237,0.4)',
        borderColor: '#8b5cf6',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8888aa', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8888aa', font: { size: 10 } } }
      }
    }
  });
}

function updateWeeklyChart(workouts) {
  if (!STATE.charts.weekly) return;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const data = [0, 0, 0, 0, 0, 0, 0];
  workouts.forEach(w => {
    const d = new Date(w.date);
    const diff = Math.floor((d - weekStart) / 86400000);
    if (diff >= 0 && diff < 7) data[diff] += (w.calories || 0);
  });
  STATE.charts.weekly.data.datasets[0].data = data;
  STATE.charts.weekly.update();
}

function initHistoryChart() {
  const ctx = $('historyChart');
  if (!ctx) return;
  if (STATE.charts.history) STATE.charts.history.destroy();

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const labels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(months[d.getMonth()]);
  }

  STATE.charts.history = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Volume (kg)',
        data: labels.map(() => 0),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(124,58,237,0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#8b5cf6',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8888aa', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8888aa', font: { size: 10 } } }
      }
    }
  });
}

function renderHistory() {
  const workouts = getWorkouts();
  updateDashboard();

  const histList = $('full-history-list');
  if (!histList) return;

  if (!workouts.length) {
    histList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>Complete workouts to see your history</p>
      </div>`;
    return;
  }

  const sorted = [...workouts].sort((a, b) => b.date - a.date);
  histList.innerHTML = sorted.map(w => `
    <div class="workout-item">
      <div class="wi-icon">${getWorkoutEmoji(w.muscleGroups)}</div>
      <div class="wi-body">
        <div class="wi-name">${w.name}</div>
        <div class="wi-meta">${w.exercises || 0} exercises · ${formatTime(w.duration || 0)} · ${w.setsCompleted || 0} sets</div>
      </div>
      <div class="wi-right">
        <div class="wi-cals">${w.calories || 0} kcal</div>
        <div class="wi-date">${formatDate(w.date)}</div>
      </div>
    </div>`).join('');

  // Update history chart
  if (STATE.charts.history) {
    const now = new Date();
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const month = now.getMonth() - i;
      const year = now.getFullYear() + (month < 0 ? -1 : 0);
      const m = ((month % 12) + 12) % 12;
      const vol = workouts
        .filter(w => { const d = new Date(w.date); return d.getMonth() === m && d.getFullYear() === year; })
        .reduce((s, w) => s + (w.volume || 0), 0);
      data.push(vol);
    }
    STATE.charts.history.data.datasets[0].data = data;
    STATE.charts.history.update();
  }
}

// ─── AI WORKOUT GENERATOR ─────────────────────────────────────────────────────
function toggleChip(btn) {
  btn.classList.toggle('active');
}

async function generateAIWorkout() {
  const activeChips = $$('#muscle-chips .chip.active');
  const muscles = Array.from(activeChips).map(c => c.dataset.muscle).join(', ') || 'Full Body';
  const duration = $('gen-duration').value;
  const level = $('gen-level').value;
  const goal = $('gen-goal').value;
  const model = $('gen-model').value;

  const btn = $('generate-btn');
  const btnText = $('gen-btn-text');
  btn.disabled = true;
  btnText.textContent = '🤖 Generating...';

  // Show generating state
  const display = $('generated-workout');
  display.classList.add('hidden');

  // Add loading indicator
  let loadingEl = document.querySelector('.generating');
  if (!loadingEl) {
    loadingEl = document.createElement('div');
    loadingEl.className = 'generating';
    loadingEl.innerHTML = '<div class="gen-spinner"></div><span>IronAI is designing your perfect workout...</span>';
    btn.insertAdjacentElement('afterend', loadingEl);
  }
  loadingEl.style.display = 'flex';

  try {
    const res = await fetch('/api/ai/generate-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fitnessLevel: level, goals: goal, muscleGroups: muscles, duration, model })
    });
    const data = await res.json();

    if (data.success) {
      STATE.generatedWorkout = { ...data.workout, muscleGroups: muscles };
      renderGeneratedWorkout(data.workout, data.fallback);
      if (data.fallback) showNotification('⚠️ Ollama offline — showing sample workout');
      else showNotification('✅ Workout generated by AI!');
    }
  } catch (err) {
    // silent — fallback workout will be used automatically
    console.warn('AI generation error:', err.message);
  } finally {
    btn.disabled = false;
    btnText.textContent = '⚡ Generate My Workout';
    loadingEl.style.display = 'none';
  }
}

function renderGeneratedWorkout(workout, isFallback) {
  const display = $('generated-workout');  

  $('gen-workout-name').textContent = workout.workoutName || 'Custom Workout';
  $('gen-workout-meta').textContent =
    `${workout.totalDuration || 45} min · ${workout.difficulty || 'Intermediate'} · ~${workout.estimatedCalories || 350} kcal`;

  // Warmup
  $('gen-warmup').innerHTML = (workout.warmup || []).map(w => `
    <div class="warmup-row">
      <span class="warmup-icon">🔥</span>
      <div class="warmup-body">
        <div class="warmup-name">${w.name}</div>
        <div class="warmup-desc">${w.description}</div>
      </div>
      <span class="warmup-dur">${w.duration}</span>
    </div>`).join('');

  // Main exercises
  $('gen-exercises').innerHTML = (workout.exercises || []).map((ex, i) => `
    <div class="exercise-row">
      <div class="ex-num">${i + 1}</div>
      <div class="ex-body">
        <div class="ex-name">${ex.name}</div>
        <div class="ex-meta">${ex.sets} sets × ${ex.reps} reps · Rest: ${ex.rest}</div>
        ${ex.tips ? `<div class="ex-tip">💡 ${ex.tips}</div>` : ''}
      </div>
      <span class="ex-tag">${ex.muscleGroup || ''}</span>
    </div>`).join('');

  // Cooldown
  $('gen-cooldown').innerHTML = (workout.cooldown || []).map(c => `
    <div class="warmup-row">
      <span class="warmup-icon">🧊</span>
      <div class="warmup-body">
        <div class="warmup-name">${c.name}</div>
        <div class="warmup-desc">${c.description}</div>
      </div>
      <span class="warmup-dur">${c.duration}</span>
    </div>`).join('');

  display.classList.remove('hidden');
  display.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveGeneratedWorkout() {
  if (!STATE.generatedWorkout) return;
  const workouts = getWorkouts();
  workouts.push({
    id: Date.now(),
    name: STATE.generatedWorkout.workoutName,
    date: Date.now(),
    duration: (STATE.generatedWorkout.totalDuration || 45) * 60,
    exercises: (STATE.generatedWorkout.exercises || []).length,
    calories: STATE.generatedWorkout.estimatedCalories || 350,
    volume: 0,
    setsCompleted: 0,
    muscleGroups: STATE.generatedWorkout.muscleGroups || 'Full Body',
    saved: true,
    aiGenerated: true
  });
  saveWorkouts(workouts);
  showNotification('💾 Workout saved to history!');
  updateDashboard();
}

function startWorkoutFromGenerated() {
  if (!STATE.generatedWorkout) return;
  STATE.activeWorkout = STATE.generatedWorkout;
  navigateTo('workout');
  startActiveWorkout();
}

// ─── ACTIVE WORKOUT ───────────────────────────────────────────────────────────
function startActiveWorkout() {
  const noWorkout = $('no-active-workout');
  const content = $('active-workout-content');
  if (!STATE.activeWorkout) { noWorkout.style.display = 'block'; content.classList.add('hidden'); return; }

  noWorkout.style.display = 'none';
  content.classList.remove('hidden');

  STATE.workoutSeconds = 0;
  STATE.workoutPaused = false;
  clearInterval(STATE.workoutTimer);
  STATE.workoutTimer = setInterval(() => {
    if (!STATE.workoutPaused) {
      STATE.workoutSeconds++;
      const td = $('workout-timer');
      if (td) td.textContent = formatTime(STATE.workoutSeconds);
      // Auto-update calories (MET-based estimate)
      const cal = Math.round(STATE.workoutSeconds * 0.15);
      const ac = $('active-calories');
      if (ac) ac.textContent = cal;
    }
  }, 1000);

  renderActiveExercises();
}

function renderActiveExercises() {
  const list = $('active-exercise-list');
  if (!list || !STATE.activeWorkout) return;

  const exercises = STATE.activeWorkout.exercises || [];
  let setsGlobal = { done: 0, volume: 0 };

  list.innerHTML = exercises.map((ex, ei) => `
    <div class="active-exercise-card ${ei === 0 ? 'current' : ''}" id="aec-${ei}">
      <div class="aec-header">
        <div class="aec-name">${ex.name}</div>
        <span class="aec-muscle">${ex.muscleGroup || ''}</span>
      </div>
      <div class="sets-grid" id="sets-${ei}">
        ${Array.from({ length: ex.sets || 3 }, (_, si) => `
          <button class="set-btn ${si === 0 ? 'active-set' : ''}"
            id="set-${ei}-${si}"
            onclick="completeSet(${ei}, ${si}, ${ex.sets})">
            ${si + 1}
          </button>`).join('')}
      </div>
      <div class="set-info">${ex.reps} reps · Rest: ${ex.rest || '60 sec'}</div>
    </div>`).join('');
}

let setsCompleted = 0;
let totalVolume = 0;

function completeSet(exerciseIdx, setIdx, totalSets) {
  const btn = $(`set-${exerciseIdx}-${setIdx}`);
  if (!btn || btn.classList.contains('done')) return;

  btn.classList.remove('active-set');
  btn.classList.add('done');
  btn.textContent = '✓';

  setsCompleted++;
  totalVolume += randomBetween(40, 120); // Estimated weight

  // Update stats
  const as = $('active-sets');
  if (as) as.textContent = setsCompleted;
  const av = $('active-volume');
  if (av) av.textContent = `${totalVolume} kg`;

  // Activate next set
  const nextBtn = $(`set-${exerciseIdx}-${setIdx + 1}`);
  if (nextBtn) {
    nextBtn.classList.add('active-set');
  } else {
    // All sets for this exercise done
    const card = $(`aec-${exerciseIdx}`);
    if (card) card.classList.add('complete');
    // Move to next exercise
    const nextCard = $(`aec-${exerciseIdx + 1}`);
    if (nextCard) nextCard.classList.add('current');
  }

  // Start rest timer
  const restSecs = parseInt((STATE.activeWorkout.exercises[exerciseIdx]?.rest || '60 sec').replace(/\D/g, '')) || 60;
  startRestTimer(restSecs);
}

function startRestTimer(seconds) {
  STATE.restTotal = seconds;
  STATE.restSeconds = seconds;
  clearInterval(STATE.restTimer);

  const modal = $('rest-timer-modal');
  if (modal) modal.classList.remove('hidden');

  updateRestDisplay();
  STATE.restTimer = setInterval(() => {
    STATE.restSeconds--;
    updateRestDisplay();
    if (STATE.restSeconds <= 0) {
      clearInterval(STATE.restTimer);
      if (modal) modal.classList.add('hidden');
      showNotification('⚡ Rest done! Next set!');
    }
  }, 1000);
}

function updateRestDisplay() {
  const cd = $('rest-countdown');
  const fill = $('rest-progress-fill');
  if (cd) cd.textContent = STATE.restSeconds;
  if (fill) fill.style.width = `${(STATE.restSeconds / STATE.restTotal) * 100}%`;
}

function skipRest() {
  clearInterval(STATE.restTimer);
  const modal = $('rest-timer-modal');
  if (modal) modal.classList.add('hidden');
}

function toggleWorkoutTimer() {
  STATE.workoutPaused = !STATE.workoutPaused;
  const btn = document.querySelector('.btn-timer:not(.danger)');
  if (btn) btn.textContent = STATE.workoutPaused ? '▶ Resume' : '⏸ Pause';
}

function finishWorkout() {
  if (!STATE.activeWorkout) return;
  clearInterval(STATE.workoutTimer);
  skipRest();

  const cal = Math.round(STATE.workoutSeconds * 0.15) || STATE.activeWorkout.estimatedCalories || 300;
  const workouts = getWorkouts();
  workouts.push({
    id: Date.now(),
    name: STATE.activeWorkout.workoutName || 'Workout',
    date: Date.now(),
    duration: STATE.workoutSeconds,
    exercises: (STATE.activeWorkout.exercises || []).length,
    calories: cal,
    volume: totalVolume,
    setsCompleted: setsCompleted,
    muscleGroups: STATE.activeWorkout.muscleGroups || 'Full Body',
    aiGenerated: true
  });
  saveWorkouts(workouts);

  setsCompleted = 0;
  totalVolume = 0;
  STATE.activeWorkout = null;

  $('no-active-workout').style.display = 'block';
  $('active-workout-content').classList.add('hidden');

  updateDashboard();
  navigateTo('dashboard');
  showNotification(`🏆 Workout complete! ${cal} calories burned!`);
}

// ─── AI COACH CHAT ────────────────────────────────────────────────────────────
function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function sendQuickPrompt(btn) {
  const input = $('chat-input');
  if (input) {
    input.value = btn.textContent;
    sendChatMessage();
  }
  // Hide quick prompts after first use
  const qp = $('quick-prompts');
  if (qp) qp.style.display = 'none';
}

async function sendChatMessage() {
  const input = $('chat-input');
  const sendBtn = $('send-btn');
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  // Add user message
  appendMessage('user', message);

  // Add AI typing indicator
  const typingId = 'typing-' + Date.now();
  appendTyping(typingId);
  scrollChat();

  const model = $('chat-model-select')?.value || STATE.ollamaModel;
  const context = {
    userLevel: STATE.user?.level,
    userGoal: STATE.user?.goal,
    workoutsCompleted: getWorkouts().length
  };

  let fullResponse = '';

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context, model })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    removeTyping(typingId);
    const msgId = 'ai-msg-' + Date.now();
    appendAIMessage(msgId, '');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullResponse += data.token;
              updateAIMessage(msgId, fullResponse);
              scrollChat();
            }
            if (data.done) break;
            if (data.error) {
              updateAIMessage(msgId, `⚠️ ${data.error}`);
            }
          } catch { /* skip */ }
        }
      }
    }
  } catch (err) {
    removeTyping(typingId);
    appendMessage('ai', '🏋️ I am ready to help! For AI-powered answers, make sure Ollama is running locally. Meanwhile, I can still share workout tips from my built-in knowledge base. What would you like to know?');
  }

  sendBtn.disabled = false;
  scrollChat();
}

function appendMessage(type, text) {
  const msgs = $('chat-messages');
  const isUser = type === 'user';
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  div.innerHTML = `
    <div class="msg-avatar">${isUser ? '👤' : '🤖'}</div>
    <div class="msg-bubble">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
  msgs.appendChild(div);
}

function appendAIMessage(id, text) {
  const msgs = $('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-bubble" id="${id}-text">${text}</div>`;
  msgs.appendChild(div);
}

function updateAIMessage(id, text) {
  const el = $(`${id}-text`);
  if (el) el.innerHTML = formatAIText(text);
}

function appendTyping(id) {
  const msgs = $('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-bubble">
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  msgs.appendChild(div);
}

function removeTyping(id) {
  const el = $(id);
  if (el) el.remove();
}

function scrollChat() {
  const msgs = $('chat-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function formatAIText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── AI PROGRESS ANALYSIS ─────────────────────────────────────────────────────
async function getAIAnalysis() {
  const btn = document.querySelector('.ai-analyze-btn');
  const result = $('ai-analysis-result');
  if (!btn || !result) return;

  btn.textContent = '🤖 Analyzing...';
  btn.disabled = true;
  result.classList.add('hidden');

  const workouts = getWorkouts();
  const streak = calcStreak(workouts);
  const totalCalories = workouts.reduce((s, w) => s + (w.calories || 0), 0);
  const favMuscles = getMostFrequentMuscles(workouts);

  try {
    const res = await fetch('/api/ai/analyze-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workoutsCompleted: workouts.length,
        streak,
        totalCalories,
        favoriteExercises: favMuscles,
        model: STATE.ollamaModel
      })
    });
    const data = await res.json();
    result.innerHTML = formatAIText(data.analysis);
    result.classList.remove('hidden');
  } catch {
    result.innerHTML = "Keep pushing! Every workout counts. 💪";
    result.classList.remove('hidden');
  }

  btn.textContent = '🤖 Get AI Progress Analysis';
  btn.disabled = false;
}

function getMostFrequentMuscles(workouts) {
  if (!workouts.length) return 'various muscles';
  const counts = {};
  workouts.forEach(w => {
    if (w.muscleGroups) {
      w.muscleGroups.split(',').forEach(m => {
        const key = m.trim();
        counts[key] = (counts[key] || 0) + 1;
      });
    }
  });
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3).join(', ') || 'various muscles';
}

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAuth();
    skipRest();
  }
});
