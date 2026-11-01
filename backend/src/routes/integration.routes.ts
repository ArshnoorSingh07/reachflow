import { Router } from "express";
import {
  getIntegrations,
  disconnectSlack,
  connectSlack,
  slackCallback,
} from "../controllers/integration.controller.js";
export const integrationRouter = Router();
integrationRouter.get("/api/integrations", getIntegrations);
integrationRouter.delete("/api/integrations/slack", disconnectSlack);
integrationRouter.get("/api/integrations/slack/connect", connectSlack);
integrationRouter.get("/api/integrations/slack/callback", slackCallback);
