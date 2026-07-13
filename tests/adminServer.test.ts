import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createAdminServer } from "../src/admin/server.js";
import { openDatabase, type SqliteDatabase } from "../src/state/database.js";
import { AdminUserRepository } from "../src/state/adminUserRepository.js";
import { ConfigRepository } from "../src/state/configRepository.js";

interface TestContext {
  db: SqliteDatabase;
  baseUrl: string;
  close(): Promise<void>;
}

async function startServer(): Promise<TestContext> {
  const db = openDatabase(":memory:");
  const adminUsers = new AdminUserRepository(db);
  adminUsers.create("admin", "correct-horse-battery-staple");
  const configRepository = new ConfigRepository(db);
  const app = createAdminServer({ configRepository, adminUsers, sessionSecret: "test-session-secret" });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    db,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function extractCsrf(html: string): string {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (!match) {
    throw new Error("csrf token not found in HTML");
  }
  return match[1];
}

async function getWithSession(baseUrl: string, path: string): Promise<{ html: string; cookies: string }> {
  const response = await fetch(`${baseUrl}${path}`);
  const html = await response.text();
  const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
  return { html, cookies };
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
): Promise<{ status: number; location: string | null; cookies: string }> {
  const loginPage = await getWithSession(baseUrl, "/login");
  const csrf = extractCsrf(loginPage.html);

  const response = await fetch(`${baseUrl}/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: loginPage.cookies },
    body: new URLSearchParams({ username, password, _csrf: csrf }).toString(),
  });
  const cookies =
    response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ") || loginPage.cookies;
  return { status: response.status, location: response.headers.get("location"), cookies };
}

test("unauthenticated request to /projects redirects to /login", async () => {
  const ctx = await startServer();
  const response = await fetch(`${ctx.baseUrl}/projects`, { redirect: "manual" });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/login");
  await ctx.close();
  ctx.db.close();
});

test("rejects login with the wrong password", async () => {
  const ctx = await startServer();
  const result = await login(ctx.baseUrl, "admin", "wrong-password");
  assert.equal(result.status, 401);
  await ctx.close();
  ctx.db.close();
});

test("logs in and can view the projects page", async () => {
  const ctx = await startServer();
  const result = await login(ctx.baseUrl, "admin", "correct-horse-battery-staple");
  assert.equal(result.status, 302);
  assert.equal(result.location, "/projects");

  const projectsPage = await fetch(`${ctx.baseUrl}/projects`, { headers: { Cookie: result.cookies } });
  assert.equal(projectsPage.status, 200);
  assert.match(await projectsPage.text(), /Projects/);
  await ctx.close();
  ctx.db.close();
});

test("rejects a project creation POST without a CSRF token", async () => {
  const ctx = await startServer();
  const result = await login(ctx.baseUrl, "admin", "correct-horse-battery-staple");

  const response = await fetch(`${ctx.baseUrl}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: result.cookies },
    body: new URLSearchParams({
      id: "data-index",
      webhookUrl: "https://discord.com/api/webhooks/1/abc",
      events: "comment_added",
    }).toString(),
  });
  assert.equal(response.status, 403);
  await ctx.close();
  ctx.db.close();
});

test("creates a project through the form and lists it", async () => {
  const ctx = await startServer();
  const result = await login(ctx.baseUrl, "admin", "correct-horse-battery-staple");

  const newPage = await fetch(`${ctx.baseUrl}/projects/new`, { headers: { Cookie: result.cookies } });
  const csrf = extractCsrf(await newPage.text());

  const createResponse = await fetch(`${ctx.baseUrl}/projects`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: result.cookies },
    body: new URLSearchParams({
      id: "data-index",
      webhookUrl: "https://discord.com/api/webhooks/1/abc",
      events: "comment_added",
      _csrf: csrf,
    }).toString(),
  });
  assert.equal(createResponse.status, 302);

  const listPage = await fetch(`${ctx.baseUrl}/projects`, { headers: { Cookie: result.cookies } });
  assert.match(await listPage.text(), /data-index/);
  await ctx.close();
  ctx.db.close();
});

test("rate limits repeated failed login attempts from the same client", async () => {
  const ctx = await startServer();
  let lastStatus = 0;
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const result = await login(ctx.baseUrl, "admin", "wrong-password");
    lastStatus = result.status;
  }
  assert.equal(lastStatus, 429);
  await ctx.close();
  ctx.db.close();
});

test("creates and deletes an assignee mapping", async () => {
  const ctx = await startServer();
  const result = await login(ctx.baseUrl, "admin", "correct-horse-battery-staple");

  const assigneesPage = await fetch(`${ctx.baseUrl}/assignees`, { headers: { Cookie: result.cookies } });
  const csrf = extractCsrf(await assigneesPage.text());

  const createResponse = await fetch(`${ctx.baseUrl}/assignees`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: result.cookies },
    body: new URLSearchParams({ redmineUserId: "7", discordId: "123456789012345678", note: "Ba Khoa", _csrf: csrf }).toString(),
  });
  assert.equal(createResponse.status, 302);

  const listPage = await fetch(`${ctx.baseUrl}/assignees`, { headers: { Cookie: result.cookies } });
  const listHtml = await listPage.text();
  assert.match(listHtml, /123456789012345678/);

  const deleteResponse = await fetch(`${ctx.baseUrl}/assignees/7/delete`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: result.cookies },
    body: new URLSearchParams({ _csrf: csrf }).toString(),
  });
  assert.equal(deleteResponse.status, 302);

  const afterDelete = await fetch(`${ctx.baseUrl}/assignees`, { headers: { Cookie: result.cookies } });
  assert.doesNotMatch(await afterDelete.text(), /123456789012345678/);
  await ctx.close();
  ctx.db.close();
});
