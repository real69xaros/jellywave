const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const config = require('./config');
const { initDB } = require('./db');

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
app.use('/api/profile', profileRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/user-data', userDataRoutes);
app.use('/api/admin', adminRoutes);

async function startServer() {
  await initDB();
  console.log('SQLite internal app DB initialized.');

  if (require.main === module) {
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`JellyWave backend listening on port ${config.port}`);
    });
  }
  return app;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };
