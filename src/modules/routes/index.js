import { Router } from "express";
import userRouter from "../user/user.routes.js";

const router = Router();

const defaultRoutes = [
  {
    path: "/users",
    route: userRouter,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
