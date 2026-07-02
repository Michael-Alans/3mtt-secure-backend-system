const dotenv = require('dotenv');
const { z } = require('zod');
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.string().default('development'),
  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',')),
  JWT_SECRET: z.string().min(10),
  MONGO_URI: z.string().default('mongodb://localhost:27017/secure-backend'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`CRITICAL STARTUP FAILURE: Invalid environment variables: ${parsedEnv.error.message}`);
}

module.exports = {
  PORT: parsedEnv.data.PORT,
  NODE_ENV: parsedEnv.data.NODE_ENV,
  ALLOWED_ORIGINS: parsedEnv.data.ALLOWED_ORIGINS,
  JWT_SECRET: parsedEnv.data.JWT_SECRET,
  MONGO_URI: parsedEnv.data.MONGO_URI,
  REDIS_URL: parsedEnv.data.REDIS_URL,
};