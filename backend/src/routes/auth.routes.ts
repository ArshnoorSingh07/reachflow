import { requireAuth } from "../middleware/auth.middleware.js";
import { Router } from "express";
import {
  googleLogin,
  googleCallback,
  getCurrentUser,
  logout,
} from "../controllers/auth.controller.js";
export const authRouter = Router();
authRouter.get("/auth/google", googleLogin);
authRouter.get("/auth/google/callback", googleCallback);
authRouter.get("/api/me", getCurrentUser);
authRouter.post("/api/logout", requireAuth, logout);
