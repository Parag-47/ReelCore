import Joi from "joi";
import ApiError from "../shared/utils/ApiError.js";

const validate = (schemas) => async (req, _res, next) => {
  const targets = ["body", "query", "params"].filter((k) => schemas[k]);
  const errors = [];

  for (const target of targets) {
    const data = req[target] ?? {};
    const value = await schemas[target].validateAsync(data, {
      abortEarly: false,
      stripUnknown: target === "body", // scrub extra fields from body only
      convert: true, // coerce "123" → 123, "true" → true
      errors: { label: "key" }, // use field name, not full path label
    });
    console.log("Value: ", value, " Error: ", error);
    if (error) {
      errors.push(
        ...error.details.map((d) => ({
          field: d.path.join("."),
          message: d.message.replace(/['"]/g, ""), // strip Joi's surrounding quotes
          // type: d.type,
        }))
      );
    } else {
      req[target] = value; // write back coerced/stripped value only on success
    }
  }

  if (errors.length > 0) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  return next();
};

export default validate;
