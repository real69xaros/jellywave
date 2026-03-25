/* =========================================================
   JellyWave Mobile — runs only inside Capacitor (Android)
   ========================================================= */

(function () {
  'use strict';

  // ── Guard: exit immediately on desktop ────────────────────
  if (!window.Capacitor) return;

  // ── Mark body as mobile ───────────────────────────────────
  document.body.classList.add('is-mobile');

  // ── Patch ui.showApp to use block layout (matches mobile CSS) ──
  const _origShowApp = ui.showApp.bind(ui);
  ui.showApp = function () {
    ui.appWrapper.style.display = 'block';
    ui.authWrapper.style.display = 'none';
  };

  // ── Elements ──────────────────────────────────────────────
  const fullPlayer         = document.getElementById('now-playing-bar');
  const miniPlayer         = document.getElementById('mini-player');
  const miniInner          = document.getElementById('mini-player-inner');
  const miniTitle          = document.getElementById('mini-title');
  const miniArtist         = document.getElementById('mini-artist');
  const miniArt            = document.getElementById('mini-art');
  const miniArtPlaceholder = miniPlayer.querySelector('.mini-art-placeholder');
  const miniPlayBtn        = document.getElementById('mini-play-btn');
  const miniNextBtn        = document.getElementById('mini-next-btn');
  const miniProgress       = document.getElementById('mini-progress-fill');
  const fpDownBtn          = document.getElementById('fp-down-btn');
  const mobileQueueBtn     = document.getElementById('mobile-queue-btn');
  const seekSlider         = document.getElementById('seek-slider');
  const volSlider          = document.getElementById('volume-slider');
  const mobileTabs         = document.querySelectorAll('#mobile-nav .tab-btn');
  const profileBtn         = document.getElementById('profile-btn');
  const profileMenu        = document.getElementById('profile-menu');

  // ── Open / Close full player ──────────────────────────────
  function openPlayer() {
    fullPlayer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePlayer() {
    fullPlayer.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Tap mini player inner area (not the buttons) to open full player
  miniInner.addEventListener('click', (e) => {
    if (!e.target.closest('.mini-btns')) {
      if (player.currentTrack()) openPlayer();
    }
  });

  // Down button closes the full player
  if (fpDownBtn) {
    fpDownBtn.addEventListener('click', closePlayer);
  }

  // Mobile queue button inside player header
  if (mobileQueueBtn) {
    mobileQueueBtn.addEventListener('click', () => ui.toggleQueuePanel());
  }

  // ── Swipe-down gesture to close full player ───────────────
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
  // app.js uses mousedown/mouseup which don't fire reliably on touch
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

  // ── Touch events for volume slider ───────────────────────
  volSlider.addEventListener('touchend', () => {
    player.setVolume(parseFloat(volSlider.value));
    volSlider.style.setProperty('--progress', `${volSlider.value * 100}%`);
  }, { passive: true });

  // ── Sync mini player with player state ───────────────────
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
      miniTitle.textContent   = 'Nothing playing';
      miniArtist.textContent  = '';
      miniArt.style.display   = 'none';
      miniArt.dataset.trackId = '';
      miniArtPlaceholder.style.display = 'flex';
      miniProgress.style.width = '0%';
    }
  }

  // ── Wrap emitState to also sync the mini player ───────────
  // We piggyback on emitState so the mini player stays in sync without
  // using Object.defineProperty — just replace the function.
  const _origEmit = player.emitState.bind(player);
  player.emitState = function () {
    _origEmit(); // calls player.onStateChange → app.updatePlayerUI
    syncMiniPlayer({
      isPlaying:   player.isPlaying,
      track:       player.currentTrack(),
      currentTime: player.audio ? player.audio.currentTime : 0,
      duration:    player.audio ? (player.audio.duration || 0) : 0,
    });
  };

  // ── Bottom tab active state ───────────────────────────────
  // Mirror sidebar nav-link active class changes to the mobile tabs.
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

  // Mobile tab clicks also trigger navigation via data-route.
  // app.js bindEvents already queries [data-route] on the whole document,
  // so the mobile nav buttons are covered — no extra wiring needed.

  // ── Profile dropdown (tap to toggle) ─────────────────────
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    profileMenu.classList.remove('show');
  });

  // ── Initial mini player state ─────────────────────────────
  syncMiniPlayer({ isPlaying: false, track: null, currentTime: 0, duration: 0 });

  // ── Android auto-update check ─────────────────────────────
  async function checkForAndroidUpdate() {
    if (!window.Capacitor) return;

    try {
      const AppPlugin = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (!AppPlugin) return;

      // Get installed APK version from AndroidManifest
      const info = await AppPlugin.getInfo();
      const installedVersion = info.version; // e.g. "1.0.0"

      // Fetch latest GitHub release
      const res = await fetch('https://api.github.com/repos/real69xaros/jellywave/releases/latest');
      if (!res.ok) return;
      const release = await res.json();
      if (!release.tag_name) return;

      const latestVersion = release.tag_name.replace(/^v/, ''); // "1.0.1"

      if (semverGreater(latestVersion, installedVersion)) {
        const apkAsset = release.assets.find(a => a.name.endsWith('.apk'));
        const downloadUrl = apkAsset ? apkAsset.browser_download_url : release.html_url;
        showUpdateBanner(latestVersion, downloadUrl);
      }
    } catch (e) {
      // Silently fail — update check is non-critical
    }
  }

  function semverGreater(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return true;
      if ((pa[i] || 0) < (pb[i] || 0)) return false;
    }
    return false;
  }

  function showUpdateBanner(version, downloadUrl) {
    if (document.getElementById('update-banner')) return; // already shown
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:9998',
      'background:#1c1c1e', 'border-top:1px solid rgba(255,255,255,0.1)',
      'padding:14px 16px', 'display:flex', 'align-items:center', 'gap:12px',
      'box-shadow:0 -4px 24px rgba(0,0,0,0.6)',
      'padding-bottom:calc(14px + env(safe-area-inset-bottom, 0px))'
    ].join(';');
    banner.innerHTML = `
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:600;color:#fff;">Update Available</div>
        <div style="font-size:12px;color:#8e8e93;margin-top:2px;">JellyWave v${version} is ready</div>
      </div>
      <button id="update-download-btn"
        style="padding:10px 18px;background:#FA233B;color:#fff;border-radius:8px;font-size:14px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;">
        Download
      </button>
      <button id="update-dismiss-btn"
        style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:#8e8e93;background:none;border:none;cursor:pointer;font-size:20px;flex-shrink:0;">
        &#x2715;
      </button>
    `;
    document.body.appendChild(banner);

    document.getElementById('update-download-btn').addEventListener('click', () => {
      // '_system' opens in the Android default browser so the APK can download
      window.open(downloadUrl, '_system');
    });

    document.getElementById('update-dismiss-btn').addEventListener('click', () => {
      banner.remove();
    });
  }

  // Run update check 3 seconds after launch (let app finish loading first)
  setTimeout(checkForAndroidUpdate, 3000);

})();
