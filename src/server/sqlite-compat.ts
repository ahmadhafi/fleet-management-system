import fs from 'node:fs';
import { createRequire } from 'node:module';

export interface RunResult {
  lastInsertRowid: number | bigint;
  changes: number;
}

export interface PreparedStatement {
  run(...params: any[]): RunResult;
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

export interface SqliteDatabaseEngine {
  exec(sql: string): void;
  prepare(sql: string): PreparedStatement;
  close(): void;
}

let NativeDatabaseSync: any = null;
if (!process.env.FORCE_SQLJS) {
  try {
    const req = createRequire(import.meta.url || __filename);
    const sqliteMod = req('node:sqlite');
    if (sqliteMod && sqliteMod.DatabaseSync) {
      NativeDatabaseSync = sqliteMod.DatabaseSync;
    }
  } catch {
    // node:sqlite not available (e.g. Node 18 / 20 / <22.5)
  }
}

let sqlJsModule: any = null;

export async function ensureSqlEngineLoaded(): Promise<void> {
  if (NativeDatabaseSync || sqlJsModule) return;
  // @ts-expect-error sql-wasm-inline.js does not ship a .d.ts file
  const initSqlJs = (await import('sql.js/dist/sql-wasm-inline.js')).default;
  sqlJsModule = await initSqlJs();
}

export function setPreloadedSqlJs(SQL: any): void {
  sqlJsModule = SQL;
}

class SqlJsDatabaseAdapter implements SqliteDatabaseEngine {
  private db: any;
  private filePath: string;
  private inTransaction = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    if (!sqlJsModule) {
      throw new Error('SQL.js engine was not initialized before creating database instance.');
    }
    if (filePath !== ':memory:' && fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      this.db = buf.length > 0 ? new sqlJsModule.Database(new Uint8Array(buf)) : new sqlJsModule.Database();
    } else {
      this.db = new sqlJsModule.Database();
    }
  }

  private persistToDisk(): void {
    if (this.filePath === ':memory:' || this.inTransaction) return;
    try {
      const data = this.db.export();
      fs.writeFileSync(this.filePath, Buffer.from(data));
    } catch (err) {
      console.error('[SQL.js Persist] Error saving database file:', err);
    }
  }

  exec(sql: string): void {
    const upper = sql.trim().toUpperCase();
    if (upper.startsWith('PRAGMA JOURNAL_MODE') || upper.startsWith('PRAGMA WAL_CHECKPOINT')) {
      return;
    }
    if (upper.startsWith('BEGIN')) {
      this.inTransaction = true;
    }
    try {
      this.db.run(sql);
      if (upper.startsWith('COMMIT') || upper.startsWith('ROLLBACK')) {
        this.inTransaction = false;
        this.persistToDisk();
      } else if (!this.inTransaction) {
        this.persistToDisk();
      }
    } catch (err) {
      if (upper.startsWith('COMMIT') || upper.startsWith('ROLLBACK')) {
        this.inTransaction = false;
      }
      throw err;
    }
  }

  prepare(sql: string): PreparedStatement {
    const db = this.db;
    const self = this;

    const normalizeParams = (params: any[]): any[] => {
      if (params.length === 1 && Array.isArray(params[0])) {
        return params[0];
      }
      return params.map((p) => (p === undefined ? null : p));
    };

    return {
      run(...params: any[]): RunResult {
        const bound = normalizeParams(params);
        db.run(sql, bound);
        const changes = db.getRowsModified();
        const res = db.exec('SELECT last_insert_rowid() AS id');
        const lastInsertRowid = res?.[0]?.values?.[0]?.[0] ?? 0;
        self.persistToDisk();
        return { lastInsertRowid: Number(lastInsertRowid), changes };
      },
      get(...params: any[]): any {
        const bound = normalizeParams(params);
        const stmt = db.prepare(sql);
        try {
          if (bound.length > 0) stmt.bind(bound);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params: any[]): any[] {
        const bound = normalizeParams(params);
        const stmt = db.prepare(sql);
        const rows: any[] = [];
        try {
          if (bound.length > 0) stmt.bind(bound);
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          stmt.free();
        }
      },
    };
  }

  close(): void {
    this.inTransaction = false;
    this.persistToDisk();
    this.db.close();
  }
}

export function createDatabaseEngine(resolvedPath: string): SqliteDatabaseEngine {
  if (NativeDatabaseSync) {
    return new NativeDatabaseSync(resolvedPath);
  }
  return new SqlJsDatabaseAdapter(resolvedPath);
}
