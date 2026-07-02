const mongoose = require('mongoose');

/**
 * Item Schema
 * - Indexes on createdAt and createdBy for efficient pagination and filtering.
 * - createdBy references the User model for relational queries.
 */
const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Index for filtering items by user
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ─── Compound index for efficient paginated queries sorted by creation date ──
itemSchema.index({ createdAt: -1 });
itemSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('Item', itemSchema);
