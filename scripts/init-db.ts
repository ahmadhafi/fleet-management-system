import fs from 'node:fs';
import path from 'node:path';
import { getDb, resolveAppRoot } from '../src/server/db.ts';
import { ensureSqlEngineLoaded } from '../src/server/sqlite-compat.ts';

async function main() {
  console.log('--- Initializing Clean Production Fleet Management Database ---');
  await ensureSqlEngineLoaded();

  const dataDir = path.join(resolveAppRoot(), 'data');
  if (fs.existsSync(dataDir)) {
    for (const file of fs.readdirSync(dataDir)) {
      if (file.startsWith('fleet-management')) {
        fs.rmSync(path.join(dataDir, file), { force: true });
      }
    }
  }

  const db = getDb();

  const groups = db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const vehicles = db.prepare('SELECT COUNT(*) as count FROM vehicles').get() as { count: number };
  const drivers = db.prepare('SELECT COUNT(*) as count FROM driver_profiles').get() as { count: number };
  const trips = db.prepare('SELECT COUNT(*) as count FROM trip_requests').get() as { count: number };

  console.log('Database initialized cleanly with zero dummy data:');
  console.log(`  ✓ Groups:            ${groups.count} official organizational groups`);
  console.log(`  ✓ Initial Admin:     ${users.count} administrator account`);
  console.log(`  ✓ Vehicles:          ${vehicles.count} (ready for real fleet registration)`);
  console.log(`  ✓ Drivers:           ${drivers.count} (ready for real driver registration)`);
  console.log(`  ✓ Trips:             ${trips.count}`);
  console.log('---------------------------------------------------------------');
}

main().catch((err) => {
  console.error('Database init script failed:', err);
  process.exit(1);
});
