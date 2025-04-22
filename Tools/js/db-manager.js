class DatabaseManager {
    constructor() {
        this.state = {
            connections: new Map(),
            activeConnection: null,
            queryTabs: [],
            activeTab: null,
            queryHistory: [],
            savedQueries: new Map(),
            queryResults: new Map(),
            selectedObject: null,
            editors: new Map(),
            settings: {
                maxRowsDisplay: 1000,
                queryTimeout: 30000,
                autoComplete: true,
                formatOnSave: true,
                defaultDatabase: 'mysql'
            }
        };

        this.supportedDatabases = {
            mysql: {
                defaultPort: 3306,
                driver: 'mysql2'
            },
            postgresql: {
                defaultPort: 5432,
                driver: 'pg'
            },
            sqlite: {
                defaultPort: null,
                driver: 'sqlite3'
            },
            mssql: {
                defaultPort: 1433,
                driver: 'mssql'
            }
        };
    }

    // Initialize the database manager
    async initialize() {
        await this.initializeEditors();
        this.loadSavedConnections();
        this.setupEventListeners();
        this.initializeAutoComplete();
    }

    // Initialize Monaco editors
    async initializeEditors() {
        // Register SQL language
        monaco.languages.register({ id: 'sql' });
        
        // Configure SQL language features
        monaco.languages.setMonarchTokensProvider('sql', this.getSQLTokenProvider());
        monaco.languages.setLanguageConfiguration('sql', this.getSQLLanguageConfig());

        // Create main query editor
        this.state.editors.set('query', await this.createQueryEditor());
    }

    // Create query editor instance
    async createQueryEditor() {
        const editor = monaco.editor.create(document.getElementById('queryEditor'), {
            value: '',
            language: 'sql',
            theme: 'vs-dark',
            minimap: { enabled: false },
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            rulers: [80],
            suggestOnTriggerCharacters: true
        });

        // Add custom SQL completions
        this.setupSQLCompletions(editor);

        return editor;
    }

    // Database connection management
    async createConnection(config) {
        try {
            const connection = {
                id: Date.now().toString(),
                config: { ...config },
                status: 'connecting',
                client: null
            };

            // Create database client based on type
            const client = await this.createDatabaseClient(config);
            connection.client = client;
            connection.status = 'connected';

            this.state.connections.set(connection.id, connection);
            this.saveConnections();
            this.updateConnectionsUI();

            return connection;
        } catch (error) {
            console.error('Error creating connection:', error);
            this.showNotification('Error creating connection: ' + error.message, 'error');
            throw error;
        }
    }

    // Create database client based on type
    async createDatabaseClient(config) {
        const dbConfig = this.supportedDatabases[config.type];
        if (!dbConfig) {
            throw new Error(`Unsupported database type: ${config.type}`);
        }

        // Dynamic import of database driver
        const driver = await import(dbConfig.driver);
        
        switch (config.type) {
            case 'mysql':
                return await this.createMySQLConnection(config, driver);
            case 'postgresql':
                return await this.createPostgresConnection(config, driver);
            case 'sqlite':
                return await this.createSQLiteConnection(config, driver);
            case 'mssql':
                return await this.createMSSQLConnection(config, driver);
            default:
                throw new Error(`Unsupported database type: ${config.type}`);
        }
    }

    // Execute query
    async executeQuery(query, options = {}) {
        if (!this.state.activeConnection) {
            throw new Error('No active connection');
        }

        const startTime = performance.now();
        try {
            // Parse query to handle multiple statements
            const statements = this.parseQueryStatements(query);
            const results = [];

            for (const statement of statements) {
                const result = await this.executeSingleQuery(statement, options);
                results.push(result);
            }

            const executionTime = performance.now() - startTime;
            
            // Store results
            const resultId = Date.now().toString();
            this.state.queryResults.set(resultId, {
                results,
                executionTime,
                query,
                timestamp: new Date()
            });

            // Add to history
            this.addToHistory(query, results, executionTime);

            // Update UI
            this.updateResultsUI(resultId);

            return results;
        } catch (error) {
            this.handleQueryError(error);
            throw error;
        }
    }

    // Execute single query
    async executeSingleQuery(query, options) {
        const connection = this.state.activeConnection;
        const client = connection.client;

        // Set query timeout
        const timeout = options.timeout || this.state.settings.queryTimeout;
        
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Query timeout'));
            }, timeout);

            client.query(query, (err, result) => {
                clearTimeout(timeoutId);
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    // Parse query into statements
    parseQueryStatements(query) {
        // Simple split by semicolon - can be enhanced for more complex scenarios
        return query
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
    }

    // Explain query plan
    async explainQuery(query) {
        const connection = this.state.activeConnection;
        if (!connection) return;

        const explainQuery = this.getExplainQuery(query, connection.config.type);
        const result = await this.executeSingleQuery(explainQuery);
        
        this.updateExplainUI(result);
        return result;
    }

    // Get explain query based on database type
    getExplainQuery(query, dbType) {
        switch (dbType) {
            case 'mysql':
                return `EXPLAIN FORMAT=JSON ${query}`;
            case 'postgresql':
                return `EXPLAIN (FORMAT JSON) ${query}`;
            case 'sqlite':
                return `EXPLAIN QUERY PLAN ${query}`;
            case 'mssql':
                return `SET SHOWPLAN_XML ON; ${query}; SET SHOWPLAN_XML OFF;`;
            default:
                throw new Error(`Explain not supported for database type: ${dbType}`);
        }
    }

    // Format SQL query
    formatQuery() {
        const editor = this.state.editors.get('query');
        const query = editor.getValue();
        
        try {
            const formatted = sqlFormatter.format(query, {
                language: this.state.activeConnection?.config.type || 'sql',
                indent: '    '
            });
            
            editor.setValue(formatted);
        } catch (error) {
            this.showNotification('Error formatting query: ' + error.message, 'error');
        }
    }

    // Database object exploration
    async loadDatabaseObjects() {
        if (!this.state.activeConnection) return;

        try {
            const objects = await this.getDatabaseObjects();
            this.updateExplorerTree(objects);
        } catch (error) {
            console.error('Error loading database objects:', error);
            this.showNotification('Error loading database objects', 'error');
        }
    }

    // Get database objects based on type
    async getDatabaseObjects() {
        const connection = this.state.activeConnection;
        const type = connection.config.type;

        switch (type) {
            case 'mysql':
                return this.getMySQLObjects();
            case 'postgresql':
                return this.getPostgresObjects();
            case 'sqlite':
                return this.getSQLiteObjects();
            case 'mssql':
                return this.getMSSQLObjects();
            default:
                throw new Error(`Unsupported database type: ${type}`);
        }
    }

    // Import/Export functionality
    async importData(file, options) {
        try {
            const content = await this.readFileContent(file);
            const format = this.getFileFormat(file);
            
            switch (format) {
                case 'sql':
                    await this.importSQL(content);
                    break;
                case 'csv':
                    await this.importCSV(content, options);
                    break;
                case 'json':
                    await this.importJSON(content, options);
                    break;
                default:
                    throw new Error(`Unsupported import format: ${format}`);
            }

            this.showNotification('Import completed successfully');
        } catch (error) {
            console.error('Error importing data:', error);
            this.showNotification('Error importing data: ' + error.message, 'error');
        }
    }

    async exportData(format, options) {
        try {
            let data;
            switch (format) {
                case 'sql':
                    data = await this.exportSQL(options);
                    break;
                case 'csv':
                    data = await this.exportCSV(options);
                    break;
                case 'json':
                    data = await this.exportJSON(options);
                    break;
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            this.downloadData(data, format);
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Error exporting data: ' + error.message, 'error');
        }
    }

    // UI updates
    updateResultsUI(resultId) {
        const result = this.state.queryResults.get(resultId);
        if (!result) return;

        const container = document.querySelector('.results-grid');
        container.innerHTML = '';

        result.results.forEach((queryResult, index) => {
            const resultView = this.createResultView(queryResult);
            container.appendChild(resultView);
        });

        // Update metadata
        document.querySelector('.row-count').textContent = 
            `${this.getTotalRowCount(result.results)} rows`;
        document.querySelector('.execution-time').textContent = 
            `${result.executionTime.toFixed(2)} ms`;
    }

    updateExplorerTree(objects) {
        const container = document.querySelector('.explorer-tree');
        container.innerHTML = '';

        const createTreeItem = (item) => {
            const element = document.createElement('div');
            element.className = 'tree-item';
            element.innerHTML = `
                <div class="item-header">
                    <span class="item-icon">${this.getObjectIcon(item.type)}</span>
                    <span class="item-name">${item.name}</span>
                </div>
            `;

            if (item.children) {
                const children = document.createElement('div');
                children.className = 'item-children';
                item.children.forEach(child => {
                    children.appendChild(createTreeItem(child));
                });
                element.appendChild(children);
            }

            element.addEventListener('click', () => this.selectDatabaseObject(item));
            return element;
        };

        objects.forEach(object => {
            container.appendChild(createTreeItem(object));
        });
    }

    // Utility functions
    getObjectIcon(type) {
        const icons = {
            database: '🗄️',
            table: '📋',
            view: '👁️',
            procedure: '⚙️',
            function: '🔧',
            trigger: '⚡',
            index: '📇'
        };
        return icons[type] || '📄';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    // Event listeners
    setupEventListeners() {
        // Execute query button
        document.getElementById('executeQueryBtn').addEventListener('click', () => {
            const editor = this.state.editors.get('query');
            const query = editor.getValue();
            this.executeQuery(query);
        });

        // Format query button
        document.getElementById('formatQueryBtn').addEventListener('click', () => {
            this.formatQuery();
        });

        // Explain query button
        document.getElementById('explainQueryBtn').addEventListener('click', () => {
            const editor = this.state.editors.get('query');
            const query = editor.getValue();
            this.explainQuery(query);
        });

        // New connection button
        document.getElementById('newConnectionBtn').addEventListener('click', () => {
            this.showConnectionModal();
        });

        // Import/Export buttons
        document.getElementById('importBtn').addEventListener('click', () => {
            this.showImportModal();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.showExportModal();
        });
    }
}

// Initialize database manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const dbManager = new DatabaseManager();
    dbManager.initialize().catch(console.error);
}); 