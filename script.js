// StudyBuddy Application Engine
// Features: Task Manager, Pomodoro & Chess-Clock Timer, Calendar & Deadlines, LocalStorage Data Layer

const AudioEngine = {
  ctx: null,
  enabled: true,
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  playChime(type = 'success') {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
      } else if (type === 'alert') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(659.25, now + 0.15);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc.start(now);
        osc.stop(now + 0.9);
      }
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }
};

function toggleSound() {
  AudioEngine.enabled = !AudioEngine.enabled;
  document.getElementById('soundToggleBtn').innerHTML = AudioEngine.enabled ? '<span>🔔</span> Sound: On' : '<span>🔕</span> Sound: Off';
  showToast(AudioEngine.enabled ? 'Audio chimes enabled' : 'Audio chimes muted');
}

function showToast(message, title = 'StudyBuddy') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>⚡</span> <div><strong>${title}</strong><div style="font-size:0.8rem;color:var(--text-muted);">${message}</div></div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// State Store
const STORAGE_KEY = 'studybuddy_student_data_v1';

let appData = {
  tasks: [],
  deadlines: [],
  focusStats: {
    minutesToday: 0,
    completedSessions: 0,
    lastActiveDate: new Date().toDateString()
  },
  timerSettings: {
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    autoStart: false
  }
};

// Load from LocalStorage
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      appData = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse saved data", e);
    }
  } else {
    // Starter sample data
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 5);

    appData.tasks = [
      { id: '1', title: 'Complete Calculus Problem Set #4', subject: 'Math', priority: 'high', completed: false, createdAt: Date.now() },
      { id: '2', title: 'Draft Literature Essay on Shakespeare', subject: 'Literature', priority: 'medium', completed: false, createdAt: Date.now() },
      { id: '3', title: 'Review Data Structures Binary Trees slides', subject: 'Computer Science', priority: 'medium', completed: true, createdAt: Date.now() }
    ];

    appData.deadlines = [
      { id: 'd1', title: 'Calculus Assignment 4 Submission', date: tomorrow.toISOString().split('T')[0], time: '23:59', course: 'Math', priority: 'urgent', notes: 'Upload to canvas portal as PDF.' },
      { id: 'd2', title: 'Midterm Exam - Computer Science', date: nextWeek.toISOString().split('T')[0], time: '10:00', course: 'Computer Science', priority: 'urgent', notes: 'Room 304. Bring student ID.' }
    ];
    saveData();
  }

  // Check if day rolled over
  const todayStr = new Date().toDateString();
  if (appData.focusStats.lastActiveDate !== todayStr) {
    appData.focusStats.minutesToday = 0;
    appData.focusStats.lastActiveDate = todayStr;
    saveData();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  updateDashboardStats();
}

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');

  const activeBtn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.getAttribute('onclick').includes(tabId));
  if (activeBtn) activeBtn.classList.add('active');

  if (tabId === 'deadlines') renderCalendar();
  if (tabId === 'todo') renderTasks();
  if (tabId === 'dashboard') updateDashboard();
}

