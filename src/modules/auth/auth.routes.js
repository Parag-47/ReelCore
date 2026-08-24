import { Router } from "express";
import authCheck from "../../middlewares/auth.middleware.js";
import validate from "../../middlewares/validate.middleware.js";
import { registerUser, verifyUser, loginUser } from "./auth.validation.js";
import { authLimiter } from "../../middlewares/rateLimiter.middleware.js";
import {
  register,
  verify,
  login,
  getCurrentUser,
  logout,
  generatePasskeyRegisterOptions,
  verifyPasskeyRegistration,
  generatePasskeyAuthOptions,
  verifyPasskeyAuthentication,
} from "./auth.controller.js";

const authRouter = Router();

authRouter.post("/register", authLimiter, validate(registerUser), register);
authRouter.post("/verify", authLimiter, validate(verifyUser), verify);
authRouter.post("/login", authLimiter, validate(loginUser), login);
authRouter.get("/me", authCheck, getCurrentUser);
authRouter.get("/logout", logout);
authRouter.get(
  "/passkey/registration-options",
  authLimiter,
  authCheck,
  generatePasskeyRegisterOptions
);
authRouter.post(
  "/passkey/verify-registration",
  authLimiter,
  authCheck,
  verifyPasskeyRegistration
);
authRouter.get(
  "/passkey/auth-options",
  authLimiter,
  authCheck,
  generatePasskeyAuthOptions
);
authRouter.post(
  "/passkey/verify-auth",
  authLimiter,
  authCheck,
  verifyPasskeyAuthentication
);

export default authRouter;
