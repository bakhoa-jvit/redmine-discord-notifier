import type { SqliteDatabase } from "./database.js";
import { nowIso } from "../time.js";
import { hashPassword, verifyPassword } from "../admin/passwords.js";

export interface AdminUser {
  id: number;
  username: string;
  passwordHash: string;
}

interface AdminUserRow {
  id: number;
  username: string;
  password_hash: string;
}

export class AdminUserRepository {
  constructor(private readonly db: SqliteDatabase) {}

  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM admin_users").get() as { count: number };
    return row.count;
  }

  seedFromEnvIfEmpty(username: string, password: string): void {
    if (this.count() > 0) {
      return;
    }
    this.create(username, password);
  }

  create(username: string, password: string): void {
    const now = nowIso();
    this.db
      .prepare(
        "INSERT INTO admin_users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)",
      )
      .run(username, hashPassword(password), now, now);
  }

  findByUsername(username: string): AdminUser | null {
    const row = this.db
      .prepare("SELECT id, username, password_hash FROM admin_users WHERE username = ?")
      .get(username) as AdminUserRow | undefined;
    if (!row) {
      return null;
    }
    return { id: row.id, username: row.username, passwordHash: row.password_hash };
  }

  verifyCredentials(username: string, password: string): AdminUser | null {
    const user = this.findByUsername(username);
    if (!user) {
      return null;
    }
    return verifyPassword(password, user.passwordHash) ? user : null;
  }

  updatePassword(userId: number, password: string): void {
    this.db
      .prepare("UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?")
      .run(hashPassword(password), nowIso(), userId);
  }
}
