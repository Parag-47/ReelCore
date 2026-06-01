import { createClient } from "redis";
import config from "./config.js";
import logger from "./logger.js";

let isShuttingDown = false;

const redisClient = createClient({
  url: config.redisURI,

  socket: {
    connectTimeout: 10000,
    keepAlive: 5000,

    reconnectStrategy: (retries) => {
      if (isShuttingDown) {
        return false;
      }

      if (retries > 20) {
        logger.error("Redis max reconnection attempts reached");
        return false;
      }

      const delay = Math.min(retries * 200, 5000);

      logger.warn(
        `Redis reconnect attempt #${retries}. Retrying in ${delay}ms`
      );

      return delay;
    },
  },
});

// ----------------------------
// Event Listeners
// ----------------------------

redisClient.on("connect", () => {
  logger.info("✅ Redis connected");
});

redisClient.on("ready", () => {
  logger.info("✅ Redis ready");
});

redisClient.on("reconnecting", () => {
  if (!isShuttingDown) {
    logger.warn("🔄 Redis reconnecting...");
  }
});

redisClient.on("end", () => {
  logger.warn("⚠️ Redis connection closed");
});

redisClient.on("error", (err) => {
  logger.error("❌ Redis Error:", err);
});

// ----------------------------
// Connect Function
// ----------------------------

export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      logger.info("🚀 Redis connection established");
    }
  } catch (error) {
    logger.error("Failed to connect Redis:", error);
    process.exit(1);
  }
};

// ----------------------------
// Graceful Shutdown Function
// ----------------------------

export const disconnectRedis = async () => {
  try {
    isShuttingDown = true;

    if (redisClient.isOpen) {
      await redisClient.quit();
      logger.info("✅ Redis disconnected gracefully");
    }
  } catch (error) {
    logger.error("❌ Redis shutdown failed:", error);
  }
};

export default redisClient;




