// Short-lived single-use tokens for direct (non-tunneled) stream access
const tokens = new Map();

module.exports = {
  create(itemId) {
    const token = require('crypto').randomBytes(20).toString('hex');
    tokens.set(token, { itemId, expires: Date.now() + 5 * 60 * 1000 });
    setTimeout(() => tokens.delete(token), 5 * 60 * 1000);
    return token;
  },
  consume(token) {
    const entry = tokens.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expires) { tokens.delete(token); return null; }
    return entry.itemId; // time-limited, not single-use
  }
};
