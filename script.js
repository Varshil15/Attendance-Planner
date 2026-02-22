// Data Storage
let timetable = JSON.parse(localStorage.getItem('timetable')) || {};
let attendance = JSON.parse(localStorage.getItem('attendance')) || {};
let extraLectures = JSON.parse(localStorage.getItem('extraLectures')) || {};
let initialAttendance = JSON.parse(localStorage.getItem('initialAttendance')) || {};

// Auth State
let currentUserId = null;

// ===================== CUSTOM DIALOGS =====================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="dismissToast(this.parentElement)">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => dismissToast(toast), 4500);
}

function dismissToast(toast) {
    if (!toast || toast.classList.contains('toast-hiding')) return;
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 260);
}

function showConfirm(title, message, confirmText = 'Confirm', confirmClass = 'btn-danger') {
    return new Promise(resolve => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').textContent = message;
        const okBtn = document.getElementById('confirmModalOk');
        okBtn.textContent = confirmText;
        okBtn.className = `btn ${confirmClass}`;
        modal.classList.add('active');

        const handleOk     = () => { cleanup(); resolve(true); };
        const handleCancel = () => { cleanup(); resolve(false); };
        const handleBdrop  = (e) => { if (e.target === modal) { cleanup(); resolve(false); } };

        function cleanup() {
            modal.classList.remove('active');
            okBtn.removeEventListener('click', handleOk);
            document.getElementById('confirmModalCancel').removeEventListener('click', handleCancel);
            modal.removeEventListener('click', handleBdrop);
        }

        okBtn.addEventListener('click', handleOk);
        document.getElementById('confirmModalCancel').addEventListener('click', handleCancel);
        modal.addEventListener('click', handleBdrop);
    });
}

// Edit Lecture Modal state
let _editLectureDay = null;
let _editLectureId  = null;

function openEditLectureModal(day, lectureId) {
    const lectures = timetable[day];
    if (!lectures) return;
    const lecture = lectures.find(l => l.id === lectureId);
    if (!lecture) return;
    _editLectureDay = day;
    _editLectureId  = lectureId;
    document.getElementById('editLectureSubject').value = lecture.subject;
    document.getElementById('editLectureType').value    = lecture.type || 'Lecture';
    document.getElementById('editLectureModal').classList.add('active');
}

function closeEditLectureModal() {
    document.getElementById('editLectureModal').classList.remove('active');
    _editLectureDay = null;
    _editLectureId  = null;
}

function saveEditLecture() {
    const subject = document.getElementById('editLectureSubject').value.trim();
    const type    = document.getElementById('editLectureType').value;
    if (!subject) {
        showToast('Please enter a subject name!', 'warning');
        return;
    }
    const lectures = timetable[_editLectureDay];
    if (!lectures) return;
    const lecture = lectures.find(l => l.id === _editLectureId);
    if (!lecture) return;
    lecture.subject = subject;
    lecture.type    = type;
    saveTimetable();
    renderTimetable();
    updateStats();
    closeEditLectureModal();
    showToast('Lecture updated successfully!', 'success');
}

// ===================== END CUSTOM DIALOGS =====================


// Theme Management
function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLightMode = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    // Default is dark mode, only add light-mode class if explicitly saved as light
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
}

// ============================================
// Auth-aware Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async function () {
    // Load theme preference
    loadTheme();
    
    // Set up modal close listeners (these work regardless of auth)
    setupModalCloseListeners();

    // Check for existing session
    const user = await getCurrentUser();
    if (user) {
        await handleUserLoggedIn(user);
    } else {
        showLoginScreen();
    }

    // Listen for auth state changes (handles OAuth redirect)
    onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            await handleUserLoggedIn(session.user);
        } else if (event === 'SIGNED_OUT') {
            handleUserLoggedOut();
        }
    });
});

async function handleUserLoggedIn(user) {
    currentUserId = user.id;
    showLoading();

    // Update user profile in Supabase
    await upsertUserProfile(user);

    // Reset in-memory data before loading (ensures no leftover from previous user)
    timetable = {};
    attendance = {};
    extraLectures = {};
    initialAttendance = {};

    // Load data from Supabase
    const userData = await loadUserData(user.id);
    if (userData) {
        timetable = userData.timetable || {};
        attendance = userData.attendance || {};
        extraLectures = userData.extra_lectures || {};
        initialAttendance = userData.initial_attendance || {};
        // Sync to localStorage as cache
        localStorage.setItem('timetable', JSON.stringify(timetable));
        localStorage.setItem('attendance', JSON.stringify(attendance));
        localStorage.setItem('extraLectures', JSON.stringify(extraLectures));
        localStorage.setItem('initialAttendance', JSON.stringify(initialAttendance));
    } else {
        // First time user - check if they have localStorage data to migrate
        if (Object.keys(timetable).length > 0 || Object.keys(attendance).length > 0) {
            // Migrate existing localStorage data to Supabase
            await saveUserData(user.id, {
                timetable, attendance,
                extraLectures, initialAttendance
            });
        }
    }

    // Update UI with user info
    updateUserProfileUI(user);

    // Initialize app
    initializeTabs();
    renderTimetable();
    updateStats();
    setTodayDate();
    renderAttendanceLectures();
    renderDashboardSubjects();
    renderFuturePlanner();

    hideLoading();
    showApp();
}

function handleUserLoggedOut() {
    currentUserId = null;
    // Clear localStorage so next user doesn't see old data
    localStorage.removeItem('timetable');
    localStorage.removeItem('attendance');
    localStorage.removeItem('extraLectures');
    localStorage.removeItem('initialAttendance');
    // Reset in-memory data
    timetable = {};
    attendance = {};
    extraLectures = {};
    initialAttendance = {};
    hideApp();
    showLoginScreen();
}

