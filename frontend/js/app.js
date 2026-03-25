const AuthView = `
  <div class="auth-panel">
    <img src="img/logo-glow.svg" alt="JellyWave Logo" style="height: 60px; width: 60px; margin-bottom: 20px; display: inline-block;">
    <h2>Welcome to JellyWave</h2>
    <form id="auth-form">
      <div class="form-group"><label>Username</label><input type="text" id="auth-user" required></div>
      <div class="form-group"><label>Password</label><input type="password" id="auth-pass" required></div>
      <button type="submit" class="btn-primary" id="auth-submit-btn">Login</button>
      <div class="auth-switch"><span id="auth-toggle-text">Don't have an account? <a href="#" id="auth-toggle-btn">Register</a></span></div>
    </form>
  </div>
`;

const AccessDeniedView = `
  <div class="auth-panel">
    <img src="img/logo-glow.svg" alt="JellyWave Logo" style="height: 60px; width: 60px; margin-bottom: 20px; display: inline-block;">
    <h2 style="color:var(--accent);">Access Restricted</h2>
    <p style="color:var(--text-secondary); margin:20px 0; font-size:16px; line-height:1.5;">This account does not have access yet. <br>To get access, join our Discord and open a ticket.</p>
    <a href="https://discord.gg/jellywaveapp" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none; margin-bottom:15px; background:#5865F2;">Join Discord</a>
    <div class="auth-switch"><a href="#" id="ad-logout-btn">Log back out</a></div>
  </div>
`;

class App {
  constructor() {
    this.user = null;
    this.currentRoute = 'home';
    this.playlists = [];
    this.favorites = new Set();
    this.init();
  }

  async init() {
    this.bindEvents();
    try {
      const auth = await api.checkAuth();
      if (auth.authenticated) {
        this.user = auth.user;
        if (!this.user.is_approved && this.user.role !== 'admin') {
          this.showAccessDenied();
        } else {
          this.startMainApp();
        }
      } else {
        this.showLogin();
      }
    } catch(e) {
      this.showLogin();
    }
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
        if(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        if(e.code === 'Space') { e.preventDefault(); player.togglePlay(); }
        if(e.code === 'ArrowRight' && e.ctrlKey) { e.preventDefault(); player.next(); }
        if(e.code === 'ArrowLeft' && e.ctrlKey) { e.preventDefault(); player.prev(); }
    });

