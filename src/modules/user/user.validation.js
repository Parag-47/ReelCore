import Joi from "joi";
import wretch from "wretch";
import logger from "../../config/logger.js";
import { debounceURI } from "../../shared/constants/constants.js";

const api = wretch(debounceURI);

const checkFakeEmail = async (value, helpers) => {
  return await api
    .get(`?email=${encodeURIComponent(value)}`)
    .json((data) => {
      console.log(data);
      data.disposable === "true"
        ? helpers.error("email.disposable", {
            message: "Disposable email addresses are not allowed",
          })
        : value;
    })
    .catch((err) => {
      logger.error("Email check failed", { email: value, status: err.status });
      return helpers.error("email.verify", {
        message: "Unable to verify email. Please try again.",
      });
    });
};

const registerUser = {
  body: Joi.object({
    email: Joi.string()
      .trim()
      .lowercase()
      .max(254)
      .email({ tlds: { allow: false } })
      .custom(checkFakeEmail)
      .required(),
    userName: Joi.string().trim().min(3).max(50).alphanum().required(),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/)
      .messages({
        "string.pattern.base":
          "Password must contain uppercase, lowercase, number, and special character",
      })
      .required(),
  }),
  // params: non
  // query: non
};

export { registerUser };
