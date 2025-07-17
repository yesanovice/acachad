// App State
function safeLoad(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const data = JSON.parse(raw);
        // Basic validation: must be array
        if (!Array.isArray(data)) return fallback;
        return data;
    } catch (e) {
        console.warn(`Corrupt localStorage for ${key}, resetting.`, e);
        return fallback;
    }
}
const state = {
    subjects: safeLoad('subjects', []),
    goals: safeLoad('goals', []),
    preparations: safeLoad('preparations', []),
    currentSubjectId: null,
    currentChapterId: null,
    currentLessonId: null,
    currentPrepId: null
};

// Helper Functions
const helpers = {
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    formatDate: (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    },
    showToast: (message, duration = 3000) => {
        window.elements.toast.textContent = message;
        window.elements.toast.classList.add('show');
        setTimeout(() => {
            window.elements.toast.classList.remove('show');
        }, duration);
    },
    calculateProgress: (items) => {
        if (!items || items.length === 0) return 0;
        const completed = items.filter(item => item.completed).length;
        return Math.round((completed / items.length) * 100);
    },
    calculateChapterProgress: (chapter) => {
        if (!chapter.lessons || chapter.lessons.length === 0) return 0;
        const completed = chapter.lessons.filter(lesson => lesson.completed).length;
        return Math.round((completed / chapter.lessons.length) * 100);
    },
    calculateSubjectProgress: (subject) => {
        if (!subject.chapters || subject.chapters.length === 0) return 0;
        const totalLessons = subject.chapters.reduce((acc, chapter) => acc + (chapter.lessons ? chapter.lessons.length : 0), 0);
        if (totalLessons === 0) return 0;
        
        const completedLessons = subject.chapters.reduce((acc, chapter) => {
            return acc + (chapter.lessons ? chapter.lessons.filter(lesson => lesson.completed).length : 0);
        }, 0);
        
        return Math.round((completedLessons / totalLessons) * 100);
    },
    calculateOverallProgress: () => {
        if (state.subjects.length === 0) return 0;
        
        const allLessons = state.subjects.flatMap(subject => 
            subject.chapters.flatMap(chapter => 
                chapter.lessons || []
            )
        );
        
        if (allLessons.length === 0) return 0;
        
        const completedLessons = allLessons.filter(lesson => lesson.completed).length;
        return Math.round((completedLessons / allLessons.length) * 100);
    },
    getTotalLessons: () => {
        return state.subjects.reduce((acc, subject) => {
            return acc + subject.chapters.reduce((chapterAcc, chapter) => {
                return chapterAcc + (chapter.lessons ? chapter.lessons.length : 0);
            }, 0);
        }, 0);
    },
    getCompletedLessons: () => {
        return state.subjects.reduce((acc, subject) => {
            return acc + subject.chapters.reduce((chapterAcc, chapter) => {
                return chapterAcc + (chapter.lessons ? chapter.lessons.filter(lesson => lesson.completed).length : 0);
            }, 0);
        }, 0);
    },
    saveToLocalStorage: () => {
        localStorage.setItem('subjects', JSON.stringify(state.subjects));
        localStorage.setItem('goals', JSON.stringify(state.goals));
    },
    findSubjectById: (id) => state.subjects.find(subject => subject.id === id),
    findChapterById: (subjectId, chapterId) => {
        const subject = helpers.findSubjectById(subjectId);
        if (!subject) return null;
        return subject.chapters.find(chapter => chapter.id === chapterId);
    },
    findLessonById: (subjectId, chapterId, lessonId) => {
        const chapter = helpers.findChapterById(subjectId, chapterId);
        if (!chapter || !chapter.lessons) return null;
        return chapter.lessons.find(lesson => lesson.id === lessonId);
    },
    findGoalById: (id) => state.goals.find(goal => goal.id === id),
    updateGoalProgress: (goal) => {
        // This function is no longer needed as progress is manual
        return goal.progress;
    },
    isGoalAchieved: (goal) => {
        // This function is no longer needed as progress is manual
        return goal.completed;
    },
    // Add helpers for streaks, theme, notifications, export/import, calendar
    getToday: () => {
        const d = new Date();
        return d.toISOString().slice(0, 10);
    },
    getStreak: () => {
        // Streak: consecutive days with at least one goal completed
        const completions = (JSON.parse(localStorage.getItem('goalCompletions')) || []);
        let streak = 0;
        let day = new Date();
        while (completions.includes(day.toISOString().slice(0, 10))) {
            streak++;
            day.setDate(day.getDate() - 1);
        }
        return streak;
    },
    updateStreak: () => {
        const completions = (JSON.parse(localStorage.getItem('goalCompletions')) || []);
        const today = helpers.getToday();
        if (!completions.includes(today)) {
            // If any goal completed today, add
            if (state.goals.some(g => g.completed && g.lastCompleted === today)) {
                completions.push(today);
                localStorage.setItem('goalCompletions', JSON.stringify(completions));
            }
        }
    },
    setTheme: (theme) => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        window.elements.themeToggle.textContent = theme === 'dark' ? '☀️' : theme === 'blue' ? '💧' : theme === 'green' ? '🌿' : '🌙';
    },
    getTheme: () => localStorage.getItem('theme') || 'light',
    showNotification: (title, body) => {
        if (Notification.permission === 'granted') {
            new Notification(title, { body });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body });
                }
            });
        }
    },
    copyToClipboard: (text) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    },
    // Calendar helpers
    getGoalDueDates: () => {
        const map = {};
        state.goals.forEach(goal => {
            if (goal.endDate) {
                if (!map[goal.endDate]) map[goal.endDate] = [];
                map[goal.endDate].push(goal);
            }
        });
        return map;
    }
};

// Helper for preparations
const prepHelpers = {
    saveToLocalStorage: () => {
        localStorage.setItem('preparations', JSON.stringify(state.preparations));
    },
    findPrepById: (id) => state.preparations.find(p => p.id === id),
    findSubjectById: (id) => state.subjects.find(s => s.id === id),
};

// Helper to close all modals
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

// Trap focus in modal (basic)
function trapFocus(modal) {
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) {
        focusable[0].focus();
        modal.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        last.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === last) {
                        first.focus();
                        e.preventDefault();
                    }
                }
            }
        });
    }
}

// Modal open/close logic
function openModal(modalId) {
    closeAllModals();
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        trapFocus(modal);
        setTimeout(() => {
            modal.querySelector('.modal-close')?.focus();
        }, 100);
    }
}
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}
// ESC key closes any open modal
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
});
// Clicking overlay closes modal
['subject-modal','chapter-modal','lesson-modal','edit-goal-modal'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal(id);
        });
    }
});
// Modal close buttons
Array.from(document.querySelectorAll('.modal-close')).forEach(btn => {
    btn.addEventListener('click', () => closeAllModals());
});

