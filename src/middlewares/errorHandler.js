import logger from "../config/logger.js";

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Mongoose library error mappers
const handleCastError = (e) =>
  new AppError(`Invalid ${e.path}: ${e.value}`, 400);
const handleDuplicateKey = (e) =>
  new AppError(`Duplicate value for ${Object.keys(e.keyValue)[0]}`, 409);
const handleValidationError = (e) =>
  new AppError(
    Object.values(e.errors)
      .map((v) => v.message)
      .join(". "),
    400
  );
const handleJWTError = () =>
  new AppError("Invalid session — please log in again", 401);
const handleJWTExpired = () =>
  new AppError("Session expired — please log in again", 401);
const handleCSRF = () => new AppError("Invalid CSRF token", 403);

// Response serializers
const sendDev = (err, res) =>
  res.status(err.statusCode).json({
    status: "error",
    message: err.message,
    stack: err.stack,
    error: err,
  });

const sendProd = (err, res) => {
  if (err.isOperational)
    return res
      .status(err.statusCode)
      .json({ status: "error", message: err.message });

  logger.error({ err }, "Unexpected server error");
  return res.status(500).json({
    status: "error",
    message: "Something went wrong. Please try again later.",
  });
};

const errorHandler = (err, req, res, _next) => {
  console.log(err);
  err.statusCode = err.statusCode || 500;

  err.statusCode >= 500
    ? logger.error(
        "Server error: ",
        JSON.stringify({ err, ip: req.ip, path: req.path })
      )
    : logger.warn(
        "Client error: ",
        JSON.stringify({
          status: err.statusCode,
          message: err.message,
          path: req.path,
        })
      );

  if (process.env.NODE_ENV === "development") return sendDev(err, res);

  let error = Object.assign(new AppError(err.message, err.statusCode), err);
  error.isOperational = err.isOperational ?? false;

  if (err.name === "CastError") error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateKey(err);
  if (err.name === "ValidationError") error = handleValidationError(err);
  if (err.name === "JsonWebTokenError") error = handleJWTError();
  if (err.name === "TokenExpiredError") error = handleJWTExpired();
  if (err.code === "EBADCSRFTOKEN") error = handleCSRF();

  sendProd(error, res);
};

export default errorHandler;
