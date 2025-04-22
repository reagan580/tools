// State Management
const state = {
    reviews: [],
    currentReview: null,
    users: [],
    labels: [],
    comments: [],
    diffViewMode: 'split',
    filters: {
        search: '',
        author: '',
        status: '',
        labels: []
    },
    settings: {
        theme: 'light',
        notifications: true,
        diffContextLines: 5,
        autoRefresh: true
    }
};

class CodeReviewTool {
    constructor() {
        this.initializeApp();
        this.setupEventListeners();
        this.loadData();
    }

    async initializeApp() {
        try {
            await this.loadSettings();
            await this.loadReviews();
            await this.loadUsers();
            await this.loadLabels();
            this.initializeMarkdown();
            this.initializeSyntaxHighlighting();
            this.initializeDiffViewer();
            this.renderReviews();
        } catch (error) {
            this.showNotification('Error initializing app: ' + error.message, 'error');
        }
    }

    // Review Management
    async loadReviews() {
        try {
            const reviews = await this.fetchFromStorage('reviews') || [];
            state.reviews = reviews.map(review => new Review(review));
            this.renderReviews();
        } catch (error) {
            this.showNotification('Error loading reviews', 'error');
        }
    }

    async createReview(reviewData) {
        try {
            const review = new Review({
                id: this.generateId(),
                title: reviewData.title,
                description: reviewData.description,
                baseBranch: reviewData.baseBranch,
                compareBranch: reviewData.compareBranch,
                author: this.getCurrentUser().id,
                reviewers: reviewData.reviewers,
                labels: reviewData.labels,
                status: 'open',
                createdAt: new Date(),
                files: await this.generateDiff(reviewData.baseBranch, reviewData.compareBranch)
            });

            state.reviews.push(review);
            await this.saveReviews();
            this.renderReviews();
            this.showNotification('Review created successfully', 'success');
            return review;
        } catch (error) {
            this.showNotification('Error creating review', 'error');
            throw error;
        }
    }

    async updateReview(reviewId, updates) {
        try {
            const review = this.getReviewById(reviewId);
            if (!review) throw new Error('Review not found');

            Object.assign(review, updates);
            review.updatedAt = new Date();

            await this.saveReviews();
            this.renderReview(review);
            this.showNotification('Review updated successfully', 'success');
        } catch (error) {
            this.showNotification('Error updating review', 'error');
            throw error;
        }
    }

    // Comment Management
    async addComment(reviewId, fileId, lineNumber, content) {
        try {
            const comment = new Comment({
                id: this.generateId(),
                reviewId,
                fileId,
                lineNumber,
                content,
                author: this.getCurrentUser().id,
                createdAt: new Date()
            });

            const review = this.getReviewById(reviewId);
            review.comments.push(comment);
            await this.saveReviews();
            this.renderComments(reviewId);
            this.showNotification('Comment added successfully', 'success');
        } catch (error) {
            this.showNotification('Error adding comment', 'error');
            throw error;
        }
    }

    // Diff Generation and Management
    async generateDiff(baseBranch, compareBranch) {
        try {
            // This is a placeholder for actual diff generation logic
            // In a real implementation, this would interact with a version control system
            const files = await this.getChangedFiles(baseBranch, compareBranch);
            return files.map(file => ({
                id: this.generateId(),
                path: file.path,
                changeType: file.changeType,
                additions: file.additions,
                deletions: file.deletions,
                diff: file.diff
            }));
        } catch (error) {
            this.showNotification('Error generating diff', 'error');
            throw error;
        }
    }

    renderDiff(file, viewMode = state.diffViewMode) {
        const diffViewer = document.getElementById('diffViewer');
        const diff2html = new Diff2HtmlUI(diffViewer, file.diff, {
            drawFileList: false,
            matching: 'lines',
            outputFormat: viewMode,
            synchronisedScroll: true,
            highlight: true,
            renderNothingWhenEmpty: true
        });
        diff2html.draw();
        diff2html.highlightCode();
    }

    // UI Rendering
    renderReviews() {
        const reviewList = document.getElementById('reviewList');
        reviewList.innerHTML = '';

        const filteredReviews = this.filterReviews(state.reviews);
        const template = document.getElementById('reviewItemTemplate');

        filteredReviews.forEach(review => {
            const reviewElement = template.content.cloneNode(true);
            this.populateReviewElement(reviewElement, review);
            reviewList.appendChild(reviewElement);
        });
    }

    renderReview(review) {
        if (!review) return;

        document.getElementById('reviewTitle').textContent = review.title;
        document.getElementById('reviewStatus').value = review.status;
        
        this.renderDescription(review.description);
        this.renderFiles(review.files);
        this.renderComments(review.comments);
        this.renderReviewers(review.reviewers);
        this.renderLabels(review.labels);
        this.renderTimeline(review.timeline);
    }

    renderDescription(description) {
        const descriptionElement = document.getElementById('descriptionText');
        descriptionElement.innerHTML = marked(description);
    }

    renderFiles(files) {
        const fileList = document.getElementById('changedFiles');
        fileList.innerHTML = '';

        files.forEach(file => {
            const fileElement = this.createFileElement(file);
            fileList.appendChild(fileElement);
        });
    }

    // Event Handlers
    setupEventListeners() {
        // Review List Events
        document.getElementById('newReviewBtn').addEventListener('click', () => {
            this.showNewReviewModal();
        });

        document.getElementById('searchReviews').addEventListener('input', (e) => {
            state.filters.search = e.target.value;
            this.renderReviews();
        });

        // Review Status Events
        document.getElementById('reviewStatus').addEventListener('change', (e) => {
            if (state.currentReview) {
                this.updateReview(state.currentReview.id, { status: e.target.value });
            }
        });

        // Diff View Events
        document.querySelectorAll('.view-option').forEach(button => {
            button.addEventListener('click', (e) => {
                state.diffViewMode = e.target.dataset.view;
                this.updateDiffView();
            });
        });

        // Comment Events
        document.getElementById('newComment').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.submitComment();
            }
        });
    }

    // Utility Functions
    filterReviews(reviews) {
        return reviews.filter(review => {
            const matchesSearch = review.title.toLowerCase().includes(state.filters.search.toLowerCase()) ||
                                review.description.toLowerCase().includes(state.filters.search.toLowerCase());
            const matchesAuthor = !state.filters.author || review.author === state.filters.author;
            const matchesStatus = !state.filters.status || review.status === state.filters.status;
            const matchesLabels = state.filters.labels.length === 0 ||
                                state.filters.labels.every(label => review.labels.includes(label));
            
            return matchesSearch && matchesAuthor && matchesStatus && matchesLabels;
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async fetchFromStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error fetching from storage:', error);
            return null;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    // Data Classes
    class Review {
        constructor(data) {
            Object.assign(this, {
                id: null,
                title: '',
                description: '',
                baseBranch: '',
                compareBranch: '',
                author: null,
                reviewers: [],
                labels: [],
                status: 'open',
                files: [],
                comments: [],
                timeline: [],
                createdAt: null,
                updatedAt: null
            }, data);
        }

        addTimelineEvent(type, data) {
            this.timeline.push({
                type,
                data,
                timestamp: new Date(),
                user: this.getCurrentUser().id
            });
        }
    }

    class Comment {
        constructor(data) {
            Object.assign(this, {
                id: null,
                reviewId: null,
                fileId: null,
                lineNumber: null,
                content: '',
                author: null,
                createdAt: null,
                updatedAt: null,
                replies: []
            }, data);
        }
    }
}

// Initialize application
const codeReview = new CodeReviewTool(); 