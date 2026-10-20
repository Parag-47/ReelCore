import ENV from "./env.config.js";
import redisStore from "../providers/redisSessionStore.js";

const SESSION_NAME = ENV.NODE_ENV === "production" ? "__Host-sid" : "sid";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.NODE_ENV === "production",
  // use "lax" for same-site SPA
  // use "none" only if frontend is cross-site
  sameSite: "lax",
  maxAge: 15 * 60 * 1000, // 15 minutes
  priority: "high",
  path: "/",
};

const SESSION_OPTIONS = {
  store: redisStore,
  name: SESSION_NAME,
  secret: ENV.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: false,
  proxy: ENV.NODE_ENV === "production",
  cookie: COOKIE_OPTIONS,
};

const RESEND_CONFIG = {
  key: ENV.RESEND_KEY,
  emailFrom: "noreply@dev0.dpdns.org",
  emailSenderName: "ReelCore",
};

const OAUTH_CONFIG = {
  google: {
    clientId: ENV.GOOGLE_CLIENT_ID,
    clientSecret: ENV.GOOGLE_CLIENT_SECRET,
    redirectURI: ENV.GOOGLE_REDIRECT_URI,
  },
  github: {
    clientId: ENV.GITHUB_CLIENT_ID,
    clientSecret: ENV.GITHUB_CLIENT_SECRET,
    redirectURI: ENV.GITHUB_REDIRECT_URI,
  },
  postLoginRedirect: ENV.OAUTH_POST_LOGIN_REDIRECT,
};

const WEBAUTHN = {
  rpName: ENV.RP_NAME,
  rpID: ENV.RP_ID,
  origin: ENV.RP_ORIGIN,
};

// RATE LIMITING
const GLOBAL_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  limit: 100,
};

const AUTH_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  limit: 10,
};

const SPEED_LIMIT = {
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
};

const S3_STORAGE = {
  s3AccessKey: ENV.S3_ACCESS_KEY,
  s3SecretKey: ENV.S3_SECRET_KEY,
  s3Region: ENV.S3_REGION,
  s3Bucket: ENV.S3_BUCKET,
  s3Endpoint: ENV.S3_ENDPOINT,
};

export { default as ENV } from "./env.config.js";

export {
  SESSION_NAME,
  SESSION_OPTIONS,
  COOKIE_OPTIONS,
  RESEND_CONFIG,
  OAUTH_CONFIG,
  WEBAUTHN,
  GLOBAL_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  SPEED_LIMIT,
  S3_STORAGE,
};
