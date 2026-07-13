import express, { type Express } from "express";
import session from "express-session";
import type { AdminUserRepository } from "../state/adminUserRepository.js";
import type { ConfigRepository } from "../state/configRepository.js";
import { requireAuth } from "./authMiddleware.js";
import { createAuthRouter } from "./authRoutes.js";
import { createProjectRouter } from "./projectRoutes.js";
import { createAssigneeRouter } from "./assigneeRoutes.js";
import { createAccountRouter } from "./accountRoutes.js";

export interface AdminServerDeps {
  configRepository: ConfigRepository;
  adminUsers: AdminUserRepository;
  sessionSecret: string;
  isProduction?: boolean;
}

export function createAdminServer(deps: AdminServerDeps): Express {
  const isProduction = deps.isProduction ?? process.env.NODE_ENV === "production";
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", isProduction);
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      secret: deps.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
      },
    }),
  );

  app.use(createAuthRouter(deps.adminUsers));

  app.get("/", (_req, res) => res.redirect("/projects"));
  app.use(requireAuth, createProjectRouter(deps.configRepository));
  app.use(requireAuth, createAssigneeRouter(deps.configRepository));
  app.use(requireAuth, createAccountRouter(deps.adminUsers));

  return app;
}
