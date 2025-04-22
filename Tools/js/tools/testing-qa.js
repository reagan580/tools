// State Management
const state = {
    testSuites: [],
    testCases: [],
    testRuns: [],
    bugs: [],
    currentModule: 'testCases',
    currentTestSuite: null,
    currentTestCase: null,
    currentTestRun: null,
    currentBug: null,
    filters: {
        search: '',
        priority: '',
        type: '',
        status: '',
        environment: '',
        severity: '',
        assignee: ''
    },
    settings: {
        autoSave: true,
        notifications: true,
        defaultPriority: 'medium',
        defaultTestType: 'functional'
    }
};

class TestingQATool {
    constructor() {
        this.initializeApp();
        this.setupEventListeners();
        this.loadData();
    }

    async initializeApp() {
        try {
            await this.loadSettings();
            await this.loadTestSuites();
            await this.loadTestCases();
            await this.loadTestRuns();
            await this.loadBugs();
            this.initializeCharts();
            this.renderCurrentModule();
        } catch (error) {
            this.showNotification('Error initializing app: ' + error.message, 'error');
        }
    }

    // Test Suite Management
    async loadTestSuites() {
        try {
            const suites = await this.fetchFromStorage('testSuites') || [];
            state.testSuites = suites.map(suite => new TestSuite(suite));
            this.renderTestTree();
        } catch (error) {
            this.showNotification('Error loading test suites', 'error');
        }
    }

