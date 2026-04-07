import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { createClient, type Client as LibsqlClient, type InArgs } from "@libsql/client";
import { getConfig } from "@/lib/config";
import { migrationSql } from "@/lib/db/schema";

export type SqlArg = string | number | null;

export interface DBClient {
  all<T>(sql: string, args?: SqlArg[]): Promise<T[]>;
  get<T>(sql: string, args?: SqlArg[]): Promise<T | null>;
  run(sql: string, args?: SqlArg[]): Promise<{ changes: number }>;
  exec(sql: string): Promise<void>;
  migrate(): Promise<void>;
}

class LocalSqliteClient implements DBClient {
  private db: Database.Database;

  constructor(filePath: string) {
    const absolutePath = path.resolve(process.cwd(), filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    this.db = new Database(absolutePath);
    this.db.pragma("journal_mode = WAL");
  }

  async all<T>(sql: string, args: SqlArg[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...args) as T[];
  }

  async get<T>(sql: string, args: SqlArg[] = []): Promise<T | null> {
    return (this.db.prepare(sql).get(...args) as T | undefined) ?? null;
  }

  async run(sql: string, args: SqlArg[] = []): Promise<{ changes: number }> {
    const result = this.db.prepare(sql).run(...args);
    return { changes: result.changes };
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async migrate(): Promise<void> {
    for (const statement of migrationSql) {
      this.db.exec(statement);
    }
  }
}

class RemoteSqliteClient implements DBClient {
  private client: LibsqlClient;

  constructor(url: string, authToken?: string) {
    this.client = createClient({ url, authToken });
  }

  async all<T>(sql: string, args: SqlArg[] = []): Promise<T[]> {
    const result = await this.client.execute({ sql, args: args as InArgs });
    return (result.rows as T[]) ?? [];
  }

  async get<T>(sql: string, args: SqlArg[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, args);
    return rows[0] ?? null;
  }

  async run(sql: string, args: SqlArg[] = []): Promise<{ changes: number }> {
    const result = await this.client.execute({ sql, args: args as InArgs });
    return { changes: result.rowsAffected ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.client.execute({ sql });
  }

  async migrate(): Promise<void> {
    for (const statement of migrationSql) {
      await this.client.execute({ sql: statement });
    }
  }
}

let singleton: DBClient | null = null;

export async function getDb(): Promise<DBClient> {
  if (!singleton) {
    const config = getConfig();
    singleton =
      config.db.mode === "local"
        ? new LocalSqliteClient(config.db.localPath)
        : new RemoteSqliteClient(config.db.libsqlUrl!, config.db.libsqlAuthToken);

    await singleton.migrate();
  }

  return singleton;
}
