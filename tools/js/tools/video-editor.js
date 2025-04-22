// State Management
const state = {
    videoFile: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    selectedTool: null,
    timeline: {
        zoom: 50,
        snapToGrid: true,
        tracks: {
            video: [],
            audio: [],
            text: [],
            effects: []
        }
    },
    clipboard: null,
    history: [],
    historyIndex: -1,
    settings: {
        previewQuality: 'full',
        snapThreshold: 5,
        maxHistoryStates: 50,
        autoSaveInterval: 300000 // 5 minutes
    }
};

class VideoEditor {
    constructor() {
        this.initializeEditor();
        this.setupEventListeners();
        this.initializeFFmpeg();
        this.setupTimeline();
    }

    async initializeEditor() {
        this.videoPlayer = document.getElementById('previewPlayer');
        this.effectsCanvas = document.getElementById('effectsCanvas');
        this.ctx = this.effectsCanvas.getContext('2d');
        this.timelineContainer = document.querySelector('.tracks-container');
        
        // Initialize video player
        this.videoPlayer.addEventListener('loadedmetadata', () => this.handleVideoLoad());
        this.videoPlayer.addEventListener('timeupdate', () => this.handleTimeUpdate());
        this.videoPlayer.addEventListener('ended', () => this.handleVideoEnd());
    }

