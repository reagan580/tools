// State Management
class FileManagerState {
    constructor() {
        this.currentPath = '/';
        this.selectedItems = new Set();
        this.clipboard = {
            items: [],
            operation: null // 'copy' or 'cut'
        };
        this.viewMode = 'grid';
        this.sortBy = 'name';
        this.sortOrder = 'asc';
        this.searchResults = null;
        this.fileSystem = new Map();
        this.favorites = new Set();
        this.tags = new Map();
        this.history = [];
        this.historyIndex = -1;
    }
}

// Main File Manager Class
class FileManager {
    constructor() {
        this.state = new FileManagerState();
        this.supportedPreviews = new Set(['image', 'text', 'pdf', 'audio', 'video']);
        this.uploading = false;
    }

    // Initialization
    async initialize() {
        try {
            await this.loadFileSystem();
            this.setupEventListeners();
            this.setupDragAndDrop();
            this.updateView();
            this.initializeHistory();
        } catch (error) {
            this.showNotification('Error initializing File Manager', 'error');
            console.error('Initialization error:', error);
        }
    }

    // File System Operations
    async loadFileSystem() {
        try {
            // Load file system structure
            const rootStructure = await this.fetchFileSystem();
            this.state.fileSystem = this.buildFileSystemMap(rootStructure);
            this.updateStorageUsage();
        } catch (error) {
            this.showNotification('Error loading file system', 'error');
            throw error;
        }
    }

    buildFileSystemMap(structure, parentPath = '/') {
        const map = new Map();
        structure.forEach(item => {
            const fullPath = this.joinPaths(parentPath, item.name);
            map.set(fullPath, {
                ...item,
                path: fullPath,
                parent: parentPath
            });
            if (item.type === 'directory' && item.children) {
                const childMap = this.buildFileSystemMap(item.children, fullPath);
                childMap.forEach((value, key) => map.set(key, value));
            }
        });
        return map;
    }

    // File Operations
    async createFolder(name, parentPath = this.state.currentPath) {
        try {
            const newPath = this.joinPaths(parentPath, name);
            if (this.state.fileSystem.has(newPath)) {
                throw new Error('Folder already exists');
            }

            const folder = {
                name,
                type: 'directory',
                path: newPath,
                parent: parentPath,
                created: new Date(),
                modified: new Date(),
                children: []
            };

            await this.persistFolder(folder);
            this.state.fileSystem.set(newPath, folder);
            this.updateView();
            this.showNotification('Folder created successfully', 'success');
        } catch (error) {
            this.showNotification('Error creating folder', 'error');
            throw error;
        }
    }

    async uploadFiles(files) {
        if (this.uploading) return;
        this.uploading = true;

        try {
            const uploads = Array.from(files).map(file => this.uploadFile(file));
            const results = await Promise.all(uploads);
            
            results.forEach(result => {
                if (result.success) {
                    this.state.fileSystem.set(result.path, result.fileInfo);
                }
            });

            this.updateView();
            this.showNotification('Files uploaded successfully', 'success');
        } catch (error) {
            this.showNotification('Error uploading files', 'error');
        } finally {
            this.uploading = false;
        }
    }

    async deleteItems(items) {
        try {
            const deletions = items.map(path => this.deleteItem(path));
            await Promise.all(deletions);
            
            items.forEach(path => {
                this.state.fileSystem.delete(path);
                this.state.selectedItems.delete(path);
            });

            this.updateView();
            this.showNotification('Items deleted successfully', 'success');
        } catch (error) {
            this.showNotification('Error deleting items', 'error');
        }
    }

    async moveItems(items, targetPath) {
        try {
            const moves = items.map(path => this.moveItem(path, targetPath));
            await Promise.all(moves);
            
            items.forEach(path => {
                const item = this.state.fileSystem.get(path);
                const newPath = this.joinPaths(targetPath, item.name);
                
                this.state.fileSystem.delete(path);
                item.path = newPath;
                item.parent = targetPath;
                this.state.fileSystem.set(newPath, item);
            });

            this.updateView();
            this.showNotification('Items moved successfully', 'success');
        } catch (error) {
            this.showNotification('Error moving items', 'error');
        }
    }

    // Search Operations
    async searchFiles(query, options = {}) {
        try {
            const results = await this.performSearch(query, options);
            this.state.searchResults = results;
            this.updateView();
        } catch (error) {
            this.showNotification('Error performing search', 'error');
        }
    }

