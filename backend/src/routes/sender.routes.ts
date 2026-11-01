import { Router } from "express";
import { listSenders, createSender } from "../controllers/sender.controller.js";
export const senderRouter = Router();
senderRouter.get("/api/senders", listSenders);
senderRouter.post("/api/senders", createSender);
