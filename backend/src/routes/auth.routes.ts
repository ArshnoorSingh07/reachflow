import { passwordAuth } from "../controllers/password.controller.js";
import { rateLimit } from "../middleware/rate-limit.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { Router } from "express";
import {
  googleLogin,
  googleCallback,
  getCurrentUser,
  logout,
  logoutAll,
} from "../controllers/auth.controller.js";
export const authRouter = Router();
authRouter.get("/auth/google", googleLogin);
authRouter.get("/auth/google/callback", googleCallback);
authRouter.get("/api/me", getCurrentUser);
authRouter.post("/api/logout", requireAuth, logout);

authRouter.post("/api/logout-all", requireAuth, logoutAll);

authRouter.post(
  ["/auth/login", "/auth/register"],
  rateLimit("password-ip", 20, 900000, (req) => req.ip ?? "unknown"),
  rateLimit("password-account", 10, 900000, (req) =>
    String(req.body?.email ?? "")
      .toLowerCase()
      .slice(0, 254),
  ),
  passwordAuth,
);
