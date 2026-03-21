const express = require('express');
const router = express.Router();
const { initDB } = require('../db');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await initDB();
    const user = await db.get('SELECT id, username, role, created_at FROM users WHERE id = ?', [req.session.user.id]);
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
