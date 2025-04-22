// State Management
class CloudManagerState {
    constructor() {
        this.resources = new Map();
        this.costs = new Map();
        this.security = {
            score: 0,
            findings: [],
            compliance: new Map()
        };
        this.automation = {
            rules: new Map(),
            tasks: new Map()
        };
        this.settings = {
            currentRegion: '',
            refreshInterval: 300000, // 5 minutes
            costAlertThreshold: 1000,
            autoScaling: true
        };
        this.metrics = new Map();
        this.alerts = [];
    }
}

// Main Cloud Manager Class
class CloudManager {
    constructor() {
        this.state = new CloudManagerState();
        this.charts = new Map();
        this.currentModule = 'dashboard';
        this.refreshTimer = null;
    }

    // Initialization
    async initialize() {
        try {
            await this.loadSettings();
            await this.initializeModules();
            this.setupEventListeners();
            this.startRefreshTimer();
            this.renderCurrentModule();
        } catch (error) {
            this.showNotification('Error initializing Cloud Manager', 'error');
            console.error('Initialization error:', error);
        }
    }

    // Module Management
    async initializeModules() {
        await Promise.all([
            this.initializeDashboard(),
            this.initializeResources(),
            this.initializeCosts(),
            this.initializeSecurity(),
            this.initializeAutomation()
        ]);
    }

    // Dashboard Module
    async initializeDashboard() {
        await this.updateResourceMetrics();
        this.initializeCharts();
        this.updateHealthStatus();
        this.loadRecentActivity();
    }

    initializeCharts() {
        // Resource Distribution Chart
        const resourceCtx = document.getElementById('resourceDistributionChart').getContext('2d');
        this.charts.set('resourceDistribution', new Chart(resourceCtx, {
            type: 'doughnut',
            data: this.getResourceDistributionData(),
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }));

        // Cost Trend Chart
        const costCtx = document.getElementById('costTrendChart').getContext('2d');
        this.charts.set('costTrend', new Chart(costCtx, {
            type: 'line',
            data: this.getCostTrendData(),
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }));
    }

    // Resource Management
    async updateResourceMetrics() {
        try {
            const metrics = await this.fetchResourceMetrics();
            this.state.metrics = new Map(Object.entries(metrics));
            this.updateResourceOverview();
        } catch (error) {
            this.showNotification('Error updating resource metrics', 'error');
        }
    }

    async fetchResourceMetrics() {
        // Simulated API call to fetch resource metrics
        return {
            vm: { total: 42, active: 38, stopped: 4 },
            db: { total: 12, active: 11, stopped: 1 },
            storage: { total: 8, active: 8, stopped: 0 },
            network: { total: 15, active: 15, stopped: 0 }
        };
    }

    // Cost Management
    async updateCostMetrics() {
        try {
            const costs = await this.fetchCostData();
            this.state.costs = new Map(Object.entries(costs));
            this.updateCostSummary();
            this.checkCostAlerts();
        } catch (error) {
            this.showNotification('Error updating cost metrics', 'error');
        }
    }

    async fetchCostData() {
        // Simulated API call to fetch cost data
        return {
            current: 12450,
            previous: 11475,
            projected: 15000,
            breakdown: {
                compute: 5500,
                storage: 2800,
                network: 2150,
                other: 2000
            }
        };
    }

    // Security Management
    async updateSecurityStatus() {
        try {
            const securityData = await this.performSecurityScan();
            this.state.security = securityData;
            this.updateSecurityScore();
            this.updateComplianceStatus();
        } catch (error) {
            this.showNotification('Error updating security status', 'error');
        }
    }

    async performSecurityScan() {
        // Simulated security scan
        return {
            score: 85,
            findings: [
                { severity: 'high', count: 2, items: [] },
                { severity: 'medium', count: 5, items: [] },
                { severity: 'low', count: 8, items: [] }
            ],
            compliance: new Map([
                ['GDPR', { status: 'compliant', lastCheck: new Date() }],
                ['HIPAA', { status: 'partial', lastCheck: new Date() }],
                ['SOC2', { status: 'compliant', lastCheck: new Date() }]
            ])
        };
    }

    // Automation Management
    async manageAutomation() {
        try {
            await this.updateAutomationRules();
            await this.processScheduledTasks();
        } catch (error) {
            this.showNotification('Error managing automation', 'error');
        }
    }

    async updateAutomationRules() {
        const rules = await this.fetchAutomationRules();
        this.state.automation.rules = new Map(Object.entries(rules));
        this.renderAutomationRules();
    }

    // Resource Operations
    async createResource(resourceData) {
        try {
            const newResource = await this.provisionResource(resourceData);
            this.state.resources.set(newResource.id, newResource);
            this.updateResourceMetrics();
            this.showNotification('Resource created successfully', 'success');
        } catch (error) {
            this.showNotification('Error creating resource', 'error');
        }
    }

    async deleteResource(resourceId) {
        try {
            await this.deprovisionResource(resourceId);
            this.state.resources.delete(resourceId);
            this.updateResourceMetrics();
            this.showNotification('Resource deleted successfully', 'success');
        } catch (error) {
            this.showNotification('Error deleting resource', 'error');
        }
    }

    // UI Updates
    updateResourceOverview() {
        const overview = document.querySelector('.resource-overview');
        if (!overview) return;

        const metrics = this.state.metrics;
        overview.querySelector('.metric-value[data-type="vm"]').textContent = metrics.get('vm').total;
        overview.querySelector('.metric-value[data-type="db"]').textContent = metrics.get('db').total;
        overview.querySelector('.metric-value[data-type="storage"]').textContent = metrics.get('storage').total;
        overview.querySelector('.metric-value[data-type="network"]').textContent = metrics.get('network').total;
    }

    updateCostSummary() {
        const summary = document.querySelector('.cost-summary');
        if (!summary) return;

        const costs = this.state.costs;
        summary.querySelector('.metric-value').textContent = `$${costs.get('current').toLocaleString()}`;
        const change = ((costs.get('current') - costs.get('previous')) / costs.get('previous')) * 100;
        summary.querySelector('.metric-trend').textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    }

    // Event Handlers
    setupEventListeners() {
        // Module navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => this.switchModule(button.dataset.module));
        });

        // Resource management
        document.getElementById('newResourceBtn')?.addEventListener('click', () => this.showNewResourceModal());
        document.getElementById('newResourceForm')?.addEventListener('submit', (e) => this.handleNewResourceSubmit(e));

        // Cost management
        document.getElementById('exportCostsBtn')?.addEventListener('click', () => this.exportCostReport());
        document.getElementById('budgetBtn')?.addEventListener('click', () => this.showBudgetModal());

        // Security management
        document.getElementById('scanBtn')?.addEventListener('click', () => this.performSecurityScan());

        // Automation management
        document.getElementById('newAutomationBtn')?.addEventListener('click', () => this.showNewAutomationModal());
    }

    // Utility Functions
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    startRefreshTimer() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(() => this.refreshData(), this.state.settings.refreshInterval);
    }

    async refreshData() {
        await Promise.all([
            this.updateResourceMetrics(),
            this.updateCostMetrics(),
            this.updateSecurityStatus(),
            this.manageAutomation()
        ]);
    }
}

// Initialize Cloud Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const cloudManager = new CloudManager();
    cloudManager.initialize().catch(error => {
        console.error('Failed to initialize Cloud Manager:', error);
    });
}); 