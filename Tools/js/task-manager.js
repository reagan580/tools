// State Management
let state = {
    projects: [],
    tasks: [],
    tags: [],
    currentProject: null,
    currentTask: null,
    currentView: 'list',
    currentFilter: 'all',
    searchQuery: '',
    ganttChart: null,
    calendarDate: new Date()
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeViews();
    setupEventListeners();
    initializeDragAndDrop();
    renderAll();
});

// Data Management
function loadData() {
    // Load projects
    const savedProjects = localStorage.getItem('projects');
    if (savedProjects) {
        state.projects = JSON.parse(savedProjects);
    }

    // Load tasks
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
        state.tasks = JSON.parse(savedTasks);
    }

    // Load tags
    const savedTags = localStorage.getItem('tags');
    if (savedTags) {
        state.tags = JSON.parse(savedTags);
    }
}

function saveData() {
    localStorage.setItem('projects', JSON.stringify(state.projects));
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
    localStorage.setItem('tags', JSON.stringify(state.tags));
}

// Project Management
function createProject(name, description, color) {
    const project = {
        id: generateId(),
        name,
        description,
        color,
        created: new Date().toISOString(),
        modified: new Date().toISOString()
    };

    state.projects.push(project);
    saveData();
    renderProjects();
    return project;
}

function updateProject(id, updates) {
    const project = state.projects.find(p => p.id === id);
    if (project) {
        Object.assign(project, updates, {
            modified: new Date().toISOString()
        });
        saveData();
        renderProjects();
    }
}

function deleteProject(id) {
    if (confirm('Are you sure you want to delete this project and all its tasks?')) {
        state.projects = state.projects.filter(p => p.id !== id);
        state.tasks = state.tasks.filter(t => t.projectId !== id);
        
        if (state.currentProject?.id === id) {
            state.currentProject = null;
        }
        
        saveData();
        renderAll();
    }
}

// Task Management
function createTask(projectId, data) {
    const task = {
        id: generateId(),
        projectId,
        title: data.title,
        description: data.description || '',
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
        assignees: data.assignees || [],
        tags: data.tags || [],
        subtasks: data.subtasks || [],
        attachments: data.attachments || [],
        comments: [],
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        completed: null
    };

    state.tasks.push(task);
    saveData();
    renderTasks();
    return task;
}

function updateTask(id, updates) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        Object.assign(task, updates, {
            modified: new Date().toISOString()
        });

        if (updates.status === 'completed' && !task.completed) {
            task.completed = new Date().toISOString();
        } else if (updates.status !== 'completed') {
            task.completed = null;
        }

        saveData();
        renderTasks();
        if (state.currentTask?.id === id) {
            renderTaskDetails(task);
        }
    }
}

function deleteTask(id) {
    if (confirm('Are you sure you want to delete this task?')) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        
        if (state.currentTask?.id === id) {
            state.currentTask = null;
            hideTaskDetails();
        }
        
        saveData();
        renderTasks();
    }
}

// View Management
function initializeViews() {
    // Initialize Gantt Chart
    state.ganttChart = new Gantt('#ganttChart', [], {
        view_modes: ['Day', 'Week', 'Month'],
        view_mode: 'Week',
        date_format: 'YYYY-MM-DD',
        on_click: task => {
            const originalTask = state.tasks.find(t => t.id === task.id);
            if (originalTask) {
                showTaskDetails(originalTask);
            }
        },
        on_date_change: (task, start, end) => {
            updateTask(task.id, {
                startDate: start.toISOString(),
                dueDate: end.toISOString()
            });
        }
    });

    // Initialize Calendar
    updateCalendar();
}

function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.view-container').forEach(container => {
        container.classList.remove('active');
    });
    document.getElementById(`${view}View`).classList.add('active');

    document.querySelectorAll('.view-toggle button').forEach(button => {
        button.classList.toggle('active', button.dataset.view === view);
    });

    if (view === 'gantt') {
        updateGanttChart();
    } else if (view === 'calendar') {
        updateCalendar();
    }
}

// Rendering Functions
function renderAll() {
    renderProjects();
    renderTasks();
    renderTags();
    updateGanttChart();
    updateCalendar();
}

function renderProjects() {
    const container = document.getElementById('projectList');
    container.innerHTML = '';

    state.projects.forEach(project => {
        const div = document.createElement('div');
        div.className = 'project-item';
        if (state.currentProject?.id === project.id) {
            div.classList.add('active');
        }

        div.innerHTML = `
            <div class="project-color" style="background-color: ${project.color}"></div>
            <div class="project-info">
                <div class="project-name">${escapeHtml(project.name)}</div>
                <div class="project-meta">
                    ${countProjectTasks(project.id)} tasks
                </div>
            </div>
            <button class="project-menu" data-id="${project.id}">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        `;

        div.addEventListener('click', () => selectProject(project));
        container.appendChild(div);
    });
}