async function handleLogout() {
    const confirmed = await showConfirm('Sign Out', 'Are you sure you want to sign out?', 'Sign Out', 'btn-danger');
    if (confirmed) {
        await signOutUser();
    }
}

function updateUserProfileUI(user) {
    const avatar = document.getElementById('userAvatar');
    const name = document.getElementById('userName');
    avatar.src = user.user_metadata?.avatar_url || '';
    avatar.alt = user.user_metadata?.full_name || 'User';
    name.textContent = user.user_metadata?.full_name || user.email || 'User';
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appContainer').style.display = 'none';
}

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appContainer').style.display = '';
}

function hideApp() {
    document.getElementById('appContainer').style.display = 'none';
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

// Sync all data to Supabase (debounced)
function syncToSupabase() {
    if (currentUserId) {
        debouncedSaveUserData(currentUserId, {
            timetable, attendance,
            extraLectures, initialAttendance
        });
    }
}

// Tab Switching
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // Refresh content
    if (tabName === 'attendance') {
        renderAttendanceCalendar();
        renderAttendanceLectures();
    } else if (tabName === 'dashboard') {
        renderDashboardSubjects();
    } else if (tabName === 'future') {
        renderFuturePlanner();
    }
}

// Timetable Management
function openAddLectureModal() {
    document.getElementById('lectureModal').classList.add('active');
}

function closeLectureModal() {
    document.getElementById('lectureModal').classList.remove('active');
    clearLectureForm();
}

function clearLectureForm() {
    document.getElementById('lectureSubject').value = '';
}

function saveLecture() {
    const day = document.getElementById('lectureDay').value;
    const subject = document.getElementById('lectureSubject').value.trim();

    if (!subject) {
        showToast('Please enter a subject name!', 'warning');
        return;
    }

    if (!timetable[day]) {
        timetable[day] = [];
    }

    const lecture = {
        id: Date.now(),
        subject: subject
    };

    timetable[day].push(lecture);
    saveTimetable();
    renderTimetable();
    updateStats();
    closeLectureModal();
}

async function deleteLecture(day, lectureId) {
    const confirmed = await showConfirm('Delete Lecture', 'Are you sure you want to delete this lecture?', 'Delete', 'btn-danger');
    if (!confirmed) return;

    timetable[day] = timetable[day].filter(lecture => lecture.id !== lectureId);
    if (timetable[day].length === 0) {
        delete timetable[day];
    }
    saveTimetable();
    renderTimetable();
    updateStats();
}

function renderTimetable() {
    const grid = document.getElementById('timetableGrid');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (Object.keys(timetable).length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <div class="empty-state-text">No timetable added yet</div>
                <button class="btn btn-primary" onclick="openAddLectureModal()">
                    ➕ Add Your First Lecture
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = days.map(day => {
        const lectures = timetable[day] || [];
        return `
            <div class="day-card">
                <div class="day-header" style="display: flex; align-items: center; justify-content: space-between;">
                    <span>${day}</span>
                    <button class="btn-icon" title="Edit Day" onclick="openEditDayModal('${day}')">✏️</button>
                </div>
                ${lectures.length === 0 ?
                '<div style="color: var(--gray); text-align: center; padding: 20px;">No lectures</div>' :
                lectures.map(lecture => `
                        <div class="lecture-item">
                            <div class="lecture-info">
                                <div class="lecture-name">${lecture.subject} (${lecture.type ? lecture.type : 'Lecture'})</div>
                            </div>
                            <div class="lecture-actions">
                                <button class="btn-icon" title="Delete" onclick="deleteLecture('${day}', ${lecture.id})">🗑️</button>
                            </div>
                        </div>
                    `).join('')
            }
            </div>
        `;
    }).join('');
}

function editLecture(day, lectureId) {
    openEditLectureModal(day, lectureId);
}

function moveLecture(day, idx, direction) {
    const lectures = timetable[day];
    const newIndex = idx + direction;
    if (newIndex < 0 || newIndex >= lectures.length) return;
    const temp = lectures[idx];
    lectures[idx] = lectures[newIndex];
    lectures[newIndex] = temp;
    saveTimetable();
    renderTimetable();
}

// ===================== ATTENDANCE MANAGEMENT =====================
// Week start = Sunday of the week containing attCalSelectedDate
function getWeekStart(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - d.getDay()); // rewind to Sunday
    return d;
}

let attCalSelectedDate = new Date().toISOString().split('T')[0];
let attWeekSunday = getWeekStart(attCalSelectedDate); // Date object, always a Sunday

function setTodayDate() {
    const today = new Date();
    attCalSelectedDate = today.toISOString().split('T')[0];
    attWeekSunday = getWeekStart(attCalSelectedDate);
    renderAttendanceCalendar();
    renderAttendanceLectures();
}

function attWeekPrev() {
    attWeekSunday = new Date(attWeekSunday);
    attWeekSunday.setDate(attWeekSunday.getDate() - 7);
    renderAttendanceCalendar();
}

function attWeekNext() {
    attWeekSunday = new Date(attWeekSunday);
    attWeekSunday.setDate(attWeekSunday.getDate() + 7);
    renderAttendanceCalendar();
}

