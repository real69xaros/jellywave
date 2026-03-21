class UIManager {
  constructor() {
    this.viewsContainer = document.getElementById('views-container');
    this.toastContainer = document.getElementById('toast-container');
    this.appWrapper = document.getElementById('app-wrapper');
    this.authWrapper = document.getElementById('auth-wrapper');
    
    // Context Menu overlay
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'context-menu';
    this.contextMenu.style.display = 'none';
    document.body.appendChild(this.contextMenu);
    
    document.addEventListener('click', (e) => {
      if(!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    this.queuePanelContainer = document.createElement('div');
    this.queuePanelContainer.id = 'queue-panel';
    this.queuePanelContainer.innerHTML = `
       <div class="queue-header">
           <span>Play Queue</span>
           <div>
               <button class="queue-action-btn" id="clear-queue-btn" style="margin-right:15px; font-size:14px; color:#e22134;"><i class="fa-solid fa-trash"></i> Clear</button>
               <button class="queue-action-btn" id="close-queue-btn"><i class="fa-solid fa-times"></i></button>
           </div>
       </div>
       <div id="queue-items-container"></div>
    `;
    document.body.appendChild(this.queuePanelContainer);
    
    document.getElementById('close-queue-btn').addEventListener('click', () => this.toggleQueuePanel());
    document.getElementById('clear-queue-btn').addEventListener('click', () => player.clearQueue());
  }
  
  toggleQueuePanel() {
    this.queuePanelContainer.classList.toggle('open');
  }

  showApp() {
    this.appWrapper.style.display = 'grid';
    this.authWrapper.style.display = 'none';
  }

  showAuth() {
    this.appWrapper.style.display = 'none';
    this.authWrapper.style.display = 'flex';
  }

  renderView(html) {
    this.viewsContainer.innerHTML = html;
  }

  toast(msg, type='info') {
    const t = document.createElement('div');
    t.className = `toast ${type === 'error' ? 'error' : ''}`;
    t.innerText = msg;
    this.toastContainer.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  renderCard(item, onClick) {
    const card = document.createElement('div');
    card.className = `card ${item.Type === 'MusicArtist' ? 'rounded-img' : ''}`;
    const fallbackSvg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='gf' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#2a0845'/><stop offset='100%' stop-color='#6441A5'/></linearGradient></defs><rect fill='url(#gf)' width='200' height='200'/><text x='100' y='110' font-family='sans-serif' font-size='60' font-weight='bold' fill='white' text-anchor='middle'>${item.Name.charAt(0).toUpperCase()}</text></svg>`);
    const imgUrl = item.ImageTags?.Primary ? api.getArtworkUrl(item.Id) : `data:image/svg+xml;utf8,${fallbackSvg}`;
    card.innerHTML = `
      <img src="${imgUrl}" alt="${item.Name}">
      <div class="title">${item.Name}</div>
      ${item.AlbumArtist || item.ArtistName ? `<div class="subtitle">${item.AlbumArtist || item.ArtistName}</div>` : ''}
    `;
    
    if (imgUrl.includes('a0f79dde7ebd3ff8412ad51659766638')) {
        api.getOnlineArtwork(item.Name + " " + (item.AlbumArtist || item.ArtistName || "")).then(url => {
            if(url) {
                const imgEl = card.querySelector('img');
                if(imgEl) imgEl.src = url;
            }
        });
    }

    card.addEventListener('click', onClick);
    card.addEventListener('contextmenu', (e) => e.preventDefault());
    return card;
  }

  renderSongRow(song, index, onClick, onContext) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <div class="col-num"><span class="col-num-text">${index + 1}</span><i class="fa-solid fa-play col-num-play"></i></div>
      <div class="col-title">${song.Name}</div>
      <div class="col-artist">${song.Artists?.join(', ') || ''}</div>
      <div class="col-time" style="display:flex; justify-content:space-between; align-items:center;">
         ${this.formatTime(song.RunTimeTicks ? song.RunTimeTicks / 10000000 : 0)}
         <button class="queue-action-btn mobile-menu-btn" style="padding: 0 10px;" aria-label="More"><i class="fa-solid fa-ellipsis"></i></button>
      </div>
    `;
    row.addEventListener('click', (e) => {
        if(e.target.closest('.mobile-menu-btn')) {
            e.stopPropagation();
            if(onContext) onContext(e, song);
        } else {
            onClick(e);
        }
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if(onContext) onContext(e, song);
    });
    return row;
  }

  showContextMenu(x, y, items) {
    this.contextMenu.innerHTML = '';
    items.forEach(item => {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'context-menu-divider';
        this.contextMenu.appendChild(div);
      } else {
        const el = document.createElement('div');
        el.className = 'context-menu-item';
        el.innerHTML = `<i class="${item.icon}" style="width: 20px; text-align:center;"></i> <span>${item.label}</span>`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          item.action();
          this.hideContextMenu();
        });
        this.contextMenu.appendChild(el);
      }
    });

    this.contextMenu.style.display = 'block';
    
    // Bounds checking
    const rect = this.contextMenu.getBoundingClientRect();
    if(x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 10;
    if(y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10;

    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
  }
  
  hideContextMenu() {
    this.contextMenu.style.display = 'none';
  }

  renderQueue(queue, currentIndex) {
    const container = document.getElementById('queue-items-container');
    container.innerHTML = '';
    if(!queue || !queue.length) {
       container.innerHTML = '<p class="text-secondary">Queue is empty.</p>';
       return;
    }
    
    queue.forEach((track, i) => {
      const el = document.createElement('div');
      el.className = `queue-item ${i === currentIndex ? 'active' : ''}`;
      el.draggable = true;
      
      const isCurrent = i === currentIndex;
      let actionBtn = isCurrent ? '<div style="width:16px;"></div>' : `<button class="queue-action-btn rm-q"><i class="fa-solid fa-minus-circle"></i></button>`;

      el.innerHTML = `
        <div style="width: 15px; color: ${isCurrent ? 'var(--accent-color)' : 'var(--text-secondary)'};">
            ${isCurrent ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-bars drag-handle" style="cursor:grab; font-size:12px;"></i>'}
        </div>
        <div>
            <div class="q-title">${track.Name}</div>
            <div class="q-artist">${track.Artists?.join(', ') || ''}</div>
        </div>
        <div class="queue-controls">
            ${actionBtn}
        </div>
      `;
      
      el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', i); el.style.opacity = '0.5'; });
      el.addEventListener('dragend', () => el.style.opacity = '1');
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.style.borderTop = "2px solid var(--accent-color)"; });
      el.addEventListener('dragleave', () => el.style.borderTop = "none");
      el.addEventListener('drop', (e) => {
          e.preventDefault();
          el.style.borderTop = "none";
          const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
          if(!isNaN(fromIdx)) player.reorderQueue(fromIdx, i);
      });
      
      el.addEventListener('click', (e) => {
         if(e.target.closest('.rm-q')) {
             e.stopPropagation();
             player.removeFromQueue(i);
         } else if(!e.target.closest('.drag-handle')) {
             player.currentIndex = i;
             player.playTrack(track);
         }
      });
      container.appendChild(el);
    });
  }
}
const ui = new UIManager();
