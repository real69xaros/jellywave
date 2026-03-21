const API_BASE = '/api';

class ApiClient {
  async req(endpoint, method = 'GET', body = null) {
    const opts = { method, headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    let data;
    try { data = await res.json(); } catch(e) { data = null; }
    if (!res.ok) throw new Error(data?.error || `API Error: ${res.statusText}`);
    return data;
  }

  // Auth
  checkAuth() { return this.req('/auth/me'); }
  login(username,password) { return this.req('/auth/login', 'POST', {username,password}); }
  register(username,password) { return this.req('/auth/register', 'POST', {username,password}); }
  logout() { return this.req('/auth/logout', 'POST'); }

  // Catalog Engine
  getArtists() { return this.req('/catalog/artists'); }
  getArtist(artistId) { return this.req(`/catalog/artist/${artistId}`); }
  getAlbums(artistId) { return this.req(artistId ? `/catalog/albums?artistId=${artistId}` : '/catalog/albums'); }
  getSongs(albumId, artistId) {
      if(albumId) return this.req(`/catalog/songs?albumId=${albumId}`);
      if(artistId) return this.req(`/catalog/songs?artistId=${artistId}`);
      return this.req('/catalog/songs');
  }
  getStreamUrl(itemId) { return `${API_BASE}/catalog/stream/${itemId}`; }
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
