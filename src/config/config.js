import Joi from "joi";

const envVarsSchema = Joi.object({
  // APP
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().port().default(5000),
  APP_NAME: Joi.string().required(),
  API_PREFIX: Joi.string().default("/api/v1"),

  // DATABASE
  DATABASE_URL: Joi.string()
    .required()
    .description("MongoDB connection string"),

  // REDIS
  // REDIS_HOST: Joi.string().default("localhost"),
  // REDIS_PORT: Joi.number().port().default(6379),
  // REDIS_PASSWORD: Joi.string().allow("").default(""),
  REDIS_URI: Joi.string().required(),

  // SESSION SECRETES
  SESSION_SECRET: Joi.string().min(32).required(),
  SESSION_ENCRYPT_SECRET: Joi.string().min(32).required(),

  // COOKIE & CSRF SECRETE
  COOKIE_SECRET: Joi.string().min(32).required(),
  CSRF_SECRET: Joi.string().min(32).required(),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().required(),

  // BCRYPT
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(8).max(15).default(12),

  // STORAGE (S3 / MINIO)
  S3_ACCESS_KEY: Joi.string().allow("").default(""),
  S3_SECRET_KEY: Joi.string().allow("").default(""),
  S3_REGION: Joi.string().default("ap-south-1"),
  S3_BUCKET: Joi.string().required(),
  S3_ENDPOINT: Joi.string().allow("").default(""),

  // CORS
  ALLOWED_ORIGINS: Joi.string().required(),

  // LOGGING
  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "info", "debug")
    .default("info"),

  // RATE LIMITING
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().positive().default(100),

  // VIDEO PROCESSING
  FFMPEG_PATH: Joi.string().default("ffmpeg"),
  FFPROBE_PATH: Joi.string().default("ffprobe"),

  // QUEUES
  VIDEO_PROCESSING_QUEUE: Joi.string().required(),
  RECOMMENDATION_QUEUE: Joi.string().required(),
  ANALYTICS_QUEUE: Joi.string().required(),

  // ANALYTICS
  ENABLE_ANALYTICS: Joi.boolean().default(true),

  // FEATURE FLAGS
  ENABLE_RECOMMENDATION_ENGINE: Joi.boolean().default(true),
  ENABLE_VIDEO_TRANSCODING: Joi.boolean().default(true),
}).unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: "key" } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  name: envVars.APP_NAME,
  nodeEnv: envVars.NODE_ENV,
  port: envVars.PORT,
  apiPrefix: envVars.API_PREFIX,

  dbURI: envVars.DATABASE_URL,
  redisURI: envVars.REDIS_URI,

  sessionSecret: envVars.SESSION_SECRET,
  sessionEncryptSecret: envVars.SESSION_ENCRYPT_SECRET,

  cookieSecret: envVars.COOKIE_SECRET,
  csrfSecret: envVars.CSRF_SECRET,

  jwt: {
    accessSecret: envVars.JWT_ACCESS_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    accessExpiresIn: envVars.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },

  saltRounds: envVars.BCRYPT_SALT_ROUNDS,

  // storage: {
  //   accessKey: envVars.S3_ACCESS_KEY,
  //   secretKey: envVars.S3_SECRET_KEY,
  //   region: envVars.S3_REGION,
  //   bucket: envVars.S3_BUCKET,
  //   endpoint: envVars.S3_ENDPOINT || null,
  // },

  allowedOrigins: envVars.CORS_ORIGIN,

  logLevel: envVars.LOG_LEVEL,

  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },

  // video: {
  //   ffmpegPath: envVars.FFMPEG_PATH,
  //   ffprobePath: envVars.FFPROBE_PATH,
  // },

  // queues: {
  //   videoProcessing: envVars.VIDEO_PROCESSING_QUEUE,
  //   recommendation: envVars.RECOMMENDATION_QUEUE,
  //   analytics: envVars.ANALYTICS_QUEUE,
  // },

  // analytics: {
  //   enabled: envVars.ENABLE_ANALYTICS,
  // },

  // features: {
  //   recommendationEngine: envVars.ENABLE_RECOMMENDATION_ENGINE,
  //   videoTranscoding: envVars.ENABLE_VIDEO_TRANSCODING,
  // },
};

export default config;
