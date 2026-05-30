import mongoose from "mongoose";
import config from "./config.js";
import logger from "./logger.js";

const connectDB = async () => {
  mongoose.set("sanitizeFilter", true); // Primary NoSQL injection guard
  mongoose.set("strict", true); // Reject fields not in schema
  mongoose.set("strictQuery", true); // Reject unknown query fields
  mongoose.set("bufferCommands", false); // Fail fast if DB is down

  const conn = await mongoose.connect(config.dbURI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 45_000,
    connectTimeoutMS: 10_000,
    // tls: true,  by default it's set to true
  });

  logger.info(`MongoDB connected: ${conn.connection.host}`);

  mongoose.connection.on("error", (err) =>
    logger.error({ err }, "MongoDB error")
  );
  mongoose.connection.on("disconnected", () =>
    logger.warn("MongoDB disconnected")
  );
  mongoose.connection.on("reconnected", () =>
    logger.info("MongoDB reconnected")
  );

  return conn;
};

export default connectDB;
