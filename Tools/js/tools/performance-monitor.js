// State Management
const state = {
    applications: [],
    metrics: {},
    alerts: [],
    alertRules: [],
    currentApp: null,
    timeRange: '24h',
    customRange: null,
    refreshInterval: 30000,
    chartInstances: {},
    filters: {
        search: '',
        environment: ''
    },
    settings: {
        autoRefresh: true,
        dataRetention: '30d',
        alertNotifications: true,
        theme: 'light'
    }
};

class PerformanceMonitor {
    constructor() {
        this.initializeApp();
        this.setupEventListeners();
        this.startMonitoring();
    }

    async initializeApp() {
        try {
            await this.loadSettings();
            await this.loadApplications();
            await this.loadAlertRules();
            this.initializeCharts();
            this.startDataCollection();
            this.renderDashboard();
        } catch (error) {
            this.showNotification('Error initializing app: ' + error.message, 'error');
        }
    }

    // Metric Collection and Processing
    async startDataCollection() {
        if (state.settings.autoRefresh) {
            this.dataCollectionInterval = setInterval(() => {
                this.collectMetrics();
            }, state.refreshInterval);
        }
    }

    async collectMetrics() {
        try {
            const currentApp = state.currentApp;
            if (!currentApp) return;

            const metrics = await this.fetchMetrics(currentApp.id, state.timeRange);
            this.processMetrics(metrics);
            this.updateDashboard();
            this.checkAlertRules();
        } catch (error) {
            console.error('Error collecting metrics:', error);
        }
    }

