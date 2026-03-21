const express = require('express');
const router = express.Router();
const axios = require('axios');
const catalogService = require('../jellyfinService'); // Retained internal module name, acts as CatalogService

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.use(requireAuth);

router.get('/artists', async (req, res) => {
  const artists = await catalogService.getArtists();
  res.json({ artists });
});

router.get('/albums', async (req, res) => {
  const albums = await catalogService.getAlbums(req.query.artistId);
  res.json({ albums });
});

router.get('/artist/:id', async (req, res) => {
    const artist = await catalogService.getArtist(req.params.id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    res.json({ artist });
});

router.get('/songs', async (req, res) => {
  const songs = await catalogService.getSongs(req.query.albumId, req.query.artistId);
  res.json({ songs });
});

router.get('/search', async (req, res) => {
  const results = await catalogService.search(req.query.q || '');
  res.json(results);
});

router.post('/items', async (req, res) => {
    const { ids } = req.body;
    if(!ids || !Array.isArray(ids)) return res.json({ items: [] });
    const items = await catalogService.getItemsByIds(ids);
    res.json({ items });
});

// The absolute most critical change:
// Proxying the Audio Stream to hide the actual Jellyfin server completely
router.get('/stream/:id', async (req, res) => {
  const url = catalogService.getInternalStreamUrl(req.params.id);
  if (!url) return res.status(404).send('Not found');

  const headers = {};
  if (req.headers.range) headers['Range'] = req.headers.range;

  try {
    const response = await axios({
      method: 'GET',
      url: url,
      headers: headers,
      responseType: 'stream',
      validateStatus: (status) => status >= 200 && status < 400
    });

    const allowedHeaders = ['content-type', 'content-length', 'accept-ranges', 'content-range', 'cache-control'];
    for (const key of allowedHeaders) {
      if (response.headers[key]) {
        res.setHeader(key, response.headers[key]);
      }
    }
    
    res.status(response.status);
    response.data.pipe(res);
  } catch (err) {
    console.error('Stream Proxy Error:', err.message);
    if (!res.headersSent) res.status(500).send('Stream error');
  }
});

// Proxying Artwork
router.get('/artwork/:id', async (req, res) => {
    const url = catalogService.getInternalArtworkUrl(req.params.id);
    if(!url) return res.status(404).send('Not found');
    try {
        const response = await axios({ method: 'GET', url, responseType: 'stream' });
        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        response.data.pipe(res);
    } catch(e) {
        res.status(404).send('');
    }
});

module.exports = router;
