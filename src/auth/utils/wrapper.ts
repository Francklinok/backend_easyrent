// utils/wrapAsync.ts
import { RequestHandler } from 'express';

export const wrapAsync = (fn: (...args: any[]) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
};