    async createTestSuite(suiteData) {
        try {
            const suite = new TestSuite({
                id: this.generateId(),
                name: suiteData.name,
                description: suiteData.description,
                product: suiteData.product,
                parentId: suiteData.parentId,
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            state.testSuites.push(suite);
            await this.saveTestSuites();
            this.renderTestTree();
            this.showNotification('Test suite created successfully', 'success');
            return suite;
        } catch (error) {
            this.showNotification('Error creating test suite', 'error');
            throw error;
        }
    }

    // Test Case Management
    async createTestCase(testCaseData) {
        try {
            const testCase = new TestCase({
                id: this.generateId(),
                title: testCaseData.title,
                description: testCaseData.description,
                preconditions: testCaseData.preconditions,
                steps: testCaseData.steps,
                expectedResults: testCaseData.expectedResults,
                priority: testCaseData.priority || state.settings.defaultPriority,
                type: testCaseData.type || state.settings.defaultTestType,
                suiteId: testCaseData.suiteId,
                status: 'active',
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            state.testCases.push(testCase);
            await this.saveTestCases();
            this.renderTestCases();
            this.showNotification('Test case created successfully', 'success');
            return testCase;
        } catch (error) {
            this.showNotification('Error creating test case', 'error');
            throw error;
        }
    }

    // Test Run Management
    async createTestRun(runData) {
        try {
            const testRun = new TestRun({
                id: this.generateId(),
                name: runData.name,
                description: runData.description,
                environment: runData.environment,
                testCases: runData.testCases.map(tc => ({
                    id: tc.id,
                    status: 'pending',
                    results: []
                })),
                status: 'in_progress',
                startedAt: new Date(),
                startedBy: this.getCurrentUser().id
            });

            state.testRuns.push(testRun);
            await this.saveTestRuns();
            this.renderTestRuns();
            this.showNotification('Test run created successfully', 'success');
            return testRun;
        } catch (error) {
            this.showNotification('Error creating test run', 'error');
            throw error;
        }
    }

    async updateTestResult(runId, caseId, result) {
        try {
            const testRun = this.getTestRunById(runId);
            const testCase = testRun.testCases.find(tc => tc.id === caseId);
            
            testCase.status = result.status;
            testCase.results.push({
                status: result.status,
                notes: result.notes,
                attachments: result.attachments,
                timestamp: new Date(),
                tester: this.getCurrentUser().id
            });

            await this.saveTestRuns();
            this.renderTestRun(testRun);
            this.updateTestRunStatus(testRun);
        } catch (error) {
            this.showNotification('Error updating test result', 'error');
            throw error;
        }
    }

    // Bug Tracking
    async createBug(bugData) {
        try {
            const bug = new Bug({
                id: this.generateId(),
                title: bugData.title,
                description: bugData.description,
                steps: bugData.steps,
                expectedResult: bugData.expectedResult,
                actualResult: bugData.actualResult,
                severity: bugData.severity,
                priority: bugData.priority,
                environment: bugData.environment,
                attachments: bugData.attachments,
                status: 'open',
                assignee: bugData.assignee,
                reporter: this.getCurrentUser().id,
                createdAt: new Date()
            });

            state.bugs.push(bug);
            await this.saveBugs();
            this.renderBugs();
            this.showNotification('Bug reported successfully', 'success');
            return bug;
        } catch (error) {
            this.showNotification('Error reporting bug', 'error');
            throw error;
        }
    }

    // Reporting
    generateReport(type, startDate, endDate) {
        try {
            const reportData = this.calculateReportMetrics(type, startDate, endDate);
            this.renderReport(type, reportData);
        } catch (error) {
            this.showNotification('Error generating report', 'error');
            throw error;
        }
    }

    calculateReportMetrics(type, startDate, endDate) {
        const metrics = {
            totalTestCases: 0,
            passedTests: 0,
            failedTests: 0,
            blockedTests: 0,
            bugsByPriority: {},
            testExecutionTime: 0,
            coverage: 0
        };

        // Calculate metrics based on type
        switch (type) {
            case 'summary':
                this.calculateSummaryMetrics(metrics, startDate, endDate);
                break;
            case 'coverage':
                this.calculateCoverageMetrics(metrics, startDate, endDate);
                break;
            case 'bugs':
                this.calculateBugMetrics(metrics, startDate, endDate);
                break;
            case 'trends':
                this.calculateTrendMetrics(metrics, startDate, endDate);
                break;
        }

        return metrics;
    }

    // UI Rendering
    renderCurrentModule() {
        document.querySelectorAll('.module').forEach(module => {
            module.classList.remove('active');
        });
        document.getElementById(`${state.currentModule}Module`).classList.add('active');

        switch (state.currentModule) {
            case 'testCases':
                this.renderTestCases();
                break;
            case 'testRuns':
                this.renderTestRuns();
                break;
            case 'bugTracker':
                this.renderBugs();
                break;
            case 'reports':
                this.renderReports();
                break;
        }
    }

    renderTestTree() {
        const treeElement = document.getElementById('testTree');
        treeElement.innerHTML = '';
        this.buildTestTree(null, treeElement);
    }

    buildTestTree(parentId, container) {
        const suites = state.testSuites.filter(suite => suite.parentId === parentId);
        
        suites.forEach(suite => {
            const suiteElement = this.createSuiteElement(suite);
            container.appendChild(suiteElement);
            
            const childContainer = document.createElement('div');
            childContainer.className = 'suite-children';
            suiteElement.appendChild(childContainer);
            
            this.buildTestTree(suite.id, childContainer);
        });
    }

    // Event Handlers
    setupEventListeners() {
        // Module Navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                state.currentModule = e.target.dataset.module;
                this.renderCurrentModule();
            });
        });

        // Test Suite Events
        document.getElementById('newTestSuiteBtn').addEventListener('click', () => {
            this.showNewTestSuiteModal();
        });

        // Test Case Events
        document.getElementById('newTestCaseBtn').addEventListener('click', () => {
            this.showNewTestCaseModal();
        });

        // Test Run Events
        document.getElementById('newTestRunBtn').addEventListener('click', () => {
            this.showNewTestRunModal();
        });

        // Bug Events
        document.getElementById('newBugBtn').addEventListener('click', () => {
            this.showNewBugModal();
        });

        // Filter Events
        this.setupFilterListeners();
    }

    // Data Classes
    class TestSuite {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                description: '',
                product: '',
                parentId: null,
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null
            }, data);
        }
    }

    class TestCase {
        constructor(data) {
            Object.assign(this, {
                id: null,
                title: '',
                description: '',
                preconditions: '',
                steps: [],
                expectedResults: '',
                priority: 'medium',
                type: 'functional',
                suiteId: null,
                status: 'active',
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null
            }, data);
        }
    }

    class TestRun {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                description: '',
                environment: '',
                testCases: [],
                status: 'pending',
                startedAt: null,
                startedBy: null,
                completedAt: null,
                completedBy: null
            }, data);
        }
    }

    class Bug {
        constructor(data) {
            Object.assign(this, {
                id: null,
                title: '',
                description: '',
                steps: [],
                expectedResult: '',
                actualResult: '',
                severity: 'medium',
                priority: 'medium',
                environment: '',
                attachments: [],
                status: 'open',
                assignee: null,
                reporter: null,
                createdAt: null,
                updatedAt: null
            }, data);
        }
    }
}

// Initialize application
const testingQA = new TestingQATool(); 