function renderTasks() {
    const tasks = filterTasks();

    // List View
    const listContainer = document.getElementById('taskList');
    listContainer.innerHTML = '';

    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = `task-item priority-${task.priority}`;
        div.innerHTML = `
            <div class="task-checkbox">
                <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''}>
            </div>
            <div class="task-content">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-meta">
                    ${renderTaskMeta(task)}
                </div>
            </div>
            <div class="task-actions">
                ${renderTaskActions(task)}
            </div>
        `;

        div.addEventListener('click', () => showTaskDetails(task));
        listContainer.appendChild(div);
    });

    // Board View
    document.querySelectorAll('.board-column .column-tasks').forEach(column => {
        column.innerHTML = '';
        const status = column.parentElement.dataset.status;
        const statusTasks = tasks.filter(t => t.status === status);

        statusTasks.forEach(task => {
            const div = document.createElement('div');
            div.className = `task-card priority-${task.priority}`;
            div.setAttribute('data-id', task.id);
            div.innerHTML = `
                <div class="card-title">${escapeHtml(task.title)}</div>
                <div class="card-meta">
                    ${renderTaskMeta(task)}
                </div>
            `;

            div.addEventListener('click', () => showTaskDetails(task));
            column.appendChild(div);
        });
    });

    updateGanttChart();
    updateCalendar();
}

function renderTaskDetails(task) {
    const container = document.getElementById('taskDetails');
    
    // Update form fields
    container.querySelector('.task-title').value = task.title;
    container.querySelector('.task-status').value = task.status;
    container.querySelector('.task-priority').value = task.priority;
    container.querySelector('.task-start-date').value = task.startDate ? task.startDate.split('T')[0] : '';
    container.querySelector('.task-due-date').value = task.dueDate ? task.dueDate.split('T')[0] : '';
    container.querySelector('.task-description').value = task.description;

    // Render assignees
    const assigneeList = container.querySelector('.assignee-list');
    assigneeList.innerHTML = task.assignees.map(assignee => `
        <div class="assignee-item">
            <span class="assignee-name">${escapeHtml(assignee)}</span>
            <button class="remove-assignee" data-assignee="${escapeHtml(assignee)}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    // Render tags
    const tagsList = container.querySelector('.task-tags');
    tagsList.innerHTML = task.tags.map(tagId => {
        const tag = state.tags.find(t => t.id === tagId);
        return tag ? `
            <span class="tag" style="background-color: ${tag.color}">
                ${escapeHtml(tag.name)}
                <button class="remove-tag" data-tag="${tagId}">
                    <i class="fas fa-times"></i>
                </button>
            </span>
        ` : '';
    }).join('');

    // Render subtasks
    const subtaskList = container.querySelector('.subtask-list');
    subtaskList.innerHTML = task.subtasks.map(subtask => `
        <div class="subtask-item">
            <input type="checkbox" ${subtask.completed ? 'checked' : ''}>
            <span class="subtask-title">${escapeHtml(subtask.title)}</span>
            <button class="remove-subtask" data-id="${subtask.id}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    // Render attachments
    const attachmentList = container.querySelector('.attachment-list');
    attachmentList.innerHTML = task.attachments.map(attachment => `
        <div class="attachment-item">
            <i class="fas fa-paperclip"></i>
            <span class="attachment-name">${escapeHtml(attachment.name)}</span>
            <button class="remove-attachment" data-id="${attachment.id}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    // Render comments
    const commentList = container.querySelector('.comment-list');
    commentList.innerHTML = task.comments.map(comment => `
        <div class="comment-item">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.author)}</span>
                <span class="comment-date">${formatDate(comment.created)}</span>
            </div>
            <div class="comment-content">${escapeHtml(comment.content)}</div>
        </div>
    `).join('');
}

// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function countProjectTasks(projectId) {
    return state.tasks.filter(t => t.projectId === projectId).length;
}

function filterTasks() {
    let tasks = state.tasks;

    // Filter by project
    if (state.currentProject) {
        tasks = tasks.filter(t => t.projectId === state.currentProject.id);
    }

    // Apply quick filter
    switch (state.currentFilter) {
        case 'today':
            tasks = tasks.filter(t => isToday(t.dueDate));
            break;
        case 'week':
            tasks = tasks.filter(t => isThisWeek(t.dueDate));
            break;
        case 'overdue':
            tasks = tasks.filter(t => isOverdue(t.dueDate));
            break;
        case 'completed':
            tasks = tasks.filter(t => t.status === 'completed');
            break;
    }

    // Apply search
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        tasks = tasks.filter(t => 
            t.title.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query)
        );
    }

    return tasks;
}

// Event Listeners
function setupEventListeners() {
    // View toggle
    document.querySelectorAll('.view-toggle button').forEach(button => {
        button.addEventListener('click', () => switchView(button.dataset.view));
    });

    // Quick filters
    document.querySelectorAll('.filter-buttons button').forEach(button => {
        button.addEventListener('click', () => {
            state.currentFilter = button.dataset.filter;
            renderTasks();
        });
    });

    // Search
    document.getElementById('searchTasks').addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderTasks();
    });

    // Add task button
    document.getElementById('addTask').addEventListener('click', () => {
        if (!state.currentProject) {
            showNotification('Please select a project first', 'error');
            return;
        }
        createTask(state.currentProject.id, {
            title: 'New Task',
            status: 'todo'
        });
    });

    // Add project button
    document.getElementById('addProject').addEventListener('click', () => {
        showProjectModal();
    });
}

// Initialize drag and drop
function initializeDragAndDrop() {
    // Board columns
    document.querySelectorAll('.board-column .column-tasks').forEach(column => {
        new Sortable(column, {
            group: 'tasks',
            animation: 150,
            onEnd: (evt) => {
                const taskId = evt.item.dataset.id;
                const newStatus = evt.to.parentElement.dataset.status;
                updateTask(taskId, { status: newStatus });
            }
        });
    });
}

// Show notifications
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');

    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
} 