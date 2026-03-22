const express = require('express');
const router = express.Router();
const { initDB } = require('../db');

router.use((req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

router.get('/users', async (req, res) => {
  const db = await initDB();
  const users = await db.all('SELECT id, username, role, created_at, is_approved, display_name FROM users');
  res.json({ users });
});

router.post('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  const db = await initDB();
  await db.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  res.json({ success: true });
});

router.post('/users/:id/approve', async (req, res) => {
  const db = await initDB();
  await db.run('UPDATE users SET is_approved = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

router.post('/users/:id/revoke', async (req, res) => {
  const db = await initDB();
  await db.run('UPDATE users SET is_approved = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

router.get('/logs', async (req, res) => {
  const db = await initDB();
  const logs = await db.all('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100');
  res.json({ logs });
});

router.get('/stats', async (req, res) => {
  const db = await initDB();
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  const playlistCount = await db.get('SELECT COUNT(*) as count FROM playlists');
  res.json({
    users: userCount.count,
    playlists: playlistCount.count,
    systemReady: true
  });
});

module.exports = router;
