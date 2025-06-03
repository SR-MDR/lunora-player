// Language Selector Module for Lunora Player
class LanguageSelector {
    constructor(videoElement, hlsInstance) {
        this.video = videoElement;
        this.hls = hlsInstance;
        this.audioTracks = [];
        this.subtitleTracks = [];
        this.currentAudioTrack = null;
        this.currentSubtitleTrack = null;
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.audioSelect = document.getElementById('audio-select');
        this.subtitleSelect = document.getElementById('subtitle-select');
        this.languagePanel = document.getElementById('language-panel');
        this.settingsToggle = document.getElementById('settings-toggle');
        this.applyButton = document.getElementById('apply-languages');
        this.closeButton = document.getElementById('close-panel');
    }

    bindEvents() {
        // Settings panel toggle
        this.settingsToggle?.addEventListener('click', () => {
            this.toggleLanguagePanel();
        });

        // Apply language changes
        this.applyButton?.addEventListener('click', () => {
            this.applyLanguageChanges();
        });

        // Close panel
        this.closeButton?.addEventListener('click', () => {
            this.hideLanguagePanel();
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (this.languagePanel && 
                !this.languagePanel.contains(e.target) && 
                !this.settingsToggle.contains(e.target)) {
                this.hideLanguagePanel();
            }
        });

        // HLS events for track detection
        if (this.hls) {
            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.detectAudioTracks();
                this.detectSubtitleTracks();
                this.updateLanguageSelectors();
            });

