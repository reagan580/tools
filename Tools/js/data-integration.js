// State Management
const state = {
    pipelines: [],
    connections: [],
    transforms: [],
    currentPipeline: null,
    selectedNode: null,
    jsPlumbInstance: null,
    monacoEditor: null,
    monitoring: {
        metrics: {},
        logs: [],
        alerts: []
    },
    filters: {
        connections: { type: '', search: '' },
        transforms: { category: '', search: '' }
    },
    settings: {
        autoSave: true,
        previewLimit: 1000,
        batchSize: 5000,
        retryAttempts: 3
    }
};

class DataIntegration {
    constructor() {
        this.initializeApp();
        this.setupEventListeners();
        this.initializeJsPlumb();
        this.initializeMonacoEditor();
    }

    async initializeApp() {
        try {
            await this.loadSettings();
            await this.loadPipelines();
            await this.loadConnections();
            await this.loadTransforms();
            this.initializeCharts();
            this.renderCurrentModule();
        } catch (error) {
            this.showNotification('Error initializing app: ' + error.message, 'error');
        }
    }

    // Pipeline Management
    async createPipeline(pipelineData) {
        try {
            const pipeline = new Pipeline({
                id: this.generateId(),
                name: pipelineData.name,
                description: pipelineData.description,
                nodes: [],
                edges: [],
                schedule: pipelineData.schedule,
                status: 'draft',
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            state.pipelines.push(pipeline);
            state.currentPipeline = pipeline;
            await this.savePipelines();
            this.renderPipeline(pipeline);
            this.showNotification('Pipeline created successfully', 'success');
            return pipeline;
        } catch (error) {
            this.showNotification('Error creating pipeline', 'error');
            throw error;
        }
    }

    async executePipeline(pipelineId) {
        try {
            const pipeline = this.getPipelineById(pipelineId);
            if (!pipeline) throw new Error('Pipeline not found');

            const execution = new PipelineExecution({
                id: this.generateId(),
                pipelineId,
                status: 'running',
                startTime: new Date(),
                metrics: {
                    recordsProcessed: 0,
                    bytesProcessed: 0,
                    errors: 0
                }
            });

            await this.executePipelineNodes(pipeline, execution);
            return execution;
        } catch (error) {
            this.showNotification('Error executing pipeline', 'error');
            throw error;
        }
    }

    async executePipelineNodes(pipeline, execution) {
        const nodes = this.sortNodesTopologically(pipeline.nodes);
        const context = new ExecutionContext(execution);

        for (const node of nodes) {
            try {
                await this.executeNode(node, context);
            } catch (error) {
                if (this.shouldRetryNode(node, error)) {
                    await this.retryNode(node, context);
                } else {
                    throw error;
                }
            }
        }
    }

    // Connection Management
    async createConnection(connectionData) {
        try {
            const connection = new Connection({
                id: this.generateId(),
                name: connectionData.name,
                type: connectionData.type,
                config: connectionData.config,
                status: 'inactive',
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            // Test connection before saving
            await this.testConnection(connection);

            state.connections.push(connection);
            await this.saveConnections();
            this.renderConnections();
            this.showNotification('Connection created successfully', 'success');
            return connection;
        } catch (error) {
            this.showNotification('Error creating connection', 'error');
            throw error;
        }
    }

    async testConnection(connection) {
        try {
            const connector = this.getConnector(connection.type);
            await connector.test(connection.config);
            return true;
        } catch (error) {
            throw new Error(`Connection test failed: ${error.message}`);
        }
    }

    // Transform Management
    async createTransform(transformData) {
        try {
            const transform = new Transform({
                id: this.generateId(),
                name: transformData.name,
                description: transformData.description,
                type: transformData.type,
                code: transformData.code,
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            // Validate transform before saving
            await this.validateTransform(transform);

            state.transforms.push(transform);
            await this.saveTransforms();
            this.renderTransforms();
            this.showNotification('Transform created successfully', 'success');
            return transform;
        } catch (error) {
            this.showNotification('Error creating transform', 'error');
            throw error;
        }
    }

    async testTransform(transform, sampleData) {
        try {
            const executor = new TransformExecutor(transform);
            const result = await executor.execute(sampleData);
            this.renderTransformPreview(result);
            return result;
        } catch (error) {
            throw new Error(`Transform test failed: ${error.message}`);
        }
    }

    // Data Processing
    async processDataBatch(data, transform) {
        const batchSize = state.settings.batchSize;
        const batches = this.splitIntoBatches(data, batchSize);
        const results = [];

        for (const batch of batches) {
            try {
                const processedBatch = await this.processBatch(batch, transform);
                results.push(...processedBatch);
                this.updateProgress(results.length, data.length);
            } catch (error) {
                this.logError(error, batch);
                if (this.shouldStopProcessing(error)) {
                    throw error;
                }
            }
        }

        return results;
    }

    async processBatch(batch, transform) {
        const executor = new TransformExecutor(transform);
        return await executor.executeBatch(batch);
    }

    // Monitoring
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.updateMetrics();
            this.checkAlerts();
        }, 60000); // Update every minute
    }

    async updateMetrics() {
        try {
            const metrics = await this.collectMetrics();
            state.monitoring.metrics = metrics;
            this.updateCharts();
            this.checkThresholds(metrics);
        } catch (error) {
            console.error('Error updating metrics:', error);
        }
    }

    async collectMetrics() {
        const activePipelines = state.pipelines.filter(p => p.status === 'running');
        const metrics = {
            pipelineStatus: this.calculatePipelineStatus(),
            dataVolume: await this.calculateDataVolume(),
            processingTime: this.calculateProcessingTime(),
            errorRate: this.calculateErrorRate()
        };
        return metrics;
    }

    // UI Management
    initializeJsPlumb() {
        state.jsPlumbInstance = jsPlumb.getInstance({
            Connector: ['Bezier', { curviness: 50 }],
            DragOptions: { cursor: 'pointer', zIndex: 2000 },
            PaintStyle: { stroke: '#456', strokeWidth: 2 },
            EndpointStyle: { radius: 6, fill: '#456' },
            HoverPaintStyle: { stroke: '#89a' },
            EndpointHoverStyle: { fill: '#89a' },
            Container: 'pipelineCanvas'
        });

        this.setupJsPlumbDefaults();
    }

    initializeMonacoEditor() {
        state.monacoEditor = monaco.editor.create(
            document.getElementById('transformEditor'),
            {
                language: 'javascript',
                theme: 'vs-dark',
                automaticLayout: true
            }
        );
    }

    // Data Classes
    class Pipeline {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                description: '',
                nodes: [],
                edges: [],
                schedule: null,
                status: 'draft',
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null
            }, data);
        }
    }

    class Connection {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                type: '',
                config: {},
                status: 'inactive',
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null,
                lastTestedAt: null
            }, data);
        }
    }

    class Transform {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                description: '',
                type: '',
                code: '',
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null,
                lastTestedAt: null
            }, data);
        }
    }

    class PipelineExecution {
        constructor(data) {
            Object.assign(this, {
                id: null,
                pipelineId: null,
                status: 'pending',
                startTime: null,
                endTime: null,
                metrics: {
                    recordsProcessed: 0,
                    bytesProcessed: 0,
                    errors: 0
                },
                logs: []
            }, data);
        }
    }

    class ExecutionContext {
        constructor(execution) {
            this.execution = execution;
            this.data = new Map();
            this.metrics = {
                startTime: new Date(),
                recordsProcessed: 0,
                bytesProcessed: 0,
                errors: 0
            };
        }

        updateMetrics(metrics) {
            Object.assign(this.metrics, metrics);
            this.execution.metrics = this.metrics;
        }

        logError(error) {
            this.execution.logs.push({
                timestamp: new Date(),
                level: 'error',
                message: error.message,
                details: error.stack
            });
        }
    }
}

// Initialize application
const dataIntegration = new DataIntegration(); 