// Export & Import
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `studybuddy_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Data exported successfully! Keep this file as your backup.');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.tasks && imported.deadlines) {
        appData = imported;
        saveData();
        renderTasks();
        renderCalendar();
        updateDashboard();
        showToast('Backup restored successfully!');
      } else {
        alert('Invalid backup file structure.');
      }
    } catch (err) {
      alert('Error reading JSON file.');
    }
  };
  reader.readAsText(file);
}

// ==========================================
// TIMER ENGINE (POMODORO & CHESS CLOCK)
// ==========================================
let timerInterval = null;
let timerMode = 'pomodoro'; // 'pomodoro' | 'shortBreak' | 'longBreak' | 'chessClock'
let timerSecondsLeft = 25 * 60;
let timerTotalSeconds = 25 * 60;
let isTimerRunning = false;
let activeTaskId = null;

// Chess Clock State
let chessActiveSide = null; // 'study' | 'rest' | null
let chessStudySeconds = 0;
let chessRestSeconds = 0;
let chessInterval = null;

function setTimerType(type) {
  pauseTimer();
  timerMode = type;
  
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`mode-${type === 'shortBreak' ? 'short' : type === 'longBreak' ? 'long' : type === 'chessClock' ? 'chess' : 'pomodoro'}`);
  if (activeBtn) activeBtn.classList.add('active');

  const classicView = document.getElementById('classic-timer-view');
  const chessView = document.getElementById('chess-clock-view');

  if (type === 'chessClock') {
    classicView.style.display = 'none';
    chessView.style.display = 'block';
  } else {
    classicView.style.display = 'block';
    chessView.style.display = 'none';

    let mins = 25;
    let label = 'Focus Session';
    if (type === 'pomodoro') {
      mins = parseInt(appData.timerSettings.focus) || 25;
      label = 'Focus Session';
    } else if (type === 'shortBreak') {
      mins = parseInt(appData.timerSettings.shortBreak) || 5;
      label = 'Short Break';
    } else if (type === 'longBreak') {
      mins = parseInt(appData.timerSettings.longBreak) || 15;
      label = 'Long Rest';
    }

    timerTotalSeconds = mins * 60;
    timerSecondsLeft = timerTotalSeconds;
    document.getElementById('timer-mode-label').textContent = label;
    updateTimerDisplay();
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(timerSecondsLeft / 60);
  const secs = timerSecondsLeft % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  
  document.getElementById('timer-display').textContent = formatted;
  document.getElementById('dash-timer-disp').textContent = formatted;
  document.title = `(${formatted}) StudyBuddy - Focus`;

  // Update circular SVG progress
  const circle = document.getElementById('timer-progress');
  const circumference = 2 * Math.PI * 125;
  const fraction = timerSecondsLeft / timerTotalSeconds;
  const offset = circumference - (fraction * circumference);
  circle.style.strokeDashoffset = offset;
}

function toggleTimer() {
  AudioEngine.init();
  if (isTimerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  isTimerRunning = true;
  document.getElementById('timer-play-btn').textContent = '⏸';
  document.getElementById('dash-start-btn').textContent = '⏸ Pause Focus';
  
  timerInterval = setInterval(() => {
    if (timerSecondsLeft > 0) {
      timerSecondsLeft--;
      if (timerMode === 'pomodoro') {
        if (timerSecondsLeft % 60 === 0) {
          appData.focusStats.minutesToday += 1;
          saveData();
        }
      }
      updateTimerDisplay();
    } else {
      handleTimerComplete();
    }
  }, 1000);
}

function pauseTimer() {
  isTimerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('timer-play-btn').textContent = '▶';
  document.getElementById('dash-start-btn').textContent = '▶ Start Focus';
}

function resetTimer() {
  pauseTimer();
  timerSecondsLeft = timerTotalSeconds;
  updateTimerDisplay();
}

function adjustTime(minutes) {
  timerSecondsLeft = Math.max(60, timerSecondsLeft + (minutes * 60));
  timerTotalSeconds = Math.max(timerTotalSeconds, timerSecondsLeft);
  updateTimerDisplay();
}

function handleTimerComplete() {
  pauseTimer();
  AudioEngine.playChime('success');
  
  if (timerMode === 'pomodoro') {
    appData.focusStats.completedSessions += 1;
    saveData();
    showToast('Awesome job! Focus session completed. Take a break!', 'Focus Complete 🎉');
    if (appData.timerSettings.autoStart) {
      setTimerType('shortBreak');
      startTimer();
    } else {
      setTimerType('shortBreak');
    }
  } else {
    showToast('Break finished! Ready to dive back in?', 'Break Over ⚡');
    if (appData.timerSettings.autoStart) {
      setTimerType('pomodoro');
      startTimer();
    } else {
      setTimerType('pomodoro');
    }
  }
}

function skipSession() {
  if (timerMode === 'pomodoro') {
    setTimerType('shortBreak');
  } else {
    setTimerType('pomodoro');
  }
}

function updateCustomDurations() {
  appData.timerSettings.focus = parseInt(document.getElementById('setting-focus').value) || 25;
  appData.timerSettings.shortBreak = parseInt(document.getElementById('setting-short').value) || 5;
  appData.timerSettings.longBreak = parseInt(document.getElementById('setting-long').value) || 15;
  appData.timerSettings.autoStart = document.getElementById('setting-autostart').value === 'true';
  saveData();
  showToast('Timer settings updated!');
  setTimerType(timerMode);
}

// CHESS CLOCK LOGIC (Study / Rest Dual Clock)
function activateChessSide(side) {
  AudioEngine.init();
  const studyCard = document.getElementById('chess-study-card');
  const restCard = document.getElementById('chess-rest-card');

  if (chessActiveSide === side) {
    pauseChessClock();
    return;
  }

  chessActiveSide = side;
  clearInterval(chessInterval);

  studyCard.classList.remove('running');
  restCard.classList.remove('rest-running');

  if (side === 'study') {
    studyCard.classList.add('running');
    document.getElementById('chess-study-hint').textContent = 'Currently Studying... (Click to pause)';
    document.getElementById('chess-rest-hint').textContent = 'Click to switch to Rest';
  } else {
    restCard.classList.add('rest-running');
    document.getElementById('chess-rest-hint').textContent = 'Currently Resting... (Click to pause)';
    document.getElementById('chess-study-hint').textContent = 'Click to switch to Study';
  }

  chessInterval = setInterval(() => {
    if (chessActiveSide === 'study') {
      chessStudySeconds++;
      if (chessStudySeconds % 60 === 0) {
        appData.focusStats.minutesToday += 1;
        saveData();
      }
    } else if (chessActiveSide === 'rest') {
      chessRestSeconds++;
    }
    updateChessDisplay();
  }, 1000);
}

function pauseChessClock() {
  chessActiveSide = null;
  clearInterval(chessInterval);
  document.getElementById('chess-study-card').classList.remove('running');
  document.getElementById('chess-rest-card').classList.remove('rest-running');
  document.getElementById('chess-study-hint').textContent = 'Paused. Click to resume.';
  document.getElementById('chess-rest-hint').textContent = 'Paused. Click to resume.';
}

function resetChessClock() {
  pauseChessClock();
  chessStudySeconds = 0;
  chessRestSeconds = 0;
  updateChessDisplay();
  document.getElementById('chess-study-hint').textContent = 'Click to start studying';
  document.getElementById('chess-rest-hint').textContent = 'Click to switch to rest';
}

function updateChessDisplay() {
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  document.getElementById('chess-study-time').textContent = formatTime(chessStudySeconds);
  document.getElementById('chess-rest-time').textContent = formatTime(chessRestSeconds);
}

// Spacebar shortcut to switch chess sides
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && timerMode === 'chessClock' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    if (chessActiveSide === 'study') {
      activateChessSide('rest');
    } else {
      activateChessSide('study');
    }
  }
});

// ==========================================
// TO-DO LIST & TASK MANAGEMENT
// ==========================================
let taskFilter = 'all';

function setTaskFilter(filter, el) {
  taskFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderTasks();
}

function handleAddTask(e) {
  e.preventDefault();
  const titleInput = document.getElementById('task-title-input');
  const subjectInput = document.getElementById('task-subject-input');
  const priorityInput = document.getElementById('task-priority-input');

  const newTask = {
    id: 't_' + Date.now(),
    title: titleInput.value.trim(),
    subject: subjectInput.value,
    priority: priorityInput.value,
    completed: false,
    createdAt: Date.now()
  };

  appData.tasks.unshift(newTask);
  saveData();
  titleInput.value = '';
  renderTasks();
  showToast('Task added successfully!');
}

function toggleTask(id) {
  const task = appData.tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveData();
    renderTasks();
    if (task.completed) AudioEngine.playChime('success');
  }
}

function deleteTask(id) {
  appData.tasks = appData.tasks.filter(t => t.id !== id);
  saveData();
  renderTasks();
  showToast('Task removed');
}

function setFocusOnTask(id) {
  const task = appData.tasks.find(t => t.id === id);
  if (task) {
    activeTaskId = task.id;
    document.getElementById('active-task-label').textContent = `🎯 ${task.title}`;
    document.getElementById('dash-timer-task').textContent = `Focused on: ${task.title}`;
    switchTab('focus');
    showToast(`Focusing on: "${task.title}"`);
  }
}

function renderTasks() {
  const listEl = document.getElementById('full-task-list');
  const searchQuery = (document.getElementById('task-search-input')?.value || '').toLowerCase();

  let filtered = appData.tasks.filter(t => {
    if (taskFilter === 'active') return !t.completed;
    if (taskFilter === 'completed') return t.completed;
    if (taskFilter === 'urgent') return t.priority === 'high' && !t.completed;
    return true;
  });

  if (searchQuery) {
    filtered = filtered.filter(t => 
      t.title.toLowerCase().includes(searchQuery) || 
      t.subject.toLowerCase().includes(searchQuery)
    );
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>No tasks found. Add a task above to stay on track!</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(t => {
    const priorityBadge = t.priority === 'high' 
      ? `<span class="badge badge-urgent">High</span>` 
      : t.priority === 'medium' 
      ? `<span class="badge badge-medium">Medium</span>` 
      : `<span class="badge badge-low">Low</span>`;

    return `
      <div class="task-item ${t.completed ? 'completed' : ''}">
        <div class="task-left">
          <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}')">
          <div class="task-content">
            <div class="task-text">${escapeHtml(t.title)}</div>
            <div class="task-tags">
              <span class="badge badge-subject">${escapeHtml(t.subject)}</span>
              ${priorityBadge}
            </div>
          </div>
        </div>
        <div class="task-right">
          ${!t.completed ? `<button class="btn btn-secondary btn-sm" onclick="setFocusOnTask('${t.id}')" title="Start timer on this task">⏱️ Focus</button>` : ''}
          <button class="icon-btn btn-sm" onclick="deleteTask('${t.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// DEADLINES & CALENDAR VIEW
