import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.userId) {
    next();
    return;
  }
  res.redirect("/login");
}

export function ensureCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  const submitted = typeof req.body?._csrf === "string" ? req.body._csrf : undefined;
  if (!submitted || !req.session.csrfToken || submitted !== req.session.csrfToken) {
    res.status(403).send("Invalid or missing CSRF token. Go back and try again.");
    return;
  }
  next();
}
