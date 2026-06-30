import { RequestHandler } from "express";

/** Fängt Promise-Rejections in async-Handlern und reicht sie an next() weiter. */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
