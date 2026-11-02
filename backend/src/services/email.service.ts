import { emailIndex, searchFetch } from "../config/search.js";
import { listEmailRecords } from "../models/email.model.js";
import { BatchModel } from "../models/batch.model.js";
import { enqueuePending } from "./queue.service.js";
import type { ScheduleInput } from "../validators/email.validator.js";
export const EmailService = {
  async schedule(uid: string, data: ScheduleInput, key: string) {
    const { batchId } = await BatchModel.create(uid, data, key);
    await enqueuePending().catch(console.error);
    return { batchId };
  },
  async list(
    uid: string,
    view: string,
    page: number,
    query: string,
    senderId: string | null = null,
    status: string | null = null,
  ) {
    let ids: string[] | null = null;
    if (query) {
      const r = await searchFetch(
        `${emailIndex}/_search`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            size: 10000,
            query: {
              bool: {
                filter: [{ term: { "user_id.keyword": uid } }],
                must: [
                  {
                    multi_match: {
                      query,
                      fields: ["recipient^2", "subject^2", "body"],
                      type: "phrase_prefix",
                    },
                  },
                ],
              },
            },
          }),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (r.status === 404) return { rows: [], total: 0, page };
      if (!r.ok) {
        throw Object.assign(new Error("Search is temporarily unavailable"), {
          status: 503,
        });
      }
      const data = (await r.json()) as any;
      ids = data.hits.hits.map((h: any) => h._id);
    }
    const { rows, total } = await listEmailRecords(
      uid,
      view,
      page,
      ids,
      senderId,
      status,
    );
    return { rows, total, page };
  },
};
