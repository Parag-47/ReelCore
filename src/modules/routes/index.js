import { Router } from "express";
import authRouter from "../auth/auth.routes.js";

const router = Router();

const defaultRoutes = [
  {
    path: "/auth",
    route: authRouter,
  },
];

for (const route of defaultRoutes) {
  router.use(route.path, route.route);
}

export default router;