    async fetchMetrics(appId, timeRange) {
        // This would typically make API calls to your monitoring backend
        try {
            const endpoints = {
                performance: `/api/metrics/${appId}/performance?range=${timeRange}`,
                resources: `/api/metrics/${appId}/resources?range=${timeRange}`,
                errors: `/api/metrics/${appId}/errors?range=${timeRange}`
            };

            const [performance, resources, errors] = await Promise.all([
                this.fetchData(endpoints.performance),
                this.fetchData(endpoints.resources),
                this.fetchData(endpoints.errors)
            ]);

            return {
                performance,
                resources,
                errors,
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error('Failed to fetch metrics: ' + error.message);
        }
    }

    processMetrics(rawMetrics) {
        const processed = {
            responseTime: this.calculateAverages(rawMetrics.performance.responseTime),
            errorRate: this.calculateErrorRate(rawMetrics.errors),
            throughput: this.calculateThroughput(rawMetrics.performance.requests),
            resources: this.processResourceMetrics(rawMetrics.resources)
        };

        state.metrics[state.currentApp.id] = processed;
        return processed;
    }

    // Chart Management
    initializeCharts() {
        this.initializeOverviewCharts();
        this.initializePerformanceGraph();
        this.initializeResourceCharts();
    }

    initializeOverviewCharts() {
        const charts = ['responseTime', 'errorRate', 'throughput', 'cpuUsage'];
        
        charts.forEach(metric => {
            const ctx = document.getElementById(`${metric}Chart`).getContext('2d');
            state.chartInstances[metric] = new Chart(ctx, this.getChartConfig(metric));
        });
    }

    getChartConfig(metric) {
        const baseConfig = {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'hour'
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        };

        // Customize config based on metric type
        switch (metric) {
            case 'responseTime':
                baseConfig.options.scales.y.title = {
                    display: true,
                    text: 'Response Time (ms)'
                };
                break;
            case 'errorRate':
                baseConfig.options.scales.y.title = {
                    display: true,
                    text: 'Error Rate (%)'
                };
                break;
            case 'throughput':
                baseConfig.options.scales.y.title = {
                    display: true,
                    text: 'Requests/sec'
                };
                break;
            case 'cpuUsage':
                baseConfig.options.scales.y.title = {
                    display: true,
                    text: 'CPU Usage (%)'
                };
                break;
        }

        return baseConfig;
    }

    updateCharts(metrics) {
        Object.keys(state.chartInstances).forEach(chartKey => {
            const chart = state.chartInstances[chartKey];
            const data = this.getChartData(chartKey, metrics);
            
            chart.data = data;
            chart.update('none'); // Update without animation for performance
        });
    }

    // Alert Management
    async createAlertRule(ruleData) {
        try {
            const rule = new AlertRule({
                id: this.generateId(),
                metric: ruleData.metric,
                condition: ruleData.condition,
                threshold: ruleData.threshold,
                duration: ruleData.duration,
                severity: ruleData.severity,
                enabled: true,
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            state.alertRules.push(rule);
            await this.saveAlertRules();
            this.renderAlertRules();
            this.showNotification('Alert rule created successfully', 'success');
            return rule;
        } catch (error) {
            this.showNotification('Error creating alert rule', 'error');
            throw error;
        }
    }

    checkAlertRules() {
        const currentMetrics = state.metrics[state.currentApp.id];
        if (!currentMetrics) return;

        state.alertRules.forEach(rule => {
            if (!rule.enabled) return;

            const value = this.getMetricValue(currentMetrics, rule.metric);
            const triggered = this.evaluateAlertCondition(value, rule);

            if (triggered) {
                this.triggerAlert(rule, value);
            }
        });
    }

    evaluateAlertCondition(value, rule) {
        switch (rule.condition) {
            case 'greater_than':
                return value > rule.threshold;
            case 'less_than':
                return value < rule.threshold;
            case 'equals':
                return value === rule.threshold;
            default:
                return false;
        }
    }

    async triggerAlert(rule, value) {
        try {
            const alert = new Alert({
                id: this.generateId(),
                ruleId: rule.id,
                metric: rule.metric,
                value: value,
                threshold: rule.threshold,
                severity: rule.severity,
                timestamp: new Date(),
                status: 'active'
            });

            state.alerts.push(alert);
            await this.saveAlerts();
            this.renderAlerts();
            this.notifyAlert(alert);
        } catch (error) {
            console.error('Error triggering alert:', error);
        }
    }

    // UI Rendering
    renderDashboard() {
        this.renderMetricCards();
        this.renderPerformanceGraph();
        this.renderResourceUsage();
        this.renderDetailedMetrics();
        this.renderAlerts();
    }

    updateDashboard() {
        const metrics = state.metrics[state.currentApp.id];
        if (!metrics) return;

        this.updateMetricCards(metrics);
        this.updateCharts(metrics);
        this.updateResourceUsage(metrics.resources);
    }

    renderMetricCards() {
        const metrics = state.metrics[state.currentApp.id];
        if (!metrics) return;

        this.updateMetricValue('responseTime', metrics.responseTime.current);
        this.updateMetricValue('errorRate', metrics.errorRate.current);
        this.updateMetricValue('throughput', metrics.throughput.current);
        this.updateMetricValue('cpuUsage', metrics.resources.cpu.current);
    }

    // Utility Functions
    calculateAverages(data) {
        const values = Object.values(data);
        return {
            current: values[values.length - 1],
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values)
        };
    }

    calculateErrorRate(errors) {
        const total = errors.success + errors.failure;
        return total === 0 ? 0 : (errors.failure / total) * 100;
    }

    calculateThroughput(requests) {
        const timeframe = 60; // 1 minute
        return requests.length / timeframe;
    }

    // Data Classes
    class AlertRule {
        constructor(data) {
            Object.assign(this, {
                id: null,
                metric: '',
                condition: '',
                threshold: 0,
                duration: 0,
                severity: 'warning',
                enabled: true,
                createdAt: null,
                createdBy: null
            }, data);
        }
    }

    class Alert {
        constructor(data) {
            Object.assign(this, {
                id: null,
                ruleId: null,
                metric: '',
                value: 0,
                threshold: 0,
                severity: 'warning',
                timestamp: null,
                status: 'active',
                acknowledgedAt: null,
                acknowledgedBy: null
            }, data);
        }
    }
}

// Initialize application
const performanceMonitor = new PerformanceMonitor(); 