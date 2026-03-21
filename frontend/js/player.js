class AudioPlayer {
  constructor() {
    this.audio = document.getElementById('audio-player');
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
    }
  }

  playTrack(track, queue = null) {
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
    
    this.audio.src = api.getStreamUrl(track.Id);
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
        let artworkUrl = api.getArtworkUrl(track.Id);
        let absoluteArt = artworkUrl.startsWith('http') ? artworkUrl : window.location.origin + artworkUrl;
        
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.Name,
          artist: track.AlbumArtist || track.ArtistName || 'Unknown Artist',
          album: track.Album || 'Unknown Album',
          artwork: [
            { src: absoluteArt, sizes: '512x512', type: 'image/jpeg' }
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.fastSeek && 'fastSeek' in this.audio) {
              this.audio.fastSeek(details.seekTime);
          } else {
              this.seek(details.seekTime);
          }
        });
      }
    }
  }
}
const player = new AudioPlayer();
