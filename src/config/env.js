const dotenv = require('dotenv');
const { z } = require('zod');
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.string().default('development'),
  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',')),
  JWT_SECRET: z.string().min(10),
  DB_URL: z.string().url().default('postgresql://user:pass@localhost:5432/db'), // default to pass if missing in test
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
  DB_URL: parsedEnv.data.DB_URL,
};