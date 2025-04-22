// State Management
let state = {
    currentPage: {
        id: null,
        title: '',
        elements: [],
        settings: {
            url: '',
            status: 'draft',
            seo: {
                title: '',
                description: '',
                keywords: ''
            },
            customCode: {
                header: '',
                footer: ''
            }
        }
    },
    selectedElement: null,
    devicePreview: 'desktop',
    history: [],
    historyIndex: -1,
    isDragging: false,
    isEditing: false
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeBuilder();
    setupEventListeners();
    loadPageData();
});

// Website Builder Class
class WebsiteBuilder {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.elementsSidebar = document.querySelector('.elements-sidebar');
        this.propertiesSidebar = document.querySelector('.properties-sidebar');
        
        this.initializeDragAndDrop();
        this.initializeHistory();
    }

    initializeDragAndDrop() {
        // Make elements draggable
        this.elementsSidebar.querySelectorAll('.element').forEach(element => {
            element.addEventListener('dragstart', this.handleDragStart.bind(this));
            element.addEventListener('dragend', this.handleDragEnd.bind(this));
        });

        // Setup canvas drop zones
        this.canvas.addEventListener('dragover', this.handleDragOver.bind(this));
        this.canvas.addEventListener('drop', this.handleDrop.bind(this));
    }

    handleDragStart(e) {
        state.isDragging = true;
        e.dataTransfer.setData('text/plain', e.target.dataset.type);
        e.target.classList.add('dragging');
    }

    handleDragEnd(e) {
        state.isDragging = false;
        e.target.classList.remove('dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
        if (state.isDragging) {
            const dropZone = this.findDropZone(e.clientY);
            this.highlightDropZone(dropZone);
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const elementType = e.dataTransfer.getData('text/plain');
        const element = this.createElement(elementType);
        
        const dropZone = this.findDropZone(e.clientY);
        this.insertElement(element, dropZone);
        this.selectElement(element);
        this.saveState();
    }

    createElement(type) {
        const element = document.createElement('div');
        element.className = 'page-element';
        element.dataset.type = type;

        const config = this.getDefaultConfig(type);
        element.dataset.config = JSON.stringify(config);

        element.innerHTML = this.getElementTemplate(type, config);
        
        // Add event listeners
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectElement(element);
        });

        // Make element resizable if applicable
        if (['container', 'image', 'video'].includes(type)) {
            this.makeResizable(element);
        }

        return element;
    }

    getDefaultConfig(type) {
        const baseConfig = {
            id: this.generateId(),
            style: {
                margin: '0px',
                padding: '0px',
                width: 'auto',
                height: 'auto',
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#000000',
                backgroundColor: 'transparent',
                textAlign: 'left',
                display: 'block'
            },
            animation: 'none',
            classes: []
        };

        switch (type) {
            case 'heading':
                return {
                    ...baseConfig,
                    content: 'New Heading',
                    level: 'h2'
                };
            case 'text':
                return {
                    ...baseConfig,
                    content: 'Enter your text here'
                };
            case 'button':
                return {
                    ...baseConfig,
                    content: 'Click Me',
                    link: '#',
                    style: {
                        ...baseConfig.style,
                        backgroundColor: '#007bff',
                        color: '#ffffff',
                        padding: '10px 20px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer'
                    }
                };
            case 'image':
                return {
                    ...baseConfig,
                    src: '',
                    alt: '',
                    style: {
                        ...baseConfig.style,
                        maxWidth: '100%'
                    }
                };
            case 'container':
                return {
                    ...baseConfig,
                    style: {
                        ...baseConfig.style,
                        width: '100%',
                        minHeight: '100px',
                        border: '1px dashed #cccccc'
                    }
                };
            // Add more element types as needed
            default:
                return baseConfig;
        }
    }

    getElementTemplate(type, config) {
        switch (type) {
            case 'heading':
                return `<${config.level}>${config.content}</${config.level}>`;
            case 'text':
                return `<p>${config.content}</p>`;
            case 'button':
                return `<button>${config.content}</button>`;
            case 'image':
                return `<img src="${config.src}" alt="${config.alt}">`;
            case 'container':
                return '<div class="container-element"></div>';
            // Add more element templates
            default:
                return '';
        }
    }

    makeResizable(element) {
        const resizeHandles = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'];
        
        resizeHandles.forEach(direction => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${direction}`;
            element.appendChild(handle);

            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startResize(element, direction, e);
            });
        });
    }

    startResize(element, direction, startEvent) {
        const initialRect = element.getBoundingClientRect();
        const initialX = startEvent.clientX;
        const initialY = startEvent.clientY;

        const handleResize = (e) => {
            const deltaX = e.clientX - initialX;
            const deltaY = e.clientY - initialY;

            let newWidth = initialRect.width;
            let newHeight = initialRect.height;
            let newX = initialRect.left;
            let newY = initialRect.top;

            // Update dimensions based on direction
            if (direction.includes('e')) newWidth = initialRect.width + deltaX;
            if (direction.includes('w')) {
                newWidth = initialRect.width - deltaX;
                newX = initialRect.left + deltaX;
            }
            if (direction.includes('s')) newHeight = initialRect.height + deltaY;
            if (direction.includes('n')) {
                newHeight = initialRect.height - deltaY;
                newY = initialRect.top + deltaY;
            }

            // Apply new dimensions
            element.style.width = `${newWidth}px`;
            element.style.height = `${newHeight}px`;
            if (direction.includes('w')) element.style.left = `${newX}px`;
            if (direction.includes('n')) element.style.top = `${newY}px`;
        };

        const stopResize = () => {
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
            this.saveState();
        };

        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
    }

    selectElement(element) {
        if (state.selectedElement) {
            state.selectedElement.classList.remove('selected');
        }
        element.classList.add('selected');
        state.selectedElement = element;
        this.updateProperties(element);
    }

    updateProperties(element) {
        const config = JSON.parse(element.dataset.config);
        const type = element.dataset.type;

        // Update properties panel
        this.updateBasicProperties(config);
        this.updateStyleProperties(config.style);
        this.updateAdvancedProperties(config);

        // Show/hide type-specific properties
        this.updateTypeSpecificProperties(type, config);
    }

    updateBasicProperties(config) {
        const content = document.getElementById('elementContent');
        if (content) content.value = config.content || '';

        const link = document.getElementById('elementLink');
        if (link) link.value = config.link || '';
    }

    updateStyleProperties(style) {
        // Typography
        document.getElementById('fontFamily').value = style.fontFamily;
        document.getElementById('fontSize').value = parseInt(style.fontSize);
        
        // Colors
        document.getElementById('textColor').value = style.color;
        document.getElementById('backgroundColor').value = style.backgroundColor;

        // Spacing
        this.updateSpacingInputs(style);
    }

    updateSpacingInputs(style) {
        const spacingProperties = ['margin', 'padding'];
        const directions = ['top', 'right', 'bottom', 'left'];

        spacingProperties.forEach(property => {
            directions.forEach(direction => {
                const input = document.querySelector(`[data-spacing="${property}-${direction}"]`);
                if (input) {
                    input.value = parseInt(style[`${property}${direction.charAt(0).toUpperCase() + direction.slice(1)}`]) || 0;
                }
            });
        });
    }

    saveState() {
        // Save current state to history
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push(this.getPageState());
        state.historyIndex++;

        // Limit history size
        if (state.history.length > 50) {
            state.history.shift();
            state.historyIndex--;
        }

        this.savePage();
    }

    getPageState() {
        return {
            page: { ...state.currentPage },
            elements: Array.from(this.canvas.children).map(element => ({
                type: element.dataset.type,
                config: JSON.parse(element.dataset.config)
            }))
        };
    }

    savePage() {
        const pageData = {
            ...state.currentPage,
            elements: Array.from(this.canvas.children).map(element => ({
                type: element.dataset.type,
                config: JSON.parse(element.dataset.config)
            }))
        };

        localStorage.setItem('websiteBuilder_' + state.currentPage.id, JSON.stringify(pageData));
        showNotification('Page saved successfully');
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Event Listeners
function setupEventListeners() {
    // Device preview buttons
    document.querySelectorAll('.device-preview button').forEach(button => {
        button.addEventListener('click', () => {
            state.devicePreview = button.dataset.device;
            updateDevicePreview();
        });
    });

    // Toolbar buttons
    document.getElementById('undoButton').addEventListener('click', undo);
    document.getElementById('redoButton').addEventListener('click', redo);
    document.getElementById('previewButton').addEventListener('click', showPreview);
    document.getElementById('saveButton').addEventListener('click', savePage);
    document.getElementById('publishButton').addEventListener('click', showPublishModal);

    // Properties panel inputs
    setupPropertiesListeners();
}

function setupPropertiesListeners() {
    // Style properties
    document.querySelectorAll('.properties-container input, .properties-container select').forEach(input => {
        input.addEventListener('change', updateElementStyle);
    });

    // Spacing inputs
    document.querySelectorAll('[data-spacing]').forEach(input => {
        input.addEventListener('input', updateElementSpacing);
    });
}

// Utility Functions
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');

    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Initialize application
const websiteBuilder = new WebsiteBuilder(); 