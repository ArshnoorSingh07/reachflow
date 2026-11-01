import type { ErrorRequestHandler } from "express";
import { z } from "zod";
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status =
    err instanceof z.ZodError
      ? 400
      : [400, 404, 409, 429, 503].includes(err.status)
        ? err.status
        : 500;
  res.status(status).json({
    error:
      err instanceof z.ZodError
        ? err.issues.map((x) => x.message).join(", ")
        : status === 500
          ? "Request failed. Please try again."
          : err.message,
  });
};
