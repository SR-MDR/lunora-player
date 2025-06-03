// Lunora Player - Main Player Module
class LunoraPlayer {
    constructor() {
        this.video = null;
        this.hls = null;
        this.languageSelector = null;
        this.currentSource = null;
        this.isFullscreen = false;
        this.streamInfo = {
            status: 'idle',
            quality: 'auto',
            audioTracks: 0,
            subtitleTracks: 0
        };
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.checkHLSSupport();
        console.log('Lunora Player initialized');
    }

    initializeElements() {
        this.video = document.getElementById('video-player');
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.errorMessage = document.getElementById('error-message');
        this.streamInfoSection = document.getElementById('stream-info');
        this.videoWrapper = document.getElementById('video-wrapper');
        
        // Source selection elements
        this.liveUrlInput = document.getElementById('live-url');
        this.vodUrlInput = document.getElementById('vod-url');
        this.testUrlInput = document.getElementById('test-url');
        this.loadStreamButton = document.getElementById('load-stream');
        
        // Control elements
        this.fullscreenToggle = document.getElementById('fullscreen-toggle');
        this.retryButton = document.getElementById('retry-btn');
    }

    bindEvents() {
        // Load stream button
        this.loadStreamButton?.addEventListener('click', () => {
            this.loadSelectedStream();
        });

        // Fullscreen toggle
        this.fullscreenToggle?.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Retry button
        this.retryButton?.addEventListener('click', () => {
            this.retryStream();
        });

        // Source type radio buttons
        document.querySelectorAll('input[name="source-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateSourceInputs(e.target.value);
            });
        });

        // Video events
        this.video.addEventListener('loadstart', () => {
            this.showLoading();
            this.updateStreamStatus('loading');
        });

        this.video.addEventListener('loadedmetadata', () => {
            this.hideLoading();
            this.updateStreamStatus('loaded');
            this.updateStreamInfo();
        });

        this.video.addEventListener('canplay', () => {
            this.updateStreamStatus('ready');
        });

        this.video.addEventListener('playing', () => {
            this.updateStreamStatus('playing');
        });

        this.video.addEventListener('pause', () => {
            this.updateStreamStatus('paused');
        });

        this.video.addEventListener('error', (e) => {
            this.handleVideoError(e);
        });

        // Fullscreen events
        document.addEventListener('fullscreenchange', () => {
            this.handleFullscreenChange();
        });

        document.addEventListener('webkitfullscreenchange', () => {
            this.handleFullscreenChange();
        });

        document.addEventListener('mozfullscreenchange', () => {
            this.handleFullscreenChange();
        });

        document.addEventListener('MSFullscreenChange', () => {
            this.handleFullscreenChange();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    checkHLSSupport() {
        if (Hls.isSupported()) {
            console.log('HLS.js is supported');
            this.initializeHLS();
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            console.log('Native HLS support detected');
        } else {
            console.error('HLS is not supported in this browser');
            this.showError('HLS is not supported in this browser. Please use a modern browser.');
        }
    }

    initializeHLS() {
        if (this.hls) {
            this.hls.destroy();
        }

        this.hls = new Hls(PlayerConfig.player.hlsConfig);
        
        // Bind HLS events
        this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            console.log('HLS media attached');
        });

        this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            console.log('HLS manifest parsed', data);
            this.hideLoading();
            this.updateStreamInfo();
        });

        this.hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            console.log('Quality level switched to:', data.level);
            this.updateQualityInfo(data.level);
        });

        this.hls.on(Hls.Events.ERROR, (event, data) => {
            this.handleHLSError(event, data);
        });

        this.hls.on(Hls.Events.FRAG_LOADED, () => {
            this.hideLoading();
        });

        // Attach to video element
        this.hls.attachMedia(this.video);

        // Initialize language selector
        this.languageSelector = new LanguageSelector(this.video, this.hls);
    }

    loadSelectedStream() {
        const selectedSourceType = document.querySelector('input[name="source-type"]:checked')?.value;
        let streamUrl = '';

        switch (selectedSourceType) {
            case 'live':
                streamUrl = this.liveUrlInput?.value;
                break;
            case 'vod':
                streamUrl = this.vodUrlInput?.value;
                break;
            case 'test':
                streamUrl = this.testUrlInput?.value;
                break;
            default:
                this.showError('Please select a stream source');
                return;
        }

        if (!streamUrl) {
            this.showError('Please enter a valid stream URL');
            return;
        }

        this.loadStream(streamUrl);
    }

    loadStream(url) {
        console.log('Loading stream:', url);
        this.currentSource = url;
        this.hideError();
        this.showLoading();
        this.updateStreamStatus('loading');

        if (Hls.isSupported()) {
            if (!this.hls) {
                this.initializeHLS();
            }
            this.hls.loadSource(url);
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            this.video.src = url;
            this.languageSelector = new LanguageSelector(this.video, null);
        } else {
            this.showError('HLS streaming is not supported in this browser');
            return;
        }

        this.streamInfoSection.style.display = 'block';
    }

    updateSourceInputs(sourceType) {
        // Enable/disable inputs based on selection
        const inputs = {
            live: this.liveUrlInput,
            vod: this.vodUrlInput,
            test: this.testUrlInput
        };

        Object.keys(inputs).forEach(key => {
            if (inputs[key]) {
                inputs[key].disabled = (key !== sourceType);
            }
        });
    }

    toggleFullscreen() {
        if (!this.isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    enterFullscreen() {
        const element = this.videoWrapper;
        
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    handleFullscreenChange() {
        this.isFullscreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );

        if (this.isFullscreen) {
            this.videoWrapper.classList.add('fullscreen');
            this.fullscreenToggle.textContent = '⛶ Exit Fullscreen';
        } else {
            this.videoWrapper.classList.remove('fullscreen');
            this.fullscreenToggle.textContent = '⛶ Fullscreen';
        }
    }

    handleKeyboardShortcuts(e) {
        // Only handle shortcuts when video is focused or no input is focused
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            return;
        }

        switch (e.key) {
            case ' ':
            case 'k':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'f':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 'm':
                e.preventDefault();
                this.toggleMute();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.seekRelative(-10);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.seekRelative(10);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.adjustVolume(0.1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.adjustVolume(-0.1);
                break;
        }
    }

    togglePlayPause() {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }

    toggleMute() {
        this.video.muted = !this.video.muted;
    }

    seekRelative(seconds) {
        this.video.currentTime = Math.max(0, Math.min(this.video.duration, this.video.currentTime + seconds));
    }

    adjustVolume(delta) {
        this.video.volume = Math.max(0, Math.min(1, this.video.volume + delta));
    }

    retryStream() {
        if (this.currentSource) {
            this.loadStream(this.currentSource);
        }
    }

    showLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'block';
        }
    }

    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }

    showError(message) {
        this.hideLoading();
        if (this.errorMessage) {
            const errorText = document.getElementById('error-text');
            if (errorText) {
                errorText.textContent = message;
            }
            this.errorMessage.style.display = 'block';
        }
        console.error('Player Error:', message);
    }

    hideError() {
        if (this.errorMessage) {
            this.errorMessage.style.display = 'none';
        }
    }

    handleVideoError(e) {
        const error = this.video.error;
        let message = 'An unknown error occurred';

        if (error) {
            switch (error.code) {
                case error.MEDIA_ERR_ABORTED:
                    message = 'Video playback was aborted';
                    break;
                case error.MEDIA_ERR_NETWORK:
                    message = 'Network error occurred while loading video';
                    break;
                case error.MEDIA_ERR_DECODE:
                    message = 'Video decoding error occurred';
                    break;
                case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    message = 'Video format not supported';
                    break;
            }
        }

        this.showError(message);
    }

    handleHLSError(event, data) {
        console.error('HLS Error:', data);

        if (data.fatal) {
            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    this.showError('Network error occurred. Please check your connection.');
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    this.showError('Media error occurred. Attempting to recover...');
                    this.hls.recoverMediaError();
                    break;
                default:
                    this.showError('Fatal error occurred. Please try reloading the stream.');
                    break;
            }
        }
    }

    updateStreamStatus(status) {
        this.streamInfo.status = status;
        const statusElement = document.getElementById('stream-status');
        if (statusElement) {
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    }

    updateQualityInfo(levelIndex) {
        if (this.hls && this.hls.levels && levelIndex >= 0) {
            const level = this.hls.levels[levelIndex];
            const quality = `${level.height}p`;
            this.streamInfo.quality = quality;

            const qualityElement = document.getElementById('stream-quality');
            if (qualityElement) {
                qualityElement.textContent = quality;
            }
        }
    }

    updateStreamInfo() {
        // Update audio and subtitle track counts
        if (this.languageSelector) {
            this.streamInfo.audioTracks = this.languageSelector.getAvailableAudioTracks().length;
            this.streamInfo.subtitleTracks = this.languageSelector.getAvailableSubtitleTracks().length;
        }
    }

    // Public API methods
    play() {
        return this.video.play();
    }

    pause() {
        this.video.pause();
    }

    getCurrentTime() {
        return this.video.currentTime;
    }

    getDuration() {
        return this.video.duration;
    }

    setVolume(volume) {
        this.video.volume = Math.max(0, Math.min(1, volume));
    }

    getVolume() {
        return this.video.volume;
    }

    destroy() {
        if (this.hls) {
            this.hls.destroy();
        }
    }
}

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.lunoraPlayer = new LunoraPlayer();
});
