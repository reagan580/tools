// State Management
class PDFToolsState {
    constructor() {
        this.currentDocument = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.zoom = 1;
        this.rotation = 0;
        this.selectedTool = 'select';
        this.annotations = new Map();
        this.comments = new Map();
        this.signatures = [];
        this.undoStack = [];
        this.redoStack = [];
        this.searchResults = [];
        this.currentSearchIndex = -1;
        this.isModified = false;
        this.settings = {
            renderQuality: 2,
            enableAnnotations: true,
            autoSave: true,
            pageLayout: 'single',
            scrollMode: 'vertical'
        };
    }
}

// Main PDF Tools Class
class PDFTools {
    constructor() {
        this.state = new PDFToolsState();
        this.pdfDocument = null;
        this.pdfViewer = null;
        this.currentCanvas = null;
        this.annotationLayer = null;
    }

    // Initialization
    async initialize() {
        try {
            await this.initializePDFJS();
            this.setupViewer();
            this.setupEventListeners();
            this.setupTools();
            this.loadSettings();
        } catch (error) {
            this.showNotification('Error initializing PDF Tools', 'error');
            console.error('Initialization error:', error);
        }
    }

    // PDF.js Setup
    async initializePDFJS() {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '../../lib/pdf.js/pdf.worker.js';
        
        this.pdfViewer = new pdfjsViewer.PDFViewer({
            container: document.getElementById('viewerContainer'),
            viewer: document.getElementById('viewer'),
            renderingQueue: new pdfjsViewer.PDFRenderingQueue(),
            linkService: new pdfjsViewer.PDFLinkService()
        });

        this.pdfViewer.setDocument(null);
    }

    // Document Loading
    async loadDocument(source) {
        try {
            const loadingTask = pdfjsLib.getDocument(source);
            this.pdfDocument = await loadingTask.promise;
            
            this.state.totalPages = this.pdfDocument.numPages;
            this.state.currentPage = 1;
            
            await this.setupDocument();
            this.updateUI();
            this.showNotification('Document loaded successfully', 'success');
        } catch (error) {
            this.showNotification('Error loading document', 'error');
            throw error;
        }
    }

    async setupDocument() {
        this.pdfViewer.setDocument(this.pdfDocument);
        await this.loadDocumentMetadata();
        await this.loadDocumentOutline();
        await this.generateThumbnails();
        this.setupAnnotations();
    }

