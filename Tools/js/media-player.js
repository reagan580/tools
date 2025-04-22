// State Management
class MediaPlayerState {
    constructor() {
        this.currentMedia = null;
        this.playlist = [];
        this.queue = [];
        this.history = [];
        this.favorites = new Set();
        this.playlists = new Map();
        this.isPlaying = false;
        this.isMuted = false;
        this.volume = 1;
        this.currentTime = 0;
        this.duration = 0;
        this.playbackRate = 1;
        this.quality = 'auto';
        this.subtitlesEnabled = false;
        this.settings = {
            autoplay: true,
            defaultQuality: 'auto',
            autoSubtitles: false,
            preferredLanguage: 'en'
        };
    }
}

// Main Media Player Class
class MediaPlayer {
    constructor() {
        this.state = new MediaPlayerState();
        this.player = null;
        this.hlsPlayer = null;
        this.dashPlayer = null;
        this.updateInterval = null;
    }

    // Initialization
    async initialize() {
        try {
            this.player = document.getElementById('videoPlayer');
            await this.loadSettings();
            this.setupEventListeners();
            this.setupStreamingSupport();
            this.setupKeyboardControls();
            this.loadMediaLibrary();
            this.startProgressUpdates();
        } catch (error) {
            this.showNotification('Error initializing Media Player', 'error');
            console.error('Initialization error:', error);
        }
    }

