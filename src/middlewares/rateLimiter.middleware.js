import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import logger from "../utils/logger.js";
import {
  GLOBAL_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  SPEED_LIMIT,
} from "../config/config.js";

const globalLimiter = rateLimit({
  windowMs: GLOBAL_RATE_LIMIT.windowMs,
  limit: GLOBAL_RATE_LIMIT.limit,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  handler(req, res) {
    logger.warn(
      { ip: req.ip, path: req.originalUrl },
      "Global rate limit exceeded"
    );

    res.status(429).json({
      status: "error",
      message: "Too many requests. Try again later.",
    });
  },
});

const speedLimiter = slowDown({
  windowMs: SPEED_LIMIT.windowMs,
  delayAfter: SPEED_LIMIT.delayAfter,
  delayMs: SPEED_LIMIT.delayMs,
});

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT.windowMs,
  limit: AUTH_RATE_LIMIT.limit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,

  handler(req, res) {
    logger.warn({ ip: req.ip }, "Auth brute-force protection triggered");

    res.status(429).json({
      status: "error",
      message: "Too many login attempts.",
    });
  },
});

export { globalLimiter, speedLimiter, authLimiter };
