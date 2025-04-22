// State Management
class ImageEditorState {
    constructor() {
        this.currentImage = null;
        this.layers = [];
        this.selectedLayer = null;
        this.selectedTool = 'select';
        this.zoom = 1;
        this.history = [];
        this.historyIndex = -1;
        this.clipboard = null;
        this.adjustments = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            hue: 0
        };
        this.toolSettings = {
            brush: { size: 10, opacity: 1, hardness: 0.8 },
            eraser: { size: 20, hardness: 0.5 },
            text: { font: 'Arial', size: 24, color: '#000000' },
            shapes: { type: 'rectangle', fill: false, strokeWidth: 2 }
        };
    }
}

// Main Image Editor Class
class ImageEditor {
    constructor() {
        this.state = new ImageEditorState();
        this.mainCanvas = document.getElementById('mainCanvas');
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.ctx = this.mainCanvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
    }

    // Initialization
    async initialize() {
        try {
            this.setupCanvases();
            this.setupTools();
            this.setupEventListeners();
            this.setupLayerSystem();
            this.setupEffects();
            await this.loadDefaultImage();
        } catch (error) {
            this.showNotification('Error initializing Image Editor', 'error');
            console.error('Initialization error:', error);
        }
    }

    // Canvas Setup
    setupCanvases() {
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());
    }

    resizeCanvases() {
        const container = document.querySelector('.canvas-container');
        const { width, height } = container.getBoundingClientRect();
        
        this.mainCanvas.width = width;
        this.mainCanvas.height = height;
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
        
        this.render();
    }

    // Tool Management
    setupTools() {
        this.tools = {
            select: new SelectTool(this),
            move: new MoveTool(this),
            crop: new CropTool(this),
            brush: new BrushTool(this),
            eraser: new EraserTool(this),
            text: new TextTool(this),
            shapes: new ShapesTool(this),
            fill: new FillTool(this),
            gradient: new GradientTool(this),
            eyedropper: new EyedropperTool(this)
        };
    }

    setTool(toolName) {
        if (!this.tools[toolName]) return;
        
        this.state.selectedTool = toolName;
        this.deactivateAllTools();
        this.tools[toolName].activate();
        this.updateToolbar();
        this.updateProperties();
    }

    // Layer Management
    setupLayerSystem() {
        this.layerManager = new LayerManager(this);
    }

    createLayer() {
        const layer = {
            id: this.generateId(),
            name: `Layer ${this.state.layers.length + 1}`,
            canvas: document.createElement('canvas'),
            visible: true,
            opacity: 1,
            blendMode: 'normal'
        };

        layer.canvas.width = this.mainCanvas.width;
        layer.canvas.height = this.mainCanvas.height;

        this.state.layers.push(layer);
        this.state.selectedLayer = layer;
        this.updateLayersPanel();
        this.render();
    }

    deleteLayer(layerId) {
        const index = this.state.layers.findIndex(l => l.id === layerId);
        if (index === -1) return;

        this.state.layers.splice(index, 1);
        if (this.state.selectedLayer.id === layerId) {
            this.state.selectedLayer = this.state.layers[Math.max(0, index - 1)];
        }

        this.updateLayersPanel();
        this.render();
    }

    // Drawing Operations
    startDrawing(e) {
        this.isDrawing = true;
        [this.lastX, this.lastY] = this.getCanvasCoordinates(e);
        
        const tool = this.tools[this.state.selectedTool];
        if (tool && tool.onStart) {
            tool.onStart(this.lastX, this.lastY, e);
        }
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const [x, y] = this.getCanvasCoordinates(e);
        const tool = this.tools[this.state.selectedTool];
        
        if (tool && tool.onDraw) {
            tool.onDraw(this.lastX, this.lastY, x, y, e);
        }

        [this.lastX, this.lastY] = [x, y];
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        
        const tool = this.tools[this.state.selectedTool];
        if (tool && tool.onEnd) {
            tool.onEnd();
        }

        this.isDrawing = false;
        this.addToHistory();
    }

    // Image Adjustments
    applyAdjustments() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.mainCanvas.width;
        tempCanvas.height = this.mainCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.drawImage(this.mainCanvas, 0, 0);
        
        // Apply brightness
        if (this.state.adjustments.brightness !== 0) {
            this.applyBrightness(tempCtx, this.state.adjustments.brightness);
        }

        // Apply contrast
        if (this.state.adjustments.contrast !== 0) {
            this.applyContrast(tempCtx, this.state.adjustments.contrast);
        }

        // Apply saturation
        if (this.state.adjustments.saturation !== 0) {
            this.applySaturation(tempCtx, this.state.adjustments.saturation);
        }

        // Apply hue
        if (this.state.adjustments.hue !== 0) {
            this.applyHue(tempCtx, this.state.adjustments.hue);
        }

        this.ctx.drawImage(tempCanvas, 0, 0);
        this.addToHistory();
    }

    // Effects
    applyEffect(effectName, options = {}) {
        switch (effectName) {
            case 'blur':
                this.applyBlur(options.radius || 5);
                break;
            case 'sharpen':
                this.applySharpen();
                break;
            case 'noise':
                this.applyNoise(options.amount || 25);
                break;
            case 'pixelate':
                this.applyPixelate(options.size || 10);
                break;
            case 'grayscale':
                this.applyGrayscale();
                break;
            case 'sepia':
                this.applySepia();
                break;
            case 'invert':
                this.applyInvert();
                break;
            case 'vignette':
                this.applyVignette(options.amount || 0.5);
                break;
        }

        this.addToHistory();
    }

    // History Management
    addToHistory() {
        // Remove any future states if we're not at the end of the history
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        }

        // Create a snapshot of the current state
        const snapshot = this.createSnapshot();
        this.state.history.push(snapshot);
        this.state.historyIndex++;

        // Limit history size
        if (this.state.history.length > 50) {
            this.state.history.shift();
            this.state.historyIndex--;
        }

        this.updateHistoryPanel();
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.state.historyIndex <= 0) return;

        this.state.historyIndex--;
        this.restoreSnapshot(this.state.history[this.state.historyIndex]);
        this.updateHistoryPanel();
        this.updateUndoRedoButtons();
    }

    redo() {
        if (this.state.historyIndex >= this.state.history.length - 1) return;

        this.state.historyIndex++;
        this.restoreSnapshot(this.state.history[this.state.historyIndex]);
        this.updateHistoryPanel();
        this.updateUndoRedoButtons();
    }

    // File Operations
    async loadImage(source) {
        try {
            const image = await this.loadImageFromSource(source);
            this.resetState();
            this.createLayer();
            
            const ctx = this.state.selectedLayer.canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            
            this.render();
            this.addToHistory();
            this.showNotification('Image loaded successfully', 'success');
        } catch (error) {
            this.showNotification('Error loading image', 'error');
        }
    }

    async saveImage(format = 'png', quality = 0.9) {
        try {
            const dataUrl = this.mainCanvas.toDataURL(`image/${format}`, quality);
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `image.${format}`;
            link.click();
            
            this.showNotification('Image saved successfully', 'success');
        } catch (error) {
            this.showNotification('Error saving image', 'error');
        }
    }

    // Event Handlers
    setupEventListeners() {
        // Canvas events
        this.overlayCanvas.addEventListener('mousedown', e => this.startDrawing(e));
        this.overlayCanvas.addEventListener('mousemove', e => this.draw(e));
        this.overlayCanvas.addEventListener('mouseup', () => this.stopDrawing());
        this.overlayCanvas.addEventListener('mouseleave', () => this.stopDrawing());

        // Tool selection
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', () => {
                this.setTool(button.dataset.tool);
            });
        });

        // Adjustment controls
        document.querySelectorAll('.adjustment-controls input').forEach(input => {
            input.addEventListener('input', () => {
                this.state.adjustments[input.id.replace('Slider', '')] = parseFloat(input.value);
                this.applyAdjustments();
            });
        });

        // Effect buttons
        document.querySelectorAll('.effect-button').forEach(button => {
            button.addEventListener('click', () => {
                this.applyEffect(button.dataset.effect);
            });
        });
    }

    // Utility Functions
    getCanvasCoordinates(e) {
        const rect = this.overlayCanvas.getBoundingClientRect();
        return [
            (e.clientX - rect.left) / this.state.zoom,
            (e.clientY - rect.top) / this.state.zoom
        ];
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize Image Editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const imageEditor = new ImageEditor();
    imageEditor.initialize().catch(error => {
        console.error('Failed to initialize Image Editor:', error);
    });
}); 