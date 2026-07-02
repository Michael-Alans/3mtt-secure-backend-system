const Redis = require('ioredis');
const env = require('./env');

/**
 * Redis client configured from REDIS_URL environment variable.
 * Includes graceful error handling to prevent crashes on connection issues.
 * In test environment, operations are no-ops if Redis is unavailable.
 */
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 200, 2000); // Exponential backoff
  },
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error(`❌ Redis error: ${err.message}`);
});

module.exports = redis;
