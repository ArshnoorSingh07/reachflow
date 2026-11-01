import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emails } from "./queues.js";
const board = new ExpressAdapter();
board.setBasePath("/queues");
createBullBoard({
  queues: [new BullMQAdapter(emails)],
  serverAdapter: board,
  options: { uiConfig: { boardTitle: "Reachflow queues" } },
});

export const queueDashboard = board.getRouter();
