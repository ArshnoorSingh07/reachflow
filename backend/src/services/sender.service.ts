import { createEtherealAccount } from "../config/smtp.js";
import { randomUUID } from "node:crypto";
import { SenderModel } from "../models/sender.model.js";
import { seal } from "../utils/encryption.js";
export const SenderService = {
  async create(userId: string, name: string) {
    const existing = await SenderModel.findByUser([userId]);
    if (existing.rowCount! >= 10)
      throw Object.assign(
        Error("A workspace supports up to 10 test senders."),
        { status: 409 },
      );
    const account = await createEtherealAccount();
    const sender = { id: randomUUID(), name, email: account.user };
    await SenderModel.create(
      sender.id,
      userId,
      name,
      account.user,
      seal(account.pass),
      account.smtp.host,
      account.smtp.port,
    );
    return sender;
  },
};
