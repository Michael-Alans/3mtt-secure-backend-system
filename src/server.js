const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');

/**
 * Server boot sequence:
 * 1. Connect to MongoDB
 * 2. Redis connects automatically on import (via ioredis)
 * 3. Start Express server on configured port
 *
 * app.js remains a pure Express app (exported for supertest).
 * server.js handles infrastructure connections and process startup.
 */
const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Start Express
  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
};

startServer();
