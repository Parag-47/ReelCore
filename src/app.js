import express from "express";
import helmet from "helmet";
import cors from "cors";
import timeout from "connect-timeout";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import hpp from "hpp";
import session from "express-session";
import { doubleCsrf } from "csrf-csrf";
import morgan from "morgan";

import config from "./config/config.js";
import logger from "./config/logger.js";
import redisStore from "./config/redisSessionStore.js";
import errorHandler from "./middlewares/errorHandler.js";

const app = express();

// app.set("trust proxy", 1); //Set to 1 only if exactly one reverse proxy sits in front
app.disable("x-powered-by");

// app.use(
//   helmet({
//     crossOriginResourcePolicy: { policy: 'same-site' },
//   })
// );

// app.use(
//   helmet({
//     contentSecurityPolicy: false,      // CSP disabled because this is a JSON API, not a rendered app.
//     crossOriginEmbedderPolicy: false,  // COEP disabled because it breaks some integrations/tools.
//   })
// );

app.use(helmet()); //For now only using default config

// Don't know if it's needed
// app.use((req, res, next) => {
//   if (
//     config.nodeEnv === 'production' &&
//     !req.secure
//   ) {
//     return res.redirect(301, `https://${req.headers.host}${req.url}`);
//   }

//   next();
// });

// CORS
const ALLOWED_ORIGINS = (config.allowedOrigins ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        return cb(null, true);
      }

      cb(
        Object.assign(new Error(`CORS blocked: ${origin}`), {
          statusCode: 403,
        })
      );
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-csrf-token"],
    maxAge: 600,
  })
);

// REQUEST TIMEOUT
app.use(timeout("10s")); // Helps mitigate slowloris/resource exhaustion attacks.
app.use((req, _res, next) => {
  if (!req.timedout) next();
});

//  BODY PARSERS
app.use(express.json({ limit: "10kb" }));
app.use(
  express.urlencoded({
    extended: false, // Avoids unnecessary nested parsing, turn it on if nested parsing is needed
    limit: "10kb",
  })
);

// INVALID JSON HANDLER
// Must come immediately after body parsers.
// app.use((err, _req, res, next) => {
//   if (
//     err instanceof SyntaxError &&
//     err.status === 400 &&
//     'body' in err
//   ) {
//     logger.warn('Malformed JSON payload');  // Need more research on this...

//     return res.status(400).json({
//       status: 'error',
//       message: 'Invalid JSON payload',
//     });
//   }

//   next(err);
// });

// NOSQL SANITIZATION
const isPlainObject = (value) => {
  // Move this into utils
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const sanitizeValue = (root) => {
  // Move this into utils
  // Primitives (including null) are returned directly
  if (!root || typeof root !== "object") {
    return root;
  }

  const seen = new WeakMap(); // source -> clone (or atomic passthrough)
  const stack = []; // work items: { source, clone }

  /**
   * Initialise a clone for `value`, register it in `seen`, and push
   * a work item onto the stack if the value needs internal processing.
   * Returns the (possibly unfinished) clone immediately.
   */
  const initClone = (value) => {
    if (!value || typeof value !== "object") {
      return value; // primitives pass through
    }

    // Circular / repeated reference
    if (seen.has(value)) {
      return seen.get(value);
    }

    // Array
    if (Array.isArray(value)) {
      const clone = [];
      seen.set(value, clone);
      stack.push({ source: value, clone });
      return clone;
    }

    // Plain object – the only type we sanitize deeply
    if (isPlainObject(value)) {
      const clone = {};
      seen.set(value, clone);
      stack.push({ source: value, clone });
      return clone;
    }

    // Exotic objects (Date, Buffer, RegExp, etc.) – treat as atomic leaves
    // They are returned as-is. We still register them so that
    // repeated references to the same exotic object share identity.
    seen.set(value, value);
    return value;
  };

  // 1. Create the root clone (the entry point into the stack)
  const rootClone = initClone(root);

  // 2. Process the stack iteratively – no recursion, no call‑stack explosion
  while (stack.length > 0) {
    const { source, clone } = stack.pop();

    if (Array.isArray(source)) {
      // Copy every element, sanitizing each recursively
      for (let i = 0; i < source.length; i++) {
        clone[i] = initClone(source[i]);
      }
    } else {
      // Plain object – filter keys and sanitize values
      for (const key of Object.keys(source)) {
        // ----- Prototype pollution guard -----
        if (
          key === "__proto__" ||
          key === "constructor" ||
          key === "prototype"
        ) {
          logger.warn({ key }, "Blocked prototype pollution attempt");
          continue;
        }

        // ----- MongoDB operator guard -----
        if (key.startsWith("$") || key.includes(".")) {
          logger.warn({ key }, "Blocked suspicious MongoDB operator");
          continue;
        }

        // Recursively sanitize the value and assign it
        clone[key] = initClone(source[key]);
      }
    }
  }

  return rootClone;
};

// app.use((req, _res, next) => {
//   if (req.body) req.body = sanitizeValue(req.body);
//   if (req.query) req.query = sanitizeValue(req.query);
//   if (req.params) req.params = sanitizeValue(req.params);
//   next();
// });

// HTTP PARAMETER POLLUTION
app.use(
  hpp({
    whitelist: ["sort", "fields", "tags"],
  })
);

// REQUEST LOGGING
app.use(
  morgan("combined", {
    stream: {
      write: (msg) => logger.http(msg.trim()),
    },
    skip: () => config.nodeEnv === "test",
  })
);

const cookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === "production",
  // use "lax" for same-site SPA
  // use "none" only if frontend is cross-site
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  priority: "high",
  path: "/",
};

app.use(
  session({
    store: redisStore,
    name: "__Host-sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    proxy: config.nodeEnv === "production",
    cookie: cookieOptions,
  })
);

// CSRF
const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => config.csrfSecret,

  cookieName: "__Host-csrf",

  cookieOptions: {
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    httpOnly: true,
    path: "/",
  },

  size: 64,

  getTokenFromRequest: (req) => req.headers["x-csrf-token"],
});

app.set("generateCsrfToken", generateToken);

// RATE LIMITING
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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
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

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
});

app.use("/api", globalLimiter, speedLimiter);
app.use("/api/auth", authLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/auth/csrf-token", (req, res) => {
  const token = req.app.get("generateCsrfToken")(req);

  res.json({ csrfToken: token });
});

app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return doubleCsrfProtection(req, res, next);
  }

  next();
});

// Routes
// import authRoutes from './routes/auth.js';
// import userRoutes from './routes/users.js';

// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);

app.use((_req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

app.use(errorHandler);

export default app;
