// State Management
const state = {
    workflows: [],
    instances: [],
    templates: [],
    currentWorkflow: null,
    selectedNode: null,
    jsPlumbInstance: null,
    undoStack: [],
    redoStack: [],
    analytics: {
        executions: [],
        performance: {},
        statistics: {}
    },
    filters: {
        instances: { search: '', status: '' },
        templates: { search: '', category: '' }
    },
    settings: {
        autoSave: true,
        validateOnDeploy: true,
        maxInstances: 100,
        retryAttempts: 3
    }
};

class WorkflowAutomation {
    constructor() {
        this.initializeApp();
        this.setupEventListeners();
        this.initializeJsPlumb();
    }

    async initializeApp() {
        try {
            await this.loadSettings();
            await this.loadWorkflows();
            await this.loadTemplates();
            await this.loadInstances();
            this.initializeCanvas();
            this.renderCurrentModule();
        } catch (error) {
            this.showNotification('Error initializing app: ' + error.message, 'error');
        }
    }

    // Workflow Designer
    initializeJsPlumb() {
        state.jsPlumbInstance = jsPlumb.getInstance({
            Connector: ['Bezier', { curviness: 50 }],
            DragOptions: { cursor: 'pointer', zIndex: 2000 },
            PaintStyle: { stroke: '#456', strokeWidth: 2 },
            EndpointStyle: { radius: 6, fill: '#456' },
            HoverPaintStyle: { stroke: '#89a' },
            EndpointHoverStyle: { fill: '#89a' },
            Container: 'workflowCanvas'
        });

        this.setupJsPlumbDefaults();
    }

    setupJsPlumbDefaults() {
        state.jsPlumbInstance.registerConnectionTypes({
            'default': {
                anchors: ['Right', 'Left'],
                connector: ['Bezier', { curviness: 50 }]
            },
            'conditional': {
                anchors: ['Right', 'Left'],
                connector: ['Bezier', { curviness: 50 }],
                paintStyle: { stroke: '#f80', strokeWidth: 2 }
            }
        });
    }

