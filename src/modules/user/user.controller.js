// =============================================================================
// ApiError NOTE:
// Uncomment `this.isOperational = true;` in your actual ApiError.js.
// Without it every thrown ApiError here collapses to a generic 500 in prod.
// =============================================================================

import crypto from "crypto";
import argon2 from "argon2";

import User from "./user.model.js";
import redisClient from "../../providers/redisClient.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";
import attempt from "../../utils/attempt.js";
import sendVerificationEmail from "../../services/email/email.service.js";
import { COOKIE_OPTIONS } from "../../config/config.js";
import {
  PENDING_EMAIL_PREFIX,
  PENDING_REGISTRATION_PREFIX,
  PENDING_REGISTRATION_TTL_SECONDS,
  MAX_FAILED_ATTEMPTS,
  BASE_LOCKOUT_MS,
  MAX_LOCKOUT_MS,
} from "./user.constants.js";

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

// Generated once at boot so a "no such user" login takes roughly the same
// time as a real one — otherwise response time leaks whether an
// email/username exists (classic enumeration side-channel).
const DUMMY_PASSWORD_HASH = await argon2.hash(
  crypto.randomBytes(32).toString("hex"),
  { type: argon2.argon2id }
);

// TODO: Add captcha system later
const login = asyncHandler(async (req, res, next) => {
  const { identifier, password } = req.body; // identifier = username OR email

  const isEmail = identifier.includes("@");
  const query = isEmail ? { email: identifier } : { username: identifier };

  const user = await User.findOne(query).select(
    "+password +failedLoginAttempts +lockoutUntil +lockoutCount +lastFailedLoginAt"
  );

  if (user?.lockoutUntil && user.lockoutUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockoutUntil - Date.now()) / 60000);
    throw new ApiError(
      429,
      `Too many failed attempts. Try again in ${minutesLeft} minute(s).`
    );
  }

  const hashToVerify = user?.password ?? DUMMY_PASSWORD_HASH;

  const [verifyError, isPasswordValid] = await attempt(
    argon2.verify(hashToVerify, password)
  );

  if (verifyError) {
    throw new ApiError(500, "Failed to verify credentials.", verifyError);
  }

  if (!user || user.deletedAt || !user.password || !isPasswordValid) {
    if (user?.password) await registerFailedAttempt(user._id);
    throw new ApiError(401, "Invalid username/email or password.");
  }

  if (user.status === "suspended") {
    throw new ApiError(403, "This account has been suspended.");
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lockoutCount: 0,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
      },
    }
  );

  req.session.regenerate((err) => {
    if (err) return next(new ApiError(500, "Session regeneration failed"));

    req.session.userId = user._id;

    req.session.save((err) => {
      if (err) return next(new ApiError(500, "Session save failed"));

      return res
        .status(200)
        .json(new ApiResponse(200, true, "Login successful!", user.toJSON()));
    });
  });
});

// Atomic $inc avoids the read-modify-write race you'd get from
// `user.failedLoginAttempts++; user.save()` under concurrent bad requests.
async function registerFailedAttempt(userId) {
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    {
      $inc: { failedLoginAttempts: 1 },
      $set: { lastFailedLoginAt: new Date() },
    },
    {
      new: true,
      projection: { failedLoginAttempts: 1, lockoutCount: 1 },
    }
  );

  if (updated.failedLoginAttempts < MAX_FAILED_ATTEMPTS) return;

  const lockoutDuration = Math.min(
    BASE_LOCKOUT_MS * 2 ** updated.lockoutCount,
    MAX_LOCKOUT_MS
  );

  const result = await User.updateOne(
    { _id: userId, failedLoginAttempts: updated.failedLoginAttempts },
    {
      $set: {
        failedLoginAttempts: 0,
        lockoutUntil: new Date(Date.now() + lockoutDuration),
      },
      $inc: { lockoutCount: 1 },
    }
  );

  if (result.modifiedCount === 1) {
    logger.info("Account locked out", {
      userId,
      lockoutCount: updated.lockoutCount + 1,
      lockoutDurationMs: lockoutDuration,
    });
  }
}

const logout = asyncHandler(async (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(new ApiError(500, "Failed to log out, please try again."));
    }

    res.clearCookie(SESSION_NAME, COOKIE_OPTIONS);

    return res
      .status(200)
      .json(new ApiResponse(200, true, "Logged out successfully!"));
  });
});

// TODO: Add logout from all devices option and also use it on password change.
export { register, verify, login, logout };