// ==========================================
let currentCalDate = new Date();

function renderCalendar() {
  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  document.getElementById('cal-month-year').textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cellsContainer = document.getElementById('calendar-cells');
  cellsContainer.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const cell = document.createElement('div');
    cell.className = 'cal-cell other-month';
    cell.innerHTML = `<span class="cal-date-num">${dayNum}</span>`;
    cellsContainer.appendChild(cell);
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = appData.deadlines.filter(d => d.date === dateStr);
    
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (dateStr === todayStr) cell.classList.add('today');

    let dotsHtml = '';
    if (dayEvents.length > 0) {
      dotsHtml = `<div class="cal-dots">${dayEvents.map(e => `<div class="cal-dot" title="${escapeHtml(e.title)}" style="background: ${e.priority === 'urgent' ? 'var(--accent-rose)' : 'var(--accent-blue)'}"></div>`).join('')}</div>`;
    }

    cell.innerHTML = `
      <span class="cal-date-num">${day}</span>
      ${dotsHtml}
    `;

    cell.onclick = () => {
      document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      renderDeadlinesFeed(dateStr);
    };

    cellsContainer.appendChild(cell);
  }

  renderDeadlinesFeed();
}

function changeMonth(delta) {
  currentCalDate.setMonth(currentCalDate.getMonth() + delta);
  renderCalendar();
}

