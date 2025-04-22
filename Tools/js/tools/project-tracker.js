class ProjectTracker {
    constructor() {
        // State management
        this.state = {
            projects: new Map(),
            currentProject: null,
            issues: new Map(),
            selectedIssue: null,
            filters: {
                status: [],
                type: [],
                priority: [],
                assignee: [],
                labels: [],
                dateRange: { start: null, end: null }
            },
            users: new Map(),
            labels: new Set(),
            isDragging: false,
            unsavedChanges: false
        };

        // Constants
        this.ISSUE_TYPES = ['bug', 'feature', 'task'];
        this.PRIORITIES = ['high', 'medium', 'low'];
        this.STATUSES = ['todo', 'in-progress', 'review', 'done'];
    }

    async initialize() {
        try {
            // Load data
            await this.loadProjects();
            await this.loadUsers();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize drag and drop
            this.initializeDragAndDrop();
            
            // Update UI
            this.updateProjectSelector();
            this.updateBoardView();
            
            this.log('info', 'Project Tracker initialized successfully');
        } catch (error) {
            this.log('error', `Initialization failed: ${error.message}`);
            throw error;
        }
    }

    setupEventListeners() {
        // Project selection
        document.getElementById('currentProject').addEventListener('change', (e) => {
            this.loadProject(e.target.value);
        });

        // New project button
        document.getElementById('newProjectBtn').addEventListener('click', () => {
            this.showNewProjectModal();
        });

        // View controls
        document.querySelector('.view-controls').addEventListener('click', (e) => {
            if (e.target.classList.contains('view-button')) {
                this.switchView(e.target.dataset.view);
            }
        });

        // New issue button
        document.querySelector('.new-issue-btn').addEventListener('click', () => {
            this.showNewIssueModal();
        });

        // Filter button
        document.getElementById('filterBtn').addEventListener('click', () => {
            this.showFilterModal();
        });

        // Search
        const searchInput = document.querySelector('.search-bar input');
        searchInput.addEventListener('input', debounce(() => {
            this.filterIssues(searchInput.value);
        }, 300));
    }

    initializeDragAndDrop() {
        const issueCards = document.querySelectorAll('.issue-card');
        const columns = document.querySelectorAll('.board-column');

        issueCards.forEach(card => {
            card.addEventListener('dragstart', (e) => this.handleDragStart(e));
            card.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });

        columns.forEach(column => {
            column.addEventListener('dragover', (e) => this.handleDragOver(e));
            column.addEventListener('drop', (e) => this.handleDrop(e));
        });
    }

    handleDragStart(e) {
        this.state.isDragging = true;
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.issueId);
    }

    handleDragEnd(e) {
        this.state.isDragging = false;
        e.target.classList.remove('dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
        if (this.state.isDragging) {
            const column = e.target.closest('.board-column');
            if (column) {
                column.classList.add('drag-over');
            }
        }
    }

    async handleDrop(e) {
        e.preventDefault();
        const column = e.target.closest('.board-column');
        if (column) {
            column.classList.remove('drag-over');
            const issueId = e.dataTransfer.getData('text/plain');
            const newStatus = column.dataset.status;
            await this.updateIssueStatus(issueId, newStatus);
        }
    }

    async createIssue(issueData) {
        try {
            const issue = {
                id: `issue_${Date.now()}`,
                projectId: this.state.currentProject.id,
                title: issueData.title,
                description: issueData.description,
                type: issueData.type,
                status: 'todo',
                priority: issueData.priority,
                assignee: issueData.assignee,
                dueDate: issueData.dueDate,
                labels: issueData.labels,
                created: new Date(),
                modified: new Date(),
                createdBy: this.getCurrentUser(),
                activity: []
            };

            this.state.issues.set(issue.id, issue);
            await this.saveIssues();
            this.updateBoardView();
            this.log('info', `Issue "${issue.title}" created successfully`);
            return issue;
        } catch (error) {
            this.log('error', `Failed to create issue: ${error.message}`);
            throw error;
        }
    }

    async updateIssue(issueId, updates) {
        try {
            const issue = this.state.issues.get(issueId);
            if (!issue) {
                throw new Error(`Issue ${issueId} not found`);
            }

            const oldIssue = { ...issue };
            Object.assign(issue, updates, { modified: new Date() });

            // Track changes for activity log
            const changes = this.getChanges(oldIssue, issue);
            if (changes.length > 0) {
                issue.activity.push({
                    timestamp: new Date(),
                    user: this.getCurrentUser(),
                    changes
                });
            }

            await this.saveIssues();
            this.updateIssueCard(issueId);
            this.updateIssueDetails(issueId);
            
            this.log('info', `Issue "${issue.title}" updated successfully`);
        } catch (error) {
            this.log('error', `Failed to update issue: ${error.message}`);
            throw error;
        }
    }

    getChanges(oldIssue, newIssue) {
        const changes = [];
        const trackableFields = ['status', 'assignee', 'priority', 'dueDate'];

        trackableFields.forEach(field => {
            if (oldIssue[field] !== newIssue[field]) {
                changes.push({
                    field,
                    from: oldIssue[field],
                    to: newIssue[field]
                });
            }
        });

        // Check for label changes
        if (!arraysEqual(oldIssue.labels, newIssue.labels)) {
            changes.push({
                field: 'labels',
                from: oldIssue.labels,
                to: newIssue.labels
            });
        }

        return changes;
    }

    createIssueCard(issue) {
        const card = document.createElement('div');
        card.className = 'issue-card';
        card.dataset.issueId = issue.id;
        card.draggable = true;

        card.innerHTML = `
            <div class="card-header">
                <span class="issue-type ${issue.type}">${issue.type}</span>
                <span class="issue-id">#${issue.id.split('_')[1]}</span>
            </div>
            <h4 class="issue-title">${escapeHtml(issue.title)}</h4>
            <p class="issue-description">${escapeHtml(issue.description.substring(0, 100))}${issue.description.length > 100 ? '...' : ''}</p>
            <div class="card-footer">
                ${issue.assignee ? `
                    <div class="assignee">
                        <img src="${this.getUserAvatar(issue.assignee)}" alt="${this.getUserName(issue.assignee)}">
                    </div>
                ` : ''}
                ${issue.dueDate ? `
                    <span class="due-date">Due ${formatDate(issue.dueDate)}</span>
                ` : ''}
                <span class="priority ${issue.priority}">${issue.priority}</span>
            </div>
        `;

        card.addEventListener('click', () => this.selectIssue(issue.id));
        return card;
    }

    updateBoardView() {
        const columns = document.querySelectorAll('.board-column');
        columns.forEach(column => {
            const status = column.dataset.status;
            const content = column.querySelector('.column-content');
            content.innerHTML = '';

            // Filter issues for this status
            const statusIssues = Array.from(this.state.issues.values())
                .filter(issue => issue.status === status && this.matchesFilters(issue));

            // Update issue count
            column.querySelector('.issue-count').textContent = statusIssues.length;

            // Create and append issue cards
            statusIssues.forEach(issue => {
                content.appendChild(this.createIssueCard(issue));
            });
        });
    }

    matchesFilters(issue) {
        const { filters } = this.state;

        // Status filter
        if (filters.status.length > 0 && !filters.status.includes(issue.status)) {
            return false;
        }

        // Type filter
        if (filters.type.length > 0 && !filters.type.includes(issue.type)) {
            return false;
        }

        // Priority filter
        if (filters.priority.length > 0 && !filters.priority.includes(issue.priority)) {
            return false;
        }

        // Assignee filter
        if (filters.assignee.length > 0 && !filters.assignee.includes(issue.assignee)) {
            return false;
        }

        // Labels filter
        if (filters.labels.length > 0 && !filters.labels.some(label => issue.labels.includes(label))) {
            return false;
        }

        // Date range filter
        if (filters.dateRange.start && filters.dateRange.end) {
            const dueDate = new Date(issue.dueDate);
            if (dueDate < filters.dateRange.start || dueDate > filters.dateRange.end) {
                return false;
            }
        }

        return true;
    }

    updateIssueDetails(issueId) {
        const issue = this.state.issues.get(issueId);
        if (!issue) return;

        const detailsSection = document.querySelector('.issue-details');
        detailsSection.innerHTML = `
            <div class="issue-header">
                <span class="issue-type ${issue.type}">${issue.type}</span>
                <h3>#${issue.id.split('_')[1]} ${escapeHtml(issue.title)}</h3>
                <div class="issue-status">
                    <span class="status-badge ${issue.status}">${formatStatus(issue.status)}</span>
                </div>
            </div>
            <div class="issue-info">
                <div class="info-group">
                    <label>Assignee</label>
                    <div class="assignee-selector">
                        ${issue.assignee ? `
                            <img src="${this.getUserAvatar(issue.assignee)}" alt="${this.getUserName(issue.assignee)}">
                            <span>${this.getUserName(issue.assignee)}</span>
                        ` : '<span>Unassigned</span>'}
                        <button class="change-btn">Change</button>
                    </div>
                </div>
                <div class="info-group">
                    <label>Due Date</label>
                    <div class="date-selector">
                        <input type="date" value="${issue.dueDate || ''}" onchange="updateIssueDueDate('${issue.id}', this.value)">
                    </div>
                </div>
                <div class="info-group">
                    <label>Priority</label>
                    <select class="priority-selector" onchange="updateIssuePriority('${issue.id}', this.value)">
                        ${this.PRIORITIES.map(p => `
                            <option value="${p}" ${issue.priority === p ? 'selected' : ''}>${p}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="info-group">
                    <label>Labels</label>
                    <div class="label-list">
                        ${issue.labels.map(label => `
                            <span class="label">${label}</span>
                        `).join('')}
                        <button class="add-label-btn">+</button>
                    </div>
                </div>
            </div>
        `;

        // Update activity log
        const activityList = document.querySelector('.activity-list');
        activityList.innerHTML = issue.activity.map(activity => `
            <div class="activity-item">
                <img src="${this.getUserAvatar(activity.user)}" alt="${this.getUserName(activity.user)}">
                <div class="activity-content">
                    <span class="actor">${this.getUserName(activity.user)}</span>
                    ${activity.changes.map(change => `
                        <span class="action">changed ${change.field} from</span>
                        <span class="value">${change.from}</span>
                        <span class="action">to</span>
                        <span class="value">${change.to}</span>
                    `).join('')}
                    <span class="time">${formatTimeAgo(activity.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }

    showNewIssueModal() {
        const modal = document.getElementById('newIssueModal');
        modal.style.display = 'block';

        // Populate assignee dropdown
        const assigneeSelect = document.getElementById('issueAssignee');
        assigneeSelect.innerHTML = '<option value="">Unassigned</option>';
        this.state.users.forEach(user => {
            assigneeSelect.innerHTML += `
                <option value="${user.id}">${user.name}</option>
            `;
        });

        // Handle form submission
        const form = modal.querySelector('.issue-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            try {
                const issueData = {
                    title: document.getElementById('issueTitle').value,
                    type: document.getElementById('issueType').value,
                    description: document.getElementById('issueDescription').value,
                    assignee: document.getElementById('issueAssignee').value,
                    priority: document.getElementById('issuePriority').value,
                    dueDate: document.getElementById('issueDueDate').value,
                    labels: this.getSelectedLabels()
                };

                await this.createIssue(issueData);
                modal.style.display = 'none';
                form.reset();
            } catch (error) {
                this.log('error', `Failed to create issue: ${error.message}`);
            }
        };
    }

    // Utility functions
    log(level, message) {
        const logEntry = {
            timestamp: new Date(),
            level,
            message
        };

        console.log(`[${level.toUpperCase()}] ${message}`);
        // You could also implement UI logging here
    }

    getCurrentUser() {
        // This would typically come from authentication
        return 'current_user_id';
    }

    getUserAvatar(userId) {
        const user = this.state.users.get(userId);
        return user ? user.avatar : 'default-avatar.png';
    }

    getUserName(userId) {
        const user = this.state.users.get(userId);
        return user ? user.name : 'Unknown User';
    }
}

// Helper functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString();
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    return 'just now';
}

function formatStatus(status) {
    return status.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const projectTracker = new ProjectTracker();
    projectTracker.initialize().catch(error => {
        console.error('Failed to initialize Project Tracker:', error);
    });
}); 