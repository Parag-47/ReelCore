import ENV from "./env.config.js";
import redisStore from "../providers/redisSessionStore.js";

const SESSION_NAME = ENV.NODE_ENV === "production" ? "__Host-sid" : "sid";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.nodeEnv === "production",
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

export {
  ENV,
  SESSION_NAME,
  SESSION_OPTIONS,
  COOKIE_OPTIONS,
  RESEND_CONFIG,
  GLOBAL_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  SPEED_LIMIT,
};
