import { createLogger, format, transports } from "winston";
import config from "./config.js";

const { combine, timestamp, errors, colorize, printf, json } = format;

// Fields that are NEVER written to logs
const REDACTED = new Set([
  "password",
  "passwordconfirm",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "authorization",
  "cookie",
  "creditcard",
  "ssn",
  "cvv",
  "sessionid",
]);

const redactSecrets = format((info) => {
  const redact = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    for (const key of Object.keys(obj)) {
      if (REDACTED.has(key.toLowerCase())) obj[key] = "[REDACTED]";
      else if (typeof obj[key] === "object") redact(obj[key]);
    }
    return obj;
  };
  return redact(info);
});

// Makes Error objects readable inside JSON.stringify
// Error properties (message, stack) are non-enumerable so {} without this
function serializeError(key, value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.statusCode && { statusCode: value.statusCode }),
      ...(value.errors?.length && { errors: value.errors }),
      ...(value.code && { code: value.code }),
    };
  }
  return value;
}

const devFormat = combine(
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf((info) => {
    const { level, message, timestamp, stack, ...meta } = info;

    // Colorize only when stdout is a real TTY (terminal)
    // Avoids ANSI escape codes appearing raw in Postman / log files
    const lvl = process.stdout.isTTY
      ? colorize().colorize(level, level.toUpperCase())
      : level.toUpperCase();

    // Serialize metadata if present (err, ip, path, etc.)
    const metaStr = Object.keys(meta).length
      ? "\n" + JSON.stringify(meta, serializeError, 2)
      : "";

    return `${timestamp} [${lvl}]: ${stack || message}${metaStr}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  redactSecrets(),
  json()
);

const logger = createLogger({
  level:
    config.logLevel || (config.nodeEnv === "production" ? "warn" : "debug"),
  format: config.nodeEnv === "production" ? prodFormat : devFormat,
  transports: [new transports.Console()],
  exitOnError: false,
});

export default logger;
