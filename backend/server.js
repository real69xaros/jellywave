const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { initDB } = require('./db');
const streamTokens = require('./streamTokens');
const catalogService = require('./jellyfinService');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const catalogRoutes = require('./routes/catalog');
const libraryRoutes = require('./routes/library');
const playlistRoutes = require('./routes/playlists');
const userDataRoutes = require('./routes/userData');
const adminRoutes = require('./routes/admin');

const app = express();

app.set('trust proxy', 1); // Support Cloudflare proxies
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const dbDir = path.dirname(path.resolve(config.dbPath));

app.use(session({
  store: new SQLiteStore({
    dir: dbDir,
    db: 'sessions.db'
  }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Serve Public Homepage at Root
app.use(express.static(path.join(__dirname, '../homepage')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../homepage/index.html'));
});

// Serve the Web Player at /app
app.use('/app', express.static(path.join(__dirname, '../frontend')));
app.get('/app/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Approve check for data routes — supports both session cookies and Bearer tokens
async function requireApproved(req, res, next) {
  if (req.session.user) {
    if (!req.session.user.is_approved && req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Account pending approval' });
    }
    return next();
  }
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const { initDB } = require('./db');
      const db = await initDB();
      const row = await db.get(
        'SELECT u.id, u.username, u.role, u.is_approved, u.avatar_url, u.display_name FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?',
        [token]
      );
      if (row) {
        if (!row.is_approved && row.role !== 'admin') {
          return res.status(403).json({ error: 'Account pending approval' });
        }
        req.session.user = row; // make downstream routes work unchanged
        return next();
      }
    } catch(e) {}
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

app.use('/api/profile', requireApproved, profileRoutes);
app.use('/api/catalog', requireApproved, catalogRoutes);
app.use('/api/library', requireApproved, libraryRoutes);
app.use('/api/playlists', requireApproved, playlistRoutes);
app.use('/api/user-data', requireApproved, userDataRoutes);

// Direct stream server — bypasses Cloudflare tunnel, token-authenticated
const streamPort = process.env.STREAM_PORT || 1076;
const streamApp = express();
streamApp.use(cors({ origin: true, credentials: true }));

streamApp.get('/stream/:id', async (req, res) => {
  const itemId = streamTokens.consume(req.query.token);
  if (!itemId || itemId !== req.params.id) return res.status(401).send('Unauthorized');

  const url = catalogService.getInternalStreamUrl(itemId);
  if (!url) return res.status(404).send('Not found');

  const headers = {};
  if (req.headers.range) headers['Range'] = req.headers.range;

  try {
    const response = await axios({
      method: 'GET', url, headers,
      responseType: 'stream',
      validateStatus: s => s < 400
    });
    const allowed = ['content-type', 'content-length', 'accept-ranges', 'content-range'];
    for (const key of allowed) {
      if (response.headers[key]) res.setHeader(key, response.headers[key]);
    }
    res.status(response.status);
    response.data.pipe(res);
  } catch (e) {
    if (!res.headersSent) res.status(500).send('Stream error');
  }
});

async function startServer() {
  await initDB();
  console.log('SQLite internal app DB initialized.');

  if (process.env.STREAM_DIRECT_URL) {
    streamApp.listen(streamPort, '0.0.0.0', () => {
      console.log(`Direct stream server on port ${streamPort}`);
    });
  }

  return new Promise((resolve) => {
    const srv = app.listen(config.port, '0.0.0.0', () => {
      console.log(`JellyWave backend listening on port ${config.port}`);
      resolve(app);
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };
