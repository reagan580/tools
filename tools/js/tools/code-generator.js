class CodeGenerator {
    constructor() {
        // State management
        this.state = {
            templates: new Map(),
            currentTemplate: null,
            editor: null,
            previewEditor: null,
            variables: new Map(),
            isDirty: false,
            isGenerating: false
        };

        // Template engine configuration
        this.engineConfig = {
            delimiters: ['{{', '}}'],
            helpers: this.registerHelpers(),
            partials: new Map()
        };
    }

    async initialize() {
        try {
            // Initialize Monaco Editor
            this.state.editor = await this.initializeEditor('template-editor', 'javascript');
            this.state.previewEditor = await this.initializeEditor('preview-editor', 'javascript', true);
            
            // Load saved templates
            await this.loadSavedTemplates();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize template engine
            this.initializeTemplateEngine();

            this.log('info', 'Code Generator initialized successfully');
        } catch (error) {
            this.log('error', `Initialization failed: ${error.message}`);
            throw error;
        }
    }

    async initializeEditor(containerId, language, readOnly = false) {
        return monaco.editor.create(document.getElementById(containerId), {
            language,
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            readOnly,
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            roundedSelection: false,
            renderIndentGuides: true,
            formatOnPaste: true,
            formatOnType: true
        });
    }

    setupEventListeners() {
        // Template management buttons
        document.getElementById('newTemplateBtn').addEventListener('click', () => this.createNewTemplate());
        document.getElementById('saveTemplateBtn').addEventListener('click', () => this.saveCurrentTemplate());
        document.getElementById('generateCode