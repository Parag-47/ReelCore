// =============================================================================
// ApiError NOTE (action needed on your side):
// Uncomment `this.isOperational = true;` in your actual ApiError.js.
// Without it every thrown ApiError here collapses to a generic 500 in prod.
// =============================================================================

import crypto from "crypto";
import argon2 from "argon2";

import User from "./user.model.js";
import redisClient from "../../config/redisClient.js";
import asyncHandler from "../../shared/utils/asyncHandler.js";
import ApiError from "../../shared/utils/ApiError.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";
import attempt from "../../shared/utils/attempt.js";
// import { sendEmail } from "../../shared/utils/sendEmail.js"; // TODO: wire up once email system is built

const PENDING_REGISTRATION_PREFIX = "pending-registration:";
const PENDING_REGISTRATION_TTL_SECONDS = 15 * 60;

// TODO: Check the edge case where use tries to register with same email twice the current behavior is that 2 tokens will be generated for the same user
const register = asyncHandler(async (req, res) => {
  let { username, email, password } = req.body;

  const orConditions = [{ username }];
  if (email) orConditions.push({ email });

  const existingUser = await User.findOne({ $or: orConditions }).lean();

  if (existingUser) {
    throw new ApiError(409, "Username or email is already in use!");
  }

  const hashedPassword = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const token = crypto.randomBytes(32).toString("hex");
  const redisKey = `${PENDING_REGISTRATION_PREFIX}${token}`;

  const pendingPayload = {
    username,
    email,
    hashedPassword,
    createdAt: Date.now(),
  };

  const setResult = await redisClient.set(
    redisKey,
    JSON.stringify(pendingPayload),
    {
      EX: PENDING_REGISTRATION_TTL_SECONDS,
      NX: true,
    }
  );

  if (!setResult) {
    throw new ApiError(
      500,
      "Failed to initiate registration, please try again!"
    );
  }

  // TODO: send verification email once the email dispatch system is built.
  // Should email a link/token to the frontend verification page, which then
  // POSTs { token } to /verify. On send failure, roll back with:
  //   await redisClient.del(redisKey);
  // so a token never sits orphaned in Redis with no way to ever be delivered.

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        true,
        "Registration initiated. Verification email sending is not yet implemented.",
        { username, email }
      )
    );
});

const verify = asyncHandler(async (req, res, next) => {
  const { token } = req.body;
  const redisKey = `${PENDING_REGISTRATION_PREFIX}${token}`;

  const rawPayload = await redisClient.getDel(redisKey);

  if (!rawPayload) {
    throw new ApiError(
      400,
      "Verification link is invalid or has expired. Please register again!"
    );
  }

  const { username, email, hashedPassword } = JSON.parse(rawPayload);

  const orConditions = [{ username }];
  if (email) orConditions.push({ email });

  const existingUser = await User.findOne({ $or: orConditions }).lean();

  if (existingUser) {
    throw new ApiError(
      409,
      "Username or email was claimed by another account while this link was pending!"
    );
  }

  const [error, user] = await attempt(
    User.create({
      username,
      email,
      password: hashedPassword,
      authProviders: ["local"],
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: "active",
    })
  );
  console.log(user);
  if (error && error.code === 11000)
    throw new ApiError(409, "Username or email is already in use!");

  if (error || !user) throw new ApiError(500, "Failed to create user!", error);

  req.session.regenerate((err) => {
    if (err) return next(new ApiError(500, "Session regeneration failed"));

    req.session.userId = user._id;

    req.session.save((err) => {
      if (err) return next(new ApiError(500, "Session save failed"));

      const userData = user.toJSON();

      return res
        .status(201)
        .json(
          new ApiResponse(
            201,
            true,
            "Registration verified successfully!",
            userData
          )
        );
    });
  });
});

export { register, verify };