    createWorkflow(workflowData) {
        try {
            const workflow = new Workflow({
                id: this.generateId(),
                name: workflowData.name,
                description: workflowData.description,
                nodes: [],
                connections: [],
                status: 'draft',
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            state.workflows.push(workflow);
            state.currentWorkflow = workflow;
            this.saveWorkflows();
            this.renderWorkflow(workflow);
            this.showNotification('Workflow created successfully', 'success');
            return workflow;
        } catch (error) {
            this.showNotification('Error creating workflow', 'error');
            throw error;
        }
    }

    addNode(nodeData) {
        try {
            const node = new WorkflowNode({
                id: this.generateId(),
                type: nodeData.type,
                label: nodeData.label,
                config: nodeData.config,
                position: nodeData.position
            });

            state.currentWorkflow.nodes.push(node);
            this.renderNode(node);
            this.addToUndoStack('addNode', { node });
            return node;
        } catch (error) {
            this.showNotification('Error adding node', 'error');
            throw error;
        }
    }

    connectNodes(sourceId, targetId, connectionType = 'default') {
        try {
            const connection = state.jsPlumbInstance.connect({
                source: sourceId,
                target: targetId,
                type: connectionType
            });

            state.currentWorkflow.connections.push({
                id: connection.id,
                sourceId,
                targetId,
                type: connectionType
            });

            this.addToUndoStack('connect', { connection });
            return connection;
        } catch (error) {
            this.showNotification('Error connecting nodes', 'error');
            throw error;
        }
    }

    // Workflow Execution
    async deployWorkflow(workflowId) {
        try {
            const workflow = this.getWorkflowById(workflowId);
            if (!workflow) throw new Error('Workflow not found');

            if (state.settings.validateOnDeploy) {
                const validationResult = this.validateWorkflow(workflow);
                if (!validationResult.isValid) {
                    throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
                }
            }

            workflow.status = 'deployed';
            workflow.deployedAt = new Date();
            workflow.deployedBy = this.getCurrentUser().id;

            await this.saveWorkflows();
            this.showNotification('Workflow deployed successfully', 'success');
        } catch (error) {
            this.showNotification('Error deploying workflow', 'error');
            throw error;
        }
    }

    async executeWorkflow(workflowId, input = {}) {
        try {
            const workflow = this.getWorkflowById(workflowId);
            if (!workflow) throw new Error('Workflow not found');

            const instance = new WorkflowInstance({
                id: this.generateId(),
                workflowId,
                input,
                status: 'running',
                startedAt: new Date(),
                startedBy: this.getCurrentUser().id
            });

            state.instances.push(instance);
            this.renderInstances();

            await this.executeWorkflowInstance(instance);
            return instance;
        } catch (error) {
            this.showNotification('Error executing workflow', 'error');
            throw error;
        }
    }

    async executeWorkflowInstance(instance) {
        try {
            const workflow = this.getWorkflowById(instance.workflowId);
            const executionContext = new ExecutionContext(workflow, instance);

            for (const node of workflow.nodes) {
                if (node.type.startsWith('trigger-')) continue;

                try {
                    await this.executeNode(node, executionContext);
                } catch (error) {
                    if (this.shouldRetryNode(node, error)) {
                        await this.retryNode(node, executionContext);
                    } else {
                        throw error;
                    }
                }
            }

            instance.status = 'completed';
            instance.completedAt = new Date();
            await this.saveInstances();
            this.updateAnalytics(instance);
        } catch (error) {
            instance.status = 'failed';
            instance.error = error.message;
            await this.saveInstances();
            throw error;
        }
    }

    async executeNode(node, context) {
        const nodeHandler = this.getNodeHandler(node.type);
        if (!nodeHandler) throw new Error(`No handler found for node type: ${node.type}`);

        context.currentNode = node;
        const result = await nodeHandler.execute(node.config, context);
        context.setNodeResult(node.id, result);

        this.updateInstanceStatus(context.instance, node, 'completed');
        return result;
    }

    // Template Management
    async createTemplate(templateData) {
        try {
            const template = new WorkflowTemplate({
                id: this.generateId(),
                name: templateData.name,
                description: templateData.description,
                category: templateData.category,
                workflow: templateData.workflow,
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            state.templates.push(template);
            await this.saveTemplates();
            this.renderTemplates();
            this.showNotification('Template created successfully', 'success');
            return template;
        } catch (error) {
            this.showNotification('Error creating template', 'error');
            throw error;
        }
    }

    // Analytics
    updateAnalytics(instance) {
        const analytics = state.analytics;
        analytics.executions.push({
            instanceId: instance.id,
            workflowId: instance.workflowId,
            duration: instance.completedAt - instance.startedAt,
            status: instance.status,
            timestamp: instance.completedAt
        });

        this.calculateStatistics();
        this.renderAnalytics();
    }

    calculateStatistics() {
        const executions = state.analytics.executions;
        const stats = {
            totalExecutions: executions.length,
            successRate: this.calculateSuccessRate(executions),
            averageDuration: this.calculateAverageDuration(executions),
            failureRate: this.calculateFailureRate(executions)
        };

        state.analytics.statistics = stats;
    }

    // UI Rendering
    renderWorkflow(workflow) {
        const canvas = document.getElementById('workflowCanvas');
        canvas.innerHTML = '';

        workflow.nodes.forEach(node => this.renderNode(node));
        workflow.connections.forEach(conn => this.renderConnection(conn));
    }

    renderNode(node) {
        const template = document.getElementById('workflowNodeTemplate');
        const nodeElement = template.content.cloneNode(true);
        
        nodeElement.querySelector('.node-title').textContent = node.label;
        nodeElement.querySelector('.node-icon').className = `node-icon ${node.type}`;

        const nodeContainer = document.createElement('div');
        nodeContainer.id = node.id;
        nodeContainer.className = 'workflow-node';
        nodeContainer.style.left = `${node.position.x}px`;
        nodeContainer.style.top = `${node.position.y}px`;
        nodeContainer.appendChild(nodeElement);

        state.jsPlumbInstance.draggable(nodeContainer, {
            grid: [10, 10]
        });

        this.makeNodeEndpoints(nodeContainer, node.type);
    }

    // Data Classes
    class Workflow {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                description: '',
                nodes: [],
                connections: [],
                status: 'draft',
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null,
                deployedAt: null,
                deployedBy: null
            }, data);
        }
    }

    class WorkflowNode {
        constructor(data) {
            Object.assign(this, {
                id: null,
                type: '',
                label: '',
                config: {},
                position: { x: 0, y: 0 }
            }, data);
        }
    }

    class WorkflowInstance {
        constructor(data) {
            Object.assign(this, {
                id: null,
                workflowId: null,
                input: {},
                status: 'pending',
                results: {},
                error: null,
                startedAt: null,
                startedBy: null,
                completedAt: null,
                logs: []
            }, data);
        }
    }

    class WorkflowTemplate {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                description: '',
                category: '',
                workflow: null,
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null
            }, data);
        }
    }
}

// Initialize application
const workflowAutomation = new WorkflowAutomation(); 