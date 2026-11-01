import type { RequestHandler } from "express";
import { randomBytes } from "node:crypto";
import { UserModel } from "../models/user.model.js";
import { connectSlackAccount } from "../services/slack.service.js";
export const getIntegrations: RequestHandler = async (req, res) => {
  res.json({
    slack: !!(await UserModel.getSlackConnection(req.session.user!.id)),
  });
};
export const disconnectSlack: RequestHandler = async (req, res) => {
  delete req.session.slackState;
  await UserModel.clearSlackConnection(req.session.user!.id);
  res.sendStatus(204);
};
export const connectSlack: RequestHandler = (req, res) => {
  if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) {
    res.redirect(`${process.env.WEB_URL}/?view=integrations&error=slack`);
    return;
  }
  req.session.slackState = randomBytes(24).toString("hex");
  const url = `https://slack.com/oauth/v2/authorize?${new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID, scope: "incoming-webhook", state: req.session.slackState, redirect_uri: `${process.env.API_URL}/api/integrations/slack/callback` })}`;
  req.session.save((error) =>
    res.redirect(
      error ? `${process.env.WEB_URL}/?view=integrations&error=slack` : url,
    ),
  );
};
export const slackCallback: RequestHandler = async (req, res) => {
  const state = req.session.slackState;
  delete req.session.slackState;
  if (
    typeof req.query.state !== "string" ||
    req.query.state !== state ||
    typeof req.query.code !== "string"
  ) {
    res.redirect(`${process.env.WEB_URL}/?view=integrations&error=slack`);
    return;
  }
  try {
    await connectSlackAccount(req.session.user!.id, req.query.code);
    res.redirect(`${process.env.WEB_URL}/?view=integrations&connected=slack`);
  } catch (error) {
    console.error(
      "Slack connection failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.redirect(`${process.env.WEB_URL}/?view=integrations&error=slack`);
  }
};
