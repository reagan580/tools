class QAManager {
    constructor() {
        // State management
        this.state = {
            projects: new Map(),
            currentProject: null,
            testSuites: new Map(),
            testCases: new Map(),
            executions: new Map(),
            selectedTestCase: null,
            filters: {
                type: [],
                priority: [],
                status: [],
                tags: []
            },
            users: new Map(),
            isDirty: false
        };

        // Constants
        this.TEST_TYPES = ['automated', 'manual'];
        this.PRIORITIES = ['high', 'medium', 'low'];
        this.STATUSES = ['passed', 'failed', 'blocked', 'skipped', 'not-executed'];
    }

    async initialize() {
        try {
            // Load data
            await this.loadProjects();
            await this.loadTestSuites();
            await this.loadTestCases();
            await this.loadUsers();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize UI components
            this.initializeTestSuiteTree();
            this.updateTestCaseList();
            this.updateStatistics();
            
            this.log('info', 'QA Manager initialized successfully');
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

        // New test suite button
        document.getElementById('newTestSuiteBtn').addEventListener('click', () => {
            this.showNewTestSuiteModal();
        });

        // View controls
        document.querySelector('.view-controls').addEventListener('click', (e) => {
            if (e.target.classList.contains('view-button')) {
                this.switchView(e.target.dataset.view);
            }
        });

        // New test case button
        document.querySelector('.new-test-case-btn').addEventListener('click', () => {
            this.showNewTestCaseModal();
        });

        // Test case list actions
        document.querySelector('.test-case-list').addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.action-btn');
            if (actionBtn) {
                const testCaseId = actionBtn.closest('tr').dataset.testCaseId;
                const action = actionBtn.textContent;
                
                switch(action) {
                    case '▶️': this.executeTestCase(testCaseId); break;
                    case '📝': this.editTestCase(testCaseId); break;
                    case '🗑️': this.deleteTestCase(testCaseId); break;
                }
            }
        });

        // Search and filters
        const searchInput = document.querySelector('.search-bar input');
        searchInput.addEventListener('input', debounce(() => {
            this.filterTestCases(searchInput.value);
        }, 300));

        document.getElementById('filterBtn').addEventListener('click', () => {
            this.showFilterModal();
        });
    }

    async createTestCase(testCaseData) {
        try {
            const testCase = {
                id: `TC-${Date.now()}`,
                projectId: this.state.currentProject.id,
                suiteId: testCaseData.suiteId,
                title: testCaseData.title,
                description: testCaseData.description,
                type: testCaseData.type,
                priority: testCaseData.priority,
                status: 'not-executed',
                preconditions: testCaseData.preconditions,
                steps: [],
                testData: new Map(),
                tags: testCaseData.tags,
                created: new Date(),
                createdBy: this.getCurrentUser(),
                modified: new Date(),
                executions: []
            };

            this.state.testCases.set(testCase.id, testCase);
            await this.saveTestCases();
            this.updateTestCaseList();
            this.updateStatistics();
            this.log('info', `Test case "${testCase.title}" created successfully`);
            return testCase;
        } catch (error) {
            this.log('error', `Failed to create test case: ${error.message}`);
            throw error;
        }
    }

    async executeTestCase(testCaseId) {
        try {
            const testCase = this.state.testCases.get(testCaseId);
            if (!testCase) {
                throw new Error(`Test case ${testCaseId} not found`);
            }

            const execution = {
                id: `EXEC-${Date.now()}`,
                testCaseId,
                startTime: new Date(),
                endTime: null,
                status: null,
                executor: this.getCurrentUser(),
                notes: '',
                stepResults: new Map(),
                environment: this.getCurrentEnvironment()
            };

            // Show execution modal
            this.showTestExecutionModal(testCase, execution);
        } catch (error) {
            this.log('error', `Failed to execute test case: ${error.message}`);
        }
    }

    async saveExecutionResults(execution, results) {
        try {
            execution.endTime = new Date();
            execution.status = results.status;
            execution.notes = results.notes;
            execution.stepResults = results.stepResults;

            const testCase = this.state.testCases.get(execution.testCaseId);
            testCase.executions.unshift(execution);
            testCase.status = execution.status;
            testCase.modified = new Date();

            await this.saveTestCases();
            this.updateTestCaseList();
            this.updateTestCaseDetails(execution.testCaseId);
            this.updateStatistics();

            this.log('info', `Execution results saved for test case ${execution.testCaseId}`);
        } catch (error) {
            this.log('error', `Failed to save execution results: ${error.message}`);
            throw error;
        }
    }

    createTestCaseRow(testCase) {
        const row = document.createElement('tr');
        row.className = 'test-case-row';
        row.dataset.testCaseId = testCase.id;

        row.innerHTML = `
            <td><input type="checkbox"></td>
            <td>${testCase.id}</td>
            <td>${escapeHtml(testCase.title)}</td>
            <td><span class="badge ${testCase.type}">${testCase.type}</span></td>
            <td><span class="priority ${testCase.priority}">${testCase.priority}</span></td>
            <td><span class="status ${testCase.status}">${formatStatus(testCase.status)}</span></td>
            <td>${testCase.executions.length > 0 ? formatDate(testCase.executions[0].endTime) : 'Never'}</td>
            <td>
                <button class="action-btn">▶️</button>
                <button class="action-btn">📝</button>
                <button class="action-btn">🗑️</button>
            </td>
        `;

        return row;
    }

    updateTestCaseList() {
        const tbody = document.querySelector('.test-case-list tbody');
        tbody.innerHTML = '';

        // Filter and sort test cases
        const filteredTestCases = Array.from(this.state.testCases.values())
            .filter(testCase => this.matchesFilters(testCase))
            .sort((a, b) => b.modified - a.modified);

        // Create and append rows
        filteredTestCases.forEach(testCase => {
            tbody.appendChild(this.createTestCaseRow(testCase));
        });
    }

    updateTestCaseDetails(testCaseId) {
        const testCase = this.state.testCases.get(testCaseId);
        if (!testCase) return;

        const detailsSection = document.querySelector('.test-case-details');
        detailsSection.innerHTML = `
            <div class="details-header">
                <span class="test-id">${testCase.id}</span>
                <h3>${escapeHtml(testCase.title)}</h3>
                <div class="test-status">
                    <span class="status-badge ${testCase.status}">${formatStatus(testCase.status)}</span>
                </div>
            </div>
            <div class="details-content">
                <div class="info-group">
                    <label>Type</label>
                    <span class="badge ${testCase.type}">${testCase.type}</span>
                </div>
                <div class="info-group">
                    <label>Priority</label>
                    <span class="priority ${testCase.priority}">${testCase.priority}</span>
                </div>
                <div class="info-group">
                    <label>Created By</label>
                    <div class="user-info">
                        <img src="${this.getUserAvatar(testCase.createdBy)}" alt="${this.getUserName(testCase.createdBy)}">
                        <span>${this.getUserName(testCase.createdBy)}</span>
                    </div>
                </div>
                <div class="info-group">
                    <label>Last Modified</label>
                    <span>${formatDate(testCase.modified)}</span>
                </div>
            </div>
        `;

        // Update test steps
        this.updateTestSteps(testCase);
        
        // Update test data
        this.updateTestData(testCase);
        
        // Update execution history
        this.updateExecutionHistory(testCase);
    }

    updateTestSteps(testCase) {
        const stepsList = document.querySelector('.steps-list');
        stepsList.innerHTML = testCase.steps.map((step, index) => `
            <div class="step-item">
                <div class="step-header">
                    <span class="step-number">${index + 1}</span>
                    <span class="step-title">${escapeHtml(step.title)}</span>
                </div>
                <div class="step-content">
                    <div class="step-description">
                        ${escapeHtml(step.description)}
                    </div>
                    <div class="step-expected">
                        <strong>Expected:</strong> ${escapeHtml(step.expected)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateStatistics() {
        const stats = this.calculateStatistics();
        
        document.querySelector('.suite-stats').innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total Cases</span>
                <span class="stat-value">${stats.total}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Executed</span>
                <span class="stat-value">${stats.executedPercentage}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Pass Rate</span>
                <span class="stat-value ${stats.passRate > 80 ? 'success' : 'warning'}">
                    ${stats.passRate}%
                </span>
            </div>
        `;
    }

    calculateStatistics() {
        const testCases = Array.from(this.state.testCases.values());
        const total = testCases.length;
        const executed = testCases.filter(tc => tc.status !== 'not-executed').length;
        const passed = testCases.filter(tc => tc.status === 'passed').length;

        return {
            total,
            executed,
            executedPercentage: Math.round((executed / total) * 100) || 0,
            passRate: Math.round((passed / executed) * 100) || 0
        };
    }

    matchesFilters(testCase) {
        const { filters } = this.state;

        // Type filter
        if (filters.type.length > 0 && !filters.type.includes(testCase.type)) {
            return false;
        }

        // Priority filter
        if (filters.priority.length > 0 && !filters.priority.includes(testCase.priority)) {
            return false;
        }

        // Status filter
        if (filters.status.length > 0 && !filters.status.includes(testCase.status)) {
            return false;
        }

        // Tags filter
        if (filters.tags.length > 0 && !filters.tags.some(tag => testCase.tags.includes(tag))) {
            return false;
        }

        return true;
    }

    showTestExecutionModal(testCase, execution) {
        const modal = document.getElementById('testExecutionModal');
        modal.style.display = 'block';

        // Populate test case information
        modal.querySelector('.test-info').innerHTML = `
            <h3>${testCase.id}: ${escapeHtml(testCase.title)}</h3>
            <span class="badge ${testCase.type}">${testCase.type}</span>
        `;

        // Populate steps
        const stepsList = modal.querySelector('.steps-list');
        stepsList.innerHTML = testCase.steps.map((step, index) => `
            <div class="step-execution-item">
                <div class="step-header">
                    <span class="step-number">${index + 1}</span>
                    <span class="step-title">${escapeHtml(step.title)}</span>
                </div>
                <div class="step-result">
                    <select class="step-status">
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                        <option value="blocked">Blocked</option>
                        <option value="skipped">Skipped</option>
                    </select>
                    <textarea class="step-notes" placeholder="Add notes..."></textarea>
                </div>
            </div>
        `).join('');

        // Handle form submission
        const saveButton = modal.querySelector('[data-action="save"]');
        saveButton.onclick = async () => {
            const results = {
                status: modal.querySelector('.execution-result select').value,
                notes: modal.querySelector('.execution-notes textarea').value,
                stepResults: new Map(Array.from(stepsList.children).map((stepEl, index) => [
                    index,
                    {
                        status: stepEl.querySelector('.step-status').value,
                        notes: stepEl.querySelector('.step-notes').value
                    }
                ]))
            };

            try {
                await this.saveExecutionResults(execution, results);
                modal.style.display = 'none';
            } catch (error) {
                this.log('error', `Failed to save execution results: ${error.message}`);
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

    getCurrentEnvironment() {
        // This would typically come from configuration
        return {
            name: 'Test Environment',
            url: 'https://test.example.com',
            browser: 'Chrome',
            version: '120.0.0'
        };
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

function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

function formatStatus(status) {
    return status.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const qaManager = new QAManager();
    qaManager.initialize().catch(error => {
        console.error('Failed to initialize QA Manager:', error);
    });
}); 