    document.querySelectorAll('[data-route]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(el.getAttribute('data-route'));
      });
    });

    document.getElementById('logout-btn').addEventListener('click', async (e) => {
      e.preventDefault();
      await api.logout();
      window.location.reload();
    });

    // Player Hooks
    document.getElementById('play-pause-btn').addEventListener('click', () => player.togglePlay());
    document.getElementById('next-btn').addEventListener('click', () => player.next());
    document.getElementById('prev-btn').addEventListener('click', () => player.prev());
    document.getElementById('shuffle-btn').addEventListener('click', () => player.toggleShuffle());
    document.getElementById('repeat-btn').addEventListener('click', () => player.toggleRepeat());
    
    // Sliders
    const seekSlider = document.getElementById('seek-slider');
    seekSlider.addEventListener('mousedown', () => player.isDragging = true);
    seekSlider.addEventListener('input', (e) => {
        const pct = (e.target.value / e.target.max) * 100 || 0;
        e.target.style.setProperty('--progress', `${pct}%`);
    });
    seekSlider.addEventListener('mouseup', (e) => {
        player.isDragging = false;
        player.seek(e.target.value);
    });

    const volSlider = document.getElementById('volume-slider');
    volSlider.addEventListener('input', (e) => {
        player.setVolume(e.target.value);
        e.target.style.setProperty('--progress', `${e.target.value * 100}%`);
    });
    volSlider.style.setProperty('--progress', '100%');

    // UI Buttons
    document.getElementById('queue-toggle-btn').addEventListener('click', () => ui.toggleQueuePanel());
    
    document.getElementById('np-like-btn').addEventListener('click', () => {
        const track = player.currentTrack();
        if(track) this.toggleLike(track);
    });
    
    document.getElementById('np-artist').addEventListener('click', () => {
        const track = player.currentTrack();
        if(track && track.ArtistItems && track.ArtistItems.length > 0) {
            this.renderArtistView(track.ArtistItems[0].Id);
        }
    });
    
    document.getElementById('create-playlist-btn').addEventListener('click', () => this.showCreatePlaylistModal());

    player.onStateChange = (state) => this.updatePlayerUI(state);
  }

  showCreatePlaylistModal() {
     const modal = document.createElement('div');
     modal.style.position = 'fixed';
     modal.style.inset = '0';
     modal.style.background = 'rgba(0,0,0,0.8)';
     modal.style.zIndex = '99999';
     modal.style.display = 'flex';
     modal.style.alignItems = 'center';
     modal.style.justifyContent = 'center';
     
     let base64Cover = '';
     modal.innerHTML = `
        <div style="background:var(--bg-elevated); padding:30px; border-radius:8px; width:500px; max-width:90%; box-shadow: 0 16px 40px rgba(0,0,0,0.5); display:flex; gap:25px;">
            <div id="cp-img-wrapper" style="width:150px; height:150px; background:var(--bg-highlight); border-radius:4px; display:flex; align-items:center; justify-content:center; cursor:pointer; position:relative; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.5);">
                <i class="fa-solid fa-camera" style="font-size:32px; color:var(--text-secondary);"></i>
                <img id="cp-img-preview" src="" style="width:100%; height:100%; object-fit:cover; display:none; position:absolute; top:0; left:0;">
                <div id="cp-img-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;"><span style="font-size:12px; font-weight:bold; color:white;">Choose Image</span></div>
                <input type="file" id="cp-file" accept="image/*" style="display:none;">
            </div>
            <div style="flex:1;">
                <h2 style="margin-bottom:20px;">Create Playlist</h2>
                <div style="margin-bottom:15px;"><input type="text" id="cp-name" placeholder="Playlist Name" style="width:100%; padding:10px; background:var(--bg-highlight); border:none; color:white; border-radius:4px; outline:none;" required></div>
                <div style="margin-bottom:15px;"><textarea id="cp-desc" placeholder="Description (Optional)" style="width:100%; padding:10px; background:var(--bg-highlight); border:none; color:white; border-radius:4px; outline:none; resize:none; height:40px;"></textarea></div>
                <div style="margin-bottom:20px;"><label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="cp-public"> Make Public</label></div>
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button class="queue-action-btn" id="cp-cancel" style="padding:8px 16px;">Cancel</button>
                    <button class="btn-primary" id="cp-save" style="padding:8px 16px;">Create</button>
                </div>
            </div>
        </div>
     `;
     document.body.appendChild(modal);
     
     const wrapper = document.getElementById('cp-img-wrapper');
     const overlay = document.getElementById('cp-img-overlay');
     const fileInput = document.getElementById('cp-file');
     const preview = document.getElementById('cp-img-preview');
     
     wrapper.onmouseenter = () => overlay.style.opacity = '1';
     wrapper.onmouseleave = () => overlay.style.opacity = '0';
     wrapper.onclick = () => fileInput.click();
     
     fileInput.onchange = (e) => {
         const file = e.target.files[0];
         if(!file) return;
         const reader = new FileReader();
         reader.onload = (ev) => {
             const img = new Image();
             img.onload = () => {
                 const canvas = document.createElement('canvas');
                 const ctx = canvas.getContext('2d');
                 canvas.width = 400; canvas.height = 400;
                 ctx.drawImage(img, 0, 0, 400, 400);
                 base64Cover = canvas.toDataURL('image/jpeg', 0.8);
                 preview.src = base64Cover;
                 preview.style.display = 'block';
             };
             img.src = ev.target.result;
         };
         reader.readAsDataURL(file);
     };
     
     const closeModal = () => modal.remove();
     document.getElementById('cp-cancel').onclick = closeModal;
     document.getElementById('cp-save').onclick = async () => {
         const name = document.getElementById('cp-name').value.trim();
         const desc = document.getElementById('cp-desc').value.trim();
         const isPub = document.getElementById('cp-public').checked;
         if(!name) return;
         
         const btn = document.getElementById('cp-save');
         btn.innerText = 'Creating...';
         btn.disabled = true;
         try {
             await api.createPlaylist(name, isPub, desc, base64Cover);
             await this.refreshUserData();
             ui.toast('Playlist created', 'success');
             closeModal();
         } catch(e) {
             ui.toast('Failed to create playlist');
             btn.innerText = 'Create';
             btn.disabled = false;
         }
     };
  }

  updatePlayerUI(state) {
    const playBtn = document.getElementById('play-pause-btn');
    playBtn.innerHTML = state.isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    
    document.getElementById('shuffle-btn').classList.toggle('active', state.isShuffling);
    document.getElementById('repeat-btn').classList.toggle('active', state.isRepeating);
    
    const likeBtn = document.getElementById('np-like-btn');
    
    if (state.track) {
      document.getElementById('np-title').innerText = state.track.Name;
      document.getElementById('np-artist').innerText = state.track.Artists?.join(', ') || state.track.AlbumArtist || '';
      document.getElementById('np-art').style.display = 'block';
      let artworkUrl = api.getArtworkUrl(state.track.Id);
      if(state.track.Id.startsWith('demo')) artworkUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23FA233B" width="100" height="100"/></svg>';
      const imgEl = document.getElementById('np-art');
      imgEl.src = artworkUrl;
      
      if(artworkUrl.includes('a0f79dde7ebd3ff8412ad51659766638')) {
          api.getOnlineArtwork(state.track.Album + " " + (state.track.AlbumArtist || "")).then(u => {
              if(u && imgEl.src.includes('a0f79dde7ebd3ff8412ad51659766638')) imgEl.src = u;
          });
      }
      
      likeBtn.style.display = 'block';
      likeBtn.innerHTML = this.favorites.has(state.track.Id) ? '<i class="fa-solid fa-heart" style="color:var(--accent);"></i>' : '<i class="fa-regular fa-heart"></i>';
      
      if(state.currentTime === 0 && state.isPlaying) api.addRecent(state.track.Id, 'Audio', state.track.Name).catch(()=>{});
    } else {
      likeBtn.style.display = 'none';
      document.getElementById('np-title').innerText = '';
      document.getElementById('np-artist').innerText = '';
      document.getElementById('np-art').style.display = 'none';
    }
    
    document.getElementById('time-current').innerText = ui.formatTime(state.currentTime);
    document.getElementById('time-total').innerText = ui.formatTime(state.duration);
    
    const slider = document.getElementById('seek-slider');
    slider.max = state.duration || 100;
    if(!player.isDragging) {
        slider.value = state.currentTime;
        const pct = state.duration ? (state.currentTime / state.duration) * 100 : 0;
        slider.style.setProperty('--progress', `${pct}%`);
    }

    // Highlight active track row in any visible list
    document.querySelectorAll('.list-item.now-playing').forEach(el => el.classList.remove('now-playing'));
    if (state.track) {
        const activeRow = document.querySelector(`.list-item[data-track-id="${state.track.Id}"]`);
        if (activeRow) activeRow.classList.add('now-playing');
    }

    ui.renderQueue(state.queue, state.currentIndex);
  }

  showAccessDenied() {
    ui.showAuth();
    ui.authWrapper.innerHTML = AccessDeniedView;
    document.getElementById('ad-logout-btn').addEventListener('click', async (e) => {
      e.preventDefault();
      await api.logout();
      window.location.reload();
    });
  }

  showLogin() {
    ui.showAuth();
    ui.authWrapper.innerHTML = AuthView;
    let mode = 'login';
    
    const btnText = document.getElementById('auth-submit-btn');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    const toggleText = document.getElementById('auth-toggle-text');

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      mode = mode === 'login' ? 'register' : 'login';
      btnText.innerText = mode === 'login' ? 'Login' : 'Register';
      toggleText.innerHTML = mode === 'login' 
        ? `Don't have an account? <a href="#" id="auth-toggle-btn">Register</a>` 
        : `Already have an account? <a href="#" id="auth-toggle-btn">Login</a>`;
    });

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('auth-user').value;
      const p = document.getElementById('auth-pass').value;
      try {
        if(mode === 'login') {
          const res = await api.login(u, p);
          this.user = res.user;
        } else {
          const res = await api.register(u, p);
          this.user = res.user;
          ui.toast('Registration successful! Waiting for approval.', 'success');
        }
        
        if (!this.user.is_approved && this.user.role !== 'admin') {
          this.showAccessDenied();
        } else {
          this.startMainApp();
        }
      } catch(err) {
        ui.toast(err.message, 'error');
      }
    });
  }

  async startMainApp() {
    ui.showApp();
    
    try {
        const profileInfo = await api.req('/profile');
        this.updateProfileHeader(profileInfo);
    } catch(e) {}
    
    if (this.user.role === 'admin') {
      document.getElementById('admin-panel-btn').style.display = 'block';
    }

    ui.toast('Initializing catalog...', 'success');
    await this.refreshUserData();
    this.navigate('home');
  }

  updateProfileHeader(profile) {
      document.getElementById('profile-name').innerText = profile.display_name || profile.username;
      
      const avatarEl = document.getElementById('profile-avatar');
      const iconEl = document.getElementById('profile-icon');
      if (profile.avatar_url) {
          avatarEl.src = profile.avatar_url;
          avatarEl.style.display = 'block';
          iconEl.style.display = 'none';
      } else {
          avatarEl.style.display = 'none';
          iconEl.style.display = 'block';
      }
  }

  async refreshUserData() {
      try {
          const favs = await api.getFavorites();
          this.favorites = new Set(favs.favorites.map(f => f.item_id));
          const pls = await api.getPlaylists();
          this.playlists = pls.playlists || [];
          this.renderSidebarPlaylists();
      } catch(e) {}
  }
  
  async renderSidebarPlaylists() {
      const plContainer = document.getElementById('playlist-list');
      plContainer.innerHTML = '';
      
      const likedLi = document.createElement('li');
      likedLi.dataset.route = 'favorites';
      likedLi.innerHTML = `
        <div style="width: 40px; height: 40px; border-radius: 4px; background: linear-gradient(135deg, #450af5, #c4efd9); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
            <i class="fa-solid fa-heart" style="color: white; font-size: 16px;"></i>
        </div>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">Liked Songs</span>
      `;
      likedLi.onclick = () => { this.renderFavoritesView(); this.setActiveNav('favorites'); };
      plContainer.appendChild(likedLi);

      const downLi = document.createElement('li');
      downLi.dataset.route = 'downloads';
      downLi.innerHTML = `
        <div style="width: 40px; height: 40px; border-radius: 4px; background: #282828; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="fa-solid fa-arrow-down" style="color: white; font-size: 16px;"></i>
        </div>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">Downloads</span>
      `;
      downLi.onclick = () => { this.renderDownloadsView(); this.setActiveNav('downloads'); };
      plContainer.appendChild(downLi);

      if(!this.playlists || !this.playlists.length) {
          const emptyDiv = document.createElement('div');
          emptyDiv.style.cssText = "padding: 20px 16px; text-align: center; margin-top: 10px;";
          emptyDiv.innerHTML = `
              <p style="color:var(--text-secondary); font-size:14px; margin-bottom:12px;">Create your first playlist</p>
              <button class="btn-outline" style="padding: 6px 16px; font-size:13px; width:100%; border-radius:30px;" onclick="document.getElementById('create-playlist-btn').click()">Create</button>
          `;
          plContainer.appendChild(emptyDiv);
      } else {
          for (const pl of this.playlists) {
              const li = document.createElement('li');
              li.dataset.route = `playlist-${pl.id}`;
              
              const colors = [['#1db954', '#19e68c'], ['#e91e63', '#ff6090'], ['#9c27b0', '#d05ce3'], ['#ff9800', '#ffc107'], ['#00bcd4', '#4dd0e1']];
              const cidx = (pl.name || 'P').length % colors.length;
              const fallbackSvg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><linearGradient id='gf' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='${colors[cidx][0]}'/><stop offset='100%' stop-color='${colors[cidx][1]}'/></linearGradient></defs><rect fill='url(#gf)' width='100' height='100'/><text x='50' y='60' font-family='sans-serif' font-size='40' font-weight='700' fill='#ffffff' text-anchor='middle'>${(pl.name||'').charAt(0).toUpperCase()}</text></svg>`);
              const imgUrl = pl.cover_url || `data:image/svg+xml;utf8,${fallbackSvg}`;
              
              // Check if all tracks in playlist are downloaded (optional/advanced, but let's at least show a badge if the playlist is marked as downloaded in our local metadata)
              const isDownloaded = localStorage.getItem(`pl_downloaded_${pl.id}`) === 'true';

              li.innerHTML = `
                <img src="${imgUrl}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${pl.name}</span>
                ${isDownloaded ? '<i class="fa-solid fa-circle-check sidebar-downloaded"></i>' : ''}
              `;
              li.onclick = () => { this.renderPlaylistView(pl); this.setActiveNav(`playlist-${pl.id}`); };
              li.oncontextmenu = (e) => {
                  e.preventDefault();
                  this.showPlaylistContextMenu(e, pl);
              };
              plContainer.appendChild(li);
          }
      }
  }

  setActiveNav(route) {
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    const activeLink = document.querySelector(`[data-route="${route}"]`);
    if(activeLink) activeLink.classList.add('active');
  }
  
  async toggleLike(track) {
      try {
          if (this.favorites.has(track.Id)) {
              await api.removeFavorite(track.Id);
              this.favorites.delete(track.Id);
              ui.toast('Removed from Liked Songs');
          } else {
              await api.addFavorite(track.Id, 'Audio', track.Name);
              this.favorites.add(track.Id);
              ui.toast('Added to Liked Songs', 'success');
          }
          this.updatePlayerUI({ isPlaying: player.isPlaying, track: player.currentTrack(), currentTime: player.audio.currentTime, duration: player.audio.duration, queue: player.queue, currentIndex: player.currentIndex, isShuffling: player.isShuffling, isRepeating: player.isRepeating });
      } catch(e) {}
  }

  async toggleFavorite(trackId) {
      // Lightweight wrapper so ui.renderSongRow's like button works
      const fakeTrack = { Id: trackId, Name: '' };
      // We only need the toggle logic - reuse toggleLike's core
      try {
          if (this.favorites.has(trackId)) {
              await api.removeFavorite(trackId);
              this.favorites.delete(trackId);
          } else {
              await api.addFavorite(trackId, 'Audio', '');
              this.favorites.add(trackId);
          }
      } catch(e) {}
  }

  async downloadTrack(song) {
     ui.toast(`Downloading ${song.Name}...`);
     try {
         const res = await fetch(await api.getDirectStreamUrl(song.Id), { credentials: 'include' });
         if (!res.ok) throw new Error(`Stream error: ${res.status}`);
         const blob = await res.blob();
         await storage.put('blobs', song.Id, blob);

         const artRes = await fetch(api.getArtworkUrl(song.Id), { credentials: 'include' });
         if (artRes.ok) {
            const artBlob = await artRes.blob();
            await storage.put('artwork', song.Id, artBlob);
         }
         
         await storage.put('tracks', null, { ...song, id: song.Id });
         ui.toast(`Downloaded ${song.Name}`, 'success');
     } catch(e) {
         ui.toast(`Failed to download ${song.Name}`, 'error');
     }
  }

  async buildSongMenu(song) {
      const plMenus = this.playlists.map(pl => {
          return { label: `Add to ${pl.name}`, icon: 'fa-solid fa-plus', action: async () => {
              await api.addPlaylistTrack(pl.id, song.Id, song.Name);
              ui.toast('Added to playlist', 'success');
          }};
      });
      
      const isDownloaded = await storage.isDownloaded(song.Id);
      const dlMenu = isDownloaded ? 
          { label: 'Remove Download', icon: 'fa-solid fa-trash', action: async () => { await storage.delete('blobs', song.Id); await storage.delete('tracks', song.Id); ui.toast('Removed download'); } } :
          { label: 'Download', icon: 'fa-solid fa-download', action: () => this.downloadTrack(song) };

      return [
          { label: 'Play Now', icon: 'fa-solid fa-play', action: () => player.playTrack(song) },
          { label: 'Play Next', icon: 'fa-solid fa-step-forward', action: () => { player.playNext(song); ui.toast('Added to play next'); } },
          { label: 'Add to end of Queue', icon: 'fa-solid fa-bars-staggered', action: () => { player.addToQueue(song); ui.toast('Added to queue'); } },
          { divider: true },
          { label: this.favorites.has(song.Id) ? 'Unlike Song' : 'Like Song', icon: this.favorites.has(song.Id) ? 'fa-solid fa-heart' : 'fa-regular fa-heart', action: () => this.toggleLike(song) },
          dlMenu,
          { divider: true },
          ...plMenus,
          { divider: true },
          { label: 'Go to Album', icon: 'fa-solid fa-record-vinyl', action: () => { if(song.AlbumId) this.renderAlbumView({ Id: song.AlbumId, Name: song.Album }); } },
          { label: 'Go to Artist', icon: 'fa-solid fa-user', action: () => { if(song.ArtistItems?.length) this.renderArtistView(song.ArtistItems[0].Id); else if(song.Artists?.length) ui.toast("Artist details not attached", "error"); } }
      ];
  }

  navigate(route) {
    this.currentRoute = route;
    this.setActiveNav(route);

    if (route === 'home') this.renderHome();
    else if (route === 'search') this.renderSearch();
    else if (route === 'library') this.renderLibrary();
    else if (route === 'profile') this.renderProfile();
    else if (route === 'admin') this.renderAdmin();
  }

  showPlaylistContextMenu(e, playlist) {
      const isOwner = !playlist.creator_name || playlist.creator_name === this.user.username;
      const isDownloaded = localStorage.getItem(`pl_downloaded_${playlist.id}`) === 'true';

      const items = [
          { label: 'Play', icon: 'fa-solid fa-play', action: () => {
              this.renderPlaylistView(playlist); // navigate to it first
              setTimeout(() => document.getElementById('pl-play-btn')?.click(), 100);
          } },
          { label: 'Shuffle', icon: 'fa-solid fa-shuffle', action: () => {
              this.renderPlaylistView(playlist);
              setTimeout(() => document.getElementById('pl-shuffle-btn')?.click(), 100);
          } },
          { divider: true },
          { label: isDownloaded ? 'Remove Download' : 'Download', icon: 'fa-solid fa-arrow-down-circle', action: () => this.downloadPlaylist(playlist) },
      ];

      if (isOwner) {
          items.push(
              { divider: true },
              { label: 'Rename', icon: 'fa-solid fa-font', action: async () => {
                  const newName = prompt('Enter new playlist name:', playlist.name);
                  if (newName && newName !== playlist.name) {
                      await api.updatePlaylist(playlist.id, { name: newName });
                      await this.refreshUserData();
                      this.renderPlaylistView({ ...playlist, name: newName });
                  }
              } },
              { label: playlist.is_public ? 'Make Private' : 'Make Public', icon: playlist.is_public ? 'fa-solid fa-lock' : 'fa-solid fa-globe', action: async () => {
                  await api.updatePlaylist(playlist.id, { is_public: !playlist.is_public });
                  await this.refreshUserData();
                  this.renderPlaylistView({ ...playlist, is_public: !playlist.is_public });
              } },
              { label: 'Delete Playlist', icon: 'fa-solid fa-trash', action: async () => {
                  if(confirm('Are you absolutely sure you want to delete this playlist?')) {
                      await api.deletePlaylist(playlist.id);
                      await this.refreshUserData();
                      this.navigate('home');
                  }
              } }
          );
      }

      ui.showContextMenu(e.clientX, e.clientY, items);
  }

  async downloadPlaylist(playlist) {
      try {
          ui.toast(`Starting download: ${playlist.name}...`);
          const req = await api.getPlaylistTracks(playlist.id);
          const tracks = req.tracks || [];
          if(!tracks.length) return ui.toast('Playlist is empty.');

          const ids = tracks.map(t => t.track_id);
          const metaReq = await api.getItems(ids);
          const metaMap = {};
          (metaReq.items || []).forEach(m => metaMap[m.Id] = m);

          let downloaded = 0;
          for (const t of tracks) {
              const metadata = metaMap[t.track_id];
              if(!metadata) continue;

              const isCached = await storage.isDownloaded(metadata.Id);
              if(!isCached) {
                  ui.toast(`Downloading: ${metadata.Name}...`, 'info');
                  const streamUrl = await api.getDirectStreamUrl(metadata.Id);
                  const fetchOpts = { credentials: 'include' };
                  const token = localStorage.getItem('jw_token');
                  if (token) fetchOpts.headers = { 'Authorization': `Bearer ${token}` };
                  const resp = await fetch(streamUrl, fetchOpts);
                  if (!resp.ok) throw new Error(`Stream error: ${resp.status}`);
                  const blob = await resp.blob();
                  
                  // Store metadata (ensure 'id' field matches IndexedDB keyPath)
                  await storage.put('tracks', metadata.Id, { ...metadata, id: metadata.Id });
                  // Store blob
                  await storage.put('blobs', metadata.Id, blob);
                  
                  // Store artwork if exists
                  if(metadata.ImageTags?.Primary) {
                      const artUrl = api.getArtworkUrl(metadata.Id);
                      const artResp = await fetch(artUrl, fetchOpts);
                      if (artResp.ok) {
                          const artBlob = await artResp.blob();
                          await storage.put('artwork', metadata.Id, artBlob);
                      }
                  }
              }
              downloaded++;
          }

          localStorage.setItem(`pl_downloaded_${playlist.id}`, 'true');
          ui.toast(`Finished downloading ${playlist.name} (${downloaded} tracks).`);
          this.renderSidebarPlaylists();
          const currentHeader = document.getElementById('pl-header-download-btn');
          if(currentHeader) currentHeader.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
      } catch(e) {
          console.error(e);
          ui.toast('Failed to download playlist fully.', 'error');
      }
  }

  async renderHome() {
    const hours = new Date().getHours();
    let greeting = 'Good evening';
    if(hours < 12) greeting = 'Good morning';
    else if(hours < 17) greeting = 'Good afternoon';

    ui.renderView(`
      <h1 class="view-title">${greeting}</h1>
      
      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 24px;">Discover Playlists</h2>
      <div id="home-playlists" class="grid-container" style="margin-bottom: 48px;"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>

      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 24px;">Top Artists</h2>
      <div id="home-artists" class="grid-container" style="margin-bottom: 48px;"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>
      
      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 24px;">Featured Albums</h2>
      <div id="home-albums" class="grid-container"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>
    `);

    try {
      api.getPublicPlaylists().then(res => {
          const c = document.getElementById('home-playlists');
          c.innerHTML = '';
          if(!res.playlists || !res.playlists.length) {
              c.innerHTML = '<p class="text-secondary">No public playlists found. Create one and share it!</p>';
              return;
          }
          res.playlists.slice(0, 5).forEach(pl => {
              const card = document.createElement('div');
              card.className = 'card';
              const colors = [['#1db954', '#19e68c'], ['#e91e63', '#ff6090'], ['#9c27b0', '#d05ce3'], ['#ff9800', '#ffc107'], ['#00bcd4', '#4dd0e1']];
              const cidx = (pl.name || 'P').length % colors.length;
              const fallbackSvg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='gf' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='${colors[cidx][0]}'/><stop offset='100%' stop-color='${colors[cidx][1]}'/></linearGradient></defs><rect fill='url(#gf)' width='200' height='200'/><text x='100' y='110' font-family='sans-serif' font-size='80' font-weight='700' fill='#ffffff' text-anchor='middle'>${(pl.name||'').charAt(0).toUpperCase()}</text></svg>`);
              const imgUrl = pl.cover_url || `data:image/svg+xml;utf8,${fallbackSvg}`;
              card.innerHTML = `
                <img src="${imgUrl}" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.4);">
                <div class="card-play-btn"><i class="fa-solid fa-play"></i></div>
                <div class="title">${pl.name}</div>
                <div class="subtitle">By ${pl.creator_name}</div>
              `;
              card.onclick = () => this.renderPlaylistView(pl);
              c.appendChild(card);
          });
      }).catch(e => { document.getElementById('home-playlists').innerHTML = '<p class="text-secondary">Error loading playlists.</p>'; });

      api.getArtists().then(artRes => {
          const artistsContainer = document.getElementById('home-artists');
          artistsContainer.innerHTML = '';
          artRes.artists?.slice(0, 5).forEach(art => {
            artistsContainer.appendChild(ui.renderCard(art, () => this.renderArtistView(art.Id)));
          });
      });

      api.getAlbums().then(albRes => {
          const albumsContainer = document.getElementById('home-albums');
          albumsContainer.innerHTML = '';
          albRes.albums?.slice(0, 10).forEach(alb => {
            albumsContainer.appendChild(ui.renderCard(alb, () => this.renderAlbumView(alb)));
          });
      });
    } catch(e) {}
  }

  async renderSearch() {
    ui.renderView(`
      <h1 class="view-title">Search</h1>
      <input type="text" id="search-input" placeholder="What do you want to play?">
      
      <div id="search-results" style="display:none;">
        <h3 style="margin-bottom: 20px;">Top Results</h3>
        <div id="search-songs" class="list-view" style="margin-bottom:30px;"></div>
        <h3 style="margin-bottom: 20px;">Artists</h3>
        <div id="search-artists" class="grid-container"></div>
        <h3 style="margin-bottom: 20px;">Albums</h3>
        <div id="search-albums" class="grid-container"></div>
      </div>
    `);

    let dsTimer = null;
    document.getElementById('search-input').addEventListener('input', (e) => {
      clearTimeout(dsTimer);
      const query = e.target.value;
      if(query.length < 2) {
        document.getElementById('search-results').style.display = 'none';
        return;
      }
      dsTimer = setTimeout(async () => {
         const res = await api.search(query);
         document.getElementById('search-results').style.display = 'block';
         
         const sc = document.getElementById('search-songs');
         sc.innerHTML = '<div class="list-header"><div>#</div><div>Title</div><div>Artist</div><div>Time</div></div>';
         res.songs?.slice(0, 5).forEach((s, idx) => sc.appendChild(ui.renderSongRow(s, idx, () => player.playTrack(s, res.songs), (ev, song) => this.buildSongMenu(song).then(menu => ui.showContextMenu(ev.clientX, ev.clientY, menu)))));

         const ac = document.getElementById('search-artists');
         ac.innerHTML = '';
         res.artists?.slice(0, 5).forEach(art => ac.appendChild(ui.renderCard(art, () => this.renderArtistView(art.Id))));

         const alc = document.getElementById('search-albums');
         alc.innerHTML = '';
         res.albums?.slice(0, 5).forEach(alb => alc.appendChild(ui.renderCard(alb, () => this.renderAlbumView(alb))));
      }, 500);
    });
  }

  async renderLibrary() {
    ui.renderView(`
      <h1 class="view-title">Your Library</h1>
      
      <div style="display:flex; gap:20px; margin-bottom:40px;">
          <div class="card" style="flex:1; background: linear-gradient(135deg, #450af5, #c4efd9); justify-content:flex-end;" onclick="app.renderFavoritesView()">
              <h2 style="font-size:32px; margin-top:40px; text-shadow: 0 4px 10px rgba(0,0,0,0.5);">Liked Songs</h2>
              <p style="margin-top:10px;">${this.favorites.size} liked tracks</p>
          </div>
      </div>

      <h3 style="margin-bottom: 20px;"><i class="fa-solid fa-clock-rotate-left"></i> Recently Played</h3>
      <div id="lib-recent" class="list-view" style="margin-bottom:30px;"><p class="text-secondary">Explore music to see recent history.</p></div>
    `);
    
    try {
        const recentReq = await api.getRecent();
        if(recentReq.recent.length > 0) {
            const rc = document.getElementById('lib-recent');
            rc.innerHTML = '';
            recentReq.recent.forEach((r, idx) => {
                const el = document.createElement('div');
                el.className = 'list-item';
                el.innerHTML = `
                    <div class="col-num"><span class="col-num-text">${idx + 1}</span><i class="fa-solid fa-play col-num-play"></i></div>
                    <div class="col-title">${r.name}</div>
                    <div class="col-artist">Recently Played</div>
                    <div class="col-time"></div>
                `;
                el.onclick = () => ui.toast('Browsing recent catalog tracks is pending integration.');
                rc.appendChild(el);
            });
        }
    } catch(e) {}
  }
  
  async renderFavoritesView() {
      ui.renderView(`
        <div style="display:flex; flex-direction:column; background: linear-gradient(180deg, rgba(69,10,245,0.2) 0%, transparent 240px);">
          <div style="padding: 24px 0; display:flex; gap:24px; align-items:flex-end;">
            <div style="width:192px; height:192px; border-radius:4px; background: linear-gradient(135deg, #450af5, #c4efd9); box-shadow: 0 8px 24px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fa-solid fa-heart" style="font-size:72px; color:white;"></i>
            </div>
            <div style="display:flex; flex-direction:column; justify-content:flex-end;">
              <h5 style="color:white; text-transform:uppercase; font-size:12px; font-weight:700; letter-spacing:1px; margin-bottom:8px;">Playlist</h5>
              <h1 style="font-size:64px; font-weight:900; letter-spacing:-2px; margin: 0 0 12px 0; line-height:1;">Liked Songs</h1>
              <div style="display:flex; align-items:center; gap:8px;">
                 ${this.user.avatar_url ? `<img src="${this.user.avatar_url}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">` : `<i class="fa-solid fa-circle-user" style="font-size:24px; color:var(--text-secondary);"></i>`}
                 <span style="color:white; font-weight:700; font-size:14px;">${this.user.display_name || this.user.username}</span>
                 <span style="color:var(--text-secondary); font-size:14px;"> • ${this.favorites.size} songs</span>
              </div>
            </div>
          </div>
          <div style="padding: 16px 0; display:flex; align-items:center; gap:24px;">
              <button class="play-circle" style="width:52px; height:52px; font-size:22px; background:#1db954 !important; color:black !important; border:none; cursor:pointer;" id="play-favs-btn"><i class="fa-solid fa-play"></i></button>
          </div>
        </div>
        <div class="playlist-page-wrapper">
          <div class="playlist-content-bg"></div>
          <div class="list-view">
            <div class="list-header"><div>#</div><div>Title</div><div>Artist</div><div style="text-align:right;">Time</div></div>
            <div id="fav-songs">
                 <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
                 <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
            </div>
          </div>
        </div>
      `);
      
      const container = document.getElementById('fav-songs');
      
      try {
          const favIds = Array.from(this.favorites);
          if (favIds.length === 0) {
              container.innerHTML = "<p class='text-secondary' style='padding:16px;'>You haven't liked any songs yet!</p>";
              return;
          }
          
          const res = await api.getItems(favIds);
          const favTracks = res.items || [];
          container.innerHTML = '';
          
          if(favTracks.length) {
              favTracks.forEach((s, idx) => {
                  container.appendChild(ui.renderSongRow(s, idx, () => player.playTrack(s, favTracks), (ev, song) => this.buildSongMenu(song).then(menu => ui.showContextMenu(ev.clientX, ev.clientY, menu))));
              });
              document.getElementById('play-favs-btn').onclick = () => player.playTrack(favTracks[0], favTracks);
          } else {
              container.innerHTML = '<p class="text-secondary" style="padding:16px;">Failed to fetch tracks. They may be missing from the server.</p>';
          }
      } catch(e) { container.innerHTML = '<p class="text-secondary">Failed to load favorites.</p>'; }
  }
  
  async renderDownloadsView() {
      ui.renderView(`
        <div style="display:flex; flex-direction:column; background: linear-gradient(180deg, rgba(29,185,84,0.1) 0%, transparent 240px);">
          <div style="padding: 24px 0; display:flex; gap:24px; align-items:flex-end;">
            <div style="width:192px; height:192px; border-radius:4px; background: linear-gradient(135deg, #1db954, #191414); box-shadow: 0 8px 24px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fa-solid fa-download" style="font-size:72px; color:white;"></i>
            </div>
            <div style="display:flex; flex-direction:column; justify-content:flex-end;">
              <h5 style="color:white; text-transform:uppercase; font-size:12px; font-weight:700; letter-spacing:1px; margin-bottom:8px;">Local Library</h5>
              <h1 style="font-size:64px; font-weight:900; letter-spacing:-1px; margin: 0 0 12px 0;">Downloads</h1>
              <p style="color:var(--text-secondary); font-size:14px;">Available for offline listening</p>
            </div>
          </div>
          <div style="padding: 16px 0; display:flex; align-items:center; gap:24px;">
              <button class="play-circle" style="width:52px; height:52px; font-size:22px; background:#1db954 !important; border:none; color:black !important; cursor:pointer;" id="play-down-btn"><i class="fa-solid fa-play"></i></button>
          </div>
        </div>
        <div class="playlist-page-wrapper">
          <div class="playlist-content-bg"></div>
          <div class="list-view">
            <div class="list-header"><div>#</div><div>Title</div><div>Artist</div><div style="text-align:right;">Time</div></div>
            <div id="down-songs">
                 <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
                 <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
            </div>
          </div>
        </div>
      `);
      
      const container = document.getElementById('down-songs');
      try {
          const downTracks = await storage.getAll('tracks');
          container.innerHTML = '';
          if(downTracks.length) {
              downTracks.forEach((s, idx) => {
                  container.appendChild(ui.renderSongRow(s, idx, () => player.playTrack(s, downTracks), (ev, song) => this.buildSongMenu(song).then(menu => ui.showContextMenu(ev.clientX, ev.clientY, menu))));
              });
              document.getElementById('play-down-btn').onclick = () => player.playTrack(downTracks[0], downTracks);
          } else {
              container.innerHTML = '<p class="text-secondary" style="padding:16px;">No downloaded tracks.</p>';
          }
      } catch(e) { container.innerHTML = '<p class="text-secondary">Failed to load downloads.</p>'; }
  }

  async renderPlaylistView(playlistMeta) {
      const colors = [['#1db954', '#19e68c'], ['#e91e63', '#ff6090'], ['#9c27b0', '#d05ce3'], ['#ff9800', '#ffc107'], ['#00bcd4', '#4dd0e1']];
      const cidx = (playlistMeta.name || 'P').length % colors.length;
      const fallbackSvg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><defs><linearGradient id='gf' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='${colors[cidx][0]}'/><stop offset='100%' stop-color='${colors[cidx][1]}'/></linearGradient></defs><rect fill='url(#gf)' width='400' height='400'/><text x='200' y='220' font-family='sans-serif' font-size='160' font-weight='700' fill='#ffffff' text-anchor='middle'>${(playlistMeta.name||'').charAt(0).toUpperCase()}</text></svg>`);
      const imgUrl = playlistMeta.cover_url || `data:image/svg+xml;utf8,${fallbackSvg}`;

      const creatorName = playlistMeta.creator_display || playlistMeta.creator_name || this.user.username;
      const avatarHtml = playlistMeta.creator_avatar ? `<img src="${playlistMeta.creator_avatar}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;">` : `<i class="fa-solid fa-circle-user" style="font-size:28px; color:var(--text-secondary);"></i>`;

      const isDownloaded = localStorage.getItem(`pl_downloaded_${playlistMeta.id}`) === 'true';

      ui.renderView(`
        <div style="display:flex; flex-direction:column; background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 240px);">
          <div style="padding: 24px 0; display:flex; gap:24px; align-items:flex-end;">
            <img src="${imgUrl}" style="width:192px; height:192px; border-radius:4px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); object-fit:cover; flex-shrink:0;">
            <div style="display:flex; flex-direction:column; justify-content:flex-end;">
              <h5 style="color:white; text-transform:uppercase; font-size:12px; font-weight:700; letter-spacing:1px; margin-bottom:8px;">${playlistMeta.is_public ? 'Public Playlist' : 'Playlist'}</h5>
              <h1 style="font-size:64px; font-weight:900; letter-spacing:-2px; margin: 0 0 12px 0; line-height:1;">${playlistMeta.name}</h1>
              ${playlistMeta.description ? `<p style="color:var(--text-secondary); font-size:14px; margin-bottom:10px;">${playlistMeta.description}</p>` : ''}
              <div style="display:flex; align-items:center; gap:8px;">
                 ${avatarHtml}
                 <span style="color:white; font-weight:700; font-size:14px;">${creatorName}</span>
                 <span style="color:var(--text-secondary); font-size:14px;" id="pl-song-count"> • Loading tracks...</span>
              </div>
            </div>
          </div>
          <div style="padding: 24px 0 16px; display:flex; align-items:center; gap:28px;">
              <button class="play-circle" style="width:56px; height:56px; font-size:24px; background:#1db954 !important; border:none; color:black !important; cursor:pointer; margin:0; box-shadow: 0 8px 24px rgba(0,0,0,0.5);" id="pl-play-btn"><i class="fa-solid fa-play"></i></button>
              <button style="background:none; border:none; color:var(--text-secondary); font-size:28px; cursor:pointer; transition:color 0.2s;" title="Shuffle" id="pl-shuffle-btn" onmouseover="this.style.color='white'" onmouseout="this.style.color='var(--text-secondary)'"><i class="fa-solid fa-shuffle"></i></button>
              <button style="background:none; border:none; color:${isDownloaded ? '#1db954' : 'var(--text-secondary)'}; font-size:22px; cursor:pointer; transition:all 0.2s;" title="Download" id="pl-header-download-btn" onmouseover="this.style.color='white'" onmouseout="this.style.color='${isDownloaded ? '#1db954' : 'var(--text-secondary)'}'"><i class="fa-solid ${isDownloaded ? 'fa-circle-check' : 'fa-arrow-down-long'}"></i></button>
              ${(playlistMeta.creator_name && playlistMeta.creator_name !== this.user.username) ? '' : `<button style="background:none; border:none; color:var(--text-secondary); font-size:22px; cursor:pointer; transition:color 0.2s;" title="More Options" id="pl-opts-btn" onmouseover="this.style.color='white'" onmouseout="this.style.color='var(--text-secondary)'"><i class="fa-solid fa-ellipsis"></i></button>`}
          </div>
        </div>
        <div class="playlist-page-wrapper">
          <div class="playlist-content-bg"></div>
          <div class="list-view">
            <div class="list-header"><div>#</div><div>Title</div><div>Artist</div><div style="text-align:right;">Time</div></div>
            <div id="pl-songs">
                 <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
                 <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
            </div>
          </div>
        </div>
      `);
      
      const optsBtn = document.getElementById('pl-opts-btn');
      if (optsBtn) {
          optsBtn.addEventListener('click', (e) => this.showPlaylistContextMenu(e, playlistMeta));
      }
      
      const dlBtn = document.getElementById('pl-header-download-btn');
      if(dlBtn) {
          dlBtn.onclick = () => this.downloadPlaylist(playlistMeta);
      }
      
      try {
          const req = await api.getPlaylistTracks(playlistMeta.id);
          const tracksData = req.tracks || [];
          const container = document.getElementById('pl-songs');
          container.innerHTML = '';
          
          if(!tracksData.length) {
              document.getElementById('pl-song-count').innerText = ` • 0 songs, 0 min`;
              container.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 60px 0; text-align:center;">
                    <i class="fa-solid fa-music" style="font-size:48px; color:var(--text-secondary); margin-bottom:20px;"></i>
                    <h3 style="font-size:24px; font-weight:700; margin-bottom:10px; color:white;">It's a bit empty here...</h3>
                    <p style="color:var(--text-secondary); margin-bottom:24px; font-size:16px;">Let's find some songs for your playlist.</p>
                    <button class="btn-primary" style="padding: 12px 32px; border-radius: 32px; font-weight:bold; font-size:16px;" onclick="app.navigate('search')">Find songs</button>
                </div>
              `;
          } else {
             // Since backend maps track records statically, fetch absolute metadata from mapped track_ids
             const ids = tracksData.map(t => t.track_id);
             const metaReq = await api.getItems(ids);
             const metaMap = {};
             (metaReq.items || []).forEach(m => metaMap[m.Id] = m);

             const finalTracks = [];
             let totalTicks = 0;

             tracksData.forEach((t, idx) => {
                 const metadata = metaMap[t.track_id];
                 if(metadata) {
                     finalTracks.push(metadata);
                     totalTicks += (metadata.RunTimeTicks || 0);
                 }
                 
                 const row = document.createElement('div');
                 row.className = 'list-item';
                 if(metadata) row.dataset.trackId = metadata.Id;
                 const delPerms = playlistMeta.creator_name && playlistMeta.creator_name !== this.user.username ? 'none' : 'block';
                 const isLiked = metadata && this.favorites.has(metadata.Id);
                 row.innerHTML = `
                    <div class="col-num">
                        <span class="col-num-text">${idx+1}</span>
                        <i class="fa-solid fa-play col-num-play"></i>
                        <div class="col-num-eq"><span></span><span></span><span></span><span></span></div>
                    </div>
                    <div class="col-title">${t.title}</div>
                    <div class="col-artist">${metadata ? metadata.Artists?.join(', ') : 'Unknown'}</div>
                    <div class="col-time">
                        <button class="row-like-btn row-actions ${isLiked ? 'liked' : ''}" aria-label="Like"><i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i></button>
                        <span>${ui.formatTime((metadata?.RunTimeTicks||0)/10000000)}</span>
                        <button class="queue-action-btn rm-pl-trk row-actions" style="color:#e22134; display:${delPerms};"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                 `;
                 
                 const rmBtn = row.querySelector('.rm-pl-trk');
                 if(rmBtn) {
                     rmBtn.onclick = async (e) => {
                         e.stopPropagation();
                         await api.removePlaylistTrack(playlistMeta.id, t.track_id);
                         this.renderPlaylistView(playlistMeta); 
                     };
                 }

                 // Like button handler
                 const likeBtn = row.querySelector('.row-like-btn');
                 if(likeBtn && metadata) {
                     likeBtn.onclick = async (e) => {
                         e.stopPropagation();
                         await this.toggleFavorite(metadata.Id);
                         const nowLiked = this.favorites.has(metadata.Id);
                         likeBtn.className = `row-like-btn row-actions ${nowLiked ? 'liked' : ''}`;
                         likeBtn.innerHTML = `<i class="fa-${nowLiked ? 'solid' : 'regular'} fa-heart"></i>`;
                     };
                 }
                 
                 row.onclick = (e) => {
                     if(e.target.closest('.row-like-btn') || e.target.closest('.rm-pl-trk')) return;
                     if(metadata) player.playTrack(metadata, finalTracks);
                 };
                 row.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if(metadata) this.buildSongMenu(metadata).then(menu => ui.showContextMenu(e.clientX, e.clientY, menu));
                 });
                 container.appendChild(row);
             });
             
             const totalMs = totalTicks / 10000;
             const totalMins = Math.floor(totalMs / 60000);
             const hrs = Math.floor(totalMins / 60);
             const mins = totalMins % 60;
             const timeStr = hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
             
             document.getElementById('pl-song-count').innerText = ` • ${finalTracks.length} songs, ${timeStr}`;
             document.getElementById('pl-play-btn').onclick = () => { if(finalTracks.length) player.playTrack(finalTracks[0], finalTracks); };
             document.getElementById('pl-shuffle-btn').onclick = () => {
                 if(finalTracks.length) {
                     const shuffled = [...finalTracks].sort(() => Math.random() - 0.5);
                     player.playTrack(shuffled[0], shuffled);
                 }
             };
          }
      } catch(e) {
          document.getElementById('pl-songs').innerHTML = '<p class="text-secondary">Failed to load tracks.</p>';
      }
  }

  async renderArtistView(artistId) {
      ui.renderView(`
        <button class="btn-outline" style="margin-bottom: 20px;" onclick="app.navigate('home')"><i class="fa-solid fa-arrow-left"></i> Back</button>
        <div id="artist-header">
            <div class="skeleton-card" style="height:300px; width:100%; border-radius:8px; margin-bottom:30px;"></div>
        </div>
        <div style="display:flex; gap:30px; margin-bottom: 30px;">
           <button class="play-circle" style="width:50px; height:50px; font-size:20px; cursor:pointer;" id="play-artist-btn"><i class="fa-solid fa-play"></i></button>
        </div>
        <h3 style="margin-bottom: 20px;">Popular</h3>
        <div class="list-view" style="margin-bottom:40px;">
          <div class="list-header"><div>#</div><div>Title</div><div>Album</div><div>Time</div></div>
          <div id="artist-songs">
             <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
             <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
          </div>
        </div>
        <h3 style="margin-bottom: 20px;">Albums</h3>
        <div id="artist-albums" class="grid-container">
            <div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>
        </div>
      `);
      
      try {
          const [artistRes, songsRes, albRes] = await Promise.all([
              api.getArtist(artistId),
              api.getSongs(null, artistId),
              api.getAlbums(artistId)
          ]);

          if (artistRes && artistRes.artist) {
              const artist = artistRes.artist;
              const bgUrl = api.getArtworkUrl(artistId);
              document.getElementById('artist-header').innerHTML = `
                <div style="height: 300px; background: linear-gradient(transparent, var(--bg-base)), url('${bgUrl}') center/cover; border-radius:8px; display:flex; align-items:flex-end; padding:40px; margin-bottom: 30px; box-shadow: inset 0 -100px 100px -20px var(--bg-base);">
                    <h1 style="font-size:72px; text-shadow: 0 4px 20px rgba(0,0,0,0.8);">${artist.Name}</h1>
                </div>
              `;
          }

          const topSongs = songsRes.songs || [];
          const sc = document.getElementById('artist-songs');
          sc.innerHTML = '';
          if(topSongs.length) {
              topSongs.slice(0, 5).forEach((s, idx) => {
                  sc.appendChild(ui.renderSongRow(s, idx, () => player.playTrack(s, topSongs), (ev, song) => this.buildSongMenu(song).then(menu => ui.showContextMenu(ev.clientX, ev.clientY, menu))));
              });
              document.getElementById('play-artist-btn').onclick = () => player.playTrack(topSongs[0], topSongs);
          } else {
              sc.innerHTML = '<p class="text-secondary" style="padding:16px;">No popular tracks found.</p>';
          }

          if(topSongs.length > 5) {
              const allTracksEl = document.createElement('div');
              allTracksEl.innerHTML = `
                <h3 style="margin-top: 40px; margin-bottom: 20px;">All Tracks</h3>
                <div class="list-view" style="margin-bottom:40px;">
                  <div class="list-header"><div>#</div><div>Title</div><div>Album</div><div>Time</div></div>
                  <div id="artist-all-songs"></div>
                </div>
              `;
              document.getElementById('artist-albums').parentNode.insertBefore(allTracksEl, document.getElementById('artist-albums').previousElementSibling);
              const allSc = document.getElementById('artist-all-songs');
              topSongs.slice(5).forEach((s, idx) => {
                  allSc.appendChild(ui.renderSongRow(s, idx + 5, () => player.playTrack(s, topSongs), (ev, song) => this.buildSongMenu(song).then(menu => ui.showContextMenu(ev.clientX, ev.clientY, menu))));
              });
          }
          const ac = document.getElementById('artist-albums');
          ac.innerHTML = '';
          if(albRes.albums?.length) {
              albRes.albums.forEach(alb => ac.appendChild(ui.renderCard(alb, () => this.renderAlbumView(alb))));
          } else {
              ac.innerHTML = '<p class="text-secondary" style="padding:16px;">No albums found.</p>';
          }
      } catch(e) {
          console.error("Failed loading artist:", e);
      }
  }

  async renderAlbumView(album) {
    let artworkUrl = api.getArtworkUrl(album.Id);
    if(album.Id.startsWith('demo')) artworkUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23333" width="200" height="200"/></svg>';

    ui.renderView(`
      <button class="btn-outline" style="margin-bottom: 20px;" onclick="app.navigate('home')"><i class="fa-solid fa-arrow-left"></i> Back</button>
      <div style="display:flex; gap:30px; margin-bottom: 30px;">
        <img id="album-view-cover" src="${artworkUrl}" style="width:200px; height:200px; border-radius:8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); object-fit: cover;">
        <div style="display:flex; flex-direction:column; justify-content:flex-end;">
          <h5 style="color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px;">Album</h5>
          <h1 style="font-size:48px; margin: 10px 0;">${album.Name}</h1>
          <p class="artist" style="color:var(--text-secondary); cursor:pointer;" id="album-artist-link">${album.AlbumArtist || 'Unknown Artist'}</p>
          <div style="margin-top:20px;">
             <button class="play-circle" style="width:50px; height:50px; font-size:20px; cursor:pointer;" id="play-album-btn"><i class="fa-solid fa-play"></i></button>
          </div>
        </div>
      </div>
      <div class="list-view">
        <div class="list-header">
           <div>#</div><div>Title</div><div>Artist</div><div>Time</div>
        </div>
        <div id="album-songs">
           <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
           <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
           <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
        </div>
      </div>
    `);
    
    if(artworkUrl.includes('a0f79dde7ebd3ff8412ad51659766638')) {
        api.getOnlineArtwork(album.Name + " " + (album.AlbumArtist||"")).then(u => {
            if(u) document.getElementById('album-view-cover').src = u;
        });
    }

    document.getElementById('album-artist-link').onclick = () => {
        if(album.ArtistItems?.length) this.renderArtistView(album.ArtistItems[0].Id);
    };

    try {
      const { songs } = await api.getSongs(album.Id);
      const container = document.getElementById('album-songs');
      container.innerHTML = '';
      songs.forEach((s, idx) => {
        container.appendChild(ui.renderSongRow(s, idx, () => player.playTrack(s, songs), (ev, song) => this.buildSongMenu(song).then(menu => ui.showContextMenu(ev.clientX, ev.clientY, menu))));
      });
      document.getElementById('play-album-btn').onclick = () => { if(songs.length) player.playTrack(songs[0], songs); };
    } catch(e) {}
  }

  async renderProfile() {
    ui.renderView(`<h1 class="view-title">Profile Settings</h1><div id="profile-content"><div class="skeleton-card" style="height:200px; width:100%;"></div></div>`);
    try {
        const profile = await api.req('/profile');
        let avatarBase64 = profile.avatar_url || '';
        
        document.getElementById('profile-content').innerHTML = `
         <div style="background:var(--bg-card); padding:40px; border-radius:8px; max-width:700px; box-shadow:0 8px 24px rgba(0,0,0,0.5);">
            <div style="display:flex; gap:40px; margin-bottom:40px;">
               <div id="prof-img-wrapper" style="width:160px; height:160px; background:var(--bg-highlight); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; position:relative; overflow:hidden; box-shadow:0 12px 30px rgba(0,0,0,0.6); transition:transform 0.2s;">
                   ${avatarBase64 ? '' : `<i id="prof-icon" class="fa-solid fa-user" style="font-size:60px; color:var(--text-secondary);"></i>`}
                   <img id="prof-img" src="${avatarBase64}" style="width:100%; height:100%; object-fit:cover; display:${avatarBase64 ? 'block' : 'none'}; position:absolute; inset:0;">
                   <div id="prof-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;"><i class="fa-solid fa-camera" style="font-size:24px; color:white;"></i></div>
                   <input type="file" id="prof-file" accept="image/*" style="display:none;">
               </div>
               <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                   <h3 style="margin-bottom:20px; color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px; font-size:12px;">Public Profile</h3>
                   <input type="text" id="prof-display" value="${profile.display_name || ''}" placeholder="${profile.username}" style="width:100%; border:none; border-bottom:2px solid var(--divider); background:transparent; color:white; font-size:32px; font-weight:700; outline:none; padding:10px 0; margin-bottom:25px; transition:border-color 0.2s;">
                   
                   <label style="color:var(--text-secondary); font-size:14px; margin-bottom:8px; display:block;">Bio</label>
                   <textarea id="prof-bio" placeholder="Tell us about yourself..." style="width:100%; height:100px; background:var(--bg-highlight); border:1px solid transparent; border-radius:8px; color:white; padding:15px; resize:none; outline:none; transition:border-color 0.2s; font-family:inherit;">${profile.bio || ''}</textarea>
               </div>
            </div>
            <div style="display:flex; justify-content:flex-end;">
               <button id="prof-save-btn" class="btn-primary" style="width:auto; padding:12px 40px;">Save Changes</button>
            </div>
         </div>
         <h3 style="margin:40px 0 20px 0; font-size:24px; font-weight:700;">Your Library</h3>
         <div class="grid-container" id="profile-library-grid"></div>
        `;
        
        // Fetch library components concurrently
        Promise.all([
             api.getFavorites().then(f => f.tracks || []),
             api.getPlaylists()
        ]).then(([favTracks, myPlaylists]) => {
             let libraryHtml = '';
             if(favTracks.length > 0) {
                 libraryHtml += `
                 <div class="card" onclick="app.navigate('favorites')" style="cursor:pointer;">
                     <div style="width:100%; aspect-ratio:1; background: linear-gradient(135deg, #450af5, #c4efd9); display:flex; align-items:center; justify-content:center; border-radius:8px; margin-bottom:12px; box-shadow:0 8px 24px rgba(0,0,0,0.4);">
                        <i class="fa-solid fa-heart" style="font-size:48px; color:white;"></i>
                     </div>
                     <h4 style="font-weight:700;">Liked Songs</h4>
                     <p style="color:var(--text-secondary); font-size:14px;">${favTracks.length} liked songs</p>
                 </div>`;
             }
             
             myPlaylists.forEach(p => {
                  const fallbackSvg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='gf' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#333333'/><stop offset='100%' stop-color='#1a1a1a'/></linearGradient></defs><rect fill='url(#gf)' width='200' height='200'/><text x='100' y='110' font-family='sans-serif' font-size='70' font-weight='600' fill='#ffffff' text-anchor='middle'>${(p.name||'').charAt(0).toUpperCase()}</text></svg>`);
                  const imgUrl = p.cover_url || `data:image/svg+xml;utf8,${fallbackSvg}`;
                  libraryHtml += `
                  <div class="card" onclick='app.renderPlaylistView(${JSON.stringify(p).replace(/'/g, "&#39;")})' style="cursor:pointer; position:relative;">
                     <img src="${imgUrl}" style="aspect-ratio:1; object-fit:cover; border-radius:6px; margin-bottom:16px; box-shadow:0 8px 16px rgba(0,0,0,0.3);">
                     <div class="card-play-btn"><i class="fa-solid fa-play"></i></div>
                     <div class="title">${p.name}</div>
                     <div class="subtitle">Playlist</div>
                  </div>`;
             });
             
             document.getElementById('profile-library-grid').innerHTML = libraryHtml || '<p class="text-secondary">Your library is currently empty.</p>';
        }).catch(e => {
             document.getElementById('profile-library-grid').innerHTML = '<p class="text-secondary">Failed to load library.</p>';
        });
        
        const wrapper = document.getElementById('prof-img-wrapper');
        const overlay = document.getElementById('prof-overlay');
        const fileInput = document.getElementById('prof-file');
        const imgEl = document.getElementById('prof-img');
        const iconEl = document.getElementById('prof-icon');
        
        wrapper.onmouseenter = () => overlay.style.opacity = '1';
        wrapper.onmouseleave = () => overlay.style.opacity = '0';
        wrapper.onclick = () => fileInput.click();
        
        // CSS for input focus
        document.getElementById('prof-display').addEventListener('focus', function() { this.style.borderColor = 'var(--accent)'; });
        document.getElementById('prof-display').addEventListener('blur', function() { this.style.borderColor = 'var(--divider)'; });
        document.getElementById('prof-bio').addEventListener('focus', function() { this.style.borderColor = 'var(--accent)'; });
        document.getElementById('prof-bio').addEventListener('blur', function() { this.style.borderColor = 'transparent'; });
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 400; canvas.height = 400;
                    const ctx = canvas.getContext('2d');
                    
                    const minOffset = Math.min(img.width, img.height);
                    const sx = (img.width - minOffset) / 2;
                    const sy = (img.height - minOffset) / 2;
                    
                    ctx.drawImage(img, sx, sy, minOffset, minOffset, 0, 0, 400, 400);
                    avatarBase64 = canvas.toDataURL('image/jpeg', 0.8);
                    
                    if(imgEl) { imgEl.src = avatarBase64; imgEl.style.display = 'block'; }
                    if(iconEl) iconEl.style.display = 'none';
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        };
        
        document.getElementById('prof-save-btn').onclick = async () => {
            const btn = document.getElementById('prof-save-btn');
            btn.innerText = 'Saving...';
            btn.disabled = true;
            
            try {
                await api.req('/profile', 'POST', {
                    display_name: document.getElementById('prof-display').value.trim(),
                    bio: document.getElementById('prof-bio').value.trim(),
                    avatar_url: avatarBase64
                });
                ui.toast('Profile updated!', 'success');
                const updated = await api.req('/profile');
                this.updateProfileHeader(updated);
            } catch(e) {
                ui.toast('Error saving profile', 'error');
            }
            btn.innerText = 'Save Changes';
            btn.disabled = false;
        };
    } catch(e) {
        document.getElementById('profile-content').innerHTML = '<p class="text-secondary">Failed to load profile.</p>';
    }
  }

  async renderAdmin() {
    if(this.user.role !== 'admin') return this.navigate('home');
    ui.renderView(`
      <h1 class="view-title">Admin Panel</h1>
      <div style="background:var(--bg-card); padding:20px; border-radius:8px; margin-bottom: 20px;">
        <h3 style="margin-bottom:15px;">System Stats</h3>
        <div id="admin-stats">Loading...</div>
      </div>
      <div style="background:var(--bg-card); padding:20px; border-radius:8px;">
        <h3 style="margin-bottom:15px;">User Management</h3>
        <table class="data-table" style="width:100%;">
           <thead><tr><th>Username</th><th>Joined</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
           <tbody id="admin-users-table"></tbody>
        </table>
      </div>
    `);

    try {
      const stats = await api.getAdminStats();
      document.getElementById('admin-stats').innerHTML = `
        <p><strong>Total Users:</strong> ${stats.users}</p>
        <p><strong>Total Playlists:</strong> ${stats.playlists}</p>
        <p><strong>System State:</strong> <span style="font-weight:700;"><span style="color:#1db954;">Active</span></span></p>
      `;
      
      const reqVars = await api.req('/admin/users');
      const table = document.getElementById('admin-users-table');
      reqVars.users.forEach(u => {
          const tr = document.createElement('tr');
          const isPending = !u.is_approved && u.role !== 'admin';
          const statusHtml = u.role === 'admin' ? '<span style="color:var(--accent); font-weight:bold;">Admin</span>' : (isPending ? '<span style="color:#f1c40f;">Pending</span>' : '<span style="color:#1db954;">Approved</span>');
          const actionsHtml = u.role === 'admin' ? '' : (isPending ? `<button class="btn-outline" style="border-color:#1db954; color:#1db954;" onclick="app.adminApproveUser(${u.id})">Approve</button>` : `<button class="btn-outline" style="border-color:#e22134; color:#e22134;" onclick="app.adminRevokeUser(${u.id})">Revoke</button>`);
          
          tr.innerHTML = `
              <td>${u.username} ${u.display_name ? `(${u.display_name})` : ''}</td>
              <td>${new Date(u.created_at).toLocaleDateString()}</td>
              <td style="text-transform:capitalize;">${u.role}</td>
              <td>${statusHtml}</td>
              <td>${actionsHtml}</td>
          `;
          table.appendChild(tr);
      });
    } catch(e) {}
  }
  
  async adminApproveUser(id) {
     await api.req(`/admin/users/${id}/approve`, 'POST');
     ui.toast('User approved', 'success');
     this.renderAdmin();
  }
  
  async adminRevokeUser(id) {
     if(confirm('Revoke access for this user?')) {
         await api.req(`/admin/users/${id}/revoke`, 'POST');
         ui.toast('User access revoked', 'error');
         this.renderAdmin();
     }
  }
}

window.addEventListener('scroll', () => {
    const header = document.getElementById('top-header');
    if(window.scrollY > 0) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
});

const app = new App();