    async initializeFFmpeg() {
        try {
            this.ffmpeg = createFFmpeg({ log: true });
            await this.ffmpeg.load();
            console.log('FFmpeg loaded');
        } catch (error) {
            this.showNotification('Error initializing FFmpeg: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        // File Operations
        document.getElementById('importVideo').addEventListener('click', () => this.importVideo());
        document.getElementById('importAudio').addEventListener('click', () => this.importAudio());
        document.getElementById('exportVideo').addEventListener('click', () => this.showExportModal());

        // Playback Controls
        document.getElementById('playPause').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('jumpBack').addEventListener('click', () => this.jumpTime(-5));
        document.getElementById('jumpForward').addEventListener('click', () => this.jumpTime(5));

        // Tool Selection
        this.setupToolListeners();

        // Timeline Controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomTimeline(5));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomTimeline(-5));
        document.getElementById('snapToGrid').addEventListener('click', () => this.toggleSnapToGrid());

        // Preview Quality
        document.getElementById('previewQuality').addEventListener('change', (e) => {
            state.settings.previewQuality = e.target.value;
            this.updatePreviewQuality();
        });
    }

    setupToolListeners() {
        // Basic Tools
        document.getElementById('cutTool').addEventListener('click', () => this.activateTool('cut'));
        document.getElementById('trimTool').addEventListener('click', () => this.activateTool('trim'));
        document.getElementById('splitTool').addEventListener('click', () => this.activateTool('split'));
        document.getElementById('deleteTool').addEventListener('click', () => this.activateTool('delete'));

        // Adjust Tools
        document.getElementById('cropTool').addEventListener('click', () => this.activateTool('crop'));
        document.getElementById('rotateTool').addEventListener('click', () => this.activateTool('rotate'));
        document.getElementById('resizeTool').addEventListener('click', () => this.activateTool('resize'));
        document.getElementById('speedTool').addEventListener('click', () => this.activateTool('speed'));

        // Enhance Tools
        document.getElementById('colorTool').addEventListener('click', () => this.activateTool('color'));
        document.getElementById('filtersTool').addEventListener('click', () => this.activateTool('filters'));
        document.getElementById('stabilizeTool').addEventListener('click', () => this.activateTool('stabilize'));
        document.getElementById('deNoiseTool').addEventListener('click', () => this.activateTool('denoise'));

        // Audio Tools
        document.getElementById('volumeTool').addEventListener('click', () => this.activateTool('volume'));
        document.getElementById('fadeAudioTool').addEventListener('click', () => this.activateTool('fade'));
        document.getElementById('equalizerTool').addEventListener('click', () => this.activateTool('equalizer'));
        document.getElementById('voiceOverTool').addEventListener('click', () => this.activateTool('voiceover'));

        // Effects Tools
        document.getElementById('transitionsTool').addEventListener('click', () => this.activateTool('transitions'));
        document.getElementById('textTool').addEventListener('click', () => this.activateTool('text'));
        document.getElementById('overlayTool').addEventListener('click', () => this.activateTool('overlay'));
        document.getElementById('animationTool').addEventListener('click', () => this.activateTool('animation'));
    }

    // File Operations
    async importVideo() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await this.loadVideo(file);
                } catch (error) {
                    this.showNotification('Error loading video: ' + error.message, 'error');
                }
            }
        };

        input.click();
    }

    async loadVideo(file) {
        state.videoFile = file;
        const url = URL.createObjectURL(file);
        this.videoPlayer.src = url;
        
        // Wait for video metadata to load
        await new Promise(resolve => {
            this.videoPlayer.onloadedmetadata = resolve;
        });

        this.updateVideoProperties();
        this.createVideoTrack();
        this.resetTimeline();
    }

    // Timeline Management
    setupTimeline() {
        this.timelineContainer.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                this.zoomTimeline(e.deltaY > 0 ? -5 : 5);
            }
        });

        this.timelineContainer.addEventListener('mousedown', (e) => this.handleTimelineMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleTimelineMouseMove(e));
        document.addEventListener('mouseup', () => this.handleTimelineMouseUp());

        this.drawTimeRuler();
    }

    createVideoTrack() {
        const track = {
            id: Date.now(),
            type: 'video',
            clips: [{
                id: 'main',
                startTime: 0,
                endTime: this.videoPlayer.duration,
                source: state.videoFile,
                effects: []
            }]
        };

        state.timeline.tracks.video = [track];
        this.renderTracks();
    }

    renderTracks() {
        Object.entries(state.timeline.tracks).forEach(([type, tracks]) => {
            const container = document.querySelector(`.${type}-track`);
            container.innerHTML = '';

            tracks.forEach(track => {
                track.clips.forEach(clip => {
                    const clipElement = this.createClipElement(clip, type);
                    container.appendChild(clipElement);
                });
            });
        });
    }

    createClipElement(clip, type) {
        const element = document.createElement('div');
        element.className = `clip ${type}-clip`;
        element.id = `clip_${clip.id}`;
        
        const duration = clip.endTime - clip.startTime;
        const width = this.timeToPixels(duration);
        const left = this.timeToPixels(clip.startTime);

        element.style.width = `${width}px`;
        element.style.left = `${left}px`;

        // Add clip content based on type
        switch (type) {
            case 'video':
                this.createVideoClipContent(element, clip);
                break;
            case 'audio':
                this.createAudioClipContent(element, clip);
                break;
            case 'text':
                this.createTextClipContent(element, clip);
                break;
            case 'effects':
                this.createEffectClipContent(element, clip);
                break;
        }

        this.makeClipDraggable(element, clip);
        return element;
    }

    // Tool Operations
    activateTool(toolName) {
        state.selectedTool = toolName;
        this.updateToolUI();
        this.showToolProperties(toolName);
    }

    async applyTool(tool, params) {
        try {
            switch (tool) {
                case 'cut':
                    await this.cutVideo(params);
                    break;
                case 'trim':
                    await this.trimVideo(params);
                    break;
                case 'crop':
                    await this.cropVideo(params);
                    break;
                case 'rotate':
                    await this.rotateVideo(params);
                    break;
                // Add more tool implementations
            }
            this.addToHistory();
        } catch (error) {
            this.showNotification(`Error applying ${tool}: ${error.message}`, 'error');
        }
    }

    // Video Processing
    async cutVideo(params) {
        const { startTime, endTime } = params;
        const inputPath = 'input.mp4';
        const outputPath = 'output.mp4';

        try {
            await this.ffmpeg.write(inputPath, state.videoFile);
            await this.ffmpeg.run(
                '-i', inputPath,
                '-ss', startTime.toString(),
                '-t', (endTime - startTime).toString(),
                '-c', 'copy',
                outputPath
            );

            const data = await this.ffmpeg.read(outputPath);
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            await this.loadVideo(blob);
        } catch (error) {
            throw new Error('Failed to cut video: ' + error.message);
        }
    }

    // Effects Processing
    applyVideoEffect(effect) {
        const currentClip = this.getCurrentClip();
        if (!currentClip) return;

        currentClip.effects.push(effect);
        this.renderEffects();
    }

    renderEffects() {
        const currentClip = this.getCurrentClip();
        if (!currentClip || !currentClip.effects.length) {
            this.clearEffectsCanvas();
            return;
        }

        this.ctx.clearRect(0, 0, this.effectsCanvas.width, this.effectsCanvas.height);
        currentClip.effects.forEach(effect => {
            switch (effect.type) {
                case 'filter':
                    this.applyFilter(effect.params);
                    break;
                case 'overlay':
                    this.applyOverlay(effect.params);
                    break;
                case 'text':
                    this.renderText(effect.params);
                    break;
            }
        });
    }

    // History Management
    addToHistory() {
        const state = this.getEditorState();
        
        // Remove future states if we're not at the end of history
        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
        }

        state.history.push(state);
        if (state.history.length > state.settings.maxHistoryStates) {
            state.history.shift();
        }
        state.historyIndex = state.history.length - 1;

        this.updateHistoryButtons();
    }

    // Utility Functions
    timeToPixels(time) {
        return time * (state.timeline.zoom / 100) * 100;
    }

    pixelsToTime(pixels) {
        return pixels / ((state.timeline.zoom / 100) * 100);
    }

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize application
const videoEditor = new VideoEditor(); 