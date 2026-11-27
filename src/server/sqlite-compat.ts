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

export function normalizeSqliteParam(val: unknown): any {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === 'boolean') {
    return val ? 1 : 0;
  }
  return val;
}

function normalizeParamList(params: any[]): any[] {
  const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  return flat.map(normalizeSqliteParam);
}

let NativeDatabaseSync: any = null;
if (!process.env.FORCE_SQLJS) {
  try {
    const baseRef = typeof __filename === 'string' && __filename ? __filename : import.meta.url;
    const req = createRequire(baseRef);
    const sqliteMod = req('node:sqlite');
    if (sqliteMod && sqliteMod.DatabaseSync) {
      NativeDatabaseSync = sqliteMod.DatabaseSync;
    }
  } catch {
    // node:sqlite not available (e.g. Node 18 / 20 / <22.5)
  }
}

let sqlJsModule: any = null;
let sqlEnginePromise: Promise<void> | null = null;

export function isSqlEngineReady(): boolean {
  return Boolean((NativeDatabaseSync && !process.env.FORCE_SQLJS) || sqlJsModule);
}

export async function ensureSqlEngineLoaded(): Promise<void> {
  if (isSqlEngineReady()) return;
  if (!sqlEnginePromise) {
    sqlEnginePromise = (async () => {
      // @ts-expect-error sql-wasm-inline.js does not ship a .d.ts file
      const initSqlJs = (await import('sql.js/dist/sql-wasm-inline.js')).default;
      sqlJsModule = await initSqlJs();
    })().catch((err) => {
      sqlEnginePromise = null;
      throw err;
    });
  }
  return sqlEnginePromise;
}

export function setPreloadedSqlJs(SQL: any): void {
  sqlJsModule = SQL;
}

class NativeDatabaseAdapter implements SqliteDatabaseEngine {
  private db: any;

  constructor(filePath: string) {
    this.db = new NativeDatabaseSync(filePath);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepare(sql);
    return {
      run(...params: any[]): RunResult {
        return stmt.run(...normalizeParamList(params));
      },
      get(...params: any[]): any {
        return stmt.get(...normalizeParamList(params));
      },
      all(...params: any[]): any[] {
        return stmt.all(...normalizeParamList(params));
      },
    };
  }

  close(): void {
    this.db.close();
  }
}

class SqlJsDatabaseAdapter implements SqliteDatabaseEngine {
  private db: any;
  private filePath: string;
  private inTransaction = false;
  private lastDiskMtimeMs = 0;
  private lastDiskSize = 0;

  constructor(filePath: string) {
    this.filePath = filePath;
    if (!sqlJsModule) {
      throw new Error('SQL.js engine was not initialized before creating database instance.');
    }
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.filePath !== ':memory:' && fs.existsSync(this.filePath)) {
      const stat = fs.statSync(this.filePath);
      const buf = fs.readFileSync(this.filePath);
      if (this.db) {
        try {
          this.db.close();
        } catch {}
      }
      this.db = buf.length > 0 ? new sqlJsModule.Database(new Uint8Array(buf)) : new sqlJsModule.Database();
      this.lastDiskMtimeMs = stat.mtimeMs;
      this.lastDiskSize = stat.size;
    } else if (!this.db) {
      this.db = new sqlJsModule.Database();
      this.lastDiskMtimeMs = 0;
      this.lastDiskSize = 0;
    }
  }

  private reloadFromDiskIfChanged(): void {
    if (this.filePath === ':memory:' || this.inTransaction) return;
    try {
      if (!fs.existsSync(this.filePath)) return;
      const stat = fs.statSync(this.filePath);
      if (stat.mtimeMs !== this.lastDiskMtimeMs || stat.size !== this.lastDiskSize) {
        this.loadFromDisk();
      }
    } catch {
      // ignore transient stat error during concurrent atomic rename
    }
  }

  private persistToDisk(): void {
    if (this.filePath === ':memory:' || this.inTransaction) return;
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    try {
      const data = this.db.export();
      fs.writeFileSync(tmpPath, Buffer.from(data));
      fs.renameSync(tmpPath, this.filePath);
      try {
        const stat = fs.statSync(this.filePath);
        this.lastDiskMtimeMs = stat.mtimeMs;
        this.lastDiskSize = stat.size;
      } catch {}
    } catch (err) {
      try {
        if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true });
      } catch {
        // ignore cleanup error
      }
      console.error('[SQL.js Persist] Error saving database file:', err);
    }
  }

  exec(sql: string): void {
    const upper = sql.trim().toUpperCase();
    if (upper.startsWith('PRAGMA JOURNAL_MODE') || upper.startsWith('PRAGMA WAL_CHECKPOINT')) {
      return;
    }
    if (!this.inTransaction) {
      this.reloadFromDiskIfChanged();
    }
    try {
      this.db.run(sql);
      if (upper.startsWith('BEGIN')) {
        this.inTransaction = true;
      } else if (upper.startsWith('COMMIT') || upper.startsWith('ROLLBACK')) {
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
    const self = this;

    return {
      run(...params: any[]): RunResult {
        if (!self.inTransaction) {
          self.reloadFromDiskIfChanged();
        }
        const bound = normalizeParamList(params);
        self.db.run(sql, bound);
        const changes = self.db.getRowsModified();
        const res = self.db.exec('SELECT last_insert_rowid() AS id');
        const lastInsertRowid = res?.[0]?.values?.[0]?.[0] ?? 0;
        self.persistToDisk();
        return { lastInsertRowid: Number(lastInsertRowid), changes };
      },
      get(...params: any[]): any {
        self.reloadFromDiskIfChanged();
        const bound = normalizeParamList(params);
        const stmt = self.db.prepare(sql);
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
        self.reloadFromDiskIfChanged();
        const bound = normalizeParamList(params);
        const stmt = self.db.prepare(sql);
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
  if (NativeDatabaseSync && !process.env.FORCE_SQLJS) {
    return new NativeDatabaseAdapter(resolvedPath);
  }
  return new SqlJsDatabaseAdapter(resolvedPath);
}
