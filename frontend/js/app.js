const AuthView = `
  <div class="auth-panel">
    <i class="fa-solid fa-water"></i>
    <h2>Welcome to JellyWave</h2>
    <form id="auth-form">
      <div class="form-group"><label>Username</label><input type="text" id="auth-user" required></div>
      <div class="form-group"><label>Password</label><input type="password" id="auth-pass" required></div>
      <button type="submit" class="btn-primary" id="auth-submit-btn">Login</button>
      <div class="auth-switch"><span id="auth-toggle-text">Don't have an account? <a href="#" id="auth-toggle-btn">Register</a></span></div>
    </form>
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
        this.startMainApp();
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
      likeBtn.innerHTML = this.favorites.has(state.track.Id) ? '<i class="fa-solid fa-heart" style="color:var(--accent-color);"></i>' : '<i class="fa-regular fa-heart"></i>';
      
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

    ui.renderQueue(state.queue, state.currentIndex);
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
          ui.toast('Registration successful!', 'success');
        }
        this.startMainApp();
      } catch(err) {
        ui.toast(err.message, 'error');
      }
    });
  }

  async startMainApp() {
    ui.showApp();
    document.getElementById('profile-name').innerText = this.user.username;
    if (this.user.role === 'admin') {
      document.getElementById('admin-panel-btn').style.display = 'block';
    }

    ui.toast('Initializing catalog...', 'success');
    await this.refreshUserData();
    this.navigate('home');
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
  
  renderSidebarPlaylists() {
      const plContainer = document.getElementById('playlist-list');
      plContainer.innerHTML = '';
      this.playlists.forEach(pl => {
          const li = document.createElement('li');
          li.innerHTML = `<i class="fa-solid fa-list"></i> ${pl.name}`;
          li.onclick = () => this.renderPlaylistView(pl);
          plContainer.appendChild(li);
      });
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

  buildSongMenu(song) {
      const plMenus = this.playlists.map(pl => {
          return { label: `Add to ${pl.name}`, icon: 'fa-solid fa-plus', action: async () => {
              await api.addPlaylistTrack(pl.id, song.Id, song.Name);
              ui.toast('Added to playlist', 'success');
          }};
      });
  
      return [
          { label: 'Play Now', icon: 'fa-solid fa-play', action: () => player.playTrack(song) },
          { label: 'Play Next', icon: 'fa-solid fa-step-forward', action: () => { player.playNext(song); ui.toast('Added to play next'); } },
          { label: 'Add to end of Queue', icon: 'fa-solid fa-bars-staggered', action: () => { player.addToQueue(song); ui.toast('Added to queue'); } },
          { divider: true },
          { label: this.favorites.has(song.Id) ? 'Unlike Song' : 'Like Song', icon: this.favorites.has(song.Id) ? 'fa-solid fa-heart' : 'fa-regular fa-heart', action: () => this.toggleLike(song) },
          { divider: true },
          ...plMenus,
          { divider: true },
          { label: 'Go to Album', icon: 'fa-solid fa-record-vinyl', action: () => { if(song.AlbumId) this.renderAlbumView({ Id: song.AlbumId, Name: song.Album }); } },
          { label: 'Go to Artist', icon: 'fa-solid fa-user', action: () => { if(song.ArtistItems?.length) this.renderArtistView(song.ArtistItems[0].Id); else if(song.Artists?.length) ui.toast("Artist details not attached", "error"); } }
      ];
  }

  navigate(route) {
    this.currentRoute = route;
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.btn-outline').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.playlist-links li').forEach(el => el.classList.remove('active'));
    
    const activeLink = document.querySelector(`[data-route="${route}"]`);
    if(activeLink) activeLink.classList.add('active');

    if (route === 'home') this.renderHome();
    else if (route === 'search') this.renderSearch();
    else if (route === 'library') this.renderLibrary();
    else if (route === 'profile') this.renderProfile();
    else if (route === 'admin') this.renderAdmin();
  }

  async renderHome() {
    ui.renderView(`
      <h1 class="view-title">Welcome back</h1>
      
      <h3 style="margin-bottom: 20px;">Discover Playlists</h3>
      <div id="home-playlists" class="grid-container" style="margin-bottom: 30px;"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>

      <h3 style="margin-bottom: 20px;">Top Artists</h3>
      <div id="home-artists" class="grid-container" style="margin-bottom: 30px;"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>
      
      <h3 style="margin-bottom: 20px;">Featured Albums</h3>
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
              const fallbackSvg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='gf' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#2a0845'/><stop offset='100%' stop-color='#6441A5'/></linearGradient></defs><rect fill='url(#gf)' width='200' height='200'/><text x='100' y='110' font-family='sans-serif' font-size='60' font-weight='bold' fill='white' text-anchor='middle'>${(pl.name||'').charAt(0).toUpperCase()}</text></svg>`);
              const imgUrl = pl.cover_url || `data:image/svg+xml;utf8,${fallbackSvg}`;
              card.innerHTML = `
                <img src="${imgUrl}" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:4px; box-shadow:0 4px 10px rgba(0,0,0,0.5);">
                <div class="title" style="margin-top:10px;">${pl.name}</div>
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
      <input type="text" id="search-input" placeholder="Search artists, albums, or songs..." style="width:100%; max-width:500px; padding:12px 20px; border-radius:30px; border:none; background:var(--bg-highlight); color:white; font-size:16px; margin-bottom: 30px; outline:none;">
      
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
         res.songs?.slice(0, 5).forEach((s, idx) => sc.appendChild(ui.renderSongRow(s, idx, () => player.playTrack(s, res.songs), (ev, song) => ui.showContextMenu(ev.clientX, ev.clientY, this.buildSongMenu(song)))));

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
                el.innerHTML = `<div class="col-num">${idx + 1}</div><div class="col-title">${r.name}</div><div class="col-artist">Audio Track</div><div class="col-time"></div>`;
                el.onclick = () => ui.toast('Browsing recent catalog tracks is pending integration.');
                rc.appendChild(el);
            });
        }
    } catch(e) {}
  }
  
  async renderFavoritesView() {
      ui.renderView(`
        <button class="btn-outline" style="margin-bottom: 20px;" onclick="app.navigate('library')"><i class="fa-solid fa-arrow-left"></i> Back</button>
        <div style="display:flex; gap:30px; margin-bottom: 30px;">
          <div style="width:200px; height:200px; border-radius:8px; background: linear-gradient(135deg, #450af5, #c4efd9); box-shadow: 0 10px 30px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center;">
              <i class="fa-solid fa-heart" style="font-size:80px; color:white;"></i>
          </div>
          <div style="display:flex; flex-direction:column; justify-content:flex-end;">
            <h5 style="color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px;">Playlist</h5>
            <h1 style="font-size:48px; margin: 10px 0;">Liked Songs</h1>
            <p style="color:var(--text-secondary);">${this.user.username} • ${this.favorites.size} songs</p>
            <div style="margin-top:20px;">
                <button class="play-circle" style="width:50px; height:50px; font-size:20px; cursor:pointer;" id="play-favs-btn"><i class="fa-solid fa-play"></i></button>
            </div>
          </div>
        </div>
        <div class="list-view">
          <div class="list-header"><div>#</div><div>Title</div><div>Artist</div><div>Time</div></div>
          <div id="fav-songs" style="padding:16px;">
               <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
               <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
               <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
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
                  container.appendChild(ui.renderSongRow(s, idx, () => player.playTrack(s, favTracks), (ev, song) => ui.showContextMenu(ev.clientX, ev.clientY, this.buildSongMenu(song))));
              });
              document.getElementById('play-favs-btn').onclick = () => player.playTrack(favTracks[0], favTracks);
          } else {
              container.innerHTML = '<p class="text-secondary" style="padding:16px;">Failed to fetch tracks. They may be missing from the server.</p>';
          }
      } catch(e) { container.innerHTML = '<p class="text-secondary">Failed to load favorites.</p>'; }
  }
  
  async renderPlaylistView(playlistMeta) {
      const fallbackSvg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='gf' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#2a0845'/><stop offset='100%' stop-color='#6441A5'/></linearGradient></defs><rect fill='url(#gf)' width='200' height='200'/><text x='100' y='110' font-family='sans-serif' font-size='60' font-weight='bold' fill='white' text-anchor='middle'>${(playlistMeta.name||'').charAt(0).toUpperCase()}</text></svg>`);
      const imgUrl = playlistMeta.cover_url || `data:image/svg+xml;utf8,${fallbackSvg}`;

      ui.renderView(`
        <button class="btn-outline" style="margin-bottom: 20px;" onclick="app.navigate('home')"><i class="fa-solid fa-arrow-left"></i> Home</button>
        <div style="display:flex; gap:30px; margin-bottom: 30px;">
          <img src="${imgUrl}" style="width:200px; height:200px; border-radius:8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); object-fit:cover;">
          <div style="display:flex; flex-direction:column; justify-content:flex-end; width:100%;">
            <h5 style="color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px;">${playlistMeta.is_public ? 'Public Playlist' : 'Private Playlist'}</h5>
            <div style="display:flex; align-items:center; gap:20px;">
                <h1 style="font-size:48px; margin: 10px 0;">${playlistMeta.name}</h1>
            </div>
            <p style="color:#eaeaea; font-size:14px; margin-bottom:5px;">${playlistMeta.description || ''}</p>
            <p style="color:var(--text-secondary);"><span style="color:white; font-weight:bold;">${playlistMeta.creator_name || this.user.username}</span></p>
            <div style="margin-top:20px; display:flex; gap:15px; align-items:center;">
                <button class="play-circle" style="width:50px; height:50px; font-size:20px; cursor:pointer;" id="pl-play-btn"><i class="fa-solid fa-play"></i></button>
                ${(playlistMeta.creator_name && playlistMeta.creator_name !== this.user.username) ? '' : '<button class="queue-action-btn" id="pl-del-btn" style="font-size:24px;"><i class="fa-solid fa-trash"></i></button>'}
            </div>
          </div>
        </div>
        <div class="list-view">
          <div class="list-header"><div>#</div><div>Title</div><div>Artist</div><div>Actions</div></div>
          <div id="pl-songs">
               <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
               <div class="skeleton-card" style="height:40px; margin-bottom:10px;"></div>
          </div>
        </div>
      `);
      
      const delBtn = document.getElementById('pl-del-btn');
      if (delBtn) {
          delBtn.addEventListener('click', async () => {
              if(confirm('Are you sure you want to delete this playlist?')) {
                  await api.deletePlaylist(playlistMeta.id);
                  await this.refreshUserData();
                  this.navigate('home');
              }
          });
      }
      
      try {
          const req = await api.getPlaylistTracks(playlistMeta.id);
          const tracksData = req.tracks || [];
          const container = document.getElementById('pl-songs');
          container.innerHTML = '';
          
          if(!tracksData.length) {
              container.innerHTML = '<p class="text-secondary" style="padding:16px;">This playlist is empty. Add songs via right-click menus.</p>';
          } else {
             // Since backend maps track records statically, fetch absolute metadata from mapped track_ids
             const ids = tracksData.map(t => t.track_id);
             const metaReq = await api.getItems(ids);
             const metaMap = {};
             (metaReq.items || []).forEach(m => metaMap[m.Id] = m);

             const finalTracks = [];

             tracksData.forEach((t, idx) => {
                 const metadata = metaMap[t.track_id];
                 if(metadata) finalTracks.push(metadata);
                 
                 const row = document.createElement('div');
                 row.className = 'list-item';
                 row.innerHTML = `<div class="col-num">${idx+1}</div><div class="col-title">${t.title}</div><div class="col-artist">${metadata ? metadata.Artists?.join(', ') : 'Unknown'}</div><div class="col-time"><button class="queue-action-btn rm-pl-trk" style="color:#e22134; display:${delBtn ? 'block':'none'};"><i class="fa-solid fa-trash-can"></i></button></div>`;
                 
                 const rmBtn = row.querySelector('.rm-pl-trk');
                 if(rmBtn) {
                     rmBtn.onclick = async (e) => {
                         e.stopPropagation();
                         await api.removePlaylistTrack(playlistMeta.id, t.track_id);
                         this.renderPlaylistView(playlistMeta); 
                     };
                 }
                 
                 row.onclick = () => { if(metadata) player.playTrack(metadata, finalTracks); };
                 row.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if(metadata) ui.showContextMenu(e.clientX, e.clientY, this.buildSongMenu(metadata));
                 });
                 container.appendChild(row);
             });
             
             document.getElementById('pl-play-btn').onclick = () => { if(finalTracks.length) player.playTrack(finalTracks[0], finalTracks); };
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
          const artistRes = await api.getArtist(artistId);
          if (artistRes && artistRes.artist) {
              const artist = artistRes.artist;
              const bgUrl = api.getArtworkUrl(artistId);
              document.getElementById('artist-header').innerHTML = `
                <div style="height: 300px; background: linear-gradient(transparent, var(--bg-base)), url('${bgUrl}') center/cover; border-radius:8px; display:flex; align-items:flex-end; padding:40px; margin-bottom: 30px; box-shadow: inset 0 -100px 100px -20px var(--bg-base);">
                    <h1 style="font-size:72px; text-shadow: 0 4px 20px rgba(0,0,0,0.8);">${artist.Name}</h1>
                </div>
              `;
          }
          
          const songsRes = await api.getSongs(null, artistId);
          const topSongs = songsRes.songs || [];
          const sc = document.getElementById('artist-songs');
          sc.innerHTML = '';
          if(topSongs.length) {
              topSongs.slice(0, 5).forEach((s, idx) => {
                  sc.appendChild(ui.renderSongRow(s, idx, () => player.playTrack(s, topSongs), (ev, song) => ui.showContextMenu(ev.clientX, ev.clientY, this.buildSongMenu(song))));
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
              // Insert before albums
              document.getElementById('artist-albums').parentNode.insertBefore(allTracksEl, document.getElementById('artist-albums').previousElementSibling);
              const allSc = document.getElementById('artist-all-songs');
              topSongs.slice(5).forEach((s, idx) => {
                  allSc.appendChild(ui.renderSongRow(s, idx + 5, () => player.playTrack(s, topSongs), (ev, song) => ui.showContextMenu(ev.clientX, ev.clientY, this.buildSongMenu(song))));
              });
          }
          
          const albRes = await api.getAlbums(artistId);
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
        container.appendChild(ui.renderSongRow(s, idx, () => player.playTrack(s, songs), (ev, song) => ui.showContextMenu(ev.clientX, ev.clientY, this.buildSongMenu(song))));
      });
      document.getElementById('play-album-btn').onclick = () => { if(songs.length) player.playTrack(songs[0], songs); };
    } catch(e) {}
  }

  async renderProfile() {
    ui.renderView(`
      <h1 class="view-title">Profile</h1>
      <div style="background:var(--bg-card); padding:20px; border-radius:8px;">
        <div style="display:flex; align-items:center; gap:20px; margin-bottom:20px;">
          <div style="width:100px; height:100px; border-radius:50%; background:var(--accent-color); display:flex; align-items:center; justify-content:center; font-size:40px;">
            <i class="fa-solid fa-user"></i>
          </div>
          <div>
            <h2 style="font-size:32px;">${this.user.username}</h2>
            <p style="color:var(--text-secondary); text-transform:capitalize; margin-top:5px;">Role: ${this.user.role}</p>
          </div>
        </div>
      </div>
    `);
  }

  async renderAdmin() {
    if(this.user.role !== 'admin') return this.navigate('home');
    ui.renderView(`
      <h1 class="view-title">Admin Panel</h1>
      <div style="background:var(--bg-card); padding:20px; border-radius:8px;">
        <h3 style="margin-bottom:15px;">System Stats</h3>
        <div id="admin-stats">Loading...</div>
      </div>
    `);

    try {
      const stats = await api.getAdminStats();
      document.getElementById('admin-stats').innerHTML = `
        <p><strong>Total Users:</strong> ${stats.users}</p>
        <p><strong>Total Playlists:</strong> ${stats.playlists}</p>
        <p><strong>System State:</strong> <span style="font-weight:700;"><span style="color:#1db954;">Active</span></span></p>
      `;
    } catch(e) {}
  }
}

window.addEventListener('scroll', () => {
    const header = document.getElementById('top-header');
    if(window.scrollY > 0) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
});

const app = new App();
