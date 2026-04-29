/* =========================================================
   JellyWave Mobile — Capacitor (Android) enhancements
   ========================================================= */

(function () {
  'use strict';

  // Guard: only run on Android/Capacitor or mobile UA
  const isCapacitor = !!window.Capacitor;
  const isMobileUA  = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (!isCapacitor && !isMobileUA) return;

  // Mark body as mobile immediately so CSS applies before first render
  document.body.classList.add('is-mobile');

  // Patch ui.showApp to use block layout
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
  const miniPrevBtn        = document.getElementById('mini-prev-btn');
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
  const sleepTimerBtn      = document.getElementById('sleep-timer-btn');
  const sleepTimerSheet    = document.getElementById('sleep-timer-sheet');
  const sleepTimerCancel   = document.getElementById('sleep-timer-cancel');
  const contextBackdrop    = document.getElementById('context-backdrop');

  // ── Open / Close full player ──────────────────────────────
  function openPlayer() {
    fullPlayer.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function closePlayer() {
    fullPlayer.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Tap mini player body (not buttons) → open full player
  miniInner.addEventListener('click', (e) => {
    if (!e.target.closest('.mini-btns')) {
      if (player.currentTrack()) openPlayer();
    }
  });

  if (fpDownBtn) fpDownBtn.addEventListener('click', closePlayer);
  if (mobileQueueBtn) mobileQueueBtn.addEventListener('click', () => ui.toggleQueuePanel());

  // ── Swipe-down gesture on full player ────────────────────
  let touchStartY = 0;
  let touchStartX = 0;

  fullPlayer.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  fullPlayer.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0].clientY - touchStartY;
    const dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
    // Only swipe down if mostly vertical
    if (dy > 80 && dx < 60) closePlayer();
  }, { passive: true });

  // ── Mini player buttons ───────────────────────────────────
  if (miniPrevBtn) {
    miniPrevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      player.prev();
      if (navigator.vibrate) navigator.vibrate(8);
    });
  }

  miniPlayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    player.togglePlay();
    if (navigator.vibrate) navigator.vibrate(8);
  });

  miniNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    player.next();
    if (navigator.vibrate) navigator.vibrate(8);
  });

  // ── Touch events for seek slider ──────────────────────────
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
    miniPlayBtn.innerHTML = state.isPlaying
      ? '<i class="fa-solid fa-pause"></i>'
      : '<i class="fa-solid fa-play"></i>';

    if (state.track) {
      miniTitle.textContent  = state.track.Name || '';
      miniArtist.textContent = (state.track.Artists && state.track.Artists.join(', ')) || state.track.AlbumArtist || '';

      const artUrl = api.getArtworkUrl(state.track.Id);
      if (miniArt.dataset.trackId !== state.track.Id) {
        miniArt.dataset.trackId = state.track.Id;
        miniArt.src = artUrl;
        miniArt.style.display = 'block';
        miniArtPlaceholder.style.display = 'none';
      }

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

  // ── Android Native Media Notification ────────────────────
  const MusicControls = isCapacitor
    ? (window.Capacitor?.Plugins?.CapacitorMusicControls || null)
    : null;

  let _mcLastTrackId  = null;
  let _mcElapsedTimer = null;

  function mcStartElapsedTimer() {
    if (_mcElapsedTimer) return;
    _mcElapsedTimer = setInterval(() => {
      if (!player.audio || !MusicControls) return;
      try { MusicControls.updateElapsed({ elapsed: player.audio.currentTime || 0, isPlaying: player.isPlaying }); } catch (e) {}
    }, 1000);
  }

  function mcStopElapsedTimer() {
    if (_mcElapsedTimer) { clearInterval(_mcElapsedTimer); _mcElapsedTimer = null; }
  }

  // Wrap emitState to sync mini player AND drive MC notification
  const _origEmit = player.emitState.bind(player);
  player.emitState = function () {
    _origEmit();
    const state = {
      isPlaying:   player.isPlaying,
      track:       player.currentTrack(),
      currentTime: player.audio ? player.audio.currentTime : 0,
      duration:    player.audio ? (player.audio.duration || 0) : 0,
    };
    syncMiniPlayer(state);

    if (MusicControls) {
      if (!state.track) {
        mcStopElapsedTimer();
        MusicControls.destroy().catch(() => {});
        _mcLastTrackId = null;
      } else if (state.track.Id !== _mcLastTrackId) {
        _mcLastTrackId = state.track.Id;
        MusicControls.create({
          track:       state.track.Name || '',
          artist:      (state.track.Artists && state.track.Artists.join(', ')) || state.track.AlbumArtist || '',
          album:       state.track.Album || '',
          cover:       api.getArtworkUrl(state.track.Id),
          isPlaying:   state.isPlaying,
          hasPrev:     true,
          hasNext:     true,
          hasClose:    false,
          dismissable: false,
          duration:    state.duration,
          elapsed:     state.currentTime,
        }).catch(e => console.warn('MusicControls.create:', e));
        state.isPlaying ? mcStartElapsedTimer() : mcStopElapsedTimer();
      } else {
        MusicControls.updateIsPlaying({ isPlaying: state.isPlaying }).catch(() => {});
        state.isPlaying ? mcStartElapsedTimer() : mcStopElapsedTimer();
      }
    }
  };

  // Lockscreen / notification button events
  if (MusicControls) {
    document.addEventListener('controlsNotification', (e) => {
      const msg = (e.detail && e.detail.message) || '';
      switch (msg) {
        case 'music-controls-next':              player.next(); break;
        case 'music-controls-previous':          player.prev(); break;
        case 'music-controls-toggle-play-pause': player.togglePlay(); break;
        case 'music-controls-play':              if (!player.isPlaying) player.togglePlay(); break;
        case 'music-controls-pause':             if (player.isPlaying)  player.togglePlay(); break;
        case 'music-controls-destroy':           mcStopElapsedTimer(); break;
      }
    });
  }

  // ── Bottom tab active state ───────────────────────────────
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

  // ── Profile dropdown ──────────────────────────────────────
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    profileMenu.classList.remove('show');
  });

  // ── Context menu → bottom sheet on mobile ────────────────
  const _origShowMenu = ui.showContextMenu.bind(ui);
  const _origHideMenu = ui.hideContextMenu.bind(ui);

  ui.showContextMenu = function (x, y, items) {
    _origShowMenu(x, y, items);
    this.contextMenu.classList.add('visible');
    if (contextBackdrop) contextBackdrop.classList.add('show');
  };

  ui.hideContextMenu = function () {
    this.contextMenu.classList.remove('visible');
    if (contextBackdrop) contextBackdrop.classList.remove('show');
    // Delay actual hide so slide-out animation plays
    setTimeout(() => _origHideMenu.call(this), 250);
  };

  if (contextBackdrop) {
    contextBackdrop.addEventListener('click', () => ui.hideContextMenu());
  }

  // ── Sleep Timer ───────────────────────────────────────────
  let sleepTimerId   = null;
  let sleepTimerMins = 0;
  let sleepTimerEnd  = 0;
  let sleepTimerInterval = null;

  function openSleepSheet() {
    sleepTimerSheet.classList.add('open');
    if (contextBackdrop) contextBackdrop.classList.add('show');
    // Highlight current selection
    document.querySelectorAll('.sleep-timer-opt').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.mins) === sleepTimerMins);
    });
  }

  function closeSleepSheet() {
    sleepTimerSheet.classList.remove('open');
    if (contextBackdrop) contextBackdrop.classList.remove('show');
  }

  function setSleepTimer(mins) {
    clearSleepTimer();
    sleepTimerMins = mins;
    sleepTimerEnd  = Date.now() + mins * 60 * 1000;
    sleepTimerId   = setTimeout(() => {
      player.audio.pause();
      sleepTimerBtn.classList.remove('active');
      sleepTimerMins = 0;
      ui.toast('Sleep timer: paused playback');
    }, mins * 60 * 1000);
    sleepTimerBtn.classList.add('active');
    sleepTimerBtn.title = `Sleep in ${mins} min`;
    ui.toast(`Sleep timer: ${mins} min`);
  }

  function clearSleepTimer() {
    if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; }
    if (sleepTimerInterval) { clearInterval(sleepTimerInterval); sleepTimerInterval = null; }
    sleepTimerMins = 0;
    sleepTimerEnd  = 0;
    sleepTimerBtn.classList.remove('active');
    sleepTimerBtn.title = 'Sleep Timer';
  }

  if (sleepTimerBtn) {
    sleepTimerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSleepSheet();
    });
  }

  document.querySelectorAll('.sleep-timer-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.dataset.mins);
      setSleepTimer(mins);
      closeSleepSheet();
    });
  });

  if (sleepTimerCancel) {
    sleepTimerCancel.addEventListener('click', () => {
      clearSleepTimer();
      closeSleepSheet();
      ui.toast('Sleep timer cancelled');
    });
  }

  // Close sleep sheet when backdrop clicked (shared backdrop)
  if (contextBackdrop) {
    contextBackdrop.addEventListener('click', () => {
      if (sleepTimerSheet.classList.contains('open')) closeSleepSheet();
    });
  }

  // ── Initial mini player state ─────────────────────────────
  syncMiniPlayer({ isPlaying: false, track: null, currentTime: 0, duration: 0 });

  // ── Android back button closes full player / sheets ──────
  if (isCapacitor) {
    const AppPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (AppPlugin) {
      AppPlugin.addListener('backButton', () => {
        if (sleepTimerSheet.classList.contains('open')) { closeSleepSheet(); return; }
        if (ui.contextMenu && ui.contextMenu.classList.contains('visible')) { ui.hideContextMenu(); return; }
        if (fullPlayer.classList.contains('open')) { closePlayer(); return; }
      });
    }
  }

  // ── Android auto-update check ─────────────────────────────
  async function checkForAndroidUpdate() {
    if (!isCapacitor) return;
    try {
      const AppPlugin = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (!AppPlugin) return;
      const info = await AppPlugin.getInfo();
      const installedVersion = info.version;

      const res = await fetch('https://api.github.com/repos/real69xaros/jellywave/releases/latest');
      if (!res.ok) return;
      const release = await res.json();
      if (!release.tag_name) return;

      const latestVersion = release.tag_name.replace(/^v/, '');
      if (semverGreater(latestVersion, installedVersion)) {
        const apkAsset = release.assets.find(a => a.name.endsWith('.apk'));
        showUpdateBanner(latestVersion, apkAsset ? apkAsset.browser_download_url : release.html_url);
      }
    } catch (e) { /* non-critical */ }
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
    if (document.getElementById('update-banner')) return;
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
    document.getElementById('update-download-btn').addEventListener('click', () => window.open(downloadUrl, '_system'));
    document.getElementById('update-dismiss-btn').addEventListener('click', () => banner.remove());
  }

  setTimeout(checkForAndroidUpdate, 3000);

})();
