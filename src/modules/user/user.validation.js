import Joi from "joi";
import wretch from "wretch";
import logger from "../../config/logger.js";
import ValidationError from "../../shared/utils/ValidationError.js";
import { debounceURI } from "../../shared/constants/constants.js";

const api = wretch(debounceURI);

const checkFakeEmail = async (value, helpers) => {
  try {
    const data = await api.get(`?email=${encodeURIComponent(value)}`).json();

    if (data.disposable === "true") {
      throw new ValidationError(
        "email",
        "Disposable email addresses are not allowed"
      );
    }

    return value;
  } catch (err) {
    if (err.message === "Disposable email addresses are not allowed") {
      throw err;
    }
    logger.error("Email check failed", { email: value, status: err.status });
    throw new ValidationError(
      "email",
      "Unable to verify email. Please try again."
    );
  }
};

const registerUser = {
  body: Joi.object({
    email: Joi.string()
      .max(254)
      .trim()
      .lowercase()
      .email({ tlds: { allow: false } })
      .external(checkFakeEmail)
      .required(),
    username: Joi.string()
      .min(3)
      .max(50)
      .trim()
      .pattern(/^[a-zA-Z0-9_.]+$/)
      .required(),
    password: Joi.string()
      .min(8)
      .max(128)
      .trim()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/)
      .messages({
        "string.pattern.base":
          "Password must contain uppercase, lowercase, number, and special character",
      })
      .required(),
  }),
};

const verifyUser = {
  body: Joi.object({
    token: Joi.string().trim().lowercase().required(),
  }),
};

const loginUser = {
  body: Joi.object({
    identifier: Joi.string().min(3).max(255).trim().lowercase().required(),
    password: Joi.string().min(8).max(128).trim().required(),
  }),
};

export { registerUser, verifyUser, loginUser };
