import { Router } from "express";
import { registerUser, verifyUser, loginUser } from "./user.validation.js";
import { register, verify, login } from "./user.controller.js";
import validate from "../../middlewares/validate.middleware.js";
const userRouter = Router();

userRouter.post("/auth/register", validate(registerUser), register);
userRouter.post("/auth/verify", validate(verifyUser), verify);
userRouter.post("/auth/login", validate(loginUser), login);

export default userRouter;
