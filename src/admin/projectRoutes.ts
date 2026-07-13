import { Router } from "express";
import { allEventTypes } from "../config.js";
import { ValidationError, type ConfigRepository } from "../state/configRepository.js";
import { ensureCsrfToken, verifyCsrf } from "./authMiddleware.js";
import { csrfField, escapeHtml, layout } from "./views.js";

export function createProjectRouter(configRepository: ConfigRepository): Router {
  const router = Router();

  router.get("/projects", (req, res) => {
    const token = ensureCsrfToken(req);
    const rows = configRepository
      .listProjects()
      .map((project) => projectRow(project, token))
      .join("");
    res.send(
      layout(
        "Projects",
        `
      <p><a class="button" href="/projects/new">Add project</a></p>
      <table>
        <thead><tr><th>Id</th><th>Webhook</th><th>Events</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `,
      ),
    );
  });

  router.get("/projects/new", (req, res) => {
    res.send(renderProjectForm(ensureCsrfToken(req), { action: "/projects" }));
  });

  router.post("/projects", verifyCsrf, (req, res) => {
    const values = {
      id: String(req.body?.id ?? ""),
      webhookUrl: String(req.body?.webhookUrl ?? ""),
      events: normalizeEvents(req.body?.events),
    };
    try {
      configRepository.createProject(values);
      res.redirect("/projects");
    } catch (error) {
      res
        .status(400)
        .send(renderProjectForm(ensureCsrfToken(req), { action: "/projects", error: errorMessage(error), values }));
    }
  });

  router.get("/projects/:id/edit", (req, res) => {
    const project = configRepository.getProject(req.params.id);
    if (!project) {
      res.status(404).send(layout("Not found", "<p>Project not found.</p>"));
      return;
    }
    res.send(
      renderProjectForm(ensureCsrfToken(req), {
        action: `/projects/${encodeURIComponent(project.id)}`,
        values: project,
        idReadOnly: true,
      }),
    );
  });

  router.post<{ id: string }>("/projects/:id", verifyCsrf, (req, res) => {
    const values = {
      id: req.params.id,
      webhookUrl: String(req.body?.webhookUrl ?? ""),
      events: normalizeEvents(req.body?.events),
    };
    try {
      configRepository.updateProject(req.params.id, { webhookUrl: values.webhookUrl, events: values.events });
      res.redirect("/projects");
    } catch (error) {
      res.status(400).send(
        renderProjectForm(ensureCsrfToken(req), {
          action: `/projects/${encodeURIComponent(req.params.id)}`,
          error: errorMessage(error),
          values,
          idReadOnly: true,
        }),
      );
    }
  });

  router.post<{ id: string }>("/projects/:id/delete", verifyCsrf, (req, res) => {
    configRepository.deleteProject(req.params.id);
    res.redirect("/projects");
  });

  return router;
}

function projectRow(project: { id: string; webhookUrl: string; events: string[] }, csrfToken: string): string {
  return `
      <tr>
        <td>${escapeHtml(project.id)}</td>
        <td>${escapeHtml(maskWebhook(project.webhookUrl))}</td>
        <td>${escapeHtml(project.events.join(", "))}</td>
        <td>
          <a href="/projects/${encodeURIComponent(project.id)}/edit">Edit</a>
          <form method="post" action="/projects/${encodeURIComponent(project.id)}/delete" style="display:inline" onsubmit="return confirm('Delete this project?');">
            ${csrfField(csrfToken)}
            <button type="submit">Delete</button>
          </form>
        </td>
      </tr>`;
}

function normalizeEvents(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  if (typeof raw === "string") {
    return [raw];
  }
  return [];
}

function errorMessage(error: unknown): string {
  return error instanceof ValidationError ? error.message : "Could not save project.";
}

function maskWebhook(url: string): string {
  const match = url.match(/\/webhooks\/(\d+)\/(.+)$/);
  if (!match) {
    return url;
  }
  return `.../webhooks/${match[1]}/******`;
}

interface ProjectFormOptions {
  action: string;
  error?: string;
  values?: { id: string; webhookUrl: string; events: string[] };
  idReadOnly?: boolean;
}

function renderProjectForm(csrfToken: string, options: ProjectFormOptions): string {
  const values = options.values ?? { id: "", webhookUrl: "", events: allEventTypes };
  const errorHtml = options.error ? `<p class="error">${escapeHtml(options.error)}</p>` : "";
  const idField = options.idReadOnly
    ? `<input type="text" id="id" name="id" value="${escapeHtml(values.id)}" readonly>`
    : `<input type="text" id="id" name="id" value="${escapeHtml(values.id)}" required pattern="[a-z0-9][a-z0-9-]{0,63}">`;
  const eventCheckboxes = allEventTypes
    .map((eventType) => {
      const checked = values.events.includes(eventType) ? "checked" : "";
      return `<label><input type="checkbox" name="events" value="${eventType}" ${checked}> ${eventType}</label>`;
    })
    .join("");
  return layout(
    "Project",
    `
    ${errorHtml}
    <form method="post" action="${options.action}">
      ${csrfField(csrfToken)}
      <label for="id">Project id</label>
      ${idField}
      <label for="webhookUrl">Discord webhook URL</label>
      <input type="url" id="webhookUrl" name="webhookUrl" value="${escapeHtml(values.webhookUrl)}" required>
      <label>Events</label>
      ${eventCheckboxes}
      <div class="actions"><button type="submit">Save</button></div>
    </form>
  `,
  );
}
