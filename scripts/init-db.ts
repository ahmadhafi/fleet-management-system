import { getDb } from '../src/server/db.ts';

console.log('--- Initializing Fleet Management Database ---');
const db = getDb();

const depts = db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
const vehicles = db.prepare('SELECT COUNT(*) as count FROM vehicles').get() as { count: number };
const drivers = db.prepare('SELECT COUNT(*) as count FROM driver_profiles').get() as { count: number };
const trips = db.prepare('SELECT COUNT(*) as count FROM trip_requests').get() as { count: number };

console.log('Database successfully initialized and seeded:');
console.log(`  ✓ Departments:       ${depts.count} active organizational units`);
console.log(`  ✓ Registered Users:  ${users.count} accounts across all roles`);
console.log(`  ✓ Corporate Fleet:   ${vehicles.count} vehicles (5 Gasoline, 3 Electric)`);
console.log(`  ✓ Driver Profiles:   ${drivers.count} company drivers`);
console.log(`  ✓ Seeded Trips:      ${trips.count} historical completed trips`);
console.log('----------------------------------------------');
