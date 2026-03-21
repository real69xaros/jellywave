const express = require('express');
const router = express.Router();
const { initDB } = require('../db');

router.use((req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// Favorites
router.get('/favorites', async (req, res) => {
  const db = await initDB();
  const favorites = await db.all('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
  res.json({ favorites });
});

router.post('/favorites', async (req, res) => {
  const { item_id, item_type, name } = req.body;
  const db = await initDB();
  await db.run('INSERT INTO favorites (user_id, item_id, item_type, name) VALUES (?, ?, ?, ?)', [req.session.user.id, item_id, item_type, name]);
  res.json({ success: true });
});

router.delete('/favorites/:itemId', async (req, res) => {
  const db = await initDB();
  await db.run('DELETE FROM favorites WHERE user_id = ? AND item_id = ?', [req.session.user.id, req.params.itemId]);
  res.json({ success: true });
});

// Recently Played
router.get('/recently-played', async (req, res) => {
  const db = await initDB();
  const recent = await db.all('SELECT * FROM recently_played WHERE user_id = ? ORDER BY played_at DESC LIMIT 50', [req.session.user.id]);
  res.json({ recent });
});

router.post('/recently-played', async (req, res) => {
  const { item_id, item_type, name } = req.body;
  const db = await initDB();
  await db.run('INSERT INTO recently_played (user_id, item_id, item_type, name) VALUES (?, ?, ?, ?)', [req.session.user.id, item_id, item_type, name]);
  res.json({ success: true });
});

module.exports = router;
