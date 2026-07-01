import { Router } from "express";
import { registerUser, verifyUser } from "./user.validation.js";
import { register, verify } from "./user.controller.js";
import validate from "../../middlewares/validate.middleware.js";
const userRouter = Router();

userRouter.post("/auth/register", validate(registerUser), register);
userRouter.post("/auth/verify", validate(verifyUser), verify);

export default userRouter;
