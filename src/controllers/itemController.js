const Item = require('../models/Item');
const redis = require('../config/redis');

const CACHE_PREFIX = 'items';
const CACHE_TTL = 300; // 5 minutes

/**
 * Build a consistent cache key from query parameters.
 * Strategy: prefix:page=X&limit=Y ensures deterministic keys.
 */
const buildCacheKey = (query) => {
  const page = query.page || 1;
  const limit = query.limit || 10;
  return `${CACHE_PREFIX}:page=${page}&limit=${limit}`;
};

/**
 * GET /api/items — Paginated list with Redis read-through cache.
 * Accepts ?page=1&limit=10 query parameters.
 * Returns { data, page, limit, total, totalPages }.
 */
const getItems = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // ─── Read-through cache: check Redis first ─────────────────────────
    const cacheKey = buildCacheKey({ page, limit });
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (cacheErr) {
      // Redis unavailable — proceed without cache
      console.error(`Cache read error: ${cacheErr.message}`);
    }

    // ─── Cache miss: query MongoDB with skip/limit pagination ──────────
    const [items, total] = await Promise.all([
      Item.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('createdBy', 'name email'),
      Item.countDocuments(),
    ]);

    const response = {
      status: 'success',
      data: items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    // ─── Store in Redis with TTL ───────────────────────────────────────
    try {
      await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL);
    } catch (cacheErr) {
      console.error(`Cache write error: ${cacheErr.message}`);
    }

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve items.',
    });
  }
};

/**
 * POST /api/items — Create a new item.
 * Invalidates the items cache to prevent stale data.
 */
const createItem = async (req, res) => {
  try {
    const { title, description } = req.body;

    const item = await Item.create({
      title,
      description,
      createdBy: req.user.id,
    });

    // ─── Cache invalidation: delete all items:* keys ─────────────────
    try {
      const keys = await redis.keys(`${CACHE_PREFIX}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (cacheErr) {
      console.error(`Cache invalidation error: ${cacheErr.message}`);
    }

    res.status(201).json({
      status: 'success',
      message: 'Item created.',
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to create item.',
    });
  }
};

/**
 * DELETE /api/items/:id — Delete an item by ID.
 * Invalidates the items cache to prevent stale data.
 */
const deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        status: 'fail',
        error: 'Item not found.',
      });
    }

    await item.deleteOne();

    // ─── Cache invalidation: delete all items:* keys ─────────────────
    try {
      const keys = await redis.keys(`${CACHE_PREFIX}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (cacheErr) {
      console.error(`Cache invalidation error: ${cacheErr.message}`);
    }

    res.status(200).json({
      status: 'success',
      message: 'Item deleted.',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to delete item.',
    });
  }
};

module.exports = { getItems, createItem, deleteItem };
