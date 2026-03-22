const axios = require('axios');
const config = require('./config');

const axiosInstance = axios.create();

class CatalogService {
  constructor() {
    this.baseUrl = config.jellyfin.url;
    this.username = config.jellyfin.username;
    this.password = config.jellyfin.password;
    this.token = null;
    this.userId = null;
    this.cache = new Map();
    this.CACHE_TTL = 1000 * 60 * 5;
    
    // Automatically authenticate on boot if URL is set
    if (this.baseUrl) this.authenticate();
  }

  getAuthHeaders() {
    const headers = {
      'X-Emby-Authorization': `MediaBrowser Client="JellyWave Internal", Device="System", DeviceId="Internal-Catalog", Version="1.0.0"`,
      'Content-Type': 'application/json'
    };
    if (this.token) headers['X-Emby-Token'] = this.token;
    return headers;
  }

  async cachedRequest(key, fetcher) {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      if (Date.now() - entry.timestamp < this.CACHE_TTL) return entry.data;
    }
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  async authenticate() {
    if (!this.baseUrl || !this.username) return false;
    try {
      const response = await axiosInstance.post(`${this.baseUrl}/Users/AuthenticateByName`, {
        Username: this.username,
        Pw: this.password
      }, { headers: this.getAuthHeaders() });

      if (response.data && response.data.AccessToken) {
        this.token = response.data.AccessToken;
        this.userId = response.data.User.Id;
        return true;
      }
      return false;
    } catch (err) {
      console.error('Catalog internal backend sync failed:', err.message);
      return false;
    }
  }

  async getArtists() {
    if (!this.token) {
        const auth = await this.authenticate();
        if (!auth) return [];
    }
    
    return this.cachedRequest('artists', async () => {
      try {
        const response = await axiosInstance.get(`${this.baseUrl}/Artists`, {
          headers: this.getAuthHeaders(),
          params: { userId: this.userId, SortBy: 'SortName' }
        });
        return response.data.Items;
      } catch (err) {
        return [];
      }
    });
  }

  async getAlbums(artistId = null) {
      if (!this.token) return [];
      const cacheKey = artistId ? `albums_${artistId}` : 'albums';
      return this.cachedRequest(cacheKey, async () => {
          try {
              const params = { userId: this.userId, SortBy: 'SortName', IncludeItemTypes: 'MusicAlbum', Recursive: true };
              if (artistId) params.ArtistIds = artistId;
              const response = await axiosInstance.get(`${this.baseUrl}/Users/${this.userId}/Items`, {
                  headers: this.getAuthHeaders(),
                  params
              });
              return response.data.Items;
          } catch(e) {
              return [];
          }
      });
  }

  async getArtist(artistId) {
      if (!this.token) return null;
      return this.cachedRequest(`artist_${artistId}`, async () => {
          try {
              const response = await axiosInstance.get(`${this.baseUrl}/Users/${this.userId}/Items/${artistId}`, {
                  headers: this.getAuthHeaders()
              });
              return response.data;
          } catch(e) { return null; }
      });
  }

  async getSongs(albumId = null, artistId = null) {
      if (!this.token) return [];
      const cacheKey = albumId ? `songs_album_${albumId}` : (artistId ? `songs_artist_${artistId}` : 'songs');
      return this.cachedRequest(cacheKey, async () => {
          try {
              const params = { userId: this.userId, SortBy: 'PlayCount,SortName', SortOrder: 'Descending,Ascending', IncludeItemTypes: 'Audio', Recursive: true };
              if (albumId) params.ParentId = albumId;
              if (artistId) { params.ArtistIds = artistId; params.Limit = 200; } // Increased limit for all tracks
              const response = await axiosInstance.get(`${this.baseUrl}/Users/${this.userId}/Items`, {
                  headers: this.getAuthHeaders(),
                  params
              });
              return response.data.Items;
          } catch(e) {
              return [];
          }
      });
  }

  async search(query) {
    if (!this.token) return { artists: [], albums: [], songs: [] };
    try {
      const response = await axiosInstance.get(`${this.baseUrl}/Users/${this.userId}/Items`, {
        headers: this.getAuthHeaders(),
        params: {
          searchTerm: query,
          IncludeItemTypes: 'Audio,MusicAlbum,MusicArtist',
          Recursive: true,
          Limit: 20
        }
      });
      const items = response.data.Items || [];
      return {
        artists: items.filter(i => i.Type === 'MusicArtist'),
        albums: items.filter(i => i.Type === 'MusicAlbum'),
        songs: items.filter(i => i.Type === 'Audio')
      };
    } catch(e) {
      return { artists: [], albums: [], songs: [] };
    }
  }

  async getItemsByIds(idsArray) {
    if (!this.token || !idsArray || !idsArray.length) return [];
    
    // Create hash-like key since arrays can be unordered, sorting for deterministic cache
    const sortedIds = [...idsArray].sort().join(',');
    return this.cachedRequest(`items_${sortedIds}`, async () => {
      try {
        const response = await axiosInstance.get(`${this.baseUrl}/Users/${this.userId}/Items`, {
          headers: this.getAuthHeaders(),
          params: { Ids: idsArray.join(','), Recursive: true }
        });
        return response.data.Items || [];
      } catch (err) { return []; }
    });
  }

  getInternalStreamUrl(itemId) {
    if (!this.token) return '';
    return `${this.baseUrl}/Audio/${itemId}/stream?api_key=${this.token}&static=true`;
  }
  
  getInternalArtworkUrl(itemId) {
      if (!this.token) return '';
      return `${this.baseUrl}/Items/${itemId}/Images/Primary?api_key=${this.token}`;
  }
}

module.exports = new CatalogService();
