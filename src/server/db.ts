import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabaseEngine, type SqliteDatabaseEngine } from './sqlite-compat.ts';

export type AppDatabase = SqliteDatabaseEngine;

export function resolveAppRoot(): string {
  if (process.env.APP_ROOT && fs.existsSync(process.env.APP_ROOT)) {
    return path.resolve(process.env.APP_ROOT);
  }
  let moduleDir = '';
  try {
    if (typeof __dirname === 'string' && __dirname) {
      moduleDir = __dirname;
    } else if (typeof import.meta !== 'undefined' && import.meta.url) {
      moduleDir = path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {
    // ignore resolution error
  }
  const candidates: string[] = [];
  if (moduleDir) {
    const base = path.basename(moduleDir);
    if (base === 'dist-server') {
      candidates.push(path.resolve(moduleDir, '..'));
    } else if (base === 'server' && path.basename(path.dirname(moduleDir)) === 'src') {
      candidates.push(path.resolve(moduleDir, '..', '..'));
    }
    candidates.push(
      path.resolve(moduleDir, '..'),
      path.resolve(moduleDir, '..', '..'),
      moduleDir
    );
  }
  candidates.push(process.cwd());

  for (const dir of candidates) {
    if (
      fs.existsSync(path.join(dir, 'app.js')) ||
      fs.existsSync(path.join(dir, 'package.json')) ||
      fs.existsSync(path.join(dir, 'dist'))
    ) {
      return dir;
    }
  }
  return process.cwd();
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = String(storedHash || '').split(':');
    if (!salt || !key) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(key, 'hex');
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

export function runInTransaction<T>(db: AppDatabase, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    throw err;
  }
}

let dbInstance: AppDatabase | null = null;

export function getDb(customPath?: string): AppDatabase {
  if (dbInstance && !customPath) return dbInstance;

  const resolvedPath =
    customPath ||
    process.env.DB_PATH ||
    path.join(resolveAppRoot(), 'data', 'fleet-management-v2.db');

  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = createDatabaseEngine(resolvedPath);
  let walEnabled = false;
  if (resolvedPath !== ':memory:') {
    try {
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA synchronous = NORMAL;');
      walEnabled = true;
    } catch {
      try {
        db.exec('PRAGMA journal_mode = DELETE;');
        db.exec('PRAGMA synchronous = FULL;');
      } catch {
        // ignore if engine does not use journal PRAGMAs
      }
    }
  }
  try {
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 10000;');
  } catch {
    // ignore pragma warnings
  }

  try {
    initializeSchema(db);
    seedDatabaseIfEmpty(db);
  } catch (initErr) {
    if (walEnabled && resolvedPath !== ':memory:') {
      // Some shared hosting filesystems (NFS/CageFS) allow WAL pragma but fail on -shm mmap during writes
      console.warn('[GalaxyFleet DB] Retrying initialization with journal_mode = DELETE:', (initErr as Error).message);
      try {
        db.exec('PRAGMA journal_mode = DELETE;');
        db.exec('PRAGMA synchronous = FULL;');
        initializeSchema(db);
        seedDatabaseIfEmpty(db);
      } catch (retryErr) {
        try {
          db.close();
        } catch {}
        throw retryErr;
      }
    } else {
      try {
        db.close();
      } catch {}
      throw initErr;
    }
  }

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

export function checkpointDb(): void {
  if (!dbInstance) return;
  try {
    dbInstance.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // ignore if journal_mode is DELETE
  }
}

export function flushAndCloseDb(): void {
  if (!dbInstance) return;
  try {
    dbInstance.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // ignore if not in WAL mode
  }
  try {
    dbInstance.close();
  } catch {
    // ignore close errors
  }
  dbInstance = null;
}

export function resetDbForTesting(customPath = ':memory:', includeTestFixtures = true): AppDatabase {
  flushAndCloseDb();
  dbInstance = getDb(customPath);
  if (includeTestFixtures) {
    seedTestFixturesForVitest(dbInstance);
  }
  return dbInstance;
}

function initializeSchema(db: AppDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL,
      group_username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADM', 'FM', 'HWS', 'DRV', 'EMP')),
      is_department_admin INTEGER NOT NULL DEFAULT 0,
      department_id INTEGER NOT NULL REFERENCES departments(id),
      approval_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
      approved_by INTEGER REFERENCES users(id),
      approved_at TEXT,
      rejection_reason TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      contact_number TEXT,
      photo_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_plate TEXT NOT NULL UNIQUE,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      car_type TEXT NOT NULL DEFAULT 'Sedan',
      year INTEGER NOT NULL DEFAULT 2025,
      vin TEXT NOT NULL UNIQUE,
      energy_type TEXT NOT NULL CHECK (energy_type IN ('Gasoline', 'Electric')),
      seats INTEGER NOT NULL DEFAULT 5,
      current_odometer INTEGER NOT NULL DEFAULT 0,
      battery_percent INTEGER,
      status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Standby', 'In Maintenance', 'Deactivated', 'Retired')),
      standby_reason TEXT,
      last_parking_spot TEXT DEFAULT 'HQ Main Lot',
      default_driver_id INTEGER REFERENCES driver_profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS driver_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      full_name TEXT NOT NULL,
      licence_number TEXT NOT NULL UNIQUE,
      licence_class TEXT NOT NULL DEFAULT 'A',
      licence_expiry TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      availability_status TEXT NOT NULL DEFAULT 'Active' CHECK (availability_status IN ('Active', 'On Leave', 'Inactive')),
      photo_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trip_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL REFERENCES users(id),
      department_id INTEGER NOT NULL REFERENCES departments(id),
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      preferred_driver_id INTEGER REFERENCES driver_profiles(id),
      passenger_nickname TEXT,
      passengers_json TEXT,
      purpose TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      passenger_count INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED')),
      start_odometer INTEGER,
      start_odometer_photo_url TEXT,
      start_odometer_time TEXT,
      end_odometer INTEGER,
      end_odometer_photo_url TEXT,
      end_odometer_time TEXT,
      distance_km INTEGER,
      actual_start_time TEXT,
      actual_end_time TEXT,
      parking_return_note TEXT,
      is_urgent INTEGER NOT NULL DEFAULT 0,
      urgent_reason TEXT,
      reservation_type TEXT NOT NULL DEFAULT 'ONE_WAY',
      return_pickup_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS approval_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_request_id INTEGER NOT NULL REFERENCES trip_requests(id),
      decider_id INTEGER NOT NULL REFERENCES users(id),
      decider_role TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS prevent_approval_decision_update
    BEFORE UPDATE ON approval_decisions
    BEGIN
      SELECT RAISE(ABORT, 'Approval decisions are immutable and cannot be updated (REQ-06)');
    END;

    CREATE TRIGGER IF NOT EXISTS prevent_approval_decision_delete
    BEFORE DELETE ON approval_decisions
    BEGIN
      SELECT RAISE(ABORT, 'Approval decisions are immutable and cannot be deleted (REQ-06)');
    END;

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_request_id INTEGER REFERENCES trip_requests(id),
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      booked_by INTEGER NOT NULL REFERENCES users(id),
      purpose TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      buffer_minutes INTEGER NOT NULL DEFAULT 15,
      recurrence_group_id TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
      cancellation_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS booking_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id),
      changed_by INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      previous_values_json TEXT NOT NULL,
      new_values_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_request_id INTEGER REFERENCES trip_requests(id),
      booking_id INTEGER REFERENCES bookings(id),
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      driver_profile_id INTEGER NOT NULL REFERENCES driver_profiles(id),
      assigned_by INTEGER NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL DEFAULT 'Initial dispatch assignment',
      effective_start TEXT NOT NULL,
      effective_end TEXT NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 1,
      acknowledged_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS prevent_assignment_delete
    BEFORE DELETE ON assignments
    BEGIN
      SELECT RAISE(ABORT, 'Assignment records are append-only and cannot be deleted (ASN-04)');
    END;

    CREATE TABLE IF NOT EXISTS trip_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_request_id INTEGER NOT NULL REFERENCES trip_requests(id),
      assignment_id INTEGER REFERENCES assignments(id),
      driver_user_id INTEGER NOT NULL REFERENCES users(id),
      event_type TEXT NOT NULL CHECK (event_type IN ('ACKNOWLEDGED', 'TRIP_STARTED', 'ODOMETER_LOGGED', 'BATTERY_LOGGED', 'INSPECTION_SUBMITTED', 'DAMAGE_REPORTED', 'TRIP_COMPLETED', 'CORRECTION')),
      odometer_km INTEGER,
      battery_percent INTEGER,
      notes TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS prevent_trip_event_mutation
    BEFORE UPDATE ON trip_events
    BEGIN
      SELECT RAISE(ABORT, 'Trip events are append-only and cannot be modified (TRP-10)');
    END;

    CREATE TABLE IF NOT EXISTS fuel_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      trip_request_id INTEGER REFERENCES trip_requests(id),
      recorded_by INTEGER NOT NULL REFERENCES users(id),
      date_time TEXT NOT NULL,
      litres REAL NOT NULL CHECK (litres > 0),
      cost REAL NOT NULL CHECK (cost >= 0),
      odometer_km INTEGER NOT NULL CHECK (odometer_km >= 0),
      station TEXT,
      receipt_document_id INTEGER,
      override_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ev_charging_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      trip_request_id INTEGER REFERENCES trip_requests(id),
      recorded_by INTEGER NOT NULL REFERENCES users(id),
      date_time TEXT NOT NULL,
      kwh_added REAL NOT NULL CHECK (kwh_added > 0),
      cost REAL NOT NULL CHECK (cost >= 0),
      battery_start_pct INTEGER NOT NULL CHECK (battery_start_pct >= 0 AND battery_start_pct <= 100),
      battery_end_pct INTEGER NOT NULL CHECK (battery_end_pct >= 0 AND battery_end_pct <= 100),
      odometer_km INTEGER NOT NULL DEFAULT 0,
      station TEXT,
      receipt_document_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      recorded_by INTEGER NOT NULL REFERENCES users(id),
      maintenance_type TEXT NOT NULL,
      applicable_energy_type TEXT NOT NULL DEFAULT 'Both' CHECK (applicable_energy_type IN ('Gasoline', 'Electric', 'Both')),
      service_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      odometer_km INTEGER NOT NULL DEFAULT 0,
      provider TEXT NOT NULL,
      cost REAL NOT NULL CHECK (cost >= 0),
      status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed')),
      blocks_availability INTEGER NOT NULL DEFAULT 1,
      next_due_date TEXT,
      next_due_odometer_km INTEGER,
      notes TEXT,
      document_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      trip_request_id INTEGER REFERENCES trip_requests(id),
      submitted_by INTEGER NOT NULL REFERENCES users(id),
      date_time TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Parking', 'Toll', 'Gas', 'Charging', 'Gasoline', 'EV Charging', 'Cleaning', 'Accessories', 'Other')),
      amount REAL NOT NULL CHECK (amount > 0),
      description TEXT NOT NULL,
      receipt_document_id INTEGER,
      receipt_data_url TEXT,
      receipt_filename TEXT,
      approval_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
      reimbursement_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (reimbursement_status IN ('NOT_APPLICABLE', 'PENDING', 'REIMBURSED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expense_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL REFERENCES expenses(id),
      decider_id INTEGER NOT NULL REFERENCES users(id),
      decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED', 'REIMBURSED')),
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('VEHICLE', 'DRIVER', 'FUEL', 'EV', 'EXPENSE', 'DAMAGE', 'MAINTENANCE')),
      entity_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL CHECK (doc_type IN ('Registration', 'Insurance', 'Inspection', 'Driver Licence', 'Receipt', 'Damage Photo', 'Other')),
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      content_base64 TEXT NOT NULL,
      expiry_date TEXT,
      is_personal_restricted INTEGER NOT NULL DEFAULT 0,
      version_number INTEGER NOT NULL DEFAULT 1,
      replaced_by_id INTEGER REFERENCES documents(id),
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS location_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_profile_id INTEGER NOT NULL REFERENCES driver_profiles(id),
      driver_user_id INTEGER NOT NULL REFERENCES users(id),
      vehicle_id INTEGER REFERENCES vehicles(id),
      assignment_id INTEGER REFERENCES assignments(id),
      latitude REAL,
      longitude REAL,
      accuracy_meters REAL,
      capture_time TEXT NOT NULL,
      server_receipt_time TEXT NOT NULL,
      permission_state TEXT NOT NULL DEFAULT 'GRANTED' CHECK (permission_state IN ('GRANTED', 'DENIED', 'UNAVAILABLE')),
      phone_state TEXT DEFAULT 'FOREGROUND',
      is_flagged_implausible INTEGER NOT NULL DEFAULT 0,
      flag_reason TEXT
    );

    CREATE TRIGGER IF NOT EXISTS prevent_location_report_update
    BEFORE UPDATE ON location_reports
    BEGIN
      SELECT RAISE(ABORT, 'Location reports are append-only and cannot be updated (GPS-09)');
    END;

    CREATE TABLE IF NOT EXISTS user_locations (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      latitude REAL NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
      longitude REAL NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
      accuracy_meters REAL,
      address_label TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      trigger_type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      related_entity_type TEXT,
      related_entity_id INTEGER,
      channel TEXT NOT NULL DEFAULT 'IN_APP_AND_PUSH',
      delivery_status TEXT NOT NULL DEFAULT 'DELIVERED',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_username TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      previous_values_json TEXT,
      new_values_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS prevent_audit_update
    BEFORE UPDATE ON audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Audit events are immutable and cannot be modified (AUD-02)');
    END;

    CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
    BEFORE DELETE ON audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Audit events are immutable and cannot be deleted (AUD-02)');
    END;

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  try {
    db.exec('ALTER TABLE vehicles ADD COLUMN default_driver_id INTEGER REFERENCES driver_profiles(id);');
  } catch {}
  try {
    db.exec('ALTER TABLE trip_requests ADD COLUMN passenger_nickname TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE trip_requests ADD COLUMN passengers_json TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE expenses ADD COLUMN receipt_data_url TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE expenses ADD COLUMN receipt_filename TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE trip_requests ADD COLUMN start_odometer_photo_url TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE trip_requests ADD COLUMN start_odometer_time TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE trip_requests ADD COLUMN end_odometer_photo_url TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE trip_requests ADD COLUMN end_odometer_time TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE driver_profiles ADD COLUMN photo_url TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE users ADD COLUMN contact_number TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE users ADD COLUMN photo_url TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE trip_requests ADD COLUMN is_urgent INTEGER NOT NULL DEFAULT 0;');
  } catch {}
  try {
    db.exec('ALTER TABLE trip_requests ADD COLUMN urgent_reason TEXT;');
  } catch {}
  try {
    db.exec("ALTER TABLE trip_requests ADD COLUMN reservation_type TEXT NOT NULL DEFAULT 'ONE_WAY';");
  } catch {}
  try {
    db.exec('ALTER TABLE trip_requests ADD COLUMN return_pickup_time TEXT;');
  } catch {}
}

export const COMPANY_GROUPS: ReadonlyArray<readonly [string, string]> = [
  ['Innovation G', 'INNOV'],
  ['Management Support G', 'MSUP'],
  ['Utility & EHS G', 'UEHS'],
  ['People G', 'PEOPLE'],
  ['Main Production G', 'MPROD'],
  ['SMD Production G', 'SMDP'],
  ['CS G', 'CS'],
  ['PURCHASING G', 'PURCH'],
  ['BUSINESS SUPPORT G', 'BSUP'],
  ['PE G', 'PE'],
  ['ME G', 'ME'],
  ['PRODUCTION CONTROL G', 'PCTRL'],
  ['Driver G', 'DRV'],
];

export function findDriverGroupId(db: AppDatabase): number | null {
  const row = db
    .prepare(
      `SELECT id FROM departments
       WHERE is_active = 1
         AND (LOWER(TRIM(name)) IN ('driver g', 'driver', 'driver group')
              OR UPPER(TRIM(code)) IN ('DRV', 'DRIVER', 'DRIVER_G'))
       ORDER BY id ASC
       LIMIT 1`
    )
    .get() as { id: number } | undefined;
  return row ? row.id : null;
}

export function ensureDriverGroup(db: AppDatabase): number {
  const activeId = findDriverGroupId(db);
  if (activeId) return activeId;

  const existingAnyState = db
    .prepare(
      `SELECT id, is_active FROM departments
       WHERE LOWER(TRIM(name)) IN ('driver g', 'driver', 'driver group')
          OR UPPER(TRIM(code)) IN ('DRV', 'DRIVER', 'DRIVER_G')
       ORDER BY id ASC
       LIMIT 1`
    )
    .get() as { id: number; is_active: number } | undefined;

  if (existingAnyState) {
    if (existingAnyState.is_active !== 1) {
      db.prepare('UPDATE departments SET is_active = 1 WHERE id = ?').run(existingAnyState.id);
    }
    return existingAnyState.id;
  }

  try {
    const res = db.prepare('INSERT INTO departments (name, code, is_active) VALUES (?, ?, 1)').run('Driver G', 'DRV');
    return Number(res.lastInsertRowid) || findDriverGroupId(db) || 1;
  } catch {
    db.prepare('INSERT OR IGNORE INTO departments (name, code, is_active) VALUES (?, ?, 1)').run('Driver G', 'DRV');
    return findDriverGroupId(db) ?? 1;
  }
}

function seedDatabaseIfEmpty(db: AppDatabase) {
  const deptCount = (db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number }).count;
  if (deptCount === 0) {
    const insertDept = db.prepare('INSERT INTO departments (name, code) VALUES (?, ?)');
    for (const [name, code] of COMPANY_GROUPS) {
      insertDept.run(name, code);
    }
  } else {
    // Idempotent upgrade for existing production databases created with the original 12 groups (or deactivated Driver G)
    ensureDriverGroup(db);
  }

  const insertSetting = db.prepare('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)');
  insertSetting.run('gps_stale_threshold_minutes', '25');
  insertSetting.run('gps_retention_days', '90');
  insertSetting.run('booking_buffer_minutes', '15');
  insertSetting.run('session_idle_timeout_minutes', '60');
  insertSetting.run('tracking_rule', 'ASSIGNED_TRIP_OR_ACTIVE_DUTY');

  // Create initial Administrator account only once when no users exist in the database
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount === 0) {
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminNickname = (process.env.ADMIN_NICKNAME || 'System Admin').trim();
    const firstDept = db.prepare('SELECT id FROM departments WHERE is_active = 1 ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined;
    const adminDeptId = firstDept?.id ?? 1;

    db.prepare(`
      INSERT INTO users (nickname, group_username, password_hash, role, is_department_admin, department_id, approval_status, approved_at, is_active)
      VALUES (?, ?, ?, 'ADM', 1, ?, 'APPROVED', datetime('now'), 1)
    `).run(adminNickname, adminUsername, hashPassword(adminPassword), adminDeptId);
  }

  if (process.env.AUTO_SEED_DEMO === 'true' || process.env.SEED_DEMO_DATA === 'true') {
    seedDemoFixtures(db);
  }
}

export const seedTestFixturesForVitest = (db: AppDatabase) => seedDemoFixtures(db, { force: true });

export function seedDemoFixtures(db: AppDatabase, options?: { force?: boolean }) {
  if (!options?.force) {
    const suppressed = db
      .prepare("SELECT value FROM system_settings WHERE key = 'demo_seed_suppressed'")
      .get() as { value: string } | undefined;
    if (suppressed?.value === '1') return;

    const seeded = db
      .prepare("SELECT value FROM system_settings WHERE key = 'initial_demo_seeded'")
      .get() as { value: string } | undefined;
    if (seeded?.value === '1') return;
  }

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const vehicleCount = (db.prepare('SELECT COUNT(*) as count FROM vehicles').get() as { count: number }).count;
  const driverCount = (db.prepare('SELECT COUNT(*) as count FROM driver_profiles').get() as { count: number }).count;
  const tripCount = (db.prepare('SELECT COUNT(*) as count FROM trip_requests').get() as { count: number }).count;
  if (userCount > 1 || vehicleCount > 0 || driverCount > 0 || tripCount > 0) return;

  const adminRow = db.prepare("SELECT id FROM users WHERE role = 'ADM' ORDER BY id ASC LIMIT 1").get() as { id: number } | undefined;
  if (!adminRow) return;
  const adminId = adminRow.id;

  const activeDepts = db.prepare('SELECT id, code FROM departments WHERE is_active = 1 ORDER BY id ASC').all() as Array<{ id: number; code: string }>;
  const fallbackDeptId = activeDepts[0]?.id ?? 1;
  const deptByCode = (code: string) => activeDepts.find((d) => d.code.toUpperCase() === code)?.id ?? fallbackDeptId;

  const innovDeptId = deptByCode('INNOV');
  const msupDeptId = deptByCode('MSUP');
  const uehsDeptId = deptByCode('UEHS');
  const smdpDeptId = deptByCode('SMDP');
  const driverDeptId = findDriverGroupId(db) ?? fallbackDeptId;

  runInTransaction(db, () => {
    const insertUser = db.prepare(`
      INSERT INTO users (nickname, group_username, password_hash, role, is_department_admin, department_id, approval_status, approved_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', datetime('now'), 1)
    `);

    insertUser.run('Rina (Fleet Manager)', 'fleetmgr', hashPassword('Fleet@123'), 'FM', 0, innovDeptId);
    insertUser.run('Hendra (Head of HWS)', 'hws_head', hashPassword('Hws@123'), 'HWS', 1, innovDeptId);
    const drvBudiUserId = Number(insertUser.run('Budi Santoso', 'drv_budi', hashPassword('Driver@123'), 'DRV', 0, driverDeptId).lastInsertRowid);
    const drvAndiUserId = Number(insertUser.run('Andi Wijaya', 'drv_andi', hashPassword('Driver@123'), 'DRV', 0, driverDeptId).lastInsertRowid);
    const drvCitraUserId = Number(insertUser.run('Citra Lestari', 'drv_citra', hashPassword('Driver@123'), 'DRV', 0, driverDeptId).lastInsertRowid);
    const drvDeniUserId = Number(insertUser.run('Deni Pratama', 'drv_deni', hashPassword('Driver@123'), 'DRV', 0, driverDeptId).lastInsertRowid);
    const deptAdminId = Number(insertUser.run('Nadia (Ops Dept Admin)', 'dept_admin', hashPassword('Dept@123'), 'EMP', 1, msupDeptId).lastInsertRowid);
    const empAlexId = Number(insertUser.run('Alex (Engineering)', 'emp_alex', hashPassword('Emp@123'), 'EMP', 0, uehsDeptId).lastInsertRowid);
    const empSaraId = Number(insertUser.run('Sara (Sales)', 'emp_sara', hashPassword('Emp@123'), 'EMP', 0, smdpDeptId).lastInsertRowid);

    const makeDriverSvg = (initial: string, bg: string, cap: string, skin: string) =>
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${bg}"/><path d="M20 94 C20 74 34 68 50 68 C66 68 80 74 80 94 Z" fill="#0f172a"/><polygon points="50,68 44,78 50,88 56,78" fill="#ffffff"/><polygon points="50,78 47,94 53,94" fill="#0072de"/><rect x="44" y="54" width="12" height="16" rx="4" fill="${skin}"/><ellipse cx="50" cy="46" rx="16" ry="18" fill="${skin}"/><circle cx="44" cy="46" r="2" fill="#0f172a"/><circle cx="56" cy="46" r="2" fill="#0f172a"/><path d="M46 54 Q50 58 54 54" stroke="#0f172a" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M30 36 C30 24 70 24 70 36 Z" fill="${cap}"/><rect x="28" y="34" width="44" height="4" rx="2" fill="#facc15"/><path d="M26 38 C32 40 68 40 74 38 Z" fill="#0f172a"/><circle cx="50" cy="30" r="5" fill="#facc15"/><text x="50" y="33" font-size="6" font-family="sans-serif" font-weight="bold" fill="#0f172a" text-anchor="middle">${initial}</text></svg>`
      );

    const insertDriver = db.prepare(`
      INSERT INTO driver_profiles (user_id, full_name, licence_number, licence_class, licence_expiry, contact_number, availability_status, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, 'Active', ?)
    `);
    const drvBudiProfId = Number(insertDriver.run(drvBudiUserId, 'Budi Santoso', 'SIM-A-90811234', 'A', '2028-06-30', '+62-811-2233-4401', makeDriverSvg('B', '#0072de', '#005bb5', '#f6d1b1')).lastInsertRowid);
    const drvAndiProfId = Number(insertDriver.run(drvAndiUserId, 'Andi Wijaya', 'SIM-A-90815678', 'A', '2027-11-15', '+62-811-2233-4402', makeDriverSvg('A', '#059669', '#047857', '#e5b894')).lastInsertRowid);
    const drvCitraProfId = Number(insertDriver.run(drvCitraUserId, 'Citra Lestari', 'SIM-A-90819012', 'A', '2028-03-20', '+62-811-2233-4403', makeDriverSvg('C', '#4f46e5', '#3730a3', '#fcd34d')).lastInsertRowid);
    const drvDeniProfId = Number(insertDriver.run(drvDeniUserId, 'Deni Pratama', 'SIM-B1-90813456', 'B1', '2027-09-10', '+62-811-2233-4404', makeDriverSvg('D', '#d97706', '#b45309', '#f6c39a')).lastInsertRowid);

    const insertVehicle = db.prepare(`
      INSERT INTO vehicles (registration_plate, make, model, car_type, year, vin, energy_type, seats, current_odometer, battery_percent, status, last_parking_spot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?)
    `);
    const veh1Id = Number(insertVehicle.run('B 1001 FMS', 'Toyota', 'Camry 2.5 V', 'Executive Sedan', 2024, 'MHF11CAMRY0001001', 'Gasoline', 4, 34200, null, 'Basement B1 - Slot A01').lastInsertRowid);
    const veh2Id = Number(insertVehicle.run('B 1002 FMS', 'Toyota', 'Kijang Innova Zenix', 'MPV 7-Seater', 2025, 'MHF11ZENIX0001002', 'Gasoline', 7, 28510, null, 'Basement B1 - Slot A02').lastInsertRowid);
    const veh3Id = Number(insertVehicle.run('B 1003 FMS', 'Honda', 'CR-V 1.5 Turbo', 'SUV', 2024, 'MHR11CRV000001003', 'Gasoline', 5, 41890, null, 'Basement B1 - Slot A03').lastInsertRowid);
    const veh4Id = Number(insertVehicle.run('B 1004 FMS', 'Mitsubishi', 'Xpander Ultimate', 'MPV 7-Seater', 2025, 'MMB11XPAND0001004', 'Gasoline', 7, 19340, null, 'Basement B1 - Slot A04').lastInsertRowid);
    const veh5Id = Number(insertVehicle.run('B 1005 FMS', 'Hyundai', 'Stargazer Prime', 'MPV 7-Seater', 2025, 'KMH11STARG0001005', 'Gasoline', 7, 24100, null, 'Basement B1 - Slot A05').lastInsertRowid);
    const veh6Id = Number(insertVehicle.run('B 2001 EV', 'Hyundai', 'Ioniq 5 Signature', 'Electric SUV', 2025, 'KMH11IONIQ0002001', 'Electric', 5, 15620, 88, 'Basement B1 - EV Charger 01').lastInsertRowid);
    const veh7Id = Number(insertVehicle.run('B 2002 EV', 'BYD', 'Atto 3 Extended', 'Electric SUV', 2025, 'LC011ATTO30002002', 'Electric', 5, 11400, 92, 'Basement B1 - EV Charger 02').lastInsertRowid);
    const veh8Id = Number(insertVehicle.run('B 2003 EV', 'Tesla', 'Model Y Long Range', 'Electric Crossover', 2025, '5YJ11MODLY0002003', 'Electric', 5, 22780, 79, 'Basement B1 - EV Charger 03').lastInsertRowid);

    // Assign fixed default drivers across vehicles
    const assignDefaultDrv = db.prepare('UPDATE vehicles SET default_driver_id = ? WHERE id = ?');
    assignDefaultDrv.run(drvBudiProfId, veh1Id);
    assignDefaultDrv.run(drvAndiProfId, veh2Id);
    assignDefaultDrv.run(drvCitraProfId, veh3Id);
    assignDefaultDrv.run(drvDeniProfId, veh4Id);
    assignDefaultDrv.run(drvBudiProfId, veh5Id);
    assignDefaultDrv.run(drvAndiProfId, veh6Id);
    assignDefaultDrv.run(drvCitraProfId, veh7Id);
    assignDefaultDrv.run(drvDeniProfId, veh8Id);

    const now = new Date();
    const fmt = (d: Date) => d.toISOString();
    const daysAgo = (days: number, hoursOffset = 0) => {
      if (days === 0) {
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Math.max(0, 10 + hoursOffset), 0, 0));
      }
      return new Date(now.getTime() - days * 86400000 + hoursOffset * 3600000);
    };

    const insertCompletedTrip = db.prepare(`
      INSERT INTO trip_requests (requester_id, department_id, vehicle_id, preferred_driver_id, purpose, origin, destination, start_time, end_time, passenger_count, notes, status, start_odometer, end_odometer, distance_km, actual_start_time, actual_end_time, parking_return_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertBooking = db.prepare(`
      INSERT INTO bookings (trip_request_id, vehicle_id, booked_by, purpose, start_time, end_time, buffer_minutes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 15, 'COMPLETED', ?)
    `);
    const insertAssignment = db.prepare(`
      INSERT INTO assignments (trip_request_id, booking_id, vehicle_id, driver_profile_id, assigned_by, reason, effective_start, effective_end, is_current, acknowledged_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'Approved dispatch', ?, ?, 1, ?, ?)
    `);
    const insertDecision = db.prepare(`
      INSERT INTO approval_decisions (trip_request_id, decider_id, decider_role, decision, reason, created_at)
      VALUES (?, ?, 'ADM', 'APPROVED', 'Approved and dispatched', ?)
    `);

    const sampleTrips = [
      { reqUser: empAlexId, dept: uehsDeptId, veh: veh1Id, drv: drvBudiProfId, purpose: 'Client Infrastructure Audit', origin: 'HQ Tower', dest: 'Data Center Cibitung', start: daysAgo(0, -5), end: daysAgo(0, -2), pax: 3, sOdo: 34115, eOdo: 34200 },
      { reqUser: empSaraId, dept: smdpDeptId, veh: veh6Id, drv: drvAndiProfId, purpose: 'Enterprise Sales Pitch', origin: 'HQ Tower', dest: 'SCBD District 8', start: daysAgo(0, -4), end: daysAgo(0, -2), pax: 2, sOdo: 15582, eOdo: 15620 },
      { reqUser: deptAdminId, dept: msupDeptId, veh: veh2Id, drv: drvCitraProfId, purpose: 'Regional Warehouse Inspection', origin: 'HQ Tower', dest: 'Tangerang Logistics Hub', start: daysAgo(2, -6), end: daysAgo(2, -2), pax: 5, sOdo: 28390, eOdo: 28510 },
      { reqUser: empAlexId, dept: uehsDeptId, veh: veh7Id, drv: drvDeniProfId, purpose: 'Vendor Hardware Acceptance', origin: 'HQ Tower', dest: 'Kemayoran Tech Park', start: daysAgo(3, -5), end: daysAgo(3, -3), pax: 2, sOdo: 11345, eOdo: 11400 },
      { reqUser: empSaraId, dept: smdpDeptId, veh: veh3Id, drv: drvBudiProfId, purpose: 'Key Account Executive Visit', origin: 'HQ Tower', dest: 'BSD Green Office Park', start: daysAgo(12, -6), end: daysAgo(12, -2), pax: 4, sOdo: 41795, eOdo: 41890 },
      { reqUser: deptAdminId, dept: msupDeptId, veh: veh8Id, drv: drvAndiProfId, purpose: 'Airport VIP Transfer', origin: 'HQ Tower', dest: 'Soekarno-Hatta Terminal 3', start: daysAgo(15, -5), end: daysAgo(15, -2), pax: 3, sOdo: 22710, eOdo: 22780 },
    ];

    const tripIds: number[] = [];
    const asnIds: number[] = [];

    for (const t of sampleTrips) {
      const dist = t.eOdo - t.sOdo;
      const res = insertCompletedTrip.run(
        t.reqUser, t.dept, t.veh, t.drv, t.purpose, t.origin, t.dest,
        fmt(t.start), fmt(t.end), t.pax, 'Completed without issue',
        t.sOdo, t.eOdo, dist, fmt(t.start), fmt(t.end), 'Basement B1', fmt(t.start)
      );
      const reqId = Number(res.lastInsertRowid);
      tripIds.push(reqId);
      insertDecision.run(reqId, adminId, fmt(t.start));
      const bRes = insertBooking.run(reqId, t.veh, t.reqUser, t.purpose, fmt(t.start), fmt(t.end), fmt(t.start));
      const aRes = insertAssignment.run(reqId, Number(bRes.lastInsertRowid), t.veh, t.drv, adminId, fmt(t.start), fmt(t.end), fmt(t.start), fmt(t.start));
      asnIds.push(Number(aRes.lastInsertRowid));
    }

    db.prepare(`
      INSERT INTO fuel_records (vehicle_id, trip_request_id, recorded_by, date_time, litres, cost, odometer_km, station)
      VALUES
        (?, ?, ?, ?, 42.5, 58.20, 34200, 'Shell MT Haryono'),
        (?, ?, ?, ?, 48.0, 64.80, 28510, 'Pertamina Kuningan'),
        (?, ?, ?, ?, 39.0, 53.40, 41890, 'Shell BSD')
    `).run(
      veh1Id, tripIds[0], drvBudiUserId, fmt(daysAgo(0, -2)),
      veh2Id, tripIds[2], drvCitraUserId, fmt(daysAgo(2, -2)),
      veh3Id, tripIds[4], drvBudiUserId, fmt(daysAgo(12, -2))
    );

    db.prepare(`
      INSERT INTO ev_charging_records (vehicle_id, trip_request_id, recorded_by, date_time, kwh_added, cost, battery_start_pct, battery_end_pct, odometer_km, station)
      VALUES
        (?, ?, ?, ?, 38.4, 14.50, 34, 88, 15620, 'SPKLU Ultra Fast SCBD'),
        (?, ?, ?, ?, 31.0, 11.80, 41, 92, 11400, 'HQ Basement EV Charger 02'),
        (?, ?, ?, ?, 44.2, 16.90, 22, 79, 22780, 'SPKLU Airport T3')
    `).run(
      veh6Id, tripIds[1], drvAndiUserId, fmt(daysAgo(0, -1)),
      veh7Id, tripIds[3], drvDeniUserId, fmt(daysAgo(3, -2)),
      veh8Id, tripIds[5], drvAndiUserId, fmt(daysAgo(15, -1))
    );

    const insertGps = db.prepare(`
      INSERT INTO location_reports (driver_profile_id, driver_user_id, vehicle_id, assignment_id, latitude, longitude, accuracy_meters, capture_time, server_receipt_time, permission_state, phone_state)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'GRANTED', 'FOREGROUND')
    `);
    const recentTime = new Date(now.getTime() - 6 * 60000).toISOString();
    const staleTime = new Date(now.getTime() - 48 * 60000).toISOString();
    insertGps.run(drvBudiProfId, drvBudiUserId, veh1Id, asnIds[0], -6.2249, 106.8096, 11.4, recentTime, recentTime);
    insertGps.run(drvAndiProfId, drvAndiUserId, veh6Id, asnIds[1], -6.2275, 106.8085, 8.2, recentTime, recentTime);
    insertGps.run(drvCitraProfId, drvCitraUserId, veh2Id, asnIds[2], -6.1783, 106.6319, 18.0, staleTime, staleTime);

    db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('initial_demo_seeded', '1', datetime('now'))").run();
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('demo_seed_suppressed', '0', datetime('now'))").run();
  });
}
