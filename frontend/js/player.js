class AudioPlayer {
  constructor() {
    this.audio = document.getElementById('audio-player');
    this.preloadAudio = new Audio();
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.onStateChange = null;
    this.isDragging = false;
    this.isRepeating = false;
    this.isShuffling = false;

    if (this.audio) {
      this.audio.addEventListener('timeupdate', () => {
        if (!this.isDragging) this.emitState();
      });
      this.audio.addEventListener('play', () => { this.isPlaying = true; this.emitState(); });
      this.audio.addEventListener('pause', () => { this.isPlaying = false; this.emitState(); });
      this.audio.addEventListener('ended', () => {
         if (this.isRepeating) { this.audio.currentTime = 0; this.audio.play(); }
         else this.next();
      });
      // Preload next track when current one is near the end
      this.audio.addEventListener('timeupdate', () => {
        if (this.audio.duration && this.audio.currentTime > this.audio.duration - 20) {
          this._preloadNext();
        }
      });
    }
  }

  async preload(track) {
    if (this.isPlaying) return; // don't interrupt current playback
    if (this.audio.dataset.preloaded === track.Id) return;
    this.audio.dataset.preloaded = track.Id;
    const blob = await storage.get('blobs', track.Id);
    this.audio.src = blob ? URL.createObjectURL(blob) : await api.getDirectStreamUrl(track.Id);
  }

  async _preloadNext() {
    const next = this.queue[this.currentIndex + 1];
    if (!next || this.preloadAudio.dataset.preloaded === next.Id) return;
    this.preloadAudio.dataset.preloaded = next.Id;
    const blob = await storage.get('blobs', next.Id);
    this.preloadAudio.src = blob ? URL.createObjectURL(blob) : await api.getDirectStreamUrl(next.Id);
    this.preloadAudio.preload = 'auto';
  }

  async playTrack(track, queue = null) {
    this.audio.pause();

    if (queue) {
      if(this.isShuffling) this.queue = [...queue].sort(() => Math.random() - 0.5);
      else this.queue = [...queue];
    }

    const existingIdx = this.queue.findIndex(t => t.Id === track.Id);
    if(existingIdx !== -1) {
      this.currentIndex = existingIdx;
    } else {
      this.queue.splice(this.currentIndex + 1, 0, track);
      this.currentIndex++;
    }

    if (this.audio.dataset.preloaded === track.Id) {
        delete this.audio.dataset.preloaded;
    } else {
        const blob = await storage.get('blobs', track.Id);
        if (blob) {
            this.audio.src = URL.createObjectURL(blob);
        } else {
            this.audio.src = await api.getDirectStreamUrl(track.Id);
        }
    }

    this.audio.play().catch(e => console.error(e));
    this.emitState();
  }

  playNext(track) {
    if(!this.currentTrack()) {
       this.playTrack(track);
       return;
    }
    const existingIdx = this.queue.findIndex(t => t.Id === track.Id);
    if(existingIdx !== -1) this.queue.splice(existingIdx, 1);
    this.queue.splice(this.currentIndex + 1, 0, track);
    this.emitState();
  }
  
  reorderQueue(from, to) {
      if(from === to) return;
      const moved = this.queue.splice(from, 1)[0];
      this.queue.splice(to, 0, moved);
      if(this.currentIndex === from) this.currentIndex = to;
      else if(from < this.currentIndex && to >= this.currentIndex) this.currentIndex--;
      else if(from > this.currentIndex && to <= this.currentIndex) this.currentIndex++;
      this.emitState();
  }

  togglePlay() {
    if(!this.audio.src) return;
    if (this.isPlaying) this.audio.pause();
    else this.audio.play();
  }

  next() {
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      this.playTrack(this.queue[this.currentIndex]);
    } else {
      this.isPlaying = false;
      this.emitState();
    }
  }

  prev() {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
    } else if (this.currentIndex > 0) {
      this.currentIndex--;
      this.playTrack(this.queue[this.currentIndex]);
    }
  }

  seek(time) { 
    this.audio.currentTime = time; 
    this.emitState();
  }
  
  setVolume(vol) { this.audio.volume = vol; }

  // Queue features
  clearQueue() {
    const current = this.currentTrack();
    this.queue = current ? [current] : [];
    this.currentIndex = current ? 0 : -1;
    this.emitState();
  }
  
  removeFromQueue(index) {
    if(index === this.currentIndex) return;
    this.queue.splice(index, 1);
    if(index < this.currentIndex) this.currentIndex--;
    this.emitState();
  }
  
  addToQueue(track) {
    this.queue.push(track);
    this.emitState();
  }

  toggleRepeat() {
    this.isRepeating = !this.isRepeating;
    this.emitState();
  }

  toggleShuffle() {
    this.isShuffling = !this.isShuffling;
    if(this.isShuffling) {
      const current = this.currentTrack();
      const remaining = this.queue.filter((_, i) => i !== this.currentIndex).sort(() => Math.random() - 0.5);
      this.queue = current ? [current, ...remaining] : remaining;
      this.currentIndex = current ? 0 : -1;
    }
    this.emitState();
  }

  currentTrack() {
    return this.currentIndex >= 0 ? this.queue[this.currentIndex] : null;
  }

  emitState() {
    if(this.onStateChange) this.onStateChange({
      isPlaying: this.isPlaying,
      track: this.currentTrack(),
      currentTime: this.audio.currentTime,
      duration: this.audio.duration || 0,
      volume: this.audio.volume,
      isRepeating: this.isRepeating,
      isShuffling: this.isShuffling,
      queue: this.queue,
      currentIndex: this.currentIndex
    });

    if ('mediaSession' in navigator) {
      const track = this.currentTrack();
      if (track) {
        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';

        const artworkUrl = api.getArtworkUrl(track.Id);
        const absoluteArt = artworkUrl.startsWith('http') ? artworkUrl : (window.location.origin + artworkUrl);

        if (this._lastMediaSessionTrack !== track.Id) {
          this._lastMediaSessionTrack = track.Id;

          const setMeta = (artSrc) => {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: track.Name || 'Unknown Title',
              artist: (track.Artists && track.Artists.join(', ')) || track.AlbumArtist || track.ArtistName || 'Unknown Artist',
              album: track.Album || 'Unknown Album',
              artwork: [
                { src: artSrc, sizes: '96x96',   type: 'image/jpeg' },
                { src: artSrc, sizes: '128x128',  type: 'image/jpeg' },
                { src: artSrc, sizes: '256x256',  type: 'image/jpeg' },
                { src: artSrc, sizes: '512x512',  type: 'image/jpeg' },
              ]
            });
          };

          if (typeof storage !== 'undefined') {
            storage.get('artwork', track.Id).then(blob => {
              setMeta(blob ? URL.createObjectURL(blob) : absoluteArt);
            }).catch(() => setMeta(absoluteArt));
          } else {
            setMeta(absoluteArt);
          }

          navigator.mediaSession.setActionHandler('play',          () => this.audio.play());
          navigator.mediaSession.setActionHandler('pause',         () => this.audio.pause());
          navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
          navigator.mediaSession.setActionHandler('nexttrack',     () => this.next());
          navigator.mediaSession.setActionHandler('seekto', (d) => {
            const t = d.seekTime;
            if (d.fastSeek && 'fastSeek' in this.audio) this.audio.fastSeek(t);
            else this.seek(t);
          });
          try {
            navigator.mediaSession.setActionHandler('seekbackward', (d) => this.seek(Math.max(0, this.audio.currentTime - (d.seekOffset || 10))));
            navigator.mediaSession.setActionHandler('seekforward',  (d) => this.seek(Math.min(this.audio.duration || 0, this.audio.currentTime + (d.seekOffset || 10))));
          } catch(e) {}
        }

        if (this.audio.duration && !isNaN(this.audio.duration)) {
          try {
            navigator.mediaSession.setPositionState({
              duration:     this.audio.duration,
              playbackRate: this.audio.playbackRate || 1,
              position:     this.audio.currentTime,
            });
          } catch(e) {}
        }
      } else {
        navigator.mediaSession.playbackState = 'none';
        this._lastMediaSessionTrack = null;
      }
    }
  }
}
const player = new AudioPlayer();
