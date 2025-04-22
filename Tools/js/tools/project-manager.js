// State Management
class ProjectManagerState {
    constructor() {
        this.projects = new Map();
        this.tasks = new Map();
        this.teams = new Map();
        this.users = new Map();
        this.currentProject = null;
        this.currentView = 'board';
        this.filters = {
            status: '',
            assignee: '',
            priority: '',
            dueDate: ''
        };
        this.settings = {
            autoSave: true,
            notifications: true,
            theme: 'light'
        };
    }
}

// Main Project Manager Class
class ProjectManager {
    constructor() {
        this.state = new ProjectManagerState();
        this.draggedTask = null;
        this.charts = new Map();
        this.eventHandlers = new Map();
    }

    // Initialization
    async initialize() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.initializeViews();
            this.renderCurrentView();
            this.setupDragAndDrop();
            this.initializeCharts();
            this.startAutoSave();
        } catch (error) {
            this.showNotification('Error initializing Project Manager', 'error');
            console.error('Initialization error:', error);
        }
    }

    // Data Management
    async loadData() {
        try {
            const [projects, tasks, teams, users] = await Promise.all([
                this.fetchProjects(),
                this.fetchTasks(),
                this.fetchTeams(),
                this.fetchUsers()
            ]);

            this.state.projects = new Map(projects.map(p => [p.id, p]));
            this.state.tasks = new Map(tasks.map(t => [t.id, t]));
            this.state.teams = new Map(teams.map(t => [t.id, t]));
            this.state.users = new Map(users.map(u => [u.id, u]));

            this.updateProjectSelector();
            this.updateTeamList();
        } catch (error) {
            this.showNotification('Error loading data', 'error');
        }
    }

    // Project Management
    async createProject(projectData) {
        try {
            const project = {
                id: this.generateId(),
                createdAt: new Date(),
                status: 'active',
                ...projectData
            };

            await this.saveProject(project);
            this.state.projects.set(project.id, project);
            this.updateProjectSelector();
            this.showNotification('Project created successfully', 'success');
            return project;
        } catch (error) {
            this.showNotification('Error creating project', 'error');
            throw error;
        }
    }

    async updateProject(projectId, updates) {
        try {
            const project = this.state.projects.get(projectId);
            if (!project) throw new Error('Project not found');

            const updatedProject = { ...project, ...updates, updatedAt: new Date() };
            await this.saveProject(updatedProject);
            this.state.projects.set(projectId, updatedProject);
            this.updateProjectSelector();
            this.showNotification('Project updated successfully', 'success');
        } catch (error) {
            this.showNotification('Error updating project', 'error');
            throw error;
        }
    }

    // Task Management
    async createTask(taskData) {
        try {
            const task = {
                id: this.generateId(),
                createdAt: new Date(),
                status: 'todo',
                priority: 'medium',
                ...taskData
            };

            await this.saveTask(task);
            this.state.tasks.set(task.id, task);
            this.renderTask(task);
            this.showNotification('Task created successfully', 'success');
            return task;
        } catch (error) {
            this.showNotification('Error creating task', 'error');
            throw error;
        }
    }

    async updateTask(taskId, updates) {
        try {
            const task = this.state.tasks.get(taskId);
            if (!task) throw new Error('Task not found');

            const updatedTask = { ...task, ...updates, updatedAt: new Date() };
            await this.saveTask(updatedTask);
            this.state.tasks.set(taskId, updatedTask);
            this.renderTask(updatedTask);
            this.showNotification('Task updated successfully', 'success');
        } catch (error) {
            this.showNotification('Error updating task', 'error');
            throw error;
        }
    }

    // View Management
    initializeViews() {
        this.views = {
            board: new BoardView(this),
            list: new ListView(this),
            calendar: new CalendarView(this),
            timeline: new TimelineView(this),
            reports: new ReportsView(this)
        };
    }

    switchView(viewName) {
        if (!this.views[viewName]) return;
        this.state.currentView = viewName;
        this.renderCurrentView();
    }

    renderCurrentView() {
        const view = this.views[this.state.currentView];
        if (!view) return;

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${this.state.currentView}View`).classList.add('active');
        view.render();
    }

    // Drag and Drop
    setupDragAndDrop() {
        document.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('dragstart', e => this.handleDragStart(e));
            card.addEventListener('dragend', e => this.handleDragEnd(e));
        });

        document.querySelectorAll('.column-content').forEach(column => {
            column.addEventListener('dragover', e => this.handleDragOver(e));
            column.addEventListener('drop', e => this.handleDrop(e));
        });
    }

    handleDragStart(event) {
        this.draggedTask = event.target;
        event.target.classList.add('dragging');
    }

    handleDragEnd(event) {
        event.target.classList.remove('dragging');
        this.draggedTask = null;
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    async handleDrop(event) {
        event.preventDefault();
        if (!this.draggedTask) return;

        const column = event.target.closest('.column-content');
        if (!column) return;

        const status = column.parentElement.dataset.status;
        const taskId = this.draggedTask.dataset.taskId;
        await this.updateTask(taskId, { status });
    }

    // Chart Management
    initializeCharts() {
        this.initializeBurndownChart();
        this.initializeVelocityChart();
        this.initializeWorkloadChart();
    }

    initializeBurndownChart() {
        const ctx = document.getElementById('burndownChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.set('burndown', new Chart(ctx, {
            type: 'line',
            data: this.getBurndownData(),
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }));
    }

    // Report Generation
    async generateReport(type) {
        try {
            const reportData = await this.fetchReportData(type);
            const report = this.formatReport(type, reportData);
            return report;
        } catch (error) {
            this.showNotification('Error generating report', 'error');
            throw error;
        }
    }

    // Event Handlers
    setupEventListeners() {
        // View switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => this.switchView(button.dataset.view));
        });

        // Project selection
        document.getElementById('currentProject')?.addEventListener('change', (e) => {
            this.loadProject(e.target.value);
        });

        // Task creation
        document.getElementById('addTaskBtn')?.addEventListener('click', () => {
            this.showTaskModal();
        });

        // Form submissions
        document.getElementById('taskForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTaskFormSubmit(e.target);
        });

        document.getElementById('projectForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleProjectFormSubmit(e.target);
        });
    }

    // Utility Functions
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    startAutoSave() {
        if (!this.state.settings.autoSave) return;
        setInterval(() => this.saveData(), 60000); // Auto-save every minute
    }

    async saveData() {
        try {
            await Promise.all([
                this.saveProjects(),
                this.saveTasks(),
                this.saveTeams()
            ]);
        } catch (error) {
            console.error('Auto-save error:', error);
        }
    }
}

// View Classes
class BoardView {
    constructor(manager) {
        this.manager = manager;
    }

    render() {
        this.renderColumns();
        this.renderTasks();
    }

    renderColumns() {
        const container = document.querySelector('.board-container');
        if (!container) return;

        const columns = ['todo', 'inProgress', 'review', 'done'];
        container.innerHTML = columns.map(status => this.createColumnHTML(status)).join('');
    }

    renderTasks() {
        const tasks = Array.from(this.manager.state.tasks.values())
            .filter(task => task.projectId === this.manager.state.currentProject);

        tasks.forEach(task => {
            const column = document.querySelector(`.board-column[data-status="${task.status}"] .column-content`);
            if (column) {
                column.appendChild(this.createTaskCard(task));
            }
        });
    }

    createColumnHTML(status) {
        return `
            <div class="board-column" data-status="${status}">
                <div class="column-header">
                    <h3>${this.formatStatus(status)}</h3>
                    <span class="task-count">0</span>
                </div>
                <div class="column-content"></div>
            </div>
        `;
    }

    createTaskCard(task) {
        const template = document.getElementById('taskCardTemplate');
        const card = template.content.cloneNode(true);
        
        // Populate card with task data
        card.querySelector('.task-title').textContent = task.title;
        card.querySelector('.task-description').textContent = task.description;
        card.querySelector('.due-date').textContent = this.formatDate(task.dueDate);
        card.querySelector('.priority').textContent = task.priority;
        
        return card;
    }

    formatStatus(status) {
        return status.split(/(?=[A-Z])/).join(' ').replace(/^\w/, c => c.toUpperCase());
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString();
    }
}

// Initialize Project Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const projectManager = new ProjectManager();
    projectManager.initialize().catch(error => {
        console.error('Failed to initialize Project Manager:', error);
    });
}); 