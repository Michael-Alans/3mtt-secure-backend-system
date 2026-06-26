const dotenv = require('dotenv');
dotenv.config();

const REQUIRED_ENVS = ['PORT', 'NODE_ENV', 'ALLOWED_ORIGINS', 'JWT_SECRET'];

const missingEnvs = REQUIRED_ENVS.filter((key) => !process.env[key]);

if (missingEnvs.length > 0) {
  throw new Error(`CRITICAL STARTUP FAILURE: Missing required environment variables: ${missingEnvs.join(', ')}`);
}

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS.split(','),
  JWT_SECRET: process.env.JWT_SECRET,
};