function getDateStatus(dateKey) {
    const date = new Date(dateKey + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const allLectures = [...(timetable[dayName] || []), ...(extraLectures[dateKey] || [])];
    if (allLectures.length === 0) return null;

    let attended = 0, absent = 0, nc = 0, unmarked = 0;
    allLectures.forEach(l => {
        const s = attendance[`${dateKey}-${l.id}`] || 'none';
        if (s === 'attended')           attended++;
        else if (s === 'absent')        absent++;
        else if (s === 'not-conducted') nc++;
        else                            unmarked++;
    });

    if (unmarked > 0 && (attended + absent + nc) === 0) return 'unmarked';
    if (attended > 0 && absent === 0 && unmarked === 0)  return 'attended';
    if (absent > 0 && attended === 0 && unmarked === 0)  return 'absent';
    if (nc === allLectures.length)                       return 'nc';
    return 'mixed';
}

function renderAttendanceCalendar() {
    const strip  = document.getElementById('attWeekStrip');
    const label  = document.getElementById('attWeekLabel');
    if (!strip || !label) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const dayAbbr  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const monthAbbr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Build 7 days starting from attWeekSunday
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(attWeekSunday);
        d.setDate(d.getDate() + i);
        days.push(d);
    }

    // Label: e.g. "Feb 22 – Feb 28"
    const first = days[0], last = days[6];
    label.textContent = `${monthAbbr[first.getMonth()]} ${first.getDate()} – ${monthAbbr[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;

    strip.innerHTML = days.map(d => {
        const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const isToday    = dateKey === todayStr;
        const isSelected = dateKey === attCalSelectedDate;
        const status     = getDateStatus(dateKey);

        let dotHtml = '';
        if (status === 'attended')  dotHtml = `<div class="att-week-dot-row"><div class="att-week-dot dot-attended"></div></div>`;
        else if (status === 'absent')   dotHtml = `<div class="att-week-dot-row"><div class="att-week-dot dot-absent"></div></div>`;
        else if (status === 'nc')       dotHtml = `<div class="att-week-dot-row"><div class="att-week-dot dot-nc"></div></div>`;
        else if (status === 'mixed')    dotHtml = `<div class="att-week-dot-row"><div class="att-week-dot dot-attended"></div><div class="att-week-dot dot-absent"></div></div>`;
        else if (status === 'unmarked') dotHtml = `<div class="att-week-dot-row"><div class="att-week-dot dot-unmarked"></div></div>`;
        else                            dotHtml = `<div class="att-week-dot-row"></div>`;

        const cls = [
            'att-week-day',
            isToday    ? 'att-week-day-today'    : '',
            isSelected ? 'att-week-day-selected' : '',
        ].filter(Boolean).join(' ');

        return `
            <div class="${cls}" onclick="selectAttDate('${dateKey}')">
                <span class="att-week-day-name">${dayAbbr[d.getDay()]}</span>
                <span class="att-week-day-num">${d.getDate()}</span>
                ${dotHtml}
            </div>`;
    }).join('');
}

function selectAttDate(dateStr) {
    attCalSelectedDate = dateStr;
    renderAttendanceCalendar();
    renderAttendanceLectures();
}

function renderAttendanceLectures() {
    const dateKey = attCalSelectedDate;
    if (!dateKey) return;

    const date = new Date(dateKey + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dayFull  = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const timetableLectures    = timetable[dayName] || [];
    const extraLecturesForDate = extraLectures[dateKey] || [];
    const allLectures = [...timetableLectures, ...extraLecturesForDate];

    // --- Date Banner ---
    const banner = document.getElementById('attDateBanner');
    if (banner) {
        let attended = 0, absent = 0, nc = 0, total = 0;
        allLectures.forEach(l => {
            const s = attendance[`${dateKey}-${l.id}`] || 'none';
            total++;
            if (s === 'attended')      attended++;
            else if (s === 'absent')   absent++;
            else if (s === 'not-conducted') nc++;
        });

        const isToday = dateKey === new Date().toISOString().split('T')[0];
        banner.innerHTML = `
            <div class="att-date-banner-left">
                <span class="att-date-banner-day">${isToday ? '🗓️ Today' : dayName}</span>
                <span class="att-date-banner-full">${dayFull}</span>
            </div>
            <div class="att-date-banner-chips">
                <span class="att-chip att-chip-total">📋 ${total} lecture${total !== 1 ? 's' : ''}</span>
                ${attended > 0  ? `<span class="att-chip att-chip-green">✅ ${attended}</span>` : ''}
                ${absent > 0    ? `<span class="att-chip att-chip-red">❌ ${absent}</span>` : ''}
                ${nc > 0        ? `<span class="att-chip att-chip-gray">🚫 ${nc}</span>` : ''}
            </div>
        `;
    }

    // --- Lecture Cards ---
    const container = document.getElementById('attendanceLectures');
    if (allLectures.length === 0) {
        container.innerHTML = `
            <div class="att-empty">
                <div class="att-empty-icon">📚</div>
                <div class="att-empty-text">No lectures on ${dayName}</div>
                <div class="att-empty-sub">Add a lecture via the Timetable tab or use Quick Actions ➕</div>
            </div>
        `;
        return;
    }

    container.innerHTML = allLectures.map(lecture => {
        const lectureKey = `${dateKey}-${lecture.id}`;
        const status = attendance[lectureKey] || 'none';
        const isExtra = lecture.isExtra || false;
        const type = lecture.type || 'Lecture';

        const badgeClass = isExtra ? 'att-badge-extra' : (type === 'Lab' ? 'att-badge-lab' : 'att-badge-lecture');
        const badgeIcon  = isExtra ? '⚡' : (type === 'Lab' ? '🔬' : '📖');

        const pillMap = {
            attended:      '<span class="att-status-pill attended">✅ Attended</span>',
            absent:        '<span class="att-status-pill absent">❌ Absent</span>',
            'not-conducted': '<span class="att-status-pill nc">🚫 Not Conducted</span>',
            none:          '<span class="att-status-pill unmarked">⏳ Unmarked</span>',
        };

        return `
            <div class="att-lecture-card">
                <div class="att-lecture-card-header">
                    <div class="att-lecture-type-badge ${badgeClass}">${badgeIcon}</div>
                    <div class="att-lecture-meta">
                        <div class="att-lecture-name">${lecture.subject}</div>
                        <div class="att-lecture-sub">${type}${isExtra ? ' &nbsp;·&nbsp; <span style="color:var(--warning)">Extra</span>' : ''}</div>
                    </div>
                    ${pillMap[status] || pillMap['none']}
                </div>
                <div class="att-btns-row">
                    <button class="att-mark-btn ${status === 'attended' ? 'active-attended' : ''}"
                            onclick="markAttendance('${lectureKey}', 'attended')">
                        <div class="btn-check-indicator"></div>✅ Attended
                    </button>
                    <button class="att-mark-btn ${status === 'absent' ? 'active-absent' : ''}"
                            onclick="markAttendance('${lectureKey}', 'absent')">
                        <div class="btn-check-indicator"></div>❌ Absent
                    </button>
                    <button class="att-mark-btn ${status === 'not-conducted' ? 'active-nc' : ''}"
                            onclick="markAttendance('${lectureKey}', 'not-conducted')">
                        <div class="btn-check-indicator"></div>🚫 N/C
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function markAttendance(lectureKey, status) {
    attendance[lectureKey] = status;
    saveAttendance();
    renderAttendanceCalendar();
    renderAttendanceLectures();
    updateStats();
}

// Statistics Calculation
function updateStats() {
    let totalLectures = 0;
    let attendedLectures = 0;

    // Add initial attendance data
    Object.keys(initialAttendance).forEach(subject => {
        const data = initialAttendance[subject];
        totalLectures += data.conducted;
        attendedLectures += data.attended;
    });

    // Add current attendance data
    Object.keys(attendance).forEach(key => {
        const status = attendance[key];
        if (status !== 'not-conducted') {
            totalLectures++;
            if (status === 'attended') {
                attendedLectures++;
            }
        }
    });

    const percentage = totalLectures > 0 ? ((attendedLectures / totalLectures) * 100).toFixed(2) : 0;

    // Update stats cards
    document.getElementById('currentPercentage').textContent = percentage + '%';
    document.getElementById('totalConducted').textContent = totalLectures;
    document.getElementById('totalAttended').textContent = attendedLectures;

    // Count unique subjects (Lecture and Lab are different)
    const subjects = new Set();
    Object.values(timetable).forEach(lectures => {
        lectures.forEach(lecture => {
            const type = lecture.type || 'Lecture';
            subjects.add(`${lecture.subject} (${type})`);
        });
    });
    Object.keys(initialAttendance).forEach(displayName => {
        subjects.add(displayName);
    });
    document.getElementById('totalSubjects').textContent = subjects.size;

    // Update progress bar
    updateProgressBar(percentage);

    // Update dashboard alerts
    updateDashboardAlerts(percentage);

    // Update dashboard subjects
    renderDashboardSubjects();
}

function updateProgressBar(percentage) {
    const fill = document.getElementById('progressFill');
    const label = document.getElementById('progressPercentage');
    const attendedCount = document.getElementById('attendedCount');
    const conductedCount = document.getElementById('conductedCount');
    const requiredCount = document.getElementById('requiredCount');

    // Calculate stats for display
    let totalLectures = 0;
    let attendedLectures = 0;

    // Add initial attendance data
    Object.keys(initialAttendance).forEach(subject => {
        const data = initialAttendance[subject];
        totalLectures += data.conducted;
        attendedLectures += data.attended;
    });

    // Add current attendance data
    Object.keys(attendance).forEach(key => {
        const status = attendance[key];
        if (status !== 'not-conducted') {
            totalLectures++;
            if (status === 'attended') {
                attendedLectures++;
            }
        }
    });

    // Calculate required lectures for 75%
    const requiredFor75 = totalLectures > 0 ? Math.max(0, Math.ceil(totalLectures * 0.75) - attendedLectures) : 0;

    // Update progress bar
    fill.style.width = percentage + '%';
    label.textContent = Math.round(percentage);
    
    // Update stats
    if (attendedCount) attendedCount.textContent = attendedLectures;
    if (conductedCount) conductedCount.textContent = totalLectures;
    if (requiredCount) requiredCount.textContent = requiredFor75;

    // Change color based on percentage
    if (percentage >= 75) {
        fill.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
        label.parentElement.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    } else if (percentage >= 65) {
        fill.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)';
        label.parentElement.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    } else {
        fill.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)';
        label.parentElement.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    }
}

function updateDashboardAlerts(percentage) {
    const alertContainer = document.getElementById('dashboardAlert');

    if (percentage >= 75) {
        alertContainer.innerHTML = `
            <div class="alert alert-success">
                <span>✅</span>
                <span>Great! Your attendance is above 75%. Keep it up!</span>
            </div>
        `;
    } else if (percentage >= 65) {
        alertContainer.innerHTML = `
            <div class="alert alert-warning">
                <span>⚠️</span>
                <span>Warning! Your attendance is below 75%. You need to attend more lectures.</span>
            </div>
        `;
    } else if (percentage > 0) {
        alertContainer.innerHTML = `
            <div class="alert alert-danger">
                <span>🚨</span>
                <span>Critical! Your attendance is dangerously low. Immediate action required!</span>
            </div>
        `;
    } else {
        alertContainer.innerHTML = '';
    }
}

// Subject-wise Attendance (Dashboard)
function renderDashboardSubjects() {
    const container = document.getElementById('dashboardSubjectsGrid');
    if (!container) return; // Container doesn't exist

    const subjects = {}; // Now keyed by "SubjectName|Type"

    // Add initial attendance data with displayName as key
    Object.keys(initialAttendance).forEach(displayName => {
        const data = initialAttendance[displayName];
        if (!subjects[displayName]) {
            subjects[displayName] = {
                displayName: displayName,
                total: 0,
                attended: 0,
                type: data.type || (displayName.endsWith('(Lab)') ? 'Lab' : 'Lecture')
            };
        }
        subjects[displayName].total += data.conducted;
        subjects[displayName].attended += data.attended;
    });

    // Collect all subjects from timetable with their types as displayName
    Object.values(timetable).forEach(lectures => {
        lectures.forEach(lecture => {
            const type = lecture.type || 'Lecture';
            const displayName = `${lecture.subject} (${type})`;
            if (!subjects[displayName]) {
                subjects[displayName] = {
                    displayName: displayName,
                    type: type,
                    total: 0,
                    attended: 0
                };
            }
        });
    });

    // Calculate attendance for each subject+type from current attendance records
    Object.keys(attendance).forEach(key => {
        const status = attendance[key];
        const lectureId = parseInt(key.split('-')[2]);
        // Find subject for this lecture in timetable
        Object.values(timetable).forEach(lectures => {
            const lecture = lectures.find(l => l.id === lectureId);
            if (lecture && status !== 'not-conducted') {
                const type = lecture.type || 'Lecture';
                const displayName = `${lecture.subject} (${type})`;
                if (!subjects[displayName]) {
                    subjects[displayName] = {
                        displayName: displayName,
                        type: type,
                        total: 0,
                        attended: 0
                    };
                }
                subjects[displayName].total++;
                if (status === 'attended') {
                    subjects[displayName].attended++;
                }
            }
        });
        // Check extra lectures
        Object.keys(extraLectures).forEach(date => {
            const extraLecturesList = extraLectures[date];
            const lecture = extraLecturesList.find(l => l.id === lectureId);
            if (lecture && status !== 'not-conducted') {
                const type = lecture.type || 'Lecture';
                const displayName = `${lecture.subject} (${type})`;
                if (!subjects[displayName]) {
                    subjects[displayName] = {
                        displayName: displayName,
                        type: type,
                        total: 0,
                        attended: 0
                    };
                }
                subjects[displayName].total++;
                if (status === 'attended') {
                    subjects[displayName].attended++;
                }
            }
        });
    });

    if (Object.keys(subjects).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📖</div>
                <div class="empty-state-text">Add subjects to your timetable or add conducted lectures</div>
            </div>
        `;
        return;
    }

    container.innerHTML = Object.keys(subjects).map(key => {
        const data = subjects[key];
        const percentage = data.total > 0 ? ((data.attended / data.total) * 100).toFixed(2) : 0;
        let percentageClass = 'percentage-good';
        if (percentage < 75) percentageClass = 'percentage-danger';
        else if (percentage < 80) percentageClass = 'percentage-warning';
        const typeIcon = data.type === 'Lab' ? '🔬' : '📚';
        return `
            <div class="subject-card">
                <div class="subject-name">${data.displayName}</div>
                <div class="subject-stats">
                    <span>📊 ${data.attended}/${data.total} classes</span>
                </div>
                <div class="subject-percentage ${percentageClass}">
                    ${percentage}%
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Future Planning
let futurePlanStates = {}; // Stores simulated attendance states for future planning

function renderFuturePlanner() {
    const grid = document.getElementById('futureTimetableGrid');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (Object.keys(timetable).length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <div class="empty-state-text">No timetable added yet. Add lectures in the Timetable tab first.</div>
            </div>
        `;
        updateFutureProjection();
        return;
    }

    // Create table structure with days as columns
    grid.innerHTML = `
        <div style="overflow-x: auto;">
            <div style="display: flex; gap: 16px; min-width: 100%;">
                ${days.map(day => {
        const lectures = timetable[day] || [];
        return `
                        <div style="flex: 1; min-width: 180px; background: rgba(255,255,255,0.9); border: 2px solid rgba(148,163,184,0.2); border-radius: 14px; overflow: hidden; transition: all 0.2s ease;">
                            <div style="background: linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #818cf8 100%); padding: 16px; text-align: center;">
                                <div style="color: white; font-weight: 800; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.8px;">${day}</div>
                            </div>
                            <div style="padding: 12px;">
                                ${lectures.length === 0 ?
                '<div style="color: #94a3b8; text-align: center; padding: 40px 10px; font-size: 0.9em;">No lectures</div>' :
                lectures.map(lecture => {
                    const lectureKey = `${day}-${lecture.id}`;
                    const state = futurePlanStates[lectureKey] || 'none';
                    let bgColor = '#f8fafc';
                    let textColor = '#0f172a';
                    let statusIcon = '⬜';
                    let borderColor = 'rgba(148,163,184,0.2)';

                    if (state === 'attended') {
                        bgColor = 'linear-gradient(135deg, #10b981, #059669)';
                        textColor = '#ffffff';
                        statusIcon = '✅';
                        borderColor = '#10b981';
                    } else if (state === 'absent') {
                        bgColor = 'linear-gradient(135deg, #ef4444, #dc2626)';
                        textColor = '#ffffff';
                        statusIcon = '❌';
                        borderColor = '#ef4444';
                    } else if (state === 'not-conducted') {
                        bgColor = 'rgba(100,116,139,0.1)';
                        textColor = '#64748b';
                        statusIcon = '🚫';
                        borderColor = 'rgba(100,116,139,0.25)';
                    }

                    const isGradient = state === 'attended' || state === 'absent';
                    return `
                                            <div class="future-lecture-card" style="background: ${bgColor}; border: 2px solid ${borderColor}; ${isGradient ? 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);' : ''}" 
                                                onclick="toggleFutureLectureState('${lectureKey}')">
                                                <div style="color: ${textColor}; font-weight: 700; font-size: 0.9em; line-height: 1.4;">
                                                    ${lecture.subject}<br>
                                                    <span style="font-size: 0.75em; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.3px;">(${lecture.type || 'Lecture'})</span>
                                                </div>
                                            </div>
                                        `;
                }).join('')
            }
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;

    updateFutureProjection();
}

function toggleFutureLectureState(lectureKey) {
    const currentState = futurePlanStates[lectureKey] || 'none';

    // Cycle through states: none -> attended -> absent -> not-conducted -> none
    if (currentState === 'none') {
        futurePlanStates[lectureKey] = 'attended';
    } else if (currentState === 'attended') {
        futurePlanStates[lectureKey] = 'absent';
    } else if (currentState === 'absent') {
        futurePlanStates[lectureKey] = 'not-conducted';
    } else {
        delete futurePlanStates[lectureKey];
    }

    renderFuturePlanner();
}

function updateFutureProjection() {
    const container = document.getElementById('futureProjection');

    // Calculate current attendance
    let currentTotal = 0;
    let currentAttended = 0;

    Object.keys(initialAttendance).forEach(displayName => {
        const data = initialAttendance[displayName];
        currentTotal += data.conducted;
        currentAttended += data.attended;
    });

    Object.keys(attendance).forEach(key => {
        const status = attendance[key];
        if (status !== 'not-conducted') {
            currentTotal++;
            if (status === 'attended') {
                currentAttended++;
            }
        }
    });

    // Calculate future simulation
    let futureTotal = 0;
    let futureAttended = 0;

    Object.keys(futurePlanStates).forEach(key => {
        const state = futurePlanStates[key];
        if (state !== 'not-conducted') {
            futureTotal++;
            if (state === 'attended') {
                futureAttended++;
            }
        }
    });

    const currentPercentage = currentTotal > 0 ? ((currentAttended / currentTotal) * 100).toFixed(2) : 0;
    const projectedTotal = currentTotal + futureTotal;
    const projectedAttended = currentAttended + futureAttended;
    const projectedPercentage = projectedTotal > 0 ? ((projectedAttended / projectedTotal) * 100).toFixed(2) : currentPercentage;

    let alertType = 'success';
    let alertIcon = '✅';
    let message = 'Great! Projected attendance is above 75%';

    if (projectedPercentage < 75) {
        alertType = 'danger';
        alertIcon = '🚨';
        message = 'Warning! Projected attendance is below 75%';
    } else if (projectedPercentage < 80) {
        alertType = 'warning';
        alertIcon = '⚠️';
        message = 'Caution! Projected attendance is between 75-80%';
    }

    container.innerHTML = `
        <div class="alert alert-${alertType}">
            <span>${alertIcon}</span>
            <div style="flex: 1;">
                <div style="font-weight: bold; font-size: 1.1em;">
                    ${currentPercentage}% → ${projectedPercentage}%
                </div>
                <div style="font-size: 0.9em; margin-top: 5px; opacity: 0.85;">
                    Current Attendance → Calculated Attendance
                </div>
            </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button class="btn btn-secondary" onclick="clearFuturePlan()" style="flex: 1;">🔄 Reset All</button>
            <button class="btn btn-success" onclick="markAllFutureAttended()" style="flex: 1;">✅ Mark All Attended</button>
            <button class="btn btn-danger" onclick="markAllFutureAbsent()" style="flex: 1;">❌ Mark All Absent</button>
        </div>
    `;
}

function clearFuturePlan() {
    futurePlanStates = {};
    renderFuturePlanner();
}

function markAllFutureAttended() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(day => {
        const lectures = timetable[day] || [];
        lectures.forEach(lecture => {
            futurePlanStates[`${day}-${lecture.id}`] = 'attended';
        });
    });
    renderFuturePlanner();
}

function markAllFutureAbsent() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(day => {
        const lectures = timetable[day] || [];
        lectures.forEach(lecture => {
            futurePlanStates[`${day}-${lecture.id}`] = 'absent';
        });
    });
    renderFuturePlanner();
}

// Utility Functions
function formatTime(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return '';

    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    const durationMinutes = endTotalMinutes - startTotalMinutes;

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h`;
    } else {
        return `${minutes}m`;
    }
}

function saveTimetable() {
    localStorage.setItem('timetable', JSON.stringify(timetable));
    syncToSupabase();
}

function saveAttendance() {
    localStorage.setItem('attendance', JSON.stringify(attendance));
    syncToSupabase();
}

function saveExtraLectures() {
    localStorage.setItem('extraLectures', JSON.stringify(extraLectures));
    syncToSupabase();
}

// Extra Lecture Functions (One-time lectures)
function openExtraLectureModal() {
    document.getElementById('extraLectureModal').classList.add('active');
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('extraLectureDate').value = today;
}

function closeExtraLectureModal() {
    document.getElementById('extraLectureModal').classList.remove('active');
    document.getElementById('extraLectureSubject').value = '';
    document.getElementById('extraLectureType').value = 'Lecture';
}

function saveExtraLecture() {
    const date = document.getElementById('extraLectureDate').value;
    const subject = document.getElementById('extraLectureSubject').value.trim();
    const type = document.getElementById('extraLectureType').value;

    if (!date || !subject) {
        showToast('Please fill in all fields!', 'warning');
        return;
    }

    if (!extraLectures[date]) {
        extraLectures[date] = [];
    }

    const lecture = {
        id: Date.now() + Math.random(),
        subject: subject,
        type: type,
        isExtra: true
    };

    extraLectures[date].push(lecture);
    saveExtraLectures();
    closeExtraLectureModal();
    showToast('Extra lecture added successfully!', 'success');

    // Refresh attendance view if on that date
    if (attCalSelectedDate === date) {
        renderAttendanceCalendar();
        renderAttendanceLectures();
    }
}

// Initial Attendance Functions (Add previously conducted lectures)
function getSubjectsWithTypesFromTimetable() {
    // Returns array of display names like 'OS (Lecture)' and 'OS (Lab)' as separate subjects
    const subjectTypes = new Set();
    Object.values(timetable).forEach(lectures => {
        lectures.forEach(lecture => {
            const type = lecture.type || 'Lecture';
            subjectTypes.add(`${lecture.subject} (${type})`);
        });
    });
    return Array.from(subjectTypes).sort();
}

function createSubjectTypeDropdown(selectedKey = '') {
    const subjectTypes = getSubjectsWithTypesFromTimetable();
    if (subjectTypes.length === 0) {
        return '<select class="form-control" style="flex: 2;"><option value="">No subjects in timetable</option></select>';
    }
    const options = subjectTypes.map(displayName => {
        const type = displayName.endsWith('(Lab)') ? 'Lab' : 'Lecture';
        const icon = type === 'Lab' ? '🔬' : '📚';
        return `<option value="${displayName.replace(/"/g, '&quot;')}" ${displayName === selectedKey ? 'selected' : ''}>${icon} ${displayName}</option>`;
    }).join('');
    return `<select class="form-control" style="flex: 2;">
        <option value="">Select Subject</option>
        ${options}
    </select>`;
}

function openInitialAttendanceModal() {
    document.getElementById('initialAttendanceModal').classList.add('active');
    const subjectTypes = getSubjectsWithTypesFromTimetable();

    if (subjectTypes.length === 0) {
        closeInitialAttendanceModal();
        showToast('Please add subjects to your timetable first!', 'warning');
        return;
    }

    // Load existing data or reset to one empty row
    const container = document.getElementById('initialAttendanceContainer');
    if (Object.keys(initialAttendance).length > 0) {
        container.innerHTML = Object.keys(initialAttendance).map(key => {
            const data = initialAttendance[key];
            return `
                <div class="initial-attendance-row">
                    ${createSubjectTypeDropdown(key)}
                    <input type="number" class="form-control" placeholder="Conducted" min="0" style="flex: 1;" value="${data.conducted}">
                    <input type="number" class="form-control" placeholder="Attended" min="0" style="flex: 1;" value="${data.attended}">
                    <button class="btn-icon btn-delete" onclick="removeInitialAttendanceRow(this)">🗑️</button>
                </div>
            `;
        }).join('');
    } else {
        container.innerHTML = `
            <div class="initial-attendance-row">
                ${createSubjectTypeDropdown()}
                <input type="number" class="form-control" placeholder="Conducted" min="0" style="flex: 1;">
                <input type="number" class="form-control" placeholder="Attended" min="0" style="flex: 1;">
                <button class="btn-icon btn-delete" onclick="removeInitialAttendanceRow(this)">🗑️</button>
            </div>
        `;
    }
}

function closeInitialAttendanceModal() {
    document.getElementById('initialAttendanceModal').classList.remove('active');
}

function addInitialAttendanceRow() {
    const container = document.getElementById('initialAttendanceContainer');
    const newRow = document.createElement('div');
    newRow.className = 'initial-attendance-row';
    newRow.innerHTML = `
        ${createSubjectTypeDropdown()}
        <input type="number" class="form-control" placeholder="Conducted" min="0" style="flex: 1;">
        <input type="number" class="form-control" placeholder="Attended" min="0" style="flex: 1;">
        <button class="btn-icon btn-delete" onclick="removeInitialAttendanceRow(this)">🗑️</button>
    `;
    container.appendChild(newRow);
}

function removeInitialAttendanceRow(button) {
    const container = document.getElementById('initialAttendanceContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
    } else {
        showToast('At least one row is required!', 'warning');
    }
}

function saveInitialAttendance() {
    const rows = document.querySelectorAll('.initial-attendance-row');
    const newInitialAttendance = {};

    for (let row of rows) {
        const select = row.querySelector('select');
        const inputs = row.querySelectorAll('input');
        const displayName = select ? select.value.trim() : '';
        const conducted = parseInt(inputs[0].value) || 0;
        const attended = parseInt(inputs[1].value) || 0;
        if (displayName) {
            const type = displayName.endsWith('(Lab)') ? 'Lab' : 'Lecture';
            if (attended > conducted) {
                showToast(`Attended cannot exceed conducted for ${displayName}!`, 'error');
                return;
            }
            newInitialAttendance[displayName] = {
                conducted: conducted,
                attended: attended,
                type: type
            };
        }
    }

    if (Object.keys(newInitialAttendance).length === 0) {
        showToast('Please add at least one subject!', 'warning');
        return;
    }

    initialAttendance = newInitialAttendance;
    localStorage.setItem('initialAttendance', JSON.stringify(initialAttendance));
    syncToSupabase();
    closeInitialAttendanceModal();
    updateStats();
    showToast('Initial attendance data saved successfully!', 'success');
}

// Bulk Add Lectures Functions
function openBulkAddModal() {
    document.getElementById('bulkAddModal').classList.add('active');
    // Reset to one empty row
    document.getElementById('bulkLecturesContainer').innerHTML = `
        <div class="bulk-lecture-row">
            <input type="text" class="form-control" placeholder="Subject Name" style="flex: 2;">
            <select class="form-control" style="flex: 1;">
                <option value="Lecture" selected>Lecture</option>
                <option value="Lab">Lab</option>
            </select>
            <button class="btn-icon btn-delete" onclick="removeBulkRow(this)">🗑️</button>
        </div>
    `;
}

function closeBulkAddModal() {
    document.getElementById('bulkAddModal').classList.remove('active');
}

function addBulkLectureRow() {
    const container = document.getElementById('bulkLecturesContainer');
    const newRow = document.createElement('div');
    newRow.className = 'bulk-lecture-row';
    newRow.innerHTML = `
        <input type="text" class="form-control" placeholder="Subject Name" style="flex: 2;">
        <select class="form-control" style="flex: 1;">
            <option value="Lecture" selected>Lecture</option>
            <option value="Lab">Lab</option>
        </select>
        <button class="btn-icon btn-delete" onclick="removeBulkRow(this)">🗑️</button>
    `;
    container.appendChild(newRow);
}

function removeBulkRow(button) {
    const container = document.getElementById('bulkLecturesContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
    } else {
        showToast('At least one lecture row is required!', 'warning');
    }
}

function saveBulkLectures() {
    const day = document.getElementById('bulkDay').value;
    const rows = document.querySelectorAll('.bulk-lecture-row');
    const lectures = [];
    // Validate and collect all lectures
    for (let row of rows) {
        const input = row.querySelector('input');
        const select = row.querySelector('select');
        const subject = input.value.trim();
        const type = select ? select.value : 'Lecture';
        if (subject) {
            lectures.push({
                id: Date.now() + Math.random(), // Unique ID
                subject: subject,
                type: type
            });
        }
    }
    if (lectures.length === 0) {
        showToast('Please add at least one lecture!', 'warning');
        return;
    }
    // Replace the day's lectures instead of appending
    timetable[day] = lectures;
    saveTimetable();
    renderTimetable();
    updateStats();
    closeBulkAddModal();
    showToast(`Successfully saved ${lectures.length} lecture(s) for ${day}!`, 'success');
}

// Modal close listeners setup (called once)
function setupModalCloseListeners() {
    const lectureModal = document.getElementById('lectureModal');
    if (lectureModal) {
        lectureModal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeLectureModal();
            }
        });
    }

    const bulkModal = document.getElementById('bulkAddModal');
    if (bulkModal) {
        bulkModal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeBulkAddModal();
            }
        });
    }

    const extraModal = document.getElementById('extraLectureModal');
    if (extraModal) {
        extraModal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeExtraLectureModal();
            }
        });
    }

    const initialModal = document.getElementById('initialAttendanceModal');
    if (initialModal) {
        initialModal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeInitialAttendanceModal();
            }
        });
    }

    const editLectureModal = document.getElementById('editLectureModal');
    if (editLectureModal) {
        editLectureModal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeEditLectureModal();
            }
        });
    }
}

