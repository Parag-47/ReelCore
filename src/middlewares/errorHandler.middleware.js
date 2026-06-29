import logger from "../config/logger.js";
import ApiError from "../shared/utils/ApiError.js";

const handleCastError = (e) =>
  new ApiError(400, `Invalid ${e.path}: ${e.value}`);
const handleDuplicateKey = (e) =>
  new ApiError(409, `Duplicate value for ${Object.keys(e.keyValue)[0]}`);
const handleValidationError = (e) =>
  new ApiError(
    400,
    Object.values(e.errors)
      .map((v) => v.message)
      .join(". ")
  );
const handleJWTError = () =>
  new ApiError(401, "Invalid session — please log in again");
const handleJWTExpired = () =>
  new ApiError(401, "Session expired — please log in again");

const sendDev = (err, res) =>
  res.status(err.statusCode ?? 500).json({
    success: false,
    status: "error",
    message: err.message,
    // only include errors array if present and non-empty
    ...(err.errors?.length && { errors: err.errors }),
    // stack: err.stack,
  });

const sendProd = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: "error",
      message: err.message,
      // Only expose errors array for 4xx client errors, never 5xx
      // Even then, only expose if it's a plain object array (not raw Error objects)
      // ...(err.statusCode < 500 && err.errors?.length && { errors: err.errors }),
    });
  }

  logger.error({ err }, "Unexpected server error");
  return res.status(500).json({
    success: false,
    status: "error",
    message: "Something went wrong. Please try again later.",
  });
};

const errorHandler = (err, req, res, _next) => {
  if ((err.statusCode ?? 500) >= 500) {
    logger.error("Server Error:", { err, ip: req.ip, path: req.path });
  } else {
    logger.warn("Client Error:", {
      status: err.statusCode,
      message: err.message,
      path: req.path,
      err,
    });
  }

  if (process.env.NODE_ENV === "development") return sendDev(err, res);

  let error = Object.assign(
    new ApiError(err.statusCode ?? 500, err.message),
    err
  );
  error.isOperational = err.isOperational ?? false;

  if (err.name === "CastError") error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateKey(err);
  if (err.name === "ValidationError") error = handleValidationError(err);
  if (err.name === "JsonWebTokenError") error = handleJWTError();
  if (err.name === "TokenExpiredError") error = handleJWTExpired();

  sendProd(error, res);
};

export default errorHandler;
