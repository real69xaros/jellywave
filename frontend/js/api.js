const IS_ELECTRON = !!window.electronAPI;
const IS_LOCAL_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = IS_LOCAL_DEV && !IS_ELECTRON && !window.Capacitor ? '/api' : 'https://jellywave.verbelnodes.com/api';

class ApiClient {
  constructor() {
    this._cache = new Map();
    this._streamUrlCache = new Map();
  }

  async req(endpoint, method = 'GET', body = null, { cache = false } = {}) {
    if (cache && method === 'GET' && this._cache.has(endpoint)) {
      return this._cache.get(endpoint);
    }
    const opts = { method, headers: {}, credentials: 'include' };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    let data;
    try { data = await res.json(); } catch(e) { data = null; }
    if (!res.ok) throw new Error(data?.error || `API Error: ${res.statusText}`);
    if (cache && method === 'GET') this._cache.set(endpoint, data);
    return data;
  }

  bust(endpoint) { this._cache.delete(endpoint); }

  // Auth
  checkAuth() { return this.req('/auth/me'); }
  login(username,password) { return this.req('/auth/login', 'POST', {username,password}); }
  register(username,password) { return this.req('/auth/register', 'POST', {username,password}); }
  logout() { return this.req('/auth/logout', 'POST'); }

  // Catalog Engine
  getArtists() { return this.req('/catalog/artists', 'GET', null, { cache: true }); }
  getArtist(artistId) { return this.req(`/catalog/artist/${artistId}`, 'GET', null, { cache: true }); }
  getAlbums(artistId) { return this.req(artistId ? `/catalog/albums?artistId=${artistId}` : '/catalog/albums', 'GET', null, { cache: true }); }
  getSongs(albumId, artistId) {
      if(albumId) return this.req(`/catalog/songs?albumId=${albumId}`, 'GET', null, { cache: true });
      if(artistId) return this.req(`/catalog/songs?artistId=${artistId}`, 'GET', null, { cache: true });
      return this.req('/catalog/songs', 'GET', null, { cache: true });
  }
  getStreamUrl(itemId) { return `${API_BASE}/catalog/stream/${itemId}`; }
  async getDirectStreamUrl(itemId) {
    if (!IS_ELECTRON) return this.getStreamUrl(itemId);
    if (this._streamUrlCache.has(itemId)) return this._streamUrlCache.get(itemId);
    try {
      const data = await this.req(`/catalog/stream-token/${itemId}`);
      this._streamUrlCache.set(itemId, data.url);
      setTimeout(() => this._streamUrlCache.delete(itemId), 4 * 60 * 1000);
      return data.url;
    } catch(e) {
      return this.getStreamUrl(itemId);
    }
  }
  getArtworkUrl(itemId) { return `${API_BASE}/catalog/artwork/${itemId}`; }
  
  async getOnlineArtwork(term) {
      if(!term) return null;
      try {
          const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=1`);
          const data = await res.json();
          if(data.results && data.results.length > 0) {
              return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
          }
      } catch(e) {}
      return null;
  }
  
  search(query) { return this.req(`/catalog/search?q=${encodeURIComponent(query)}`); }
  getItems(idsArray) { return this.req('/catalog/items', 'POST', { ids: idsArray }); }

  // Playlists
  getPlaylists() { return this.req('/playlists'); }
  getPublicPlaylists() { return this.req('/playlists/public'); }
  getPlaylistData(id) { return this.req(`/playlists/${id}`); }
  createPlaylist(name, is_public = false, description = '', cover_url = '') { return this.req('/playlists', 'POST', { name, is_public, description, cover_url }); }
  updatePlaylist(id, payload) { return this.req(`/playlists/${id}`, 'PUT', payload); }
  deletePlaylist(id) { return this.req(`/playlists/${id}`, 'DELETE'); }
  getPlaylistTracks(id) { return this.req(`/playlists/${id}/tracks`); }
  addPlaylistTrack(id, trackId, title) { return this.req(`/playlists/${id}/tracks`, 'POST', { track_id: trackId, title }); }
  removePlaylistTrack(id, trackId) { return this.req(`/playlists/${id}/tracks/${trackId}`, 'DELETE'); }

  // User Data (Favorites/Recent)
  getFavorites() { return this.req('/user-data/favorites'); }
  addFavorite(itemId, itemType, name) { return this.req('/user-data/favorites', 'POST', { item_id: itemId, item_type: itemType, name }); }
  removeFavorite(itemId) { return this.req(`/user-data/favorites/${itemId}`, 'DELETE'); }
  getRecent() { return this.req('/user-data/recently-played'); }
  addRecent(itemId, itemType, name) { return this.req('/user-data/recently-played', 'POST', { item_id: itemId, item_type: itemType, name }); }

  // Admin
  getAdminStats() { return this.req('/admin/stats'); }
}
const api = new ApiClient();
