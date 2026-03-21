require('dotenv').config();

module.exports = {
  port: process.env.SERVER_PORT || process.env.PORT || process.env.APP_PORT || 1075,
  sessionSecret: process.env.SESSION_SECRET || 'fallback_secret_for_dev_only',
  dbPath: process.env.DATABASE_PATH || './data/app.db',
  jellyfin: {
    url: process.env.JELLYFIN_URL || '',
    username: process.env.JELLYFIN_USERNAME || '',
    password: process.env.JELLYFIN_PASSWORD || ''
  }
};