function openEditDayModal(day) {
    // Open modal
    document.getElementById('bulkAddModal').classList.add('active');
    document.getElementById('bulkDay').value = day;
    // Fill modal with current lectures for the day
    const container = document.getElementById('bulkLecturesContainer');
    const lectures = timetable[day] || [];
    container.innerHTML = lectures.map(lecture => `
        <div class="bulk-lecture-row" draggable="true">
            <input type="text" class="form-control" placeholder="Subject Name" style="flex: 2;" value="${lecture.subject.replace(/"/g, '&quot;')}">
            <select class="form-control" style="flex: 1;">
                <option value="Lecture" ${lecture.type === 'Lecture' || !lecture.type ? 'selected' : ''}>Lecture</option>
                <option value="Lab" ${lecture.type === 'Lab' ? 'selected' : ''}>Lab</option>
            </select>
            <button class="btn-icon btn-delete" onclick="removeBulkRow(this)">🗑️</button>
        </div>
    `).join('') || `
        <div class="bulk-lecture-row" draggable="true">
            <input type="text" class="form-control" placeholder="Subject Name" style="flex: 2;">
            <select class="form-control" style="flex: 1;">
                <option value="Lecture" selected>Lecture</option>
                <option value="Lab">Lab</option>
            </select>
            <button class="btn-icon btn-delete" onclick="removeBulkRow(this)">🗑️</button>
        </div>
    `;
}

function exportTimetable() {
    const dataStr = JSON.stringify(timetable, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timetable.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importTimetable(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (typeof imported === 'object' && imported !== null) {
                timetable = imported;
                saveTimetable();
                renderTimetable();
                updateStats();
                showToast('Timetable imported successfully!', 'success');
            } else {
                showToast('Invalid timetable file.', 'error');
            }
        } catch (err) {
            showToast('Error importing timetable: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}
