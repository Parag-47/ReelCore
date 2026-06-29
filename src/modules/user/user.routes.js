import { Router } from "express";
import { registerUser } from "./user.validation.js";
import validate from "../../middlewares/validate.middleware.js";
const userRouter = Router();

userRouter.post("/create", validate(registerUser), (req, res) => {
  res.send("test");
});

export default userRouter;
