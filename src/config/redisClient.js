import { createClient } from "redis";
import config from "./config.js";
import logger from "./logger.js";

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

redisClient.on("error", (err) => {
  logger.error("Redis client error: ", err);
});

redisClient.on("end", () => {
  logger.warn("Redis connection ended");
});

redisClient.on("reconnecting", () => {
  logger.warn("Redis reconnecting...");
});

redisClient.on("ready", () => {
  logger.info("Redis ready");
});

redisClient.on("connect", () => {
  logger.info("Redis connected");
});

// Moving this functionality to the server.js file so all the shutdown logic is in one place
// const shutdown = async () => {
//   try {
//     await redisClient.quit();

//     logger.info("Redis disconnected gracefully");

//     process.exit(0);
//   } catch (err) {
//     logger.error("Redis shutdown failed: ", err);

//     process.exit(1);
//   }
// };

// process.on("SIGINT", shutdown);
// process.on("SIGTERM", shutdown);

export default redisClient;
