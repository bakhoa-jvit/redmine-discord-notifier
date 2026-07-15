import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/admin/passwords.js";

test("verifyPassword accepts the correct password", () => {
  const stored = hashPassword("correct horse battery staple");
  assert.equal(verifyPassword("correct horse battery staple", stored), true);
});

test("verifyPassword rejects an incorrect password", () => {
  const stored = hashPassword("correct horse battery staple");
  assert.equal(verifyPassword("wrong password", stored), false);
});

test("hashPassword salts each hash differently", () => {
  const a = hashPassword("same-password");
  const b = hashPassword("same-password");
  assert.notEqual(a, b);
  assert.equal(verifyPassword("same-password", a), true);
  assert.equal(verifyPassword("same-password", b), true);
});

test("verifyPassword rejects a malformed stored hash", () => {
  assert.equal(verifyPassword("anything", "not-a-valid-hash"), false);
});