            this.hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
                this.detectAudioTracks();
                this.updateAudioSelector();
            });

            this.hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
                this.detectSubtitleTracks();
                this.updateSubtitleSelector();
            });
        }

        // Native video events for non-HLS content
        this.video.addEventListener('loadedmetadata', () => {
            this.detectNativeAudioTracks();
            this.detectNativeSubtitleTracks();
            this.updateLanguageSelectors();
        });
    }

    detectAudioTracks() {
        if (!this.hls) return;
        
        this.audioTracks = this.hls.audioTracks || [];
        console.log('Detected audio tracks:', this.audioTracks);
        
        // Set default audio track if available
        if (this.audioTracks.length > 0 && this.currentAudioTrack === null) {
            const defaultTrack = this.findDefaultAudioTrack();
            if (defaultTrack !== -1) {
                this.hls.audioTrack = defaultTrack;
                this.currentAudioTrack = defaultTrack;
            }
        }
    }

    detectSubtitleTracks() {
        if (!this.hls) return;
        
        this.subtitleTracks = this.hls.subtitleTracks || [];
        console.log('Detected subtitle tracks:', this.subtitleTracks);
    }

    detectNativeAudioTracks() {
        // For native HTML5 video (non-HLS)
        this.audioTracks = [];
        if (this.video.audioTracks) {
            for (let i = 0; i < this.video.audioTracks.length; i++) {
                const track = this.video.audioTracks[i];
                this.audioTracks.push({
                    id: i,
                    name: track.label || `Audio Track ${i + 1}`,
                    lang: track.language || 'unknown',
                    enabled: track.enabled
                });
            }
        }
    }

    detectNativeSubtitleTracks() {
        // For native HTML5 video (non-HLS)
        this.subtitleTracks = [];
        if (this.video.textTracks) {
            for (let i = 0; i < this.video.textTracks.length; i++) {
                const track = this.video.textTracks[i];
                if (track.kind === 'subtitles' || track.kind === 'captions') {
                    this.subtitleTracks.push({
                        id: i,
                        name: track.label || `Subtitle Track ${i + 1}`,
                        lang: track.language || 'unknown',
                        kind: track.kind
                    });
                }
            }
        }
    }

    findDefaultAudioTrack() {
        const defaultLang = PlayerConfig.player.defaultLanguages.audio;
        
        // Try to find track matching default language
        for (let i = 0; i < this.audioTracks.length; i++) {
            const track = this.audioTracks[i];
            if (track.lang && track.lang.startsWith(defaultLang)) {
                return i;
            }
        }
        
        // Return first track if no match found
        return this.audioTracks.length > 0 ? 0 : -1;
    }

    updateLanguageSelectors() {
        this.updateAudioSelector();
        this.updateSubtitleSelector();
        this.updateStreamInfo();
    }

    updateAudioSelector() {
        if (!this.audioSelect) return;
        
        // Clear existing options
        this.audioSelect.innerHTML = '<option value="">Select Audio Language</option>';
        
        // Add audio track options
        this.audioTracks.forEach((track, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = this.formatTrackName(track, 'audio');
            
            if (index === this.currentAudioTrack) {
                option.selected = true;
            }
            
            this.audioSelect.appendChild(option);
        });
    }

    updateSubtitleSelector() {
        if (!this.subtitleSelect) return;
        
        // Clear existing options
        this.subtitleSelect.innerHTML = '<option value="">No Subtitles</option>';
        
        // Add subtitle track options
        this.subtitleTracks.forEach((track, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = this.formatTrackName(track, 'subtitle');
            
            if (index === this.currentSubtitleTrack) {
                option.selected = true;
            }
            
            this.subtitleSelect.appendChild(option);
        });
    }

    formatTrackName(track, type) {
        const langName = this.getLanguageName(track.lang);
        const trackName = track.name || track.label || `${type} Track`;
        
        if (langName && langName !== track.lang) {
            return `${langName} (${trackName})`;
        }
        
        return trackName;
    }

    getLanguageName(langCode) {
        if (!langCode) return null;
        
        // Extract language code (first 2 characters)
        const code = langCode.substring(0, 2).toLowerCase();
        return PlayerConfig.player.supportedLanguages[code] || langCode;
    }

    toggleLanguagePanel() {
        if (this.languagePanel.style.display === 'none' || !this.languagePanel.style.display) {
            this.showLanguagePanel();
        } else {
            this.hideLanguagePanel();
        }
    }

    showLanguagePanel() {
        if (this.languagePanel) {
            this.languagePanel.style.display = 'block';
            this.updateLanguageSelectors(); // Refresh the selectors
        }
    }

    hideLanguagePanel() {
        if (this.languagePanel) {
            this.languagePanel.style.display = 'none';
        }
    }

    applyLanguageChanges() {
        const selectedAudio = this.audioSelect?.value;
        const selectedSubtitle = this.subtitleSelect?.value;
        
        // Apply audio track change
        if (selectedAudio !== '' && selectedAudio !== this.currentAudioTrack) {
            this.changeAudioTrack(parseInt(selectedAudio));
        }
        
        // Apply subtitle track change
        if (selectedSubtitle !== this.currentSubtitleTrack) {
            this.changeSubtitleTrack(selectedSubtitle === '' ? null : parseInt(selectedSubtitle));
        }
        
        this.hideLanguagePanel();
        this.updateStreamInfo();
    }

    changeAudioTrack(trackIndex) {
        if (this.hls && trackIndex >= 0 && trackIndex < this.audioTracks.length) {
            this.hls.audioTrack = trackIndex;
            this.currentAudioTrack = trackIndex;
            console.log('Changed audio track to:', this.audioTracks[trackIndex]);
        } else if (this.video.audioTracks && trackIndex >= 0) {
            // For native HTML5 video
            for (let i = 0; i < this.video.audioTracks.length; i++) {
                this.video.audioTracks[i].enabled = (i === trackIndex);
            }
            this.currentAudioTrack = trackIndex;
        }
    }

    changeSubtitleTrack(trackIndex) {
        if (this.hls) {
            this.hls.subtitleTrack = trackIndex;
            this.currentSubtitleTrack = trackIndex;
            if (trackIndex !== null && trackIndex >= 0) {
                console.log('Changed subtitle track to:', this.subtitleTracks[trackIndex]);
            } else {
                console.log('Disabled subtitles');
            }
        } else if (this.video.textTracks) {
            // For native HTML5 video
            for (let i = 0; i < this.video.textTracks.length; i++) {
                const track = this.video.textTracks[i];
                if (track.kind === 'subtitles' || track.kind === 'captions') {
                    track.mode = (i === trackIndex) ? 'showing' : 'hidden';
                }
            }
            this.currentSubtitleTrack = trackIndex;
        }
    }

    updateStreamInfo() {
        const audioCountElement = document.getElementById('audio-tracks-count');
        const subtitleCountElement = document.getElementById('subtitle-tracks-count');
        
        if (audioCountElement) {
            audioCountElement.textContent = this.audioTracks.length;
        }
        
        if (subtitleCountElement) {
            subtitleCountElement.textContent = this.subtitleTracks.length;
        }
    }

    // Public methods for external control
    getCurrentAudioTrack() {
        return this.currentAudioTrack !== null ? this.audioTracks[this.currentAudioTrack] : null;
    }

    getCurrentSubtitleTrack() {
        return this.currentSubtitleTrack !== null ? this.subtitleTracks[this.currentSubtitleTrack] : null;
    }

    getAvailableAudioTracks() {
        return this.audioTracks;
    }

    getAvailableSubtitleTracks() {
        return this.subtitleTracks;
    }
}
