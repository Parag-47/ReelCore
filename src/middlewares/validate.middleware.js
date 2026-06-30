import Joi from "joi";
import ApiError from "../shared/utils/ApiError.js";
import ValidationError from "../shared/utils/ValidationError.js";

const validate = (schemas) => async (req, _res, next) => {
  const targets = ["body", "query", "params"].filter((k) => schemas[k]);
  const errors = [];

  for (const target of targets) {
    const data = req[target] ?? {};

    try {
      const value = await schemas[target].validateAsync(data, {
        abortEarly: false,
        stripUnknown: target === "body",
        convert: true,
        errors: { label: "key" },
      });
      req[target] = value;
    } catch (joiError) {
      if (joiError.isJoi) {
        // Standard Joi validation errors
        if (joiError.details?.length > 0) {
          errors.push(
            ...joiError.details.map((d) => ({
              field: `${target}.${d.path.join(".")}`,
              message: d.message.replace(/['"]/g, ""),
              type: d.type,
            }))
          );
        } else {
          // External validator threw Error — wrapped by Joi
          errors.push({
            field: `${target}.${joiError.field || "unknown"}`,
            message: joiError.message,
            type: "external.validation",
          });
        }
      } else if (joiError instanceof ValidationError) {
        // Our custom ValidationError from .external()
        errors.push({
          field: `${target}.${joiError.field || "unknown"}`,
          message: joiError.message,
          type: joiError.code || "external.validation",
        });
      } else {
        // Unexpected non-Joi, non-ValidationError
        return next(new ApiError(500, "Internal validation error"));
      }
    }
  }

  if (errors.length > 0) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  next();
};

export default validate;
