import { getDb, seedDemoFixtures } from '../src/server/db.ts';

console.log('--- Seeding Demo Presentation Fleet Management Database ---');
const db = getDb();
seedDemoFixtures(db);

const groups = db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
const vehicles = db.prepare('SELECT COUNT(*) as count FROM vehicles').get() as { count: number };
const drivers = db.prepare('SELECT COUNT(*) as count FROM driver_profiles').get() as { count: number };
const trips = db.prepare('SELECT COUNT(*) as count FROM trip_requests').get() as { count: number };

console.log('Database successfully populated with presentation fixtures:');
console.log(`  ✓ Groups:            ${groups.count} official organizational groups`);
console.log(`  ✓ Users:             ${users.count} accounts (Admin, Fleet Manager, HWS Head, Drivers, Employees)`);
console.log(`  ✓ Vehicles:          ${vehicles.count} fleet vehicles (5 Gasoline, 3 Electric EV)`);
console.log(`  ✓ Drivers:           ${drivers.count} licensed drivers with custom avatars`);
console.log(`  ✓ Trips:             ${trips.count} completed trips with telemetry and approval history`);
console.log('-----------------------------------------------------------');
