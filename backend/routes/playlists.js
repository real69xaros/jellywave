const express = require('express');
const router = express.Router();
const { initDB } = require('../db');

router.use((req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

router.get('/', async (req, res) => {
  const db = await initDB();
  const playlists = await db.all(`
    SELECT p.*, u.username as creator_name, u.display_name as creator_display, u.avatar_url as creator_avatar 
    FROM playlists p 
    JOIN users u ON p.user_id = u.id 
    WHERE user_id = ? ORDER BY created_at DESC
  `, [req.session.user.id]);
  res.json({ playlists });
});

router.get('/public', async (req, res) => {
  const db = await initDB();
  const playlists = await db.all(`
    SELECT p.*, u.username as creator_name, u.display_name as creator_display, u.avatar_url as creator_avatar 
    FROM playlists p 
    JOIN users u ON p.user_id = u.id 
    WHERE p.is_public = 1 
    ORDER BY p.created_at DESC
  `);
  res.json({ playlists });
});

router.post('/', async (req, res) => {
  const { name, is_public, description, cover_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  
  const db = await initDB();
  const result = await db.run(
      'INSERT INTO playlists (user_id, name, is_public, description, cover_url) VALUES (?, ?, ?, ?, ?)', 
      [req.session.user.id, name, is_public ? 1 : 0, description || '', cover_url || '']
  );
  res.json({ success: true, id: result.lastID });
});

router.get('/:id', async (req, res) => {
  const db = await initDB();
  const playlist = await db.get(`
    SELECT p.*, u.username as creator_name, u.display_name as creator_display, u.avatar_url as creator_avatar 
    FROM playlists p 
    JOIN users u ON p.user_id = u.id 
    WHERE p.id = ?
  `, [req.params.id]);
  
  if (!playlist) return res.status(404).json({error: 'Not found'});
  
  if (playlist.user_id !== req.session.user.id && !playlist.is_public) {
      return res.status(403).json({error: 'Forbidden'});
  }
  res.json({ playlist });
});

router.delete('/:id', async (req, res) => {
  const db = await initDB();
  await db.run('DELETE FROM playlists WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
  res.json({ success: true });
});

router.put('/:id', async (req, res) => {
    const { name, is_public, description, cover_url } = req.body;
    const db = await initDB();
    const playlist = await db.get('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
    if (!playlist) return res.status(403).json({ error: 'Not authorized or not found' });
    
    const newName = name !== undefined ? name : playlist.name;
    const newPublic = is_public !== undefined ? (is_public ? 1 : 0) : playlist.is_public;
    const newDesc = description !== undefined ? description : playlist.description;
    const newCover = cover_url !== undefined ? cover_url : playlist.cover_url;
    
    await db.run(
        'UPDATE playlists SET name = ?, is_public = ?, description = ?, cover_url = ? WHERE id = ?',
        [newName, newPublic, newDesc, newCover, req.params.id]
    );
    res.json({ success: true, updated: { name: newName, is_public: newPublic, description: newDesc, cover_url: newCover } });
});

router.get('/:id/tracks', async (req, res) => {
  const db = await initDB();
  const tracks = await db.all('SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY added_at ASC', [req.params.id]);
  res.json({ tracks });
});

router.post('/:id/tracks', async (req, res) => {
  const { track_id, title } = req.body;
  const db = await initDB();
  
  // Verify ownership
  const playlist = await db.get('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
  if (!playlist) return res.status(403).json({ error: 'Not authorized or playlist not found' });

  await db.run('INSERT INTO playlist_tracks (playlist_id, track_id, title) VALUES (?, ?, ?)', [req.params.id, track_id, title]);
  res.json({ success: true });
});

router.delete('/:id/tracks/:trackId', async (req, res) => {
  const db = await initDB();
  await db.run('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [req.params.id, req.params.trackId]);
  res.json({ success: true });
});

module.exports = router;
