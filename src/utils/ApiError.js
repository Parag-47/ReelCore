class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;
    // this.isOperational = true; // mark all ApiErrors as operational
    this.data = null;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