// Render Functions
const render = {
    // Navigation
    switchTab: (tabId) => {
        // Update active tab
        window.elements.navTabs.forEach(tab => {
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update active content
        window.elements.tabContents.forEach(content => {
            if (content.id === tabId) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // If switching to progress tab, update progress
        if (tabId === 'progress') {
            render.updateProgressTab();
        }

        // If switching to goals tab, update goals dropdowns
        if (tabId === 'goals') {
            render.updateGoalSubjectDropdown();
        }
    },

    // Subjects Tab
    renderSubjectsList: () => {
        if (state.subjects.length === 0) {
            window.elements.subjectsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <div class="empty-state-text">No subjects added yet</div>
                    <p>Start by adding your first subject above</p>
                </div>
            `;
            return;
        }

        window.elements.subjectsList.innerHTML = state.subjects.map(subject => `
            <li class="list-item">
                <div>
                    <strong>${subject.name}</strong>
                    <div class="progress-text" style="margin-top: 5px;">
                        <span>${helpers.calculateSubjectProgress(subject)}% complete</span>&nbsp;
                        <span style="margin-left:6px;">${subject.chapters.length} chapters</span>
                    </div>
                </div>
                <div>
                    <button class="btn btn-sm btn-danger" data-subject-id="${subject.id}" data-action="delete">Delete</button>
                    <button class="btn btn-sm" data-subject-id="${subject.id}" data-action="edit">Edit</button>
                    <button class="btn btn-sm btn-accent" data-subject-id="${subject.id}" data-action="view">View</button>
                </div>
            </li>
        `).join('');

        // Add event listeners to subject buttons
        window.elements.subjectsList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const subjectId = button.dataset.subjectId;
                const action = button.dataset.action;
                
                if (action === 'edit') {
                    controllers.openSubjectModal(subjectId);
                } else if (action === 'view') {
                    controllers.openSubjectModal(subjectId, true);
                } else if (action === 'delete') {
                    if (confirm('Are you sure you want to delete this subject and all its chapters and lessons?')) {
                        state.subjects = state.subjects.filter(s => s.id !== subjectId);
                        helpers.saveToLocalStorage();
                        render.renderSubjectsList();
                        render.updateProgressTab();
                        render.renderGoalsList();
                        helpers.showToast('Subject deleted successfully');
                    }
                }
            });
        });
        renderPreparationsList();
    },

    // Subject Modal
    renderSubjectModal: (subjectId, viewOnly = false) => {
        const subject = helpers.findSubjectById(subjectId);
        if (!subject) return;

        state.currentSubjectId = subjectId;
        window.elements.subjectModalTitle.textContent = viewOnly ? `Viewing: ${subject.name}` : `Editing: ${subject.name}`;
        window.elements.editSubjectNameInput.value = subject.name;
        window.elements.editSubjectNameInput.disabled = viewOnly;

        // Render chapters
        if (subject.chapters.length === 0) {
            window.elements.chaptersList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📖</div>
                    <div class="empty-state-text">No chapters added yet</div>
                    ${viewOnly ? '' : '<p>Add your first chapter to get started</p>'}
                </div>
            `;
        } else {
            window.elements.chaptersList.innerHTML = subject.chapters.map(chapter => `
                <li class="list-item">
                    <div>
                        <strong>${chapter.name}</strong>
                        <div class="progress-text" style="margin-top: 5px;">
                            <span>${helpers.calculateChapterProgress(chapter)}% complete</span>
                            <span style="margin-left:6px;">${chapter.lessons ? chapter.lessons.length : 0} lessons</span>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        ${viewOnly ? '' : `<button class="btn btn-sm btn-danger" data-chapter-id="${chapter.id}" data-action="delete">Delete</button>`}
                        ${viewOnly ? '' : `<button class="btn btn-sm" data-chapter-id="${chapter.id}" data-action="edit">Edit</button>`}
                        <button class="btn btn-sm btn-accent" data-chapter-id="${chapter.id}" data-action="view">View</button>
                    </div>
                </li>
            `).join('');
        }

        // Add event listeners to chapter buttons
        window.elements.chaptersList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const chapterId = button.dataset.chapterId;
                const action = button.dataset.action;
                
                if (action === 'edit') {
                    controllers.openChapterModal(subjectId, chapterId);
                } else if (action === 'view') {
                    controllers.openChapterModal(subjectId, chapterId, true);
                } else if (action === 'delete') {
                    if (confirm('Are you sure you want to delete this chapter and all its lessons?')) {
                        const subject = helpers.findSubjectById(subjectId);
                        if (subject) {
                            subject.chapters = subject.chapters.filter(c => c.id !== chapterId);
                            helpers.saveToLocalStorage();
                            render.renderSubjectModal(subjectId);
                            render.renderSubjectsList();
                            render.updateProgressTab();
                            render.renderGoalsList();
                            helpers.showToast('Chapter deleted successfully');
                        }
                    }
                }
            });
        });

        // Show/hide add chapter button based on view mode
        window.elements.addChapterBtn.style.display = viewOnly ? 'none' : 'block';
    },

    // Chapter Modal
    renderChapterModal: (subjectId, chapterId, viewOnly = false) => {
        const chapter = helpers.findChapterById(subjectId, chapterId);
        if (!chapter) return;

        state.currentChapterId = chapterId;
        window.elements.chapterModalTitle.textContent = viewOnly ? `Viewing: ${chapter.name}` : `Editing: ${chapter.name}`;
        window.elements.editChapterNameInput.value = chapter.name;
        window.elements.editChapterNameInput.disabled = viewOnly;

        // Initialize lessons array if it doesn't exist
        if (!chapter.lessons) chapter.lessons = [];

        // Render lessons
        if (chapter.lessons.length === 0) {
            window.elements.lessonsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-text">No lessons added yet</div>
                    ${viewOnly ? '' : '<p>Add your first lesson to get started</p>'}
                </div>
            `;
        } else {
            window.elements.lessonsList.innerHTML = chapter.lessons.map(lesson => `
                <li class="list-item">
                    <div>
                        <strong>${lesson.name}</strong>
                        <div style="margin-top: 5px;">
                            ${lesson.completed ? 
                                '<span class="badge badge-success">Completed</span>' : 
                                '<span class="badge badge-warning">In Progress</span>'}
                        </div>
                    </div>
                    <div>
                        ${viewOnly ? '' : `<button class="btn btn-sm btn-danger" data-lesson-id="${lesson.id}" data-action="delete">Delete</button>`}
                        ${viewOnly ? '' : `<button class="btn btn-sm" data-lesson-id="${lesson.id}" data-action="edit">Edit</button>`}
                        <button class="btn btn-sm btn-accent" data-lesson-id="${lesson.id}" data-action="view">View</button>
                    </div>
                </li>
            `).join('');
        }

        // Add event listeners to lesson buttons
        window.elements.lessonsList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const lessonId = button.dataset.lessonId;
                const action = button.dataset.action;
                
                if (action === 'edit') {
                    controllers.openLessonModal(subjectId, chapterId, lessonId);
                } else if (action === 'view') {
                    controllers.openLessonModal(subjectId, chapterId, lessonId, true);
                } else if (action === 'delete') {
                    if (confirm('Are you sure you want to delete this lesson?')) {
                        const subject = helpers.findSubjectById(subjectId);
                        if (subject) {
                            const chapter = subject.chapters.find(c => c.id === chapterId);
                            if (chapter && chapter.lessons) {
                                chapter.lessons = chapter.lessons.filter(l => l.id !== lessonId);
                                helpers.saveToLocalStorage();
                                render.renderChapterModal(subjectId, chapterId);
                                render.renderSubjectsList();
                                render.updateProgressTab();
                                render.renderGoalsList();
                                helpers.showToast('Lesson deleted successfully');
                            }
                        }
                    }
                }
            });
        });

        // Show/hide add lesson button based on view mode
        window.elements.addLessonBtn.style.display = viewOnly ? 'none' : 'block';
    },

    // Lesson Modal
    renderLessonModal: (subjectId, chapterId, lessonId, viewOnly = false) => {
        const lesson = helpers.findLessonById(subjectId, chapterId, lessonId);
        if (!lesson) return;

        state.currentLessonId = lessonId;
        window.elements.lessonModalTitle.textContent = viewOnly ? `Viewing: ${lesson.name}` : `Editing: ${lesson.name}`;
        window.elements.editLessonNameInput.value = lesson.name;
        window.elements.editLessonCompletedInput.checked = lesson.completed || false;
        window.elements.lessonNotesInput.value = lesson.notes || '';

        // Disable inputs in view mode
        window.elements.editLessonNameInput.disabled = viewOnly;
        window.elements.editLessonCompletedInput.disabled = viewOnly;
        window.elements.lessonNotesInput.disabled = viewOnly;
    },

    // Progress Tab
    updateProgressTab: () => {
        const overallProgress = helpers.calculateOverallProgress();
        const totalLessons = helpers.getTotalLessons();
        const completedLessons = helpers.getCompletedLessons();

        // Update overall progress
        window.elements.overallProgressBar.style.width = `${overallProgress}%`;
        window.elements.overallProgressText.textContent = `${overallProgress}% Complete`;
        window.elements.overallStats.textContent = `${completedLessons}/${totalLessons} lessons completed`;

        // Update subjects progress list
        if (state.subjects.length === 0) {
            window.elements.subjectsProgressList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <div class="empty-state-text">No progress data available</div>
                    <p>Add subjects and mark lessons as complete to track progress</p>
                </div>
            `;
            return;
        }

        window.elements.subjectsProgressList.innerHTML = state.subjects.map(subject => {
            const subjectProgress = helpers.calculateSubjectProgress(subject);
            const totalSubjectLessons = subject.chapters.reduce((acc, chapter) => 
                acc + (chapter.lessons ? chapter.lessons.length : 0), 0);
            const completedSubjectLessons = subject.chapters.reduce((acc, chapter) => 
                acc + (chapter.lessons ? chapter.lessons.filter(lesson => lesson.completed).length : 0), 0);

            return `
                <li class="list-item">
                    <div>
                        <strong>${subject.name}</strong>
                        <div class="progress-bar" style="margin-top: 10px;">
                            <div class="progress-fill" style="width: ${subjectProgress}%"></div>
                        </div>
                        <div class="progress-text">
                            <span>${subjectProgress}% Complete</span>
                            <span>${completedSubjectLessons}/${totalSubjectLessons} lessons</span>
                        </div>
                    </div>
                    <div>
                        ${subject.chapters.map(chapter => {
                            const chapterProgress = helpers.calculateChapterProgress(chapter);
                            const totalChapterLessons = chapter.lessons ? chapter.lessons.length : 0;
                            const completedChapterLessons = chapter.lessons ? chapter.lessons.filter(lesson => lesson.completed).length : 0;

                            return `
                                <details style="margin-top: 10px;">
                                    <summary>${chapter.name}</summary>
                                    <div class="progress-bar" style="margin-top: 5px;">
                                        <div class="progress-fill" style="width: ${chapterProgress}%"></div>
                                    </div>
                                    <div class="progress-text">
                                        <span>${chapterProgress}% Complete</span>
                                        <span>${completedChapterLessons}/${totalChapterLessons} lessons</span>
                                    </div>
                                </details>
                            `;
                        }).join('')}
                    </div>
                </li>
            `;
        }).join('');
    },

    // Goals Tab
    updateGoalSubjectDropdown: () => {
        // Clear existing options except the first one
        while (window.elements.goalSubjectSelect.options.length > 1) {
            window.elements.goalSubjectSelect.remove(1);
        }

        // Add subjects to dropdown
        state.subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            window.elements.goalSubjectSelect.appendChild(option);
        });

        // Enable/disable chapter dropdown based on subject selection
        window.elements.goalSubjectSelect.addEventListener('change', () => {
            window.elements.goalChapterSelect.disabled = !window.elements.goalSubjectSelect.value;
            window.elements.goalLessonSelect.disabled = true;
            window.elements.goalLessonSelect.innerHTML = '<option value="">Select Lesson</option>';
            
            if (window.elements.goalSubjectSelect.value) {
                render.updateGoalChapterDropdown(window.elements.goalSubjectSelect.value);
            } else {
                window.elements.goalChapterSelect.innerHTML = '<option value="">Select Chapter</option>';
            }
        });

        // Enable/disable lesson dropdown based on chapter selection
        window.elements.goalChapterSelect.addEventListener('change', () => {
            window.elements.goalLessonSelect.disabled = !window.elements.goalChapterSelect.value;
            
            if (window.elements.goalChapterSelect.value) {
                render.updateGoalLessonDropdown(
                    window.elements.goalSubjectSelect.value, 
                    window.elements.goalChapterSelect.value
                );
            } else {
                window.elements.goalLessonSelect.innerHTML = '<option value="">Select Lesson</option>';
            }
        });
    },

    updateGoalChapterDropdown: (subjectId) => {
        const subject = helpers.findSubjectById(subjectId);
        if (!subject) return;

        // Clear existing options except the first one
        while (window.elements.goalChapterSelect.options.length > 1) {
            window.elements.goalChapterSelect.remove(1);
        }

        // Add chapters to dropdown
        subject.chapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter.id;
            option.textContent = chapter.name;
            window.elements.goalChapterSelect.appendChild(option);
        });
    },

    updateGoalLessonDropdown: (subjectId, chapterId) => {
        const chapter = helpers.findChapterById(subjectId, chapterId);
        if (!chapter || !chapter.lessons) return;

        // Clear existing options except the first one
        while (window.elements.goalLessonSelect.options.length > 1) {
            window.elements.goalLessonSelect.remove(1);
        }

        // Add lessons to dropdown
        chapter.lessons.forEach(lesson => {
            const option = document.createElement('option');
            option.value = lesson.id;
            option.textContent = lesson.name;
            window.elements.goalLessonSelect.appendChild(option);
        });
    },

    renderGoalsProgressBar: () => {
        const totalQuantity = state.goals.reduce((sum, goal) => sum + (goal.quantity || 1), 0);
        const totalProgress = state.goals.reduce((sum, goal) => sum + (goal.progress || 0), 0);
        const percent = totalQuantity === 0 ? 0 : Math.round((totalProgress / totalQuantity) * 100);
        window.elements.goalsProgressBar.style.width = `${percent}%`;
        window.elements.goalsProgressText.textContent = `${percent}% Complete`;
        window.elements.goalsProgressStats.textContent = `${totalProgress}/${totalQuantity} completions`;
    },

    renderGoalsList: () => {
        if (state.goals.length === 0) {
            window.elements.goalsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎯</div>
                    <div class="empty-state-text">No goals set yet</div>
                    <p>Set your first goal to stay motivated and track your progress</p>
                </div>
            `;
            render.renderGoalsProgressBar();
            return;
        }

        window.elements.goalsList.innerHTML = state.goals
            .filter(goal => {
                const q = (window.elements.goalSearch.value || '').toLowerCase();
                return !q || goal.title.toLowerCase().includes(q) || (helpers.findSubjectById(goal.subjectId)?.name.toLowerCase().includes(q));
            })
            .map(goal => {
                const subject = helpers.findSubjectById(goal.subjectId);
                const isComplete = goal.completed || (goal.progress >= goal.quantity);
                const percent = goal.quantity === 0 ? 0 : Math.round((goal.progress / goal.quantity) * 100);
                return `
                    <div class="goal-item${isComplete ? ' achieved' : ''}">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;">
                                <input type="checkbox" data-goal-id="${goal.id}" ${isComplete ? 'checked' : ''} style="width: 18px; height: 18px;" ${isComplete ? 'disabled' : ''}>
                                <span style="flex: 1;${isComplete ? ' text-decoration: line-through; color: #888;' : ''}">${goal.title}</span>
                            </label>
                            <button class="btn btn-sm" data-goal-id="${goal.id}" data-action="edit" title="Edit">✏️</button>
                            <button class="btn btn-sm btn-danger" data-goal-id="${goal.id}" data-action="delete" title="Delete">🗑️</button>
                            <button class="btn btn-sm btn-share" data-goal-id="${goal.id}" title="Share">🔗</button>
                            <button class="btn btn-sm btn-remind" data-goal-id="${goal.id}" title="Remind Me">⏰</button>
                        </div>
                        <div class="goal-details">
                            <span>Subject: ${subject ? subject.name : 'Unknown'}</span>
                            ${goal.startDate ? `<span>Start: ${helpers.formatDate(goal.startDate)}</span>` : ''}
                            ${goal.endDate ? `<span>End: ${helpers.formatDate(goal.endDate)}</span>` : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
                            <span>Progress: ${goal.progress} / ${goal.quantity}</span>
                            <button class="btn btn-sm btn-success" data-goal-id="${goal.id}" data-action="increment" ${isComplete ? 'disabled' : ''}>Complete</button>
                        </div>
                        <div class="progress-bar" style="height: 8px; margin-top: 6px;">
                            <div class="progress-fill" style="width: ${percent}%; height: 100%;"></div>
                        </div>
                        ${goal.notes ? `<div style="margin-top: 6px; color: #888; font-size: 0.98em;">📝 ${goal.notes}</div>` : ''}
                    </div>
                `;
            }).join('');

        render.renderGoalsProgressBar();

        // Add event listeners for checkboxes
        window.elements.goalsList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const goalId = checkbox.dataset.goalId;
                const goal = helpers.findGoalById(goalId);
                if (goal) {
                    goal.completed = checkbox.checked;
                    if (goal.completed) goal.progress = goal.quantity;
                    helpers.saveToLocalStorage();
                    render.renderGoalsList();
                    helpers.showToast(goal.completed ? 'Goal marked as complete!' : 'Goal marked as incomplete.');
                }
            });
        });
        // Add event listeners for increment (Complete) buttons
        window.elements.goalsList.querySelectorAll('button[data-action="increment"]').forEach(button => {
            button.addEventListener('click', () => {
                const goalId = button.dataset.goalId;
                const goal = helpers.findGoalById(goalId);
                if (goal && !goal.completed && goal.progress < goal.quantity) {
                    goal.progress++;
                    if (goal.progress >= goal.quantity) {
                        goal.completed = true;
                        helpers.showToast('Goal completed!');
                    } else {
                        helpers.showToast('Progress updated!');
                    }
                    helpers.saveToLocalStorage();
                    render.renderGoalsList();
                }
            });
        });
        // Add event listeners for delete buttons
        window.elements.goalsList.querySelectorAll('button[data-action="delete"]').forEach(button => {
            button.addEventListener('click', () => {
                const goalId = button.dataset.goalId;
                if (confirm('Are you sure you want to delete this goal?')) {
                    state.goals = state.goals.filter(g => g.id !== goalId);
                    helpers.saveToLocalStorage();
                    render.renderGoalsList();
                    render.renderGoalsProgressBar();
                    render.renderDetailedGoalProgress();
                    helpers.showToast('Goal deleted successfully');
                }
            });
        });
        // Add event listeners for edit buttons
        window.elements.goalsList.querySelectorAll('button[data-action="edit"]').forEach(button => {
            button.addEventListener('click', () => {
                const goalId = button.dataset.goalId;
                controllers.openEditGoalModal(goalId);
            });
        });
        // Add share/remind listeners
        window.elements.goalsList.querySelectorAll('button.btn-share').forEach(btn => {
            btn.addEventListener('click', () => {
                const goal = helpers.findGoalById(btn.dataset.goalId);
                if (goal) {
                    helpers.copyToClipboard(`${goal.title} (${goal.progress}/${goal.quantity})\n${goal.notes || ''}`);
                    helpers.showToast('Goal copied to clipboard!');
                }
            });
        });
        window.elements.goalsList.querySelectorAll('button.btn-remind').forEach(btn => {
            btn.addEventListener('click', () => {
                const goal = helpers.findGoalById(btn.dataset.goalId);
                if (goal) {
                    helpers.showNotification('Goal Reminder', goal.title);
                    helpers.showToast('Reminder sent!');
                }
            });
        });
    },

    renderDetailedGoalProgress: () => {
        // Group goals by subject
        const grouped = {};
        state.goals.forEach(goal => {
            if (!grouped[goal.subjectId]) grouped[goal.subjectId] = [];
            grouped[goal.subjectId].push(goal);
        });
        const subjects = state.subjects;
        if (Object.keys(grouped).length === 0) {
            window.elements.detailedGoalProgressList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎯</div>
                    <div class="empty-state-text">No goals set yet</div>
                    <p>Set your first goal to see detailed progress</p>
                </div>
            `;
            return;
        }
        window.elements.detailedGoalProgressList.innerHTML = subjects.map(subject => {
            if (!grouped[subject.id]) return '';
            // Calculate subject's overall goal progress (removed)
            // const subjectGoals = grouped[subject.id];
            // const totalGoalQuantity = subjectGoals.reduce((sum, g) => sum + (g.quantity || 0), 0);
            // const totalGoalProgress = subjectGoals.reduce((sum, g) => sum + (g.progress || 0), 0);
            // const goalProgressPercent = totalGoalQuantity === 0 ? 0 : Math.round((totalGoalProgress / totalGoalQuantity) * 100);
            const subjectProgress = helpers.calculateSubjectProgress(subject);
            return `
                <div style="margin-bottom: 30px;">
                    <h3 style="margin-bottom: 10px; display: flex; align-items: center; gap: 12px;">
                        ${subject.name}
                        <span class="badge badge-success" style="font-size: 1rem;">${subjectProgress}% Complete</span>
                    </h3>
                    ${grouped[subject.id].map(goal => {
                        const percent = goal.quantity === 0 ? 0 : Math.round((goal.progress / goal.quantity) * 100);
                        const isComplete = goal.completed || (goal.progress >= goal.quantity);
                        return `
                            <div class="goal-item${isComplete ? ' achieved' : ''}" style="margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="flex: 1;${isComplete ? ' text-decoration: line-through; color: #888;' : ''}">${goal.title}</span>
                                    <span>${goal.progress} / ${goal.quantity}</span>
                                    <span>${percent}%</span>
                                    <button class="btn btn-sm btn-share" data-goal-id="${goal.id}" title="Share">🔗</button>
                                    <button class="btn btn-sm btn-remind" data-goal-id="${goal.id}" title="Remind Me">⏰</button>
                                </div>
                                <div class="progress-bar" style="height: 8px; margin-top: 6px;">
                                    <div class="progress-fill" style="width: ${percent}%; height: 100%;"></div>
                                </div>
                                ${goal.notes ? `<div style="margin-top: 6px; color: #888; font-size: 0.98em;">📝 ${goal.notes}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }).join('');
        // Add share/remind listeners
        window.elements.detailedGoalProgressList.querySelectorAll('button.btn-share').forEach(btn => {
            btn.addEventListener('click', () => {
                const goal = helpers.findGoalById(btn.dataset.goalId);
                if (goal) {
                    helpers.copyToClipboard(`${goal.title} (${goal.progress}/${goal.quantity})\n${goal.notes || ''}`);
                    helpers.showToast('Goal copied to clipboard!');
                }
            });
        });
        window.elements.detailedGoalProgressList.querySelectorAll('button.btn-remind').forEach(btn => {
            btn.addEventListener('click', () => {
                const goal = helpers.findGoalById(btn.dataset.goalId);
                if (goal) {
                    helpers.showNotification('Goal Reminder', goal.title);
                    helpers.showToast('Reminder sent!');
                }
            });
        });
        // Add event listeners for edit buttons in goal progress
        window.elements.detailedGoalProgressList.querySelectorAll('button[data-action="edit"]').forEach(button => {
            button.addEventListener('click', () => {
                const goalId = button.dataset.goalId;
                controllers.openEditGoalModal(goalId);
            });
        });
    },

    // Settings Modal
    openSettingsModal: () => {
        // This function is no longer needed
    },
    closeSettingsModal: () => {
        // This function is no longer needed
    },
    initSettingsModal: () => {
        // This function is no longer needed
    },
    // Theme toggle
    initThemeToggle: () => {
        const themes = ['light', 'dark', 'blue', 'green'];
        window.elements.themeToggle.addEventListener('click', () => {
            const current = helpers.getTheme();
            const idx = themes.indexOf(current);
            const next = themes[(idx + 1) % themes.length];
            helpers.setTheme(next);
        });
    },
    // Goal search
    initGoalSearch: () => {
        window.elements.goalSearch.addEventListener('input', render.renderGoalsList);
        window.elements.goalProgressSearch.addEventListener('input', render.renderDetailedGoalProgress);
    },
    // Calendar view
    renderCalendarView: (() => {
        // Keep track of current calendar view
        let calendarYear, calendarMonth;
        function render(year, month) {
            const dueDates = helpers.getGoalDueDates();
            const today = helpers.getToday();
            const now = new Date();
            if (typeof year !== 'number') year = now.getFullYear();
            if (typeof month !== 'number') month = now.getMonth();
            calendarYear = year;
            calendarMonth = month;
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            let html = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px;">
                <button id="calendar-prev" class="btn btn-outline btn-sm" style="min-width:36px;">◀</button>
                <select id="calendar-month" class="select-control" style="width:auto; display:inline-block;">
                    ${Array.from({length:12},(_,i)=>`<option value="${i}"${i===month?' selected':''}>${new Date(2000,i,1).toLocaleString('default',{month:'long'})}</option>`).join('')}
                </select>
                <input id="calendar-year" type="number" min="1970" max="2100" value="${year}" style="width:70px; text-align:center; border-radius:8px; border:1px solid #e3eaf1; padding:6px 4px; font-size:1rem;">
                <button id="calendar-next" class="btn btn-outline btn-sm" style="min-width:36px;">▶</button>
            </div>`;
            html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">';
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            days.forEach(d => html += `<div style="text-align:center; font-weight:600; color:#888;">${d}</div>`);
            for (let i = 0; i < firstDay.getDay(); i++) html += '<div></div>';
            for (let d = 1; d <= lastDay.getDate(); d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const hasGoal = !!dueDates[dateStr];
                html += `<div style="text-align:center; padding:7px 0; border-radius:8px; background:${dateStr === today ? '#f5a62322' : hasGoal ? '#43d78722' : 'transparent'}; cursor:${hasGoal ? 'pointer' : 'default'}; font-weight:${hasGoal ? '700' : '400'}; color:${hasGoal ? 'var(--primary-color)' : '#888'};" data-date="${dateStr}">${d}</div>`;
            }
            html += '</div>';
            html += '<div id="calendar-goal-list" style="margin-top:18px;"></div>';
            window.elements.calendarView.innerHTML = html;
            // Click handler for days with goals
            window.elements.calendarView.querySelectorAll('div[data-date]').forEach(dayDiv => {
                dayDiv.addEventListener('click', () => {
                    const date = dayDiv.getAttribute('data-date');
                    if (dueDates[date]) {
                        const goals = dueDates[date];
                        let list = `<div style="font-weight:600; margin-bottom:6px;">Goals due on ${date}:</div>`;
                        list += goals.map(goal => `<div style="margin-bottom:6px;">${goal.title} (${goal.progress}/${goal.quantity})</div>`).join('');
                        document.getElementById('calendar-goal-list').innerHTML = list;
                    }
                });
            });
            // Navigation
            window.elements.calendarView.querySelector('#calendar-prev').onclick = () => {
                let y = calendarYear, m = calendarMonth - 1;
                if (m < 0) { m = 11; y--; }
                render(y, m);
            };
            window.elements.calendarView.querySelector('#calendar-next').onclick = () => {
                let y = calendarYear, m = calendarMonth + 1;
                if (m > 11) { m = 0; y++; }
                render(y, m);
            };
            window.elements.calendarView.querySelector('#calendar-month').onchange = e => {
                render(calendarYear, parseInt(e.target.value, 10));
            };
            window.elements.calendarView.querySelector('#calendar-year').onchange = e => {
                let val = parseInt(e.target.value, 10);
                if (val >= 1970 && val <= 2100) render(val, calendarMonth);
            };
        }
        return render;
    })(),
};

// Controller Functions
const controllers = {
    // Navigation
    initTabNavigation: () => {
        window.elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                render.switchTab(tab.dataset.tab);
                if (tab.dataset.tab === 'goal-progress') {
                    render.renderDetailedGoalProgress();
                }
                if (tab.dataset.tab === 'calendar') {
                    render.renderCalendarView();
                }
            });
        });
    },

    // Subjects
    initAddSubject: () => {
        window.elements.addSubjectBtn.addEventListener('click', () => {
            const subjectName = window.elements.subjectNameInput.value.trim();
            if (!subjectName) {
                helpers.showToast('Please enter a subject name');
                return;
            }

            const newSubject = {
                id: helpers.generateId(),
                name: subjectName,
                chapters: []
            };

            state.subjects.push(newSubject);
            helpers.saveToLocalStorage();
            render.renderSubjectsList();
            window.elements.subjectNameInput.value = '';
            helpers.showToast('Subject added successfully');
        });
    },

    openSubjectModal: (subjectId, viewOnly = false) => {
        render.renderSubjectModal(subjectId, viewOnly);
        openModal('subject-modal');
    },

    closeSubjectModal: () => {
        closeModal('subject-modal');
        state.currentSubjectId = null;
    },

    initSubjectModal: () => {
        // Add chapter button
        window.elements.addChapterBtn.addEventListener('click', () => {
            if (!state.currentSubjectId) return;
            
            const subject = helpers.findSubjectById(state.currentSubjectId);
            if (!subject) return;
            
            const newChapter = {
                id: helpers.generateId(),
                name: `Chapter ${subject.chapters.length + 1}`,
                lessons: []
            };
            
            subject.chapters.push(newChapter);
            helpers.saveToLocalStorage();
            render.renderSubjectModal(state.currentSubjectId);
            helpers.showToast('Chapter added successfully');
        });

        // Save subject button
        window.elements.saveSubjectBtn.addEventListener('click', () => {
            if (!state.currentSubjectId) return;
            
            const subject = helpers.findSubjectById(state.currentSubjectId);
            if (!subject) return;
            
            const newName = window.elements.editSubjectNameInput.value.trim();
            if (!newName) {
                helpers.showToast('Please enter a subject name');
                return;
            }
            
            subject.name = newName;
            helpers.saveToLocalStorage();
            render.renderSubjectsList();
            controllers.closeSubjectModal();
            helpers.showToast('Subject updated successfully');
        });

        // Cancel button
        window.elements.cancelSubjectEditBtn.addEventListener('click', controllers.closeSubjectModal);
        window.elements.subjectModal.querySelector('.modal-close').addEventListener('click', controllers.closeSubjectModal);
    },

    // Chapters
    openChapterModal: (subjectId, chapterId, viewOnly = false) => {
        state.currentSubjectId = subjectId;
        render.renderChapterModal(subjectId, chapterId, viewOnly);
        openModal('chapter-modal');
    },

    closeChapterModal: () => {
        closeModal('chapter-modal');
        state.currentSubjectId = null;
        state.currentChapterId = null;
    },

    initChapterModal: () => {
        // Add lesson button
        window.elements.addLessonBtn.addEventListener('click', () => {
            if (!state.currentSubjectId || !state.currentChapterId) return;
            
            const subject = helpers.findSubjectById(state.currentSubjectId);
            if (!subject) return;
            
            const chapter = subject.chapters.find(c => c.id === state.currentChapterId);
            if (!chapter) return;
            
            if (!chapter.lessons) chapter.lessons = [];
            
            const newLesson = {
                id: helpers.generateId(),
                name: `Lesson ${chapter.lessons.length + 1}`,
                completed: false,
                notes: ''
            };
            
            chapter.lessons.push(newLesson);
            helpers.saveToLocalStorage();
            render.renderChapterModal(state.currentSubjectId, state.currentChapterId);
            helpers.showToast('Lesson added successfully');
        });

        // Save chapter button
        window.elements.saveChapterBtn.addEventListener('click', () => {
            if (!state.currentSubjectId || !state.currentChapterId) return;
            
            const subject = helpers.findSubjectById(state.currentSubjectId);
            if (!subject) return;
            
            const chapter = subject.chapters.find(c => c.id === state.currentChapterId);
            if (!chapter) return;
            
            const newName = window.elements.editChapterNameInput.value.trim();
            if (!newName) {
                helpers.showToast('Please enter a chapter name');
                return;
            }
            
            chapter.name = newName;
            helpers.saveToLocalStorage();
            render.renderSubjectModal(state.currentSubjectId);
            render.renderSubjectsList();
            controllers.closeChapterModal();
            helpers.showToast('Chapter updated successfully');
        });

        // Cancel button
        window.elements.cancelChapterEditBtn.addEventListener('click', controllers.closeChapterModal);
        window.elements.chapterModal.querySelector('.modal-close').addEventListener('click', controllers.closeChapterModal);
    },

    // Lessons
    openLessonModal: (subjectId, chapterId, lessonId, viewOnly = false) => {
        state.currentSubjectId = subjectId;
        state.currentChapterId = chapterId;
        render.renderLessonModal(subjectId, chapterId, lessonId, viewOnly);
        openModal('lesson-modal');
    },

    closeLessonModal: () => {
        closeModal('lesson-modal');
        state.currentSubjectId = null;
        state.currentChapterId = null;
        state.currentLessonId = null;
    },

    initLessonModal: () => {
        // Save lesson button
        window.elements.saveLessonBtn.addEventListener('click', () => {
            if (!state.currentSubjectId || !state.currentChapterId || !state.currentLessonId) return;
            
            const subject = helpers.findSubjectById(state.currentSubjectId);
            if (!subject) return;
            
            const chapter = subject.chapters.find(c => c.id === state.currentChapterId);
            if (!chapter || !chapter.lessons) return;
            
            const lesson = chapter.lessons.find(l => l.id === state.currentLessonId);
            if (!lesson) return;
            
            const newName = window.elements.editLessonNameInput.value.trim();
            if (!newName) {
                helpers.showToast('Please enter a lesson name');
                return;
            }
            
            lesson.name = newName;
            lesson.completed = window.elements.editLessonCompletedInput.checked;
            lesson.notes = window.elements.lessonNotesInput.value;
            
            helpers.saveToLocalStorage();
            render.renderChapterModal(state.currentSubjectId, state.currentChapterId);
            render.renderSubjectsList();
            render.updateProgressTab();
            controllers.closeLessonModal();
            helpers.showToast('Lesson updated successfully');
        });

        // Cancel button
        window.elements.cancelLessonEditBtn.addEventListener('click', controllers.closeLessonModal);
        window.elements.lessonModal.querySelector('.modal-close').addEventListener('click', controllers.closeLessonModal);
    },

    // Goals
    initAddGoal: () => {
        window.elements.addGoalBtn.addEventListener('click', () => {
            const title = window.elements.goalTitleInput.value.trim();
            if (!title) {
                helpers.showToast('Please enter a goal title');
                return;
            }

            const subjectId = window.elements.goalSubjectSelect.value;
            if (!subjectId) {
                helpers.showToast('Please select a subject');
                return;
            }

            const startDate = window.elements.goalStartDateInput.value;
            const endDate = window.elements.goalEndDateInput.value;
            const quantity = parseInt(window.elements.goalQuantityInput.value, 10) || 1;

            const newGoal = {
                id: helpers.generateId(),
                title: title,
                subjectId: subjectId,
                completed: false,
                startDate: startDate || null,
                endDate: endDate || null,
                quantity: quantity,
                progress: 0
            };

            state.goals.push(newGoal);
            helpers.saveToLocalStorage();
            render.renderGoalsList();

            // Reset form
            window.elements.goalTitleInput.value = '';
            window.elements.goalSubjectSelect.value = '';
            window.elements.goalStartDateInput.value = '';
            window.elements.goalEndDateInput.value = '';
            window.elements.goalQuantityInput.value = 1;

            helpers.showToast('Goal added successfully');
        });
    },

    openEditGoalModal: (goalId) => {
        const goal = helpers.findGoalById(goalId);
        if (!goal) return;
        state.currentGoalId = goalId;
        window.elements.editGoalTitleInput.value = goal.title;
        window.elements.editGoalQuantityInput.value = goal.quantity;
        if (window.elements.editGoalNotesInput) window.elements.editGoalNotesInput.value = goal.notes || '';
        // Populate subject dropdown
        window.elements.editGoalSubjectSelect.innerHTML = '<option value="">Select Subject</option>';
        state.subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            if (subject.id === goal.subjectId) option.selected = true;
            window.elements.editGoalSubjectSelect.appendChild(option);
        });
        openModal('edit-goal-modal');
    },
    closeEditGoalModal: () => {
        closeModal('edit-goal-modal');
        state.currentGoalId = null;
    },
    initEditGoalModal: () => {
        window.elements.cancelEditGoalBtn.addEventListener('click', controllers.closeEditGoalModal);
        window.elements.editGoalModal.querySelector('.modal-close').addEventListener('click', controllers.closeEditGoalModal);
        window.elements.saveEditGoalBtn.addEventListener('click', () => {
            if (!state.currentGoalId) return;
            const goal = helpers.findGoalById(state.currentGoalId);
            if (!goal) return;
            const newTitle = window.elements.editGoalTitleInput.value.trim();
            const newQuantity = parseInt(window.elements.editGoalQuantityInput.value, 10) || 1;
            const newSubjectId = window.elements.editGoalSubjectSelect.value;
            const newNotes = window.elements.editGoalNotesInput ? window.elements.editGoalNotesInput.value.trim() : '';
            if (!newTitle) {
                helpers.showToast('Please enter a goal title');
                return;
            }
            if (!newSubjectId) {
                helpers.showToast('Please select a subject');
                return;
            }
            goal.title = newTitle;
            goal.subjectId = newSubjectId;
            goal.notes = newNotes;
            // If quantity is reduced below progress, cap progress
            if (newQuantity < goal.progress) {
                goal.progress = newQuantity;
            }
            goal.quantity = newQuantity;
            // If progress now equals quantity, mark as complete
            goal.completed = goal.progress >= goal.quantity;
            helpers.saveToLocalStorage();
            render.renderGoalsList();
            render.renderGoalsProgressBar();
            render.renderDetailedGoalProgress();
            controllers.closeEditGoalModal();
            helpers.showToast('Goal updated successfully');
        });
    },

    // Preparations
    initAddPrep: () => {
        window.elements.addPrepBtn.addEventListener('click', () => {
            const subjectId = window.elements.prepSubjectSelect.value;
            const title = window.elements.prepTitleInput.value.trim();
            if (!subjectId) {
                helpers.showToast('Please select a subject');
                return;
            }
            if (!title) {
                helpers.showToast('Please enter a title');
                return;
            }
            const newPrep = {
                id: helpers.generateId(),
                subjectId,
                title,
                notes: ''
            };
            state.preparations.push(newPrep);
            prepHelpers.saveToLocalStorage();
            window.elements.prepTitleInput.value = '';
            window.elements.prepSubjectSelect.value = '';
            renderPreparationsList();
            openPrepModal(newPrep.id);
        });
    },
    openPrepModal: (prepId) => {
        closeAllModals();
        const prep = prepHelpers.findPrepById(prepId);
        if (!prep) return;
        state.currentPrepId = prepId;
        window.elements.prepModalTitle.textContent = `Preparation: ${prep.title}`;
        window.elements.prepNoteTitleInput.value = prep.title;
        window.elements.prepNoteEditor.value = prep.notes || '';
        window.elements.prepModal.style.display = 'flex';
        setTimeout(() => {
            window.elements.prepNoteEditor.focus();
        }, 100);
    },
    closePrepModal: () => {
        window.elements.prepModal.style.display = 'none';
        state.currentPrepId = null;
    },
    initPrepModal: () => {
        window.elements.savePrepBtn.addEventListener('click', () => {
            if (!state.currentPrepId) return;
            const prep = prepHelpers.findPrepById(state.currentPrepId);
            if (!prep) return;
            const newTitle = window.elements.prepNoteTitleInput.value.trim();
            const newNotes = window.elements.prepNoteEditor.value;
            if (!newTitle) {
                helpers.showToast('Please enter a title');
                return;
            }
            prep.title = newTitle;
            prep.notes = newNotes;
            prepHelpers.saveToLocalStorage();
            renderPreparationsList();
            controllers.closePrepModal();
            helpers.showToast('Preparation saved!');
        });
        window.elements.cancelPrepEditBtn.addEventListener('click', controllers.closePrepModal);
        window.elements.prepModal.querySelector('.modal-close').addEventListener('click', controllers.closePrepModal);
        window.elements.prepModal.addEventListener('click', (e) => {
            if (e.target === window.elements.prepModal) controllers.closePrepModal();
        });
    },

    // Modal close when clicking outside
    initModalCloseOutside: () => {
        // Subject modal
        window.elements.subjectModal.addEventListener('click', (e) => {
            if (e.target === window.elements.subjectModal) {
                controllers.closeSubjectModal();
            }
        });

        // Chapter modal
        window.elements.chapterModal.addEventListener('click', (e) => {
            if (e.target === window.elements.chapterModal) {
                controllers.closeChapterModal();
            }
        });

        // Lesson modal
        window.elements.lessonModal.addEventListener('click', (e) => {
            if (e.target === window.elements.lessonModal) {
                controllers.closeLessonModal();
            }
        });

        // Edit goal modal
        window.elements.editGoalModal.addEventListener('click', (e) => {
            if (e.target === window.elements.editGoalModal) {
                controllers.closeEditGoalModal();
            }
        });

        // Preparation modal
        window.elements.prepModal.addEventListener('click', (e) => {
            if (e.target === window.elements.prepModal) {
                controllers.closePrepModal();
            }
        });

        // Settings modal
        // This function is no longer needed
    },

    // Initialize date pickers with default dates
    initDatePickers: () => {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        
        // Format dates as YYYY-MM-DD
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        window.elements.goalStartDateInput.value = formatDate(today);
        window.elements.goalEndDateInput.value = formatDate(nextWeek);
    },
    // Settings modal logic
    openSettingsModal: () => {
        // This function is no longer needed
    },
    closeSettingsModal: () => {
        // This function is no longer needed
    },
    initSettingsModal: () => {
        // This function is no longer needed
    },
    // Theme toggle
    initThemeToggle: () => {
        const themes = ['light', 'dark', 'blue', 'green'];
        window.elements.themeToggle.addEventListener('click', () => {
            const current = helpers.getTheme();
            const idx = themes.indexOf(current);
            const next = themes[(idx + 1) % themes.length];
            helpers.setTheme(next);
        });
    },
    // Goal search
    initGoalSearch: () => {
        window.elements.goalSearch.addEventListener('input', render.renderGoalsList);
        window.elements.goalProgressSearch.addEventListener('input', render.renderDetailedGoalProgress);
    },
    // Calendar view
    renderCalendarView: () => {
        const dueDates = helpers.getGoalDueDates();
        const today = helpers.getToday();
        // Simple calendar: show current month, highlight days with goals
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        let html = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-weight: 600; font-size: 1.1em;">${now.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        </div>`;
        html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">';
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach(d => html += `<div style="text-align:center; font-weight:600; color:#888;">${d}</div>`);
        for (let i = 0; i < firstDay.getDay(); i++) html += '<div></div>';
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasGoal = !!dueDates[dateStr];
            html += `<div style="text-align:center; padding:7px 0; border-radius:8px; background:${dateStr === today ? '#f5a62322' : hasGoal ? '#43d78722' : 'transparent'}; cursor:${hasGoal ? 'pointer' : 'default'}; font-weight:${hasGoal ? '700' : '400'}; color:${hasGoal ? 'var(--primary-color)' : '#888'};" data-date="${dateStr}">${d}</div>`;
        }
        html += '</div>';
        html += '<div id="calendar-goal-list" style="margin-top:18px;"></div>';
        window.elements.calendarView.innerHTML = html;
        // Click handler for days with goals
        window.elements.calendarView.querySelectorAll('div[data-date]').forEach(dayDiv => {
            dayDiv.addEventListener('click', () => {
                const date = dayDiv.getAttribute('data-date');
                if (dueDates[date]) {
                    const goals = dueDates[date];
                    let list = `<div style="font-weight:600; margin-bottom:6px;">Goals due on ${date}:</div>`;
                    list += goals.map(goal => `<div style="margin-bottom:6px;">${goal.title} (${goal.progress}/${goal.quantity})</div>`).join('');
                    document.getElementById('calendar-goal-list').innerHTML = list;
                }
            });
        });
    }
};

