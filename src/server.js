import http from "node:http";
import app from "./app.js";
import config from "./config/config.js";
import connectDB from "./config/mongo.js";
import redisClient from "./config/redisClient.js";
import logger from "./config/logger.js";

process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION — shutting down \n Error: ", err);
  process.exit(1);
});

const PORT = parseInt(config.port, 10) || 5000;
const server = http.createServer(app);

async function startServer() {
  try {
    await redisClient.connect();
    await connectDB();
    server.listen(PORT, () => {
      logger.info(
        `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
      );
    });
  } catch (err) {
    console.log(JSON.stringify(err, null, 2));
    logger.error(
      "Server initialization failed — shutting down...\n Error: ",
      err
    );
    process.exit(1);
  }
}

startServer();

// After server starts, catch unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  logger.error("UNHANDLED REJECTION — shutting down \n Reason: ", reason);
  shutdown("UNHANDLED_REJECTION");
});

const shutdown = (signal) => {
  logger.info(`${signal} received — graceful shutdown starting`);

  server.close(async () => {
    const mongoose = await import("mongoose");
    await mongoose.default.connection.close();
    await redisClient.quit();
    logger.info("MongoDB closed. Exiting.");
    process.exit(0);
  });

  // Force-kill if shutdown takes > 10s
  setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
