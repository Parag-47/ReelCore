// =============================================================================
// SCHEMA NOTE (action needed on your side, not in this file):
// This controller assumes userSchema gets: (1) `import { model }` fix,
// (2) a `provider` field so password.required() actually evaluates,
// (3) a decision on whether `phone` is collected at registration.
// See chat for full list. Controller below uses `userName` (not `username`)
// and `isEmailVerified` (not `isVerified`) to match your actual schema.
// =============================================================================

// =============================================================================
// ApiError NOTE (action needed on your side):
// Uncomment `this.isOperational = true;` in your actual ApiError.js.
// Without it every thrown ApiError here collapses to a generic 500 in prod.
// =============================================================================

import crypto from "crypto";
import argon2 from "argon2";

import User from "./user.model.js";
import redisClient from "../../config/redisClient.js"; // default export per your config
import asyncHandler from "../../shared/utils/asyncHandler.js";
import ApiError from "../../shared/utils/ApiError.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";
import sanitizeUser from "../../shared/utils/sanitizeUser.js";
// import { sendEmail } from "../../shared/utils/sendEmail.js"; // TODO: wire up once email system is built

const PENDING_REGISTRATION_PREFIX = "pending-registration:";
const PENDING_REGISTRATION_TTL_SECONDS = 15 * 60; // 15 min, adjust as needed

/**
 * POST /register
 * Validates input, checks userName/email availability, hashes the password
 * with argon2id, stores a pending registration in Redis under a random
 * 32-byte token (TTL-bound), and (eventually) emails a verification link.
 * No MongoDB write happens here — the user doc is only created at /verify.
 */
const register = asyncHandler(async (req, res) => {
  let { userName, email, password } = req.body;

  userName = userName?.toLowerCase().trim();
  email = email?.toLowerCase().trim();

  if (!userName || !password) {
    throw new ApiError(400, "Username and password are required!");
  }

  // Availability check #1 — advisory, fast-fail before hashing.
  // The authoritative check happens again at /verify, since this token can
  // sit in Redis for up to PENDING_REGISTRATION_TTL_SECONDS before being
  // consumed, and someone else could legitimately claim the same userName
  // or email in that window.
  const orConditions = [{ userName }];
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
    userName,
    email,
    hashedPassword,
    createdAt: Date.now(),
  };

  // redis@6 client uses an options object, not ioredis-style positional args.
  // NX here just guards against the near-impossible case of a token collision.
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

  return res.status(201).json(
    new ApiResponse(
      201,
      true,
      "Registration initiated. Verification email sending is not yet implemented.",
      { userName, email, token } // TODO: stop returning raw token once email send exists — it's only here for manual testing of /verify
    )
  );
});

/**
 * POST /verify
 * Atomically consumes the token (GETDEL — single-use, race-safe), re-checks
 * userName/email availability, inserts the user, then issues a server-side
 * session via req.session.regenerate -> req.session.save, mirroring login's
 * pattern but with errors routed through `next` instead of a bare throw
 * inside the callback (throwing there escapes asyncHandler's promise chain
 * entirely and becomes an unhandled exception rather than reaching the
 * global error handler).
 */
const verify = asyncHandler(async (req, res, next) => {
  const { token } = req.body;

  if (!token) throw new ApiError(400, "Verification token is required!");

  const redisKey = `${PENDING_REGISTRATION_PREFIX}${token}`;

  // redis@6 exposes this as getDel (camelCase), not ioredis's lowercase getdel.
  const rawPayload = await redisClient.getDel(redisKey);

  if (!rawPayload) {
    throw new ApiError(
      400,
      "Verification link is invalid or has expired. Please register again!"
    );
  }

  const { userName, email, hashedPassword } = JSON.parse(rawPayload);

  // Re-check #2 — the authoritative one. GETDEL only guarantees the token
  // itself is single-use; it says nothing about whether userName/email got
  // claimed by someone else during the TTL window. The schema's unique
  // index (once added per the schema notes) is the real backstop — this is
  // just to surface a clean ApiError instead of a raw Mongo duplicate-key
  // error bubbling up.
  const orConditions = [{ userName }];
  if (email) orConditions.push({ email });

  const existingUser = await User.findOne({ $or: orConditions }).lean();

  if (existingUser) {
    throw new ApiError(
      409,
      "Username or email was claimed by another account while this link was pending!"
    );
  }

  let user;
  try {
    user = await User.create({
      userName,
      email,
      password: hashedPassword,
      provider: "EMAIL",
      isEmailVerified: true,
      status: "active",
    });
  } catch (err) {
    // Defense in depth: two concurrent /verify calls for two different
    // tokens could both pass the findOne check above before either inserts.
    // The unique index then rejects the second insert — surface that as a
    // clean 409 instead of a raw duplicate-key error.
    if (err.code === 11000) {
      throw new ApiError(409, "Username or email is already in use!");
    }
    throw err;
  }

  req.session.regenerate((err) => {
    if (err) return next(new ApiError(500, "Session regeneration failed"));

    req.session.userId = user._id;

    req.session.save((err) => {
      if (err) return next(new ApiError(500, "Session save failed"));

      const userData = sanitizeUser(user);

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
