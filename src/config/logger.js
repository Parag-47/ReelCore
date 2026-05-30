import { createLogger, format, transports } from "winston";
import config from "./config.js";

const { combine, timestamp, errors, json, colorize, printf } = format;

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

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(
    ({ level, message, timestamp, stack }) =>
      `${timestamp} [${level}]: ${stack || message}`
  )
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
