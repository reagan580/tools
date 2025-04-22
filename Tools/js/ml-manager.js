// State Management
const state = {
    projects: [],
    datasets: [],
    models: [],
    experiments: [],
    deployments: [],
    currentProject: null,
    currentDataset: null,
    currentModel: null,
    currentExperiment: null,
    tfModels: new Map(),
    charts: new Map(),
    filters: {
        projects: { search: '', type: '' },
        datasets: { search: '', type: '' },
        models: { search: '', type: '' },
        experiments: { search: '', status: '' }
    },
    settings: {
        autoSave: true,
        gpuAcceleration: true,
        batchSize: 32,
        epochs: 10,
        validationSplit: 0.2
    }
};

class MLManager {
    constructor() {
        this.initializeApp();
        this.setupEventListeners();
        this.initializeTensorFlow();
    }

    async initializeApp() {
        try {
            await this.loadSettings();
            await this.loadProjects();
            await this.loadDatasets();
            await this.loadModels();
            await this.loadExperiments();
            await this.loadDeployments();
            this.initializeCharts();
            this.renderCurrentModule();
        } catch (error) {
            this.showNotification('Error initializing app: ' + error.message, 'error');
        }
    }

    // Project Management
    async createProject(projectData) {
        try {
            const project = new MLProject({
                id: this.generateId(),
                name: projectData.name,
                description: projectData.description,
                type: projectData.type,
                status: 'active',
                metrics: {},
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            state.projects.push(project);
            state.currentProject = project;
            await this.saveProjects();
            this.renderProjects();
            this.showNotification('Project created successfully', 'success');
            return project;
        } catch (error) {
            this.showNotification('Error creating project', 'error');
            throw error;
        }
    }

    // Dataset Management
    async importDataset(file, options) {
        try {
            const dataset = new Dataset({
                id: this.generateId(),
                name: file.name,
                type: this.detectDatasetType(file),
                size: file.size,
                format: file.type,
                projectId: state.currentProject.id,
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            const data = await this.processDataset(file, options);
            dataset.metadata = this.analyzeDataset(data);
            dataset.statistics = this.calculateStatistics(data);

            state.datasets.push(dataset);
            await this.saveDatasets();
            this.renderDatasets();
            this.showNotification('Dataset imported successfully', 'success');
            return dataset;
        } catch (error) {
            this.showNotification('Error importing dataset', 'error');
            throw error;
        }
    }

    async processDataset(file, options) {
        const data = await this.readFile(file);
        const processed = await this.preprocessData(data, options);
        return processed;
    }

    analyzeDataset(data) {
        return {
            columns: this.analyzeColumns(data),
            rowCount: data.length,
            missingValues: this.detectMissingValues(data),
            correlations: this.calculateCorrelations(data)
        };
    }

    // Model Management
    async createModel(modelData) {
        try {
            const model = new Model({
                id: this.generateId(),
                name: modelData.name,
                type: modelData.type,
                architecture: modelData.architecture,
                hyperparameters: modelData.hyperparameters,
                projectId: state.currentProject.id,
                status: 'created',
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            const tfModel = await this.buildTFModel(model.architecture);
            state.tfModels.set(model.id, tfModel);

            state.models.push(model);
            await this.saveModels();
            this.renderModels();
            this.showNotification('Model created successfully', 'success');
            return model;
        } catch (error) {
            this.showNotification('Error creating model', 'error');
            throw error;
        }
    }

    async trainModel(modelId, datasetId, options) {
        try {
            const model = this.getModelById(modelId);
            const dataset = this.getDatasetById(datasetId);
            const tfModel = state.tfModels.get(modelId);

            const experiment = await this.createExperiment(model, dataset, options);
            const { trainData, validationData } = await this.prepareTrainingData(dataset);

            const trainingHistory = await tfModel.fit(trainData.x, trainData.y, {
                epochs: options.epochs || state.settings.epochs,
                batchSize: options.batchSize || state.settings.batchSize,
                validationSplit: options.validationSplit || state.settings.validationSplit,
                callbacks: this.createTrainingCallbacks(experiment)
            });

            await this.updateExperiment(experiment.id, {
                status: 'completed',
                metrics: trainingHistory.history,
                completedAt: new Date()
            });

            this.updateModelMetrics(model, trainingHistory);
            this.renderExperiments();
            this.showNotification('Model training completed', 'success');
            return experiment;
        } catch (error) {
            this.showNotification('Error training model', 'error');
            throw error;
        }
    }

    createTrainingCallbacks(experiment) {
        return {
            onEpochEnd: async (epoch, logs) => {
                await this.updateExperimentProgress(experiment.id, epoch, logs);
                this.updateTrainingCharts(logs);
            },
            onBatchEnd: async (batch, logs) => {
                this.updateProgressBar(batch, logs);
            }
        };
    }

    // Experiment Management
    async createExperiment(model, dataset, options) {
        try {
            const experiment = new Experiment({
                id: this.generateId(),
                name: `${model.name}_${new Date().toISOString()}`,
                modelId: model.id,
                datasetId: dataset.id,
                projectId: state.currentProject.id,
                parameters: options,
                status: 'running',
                metrics: {},
                startedAt: new Date(),
                startedBy: this.getCurrentUser().id
            });

            state.experiments.push(experiment);
            await this.saveExperiments();
            this.renderExperiments();
            return experiment;
        } catch (error) {
            this.showNotification('Error creating experiment', 'error');
            throw error;
        }
    }

    // Deployment Management
    async deployModel(modelId, deploymentConfig) {
        try {
            const model = this.getModelById(modelId);
            const tfModel = state.tfModels.get(modelId);

            const deployment = new Deployment({
                id: this.generateId(),
                modelId: modelId,
                version: this.generateVersion(model),
                config: deploymentConfig,
                status: 'deploying',
                metrics: {},
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            await this.saveModelArtifacts(tfModel, deployment);
            deployment.status = 'active';
            
            state.deployments.push(deployment);
            await this.saveDeployments();
            this.renderDeployments();
            this.showNotification('Model deployed successfully', 'success');
            return deployment;
        } catch (error) {
            this.showNotification('Error deploying model', 'error');
            throw error;
        }
    }

    async monitorDeployment(deploymentId) {
        try {
            const deployment = this.getDeploymentById(deploymentId);
            const metrics = await this.collectDeploymentMetrics(deployment);
            
            deployment.metrics = metrics;
            this.updateDeploymentCharts(deployment);
            await this.saveDeployments();
        } catch (error) {
            console.error('Error monitoring deployment:', error);
        }
    }

    // TensorFlow Integration
    async initializeTensorFlow() {
        try {
            await tf.ready();
            if (tf.gpu.isAvailable() && state.settings.gpuAcceleration) {
                await tf.setBackend('webgl');
            }
        } catch (error) {
            console.error('Error initializing TensorFlow:', error);
        }
    }

    async buildTFModel(architecture) {
        const model = tf.sequential();
        
        architecture.layers.forEach(layer => {
            model.add(tf.layers[layer.type](layer.config));
        });

        model.compile({
            optimizer: architecture.optimizer,
            loss: architecture.loss,
            metrics: architecture.metrics
        });

        return model;
    }

    // Data Classes
    class MLProject {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                description: '',
                type: '',
                status: 'active',
                metrics: {},
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null
            }, data);
        }
    }

    class Dataset {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                type: '',
                size: 0,
                format: '',
                metadata: {},
                statistics: {},
                projectId: null,
                createdAt: null,
                createdBy: null
            }, data);
        }
    }

    class Model {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                type: '',
                architecture: {},
                hyperparameters: {},
                metrics: {},
                projectId: null,
                status: 'created',
                createdAt: null,
                createdBy: null
            }, data);
        }
    }

    class Experiment {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                modelId: null,
                datasetId: null,
                projectId: null,
                parameters: {},
                status: 'running',
                metrics: {},
                startedAt: null,
                startedBy: null,
                completedAt: null
            }, data);
        }
    }

    class Deployment {
        constructor(data) {
            Object.assign(this, {
                id: null,
                modelId: null,
                version: '',
                config: {},
                status: 'deploying',
                metrics: {},
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null
            }, data);
        }
    }
}

// Initialize application
const mlManager = new MLManager(); 