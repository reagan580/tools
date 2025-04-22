class CodeEditor {
    constructor() {
        this.state = {
            editor: null,
            currentFile: null,
            openFiles: new Map(), // Map of file paths to their content
            fileTree: new Map(), // Map of directory paths to their contents
            terminal: null,
            debugSession: null,
            breakpoints: new Set(),
            diagnostics: new Map(), // Map of file paths to their problems
            searchResults: [],
            sourceControl: {
                changes: [],
                staged: []
            }
        };

        this.config = {
            theme: 'vs-dark',
            fontSize: 14,
            tabSize: 4,
            autoSave: true,
            formatOnSave: true,
            minimap: true,
            wordWrap: 'on',
            lineNumbers: true
        };
    }

    // Initialize the editor
    async initialize() {
        await this.initializeMonaco();
        this.initializeTerminal();
        this.initializeFileExplorer();
        this.initializeDebugger();
        this.setupEventListeners();
        this.loadConfiguration();
    }

    // Initialize Monaco Editor
    async initializeMonaco() {
        // Load Monaco Editor
        await import('../../lib/monaco-editor/monaco.js');

        // Create editor instance
        this.state.editor = monaco.editor.create(document.getElementById('editor'), {
            theme: this.config.theme,
            fontSize: this.config.fontSize,
            tabSize: this.config.tabSize,
            minimap: { enabled: this.config.minimap },
            wordWrap: this.config.wordWrap,
            lineNumbers: this.config.lineNumbers,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            contextmenu: true,
            quickSuggestions: true,
            snippetSuggestions: 'inline',
            suggestOnTriggerCharacters: true,
            folding: true,
            dragAndDrop: true,
            links: true,
            formatOnPaste: true,
            formatOnType: true
        });

        // Set up language services
        this.setupLanguageServices();
    }

    // Set up language services for different file types
    setupLanguageServices() {
        // JavaScript/TypeScript configuration
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false
        });

        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            noEmit: true,
            esModuleInterop: true,
            jsx: monaco.languages.typescript.JsxEmit.React,
            allowJs: true,
            typeRoots: ["node_modules/@types"]
        });

        // Add more language configurations as needed
    }

    // Initialize terminal
    initializeTerminal() {
        // Using xterm.js for terminal emulation
        this.state.terminal = new Terminal({
            cursorBlink: true,
            fontSize: this.config.fontSize,
            theme: {
                background: '#1e1e1e',
                foreground: '#ffffff'
            }
        });

        this.state.terminal.open(document.getElementById('terminal'));
        this.setupTerminalConnection();
    }

    // Set up WebSocket connection for terminal
    setupTerminalConnection() {
        const ws = new WebSocket('ws://localhost:3000/terminal');

        ws.onopen = () => {
            this.state.terminal.write('\x1B[1;3;32mTerminal Connected\x1B[0m\r\n');
        };

        ws.onmessage = (event) => {
            this.state.terminal.write(event.data);
        };

        this.state.terminal.onData(data => {
            ws.send(data);
        });
    }

    // Initialize file explorer
    initializeFileExplorer() {
        this.loadFileTree();
        this.renderFileTree();
    }

    // Load file tree from workspace
    async loadFileTree(path = '.') {
        try {
            const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
            const files = await response.json();
            this.state.fileTree.set(path, files);
            this.renderFileTree();
        } catch (error) {
            this.showNotification('Error loading file tree', 'error');
        }
    }

    // Render file tree in sidebar
    renderFileTree() {
        const fileTree = document.querySelector('.file-tree');
        fileTree.innerHTML = '';

        const createTreeItem = (item) => {
            const element = document.createElement('div');
            element.className = `tree-item ${item.type}`;
            element.innerHTML = `
                <span class="icon">${item.type === 'directory' ? '📁' : '📄'}</span>
                <span class="name">${item.name}</span>
            `;

            if (item.type === 'directory') {
                element.addEventListener('click', () => this.loadFileTree(item.path));
            } else {
                element.addEventListener('click', () => this.openFile(item.path));
            }

            return element;
        };

        const root = this.state.fileTree.get('.');
        if (root) {
            root.forEach(item => {
                fileTree.appendChild(createTreeItem(item));
            });
        }
    }

    // Open file in editor
    async openFile(path) {
        try {
            if (!this.state.openFiles.has(path)) {
                const response = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`);
                const content = await response.text();
                this.state.openFiles.set(path, content);
            }

            this.state.currentFile = path;
            const model = monaco.editor.createModel(
                this.state.openFiles.get(path),
                this.getLanguageFromPath(path),
                monaco.Uri.file(path)
            );

            this.state.editor.setModel(model);
            this.updateTabs();
            this.updateOutline();
        } catch (error) {
            this.showNotification('Error opening file', 'error');
        }
    }

    // Save current file
    async saveFile() {
        if (!this.state.currentFile) return;

        try {
            const content = this.state.editor.getValue();
            await fetch(`/api/files/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: this.state.currentFile,
                    content
                })
            });

            this.state.openFiles.set(this.state.currentFile, content);
            this.showNotification('File saved successfully');

            if (this.config.formatOnSave) {
                this.formatDocument();
            }
        } catch (error) {
            this.showNotification('Error saving file', 'error');
        }
    }

    // Initialize debugger
    initializeDebugger() {
        this.state.debugSession = {
            active: false,
            breakpoints: new Map(),
            callStack: [],
            variables: new Map(),
            watches: new Set()
        };

        this.setupDebuggerUI();
    }

    // Set up debugger UI and controls
    setupDebuggerUI() {
        const debugControls = document.querySelector('.debug-controls');
        debugControls.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-action');
            if (action) {
                this.handleDebugAction(action);
            }
        });

        this.state.editor.onMouseDown((e) => {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
                this.toggleBreakpoint(e.target.position.lineNumber);
            }
        });
    }

    // Handle debug actions (continue, step, etc.)
    handleDebugAction(action) {
        switch (action) {
            case 'start':
                this.startDebugging();
                break;
            case 'stop':
                this.stopDebugging();
                break;
            case 'continue':
                this.continueDebugging();
                break;
            case 'stepOver':
                this.stepOver();
                break;
            case 'stepInto':
                this.stepInto();
                break;
            case 'stepOut':
                this.stepOut();
                break;
        }
    }

    // Toggle breakpoint at line
    toggleBreakpoint(lineNumber) {
        const currentFile = this.state.currentFile;
        if (!currentFile) return;

        const breakpoints = this.state.debugSession.breakpoints;
        const fileBreakpoints = breakpoints.get(currentFile) || new Set();

        if (fileBreakpoints.has(lineNumber)) {
            fileBreakpoints.delete(lineNumber);
        } else {
            fileBreakpoints.add(lineNumber);
        }

        breakpoints.set(currentFile, fileBreakpoints);
        this.updateBreakpointDecorations();
    }

    // Update breakpoint decorations in editor
    updateBreakpointDecorations() {
        const model = this.state.editor.getModel();
        if (!model) return;

        const fileBreakpoints = this.state.debugSession.breakpoints.get(this.state.currentFile) || new Set();
        const decorations = Array.from(fileBreakpoints).map(line => ({
            range: new monaco.Range(line, 1, line, 1),
            options: {
                isWholeLine: true,
                glyphMarginClassName: 'breakpoint-glyph'
            }
        }));

        this.state.editor.deltaDecorations([], decorations);
    }

    // Set up event listeners
    setupEventListeners() {
        // File operations
        document.getElementById('newFileBtn').addEventListener('click', () => this.createNewFile());
        document.getElementById('openFileBtn').addEventListener('click', () => this.showOpenDialog());
        document.getElementById('saveFileBtn').addEventListener('click', () => this.saveFile());

        // Editor changes
        this.state.editor.onDidChangeModelContent(() => {
            if (this.config.autoSave) {
                this.saveFile();
            }
        });

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());

        // Search
        const searchInput = document.querySelector('.search-input');
        searchInput.addEventListener('input', debounce(() => this.performSearch(searchInput.value), 300));
    }

    // Perform search in files
    async performSearch(query) {
        if (!query) {
            this.state.searchResults = [];
            this.renderSearchResults();
            return;
        }

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            this.state.searchResults = await response.json();
            this.renderSearchResults();
        } catch (error) {
            this.showNotification('Error performing search', 'error');
        }
    }

    // Render search results
    renderSearchResults() {
        const resultsContainer = document.querySelector('.search-results');
        resultsContainer.innerHTML = '';

        this.state.searchResults.forEach(result => {
            const element = document.createElement('div');
            element.className = 'search-result';
            element.innerHTML = `
                <div class="result-file">${result.file}</div>
                <div class="result-line">${result.line}</div>
                <div class="result-preview">${this.highlightMatch(result.preview, result.match)}</div>
            `;
            element.addEventListener('click', () => this.openSearchResult(result));
            resultsContainer.appendChild(element);
        });
    }

    // Utility functions
    getLanguageFromPath(path) {
        const extension = path.split('.').pop();
        const languageMap = {
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'md': 'markdown',
            'py': 'python',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c'
        };
        return languageMap[extension] || 'plaintext';
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    // Format current document
    async formatDocument() {
        const model = this.state.editor.getModel();
        if (!model) return;

        try {
            const formatted = await monaco.editor.getModelFormatter().formatDocument(model);
            this.state.editor.executeEdits('format', formatted);
        } catch (error) {
            this.showNotification('Error formatting document', 'error');
        }
    }

    // Load editor configuration
    loadConfiguration() {
        const savedConfig = localStorage.getItem('editorConfig');
        if (savedConfig) {
            this.config = { ...this.config, ...JSON.parse(savedConfig) };
        }
        this.applyConfiguration();
    }

    // Apply configuration changes
    applyConfiguration() {
        this.state.editor.updateOptions({
            theme: this.config.theme,
            fontSize: this.config.fontSize,
            tabSize: this.config.tabSize,
            minimap: { enabled: this.config.minimap },
            wordWrap: this.config.wordWrap,
            lineNumbers: this.config.lineNumbers
        });

        localStorage.setItem('editorConfig', JSON.stringify(this.config));
    }
}

// Initialize editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const editor = new CodeEditor();
    editor.initialize().catch(console.error);
});

// Utility function for debouncing
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