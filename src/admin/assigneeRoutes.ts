import { Router } from "express";
import { ValidationError, type ConfigRepository } from "../state/configRepository.js";
import { ensureCsrfToken, verifyCsrf } from "./authMiddleware.js";
import { csrfField, escapeHtml, layout } from "./views.js";

export function createAssigneeRouter(configRepository: ConfigRepository): Router {
  const router = Router();

  router.get("/assignees", (req, res) => {
    res.send(renderAssigneesPage(configRepository, ensureCsrfToken(req)));
  });

  router.post("/assignees", verifyCsrf, (req, res) => {
    try {
      configRepository.upsertAssignee({
        redmineUserId: Number.parseInt(String(req.body?.redmineUserId ?? ""), 10),
        discordId: String(req.body?.discordId ?? ""),
        note: req.body?.note ? String(req.body.note) : null,
      });
      res.redirect("/assignees");
    } catch (error) {
      const message = error instanceof ValidationError ? error.message : "Could not save assignee mapping.";
      res.status(400).send(renderAssigneesPage(configRepository, ensureCsrfToken(req), message));
    }
  });

  router.post<{ redmineUserId: string }>("/assignees/:redmineUserId/delete", verifyCsrf, (req, res) => {
    configRepository.deleteAssignee(Number.parseInt(req.params.redmineUserId, 10));
    res.redirect("/assignees");
  });

  return router;
}

function renderAssigneesPage(configRepository: ConfigRepository, csrfToken: string, error?: string): string {
  const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  const rows = configRepository
    .listAssignees()
    .map(
      (assignee) => `
      <tr>
        <td>${assignee.redmineUserId}</td>
        <td>${escapeHtml(assignee.discordId)}</td>
        <td>${escapeHtml(assignee.note ?? "")}</td>
        <td>
          <form method="post" action="/assignees/${assignee.redmineUserId}/delete" style="display:inline" onsubmit="return confirm('Delete this mapping?');">
            ${csrfField(csrfToken)}
            <button type="submit">Delete</button>
          </form>
        </td>
      </tr>`,
    )
    .join("");

  return layout(
    "Assignee mapping",
    `
    <p>Maps a Redmine user id to a Discord user id (snowflake) so notifications can mention the assignee. Shared across all projects.</p>
    ${errorHtml}
    <form method="post" action="/assignees">
      ${csrfField(csrfToken)}
      <label for="redmineUserId">Redmine user id</label>
      <input type="text" id="redmineUserId" name="redmineUserId" required pattern="\\d+">
      <label for="discordId">Discord user id</label>
      <input type="text" id="discordId" name="discordId" required pattern="\\d{15,25}">
      <label for="note">Note (optional)</label>
      <input type="text" id="note" name="note">
      <div class="actions"><button type="submit">Add / update</button></div>
    </form>
    <table>
      <thead><tr><th>Redmine user id</th><th>Discord id</th><th>Note</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `,
  );
}