function jumpToToday() {
  currentCalDate = new Date();
  renderCalendar();
}

function renderDeadlinesFeed(selectedDate = null) {
  const feedEl = document.getElementById('calendar-deadline-feed');
  const badgeEl = document.getElementById('deadline-count-badge');

  let list = [...appData.deadlines];
  if (selectedDate) {
    list = list.filter(d => d.date === selectedDate);
  }

  // Sort by date ascending
  list.sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));

  if (badgeEl) badgeEl.textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;

  if (list.length === 0) {
    feedEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <p>${selectedDate ? `No deadlines on ${selectedDate}` : 'No upcoming deadlines. You are all caught up!'}</p>
      </div>
    `;
    return;
  }

  feedEl.innerHTML = list.map(d => {
    const dueObj = new Date(`${d.date}T${d.time || '23:59'}`);
    const now = new Date();
    const diffHours = (dueObj - now) / (1000 * 60 * 60);

    let urgencyClass = '';
    let countdownText = '';
    if (diffHours < 0) {
      countdownText = 'Passed';
      urgencyClass = 'urgent';
    } else if (diffHours <= 24) {
      countdownText = `Due in ${Math.round(diffHours)} hours!`;
      urgencyClass = 'urgent';
    } else if (diffHours <= 72) {
      countdownText = `Due in ${Math.round(diffHours / 24)} days`;
      urgencyClass = 'soon';
    } else {
      countdownText = `${d.date}`;
    }

    return `
      <div class="deadline-card ${urgencyClass}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <strong style="font-size: 0.95rem;">${escapeHtml(d.title)}</strong>
          <button class="icon-btn btn-sm" onclick="deleteDeadline('${d.id}')" title="Delete">✕</button>
        </div>
        <div class="deadline-time">
          <span>📅 ${countdownText} (${d.time || 'All day'})</span>
          <span class="badge badge-subject">${escapeHtml(d.course || 'General')}</span>
        </div>
        ${d.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(d.notes)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function openEventModal() {
  document.getElementById('event-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('event-modal').classList.add('active');
}

function closeEventModal() {
  document.getElementById('event-modal').classList.remove('active');
}

function handleAddEvent(e) {
  e.preventDefault();
  const title = document.getElementById('event-title').value.trim();
  const date = document.getElementById('event-date').value;
  const time = document.getElementById('event-time').value;
  const course = document.getElementById('event-course').value.trim();
  const priority = document.getElementById('event-priority').value;
  const notes = document.getElementById('event-notes').value.trim();

  const newEvent = {
    id: 'd_' + Date.now(),
    title,
    date,
    time,
    course,
    priority,
    notes
  };

  appData.deadlines.push(newEvent);
  saveData();
  closeEventModal();
  renderCalendar();
  showToast('Deadline saved to calendar!');
  e.target.reset();
}

function deleteDeadline(id) {
  appData.deadlines = appData.deadlines.filter(d => d.id !== id);
  saveData();
  renderCalendar();
  showToast('Deadline removed');
}

// ==========================================
// DASHBOARD & STATS UPDATE
// ==========================================
function updateDashboardStats() {
  document.getElementById('stat-focus-min').textContent = appData.focusStats.minutesToday || 0;
  
  const totalTasks = appData.tasks.length;
  const completedTasks = appData.tasks.filter(t => t.completed).length;
  document.getElementById('stat-completed-tasks').textContent = `${completedTasks}/${totalTasks}`;
  
  document.getElementById('stat-sessions-count').textContent = appData.focusStats.completedSessions || 0;

  const now = new Date();
  const urgentCount = appData.deadlines.filter(d => {
    const dueObj = new Date(`${d.date}T${d.time || '23:59'}`);
    const diffHours = (dueObj - now) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 48;
  }).length;
  document.getElementById('stat-urgent-deadlines').textContent = urgentCount;
}

function updateDashboard() {
  updateDashboardStats();

  const dashTasksEl = document.getElementById('dash-tasks-list');
  const incompleteTasks = appData.tasks.filter(t => !t.completed).slice(0, 3);

  if (incompleteTasks.length === 0) {
    dashTasksEl.innerHTML = `<div class="empty-state" style="padding:1rem;"><p>No active tasks! You are all caught up.</p></div>`;
  } else {
    dashTasksEl.innerHTML = incompleteTasks.map(t => `
      <div class="task-item">
        <div class="task-left">
          <input type="checkbox" class="task-checkbox" onchange="toggleTask('${t.id}')">
          <div class="task-content">
            <div class="task-text">${escapeHtml(t.title)}</div>
            <div class="task-tags"><span class="badge badge-subject">${escapeHtml(t.subject)}</span></div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="setFocusOnTask('${t.id}')">⏱️ Focus</button>
      </div>
    `).join('');
  }

  const dashDeadlinesEl = document.getElementById('dash-deadlines-list');
  const upcoming = [...appData.deadlines]
    .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`))
    .slice(0, 4);

  if (upcoming.length === 0) {
    dashDeadlinesEl.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><p>No upcoming deadlines recorded.</p></div>`;
  } else {
    dashDeadlinesEl.innerHTML = upcoming.map(d => `
      <div class="deadline-card ${d.priority === 'urgent' ? 'urgent' : ''}">
        <div style="font-weight: 600; font-size: 0.95rem;">${escapeHtml(d.title)}</div>
        <div class="deadline-time">📅 ${d.date} at ${d.time || '23:59'}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(d.course || 'Academic')}</div>
      </div>
    `).join('');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function checkDeadlineReminders() {
  const now = new Date();
  appData.deadlines.forEach(d => {
    const due = new Date(`${d.date}T${d.time || '23:59'}`);
    const diffMinutes = Math.round((due - now) / (1000 * 60));
    
    if (diffMinutes > 0 && diffMinutes <= 30) {
      showToast(`"${d.title}" is due in ${diffMinutes} minutes!`, '🚨 Deadline Reminder');
      AudioEngine.playChime('alert');
    }
  });
}

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderTasks();
  updateDashboard();
  setTimerType('pomodoro');
  setInterval(checkDeadlineReminders, 60000);
});
