const redis = require('../config/redis');

/**
 * Cache Middleware Factory
 * Creates a read-through cache middleware for GET endpoints.
 *
 * @param {string} keyPrefix - Prefix for cache keys (e.g., 'items')
 * @param {number} ttlSeconds - Time-to-live in seconds (default: 300 = 5 min)
 * @returns {Function} Express middleware
 *
 * Cache Key Strategy: keyPrefix:originalUrl
 * Example: "items:/api/items?page=1&limit=10"
 */
const cacheMiddleware = (keyPrefix, ttlSeconds = 300) => {
  return async (req, res, next) => {
    const cacheKey = `${keyPrefix}:${req.originalUrl}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (err) {
      // Redis unavailable — continue without cache
      console.error(`Cache middleware error: ${err.message}`);
    }

    // Store original res.json to intercept and cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode === 200) {
        redis
          .set(cacheKey, JSON.stringify(body), 'EX', ttlSeconds)
          .catch((err) => console.error(`Cache set error: ${err.message}`));
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Invalidate all cache keys matching a prefix pattern.
 *
 * @param {string} keyPrefix - The prefix to match (e.g., 'items')
 */
const invalidateCache = async (keyPrefix) => {
  try {
    const keys = await redis.keys(`${keyPrefix}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error(`Cache invalidation error: ${err.message}`);
  }
};

module.exports = { cacheMiddleware, invalidateCache };
