import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/state/database.js";
import { AdminUserRepository } from "../src/state/adminUserRepository.js";

test("seeds an admin user only when the table is empty", () => {
  const db = openDatabase(":memory:");
  const repo = new AdminUserRepository(db);

  repo.seedFromEnvIfEmpty("admin", "first-password");
  repo.seedFromEnvIfEmpty("admin", "second-password");

  assert.equal(repo.count(), 1);
  assert.ok(repo.verifyCredentials("admin", "first-password"));
  assert.equal(repo.verifyCredentials("admin", "second-password"), null);
  db.close();
});

test("verifyCredentials returns null for an unknown username", () => {
  const db = openDatabase(":memory:");
  const repo = new AdminUserRepository(db);
  repo.create("admin", "correct-password");

  assert.equal(repo.verifyCredentials("nobody", "correct-password"), null);
  db.close();
});

test("verifyCredentials returns null for a wrong password", () => {
  const db = openDatabase(":memory:");
  const repo = new AdminUserRepository(db);
  repo.create("admin", "correct-password");

  assert.equal(repo.verifyCredentials("admin", "wrong-password"), null);
  db.close();
});

test("updatePassword changes which password verifies", () => {
  const db = openDatabase(":memory:");
  const repo = new AdminUserRepository(db);
  repo.create("admin", "old-password");
  const user = repo.findByUsername("admin");
  assert.ok(user);

  repo.updatePassword(user!.id, "new-password");

  assert.equal(repo.verifyCredentials("admin", "old-password"), null);
  assert.ok(repo.verifyCredentials("admin", "new-password"));
  db.close();
});