    // Player Setup
    setupStreamingSupport() {
        // Setup HLS.js
        if (Hls.isSupported()) {
            this.hlsPlayer = new Hls();
            this.hlsPlayer.attachMedia(this.player);
            this.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
                this.updateQualityLevels(this.hlsPlayer.levels);
            });
        }

        // Setup Dash.js
        this.dashPlayer = dashjs.MediaPlayer().create();
        this.dashPlayer.initialize(this.player, null, false);
    }

    // Media Control
    async loadMedia(mediaSource, type = 'video/mp4') {
        try {
            if (this.isStreaming(mediaSource)) {
                await this.loadStream(mediaSource);
            } else {
                this.player.src = mediaSource;
                this.player.type = type;
            }

            await this.player.load();
            this.updateMediaInfo();
            if (this.state.settings.autoplay) {
                this.play();
            }
        } catch (error) {
            this.showNotification('Error loading media', 'error');
        }
    }

    async loadStream(url) {
        if (url.includes('.m3u8')) {
            this.loadHLSStream(url);
        } else if (url.includes('.mpd')) {
            this.loadDASHStream(url);
        } else {
            throw new Error('Unsupported stream format');
        }
    }

    loadHLSStream(url) {
        if (Hls.isSupported()) {
            this.hlsPlayer.loadSource(url);
        } else if (this.player.canPlayType('application/vnd.apple.mpegurl')) {
            this.player.src = url;
        }
    }

    loadDASHStream(url) {
        this.dashPlayer.attachSource(url);
    }

    play() {
        if (!this.state.currentMedia) return;
        this.player.play();
        this.state.isPlaying = true;
        this.updatePlayPauseButton();
    }

    pause() {
        this.player.pause();
        this.state.isPlaying = false;
        this.updatePlayPauseButton();
    }

    togglePlay() {
        if (this.state.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    // Volume Control
    setVolume(value) {
        const volume = Math.max(0, Math.min(1, value));
        this.player.volume = volume;
        this.state.volume = volume;
        this.updateVolumeUI();
    }

    toggleMute() {
        this.state.isMuted = !this.state.isMuted;
        this.player.muted = this.state.isMuted;
        this.updateVolumeUI();
    }

    // Playback Control
    seek(time) {
        if (!this.state.currentMedia) return;
        const newTime = Math.max(0, Math.min(time, this.state.duration));
        this.player.currentTime = newTime;
        this.updateProgressBar();
    }

    setPlaybackRate(rate) {
        this.player.playbackRate = rate;
        this.state.playbackRate = rate;
        this.updatePlaybackRateButton();
    }

    // Quality Control
    setQuality(level) {
        if (this.hlsPlayer) {
            this.hlsPlayer.currentLevel = level;
        } else if (this.dashPlayer) {
            this.dashPlayer.setQualityFor('video', level);
        }
        this.state.quality = level;
        this.updateQualityButton();
    }

    // Playlist Management
    async createPlaylist(playlistData) {
        try {
            const playlist = {
                id: this.generateId(),
                items: [],
                created: new Date(),
                ...playlistData
            };

            this.state.playlists.set(playlist.id, playlist);
            await this.savePlaylist(playlist);
            this.updatePlaylistsUI();
            this.showNotification('Playlist created successfully', 'success');
        } catch (error) {
            this.showNotification('Error creating playlist', 'error');
        }
    }

    addToPlaylist(playlistId, mediaId) {
        const playlist = this.state.playlists.get(playlistId);
        if (!playlist) return;

        playlist.items.push(mediaId);
        this.updatePlaylistsUI();
        this.savePlaylist(playlist);
    }

    // Queue Management
    addToQueue(mediaId) {
        this.state.queue.push(mediaId);
        this.updateQueueUI();
    }

    playNext() {
        if (this.state.queue.length === 0) return;
        const nextMediaId = this.state.queue.shift();
        this.loadMedia(nextMediaId);
        this.updateQueueUI();
    }

    // UI Updates
    updateProgressBar() {
        const progress = (this.state.currentTime / this.state.duration) * 100;
        document.querySelector('.progress-current').style.width = `${progress}%`;
        document.querySelector('.progress-slider').value = progress;
        this.updateTimeDisplay();
    }

    updateTimeDisplay() {
        document.getElementById('currentTime').textContent = this.formatTime(this.state.currentTime);
        document.getElementById('duration').textContent = this.formatTime(this.state.duration);
    }

    updatePlayPauseButton() {
        const button = document.getElementById('playPauseBtn');
        button.textContent = this.state.isPlaying ? '⏸' : '⏵';
    }

    updateVolumeUI() {
        const volumeSlider = document.getElementById('volumeSlider');
        const muteButton = document.getElementById('muteBtn');
        
        volumeSlider.value = this.state.isMuted ? 0 : this.state.volume * 100;
        muteButton.textContent = this.state.isMuted ? '🔇' : '🔊';
    }

    updateMediaInfo() {
        if (!this.state.currentMedia) return;

        const title = document.querySelector('.media-title');
        const views = document.querySelector('.views');
        const uploadDate = document.querySelector('.upload-date');

        title.textContent = this.state.currentMedia.title;
        views.textContent = `${this.formatNumber(this.state.currentMedia.views)} views`;
        uploadDate.textContent = this.formatDate(this.state.currentMedia.uploadDate);
    }

    // Event Handlers
    setupEventListeners() {
        // Player events
        this.player.addEventListener('loadedmetadata', () => {
            this.state.duration = this.player.duration;
            this.updateTimeDisplay();
        });

        this.player.addEventListener('timeupdate', () => {
            this.state.currentTime = this.player.currentTime;
            this.updateProgressBar();
        });

        this.player.addEventListener('ended', () => {
            this.handleMediaEnd();
        });

        // Control events
        document.getElementById('playPauseBtn').addEventListener('click', () => {
            this.togglePlay();
        });

        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            this.setVolume(e.target.value / 100);
        });

        document.getElementById('muteBtn').addEventListener('click', () => {
            this.toggleMute();
        });

        // Progress bar events
        document.querySelector('.progress-slider').addEventListener('input', (e) => {
            const time = (e.target.value / 100) * this.state.duration;
            this.seek(time);
        });
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowLeft':
                    this.seek(this.state.currentTime - 5);
                    break;
                case 'ArrowRight':
                    this.seek(this.state.currentTime + 5);
                    break;
                case 'ArrowUp':
                    this.setVolume(this.state.volume + 0.1);
                    break;
                case 'ArrowDown':
                    this.setVolume(this.state.volume - 0.1);
                    break;
            }
        });
    }

    // Utility Functions
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    formatNumber(number) {
        return new Intl.NumberFormat().format(number);
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString();
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    isStreaming(url) {
        return url.includes('.m3u8') || url.includes('.mpd');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize Media Player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const mediaPlayer = new MediaPlayer();
    mediaPlayer.initialize().catch(error => {
        console.error('Failed to initialize Media Player:', error);
    });
}); 