    performSearch(query, options) {
        const results = [];
        this.state.fileSystem.forEach((item, path) => {
            if (this.matchesSearchCriteria(item, query, options)) {
                results.push(item);
            }
        });
        return results;
    }

    matchesSearchCriteria(item, query, options) {
        const matchesName = item.name.toLowerCase().includes(query.toLowerCase());
        if (!matchesName) return false;

        if (options.type && item.type !== options.type) return false;
        if (options.dateFrom && new Date(item.modified) < new Date(options.dateFrom)) return false;
        if (options.dateTo && new Date(item.modified) > new Date(options.dateTo)) return false;
        if (options.size) {
            const size = this.getFileSize(item);
            if (!this.matchesSizeFilter(size, options.size)) return false;
        }

        return true;
    }

    // UI Updates
    updateView() {
        this.updateBreadcrumb();
        this.updateFileList();
        this.updateFileDetails();
        this.updateActionButtons();
        this.updateStorageUsage();
    }

    updateFileList() {
        const container = document.querySelector('.file-view');
        const items = this.getCurrentItems();
        
        container.innerHTML = '';
        items.forEach(item => {
            const element = this.createFileElement(item);
            container.appendChild(element);
        });
    }

    createFileElement(item) {
        const template = document.getElementById('fileItemTemplate');
        const element = template.content.cloneNode(true);
        
        const fileItem = element.querySelector('.file-item');
        fileItem.dataset.path = item.path;
        fileItem.dataset.type = item.type;
        
        const icon = element.querySelector('.file-icon');
        icon.textContent = this.getFileIcon(item);
        
        const name = element.querySelector('.file-name');
        name.textContent = item.name;
        
        const meta = element.querySelector('.file-meta');
        meta.textContent = this.getFileMeta(item);
        
        if (this.state.selectedItems.has(item.path)) {
            fileItem.classList.add('selected');
        }
        
        return element;
    }

    // Event Handlers
    setupEventListeners() {
        // File selection
        document.querySelector('.file-view').addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (!fileItem) return;
            
            this.handleFileSelection(fileItem, e.ctrlKey, e.shiftKey);
        });

        // Double click handler
        document.querySelector('.file-view').addEventListener('dblclick', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (!fileItem) return;
            
            this.handleFileOpen(fileItem.dataset.path);
        });

        // Toolbar buttons
        document.getElementById('newFolderBtn').addEventListener('click', () => {
            this.showNewFolderModal();
        });

        document.getElementById('uploadBtn').addEventListener('click', () => {
            this.showUploadModal();
        });

        // View mode toggle
        document.getElementById('viewModeBtn').addEventListener('click', () => {
            this.toggleViewMode();
        });

        // Context menu
        document.addEventListener('contextmenu', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                e.preventDefault();
                this.showContextMenu(e, fileItem);
            }
        });
    }

    setupDragAndDrop() {
        const fileView = document.querySelector('.file-view');

        fileView.addEventListener('dragstart', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (!fileItem) return;

            e.dataTransfer.setData('text/plain', fileItem.dataset.path);
            e.dataTransfer.effectAllowed = 'move';
        });

        fileView.addEventListener('dragover', (e) => {
            e.preventDefault();
            const target = e.target.closest('.file-item');
            if (target && target.dataset.type === 'directory') {
                target.classList.add('drag-over');
            }
        });

        fileView.addEventListener('drop', (e) => {
            e.preventDefault();
            const target = e.target.closest('.file-item');
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });

            if (target && target.dataset.type === 'directory') {
                const sourcePath = e.dataTransfer.getData('text/plain');
                this.moveItems([sourcePath], target.dataset.path);
            }
        });
    }

    // Utility Functions
    joinPaths(...parts) {
        return parts.map(part => part.replace(/^\/+|\/+$/g, '')).join('/');
    }

    getFileIcon(item) {
        const icons = {
            directory: '📁',
            image: '🖼️',
            video: '🎥',
            audio: '🎵',
            pdf: '📄',
            text: '📝',
            default: '📄'
        };
        return icons[item.type] || icons.default;
    }

    getFileMeta(item) {
        const size = item.type === 'directory' ? '' : this.formatFileSize(item.size);
        const date = new Date(item.modified).toLocaleDateString();
        return `${size} ${date}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize File Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const fileManager = new FileManager();
    fileManager.initialize().catch(error => {
        console.error('Failed to initialize File Manager:', error);
    });
}); 