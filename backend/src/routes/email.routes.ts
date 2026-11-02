import {
  updateEmail,
  downloadAttachment,
} from "../controllers/email.controller.js";
import { Router } from "express";
import {
  scheduleEmails,
  listEmails,
  getStats,
  getEmail,
} from "../controllers/email.controller.js";
export const emailRouter = Router();
emailRouter.post("/api/schedule", scheduleEmails);
emailRouter.get("/api/emails", listEmails);
emailRouter.get("/api/emails/:id", getEmail);
emailRouter.get("/api/stats", getStats);

emailRouter.patch("/api/emails/:id", updateEmail);
emailRouter.get(
  "/api/emails/:id/attachments/:attachmentId",
  downloadAttachment,
);
