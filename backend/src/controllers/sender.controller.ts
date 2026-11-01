import type { RequestHandler } from "express";
import { z } from "zod";
import { SenderModel } from "../models/sender.model.js";
import { SenderService } from "../services/sender.service.js";
export const listSenders: RequestHandler = async (req, res) => {
  res.json((await SenderModel.findByUser([req.session.user!.id])).rows);
};
export const createSender: RequestHandler = async (req, res) => {
  const { name } = z
    .object({ name: z.string().trim().min(2).max(60) })
    .parse(req.body);
  res.status(201).json(await SenderService.create(req.session.user!.id, name));
};
