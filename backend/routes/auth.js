const express = require('express');
const router = express.Router();
const { initDB } = require('../db');
const crypto = require('crypto');

async function createToken(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.run('INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)', [token, userId]);
  return token;
}

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
    const token = await createToken(db, user.id);

    await db.run('INSERT INTO logs (level, message, details) VALUES (?, ?, ?)',
      ['info', 'User registered', JSON.stringify({ userId: user.id, username })]);

    res.json({ success: true, user, token });
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
    const token = await createToken(db, user.id);

    await db.run('INSERT INTO logs (level, message, details) VALUES (?, ?, ?)',
      ['info', 'User logged in', JSON.stringify({ userId: user.id, username })]);

    res.json({ success: true, user: sessionUser, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try { const db = await initDB(); await db.run('DELETE FROM auth_tokens WHERE token = ?', [token]); } catch(e){}
  }
  req.session.destroy();
  res.json({ success: true });
});

// Get Session User
router.get('/me', async (req, res) => {
  if (req.session.user) {
    try {
      const db = await initDB();
      const token = await createToken(db, req.session.user.id);
      return res.json({ authenticated: true, user: req.session.user, token });
    } catch(e) {
      return res.json({ authenticated: true, user: req.session.user });
    }
  }
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const db = await initDB();
      const row = await db.get(
        'SELECT u.id, u.username, u.role, u.is_approved, u.avatar_url, u.display_name FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?',
        [token]
      );
      if (row) return res.json({ authenticated: true, user: row });
    } catch(e){}
  }
  res.json({ authenticated: false });
});

module.exports = router;
