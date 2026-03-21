const express = require('express');
const router = express.Router();
const jellyfinService = require('../jellyfinService');

router.use((req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

router.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json({ artists: [], albums: [], songs: [] });
  
  const results = await jellyfinService.search(query);
  res.json(results);
});

module.exports = router;
