import Joi from "joi";
import wretch from "wretch";
import logger from "../../utils/logger.js";
import ValidationError from "../../utils/ValidationError.js";
import { DEBOUNCE_URI } from "./auth.constants.js";

const api = wretch(DEBOUNCE_URI);

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

// Format for verify passkey validation
// {
//   credential: {
//     id: 'siYf0hBmV0oF_9fyMiSOVg',
//     rawId: 'siYf0hBmV0oF_9fyMiSOVg',
//     response: {
//       attestationObject: 'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YViUSZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NZAAAAAOqbjWZNAR0hPOS2tIy1ddQAELImH9IQZldKBf_X8jIkjlalAQIDJiABIVggEecc9BnblFbFdUW-QsQqsIvQyZE4aQ9ccmDhwn9O4XUiWCDw51QGEvGz3m5mnAe7-pawJ_swkQw_DdLfhLT39YLfXg',
//       clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiam9LdHYzSjZJV0djRndjYlJTQTJ5alpQdVd2UEdLN2JfdkFlY3lZLWY3USIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImNyb3NzT3JpZ2luIjpmYWxzZX0',
//       transports: [Array],
//       publicKeyAlgorithm: -7,
//       publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEEecc9BnblFbFdUW-QsQqsIvQyZE4aQ9ccmDhwn9O4XXw51QGEvGz3m5mnAe7-pawJ_swkQw_DdLfhLT39YLfXg',
//       authenticatorData: 'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NZAAAAAOqbjWZNAR0hPOS2tIy1ddQAELImH9IQZldKBf_X8jIkjlalAQIDJiABIVggEecc9BnblFbFdUW-QsQqsIvQyZE4aQ9ccmDhwn9O4XUiWCDw51QGEvGz3m5mnAe7-pawJ_swkQw_DdLfhLT39YLfXg'
//     },
//     type: 'public-key',
//     clientExtensionResults: { credProps: [Object] },
//     authenticatorAttachment: 'platform'
//   }
// }

export { registerUser, verifyUser, loginUser };
