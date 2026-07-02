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
import sendVerificationEmail from "../../services/email/email.service.js";

const PENDING_EMAIL_PREFIX = "pending-email:";
const PENDING_REGISTRATION_PREFIX = "pending-registration:";
const PENDING_REGISTRATION_TTL_SECONDS = 15 * 60;

const register = asyncHandler(async (req, res) => {
  let { username, email, password } = req.body;

  const redisEmailKey = `${PENDING_EMAIL_PREFIX}${email}`;
  const existingPendingRegistration = await redisClient.get(redisEmailKey);

  if (existingPendingRegistration) {
    throw new ApiError(
      409,
      "A verification email has already been sent. Please check your inbox or request a new one."
    );
  }

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

  const redisTokenKey = `${PENDING_REGISTRATION_PREFIX}${token}`;
  const pendingPayload = {
    username,
    email,
    hashedPassword,
    createdAt: Date.now(),
  };

  const [tokenResult, emailResult] = await Promise.all([
    redisClient.set(redisTokenKey, JSON.stringify(pendingPayload), {
      EX: PENDING_REGISTRATION_TTL_SECONDS,
      NX: true,
    }),

    redisClient.set(redisEmailKey, token, {
      EX: PENDING_REGISTRATION_TTL_SECONDS,
      NX: true,
    }),
  ]);

  if (!tokenResult || !emailResult) {
    await Promise.allSettled([
      redisClient.del(redisTokenKey),
      redisClient.del(redisEmailKey),
    ]);

    throw new ApiError(
      500,
      "Failed to initiate registration, please try again!"
    );
  }

  // TODO: Investigate why the error chain/stack brakes when thrown from the here.
  const [error, data] = await attempt(
    sendVerificationEmail(email, username, token)
  );

  if (error) {
    console.log(`data: ${email} ${username}`, error);
    await Promise.allSettled([
      redisClient.del(redisTokenKey),
      redisClient.del(redisEmailKey),
    ]);

    throw new ApiError(
      500,
      "Failed to send verification email. Please try again.",
      error
    );
  }

  console.log(data);

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        true,
        "Registration initiated. Verification email has been send to your email.",
        { username, email }
      )
    );
});

const verify = asyncHandler(async (req, res, next) => {
  const { token } = req.body;

  const redisTokenKey = `${PENDING_REGISTRATION_PREFIX}${token}`;
  const rawPayload = await redisClient.getDel(redisTokenKey);

  if (!rawPayload) {
    throw new ApiError(
      400,
      "Verification link is invalid or has expired. Please register again!"
    );
  }

  const { username, email, hashedPassword } = JSON.parse(rawPayload);
  const redisEmailKey = `${PENDING_EMAIL_PREFIX}${email}`;

  const orConditions = [{ username }];
  if (email) orConditions.push({ email });

  const existingUser = await User.findOne({ $or: orConditions }).lean();
  if (existingUser) {
    // Cleanup the pending email lookup since the account now exists.
    await redisClient.del(redisEmailKey);
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

  if (error && error.code === 11000) {
    await redisClient.del(redisEmailKey);
    throw new ApiError(409, "Username or email is already in use!");
  }

  if (error || !user) throw new ApiError(500, "Failed to create user!", error);

  await redisClient.del(redisEmailKey);

  req.session.regenerate((err) => {
    if (err) return next(new ApiError(500, "Session regeneration failed"));

    req.session.userId = user._id;

    req.session.save((err) => {
      if (err) return next(new ApiError(500, "Session save failed"));

      return res
        .status(201)
        .json(
          new ApiResponse(
            201,
            true,
            "Registration verified successfully!",
            user.toJSON()
          )
        );
    });
  });
});

export { register, verify };
