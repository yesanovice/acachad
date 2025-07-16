// App State
const state = {
    subjects: JSON.parse(localStorage.getItem('subjects')) || [],
    goals: JSON.parse(localStorage.getItem('goals')) || [],
    currentSubjectId: null,
    currentChapterId: null,
    currentLessonId: null
};

// DOM Elements
const elements = {
    // Tabs
    navTabs: document.querySelectorAll('.nav-tab'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Subjects Tab
    subjectNameInput: document.getElementById('subject-name'),
    addSubjectBtn: document.getElementById('add-subject-btn'),
    subjectsList: document.getElementById('subjects-list'),

    // Progress Tab
    overallProgressBar: document.getElementById('overall-progress-bar'),
    overallProgressText: document.getElementById('overall-progress-text'),
    overallStats: document.getElementById('overall-stats'),
    subjectsProgressList: document.getElementById('subjects-progress-list'),

    // Goals Tab
    goalTitleInput: document.getElementById('goal-title'),
    goalSubjectSelect: document.getElementById('goal-subject'),
    goalChapterSelect: document.getElementById('goal-chapter'),
    goalLessonSelect: document.getElementById('goal-lesson'),
    goalStartDateInput: document.getElementById('goal-start-date'),
    goalEndDateInput: document.getElementById('goal-end-date'),
    addGoalBtn: document.getElementById('add-goal-btn'),
    goalsList: document.getElementById('goals-list'),

    // Subject Modal
    subjectModal: document.getElementById('subject-modal'),
    subjectModalTitle: document.getElementById('subject-modal-title'),
    editSubjectNameInput: document.getElementById('edit-subject-name'),
    addChapterBtn: document.getElementById('add-chapter-btn'),
    chaptersList: document.getElementById('chapters-list'),
    cancelSubjectEditBtn: document.getElementById('cancel-subject-edit'),
    saveSubjectBtn: document.getElementById('save-subject-btn'),

    // Chapter Modal
    chapterModal: document.getElementById('chapter-modal'),
    chapterModalTitle: document.getElementById('chapter-modal-title'),
    editChapterNameInput: document.getElementById('edit-chapter-name'),
    addLessonBtn: document.getElementById('add-lesson-btn'),
    lessonsList: document.getElementById('lessons-list'),
    cancelChapterEditBtn: document.getElementById('cancel-chapter-edit'),
    saveChapterBtn: document.getElementById('save-chapter-btn'),

    // Lesson Modal
    lessonModal: document.getElementById('lesson-modal'),
    lessonModalTitle: document.getElementById('lesson-modal-title'),
    editLessonNameInput: document.getElementById('edit-lesson-name'),
    editLessonCompletedInput: document.getElementById('edit-lesson-completed'),
    lessonNotesInput: document.getElementById('lesson-notes'),
    cancelLessonEditBtn: document.getElementById('cancel-lesson-edit'),
    saveLessonBtn: document.getElementById('save-lesson-btn'),

    // Toast
    toast: document.getElementById('toast')
};

// Helper Functions
const helpers = {
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    formatDate: (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    },
    showToast: (message, duration = 3000) => {
        elements.toast.textContent = message;
        elements.toast.classList.add('show');
        setTimeout(() => {
            elements.toast.classList.remove('show');
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
        if (!goal.target.subjectId) {
            // Subject goal
            const subject = helpers.findSubjectById(goal.target.subjectId);
            if (!subject) return 0;
            
            goal.progress = helpers.calculateSubjectProgress(subject);
        } else if (goal.target.chapterId) {
            // Chapter goal
            const chapter = helpers.findChapterById(goal.target.subjectId, goal.target.chapterId);
            if (!chapter) return 0;
            
            goal.progress = helpers.calculateChapterProgress(chapter);
        } else if (goal.target.lessonId) {
            // Lesson goal
            const lesson = helpers.findLessonById(
                goal.target.subjectId, 
                goal.target.chapterId, 
                goal.target.lessonId
            );
            
            goal.progress = lesson?.completed ? 100 : 0;
        }
        
        return goal.progress;
    },
    isGoalAchieved: (goal) => {
        const today = new Date();
        const endDate = new Date(goal.endDate);
        
        if (goal.progress >= 100) return true;
        if (today > endDate) return true;
        return false;
    }
};

// Render Functions
const render = {
    // Navigation
    switchTab: (tabId) => {
        // Update active tab
        elements.navTabs.forEach(tab => {
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update active content
        elements.tabContents.forEach(content => {
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
            elements.subjectsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <div class="empty-state-text">No subjects added yet</div>
                    <p>Start by adding your first subject above</p>
                </div>
            `;
            return;
        }

        elements.subjectsList.innerHTML = state.subjects.map(subject => `
            <li class="list-item">
                <div>
                    <strong>${subject.name}</strong>
                    <div class="progress-text" style="margin-top: 5px;">
                        <span>${helpers.calculateSubjectProgress(subject)}% complete</span>
                        <span>${subject.chapters.length} chapters</span>
                    </div>
                </div>
                <div>
                    <button class="btn btn-sm" data-subject-id="${subject.id}" data-action="edit">Edit</button>
                    <button class="btn btn-sm btn-accent" data-subject-id="${subject.id}" data-action="view">View</button>
                </div>
            </li>
        `).join('');

        // Add event listeners to subject buttons
        elements.subjectsList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const subjectId = button.dataset.subjectId;
                const action = button.dataset.action;
                
                if (action === 'edit') {
                    controllers.openSubjectModal(subjectId);
                } else if (action === 'view') {
                    controllers.openSubjectModal(subjectId, true);
                }
            });
        });
    },

    // Subject Modal
    renderSubjectModal: (subjectId, viewOnly = false) => {
        const subject = helpers.findSubjectById(subjectId);
        if (!subject) return;

        state.currentSubjectId = subjectId;
        elements.subjectModalTitle.textContent = viewOnly ? `Viewing: ${subject.name}` : `Editing: ${subject.name}`;
        elements.editSubjectNameInput.value = subject.name;
        elements.editSubjectNameInput.disabled = viewOnly;

        // Render chapters
        if (subject.chapters.length === 0) {
            elements.chaptersList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📖</div>
                    <div class="empty-state-text">No chapters added yet</div>
                    ${viewOnly ? '' : '<p>Add your first chapter to get started</p>'}
                </div>
            `;
        } else {
            elements.chaptersList.innerHTML = subject.chapters.map(chapter => `
                <li class="list-item">
                    <div>
                        <strong>${chapter.name}</strong>
                        <div class="progress-text" style="margin-top: 5px;">
                            <span>${helpers.calculateChapterProgress(chapter)}% complete</span>
                            <span>${chapter.lessons ? chapter.lessons.length : 0} lessons</span>
                        </div>
                    </div>
                    <div>
                        ${viewOnly ? '' : `<button class="btn btn-sm" data-chapter-id="${chapter.id}" data-action="edit">Edit</button>`}
                        <button class="btn btn-sm btn-accent" data-chapter-id="${chapter.id}" data-action="view">View</button>
                    </div>
                </li>
            `).join('');
        }

        // Add event listeners to chapter buttons
        elements.chaptersList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const chapterId = button.dataset.chapterId;
                const action = button.dataset.action;
                
                if (action === 'edit') {
                    controllers.openChapterModal(subjectId, chapterId);
                } else if (action === 'view') {
                    controllers.openChapterModal(subjectId, chapterId, true);
                }
            });
        });

        // Show/hide add chapter button based on view mode
        elements.addChapterBtn.style.display = viewOnly ? 'none' : 'block';
    },

    // Chapter Modal
    renderChapterModal: (subjectId, chapterId, viewOnly = false) => {
        const chapter = helpers.findChapterById(subjectId, chapterId);
        if (!chapter) return;

        state.currentChapterId = chapterId;
        elements.chapterModalTitle.textContent = viewOnly ? `Viewing: ${chapter.name}` : `Editing: ${chapter.name}`;
        elements.editChapterNameInput.value = chapter.name;
        elements.editChapterNameInput.disabled = viewOnly;

        // Initialize lessons array if it doesn't exist
        if (!chapter.lessons) chapter.lessons = [];

        // Render lessons
        if (chapter.lessons.length === 0) {
            elements.lessonsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-text">No lessons added yet</div>
                    ${viewOnly ? '' : '<p>Add your first lesson to get started</p>'}
                </div>
            `;
        } else {
            elements.lessonsList.innerHTML = chapter.lessons.map(lesson => `
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
                        ${viewOnly ? '' : `<button class="btn btn-sm" data-lesson-id="${lesson.id}" data-action="edit">Edit</button>`}
                        <button class="btn btn-sm btn-accent" data-lesson-id="${lesson.id}" data-action="view">View</button>
                    </div>
                </li>
            `).join('');
        }

        // Add event listeners to lesson buttons
        elements.lessonsList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const lessonId = button.dataset.lessonId;
                const action = button.dataset.action;
                
                if (action === 'edit') {
                    controllers.openLessonModal(subjectId, chapterId, lessonId);
                } else if (action === 'view') {
                    controllers.openLessonModal(subjectId, chapterId, lessonId, true);
                }
            });
        });

        // Show/hide add lesson button based on view mode
        elements.addLessonBtn.style.display = viewOnly ? 'none' : 'block';
    },

    // Lesson Modal
    renderLessonModal: (subjectId, chapterId, lessonId, viewOnly = false) => {
        const lesson = helpers.findLessonById(subjectId, chapterId, lessonId);
        if (!lesson) return;

        state.currentLessonId = lessonId;
        elements.lessonModalTitle.textContent = viewOnly ? `Viewing: ${lesson.name}` : `Editing: ${lesson.name}`;
        elements.editLessonNameInput.value = lesson.name;
        elements.editLessonCompletedInput.checked = lesson.completed || false;
        elements.lessonNotesInput.value = lesson.notes || '';

        // Disable inputs in view mode
        elements.editLessonNameInput.disabled = viewOnly;
        elements.editLessonCompletedInput.disabled = viewOnly;
        elements.lessonNotesInput.disabled = viewOnly;
    },

    // Progress Tab
    updateProgressTab: () => {
        const overallProgress = helpers.calculateOverallProgress();
        const totalLessons = helpers.getTotalLessons();
        const completedLessons = helpers.getCompletedLessons();

        // Update overall progress
        elements.overallProgressBar.style.width = `${overallProgress}%`;
        elements.overallProgressText.textContent = `${overallProgress}% Complete`;
        elements.overallStats.textContent = `${completedLessons}/${totalLessons} lessons completed`;

        // Update subjects progress list
        if (state.subjects.length === 0) {
            elements.subjectsProgressList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <div class="empty-state-text">No progress data available</div>
                    <p>Add subjects and mark lessons as complete to track progress</p>
                </div>
            `;
            return;
        }

        elements.subjectsProgressList.innerHTML = state.subjects.map(subject => {
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
        while (elements.goalSubjectSelect.options.length > 1) {
            elements.goalSubjectSelect.remove(1);
        }

        // Add subjects to dropdown
        state.subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            elements.goalSubjectSelect.appendChild(option);
        });

        // Enable/disable chapter dropdown based on subject selection
        elements.goalSubjectSelect.addEventListener('change', () => {
            elements.goalChapterSelect.disabled = !elements.goalSubjectSelect.value;
            elements.goalLessonSelect.disabled = true;
            elements.goalLessonSelect.innerHTML = '<option value="">Select Lesson</option>';
            
            if (elements.goalSubjectSelect.value) {
                render.updateGoalChapterDropdown(elements.goalSubjectSelect.value);
            } else {
                elements.goalChapterSelect.innerHTML = '<option value="">Select Chapter</option>';
            }
        });

        // Enable/disable lesson dropdown based on chapter selection
        elements.goalChapterSelect.addEventListener('change', () => {
            elements.goalLessonSelect.disabled = !elements.goalChapterSelect.value;
            
            if (elements.goalChapterSelect.value) {
                render.updateGoalLessonDropdown(
                    elements.goalSubjectSelect.value, 
                    elements.goalChapterSelect.value
                );
            } else {
                elements.goalLessonSelect.innerHTML = '<option value="">Select Lesson</option>';
            }
        });
    },

    updateGoalChapterDropdown: (subjectId) => {
        const subject = helpers.findSubjectById(subjectId);
        if (!subject) return;

        // Clear existing options except the first one
        while (elements.goalChapterSelect.options.length > 1) {
            elements.goalChapterSelect.remove(1);
        }

        // Add chapters to dropdown
        subject.chapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter.id;
            option.textContent = chapter.name;
            elements.goalChapterSelect.appendChild(option);
        });
    },

    updateGoalLessonDropdown: (subjectId, chapterId) => {
        const chapter = helpers.findChapterById(subjectId, chapterId);
        if (!chapter || !chapter.lessons) return;

        // Clear existing options except the first one
        while (elements.goalLessonSelect.options.length > 1) {
            elements.goalLessonSelect.remove(1);
        }

        // Add lessons to dropdown
        chapter.lessons.forEach(lesson => {
            const option = document.createElement('option');
            option.value = lesson.id;
            option.textContent = lesson.name;
            elements.goalLessonSelect.appendChild(option);
        });
    },

    renderGoalsList: () => {
        if (state.goals.length === 0) {
            elements.goalsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎯</div>
                    <div class="empty-state-text">No goals set yet</div>
                    <p>Set your first goal to stay motivated and track your progress</p>
                </div>
            `;
            return;
        }

        elements.goalsList.innerHTML = state.goals.map(goal => {
            // Calculate goal progress
            helpers.updateGoalProgress(goal);
            const isAchieved = helpers.isGoalAchieved(goal);
            const today = new Date();
            const endDate = new Date(goal.endDate);
            const isOverdue = today > endDate && goal.progress < 100;
            
            let targetText = '';
            if (goal.target.lessonId) {
                const lesson = helpers.findLessonById(
                    goal.target.subjectId, 
                    goal.target.chapterId, 
                    goal.target.lessonId
                );
                targetText = `Complete lesson: ${lesson?.name || 'Unknown'}`;
            } else if (goal.target.chapterId) {
                const chapter = helpers.findChapterById(
                    goal.target.subjectId, 
                    goal.target.chapterId
                );
                targetText = `Complete chapter: ${chapter?.name || 'Unknown'}`;
            } else {
                const subject = helpers.findSubjectById(goal.target.subjectId);
                targetText = `Complete subject: ${subject?.name || 'Unknown'}`;
            }

            return `
                <div class="goal-item ${isAchieved ? 'achieved' : ''} ${isOverdue ? 'overdue' : ''}">
                    <div class="goal-title">${goal.title}</div>
                    <div class="goal-details">
                        <span>${targetText}</span>
                        <span>Due: ${helpers.formatDate(goal.endDate)}</span>
                    </div>
                    <div class="goal-progress">
                        <div class="goal-progress-fill" style="width: ${goal.progress}%"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                        <span>${goal.progress}% complete</span>
                        <span>
                            ${isAchieved ? 'Achieved 🎉' : ''}
                            ${isOverdue ? 'Overdue ⏰' : ''}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }
};

// Controller Functions
const controllers = {
    // Navigation
    initTabNavigation: () => {
        elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                render.switchTab(tab.dataset.tab);
            });
        });
    },

    // Subjects
    initAddSubject: () => {
        elements.addSubjectBtn.addEventListener('click', () => {
            const subjectName = elements.subjectNameInput.value.trim();
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
            elements.subjectNameInput.value = '';
            helpers.showToast('Subject added successfully');
        });
    },

    openSubjectModal: (subjectId, viewOnly = false) => {
        render.renderSubjectModal(subjectId, viewOnly);
        elements.subjectModal.style.display = 'flex';
    },

    closeSubjectModal: () => {
        elements.subjectModal.style.display = 'none';
        state.currentSubjectId = null;
    },

    initSubjectModal: () => {
        // Add chapter button
        elements.addChapterBtn.addEventListener('click', () => {
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
        elements.saveSubjectBtn.addEventListener('click', () => {
            if (!state.currentSubjectId) return;
            
            const subject = helpers.findSubjectById(state.currentSubjectId);
            if (!subject) return;
            
            const newName = elements.editSubjectNameInput.value.trim();
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
        elements.cancelSubjectEditBtn.addEventListener('click', controllers.closeSubjectModal);
        elements.subjectModal.querySelector('.modal-close').addEventListener('click', controllers.closeSubjectModal);
    },

    // Chapters
    openChapterModal: (subjectId, chapterId, viewOnly = false) => {
        state.currentSubjectId = subjectId;
        render.renderChapterModal(subjectId, chapterId, viewOnly);
        elements.chapterModal.style.display = 'flex';
    },

    closeChapterModal: () => {
        elements.chapterModal.style.display = 'none';
        state.currentSubjectId = null;
        state.currentChapterId = null;
    },

    initChapterModal: () => {
        // Add lesson button
        elements.addLessonBtn.addEventListener('click', () => {
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
        elements.saveChapterBtn.addEventListener('click', () => {
            if (!state.currentSubjectId || !state.currentChapterId) return;
            
            const subject = helpers.findSubjectById(state.currentSubjectId);
            if (!subject) return;
            
            const chapter = subject.chapters.find(c => c.id === state.currentChapterId);
            if (!chapter) return;
            
            const newName = elements.editChapterNameInput.value.trim();
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
        elements.cancelChapterEditBtn.addEventListener('click', controllers.closeChapterModal);
        elements.chapterModal.querySelector('.modal-close').addEventListener('click', controllers.closeChapterModal);
    },

    // Lessons
    openLessonModal: (subjectId, chapterId, lessonId, viewOnly = false) => {
        state.currentSubjectId = subjectId;
        state.currentChapterId = chapterId;
        render.renderLessonModal(subjectId, chapterId, lessonId, viewOnly);
        elements.lessonModal.style.display = 'flex';
    },

    closeLessonModal: () => {
        elements.lessonModal.style.display = 'none';
        state.currentSubjectId = null;
        state.currentChapterId = null;
        state.currentLessonId = null;
    },

    initLessonModal: () => {
        // Save lesson button
        elements.saveLessonBtn.addEventListener('click', () => {
            if (!state.currentSubjectId || !state.currentChapterId || !state.currentLessonId) return;
            
            const subject = helpers.findSubjectById(state.currentSubjectId);
            if (!subject) return;
            
            const chapter = subject.chapters.find(c => c.id === state.currentChapterId);
            if (!chapter || !chapter.lessons) return;
            
            const lesson = chapter.lessons.find(l => l.id === state.currentLessonId);
            if (!lesson) return;
            
            const newName = elements.editLessonNameInput.value.trim();
            if (!newName) {
                helpers.showToast('Please enter a lesson name');
                return;
            }
            
            lesson.name = newName;
            lesson.completed = elements.editLessonCompletedInput.checked;
            lesson.notes = elements.lessonNotesInput.value;
            
            helpers.saveToLocalStorage();
            render.renderChapterModal(state.currentSubjectId, state.currentChapterId);
            render.renderSubjectsList();
            render.updateProgressTab();
            controllers.closeLessonModal();
            helpers.showToast('Lesson updated successfully');
        });

        // Cancel button
        elements.cancelLessonEditBtn.addEventListener('click', controllers.closeLessonModal);
        elements.lessonModal.querySelector('.modal-close').addEventListener('click', controllers.closeLessonModal);
    },

    // Goals
    initAddGoal: () => {
        elements.addGoalBtn.addEventListener('click', () => {
            const title = elements.goalTitleInput.value.trim();
            if (!title) {
                helpers.showToast('Please enter a goal title');
                return;
            }

            const subjectId = elements.goalSubjectSelect.value;
            if (!subjectId) {
                helpers.showToast('Please select a subject');
                return;
            }

            const startDate = elements.goalStartDateInput.value;
            const endDate = elements.goalEndDateInput.value;
            
            if (!startDate || !endDate) {
                helpers.showToast('Please select start and end dates');
                return;
            }
            
            if (new Date(endDate) < new Date(startDate)) {
                helpers.showToast('End date must be after start date');
                return;
            }

            const newGoal = {
                id: helpers.generateId(),
                title: title,
                startDate: startDate,
                endDate: endDate,
                progress: 0,
                target: {
                    subjectId: subjectId,
                    chapterId: elements.goalChapterSelect.value || null,
                    lessonId: elements.goalLessonSelect.value || null
                }
            };

            state.goals.push(newGoal);
            helpers.saveToLocalStorage();
            render.renderGoalsList();
            
            // Reset form
            elements.goalTitleInput.value = '';
            elements.goalSubjectSelect.value = '';
            elements.goalChapterSelect.innerHTML = '<option value="">Select Chapter</option>';
            elements.goalLessonSelect.innerHTML = '<option value="">Select Lesson</option>';
            elements.goalChapterSelect.disabled = true;
            elements.goalLessonSelect.disabled = true;
            elements.goalStartDateInput.value = '';
            elements.goalEndDateInput.value = '';
            
            helpers.showToast('Goal added successfully');
        });
    },

    // Modal close when clicking outside
    initModalCloseOutside: () => {
        // Subject modal
        elements.subjectModal.addEventListener('click', (e) => {
            if (e.target === elements.subjectModal) {
                controllers.closeSubjectModal();
            }
        });

        // Chapter modal
        elements.chapterModal.addEventListener('click', (e) => {
            if (e.target === elements.chapterModal) {
                controllers.closeChapterModal();
            }
        });

        // Lesson modal
        elements.lessonModal.addEventListener('click', (e) => {
            if (e.target === elements.lessonModal) {
                controllers.closeLessonModal();
            }
        });
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
        
        elements.goalStartDateInput.value = formatDate(today);
        elements.goalEndDateInput.value = formatDate(nextWeek);
    }
};

// Initialize the app
const init = () => {
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
    
    // Initialize modal close when clicking outside
    controllers.initModalCloseOutside();
    
    // Render initial data
    render.renderSubjectsList();
    render.updateProgressTab();
    render.renderGoalsList();
    
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
init();
