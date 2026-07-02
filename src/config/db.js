const mongoose = require('mongoose');
const env = require('./env');

/**
 * Connect to MongoDB using Mongoose.
 * Uses the MONGO_URI environment variable validated by Zod at startup.
 * Exits the process on connection failure to prevent running without persistence.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
