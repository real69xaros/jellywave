const express = require('express');
const router = express.Router();
const { initDB } = require('../db');
const crypto = require('crypto');

// Utility function to hash password using Node's native crypto
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, storedHash, storedSalt) {
  const hash = crypto.pbkdf2Sync(password, storedSalt, 1000, 64, 'sha512').toString('hex');
  return hash === storedHash;
}

// Register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  try {
    const db = await initDB();
    
    // Check if this is the first user. The first user becomes admin.
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    const role = userCount.count === 0 ? 'admin' : 'user';

    const isApproved = role === 'admin' ? 1 : 0;
    const { salt, hash } = hashPassword(password);
    const passwordString = `${salt}:${hash}`;

    const result = await db.run(
      'INSERT INTO users (username, password, role, is_approved) VALUES (?, ?, ?, ?)',
      [username, passwordString, role, isApproved]
    );

    const user = { id: result.lastID, username, role, is_approved: isApproved };
    req.session.user = user;
    
    await db.run('INSERT INTO logs (level, message, details) VALUES (?, ?, ?)', 
      ['info', 'User registered', JSON.stringify({ userId: user.id, username })]);

    res.json({ success: true, user });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  try {
    const db = await initDB();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const [storedSalt, storedHash] = user.password.split(':');
    if (!storedSalt || !storedHash || !verifyPassword(password, storedHash, storedSalt)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const sessionUser = { 
      id: user.id, 
      username: user.username, 
      role: user.role, 
      is_approved: user.is_approved,
      avatar_url: user.avatar_url,
      display_name: user.display_name
    };
    req.session.user = sessionUser;

    await db.run('INSERT INTO logs (level, message, details) VALUES (?, ?, ?)', 
      ['info', 'User logged in', JSON.stringify({ userId: user.id, username })]);

    res.json({ success: true, user: sessionUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get Session User
router.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