    // Document Navigation
    async goToPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.state.totalPages) return;

        this.state.currentPage = pageNumber;
        this.pdfViewer.currentPageNumber = pageNumber;
        this.updatePageNavigation();
        await this.renderCurrentPage();
    }

    async renderCurrentPage() {
        try {
            const page = await this.pdfDocument.getPage(this.state.currentPage);
            const viewport = page.getViewport({ scale: this.state.zoom, rotation: this.state.rotation });
            
            this.currentCanvas = document.createElement('canvas');
            const context = this.currentCanvas.getContext('2d');
            
            this.currentCanvas.width = viewport.width * this.state.settings.renderQuality;
            this.currentCanvas.height = viewport.height * this.state.settings.renderQuality;
            
            await page.render({
                canvasContext: context,
                viewport: viewport,
                transform: [this.state.settings.renderQuality, 0, 0, this.state.settings.renderQuality, 0, 0]
            }).promise;

            this.renderAnnotations();
        } catch (error) {
            this.showNotification('Error rendering page', 'error');
        }
    }

    // Zoom Control
    setZoom(level) {
        if (level === 'auto') {
            this.fitToWidth();
            return;
        }

        this.state.zoom = parseFloat(level);
        this.pdfViewer.currentScale = this.state.zoom;
        this.updateZoomControls();
    }

    fitToWidth() {
        const viewerWidth = document.getElementById('viewerContainer').clientWidth;
        const page = this.pdfViewer.getPageView(this.state.currentPage - 1);
        if (page) {
            this.state.zoom = viewerWidth / page.width;
            this.pdfViewer.currentScale = this.state.zoom;
            this.updateZoomControls();
        }
    }

    // Annotation Tools
    setupTools() {
        this.tools = {
            select: new SelectTool(this),
            hand: new HandTool(this),
            text: new TextTool(this),
            draw: new DrawTool(this),
            shapes: new ShapesTool(this),
            highlight: new HighlightTool(this),
            stamp: new StampTool(this),
            signature: new SignatureTool(this),
            comment: new CommentTool(this),
            link: new LinkTool(this)
        };
    }

    setTool(toolName) {
        if (!this.tools[toolName]) return;
        
        this.state.selectedTool = toolName;
        this.deactivateAllTools();
        this.tools[toolName].activate();
        this.updateToolbar();
    }

    deactivateAllTools() {
        Object.values(this.tools).forEach(tool => tool.deactivate());
    }

    // Annotation Management
    addAnnotation(annotation) {
        const pageAnnotations = this.state.annotations.get(this.state.currentPage) || [];
        pageAnnotations.push(annotation);
        this.state.annotations.set(this.state.currentPage, pageAnnotations);
        
        this.state.isModified = true;
        this.state.undoStack.push({
            type: 'add-annotation',
            page: this.state.currentPage,
            annotation: annotation
        });
        
        this.renderAnnotations();
        this.updateUI();
    }

    removeAnnotation(annotationId) {
        const pageAnnotations = this.state.annotations.get(this.state.currentPage) || [];
        const index = pageAnnotations.findIndex(a => a.id === annotationId);
        
        if (index !== -1) {
            const removed = pageAnnotations.splice(index, 1)[0];
            this.state.annotations.set(this.state.currentPage, pageAnnotations);
            
            this.state.isModified = true;
            this.state.undoStack.push({
                type: 'remove-annotation',
                page: this.state.currentPage,
                annotation: removed,
                index: index
            });
            
            this.renderAnnotations();
            this.updateUI();
        }
    }

    // Comment Management
    addComment(comment) {
        const pageComments = this.state.comments.get(this.state.currentPage) || [];
        pageComments.push(comment);
        this.state.comments.set(this.state.currentPage, pageComments);
        
        this.updateCommentsPanel();
        this.state.isModified = true;
    }

    // Search Functionality
    async searchDocument(query, options = {}) {
        this.state.searchResults = [];
        this.state.currentSearchIndex = -1;

        for (let pageNum = 1; pageNum <= this.state.totalPages; pageNum++) {
            const page = await this.pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            const matches = this.findTextMatches(textContent, query, options);
            matches.forEach(match => {
                this.state.searchResults.push({
                    pageNum,
                    match
                });
            });
        }

        this.updateSearchResults();
    }

    // File Operations
    async saveDocument() {
        try {
            const modifiedPdf = await this.generateModifiedPDF();
            await this.downloadPDF(modifiedPdf);
            
            this.state.isModified = false;
            this.showNotification('Document saved successfully', 'success');
        } catch (error) {
            this.showNotification('Error saving document', 'error');
        }
    }

    async exportDocument(format) {
        try {
            switch (format) {
                case 'pdf':
                    await this.saveDocument();
                    break;
                case 'images':
                    await this.exportAsImages();
                    break;
                case 'text':
                    await this.exportAsText();
                    break;
            }
        } catch (error) {
            this.showNotification(`Error exporting document as ${format}`, 'error');
        }
    }

    // Event Handlers
    setupEventListeners() {
        // Navigation controls
        document.getElementById('prevPageBtn').addEventListener('click', () => {
            this.goToPage(this.state.currentPage - 1);
        });

        document.getElementById('nextPageBtn').addEventListener('click', () => {
            this.goToPage(this.state.currentPage + 1);
        });

        document.getElementById('currentPage').addEventListener('change', (e) => {
            this.goToPage(parseInt(e.target.value));
        });

        // Zoom controls
        document.getElementById('zoomLevel').addEventListener('change', (e) => {
            this.setZoom(e.target.value);
        });

        // Tool selection
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', () => {
                this.setTool(button.dataset.tool);
            });
        });

        // File operations
        document.getElementById('openFileBtn').addEventListener('click', () => {
            this.showOpenFileDialog();
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveDocument();
        });
    }

    // UI Updates
    updateUI() {
        this.updatePageNavigation();
        this.updateToolbar();
        this.updateSidebars();
        this.updateModifiedStatus();
    }

    updatePageNavigation() {
        document.getElementById('currentPage').value = this.state.currentPage;
        document.getElementById('totalPages').textContent = this.state.totalPages;
        
        document.getElementById('prevPageBtn').disabled = this.state.currentPage <= 1;
        document.getElementById('nextPageBtn').disabled = this.state.currentPage >= this.state.totalPages;
    }

    // Utility Functions
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Initialize PDF Tools when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const pdfTools = new PDFTools();
    pdfTools.initialize().catch(error => {
        console.error('Failed to initialize PDF Tools:', error);
    });
}); 