function renderPreparationsList() {
    // Populate the subject dropdown for preparations
    if (window.elements.prepSubjectSelect) {
        // Clear all except the first option
        while (window.elements.prepSubjectSelect.options.length > 1) {
            window.elements.prepSubjectSelect.remove(1);
        }
        state.subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            window.elements.prepSubjectSelect.appendChild(option);
        });
    }
    // Render preparations grouped by subject
    if (window.elements.prepsList) {
        if (state.preparations.length === 0) {
            window.elements.prepsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-text">No preparations yet</div>
                    <p>Create a preparation above to get started</p>
                </div>
            `;
            return;
        }
        // Group preparations by subject
        const grouped = {};
        state.preparations.forEach(prep => {
            if (!grouped[prep.subjectId]) grouped[prep.subjectId] = [];
            grouped[prep.subjectId].push(prep);
        });
        let html = '';
        state.subjects.forEach(subject => {
            if (!grouped[subject.id]) return;
            html += `<div style="margin-bottom: 18px;">
                <div style="font-weight:600; color:var(--primary-color); margin-bottom:6px;">${subject.name}</div>`;
            grouped[subject.id].forEach(prep => {
                html += `<div class="goal-item" style="margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
                    <div style="flex:1; cursor:pointer;" data-prep-id="${prep.id}">
                        <span style="font-weight:600;">${prep.title}</span>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm" data-prep-id="${prep.id}" data-action="edit">Edit</button>
                        <button class="btn btn-sm btn-danger" data-prep-id="${prep.id}" data-action="delete">Delete</button>
                    </div>
                </div>`;
            });
            html += '</div>';
        });
        window.elements.prepsList.innerHTML = html;
        // Add event listeners for edit and delete
        window.elements.prepsList.querySelectorAll('button[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const prepId = btn.dataset.prepId;
                controllers.openPrepModal(prepId);
            });
        });
        window.elements.prepsList.querySelectorAll('button[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const prepId = btn.dataset.prepId;
                if (confirm('Delete this preparation?')) {
                    state.preparations = state.preparations.filter(p => p.id !== prepId);
                    prepHelpers.saveToLocalStorage();
                    renderPreparationsList();
                    helpers.showToast('Preparation deleted');
                }
            });
        });
        // Click on title opens modal
        window.elements.prepsList.querySelectorAll('div[data-prep-id]').forEach(div => {
            div.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                const prepId = div.dataset.prepId;
                controllers.openPrepModal(prepId);
            });
        });
    }
}

// Initialize the app
const init = () => {
    // Initialize all DOM elements
    window.elements = {
        // Navigation
        navTabs: document.querySelectorAll('.nav-tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        // Subjects
        subjectNameInput: document.getElementById('subject-name'),
        addSubjectBtn: document.getElementById('add-subject-btn'),
        subjectsList: document.getElementById('subjects-list'),
        // Progress
        overallProgressBar: document.getElementById('overall-progress-bar'),
        overallProgressText: document.getElementById('overall-progress-text'),
        overallStats: document.getElementById('overall-stats'),
        subjectsProgressList: document.getElementById('subjects-progress-list'),
        // Goals
        goalSearch: document.getElementById('goal-search'),
        goalProgressSearch: document.getElementById('goal-progress-search'),
        goalsProgressBar: document.getElementById('goals-progress-bar'),
        goalsProgressText: document.getElementById('goals-progress-text'),
        goalsProgressStats: document.getElementById('goals-progress-stats'),
        goalsList: document.getElementById('goals-list'),
        addGoalBtn: document.getElementById('add-goal-btn'),
        goalTitleInput: document.getElementById('goal-title'),
        goalSubjectSelect: document.getElementById('goal-subject'),
        goalQuantityInput: document.getElementById('goal-quantity'),
        goalStartDateInput: document.getElementById('goal-start-date'),
        goalEndDateInput: document.getElementById('goal-end-date'),
        goalNotesInput: document.getElementById('goal-notes'),
        // Edit Goal Modal
        editGoalModal: document.getElementById('edit-goal-modal'),
        editGoalTitleInput: document.getElementById('edit-goal-title'),
        editGoalSubjectSelect: document.getElementById('edit-goal-subject'),
        editGoalQuantityInput: document.getElementById('edit-goal-quantity'),
        editGoalNotesInput: document.getElementById('edit-goal-notes'),
        saveEditGoalBtn: document.getElementById('save-edit-goal'),
        cancelEditGoalBtn: document.getElementById('cancel-edit-goal'),
        // Detailed Goal Progress
        detailedGoalProgressList: document.getElementById('detailed-goal-progress-list'),
        // Calendar
        calendarView: document.getElementById('calendar-view'),
        // Preparations
        prepSubjectSelect: document.getElementById('prep-subject'),
        prepTitleInput: document.getElementById('prep-title'),
        addPrepBtn: document.getElementById('add-prep-btn'),
        prepsList: document.getElementById('preps-list'),
        // Preparation Modal
        prepModal: document.getElementById('prep-modal'),
        prepModalTitle: document.getElementById('prep-modal-title'),
        prepNoteTitleInput: document.getElementById('prep-note-title'),
        prepNoteEditor: document.getElementById('prep-note-editor'),
        savePrepBtn: document.getElementById('save-prep-btn'),
        cancelPrepEditBtn: document.getElementById('cancel-prep-edit'),
        // Subject Modal
        subjectModal: document.getElementById('subject-modal'),
        subjectModalTitle: document.getElementById('subject-modal-title'),
        editSubjectNameInput: document.getElementById('edit-subject-name'),
        addChapterBtn: document.getElementById('add-chapter-btn'),
        chaptersList: document.getElementById('chapters-list'),
        saveSubjectBtn: document.getElementById('save-subject-btn'),
        cancelSubjectEditBtn: document.getElementById('cancel-subject-edit'),
        // Chapter Modal
        chapterModal: document.getElementById('chapter-modal'),
        chapterModalTitle: document.getElementById('chapter-modal-title'),
        editChapterNameInput: document.getElementById('edit-chapter-name'),
        addLessonBtn: document.getElementById('add-lesson-btn'),
        lessonsList: document.getElementById('lessons-list'),
        saveChapterBtn: document.getElementById('save-chapter-btn'),
        cancelChapterEditBtn: document.getElementById('cancel-chapter-edit'),
        // Lesson Modal
        lessonModal: document.getElementById('lesson-modal'),
        lessonModalTitle: document.getElementById('lesson-modal-title'),
        editLessonNameInput: document.getElementById('edit-lesson-name'),
        editLessonCompletedInput: document.getElementById('edit-lesson-completed'),
        lessonNotesInput: document.getElementById('lesson-notes'),
        saveLessonBtn: document.getElementById('save-lesson-btn'),
        cancelLessonEditBtn: document.getElementById('cancel-lesson-edit'),
        // Theme
        themeToggle: document.getElementById('theme-toggle'),
        // Streak
        streakBadge: document.getElementById('streak-badge'),
        // Toast
        toast: document.getElementById('toast'),
    };
    // Initialize navigation
    controllers.initTabNavigation();
    
    // Initialize subjects
    controllers.initAddSubject();
    controllers.initSubjectModal();
    
    // Initialize chapters
    controllers.initChapterModal();
    
    // Initialize lessons
    controllers.initLessonModal();
    
    // Initialize goals
    controllers.initAddGoal();
    controllers.initDatePickers();
    controllers.initEditGoalModal();
    controllers.initThemeToggle();
    controllers.initGoalSearch();
    controllers.initAddPrep(); // Initialize preparations
    controllers.initPrepModal(); // Initialize preparation modal
    
    // Initialize modal close when clicking outside
    controllers.initModalCloseOutside();
    
    // Render initial data
    render.renderSubjectsList();
    render.updateProgressTab();
    render.renderGoalsList();
    render.renderGoalsProgressBar();
    render.renderDetailedGoalProgress();
    render.renderCalendarView();
    renderPreparationsList(); // Render preparations list on load
    // Set theme on load
    helpers.setTheme(helpers.getTheme());
    // Show streak badge
    const streak = helpers.getStreak();
    window.elements.streakBadge.textContent = streak > 0 ? `🔥 ${streak} day streak!` : '';
    
    // Register service worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }).catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', init);
