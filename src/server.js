import http from "node:http";
import mongoose from "mongoose";
import app from "./app.js";
import config from "./config/config.js";
import connectDB from "./config/mongo.js";
import redisClient from "./config/redisClient.js";
import logger from "./config/logger.js";

process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION — terminating immediately", { err });
  process.exit(1);
});

// ─── Server bootstrap ─────────────────────────────────────────────────────────
const PORT = parseInt(config.port, 10) || 5000;
const server = http.createServer(app);

async function startServer() {
  try {
    await redisClient.connect();
    logger.info("Redis connected");

    await connectDB();
    logger.info("MongoDB connected");

    await new Promise((resolve, reject) => {
      server.listen(PORT, resolve);
      server.once("error", reject);
    });

    logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
  } catch (err) {
    logger.error("Server initialisation failed — terminating", { err });
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error("UNHANDLED REJECTION — initiating graceful shutdown", {
    reason,
  });
  shutdown("UNHANDLED_REJECTION").catch(() => process.exit(1));
});

await startServer();

let shutdownPromise = null;

async function shutdown(signal) {
  if (shutdownPromise) {
    logger.warn(
      `${signal} received while shutdown already in progress — waiting`
    );
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    logger.info(`${signal} received — graceful shutdown starting`);

    const forceExit = setTimeout(() => {
      logger.error("Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 10_000).unref();

    try {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info("HTTP server closed");

      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        logger.info("MongoDB connection closed");
      }

      if (redisClient?.isOpen) {
        await redisClient.quit();
        logger.info("Redis connection closed");
      }

      clearTimeout(forceExit);
      logger.info("Graceful shutdown complete — exiting");
      process.exit(0);
    } catch (err) {
      clearTimeout(forceExit);
      logger.error("Error during graceful shutdown", { err });
      process.exit(1);
    }
  })();

  return shutdownPromise;
}

process.on("SIGTERM", () => shutdown("SIGTERM").catch(() => process.exit(1)));
process.on("SIGINT", () => shutdown("SIGINT").catch(() => process.exit(1)));
