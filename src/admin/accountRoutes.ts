import { Router } from "express";
import type { AdminUserRepository } from "../state/adminUserRepository.js";
import { ensureCsrfToken, verifyCsrf } from "./authMiddleware.js";
import { csrfField, escapeHtml, layout } from "./views.js";

export function createAccountRouter(adminUsers: AdminUserRepository): Router {
  const router = Router();

  router.get("/account", (req, res) => {
    res.send(renderAccountForm(ensureCsrfToken(req)));
  });

  router.post("/account/password", verifyCsrf, (req, res) => {
    const username = req.session.username;
    if (!username || !req.session.userId) {
      res.redirect("/login");
      return;
    }

    const currentPassword = String(req.body?.currentPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");
    const confirmPassword = String(req.body?.confirmPassword ?? "");

    if (!adminUsers.verifyCredentials(username, currentPassword)) {
      res.status(400).send(renderAccountForm(ensureCsrfToken(req), "Current password is incorrect."));
      return;
    }
    if (newPassword.length < 12) {
      res.status(400).send(renderAccountForm(ensureCsrfToken(req), "New password must be at least 12 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).send(renderAccountForm(ensureCsrfToken(req), "New password and confirmation do not match."));
      return;
    }

    adminUsers.updatePassword(req.session.userId, newPassword);
    res.send(renderAccountForm(ensureCsrfToken(req), undefined, "Password updated."));
  });

  return router;
}

function renderAccountForm(csrfToken: string, error?: string, success?: string): string {
  const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  const successHtml = success ? `<p>${escapeHtml(success)}</p>` : "";
  return layout(
    "Account",
    `
    ${errorHtml}${successHtml}
    <form method="post" action="/account/password">
      ${csrfField(csrfToken)}
      <label for="currentPassword">Current password</label>
      <input type="password" id="currentPassword" name="currentPassword" required>
      <label for="newPassword">New password</label>
      <input type="password" id="newPassword" name="newPassword" required minlength="12">
      <label for="confirmPassword">Confirm new password</label>
      <input type="password" id="confirmPassword" name="confirmPassword" required minlength="12">
      <div class="actions"><button type="submit">Change password</button></div>
    </form>
  `,
    { csrfToken },
  );
}
