import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import logger from "../config/logger.js";

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
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
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,

  handler(req, res) {
    loggerer.warn({ ip: req.ip }, "Auth brute-force protection triggered");

    res.status(429).json({
      status: "error",
      message: "Too many login attempts.",
    });
  },
});

export { globalLimiter, speedLimiter, authLimiter };
