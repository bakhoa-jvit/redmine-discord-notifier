import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AdminUserRepository } from "../state/adminUserRepository.js";
import { ensureCsrfToken, verifyCsrf } from "./authMiddleware.js";
import { csrfField, escapeHtml, layout } from "./views.js";

export function createAuthRouter(adminUsers: AdminUserRepository): Router {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.get("/login", (req, res) => {
    if (req.session.userId) {
      res.redirect("/projects");
      return;
    }
    res.send(renderLogin(ensureCsrfToken(req)));
  });

  router.post("/login", loginLimiter, verifyCsrf, (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const user = adminUsers.verifyCredentials(username, password);
    if (!user) {
      res.status(401).send(renderLogin(ensureCsrfToken(req), "Invalid username or password."));
      return;
    }
    req.session.regenerate((error) => {
      if (error) {
        res.status(500).send("Login failed. Please try again.");
        return;
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      res.redirect("/projects");
    });
  });

  router.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/login");
    });
  });

  return router;
}

function renderLogin(csrfToken: string, error?: string): string {
  const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  return layout(
    "Login",
    `
    ${errorHtml}
    <form method="post" action="/login">
      ${csrfField(csrfToken)}
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required autofocus>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required>
      <div class="actions"><button type="submit">Log in</button></div>
    </form>
  `,
    { showNav: false },
  );
}
