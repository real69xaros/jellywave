/* =========================================================
   JellyWave Mobile — mini player, full player, touch fixes
   ========================================================= */

(function () {
  'use strict';

  // ── Patch ui.showApp to use flex instead of grid ──────────
  const _origShowApp = ui.showApp.bind(ui);
  ui.showApp = function () {
    ui.appWrapper.style.display = 'flex';
    ui.authWrapper.style.display = 'none';
  };

  // ── Elements ──────────────────────────────────────────────
  const fullPlayer   = document.getElementById('now-playing-bar');
  const miniPlayer   = document.getElementById('mini-player');
  const miniInner    = document.getElementById('mini-player-inner');
  const miniTitle    = document.getElementById('mini-title');
  const miniArtist   = document.getElementById('mini-artist');
  const miniArt      = document.getElementById('mini-art');
  const miniArtPlaceholder = miniPlayer.querySelector('.mini-art-placeholder');
  const miniPlayBtn  = document.getElementById('mini-play-btn');
  const miniNextBtn  = document.getElementById('mini-next-btn');
  const miniProgress = document.getElementById('mini-progress-fill');
  const fpDownBtn    = document.getElementById('fp-down-btn');
  const seekSlider   = document.getElementById('seek-slider');
  const volSlider    = document.getElementById('volume-slider');
  const mobileTabs   = document.querySelectorAll('#mobile-nav .tab-btn');
  const profileBtn   = document.getElementById('profile-btn');
  const profileMenu  = document.getElementById('profile-menu');

  // ── Open / Close full player ──────────────────────────────
  function openPlayer() {
    fullPlayer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePlayer() {
    fullPlayer.classList.remove('open');
    document.body.style.overflow = '';
  }

  miniInner.addEventListener('click', (e) => {
    // Only open if clicking on info area, not the mini control buttons
    if (!e.target.closest('.mini-btns')) {
      if (player.currentTrack()) openPlayer();
    }
  });

  fpDownBtn.addEventListener('click', closePlayer);

  // Swipe down on full player to close
  let touchStartY = 0;
  fullPlayer.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  fullPlayer.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (dy > 80) closePlayer();
  }, { passive: true });

  // ── Mini player buttons ───────────────────────────────────
  miniPlayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    player.togglePlay();
  });

  miniNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    player.next();
  });

  // ── Touch events for seek slider ──────────────────────────
  // app.js uses mousedown/mouseup which don't fire on touch — fix here
  seekSlider.addEventListener('touchstart', () => {
    player.isDragging = true;
  }, { passive: true });

  seekSlider.addEventListener('touchend', () => {
    player.isDragging = false;
    player.seek(parseFloat(seekSlider.value));
  }, { passive: true });

  seekSlider.addEventListener('touchmove', () => {
    const pct = seekSlider.max > 0 ? (seekSlider.value / seekSlider.max) * 100 : 0;
    seekSlider.style.setProperty('--progress', `${pct}%`);
  }, { passive: true });

  // Volume slider touch
  volSlider.addEventListener('touchend', () => {
    player.setVolume(parseFloat(volSlider.value));
    volSlider.style.setProperty('--progress', `${volSlider.value * 100}%`);
  }, { passive: true });

  // ── Sync mini player with player state ───────────────────
  // Hook into the existing onStateChange callback after app.js sets it
  const _origOnStateChange = null;

  function syncMiniPlayer(state) {
    // Play/Pause icon
    miniPlayBtn.innerHTML = state.isPlaying
      ? '<i class="fa-solid fa-pause"></i>'
      : '<i class="fa-solid fa-play"></i>';

    if (state.track) {
      miniTitle.textContent  = state.track.Name || '';
      miniArtist.textContent = state.track.Artists?.join(', ') || state.track.AlbumArtist || '';

      const artUrl = api.getArtworkUrl(state.track.Id);
      if (miniArt.dataset.trackId !== state.track.Id) {
        miniArt.dataset.trackId = state.track.Id;
        miniArt.src = artUrl;
        miniArt.style.display = 'block';
        miniArtPlaceholder.style.display = 'none';
      }

      // Progress bar
      if (state.duration > 0) {
        const pct = (state.currentTime / state.duration) * 100;
        miniProgress.style.width = `${pct}%`;
      }
    } else {
      miniTitle.textContent  = 'Nothing playing';
      miniArtist.textContent = '';
      miniArt.style.display  = 'none';
      miniArt.dataset.trackId = '';
      miniArtPlaceholder.style.display = 'flex';
      miniProgress.style.width = '0%';
    }
  }

  // Intercept player.onStateChange after app.js sets it
  // We use a setter on the player object
  let _appStateChange = null;
  Object.defineProperty(player, 'onStateChange', {
    get: () => _appStateChange,
    set: (fn) => {
      _appStateChange = fn;
    }
  });

  // Override emitState to call both
  const _origEmit = player.emitState.bind(player);
  player.emitState = function () {
    _origEmit();
    const state = {
      isPlaying: player.isPlaying,
      track: player.currentTrack(),
      currentTime: player.audio ? player.audio.currentTime : 0,
      duration: player.audio ? (player.audio.duration || 0) : 0,
    };
    syncMiniPlayer(state);
  };

  // ── Bottom tab active state ───────────────────────────────
  // app.js uses navigate() which updates data-route items in sidebar.
  // We mirror active state to the mobile tabs.
  const _origNavigate = typeof app !== 'undefined' ? null : null;

  // Watch for sidebar nav-link active class changes via MutationObserver
  const sidebarLinks = document.querySelectorAll('#sidebar .nav-links li[data-route]');

  function syncTabActive() {
    sidebarLinks.forEach(li => {
      if (li.classList.contains('active')) {
        const route = li.getAttribute('data-route');
        mobileTabs.forEach(tab => {
          tab.classList.toggle('active', tab.getAttribute('data-route') === route);
        });
      }
    });
  }

  const navObserver = new MutationObserver(syncTabActive);
  sidebarLinks.forEach(li => navObserver.observe(li, { attributes: true, attributeFilter: ['class'] }));

  // Mobile tab clicks also trigger navigation via data-route (app.js bindEvents picks these up)
  // No extra wiring needed — app.js querySelectorAll('[data-route]') includes these buttons.

  // ── Profile dropdown (mobile tap to toggle) ───────────────
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    profileMenu.classList.remove('show');
  });

  // ── Initial mini player state ────────────────────────────
  syncMiniPlayer({ isPlaying: false, track: null, currentTime: 0, duration: 0 });

})();
