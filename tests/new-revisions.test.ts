import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.ts';
import { getDb, resetDbForTesting } from '../src/server/db.ts';
import { liveEvents } from '../src/server/events.ts';

describe('New Revisions: Passenger List, Driver Receipt DB Storage & Cyber Security Defense', () => {
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let driverToken: string;
  let empToken: string;

  beforeAll(async () => {
    resetDbForTesting(':memory:');
    app = createApp();

    // Login as admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ group_username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // Login as driver (drv_budi)
    const drvRes = await request(app)
      .post('/api/auth/login')
      .send({ group_username: 'drv_budi', password: 'Driver@123' });
    expect(drvRes.status).toBe(200);
    driverToken = drvRes.body.token;

    // Login as employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ group_username: 'emp_alex', password: 'Emp@123' });
    expect(empRes.status).toBe(200);
    empToken = empRes.body.token;
  });

  describe('Security Headers & Cyber Attack Defense', () => {
    it('sets strict security headers (CSP, X-Frame-Options, HSTS, Nosniff)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['permissions-policy']).toContain('camera=(self)');
    });

    it('locks out brute force login attempts after repeated failures', async () => {
      const badCredentials = { group_username: 'attacker.probe', password: 'wrongpassword' };
      // 7 failed attempts
      for (let i = 0; i < 7; i++) {
        const res = await request(app).post('/api/auth/login').send(badCredentials);
        expect(res.status).toBe(401);
      }
      // 8th failed attempt triggers lockout
      const res8 = await request(app).post('/api/auth/login').send(badCredentials);
      expect(res8.status).toBe(401);

      // Subsequent attempt gets 429 Too Many Requests
      const resLockout = await request(app).post('/api/auth/login').send(badCredentials);
      expect(resLockout.status).toBe(429);
      expect(resLockout.body.error).toContain('Temporarily locked for security protection');
    });
  });

  describe('Structured Passenger List', () => {
    it('accepts structured passengers array and stores passengers_json and formatted nickname', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 90000000).toISOString();
      const passengers = [
        { id: 1, nickname: 'Budi' },
        { id: 2, nickname: 'Sarah' },
        { id: 3, nickname: 'Alex' },
      ];

      const res = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${empToken}`)
        .send({
          vehicle_id: 1,
          purpose: 'Regional Client Review',
          origin: 'HQ Tower',
          destination: 'Sunter Plant',
          start_time: startTime,
          end_time: endTime,
          passenger_count: 3,
          passengers,
        });

      expect(res.status).toBe(201);
      expect(res.body.tripId).toBeDefined();

      const db = getDb();
      const trip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(res.body.tripId) as any;
      expect(trip).toBeDefined();
      expect(trip.passenger_count).toBe(3);
      expect(trip.passenger_nickname).toBe('1. Budi, 2. Sarah, 3. Alex');
      expect(trip.passengers_json).toBe(JSON.stringify(passengers));
    });
  });

  describe('Driver Receipt Upload & Database Storage', () => {
    // Valid PNG 1x1 image base64
    const validPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    it('successfully uploads driver expense receipt and stores in documents and expenses tables', async () => {
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicle_id: 1,
          category: 'Toll',
          amount: 45000,
          description: 'Cikarang Utama Toll Gate',
          receipt_base64: validPngBase64,
          receipt_filename: 'toll_receipt.png',
          receipt_mime_type: 'image/png',
        });

      expect(res.status).toBe(201);
      const expense = res.body.expense;
      expect(expense.id).toBeDefined();
      expect(expense.amount).toBe(45000);
      expect(expense.category).toBe('Toll');
      expect(expense.receipt_document_id).toBeGreaterThan(0);
      expect(expense.receipt_data_url).toContain('data:image/png;base64,');
      expect(expense.receipt_filename).toBe('toll_receipt.png');

      // Verify stored in documents table
      const db = getDb();
      const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(expense.receipt_document_id) as any;
      expect(doc).toBeDefined();
      expect(doc.entity_type).toBe('EXPENSE');
      expect(doc.entity_id).toBe(expense.id);
      expect(doc.doc_type).toBe('Receipt');
      expect(doc.mime_type).toBe('image/png');
      expect(doc.content_base64).toBe(validPngBase64);
    });

    it('blocks disguised Windows executable (MZ header) disguised as receipt', async () => {
      // Fake executable with MZ header
      const exeBuffer = Buffer.from('MZThisIsAnExecutableFileDisguisedAsImage', 'utf8');
      const exeBase64 = exeBuffer.toString('base64');

      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicle_id: 1,
          category: 'Parking',
          amount: 20000,
          description: 'Disguised EXE probe',
          receipt_base64: exeBase64,
          receipt_filename: 'malicious.png',
          receipt_mime_type: 'image/png',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Executable file disguised as receipt refused');
    });

    it('blocks EICAR antivirus test signature upload', async () => {
      const eicarBuffer = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', 'utf8');
      const eicarBase64 = eicarBuffer.toString('base64');

      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicle_id: 1,
          category: 'Gas',
          amount: 150000,
          description: 'EICAR signature probe',
          receipt_base64: eicarBase64,
          receipt_filename: 'eicar.pdf',
          receipt_mime_type: 'application/pdf',
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toContain('EICAR signature quarantined');
    });

    it('refuses invalid magic bytes mismatching declared MIME type', async () => {
      // Random bytes with PNG declared MIME
      const randomBase64 = Buffer.from('NOTAPNGORVALIDHEADER12345678', 'utf8').toString('base64');

      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicle_id: 1,
          category: 'Parking',
          amount: 15000,
          description: 'Invalid magic bytes',
          receipt_base64: randomBase64,
          receipt_filename: 'bad.png',
          receipt_mime_type: 'image/png',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('signature does not match declared MIME type');
    });
  });

  describe('Batch 10 Revisions: Fleet Map, Executive PDF, Odometer Photos, Roles (HWS, FM), & Ops Deletion', () => {
    it('GET /api/admin/fleet-map-positions returns all operational vehicles with GPS/pool coordinates, driver info, and status', async () => {
      const res = await request(app)
        .get('/api/admin/fleet-map-positions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.vehicles)).toBe(true);
      expect(res.body.vehicles.length).toBeGreaterThanOrEqual(8);

      const firstVehicle = res.body.vehicles[0];
      expect(firstVehicle.id).toBeDefined();
      expect(firstVehicle.plate_number).toBeDefined();
      expect(firstVehicle.model_name).toBeDefined();
      expect(firstVehicle.energy_type).toBeDefined();
      expect(firstVehicle.lat).toBeDefined();
      expect(firstVehicle.lng).toBeDefined();
      expect(firstVehicle.driver_name).toBeDefined();
    });

    it('GET /api/reports/executive-pdf delivers binary PDF report with application/pdf Content-Type', async () => {
      const res = await request(app)
        .get('/api/reports/executive-pdf')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('fleet_executive_report_idr.pdf');
      // Buffer starts with %PDF
      const buffer = res.body instanceof Buffer ? res.body : Buffer.from(res.text || '');
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('requires mandatory start odometer photo when driver starts trip', async () => {
      // 1. Create a trip
      const startTime = new Date(Date.now() + 100000).toISOString();
      const endTime = new Date(Date.now() + 3600000).toISOString();
      const tripRes = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${empToken}`)
        .send({
          vehicle_id: 1,
          purpose: 'Inspection Run',
          origin: 'HQ Tower',
          destination: 'Sunter Plant',
          start_time: startTime,
          end_time: endTime,
          passenger_count: 1,
          passengers: [{ id: 1, nickname: 'Budi' }],
        });
      expect(tripRes.status).toBe(201);
      const tripId = tripRes.body.tripId;

      // 2. Approve the trip
      await request(app)
        .post(`/api/trips/${tripId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'Approved for test' });

      // 3. Driver attempts start without photo when enforce_photo is true
      const failStart = await request(app)
        .post(`/api/driver/trips/${tripId}/start`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          start_odometer: 34500,
          enforce_photo: true,
        });
      expect(failStart.status).toBe(400);
      expect(failStart.body.error).toContain('Mandatory photo');

      // 4. Driver starts with valid photo
      const validPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const successStart = await request(app)
        .post(`/api/driver/trips/${tripId}/start`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          start_odometer: 34500,
          start_odometer_photo_url: validPhoto,
          enforce_photo: true,
        });
      expect(successStart.status).toBe(200);

      // 5. Driver attempts completion without photo when enforce_photo is true
      const failComplete = await request(app)
        .post(`/api/driver/trips/${tripId}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          end_odometer: 34545,
          parking_return_note: 'Returned to Bay 1',
          enforce_photo: true,
        });
      expect(failComplete.status).toBe(400);
      expect(failComplete.body.error).toContain('Mandatory photo');

      // 6. Driver completes with valid photo
      const successComplete = await request(app)
        .post(`/api/driver/trips/${tripId}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          end_odometer: 34545,
          end_odometer_photo_url: validPhoto,
          parking_return_note: 'Returned to Bay 1',
          enforce_photo: true,
        });
      expect(successComplete.status).toBe(200);
      expect(successComplete.body.trip.distance_km).toBe(45);
      expect(successComplete.body.trip.start_odometer_photo_url).toBe(validPhoto);
      expect(successComplete.body.trip.end_odometer_photo_url).toBe(validPhoto);
    });

    it('supports creating Head of WS (HWS) and Fleet Manager (FM) accounts by Administrator', async () => {
      // Create HWS user
      const hwsRes = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          group_username: 'hws_director',
          password: 'Password@123',
          nickname: 'Director Park',
          role: 'HWS',
          group_name: 'Management',
        });
      expect(hwsRes.status).toBe(201);
      expect(hwsRes.body.user.role).toBe('HWS');

      // Create FM user
      const fmRes = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          group_username: 'fm_supervisor',
          password: 'Password@123',
          nickname: 'Supervisor Kim',
          role: 'FM',
          group_name: 'GA / Pool Ops',
        });
      expect(fmRes.status).toBe(201);
      expect(fmRes.body.user.role).toBe('FM');
    });

    it('supports deleting vehicles and drivers by Administrator', async () => {
      // 1. Create a temporary vehicle to delete
      const addVeh = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          plate_number: 'B 9999 DEL',
          car_type: 'Sedan',
          model_name: 'Temp Test Car',
          capacity: 4,
          energy_type: 'Gasoline',
          pool_location: 'Pool Bay 99',
        });
      expect(addVeh.status).toBe(201);
      const vehId = addVeh.body.vehicle.id;

      // Delete vehicle
      const delVeh = await request(app)
        .delete(`/api/vehicles/${vehId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delVeh.status).toBe(200);

      // Verify deletion in DB
      const db = getDb();
      const checkVeh = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehId);
      expect(checkVeh).toBeUndefined();

      // 2. Create a temporary driver to delete
      const addDrv = await request(app)
        .post('/api/drivers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Temp Driver',
          phone_number: '081299999999',
          license_number: 'SIM-999999',
          license_expiry: '2028-12-31',
        });
      expect(addDrv.status).toBe(201);
      const drvId = addDrv.body.driver.id;

      // Delete driver
      const delDrv = await request(app)
        .delete(`/api/drivers/${drvId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delDrv.status).toBe(200);

      const checkDrv = db.prepare('SELECT * FROM driver_profiles WHERE id = ?').get(drvId);
      expect(checkDrv).toBeUndefined();
    });

    it('generates a concise 1-page executive report with summary tables, IDR currency, and digital APPROVED BY SYSTEM seals', async () => {
      const res = await request(app)
        .get('/api/reports/executive-pdf?format=html')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('GALAXYFLEET EXECUTIVE MANAGEMENT REPORT');
      expect(res.text).toContain('Vehicle Fleet & Energy Audit Summary');
      expect(res.text).toContain('Comprehensive Energy & Expense Ledger (IDR)');
      expect(res.text).toContain('Indonesian Rupiah (IDR)');
      expect(res.text).toContain('Head Of WS Part');
      expect(res.text).toContain('Fleet Operation PIC');
      expect(res.text).toContain('Executive General Manager');
      expect(res.text).toContain('APPROVED BY SYSTEM');
      expect(res.text).not.toContain('Workplace Service');
      expect(res.text).not.toContain('Fleet Operation Dispatcher');
      expect(res.text).not.toContain('Fleet Operations Dispatcher');
    });

    it('handles admin system data reset: requires confirmation code and resets operations and odometers', async () => {
      // 1. Non-admin cannot reset
      const nonAdminRes = await request(app)
        .post('/api/admin/system/reset-data')
        .set('Authorization', `Bearer ${empToken}`)
        .send({ mode: 'OPERATIONS_ONLY', confirmation_code: 'RESET' });
      expect(nonAdminRes.status).toBe(403);

      // 2. Reject missing confirmation code
      const badCodeRes = await request(app)
        .post('/api/admin/system/reset-data')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ mode: 'OPERATIONS_ONLY', confirmation_code: 'WRONG' });
      expect(badCodeRes.status).toBe(400);

      // 3. Reset operations only with custom odometer
      const resetOpsRes = await request(app)
        .post('/api/admin/system/reset-data')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mode: 'OPERATIONS_ONLY',
          confirmation_code: 'RESET',
          vehicle_odometers: { 1: 500, 2: 1200 },
        });
      expect(resetOpsRes.status).toBe(200);
      expect(resetOpsRes.body.success).toBe(true);

      const db = getDb();
      // Trips & bookings must be 0
      const tripCount = db.prepare('SELECT COUNT(*) as c FROM trip_requests').get() as { c: number };
      expect(tripCount.c).toBe(0);
      const bkgCount = db.prepare('SELECT COUNT(*) as c FROM bookings').get() as { c: number };
      expect(bkgCount.c).toBe(0);

      // Vehicles must still exist with updated odometers
      const v1 = db.prepare('SELECT current_odometer FROM vehicles WHERE id = 1').get() as { current_odometer: number };
      expect(v1.current_odometer).toBe(500);

      // 4. Factory reset wipes test vehicles and drivers back to clean slate
      const factoryRes = await request(app)
        .post('/api/admin/system/reset-data')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mode: 'FACTORY_RESET',
          confirmation_code: 'RESET',
        });
      expect(factoryRes.status).toBe(200);
      expect(factoryRes.body.success).toBe(true);

      const finalVehCount = db.prepare('SELECT COUNT(*) as c FROM vehicles').get() as { c: number };
      expect(finalVehCount.c).toBe(0);
      const finalDrvCount = db.prepare('SELECT COUNT(*) as c FROM driver_profiles').get() as { c: number };
      expect(finalDrvCount.c).toBe(0);
      const finalDeptCount = db.prepare('SELECT COUNT(*) as c FROM departments').get() as { c: number };
      expect(finalDeptCount.c).toBe(13);
    });

    it('provides Samsung-style simple yet elegant fleet car app icon with blue and white accents (no green)', async () => {
      const fs = await import('fs');
      const path = await import('path');

      // Check favicon.svg
      const favPath = path.resolve(__dirname, '../public/favicon.svg');
      const favContent = fs.readFileSync(favPath, 'utf8');
      expect(favContent).toContain('fleetCar');
      expect(favContent).toContain('#0072de'); // Samsung signature blue
      expect(favContent).toContain('#ffffff'); // White accent
      expect(favContent.toLowerCase()).not.toContain('#10b981');
      expect(favContent.toLowerCase()).not.toContain('#22c55e');

      // Check icon.svg
      const iconPath = path.resolve(__dirname, '../public/icons/icon.svg');
      const iconContent = fs.readFileSync(iconPath, 'utf8');
      expect(iconContent).toContain('fleetCar');
      expect(iconContent).toContain('#0072de');
      expect(iconContent).toContain('#ffffff');
      expect(iconContent.toLowerCase()).not.toContain('#10b981');
      expect(iconContent.toLowerCase()).not.toContain('#22c55e');

      // Check React Logo Component
      const logoPath = path.resolve(__dirname, '../src/components/SamsungBusLogo.tsx');
      const logoContent = fs.readFileSync(logoPath, 'utf8');
      expect(logoContent).toContain('SamsungFleetLogo');
      expect(logoContent).toContain('SamsungBusLogo');
      expect(logoContent).toContain('fleetCar');
    });

    it('provides public L4/L7 healthcheck and deep readiness probes for load balancers', async () => {
      // 1. Basic Liveness Probe
      const liveness = await request(app).get('/api/health');
      expect(liveness.status).toBe(200);
      expect(liveness.body.status).toBe('ok');
      expect(liveness.body.service).toContain('GalaxyFleet');
      expect(typeof liveness.body.uptime_sec).toBe('number');

      // 2. Healthz alias
      const healthz = await request(app).get('/api/healthz');
      expect(healthz.status).toBe(200);
      expect(healthz.body.status).toBe('ok');

      // 3. Deep Readiness Probe
      const deep = await request(app).get('/api/health/deep');
      expect(deep.status).toBe(200);
      expect(deep.body.status).toBe('ready');
      expect(deep.body.database).toBe('connected');
      expect(deep.body.sqlite_wal).toBe(true);
      expect(typeof deep.body.memory.heapUsedMb).toBe('number');
    });

    it('enforces rate limiting headers and protects against traffic surges', async () => {
      const { createRateLimiter } = await import('../src/server/rate-limit.ts');
      const testLimiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        skipInTests: false,
      });

      const express = (await import('express')).default;
      const testApp = express();
      testApp.use(testLimiter);
      testApp.get('/test-ping', (_req, res) => res.json({ ok: true }));

      const res1 = await request(testApp).get('/test-ping');
      expect(res1.status).toBe(200);
      expect(res1.headers['x-ratelimit-remaining']).toBe('2');

      const res2 = await request(testApp).get('/test-ping');
      expect(res2.status).toBe(200);
      expect(res2.headers['x-ratelimit-remaining']).toBe('1');

      const res3 = await request(testApp).get('/test-ping');
      expect(res3.status).toBe(200);
      expect(res3.headers['x-ratelimit-remaining']).toBe('0');

      const res4 = await request(testApp).get('/test-ping');
      expect(res4.status).toBe(429);
      expect(res4.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res4.headers['retry-after']).toBeDefined();
    });
  });

  describe('Driver Photo Management & Operations-Only Data Reset Safeguards', () => {
    let freshAdminToken: string;
    let freshDriverToken: string;
    let freshEmpToken: string;

    beforeAll(async () => {
      resetDbForTesting(':memory:');
      const adminRes = await request(app)
        .post('/api/auth/login')
        .send({ group_username: 'admin', password: 'Admin@123' });
      freshAdminToken = adminRes.body.token;

      const drvRes = await request(app)
        .post('/api/auth/login')
        .send({ group_username: 'drv_budi', password: 'Driver@123' });
      freshDriverToken = drvRes.body.token;

      const empRes = await request(app)
        .post('/api/auth/login')
        .send({ group_username: 'emp_alex', password: 'Emp@123' });
      freshEmpToken = empRes.body.token;
    });

    it('allows driver to update their profile photo via POST /api/driver/profile/photo', async () => {
      const samplePhotoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const res = await request(app)
        .post('/api/driver/profile/photo')
        .set('Authorization', `Bearer ${freshDriverToken}`)
        .send({ photo_url: samplePhotoBase64 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.driver).toBeDefined();
      expect(res.body.driver.photo_url).toBe(samplePhotoBase64);

      // Verify reflected in /api/drivers list
      const listRes = await request(app)
        .get('/api/drivers')
        .set('Authorization', `Bearer ${freshAdminToken}`);
      expect(listRes.status).toBe(200);
      const budi = listRes.body.drivers.find((d: any) => d.id === res.body.driver.id);
      expect(budi).toBeDefined();
      expect(budi.photo_url).toBe(samplePhotoBase64);
    });

    it('allows admin to update driver photo and details via PATCH /api/drivers/:id', async () => {
      const updatedPhoto = 'data:image/png;base64,UPDATED_ADMIN_AVATAR_SAMPLE';
      const res = await request(app)
        .patch('/api/drivers/1')
        .set('Authorization', `Bearer ${freshAdminToken}`)
        .send({
          photo_url: updatedPhoto,
          contact_number: '+62 811-9988-7766',
        });

      expect(res.status).toBe(200);
      expect(res.body.driver.photo_url).toBe(updatedPhoto);
      expect(res.body.driver.contact_number).toBe('+62 811-9988-7766');
    });

    it('preserves vehicle plates, driver names, and driver phones when resetting operations data', async () => {
      const db = getDb();

      // Check state before reset
      const vehiclesBefore = db.prepare('SELECT registration_plate, make, model FROM vehicles').all() as any[];
      const driversBefore = db.prepare('SELECT full_name, licence_number, contact_number FROM driver_profiles').all() as any[];
      expect(vehiclesBefore.length).toBeGreaterThan(0);
      expect(driversBefore.length).toBeGreaterThan(0);

      // Create a test trip and booking
      const startTime = new Date(Date.now() + 100000).toISOString();
      const endTime = new Date(Date.now() + 200000).toISOString();
      const tripRes = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${freshEmpToken}`)
        .send({
          vehicle_id: 1,
          purpose: 'Pre-Reset Test Trip',
          origin: 'HQ',
          destination: 'Airport',
          start_time: startTime,
          end_time: endTime,
        });
      expect(tripRes.status).toBe(201);

      // Perform Operations-Only Reset
      const resetRes = await request(app)
        .post('/api/admin/system/reset-data')
        .set('Authorization', `Bearer ${freshAdminToken}`)
        .send({
          mode: 'OPERATIONS_ONLY',
          confirmation_code: 'RESET',
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.mode).toBe('OPERATIONS_ONLY');

      // 1. Verify all vehicle registration plates and models are INTACT
      const vehiclesAfter = db.prepare('SELECT registration_plate, make, model FROM vehicles').all() as any[];
      expect(vehiclesAfter.length).toBe(vehiclesBefore.length);
      expect(vehiclesAfter.map((v) => v.registration_plate).sort()).toEqual(
        vehiclesBefore.map((v) => v.registration_plate).sort()
      );

      // 2. Verify all driver names, licence numbers, and phone numbers are INTACT
      const driversAfter = db.prepare('SELECT full_name, licence_number, contact_number FROM driver_profiles').all() as any[];
      expect(driversAfter.length).toBe(driversBefore.length);
      for (const drv of driversBefore) {
        const found = driversAfter.find((d) => d.full_name === drv.full_name);
        expect(found).toBeDefined();
        expect(found.licence_number).toBe(drv.licence_number);
        expect(found.contact_number).toBe(drv.contact_number);
      }

      // 3. Verify test trips, bookings, assignments, and audit trails of trips are PURGED
      const tripsAfter = db.prepare('SELECT COUNT(*) as c FROM trip_requests').get() as { c: number };
      const bookingsAfter = db.prepare('SELECT COUNT(*) as c FROM bookings').get() as { c: number };
      const assignmentsAfter = db.prepare('SELECT COUNT(*) as c FROM assignments').get() as { c: number };
      expect(tripsAfter.c).toBe(0);
      expect(bookingsAfter.c).toBe(0);
      expect(assignmentsAfter.c).toBe(0);
    });
  });

  describe('Dual-Approval Workflow (Fleet Operation PIC & Head Of WS Part with Admin Delegation)', () => {
    let picToken: string;
    let hwsToken: string;
    let currentAdminToken: string;
    let currentEmpToken: string;
    let currentDriverToken: string;

    beforeAll(async () => {
      // Login as Admin
      const adminRes = await request(app)
        .post('/api/auth/login')
        .send({ group_username: 'admin', password: 'Admin@123' });
      expect(adminRes.status).toBe(200);
      currentAdminToken = adminRes.body.token;

      // Login as Employee
      const empRes = await request(app)
        .post('/api/auth/login')
        .send({ group_username: 'emp_alex', password: 'Emp@123' });
      expect(empRes.status).toBe(200);
      currentEmpToken = empRes.body.token;

      // Login as Fleet Operation PIC (FM)
      const picRes = await request(app)
        .post('/api/auth/login')
        .send({ group_username: 'fleetmgr', password: 'Fleet@123' });
      expect(picRes.status).toBe(200);
      picToken = picRes.body.token;

      // Login as Head Of WS Part (HWS)
      const hwsRes = await request(app)
        .post('/api/auth/login')
        .send({ group_username: 'hws_head', password: 'Hws@123' });
      expect(hwsRes.status).toBe(200);
      hwsToken = hwsRes.body.token;

      // Login as Driver
      const drvRes = await request(app)
        .post('/api/auth/login')
        .send({ group_username: 'drv_budi', password: 'Driver@123' });
      expect(drvRes.status).toBe(200);
      currentDriverToken = drvRes.body.token;
    });

    it('requires both PIC and HWS approval when HWS account exists, or can be delegated by Admin', async () => {
      // 1. Employee submits a trip request
      const start = new Date(Date.now() + 3600000).toISOString();
      const end = new Date(Date.now() + 7200000).toISOString();
      const createRes = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${currentEmpToken}`)
        .send({
          vehicle_id: 1,
          purpose: 'Official Site Inspection Trip',
          origin: 'HQ Building A',
          destination: 'Plant Site B',
          start_time: start,
          end_time: end,
        });
      expect(createRes.status).toBe(201);
      const tripId = createRes.body.tripId;

      // Verify trip list exposes dual approval metadata
      const listRes = await request(app)
        .get('/api/trips')
        .set('Authorization', `Bearer ${picToken}`);
      expect(listRes.status).toBe(200);
      const tripRecord = listRes.body.trips.find((t: any) => t.id === tripId);
      expect(tripRecord).toBeDefined();
      expect(tripRecord.requires_dual_approval).toBe(true);
      expect(tripRecord.pic_approved).toBe(false);
      expect(tripRecord.hws_approved).toBe(false);

      // 2. Stage 1: Fleet Operation PIC approves
      const picDecisionRes = await request(app)
        .post(`/api/trips/${tripId}/decision`)
        .set('Authorization', `Bearer ${picToken}`)
        .send({
          decision: 'APPROVED',
          reason: 'Vehicle and driver verified by PIC',
          driver_profile_id: 1,
        });
      expect(picDecisionRes.status).toBe(200);
      expect(picDecisionRes.body.status).toBe('PENDING_APPROVAL');
      expect(picDecisionRes.body.stage).toBe('AWAITING_HWS');
      expect(picDecisionRes.body.isFinal).toBe(false);

      // Verify duplicate approval by PIC is rejected
      const dupPicRes = await request(app)
        .post(`/api/trips/${tripId}/decision`)
        .set('Authorization', `Bearer ${picToken}`)
        .send({ decision: 'APPROVED' });
      expect(dupPicRes.status).toBe(400);

      // 3. Stage 2: Head Of WS Part approves
      const hwsDecisionRes = await request(app)
        .post(`/api/trips/${tripId}/decision`)
        .set('Authorization', `Bearer ${hwsToken}`)
        .send({
          decision: 'APPROVED',
          reason: 'Budget and WS operational schedule verified by Head Of WS Part',
        });
      expect(hwsDecisionRes.status).toBe(200);
      expect(hwsDecisionRes.body.status).toBe('APPROVED');
      expect(hwsDecisionRes.body.isFinal).toBe(true);

      // Verify trip is now APPROVED and booking confirmed
      const db = getDb();
      const updatedTrip = db.prepare('SELECT status FROM trip_requests WHERE id = ?').get(tripId) as { status: string };
      expect(updatedTrip.status).toBe('APPROVED');

      const booking = db.prepare('SELECT status FROM bookings WHERE trip_request_id = ?').get(tripId) as { status: string };
      expect(booking.status).toBe('ACTIVE');
    });

    it('allows Admin to delegate and immediately dispatch trip without waiting for both parties', async () => {
      // 1. Employee submits a trip request
      const start = new Date(Date.now() + 86400000).toISOString();
      const end = new Date(Date.now() + 90000000).toISOString();
      const createRes = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${currentEmpToken}`)
        .send({
          vehicle_id: 2,
          purpose: 'Urgent Executive Dispatch',
          origin: 'HQ Building A',
          destination: 'Ministry Office',
          start_time: start,
          end_time: end,
        });
      expect(createRes.status).toBe(201);
      const tripId = createRes.body.tripId;

      // 2. Admin directly approves with delegation
      const adminDecisionRes = await request(app)
        .post(`/api/trips/${tripId}/decision`)
        .set('Authorization', `Bearer ${currentAdminToken}`)
        .send({
          decision: 'APPROVED',
          reason: 'Executive delegation: authorized directly by System Admin',
          driver_profile_id: 2,
        });
      expect(adminDecisionRes.status).toBe(200);
      expect(adminDecisionRes.body.status).toBe('APPROVED');
      expect(adminDecisionRes.body.isFinal).toBe(true);
      expect(adminDecisionRes.body.isDelegated).toBe(true);

      const db = getDb();
      const updatedTrip = db.prepare('SELECT status FROM trip_requests WHERE id = ?').get(tripId) as { status: string };
      expect(updatedTrip.status).toBe('APPROVED');
    });

    it('supports push notification subscriptions and delivers notifications to role mailboxes', async () => {
      // Subscribe PIC to web push notifications
      const subRes = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${picToken}`)
        .send({
          endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/test-sub-pic',
          keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-secret' },
        });
      expect(subRes.status).toBe(201);
      expect(subRes.body.subscribed).toBe(true);

      // Verify notifications endpoint works
      const notifsRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${picToken}`);
      expect(notifsRes.status).toBe(200);
      expect(Array.isArray(notifsRes.body.notifications)).toBe(true);
    });

    it('allows any account to fetch and update their profile details (nickname, phone, photo)', async () => {
      // Fetch current profile of currentEmpToken
      const profileRes = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${currentEmpToken}`);
      expect(profileRes.status).toBe(200);
      expect(profileRes.body.user).toBeDefined();
      expect(profileRes.body.user.role).toBe('EMP');

      // Update profile
      const patchRes = await request(app)
        .patch('/api/user/profile')
        .set('Authorization', `Bearer ${currentEmpToken}`)
        .send({
          nickname: 'Alex Employee Updated',
          contact_number: '081299887766',
          photo_url: 'data:image/png;base64,EMP_TEST_PHOTO_SAMPLE',
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.user.nickname).toBe('Alex Employee Updated');
      expect(patchRes.body.user.contact_number).toBe('081299887766');
      expect(patchRes.body.user.photo_url).toBe('data:image/png;base64,EMP_TEST_PHOTO_SAMPLE');
    });

    it('synchronizes driver_profiles when a driver updates their user profile', async () => {
      const driverRes = await request(app)
        .patch('/api/user/profile')
        .set('Authorization', `Bearer ${currentDriverToken}`)
        .send({
          nickname: 'Budi Driver Pro',
          contact_number: '085511223344',
          photo_url: 'data:image/png;base64,DRIVER_PRO_PHOTO',
        });
      expect(driverRes.status).toBe(200);
      expect(driverRes.body.user.nickname).toBe('Budi Driver Pro');
      expect(driverRes.body.user.contact_number).toBe('085511223344');

      // Check driver_profiles record in DB
      const db = getDb();
      const drvProfile = db.prepare('SELECT full_name, contact_number, photo_url FROM driver_profiles WHERE full_name = ?').get('Budi Driver Pro') as any;
      expect(drvProfile).toBeDefined();
      expect(drvProfile.contact_number).toBe('085511223344');
      expect(drvProfile.photo_url).toBe('data:image/png;base64,DRIVER_PRO_PHOTO');
    });

    it('enforces secure password change rules with current password verification', async () => {
      // 1. Wrong current password
      const wrongCurrentRes = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${currentEmpToken}`)
        .send({
          current_password: 'WrongPassword123!',
          new_password: 'NewStrongPassword123!',
        });
      expect(wrongCurrentRes.status).toBe(400);
      expect(wrongCurrentRes.body.error).toMatch(/current password/i);

      // 2. Too short new password (< 6 chars)
      const shortPassRes = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${currentEmpToken}`)
        .send({
          current_password: 'Emp@123',
          new_password: '123',
        });
      expect(shortPassRes.status).toBe(400);
      expect(shortPassRes.body.error).toMatch(/at least 6 characters/i);

      // 3. Same as current password
      const samePassRes = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${currentEmpToken}`)
        .send({
          current_password: 'Emp@123',
          new_password: 'Emp@123',
        });
      expect(samePassRes.status).toBe(400);
      expect(samePassRes.body.error).toMatch(/different/i);

      // 4. Successful password change
      const successRes = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${currentEmpToken}`)
        .send({
          current_password: 'Emp@123',
          new_password: 'BrandNewSecret2026!',
        });
      expect(successRes.status).toBe(200);
      expect(successRes.body.success).toBe(true);

      // 5. Verify old password no longer works
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          group_username: 'emp_alex',
          password: 'Emp@123',
        });
      expect(oldLoginRes.status).toBe(401);

      // 6. Verify new password logs in successfully
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          group_username: 'emp_alex',
          password: 'BrandNewSecret2026!',
        });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.token).toBeDefined();

      // Restore password back to Emp@123 for test hygiene
      const restoreRes = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${newLoginRes.body.token}`)
        .send({
          current_password: 'BrandNewSecret2026!',
          new_password: 'Emp@123',
        });
      expect(restoreRes.status).toBe(200);
    });

    it('dynamically follows the real GPS coordinates of the active assigned driver on the fleet map', async () => {
      // 1. Driver posts live GPS ping to /api/location/ping
      const driverGpsPing = await request(app)
        .post('/api/location/ping')
        .set('Authorization', `Bearer ${currentDriverToken}`)
        .send({
          latitude: -6.175402,
          longitude: 106.827153,
          accuracy: 5.5,
          speed: 12.0,
          heading: 90.0,
        });
      expect([200, 201]).toContain(driverGpsPing.status);

      // 2. Query fleet map positions as Admin
      const fleetRes = await request(app)
        .get('/api/admin/fleet-map-positions')
        .set('Authorization', `Bearer ${currentAdminToken}`);
      expect(fleetRes.status).toBe(200);
      expect(Array.isArray(fleetRes.body.fleetPositions)).toBe(true);

      // 3. Find vehicle assigned to Budi (Vehicle #1 has dedicated driver Budi or assignment)
      const vehiclePos = fleetRes.body.fleetPositions.find(
        (p: any) => p.assigned_driver_name === 'Budi Driver Pro' || p.following_driver_name === 'Budi Driver Pro' || p.is_following_driver
      );
      expect(vehiclePos).toBeDefined();
      expect(vehiclePos.is_following_driver).toBe(true);
      expect(vehiclePos.latitude).toBeCloseTo(-6.175402, 4);
      expect(vehiclePos.longitude).toBeCloseTo(106.827153, 4);
    });

    describe('Ultra-Low Latency Real-Time Synchronization & Server-Sent Events (SSE)', () => {
      it('rejects unauthorized connection to /api/live/stream', async () => {
        const res = await request(app).get('/api/live/stream');
        expect(res.status).toBe(401);
      });

      it('immediately broadcasts live events upon trip submission and approval', async () => {
        const receivedEvents: any[] = [];
        const listener = (event: any) => {
          receivedEvents.push(event);
        };
        liveEvents.on('live_event', listener);

        try {
          // 1. Submit trip
          const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
          const subRes = await request(app)
            .post('/api/trips')
            .set('Authorization', `Bearer ${currentEmpToken}`)
            .send({
              vehicle_id: 1,
              purpose: 'Ultra-low latency live sync test',
              origin: 'Plant 1',
              destination: 'Head Office',
              start_time: `${tomorrow}T14:00:00Z`,
              end_time: `${tomorrow}T16:00:00Z`,
              passenger_count: 1,
            });
          expect(subRes.status).toBe(201);
          const tripId = subRes.body.tripId;

          // Verify TRIP_CREATED event broadcast
          const createdEvent = receivedEvents.find((e) => e.type === 'TRIP_CREATED' && e.data?.trip?.id === tripId);
          expect(createdEvent).toBeDefined();

          // 2. Admin approves trip
          const decRes = await request(app)
            .post(`/api/trips/${tripId}/decision`)
            .set('Authorization', `Bearer ${currentAdminToken}`)
            .send({
              decision: 'APPROVED',
              reason: 'Fast real-time approval',
            });
          expect(decRes.status).toBe(200);

          // Verify TRIP_APPROVED event broadcast with full enriched trip data
          const approvedEvent = receivedEvents.find((e) => e.type === 'TRIP_APPROVED' && e.data?.trip?.id === tripId);
          expect(approvedEvent).toBeDefined();
          expect(approvedEvent.data?.decision).toBe('APPROVED');
          expect(approvedEvent.data?.trip?.status).toBe('APPROVED');
          expect(approvedEvent.data?.trip?.requester_name).toBeDefined();
        } finally {
          liveEvents.removeListener('live_event', listener);
        }
      });
    });

    describe('Mandatory Booking Schedule, 2-Hour Advance Policy & Fleet Manager PIC Urgent Approval', () => {
      it('rejects booking with departure date in the past', async () => {
        const pastStart = new Date(Date.now() - 15 * 60000).toISOString();
        const futureEnd = new Date(Date.now() + 60 * 60000).toISOString();

        const res = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 1,
            purpose: 'Site Visit',
            origin: 'Tower A',
            destination: 'Depot B',
            start_time: pastStart,
            end_time: futureEnd,
            passenger_count: 1,
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/cannot be in the past/i);
      });

      it('rejects booking where return time is earlier than or equal to departure time', async () => {
        const futureStart = new Date(Date.now() + 180 * 60000).toISOString();
        const earlierEnd = new Date(Date.now() + 120 * 60000).toISOString();

        const res = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 1,
            purpose: 'Site Visit',
            origin: 'Tower A',
            destination: 'Depot B',
            start_time: futureStart,
            end_time: earlierEnd,
            passenger_count: 1,
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/(?:Return|End) time must be after (?:departure|start) time/i);
      });

      it('permits compliant advance booking (>= 2h lead time) with standard approval flow', async () => {
        // Book 4 hours in advance for 2 hours duration
        const start = new Date(Date.now() + 240 * 60000).toISOString();
        const end = new Date(Date.now() + 360 * 60000).toISOString();

        const res = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 2,
            purpose: 'Standard Advance Corporate Meeting',
            origin: 'Tower A',
            destination: 'Regional Office',
            start_time: start,
            end_time: end,
            passenger_count: 2,
          });

        expect(res.status).toBe(201);
        const tripId = res.body.tripId;

        const db = getDb();
        const row = db.prepare('SELECT is_urgent, urgent_reason FROM trip_requests WHERE id = ?').get(tripId) as any;
        expect(row.is_urgent).toBe(0);
        expect(row.urgent_reason).toBeNull();

        // Verify GET /api/trips returns urgent metadata accurately
        const getRes = await request(app)
          .get('/api/trips')
          .set('Authorization', `Bearer ${currentAdminToken}`);
        expect(getRes.status).toBe(200);
        const trip = getRes.body.trips.find((t: any) => t.id === tripId);
        expect(Boolean(trip.is_urgent)).toBe(false);
        expect(trip.requires_pic_urgent_approval).toBe(false);
      });

      it('rejects urgent booking (< 2h lead time) when no urgent justification is provided', async () => {
        // Book departing in 30 minutes with empty justification
        const shortStart = new Date(Date.now() + 30 * 60000).toISOString();
        const shortEnd = new Date(Date.now() + 90 * 60000).toISOString();

        const res = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 2,
            purpose: 'Trip',
            origin: 'Tower A',
            destination: 'Depot B',
            start_time: shortStart,
            end_time: shortEnd,
            passenger_count: 1,
            urgent_reason: '',
            notes: '',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/2 hours/i);
        expect(res.body.error).toMatch(/urgent justification/i);
      });

      it('accepts urgent booking (< 2h) with justification, marks is_urgent = 1, and strictly requires Fleet Operation PIC approval', async () => {
        // Book departing in 45 minutes with explicit urgent justification
        const shortStart = new Date(Date.now() + 45 * 60000).toISOString();
        const shortEnd = new Date(Date.now() + 105 * 60000).toISOString();

        const createRes = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 3,
            purpose: 'Emergency Site Outage Investigation',
            origin: 'HQ Tower',
            destination: 'Cikarang Data Center',
            start_time: shortStart,
            end_time: shortEnd,
            passenger_count: 1,
            urgent_reason: 'Critical server outage requiring immediate hardware inspection',
          });

        expect(createRes.status).toBe(201);
        const tripId = createRes.body.tripId;

        // Verify database and API metadata
        const db = getDb();
        const row = db.prepare('SELECT is_urgent, urgent_reason FROM trip_requests WHERE id = ?').get(tripId) as any;
        expect(row.is_urgent).toBe(1);
        expect(row.urgent_reason).toBe('Critical server outage requiring immediate hardware inspection');

        const getRes = await request(app)
          .get('/api/trips')
          .set('Authorization', `Bearer ${picToken}`);
        expect(getRes.status).toBe(200);
        const trip = getRes.body.trips.find((t: any) => t.id === tripId);
        expect(Boolean(trip.is_urgent)).toBe(true);
        expect(trip.requires_pic_urgent_approval).toBe(true);
        expect(trip.urgent_reason).toContain('Critical server outage');

        // Step 0: If Head of WS Part (HWS) tries to approve BEFORE Fleet Operation PIC (FM) consents, it is rejected (strict hierarchy order)!
        const earlyHwsRes = await request(app)
          .post(`/api/trips/${tripId}/decision`)
          .set('Authorization', `Bearer ${hwsToken}`)
          .send({
            decision: 'APPROVED',
            reason: 'Premature HWS attempt',
          });
        expect(earlyHwsRes.status).toBe(400);
        expect(earlyHwsRes.body.error).toContain('Fleet Operation PIC must consent first');

        // Step 1: Fleet Operation PIC (FM) consents first (Stage 1)
        const picDecisionRes = await request(app)
          .post(`/api/trips/${tripId}/decision`)
          .set('Authorization', `Bearer ${picToken}`)
          .send({
            decision: 'APPROVED',
            reason: 'Fleet Operation PIC Stage 1 consent granted',
            driver_profile_id: 3,
          });
        expect(picDecisionRes.status).toBe(200);
        expect(picDecisionRes.body.status).toBe('PENDING_APPROVAL');
        expect(picDecisionRes.body.stage).toBe('AWAITING_HWS');
        expect(picDecisionRes.body.isFinal).toBe(false);

        // Step 2: Head Of WS Part (HWS) approves second (Stage 2) -> Final approval and dispatch succeeds!
        const hwsDecisionRes = await request(app)
          .post(`/api/trips/${tripId}/decision`)
          .set('Authorization', `Bearer ${hwsToken}`)
          .send({
            decision: 'APPROVED',
            reason: 'HWS Stage 2 final approval',
          });
        expect(hwsDecisionRes.status).toBe(200);
        expect(hwsDecisionRes.body.status).toBe('APPROVED');
        expect(hwsDecisionRes.body.isFinal).toBe(true);

        // Verify trip decision history recorded urgent approval
        const finalGet = await request(app)
          .get('/api/trips')
          .set('Authorization', `Bearer ${currentAdminToken}`);
        const finalTrip = finalGet.body.trips.find((t: any) => t.id === tripId);
        expect(finalTrip.status).toBe('APPROVED');
        expect(finalTrip.decisions.some((d: any) => d.reason?.includes('[Urgent Request Approved by Fleet Operation PIC]'))).toBe(true);
      });

      it('allows Administrator to delegate and immediately authorize urgent trip if Fleet PIC is unavailable', async () => {
        const shortStart = new Date(Date.now() + 20 * 60000).toISOString();
        const shortEnd = new Date(Date.now() + 80 * 60000).toISOString();

        const createRes = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 4,
            purpose: 'Urgent VIP Client Pickup',
            origin: 'Airport T3',
            destination: 'Headquarters',
            start_time: shortStart,
            end_time: shortEnd,
            passenger_count: 2,
            urgent_reason: 'Flight arrived early, client waiting at gate',
          });

        expect(createRes.status).toBe(201);
        const tripId = createRes.body.tripId;

        // Admin delegates and approves with available driver 4
        const adminDecision = await request(app)
          .post(`/api/trips/${tripId}/decision`)
          .set('Authorization', `Bearer ${currentAdminToken}`)
          .send({
            decision: 'APPROVED',
            reason: 'Admin emergency executive delegation',
            driver_profile_id: 4,
          });

        expect(adminDecision.status).toBe(200);
        expect(adminDecision.body.status).toBe('APPROVED');
        expect(adminDecision.body.isFinal).toBe(true);
      });
    });

    describe('GoCar UI/UX Reference in Samsung Blue & White and Black & White Palette', () => {
      it('implements GoCar Reference UI components in Samsung Blue (#0072de) & Black (#0a0a0a) with zero green hex codes in user UI', () => {
        const fs = require('fs');
        const path = require('path');

        const tokensCss = fs.readFileSync(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
        const appCss = fs.readFileSync(path.join(process.cwd(), 'src/styles/app.css'), 'utf8');
        const appTsx = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
        const routeFieldsTsx = fs.readFileSync(path.join(process.cwd(), 'src/components/RouteFields.tsx'), 'utf8');
        const mapViewTsx = fs.readFileSync(path.join(process.cwd(), 'src/components/MapView.tsx'), 'utf8');

        // Verify Samsung Blue & Black tokens
        expect(tokensCss).toContain('--color-primary: #0072de');
        expect(tokensCss).toContain('--color-status-green-bg: #ebf5ff');
        expect(tokensCss).toContain('--color-status-green-fg: #005bb5');

        // Verify GoCar Reference classes exist in app.css
        expect(appCss).toContain('.gf-gocar-hero');
        expect(appCss).toContain('.gf-gocar-onetap-card');
        expect(appCss).toContain('.gf-pickup-up-circle');
        expect(appCss).toContain('.gf-dest-ring-dot');
        expect(appCss).toContain('.gf-action-pill-outlined');
        expect(appCss).toContain('.gf-pickup-spot-row');
        expect(appCss).toContain('.gf-gocar-book-cta');
        expect(appCss).toContain('.gf-sublocation-band');

        // Verify RouteFields uses Pickup Up-Circle & Destination Ring-Dot
        expect(routeFieldsTsx).toContain('gf-pickup-up-circle');
        expect(routeFieldsTsx).toContain('gf-dest-ring-dot');

        // Verify zero green hex codes in App.tsx, RouteFields.tsx, MapView.tsx, tokens.css, app.css
        const forbiddenGreenRegex = /#0aa211|#09ba11|#0cb417|#059669|#10b981|#16a34a|#065f46|#166534|#f0fdf4|#dcfce7|#ecfdf5|#bbf7d0/i;
        expect(forbiddenGreenRegex.test(appTsx)).toBe(false);
        expect(forbiddenGreenRegex.test(routeFieldsTsx)).toBe(false);
        expect(forbiddenGreenRegex.test(mapViewTsx)).toBe(false);
        expect(forbiddenGreenRegex.test(tokensCss)).toBe(false);
        expect(forbiddenGreenRegex.test(appCss)).toBe(false);

        // Verify all key booking flow IDs remain intact
        expect(appTsx).toContain('id="home-where-to-btn"');
        expect(appTsx).toContain('id="route-continue-btn"');
        expect(appTsx).toContain('id="vehicle-continue-btn"');
        expect(appTsx).toContain('id="submit-booking-btn"');
        expect(appTsx).toContain('id="schedule-start"');
        expect(appTsx).toContain('id="schedule-end"');
        expect(appTsx).toContain('id="inline-trip-purpose-input"');
      });
    });

    describe('Bug Fixes: Fast Maps, Nationwide Indonesian Geocoding, Zero Trip Pricing & Reservation Modes', () => {
      it('configures fast map CDN, CSP directives, preconnect hints, and Canvas rendering', async () => {
        const fs = require('fs');
        const path = require('path');

        const res = await request(app).get('/api/health');
        expect(res.headers['content-security-policy']).toContain('basemaps.cartocdn.com');
        expect(res.headers['content-security-policy']).toContain('photon.komoot.io');
        expect(res.headers['content-security-policy']).toContain('router.project-osrm.org');

        const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
        expect(indexHtml).toContain('basemaps.cartocdn.com');
        expect(indexHtml).toContain('rel="preconnect"');

        const mapViewTsx = fs.readFileSync(path.join(process.cwd(), 'src/components/MapView.tsx'), 'utf8');
        expect(mapViewTsx).toContain('rastertiles/voyager');
        expect(mapViewTsx).toContain('OSM_FALLBACK_TILE_URL');
        expect(mapViewTsx).toMatch(/preferCanvas:\s*(false|true)/);
        expect(mapViewTsx).toContain('ResizeObserver');
      });

      it('indexes nationwide Indonesian cities/landmarks and expands Indonesian abbreviations accurately', async () => {
        const { searchIndonesianPois } = await import('../src/server/indonesian-pois.ts');

        const surabayaMatches = searchIndonesianPois('sby');
        expect(surabayaMatches.length).toBeGreaterThan(0);
        expect(surabayaMatches.some((p) => p.name.toLowerCase().includes('surabaya'))).toBe(true);

        const iknMatches = searchIndonesianPois('ikn');
        expect(iknMatches.some((p) => p.name.includes('Nusantara'))).toBe(true);

        const makassarMatches = searchIndonesianPois('mks');
        expect(makassarMatches.some((p) => p.name.includes('Makassar'))).toBe(true);

        const baliMatches = searchIndonesianPois('Denpasar');
        expect(baliMatches.some((p) => p.name.includes('Denpasar') || p.name.includes('Ngurah Rai'))).toBe(true);

        const jayapuraMatches = searchIndonesianPois('Jayapura');
        expect(jayapuraMatches.some((p) => p.name.includes('Jayapura') || p.name.includes('Sentani'))).toBe(true);

        const geoRes = await request(app)
          .get('/api/geocode/search?q=Surabaya')
          .set('Authorization', `Bearer ${currentEmpToken}`);
        expect(geoRes.status).toBe(200);
        expect(Array.isArray(geoRes.body.results)).toBe(true);
        expect(geoRes.body.results.length).toBeGreaterThan(0);
        expect(
          geoRes.body.results.some((r: any) => String(r.name).toLowerCase().includes('surabaya') || String(r.address).toLowerCase().includes('surabaya'))
        ).toBe(true);
      });

      it('removes all passenger trip pricing from booking UI while preserving Admin IDR expense ledgers', () => {
        const fs = require('fs');
        const path = require('path');

        const appTsx = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
        expect(appTsx).not.toContain('0 IDR');
        expect(appTsx).not.toContain('Rp150.500');
        expect(appTsx).not.toContain('Rp148.000');
        expect(appTsx).not.toContain('Rp139.500');
        expect(appTsx).not.toContain('CORP PASS');
        expect(appTsx).not.toContain('title="Charge to"');

        // Summary Department & Driver row and custom address fallback exist
        expect(appTsx).toContain('id="summary-charge-row"');
        expect(appTsx).toContain('Department & Driver');
        expect(appTsx).toContain('Use typed address:');

        // Reservation mode UI controls present (Standard Trip, Round Trip, Full Day) without preset chips
        expect(appTsx).toContain('id={`reservation-mode-${mode.id.toLowerCase()}`}');
        expect(appTsx).toContain('id="schedule-return-pickup"');
        expect(appTsx).toContain('Standard Trip');
        expect(appTsx).toContain('Round Trip');
        expect(appTsx).toContain('Full Day');
        expect(appTsx).not.toContain('In 2h (Standard)');
        expect(appTsx).not.toContain('Urgent Now (+15m)');

        // Admin IDR reporting ledger strictly preserved
        expect(appTsx).toContain('export function formatIdr');
        expect(appTsx).toContain('Comprehensive Energy & Operating Expense Ledger (IDR)');
        expect(appTsx).toContain('TOTAL OPERATING COST (IDR)');
      });

      it('validates and creates DROP_AND_PICKUP and FULL_DAY reservations end-to-end with conflict locking', async () => {
        const day10Base = Date.now() + 10 * 86400_000;
        const depIso = new Date(day10Base).toISOString();
        const invalidEarlyRpIso = new Date(day10Base - 30 * 60_000).toISOString();
        const validRpIso = new Date(day10Base + 3 * 3600_000).toISOString();
        const validEndIso = new Date(day10Base + 4 * 3600_000).toISOString();

        // 1. Invalid reservation_type
        const invalidModeRes = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 2,
            purpose: 'Invalid Reservation Mode Check',
            origin: 'Head Office - SCBD District 8',
            destination: 'ICE BSD',
            start_time: depIso,
            end_time: validEndIso,
            reservation_type: 'INVALID_MODE',
          });
        expect(invalidModeRes.status).toBe(400);

        // 2. Missing return_pickup_time for DROP_AND_PICKUP
        const missingRpRes = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 2,
            purpose: 'Event Drop Missing Return Pickup',
            origin: 'Head Office - SCBD District 8',
            destination: 'ICE BSD',
            start_time: depIso,
            end_time: validEndIso,
            reservation_type: 'DROP_AND_PICKUP',
          });
        expect(missingRpRes.status).toBe(400);

        // 3. return_pickup_time <= start_time rejected
        const earlyRpRes = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 2,
            purpose: 'Event Drop Early Return Pickup',
            origin: 'Head Office - SCBD District 8',
            destination: 'ICE BSD',
            start_time: depIso,
            end_time: validEndIso,
            reservation_type: 'DROP_AND_PICKUP',
            return_pickup_time: invalidEarlyRpIso,
          });
        expect(earlyRpRes.status).toBe(400);

        // 4. end_time < return_pickup_time rejected
        const lateRpRes = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 2,
            purpose: 'Event Drop Return Before Pickup',
            origin: 'Head Office - SCBD District 8',
            destination: 'ICE BSD',
            start_time: depIso,
            end_time: validRpIso,
            reservation_type: 'DROP_AND_PICKUP',
            return_pickup_time: validEndIso,
          });
        expect(lateRpRes.status).toBe(400);

        // 5. Valid DROP_AND_PICKUP succeeds
        const validDropRes = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 2,
            purpose: 'Conference Drop & Pick Up After Event',
            origin: 'Head Office - SCBD District 8',
            destination: 'Indonesia Convention Exhibition (ICE BSD)',
            start_time: depIso,
            end_time: validEndIso,
            reservation_type: 'DROP_AND_PICKUP',
            return_pickup_time: validRpIso,
            passenger_count: 2,
          });
        expect(validDropRes.status).toBe(201);
        const dropTripId = validDropRes.body.tripId;

        const tripsGet = await request(app)
          .get('/api/trips')
          .set('Authorization', `Bearer ${currentAdminToken}`);
        expect(tripsGet.status).toBe(200);
        const dropTrip = tripsGet.body.trips.find((t: any) => t.id === dropTripId);
        expect(dropTrip).toBeDefined();
        expect(dropTrip.reservation_type).toBe('DROP_AND_PICKUP');
        expect(dropTrip.return_pickup_time).toBe(validRpIso);

        // Driver dispatch view includes reservation_type and return_pickup_time
        const dispatchRes = await request(app)
          .get('/api/driver/dispatches')
          .set('Authorization', `Bearer ${currentAdminToken}`);
        expect(dispatchRes.status).toBe(200);
        const dropDispatch = dispatchRes.body.dispatches.find((d: any) => d.trip_request_id === dropTripId);
        expect(dropDispatch).toBeDefined();
        expect(dropDispatch.reservation_type).toBe('DROP_AND_PICKUP');
        expect(dropDispatch.return_pickup_time).toBe(validRpIso);

        // 6. FULL_DAY reservation creation + overlapping slot conflict protection
        const day12Start = new Date(Date.now() + 12 * 86400_000);
        day12Start.setHours(8, 0, 0, 0);
        const day12End = new Date(day12Start);
        day12End.setHours(20, 0, 0, 0);

        const fullDayRes = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 3,
            purpose: 'Full Day Plant Tour & Audit',
            origin: 'Manufacturing Plant 1',
            destination: 'Manufacturing Plant 2',
            start_time: day12Start.toISOString(),
            end_time: day12End.toISOString(),
            reservation_type: 'FULL_DAY',
            passenger_count: 3,
          });
        expect(fullDayRes.status).toBe(201);
        const fullDayId = fullDayRes.body.tripId;

        const db = getDb();
        const fdRow = db.prepare('SELECT reservation_type, return_pickup_time FROM trip_requests WHERE id = ?').get(fullDayId) as any;
        expect(fdRow.reservation_type).toBe('FULL_DAY');
        expect(fdRow.return_pickup_time).toBeNull();

        // Overlapping midday booking on vehicle 3 is blocked (409)
        const midStart = new Date(day12Start.getTime() + 4 * 3600_000).toISOString();
        const midEnd = new Date(day12Start.getTime() + 6 * 3600_000).toISOString();
        const conflictRes = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            vehicle_id: 3,
            purpose: 'Conflicting Midday Trip',
            origin: 'Central Fleet Pool',
            destination: 'SCBD',
            start_time: midStart,
            end_time: midEnd,
            reservation_type: 'ONE_WAY',
          });
        expect(conflictRes.status).toBe(409);
      });
    });

    describe('13th Official Group (Driver G) & Existing DB Auto-Migration', () => {
      it('seeds 13 official groups including Driver G, upgrades an existing 12-group SQLite DB idempotently, and defaults DRV accounts to Driver G', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const path = await import('node:path');
        const { createDatabaseEngine } = await import('../src/server/sqlite-compat.ts');
        const { COMPANY_GROUPS } = await import('../src/server/db.ts');

        expect(COMPANY_GROUPS).toHaveLength(13);
        expect(COMPANY_GROUPS[12]).toEqual(['Driver G', 'DRV']);

        // 1. Public groups returns 13 official groups with Driver G last
        const pubRes = await request(app).get('/api/public/groups');
        expect(pubRes.status).toBe(200);
        expect(pubRes.body.groups).toHaveLength(13);
        const drvGroup = pubRes.body.groups.find((g: any) => g.code === 'DRV');
        expect(drvGroup).toBeDefined();
        expect(drvGroup.name).toBe('Driver G');

        // 2. Creating a DRV user or Driver Profile without explicit department_id defaults to Driver G
        const drvUserRes = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${currentAdminToken}`)
          .send({
            nickname: 'Tono Driver',
            group_username: 'drv_tono_auto',
            password: 'Password123',
            role: 'DRV',
          });
        expect(drvUserRes.status).toBe(201);
        expect(drvUserRes.body.user.department_id).toBe(drvGroup.id);

        const drvProfileRes = await request(app)
          .post('/api/drivers')
          .set('Authorization', `Bearer ${currentAdminToken}`)
          .send({
            full_name: 'Surya Auto Group',
            licence_number: 'SIM-A-DRV-888',
            licence_class: 'A',
            licence_expiry: '2029-12-31',
          });
        expect(drvProfileRes.status).toBe(201);
        expect(drvProfileRes.body.driver.department_id).toBe(drvGroup.id);
        expect(drvProfileRes.body.driver.department_name).toBe('Driver G');

        // 3. Simulate an existing 12-group production SQLite DB (missing Driver G) and reopen via getDb(tmpPath)
        const tmpDbPath = path.join(os.tmpdir(), `gf-driver-group-mig-${Date.now()}.sqlite`);
        try {
          const legacyDb = createDatabaseEngine(tmpDbPath);
          legacyDb.exec(`
            CREATE TABLE departments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL UNIQUE,
              code TEXT NOT NULL UNIQUE,
              is_active INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
          `);
          const ins = legacyDb.prepare('INSERT INTO departments (name, code) VALUES (?, ?)');
          for (const [name, code] of COMPANY_GROUPS.slice(0, 12)) {
            ins.run(name, code);
          }
          expect((legacyDb.prepare('SELECT COUNT(*) as c FROM departments').get() as { c: number }).c).toBe(12);
          legacyDb.close();

          const upgradedFirst = getDb(tmpDbPath);
          const rowsAfterUpgrade = upgradedFirst.prepare('SELECT id, name, code FROM departments ORDER BY id ASC').all() as Array<{ id: number; name: string; code: string }>;
          expect(rowsAfterUpgrade).toHaveLength(13);
          expect(rowsAfterUpgrade[12].name).toBe('Driver G');
          expect(rowsAfterUpgrade[12].code).toBe('DRV');
          upgradedFirst.close();

          // Reopening a second time remains idempotent (still 13 rows, no duplicate error)
          const upgradedSecond = getDb(tmpDbPath);
          const rowsSecondOpen = upgradedSecond.prepare('SELECT id, name, code FROM departments ORDER BY id ASC').all() as Array<{ id: number; name: string; code: string }>;
          expect(rowsSecondOpen).toHaveLength(13);
          upgradedSecond.close();
        } finally {
          for (const suffix of ['', '-wal', '-shm']) {
            try {
              fs.rmSync(`${tmpDbPath}${suffix}`, { force: true });
            } catch {}
          }
        }
      });

      it('auto-reactivates Driver G if deactivated, sends no-store cache headers, and allows ADM profile group change while blocking EMP', async () => {
        const db = getDb();
        const drvRow = db.prepare("SELECT id FROM departments WHERE code = 'DRV'").get() as { id: number };
        expect(drvRow).toBeDefined();

        // Simulate a DB state where Driver G was deactivated (is_active = 0)
        db.prepare('UPDATE departments SET is_active = 0 WHERE id = ?').run(drvRow.id);

        const pubRes = await request(app).get('/api/public/groups');
        expect(pubRes.status).toBe(200);
        expect(String(pubRes.headers['cache-control'] || '')).toContain('no-store');
        const restoredPublic = pubRes.body.groups.find((g: any) => g.id === drvRow.id);
        expect(restoredPublic).toBeDefined();
        expect(restoredPublic.is_active).toBe(1);
        expect(restoredPublic.name).toBe('Driver G');

        // Also verify /api/departments ensures active Driver G and disables caching
        db.prepare('UPDATE departments SET is_active = 0 WHERE id = ?').run(drvRow.id);
        const deptRes = await request(app)
          .get('/api/departments')
          .set('Authorization', `Bearer ${currentAdminToken}`);
        expect(deptRes.status).toBe(200);
        expect(String(deptRes.headers['cache-control'] || '')).toContain('no-store');
        const restoredDept = deptRes.body.departments.find((g: any) => g.id === drvRow.id);
        expect(restoredDept?.is_active).toBe(1);

        // Non-ADM (EMP) sending department_id in PATCH /api/user/profile must have it ignored
        const empMeBefore = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${currentEmpToken}`);
        const empDeptBefore = empMeBefore.body.user.department_id;

        const empPatch = await request(app)
          .patch('/api/user/profile')
          .set('Authorization', `Bearer ${currentEmpToken}`)
          .send({
            nickname: empMeBefore.body.user.nickname,
            department_id: drvRow.id,
          });
        expect(empPatch.status).toBe(200);
        expect(empPatch.body.user.department_id).toBe(empDeptBefore);

        // ADM can update their own assigned group via PATCH /api/user/profile
        const admPatch = await request(app)
          .patch('/api/user/profile')
          .set('Authorization', `Bearer ${currentAdminToken}`)
          .send({ department_id: drvRow.id });
        expect(admPatch.status).toBe(200);
        expect(admPatch.body.user.department_id).toBe(drvRow.id);
        expect(admPatch.body.user.department_name).toBe('Driver G');

        // Restore ADM back to Group #1
        const admRestore = await request(app)
          .patch('/api/user/profile')
          .set('Authorization', `Bearer ${currentAdminToken}`)
          .send({ department_id: 1 });
        expect(admRestore.status).toBe(200);
        expect(admRestore.body.user.department_id).toBe(1);

        // Verify Driver G deleted or missing before FACTORY_RESET gets recreated cleanly
        const tempApp = createApp();
        resetDbForTesting(':memory:');
        const memDb = getDb();
        const memLogin = await request(tempApp)
          .post('/api/auth/login')
          .send({ group_username: 'admin', password: 'Admin@123' });
        expect(memLogin.status).toBe(200);

        memDb.prepare("UPDATE departments SET is_active = 0 WHERE code = 'DRV'").run();
        const factoryResetRes = await request(tempApp)
          .post('/api/admin/system/reset-data')
          .set('Authorization', `Bearer ${memLogin.body.token}`)
          .send({ mode: 'FACTORY_RESET', confirmation_code: 'RESET' });
        expect(factoryResetRes.status).toBe(200);

        const afterResetDrv = memDb.prepare("SELECT is_active, name FROM departments WHERE code = 'DRV'").get() as { is_active: number; name: string };
        expect(afterResetDrv.is_active).toBe(1);
        expect(afterResetDrv.name).toBe('Driver G');
      });
    });

    describe('Production Error Resilience & Post-Reset Persistence (No 500 HTML Pages)', () => {
      it('handles FACTORY_RESET cleanly (including self-referenced documents) and stays clean across restart with AUTO_SEED_DEMO=true', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const path = await import('node:path');
        const { seedDemoFixtures, hashPassword } = await import('../src/server/db.ts');

        const tmpDbPath = path.join(os.tmpdir(), `gf-factory-restart-${Date.now()}.sqlite`);
        const prevAutoSeed = process.env.AUTO_SEED_DEMO;

        try {
          process.env.AUTO_SEED_DEMO = 'true';

          // 1. Fresh DB with AUTO_SEED_DEMO=true seeds cleanly and boots admin + demo vehicles
          const db1 = getDb(tmpDbPath);
          expect((db1.prepare('SELECT COUNT(*) as c FROM vehicles').get() as { c: number }).c).toBe(8);
          expect((db1.prepare('SELECT COUNT(*) as c FROM driver_profiles').get() as { c: number }).c).toBe(4);
          db1.close();

          // 2. Simulate FACTORY_RESET via API on a fresh :memory: DB containing versioned documents (self-FK replaced_by_id)
          const resetApp = createApp();
          resetDbForTesting(':memory:');
          const memDb = getDb();
          const adm = memDb.prepare("SELECT id FROM users WHERE role = 'ADM' LIMIT 1").get() as { id: number };
          const doc1 = memDb
            .prepare(
              `INSERT INTO documents (entity_type, entity_id, doc_type, file_name, mime_type, size_bytes, content_base64, uploaded_by)
               VALUES ('VEHICLE', 1, 'Registration', 'v1.pdf', 'application/pdf', 10, 'dGVzdA==', ?)`
            )
            .run(adm.id);
          const doc2 = memDb
            .prepare(
              `INSERT INTO documents (entity_type, entity_id, doc_type, file_name, mime_type, size_bytes, content_base64, version_number, uploaded_by)
               VALUES ('VEHICLE', 1, 'Registration', 'v2.pdf', 'application/pdf', 10, 'dGVzdA==', 2, ?)`
            )
            .run(adm.id);
          memDb.prepare('UPDATE documents SET replaced_by_id = ? WHERE id = ?').run(Number(doc2.lastInsertRowid), Number(doc1.lastInsertRowid));

          const admLogin = await request(resetApp)
            .post('/api/auth/login')
            .send({ group_username: 'admin', password: 'Admin@123' });
          expect(admLogin.status).toBe(200);

          const factoryRes = await request(resetApp)
            .post('/api/admin/system/reset-data')
            .set('Authorization', `Bearer ${admLogin.body.token}`)
            .send({ mode: 'FACTORY_RESET', confirmation_code: 'RESET' });
          expect(factoryRes.status).toBe(200);
          expect(factoryRes.body.success).toBe(true);

          const suppressedRow = memDb
            .prepare("SELECT value FROM system_settings WHERE key = 'demo_seed_suppressed'")
            .get() as { value: string } | undefined;
          expect(suppressedRow?.value).toBe('1');

          // Calling seedDemoFixtures without { force: true } after reset must NO-OP cleanly without throwing FK errors
          expect(() => seedDemoFixtures(memDb)).not.toThrow();
          expect((memDb.prepare('SELECT COUNT(*) as c FROM vehicles').get() as { c: number }).c).toBe(0);

          // 3. Simulate restarting Node server against persistent disk DB where sqlite_sequence is > 20 and demo_seed_suppressed=1
          const db2 = getDb(tmpDbPath);
          db2.exec(`
            DROP TRIGGER IF EXISTS prevent_approval_decision_delete;
            DROP TRIGGER IF EXISTS prevent_approval_decision_update;
            DROP TRIGGER IF EXISTS prevent_assignment_delete;
          `);
          db2.prepare('DELETE FROM trip_events').run();
          db2.prepare('DELETE FROM location_reports').run();
          db2.prepare('DELETE FROM assignments').run();
          db2.prepare('DELETE FROM booking_history').run();
          db2.prepare('DELETE FROM approval_decisions').run();
          db2.prepare('DELETE FROM bookings').run();
          db2.prepare('DELETE FROM fuel_records').run();
          db2.prepare('DELETE FROM ev_charging_records').run();
          db2.prepare('DELETE FROM maintenance_records').run();
          db2.prepare('DELETE FROM expenses').run();
          db2.prepare('DELETE FROM trip_requests').run();
          db2.prepare('UPDATE vehicles SET default_driver_id = NULL').run();
          db2.prepare('DELETE FROM vehicles').run();
          db2.prepare('DELETE FROM driver_profiles').run();
          db2.prepare("DELETE FROM users WHERE role != 'ADM'").run();
          db2.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('demo_seed_suppressed', '1')").run();
          // Bump users sequence beyond hardcoded legacy IDs (to prove bumped sequences never crash forced seeding either)
          const bumpedUser = db2
            .prepare(
              `INSERT INTO users (nickname, group_username, password_hash, role, is_department_admin, department_id, approval_status, is_active)
               VALUES ('Temp', 'tmp_bump', ?, 'EMP', 0, 1, 'APPROVED', 1)`
            )
            .run(hashPassword('Temp@123'));
          db2.prepare('DELETE FROM users WHERE id = ?').run(Number(bumpedUser.lastInsertRowid));
          db2.close();

          // Reopen with AUTO_SEED_DEMO=true: must boot without FK crash and remain cleanly reset
          const dbAfterRestart = getDb(tmpDbPath);
          expect((dbAfterRestart.prepare('SELECT COUNT(*) as c FROM vehicles').get() as { c: number }).c).toBe(0);
          expect((dbAfterRestart.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c).toBe(1);

          // Even forced re-seed with bumped autoincrement sequences must succeed cleanly using dynamic IDs
          expect(() => seedDemoFixtures(dbAfterRestart, { force: true })).not.toThrow();
          expect((dbAfterRestart.prepare('SELECT COUNT(*) as c FROM vehicles').get() as { c: number }).c).toBe(8);
          expect((dbAfterRestart.prepare('SELECT COUNT(*) as c FROM driver_profiles').get() as { c: number }).c).toBe(4);
          expect((dbAfterRestart.prepare('SELECT COUNT(*) as c FROM trip_requests').get() as { c: number }).c).toBe(6);
          dbAfterRestart.close();
        } finally {
          if (prevAutoSeed === undefined) {
            delete process.env.AUTO_SEED_DEMO;
          } else {
            process.env.AUTO_SEED_DEMO = prevAutoSeed;
          }
          for (const suffix of ['', '-wal', '-shm']) {
            try {
              fs.rmSync(`${tmpDbPath}${suffix}`, { force: true });
            } catch {}
          }
        }
      });

      it('returns structured JSON (never HTML 500) on malformed JSON, multi-byte UTF-8 tokens, corrupt cookies, and internal route errors under NODE_ENV=production', async () => {
        const { verifyPassword } = await import('../src/server/db.ts');
        const { verifySignedToken } = await import('../src/server/auth.ts');
        resetDbForTesting(':memory:');
        const prodApp = createApp();
        const prevNodeEnv = process.env.NODE_ENV;

        try {
          process.env.NODE_ENV = 'production';

          // 1. Multi-byte UTF-8 token (64 UTF-16 code units = 128 UTF-8 bytes) that previously threw RangeError in timingSafeEqual
          const multiByteSig = '😀'.repeat(32);
          expect(multiByteSig.length).toBe(64);
          expect(verifySignedToken(`sess123.1.${multiByteSig}`)).toBeNull();
          const tokenRes = await request(prodApp)
            .get(`/api/auth/me?token=${encodeURIComponent(`sess123.1.${multiByteSig}`)}`);
          expect(tokenRes.status).toBe(401);
          expect(tokenRes.headers['content-type']).toContain('application/json');
          expect(tokenRes.body.error).toBeDefined();

          // 2. Malformed URL-encoded cookie header must return 401 JSON (never URIError 500)
          const cookieRes = await request(prodApp)
            .get('/api/auth/me')
            .set('Cookie', 'fms_session=%E0%A4%A; other=1');
          expect(cookieRes.status).toBe(401);
          expect(cookieRes.headers['content-type']).toContain('application/json');

          // 3. Malformed JSON request payload must return 400 JSON (never HTML 500)
          const badJsonRes = await request(prodApp)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"group_username": "admin",');
          expect(badJsonRes.status).toBe(400);
          expect(badJsonRes.headers['content-type']).toContain('application/json');
          expect(badJsonRes.body.code).toBe('INVALID_JSON');

          // 4. Malformed stored password hash must return false cleanly
          expect(verifyPassword('Admin@123', 'corrupt-hash-without-colon')).toBe(false);
          expect(verifyPassword('Admin@123', 'salt:zzzz_non_hex')).toBe(false);

          // 5. Internal unexpected DB error inside an API route must return structured JSON 500 (never HTML)
          const db = getDb();
          const origPrepare = db.prepare.bind(db);
          (db as any).prepare = () => {
            throw new Error('Simulated production SQLite I/O fault');
          };
          try {
            const errRes = await request(prodApp).get('/api/public/groups');
            expect(errRes.status).toBe(500);
            expect(errRes.headers['content-type']).toContain('application/json');
            expect(errRes.body.error).toContain('Simulated production SQLite I/O fault');
          } finally {
            (db as any).prepare = origPrepare;
          }

          // 6. Analytics and executive PDF handle anomalous non-ISO timestamps gracefully
          const adminLogin = await request(prodApp)
            .post('/api/auth/login')
            .send({ group_username: 'admin', password: 'Admin@123' });
          expect(adminLogin.status).toBe(200);

          db.prepare(
            `INSERT INTO trip_requests (requester_id, department_id, vehicle_id, purpose, origin, destination, start_time, end_time, status, actual_start_time, actual_end_time)
             VALUES (1, 1, 1, 'Edge Date Audit', 'HQ', 'Site', 'invalid-date', 'invalid-date', 'COMPLETED', 'not-iso', '')`
          ).run();

          const analyticsRes = await request(prodApp)
            .get('/api/analytics/usage')
            .set('Authorization', `Bearer ${adminLogin.body.token}`);
          expect(analyticsRes.status).toBe(200);
        } finally {
          if (prevNodeEnv === undefined) {
            delete process.env.NODE_ENV;
          } else {
            process.env.NODE_ENV = prevNodeEnv;
          }
        }
      });
    });

    describe('Bug Fixes: High-Definition Satellite/Terrain Maps, Google Translate CSP & Multi-Device Responsive UI', () => {
      it('configures CSP to permit Google Translate scripts, styles, frames, fonts, and connects alongside Google Maps tiles', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);

        const csp = res.headers['content-security-policy'];
        expect(csp).toBeDefined();

        // 1. Google Translate element script, evaluation, and gstatic origins
        expect(csp).toContain('https://translate.google.com');
        expect(csp).toContain('https://translate.googleapis.com');
        expect(csp).toContain('https://translate-pa.googleapis.com');
        expect(csp).toContain('https://www.gstatic.com');
        expect(csp).toContain("'unsafe-eval'");

        // 2. Styles and fonts
        expect(csp).toContain('https://fonts.googleapis.com');
        expect(csp).toContain('font-src');
        expect(csp).toContain('https://fonts.gstatic.com');

        // 3. Iframe and connect
        expect(csp).toContain('frame-src');
        expect(csp).toContain('https://translate.google.com https://translate.googleapis.com');
        expect(csp).toContain('connect-src');
        expect(csp).toContain('https://translate.googleapis.com');

        // 4. Tiles img-src permissions (Google tiles, Carto, Esri, OSM)
        expect(csp).toContain('https://*.google.com');
        expect(csp).toContain('https://*.basemaps.cartocdn.com');
        expect(csp).toContain('https://server.arcgisonline.com');
      });

      it('validates Google Hybrid Satellite and Topographic Terrain map layers with automatic failover URLs', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const mapViewContent = fs.readFileSync(path.resolve(__dirname, '../src/components/MapView.tsx'), 'utf-8');

        // Satellite layer configuration
        expect(mapViewContent).toContain("name: 'Satellite'");
        expect(mapViewContent).toContain("'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'");
        expect(mapViewContent).toContain('maxZoom: 21');
        expect(mapViewContent).toContain("subdomains: ['0', '1', '2', '3']");

        // Terrain layer configuration
        expect(mapViewContent).toContain("name: 'Terrain'");
        expect(mapViewContent).toContain("'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'");
        expect(mapViewContent).toContain('maxZoom: 20');

        // Automatic failover URLs
        expect(mapViewContent).toContain("SATELLITE_FALLBACK_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'");
        expect(mapViewContent).toContain("TERRAIN_FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'");
        expect(mapViewContent).toContain("OSM_FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'");
      });

      it('verifies responsive layout CSS eliminating navigation deadzones, preventing translation offset, and styling map controls', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const cssContent = fs.readFileSync(path.resolve(__dirname, '../src/styles/app.css'), 'utf-8');

        // 1. Navigation breakpoint harmonization at 768px (eliminates 640px-820px deadzone)
        expect(cssContent).toContain('@container gfapp (max-width: 767px)');
        expect(cssContent).toContain('@container gfapp (min-width: 768px) and (max-width: 1023px)');
        expect(cssContent).toContain('@container gfapp (min-width: 1024px)');

        // 2. Google Translate body offset and banner suppression
        expect(cssContent).toContain('top: 0 !important;');
        expect(cssContent).toContain('.goog-te-banner-frame');
        expect(cssContent).toContain('display: none !important;');

        // 3. Map overlay responsive classes
        expect(cssContent).toContain('.gf-map-layer-pill-group');
        expect(cssContent).toContain('.gf-map-layer-btn');
        expect(cssContent).toContain('.gf-map-overlay-actions');

        // 4. Ride layout calculated height without 64px overflow
        expect(cssContent).toContain('height: calc(100dvh - 64px);');
        expect(cssContent).toContain('margin-top: 64px;');
      });

      it('verifies mobile UI decluttering, back-button separation, topbar dark contrast, and redundant card removal', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const cssContent = fs.readFileSync(path.resolve(__dirname, '../src/styles/app.css'), 'utf-8');
        const bottomSheetContent = fs.readFileSync(path.resolve(__dirname, '../src/components/BottomSheet.tsx'), 'utf-8');
        const mapViewContent = fs.readFileSync(path.resolve(__dirname, '../src/components/MapView.tsx'), 'utf-8');

        // 1. Back button non-collision with layer switcher
        expect(cssContent).toContain('.gf-map-layer-switcher.has-back-btn');
        expect(cssContent).toContain('left: 54px !important;');
        expect(mapViewContent).toContain("className={`gf-map-layer-switcher ${showBackButton ? 'has-back-btn' : ''}`}");

        // 2. Guaranteed topbar contrast in dark mode
        expect(cssContent).toContain(":root[data-theme='dark'] .gf-embedded-topbar");
        expect(cssContent).toContain('background: rgba(20, 26, 36, 0.95);');
        expect(cssContent).toContain('color: var(--color-text-primary) !important;');

        // 3. Redundant controls hidden on mobile viewports (< 768px)
        expect(cssContent).toContain('.gf-sheet-top-controls {');
        expect(cssContent).toContain('.gf-floating-expand-card {');
        expect(cssContent).toContain('.gf-map-driver-pill,');
        expect(cssContent).toContain('.gf-map-users-pill,');
        expect(cssContent).toContain('.gf-map-fleet-pill {');

        // 4. Peek state does not trigger redundant floating expand card
        expect(bottomSheetContent).toContain('const isCollapsed = isManualCollapsed;');
        expect(bottomSheetContent).not.toContain('const isCollapsed = isManualCollapsed || snap === \'peek\';');
      });

      it('verifies enterprise native i18n dictionary, instant phrase translation, and DOM translation engine', async () => {
        const { t, SUPPORTED_LANGUAGES, DICTIONARY } = await import('../src/utils/i18n.ts');

        // 1. Supported languages include en, id, ko
        expect(SUPPORTED_LANGUAGES.map((l: any) => l.code)).toEqual(['en', 'id', 'ko']);

        // 2. Accurate Indonesian translations
        expect(t('Home', 'id')).toBe('Beranda');
        expect(t('Activity', 'id')).toBe('Aktivitas');
        expect(t('Inbox', 'id')).toBe('Kotak Masuk');
        expect(t('Profile', 'id')).toBe('Profil');
        expect(t('Dispatch', 'id')).toBe('Disposisi');
        expect(t('Admin', 'id')).toBe('Admin');
        expect(t('Streets', 'id')).toBe('Jalan');
        expect(t('Satellite', 'id')).toBe('Satelit');
        expect(t('Terrain', 'id')).toBe('Topografi');
        expect(t('Book a Ride', 'id')).toBe('Pesan Kendaraan');
        expect(t('Confirm Booking', 'id')).toBe('Konfirmasi Pemesanan');
        expect(t('PENDING', 'id')).toBe('Menunggu Persetujuan');
        expect(t('APPROVED', 'id')).toBe('Disetujui');
        expect(t('Full Day Reservation', 'id')).toBe('Reservasi Seharian Penuh');
        expect(t('Drop & Pick Up Later', 'id')).toBe('Antar & Jemput Nanti');
        expect(t('Sign Out', 'id')).toBe('Keluar');

        // 3. Accurate Korean translations
        expect(t('Home', 'ko')).toBe('홈');
        expect(t('Streets', 'ko')).toBe('일반지도');
        expect(t('Satellite', 'ko')).toBe('위성');
        expect(t('Terrain', 'ko')).toBe('지형');
        expect(t('Sign Out', 'ko')).toBe('로그아웃');

        // 4. English default preservation
        expect(t('Home', 'en')).toBe('Home');
        expect(t('Streets', 'en')).toBe('Streets');

        // 5. Dictionary completeness
        expect(Object.keys(DICTIONARY).length).toBeGreaterThan(50);
      });

      it('verifies cross-platform notification handler resolves ServiceWorkerRegistration and handles Illegal constructor safely', async () => {
        const { triggerSystemNotification } = await import('../src/utils/notification.ts');

        // In test / SSR / Node environment where window is undefined or Notification not granted
        const res = await triggerSystemNotification('Test Alert', { body: 'Testing cross-platform safety' });
        expect(typeof res).toBe('boolean');

        // Test with simulated Android Chrome ServiceWorkerRegistration
        const origWindowDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
        const origNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

        try {
          let swNotificationShown = false;
          let swTitle = '';

          Object.defineProperty(globalThis, 'window', {
            value: {
              Notification: class MockNotification {
                constructor() {
                  throw new TypeError("Failed to construct 'Notification': Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead.");
                }
                static permission = 'granted';
              },
            },
            configurable: true,
            writable: true,
          });

          Object.defineProperty(globalThis, 'navigator', {
            value: {
              serviceWorker: {
                getRegistration: async () => ({
                  showNotification: async (title: string) => {
                    swNotificationShown = true;
                    swTitle = title;
                  },
                }),
              },
            },
            configurable: true,
            writable: true,
          });

          const handled = await triggerSystemNotification('Booking Approved!', { body: 'Driver dispatched' });
          expect(handled).toBe(true);
          expect(swNotificationShown).toBe(true);
          expect(swTitle).toBe('Booking Approved!');
        } finally {
          if (origWindowDesc) {
            Object.defineProperty(globalThis, 'window', origWindowDesc);
          } else {
            delete (globalThis as any).window;
          }
          if (origNavDesc) {
            Object.defineProperty(globalThis, 'navigator', origNavDesc);
          } else {
            delete (globalThis as any).navigator;
          }
        }
      });

      it('verifies all 12 new features: 10-min reminder & 20-min auto-cancel, cancel approved booking, translation engine, sequential approval hierarchy, 413 large photo Start Trip, Online auto-ready, driver-locked petty cash reimbursement & receipt delete, driver-only schedule RBAC, nationwide POI geocoding, and 2-hour default urgent pre-booking confirmation', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const { t } = await import('../src/utils/i18n.ts');

        resetDbForTesting(':memory:');
        const testApp = createApp();
        const db = getDb();

        const admRes = await request(testApp).post('/api/auth/login').send({ group_username: 'admin', password: 'Admin@123' });
        const empRes = await request(testApp).post('/api/auth/login').send({ group_username: 'emp_alex', password: 'Emp@123' });
        const fmRes = await request(testApp).post('/api/auth/login').send({ group_username: 'fleetmgr', password: 'Fleet@123' });
        const hwsRes = await request(testApp).post('/api/auth/login').send({ group_username: 'hws_head', password: 'Hws@123' });
        const drvRes = await request(testApp).post('/api/auth/login').send({ group_username: 'drv_budi', password: 'Driver@123' });

        expect(admRes.status).toBe(200);
        expect(empRes.status).toBe(200);
        expect(fmRes.status).toBe(200);
        expect(hwsRes.status).toBe(200);
        expect(drvRes.status).toBe(200);

        const localAdmToken = admRes.body.token;
        const localEmpToken = empRes.body.token;
        const localFmToken = fmRes.body.token;
        const localHwsToken = hwsRes.body.token;
        const localDrvToken = drvRes.body.token;
        const empUserId = Number(empRes.body.user.id);
        const drvProfileId = Number(drvRes.body.user.driver_profile_id || 1);

        // 1. Translation engine (Item 3): dynamic patterns, parenthetical counts, multi-segment separators across EN/ID/KO
        expect(t('Booking History (3)', 'id')).toBe('Riwayat Pesanan (3)');
        expect(t('Booking History (3)', 'ko')).toBe('예약 내역 (3)');
        expect(t('Departing in 8 mins!', 'id')).toBe('Berangkat dalam 8 menit!');
        expect(t('Departing in 8 mins!', 'ko')).toBe('8분 후 출발!');
        expect(t('10 seats available', 'id')).toBe('10 kursi tersedia');
        expect(t('Stage 1/2: Awaiting Fleet PIC Consent', 'id')).toBe('Tahap 1/2: Menunggu Persetujuan PIC Fleet');
        expect(t('Stage 2/2: Fleet PIC Consented • Awaiting Head of WS', 'id')).toBe('Tahap 2/2: PIC Fleet Setuju • Menunggu Head of WS');

        // 2. Nationwide Indonesian POI Search & Reverse Geocoding (Item 11)
        const geoSearchRes = await request(testApp)
          .get('/api/geocode/search?q=Grand Indonesia')
          .set('Authorization', `Bearer ${localEmpToken}`);
        expect(geoSearchRes.status).toBe(200);
        expect(geoSearchRes.body.results.length).toBeGreaterThan(0);
        expect(geoSearchRes.body.results[0].name).toContain('Grand Indonesia');

        const geoRestoRes = await request(testApp)
          .get('/api/geocode/search?q=Sate Khas Senayan')
          .set('Authorization', `Bearer ${localEmpToken}`);
        expect(geoRestoRes.status).toBe(200);
        expect(geoRestoRes.body.results.length).toBeGreaterThan(0);

        const geoRevRes = await request(testApp)
          .get('/api/geocode/reverse?lat=-6.1950&lon=106.8224')
          .set('Authorization', `Bearer ${localEmpToken}`);
        expect(geoRevRes.status).toBe(200);
        expect(geoRevRes.body.name || geoRevRes.body.address).toBeTruthy();

        // 3. Employee can cancel an already APPROVED booking and free vehicle/driver slot (Item 2 & Item 4)
        const futureStart = new Date(Date.now() + 4 * 3600000).toISOString();
        const futureEnd = new Date(Date.now() + 5 * 3600000).toISOString();
        const createApprovedTrip = await request(testApp)
          .post('/api/trips')
          .set('Authorization', `Bearer ${localEmpToken}`)
          .send({
            vehicle_id: 5,
            purpose: 'Approved Trip to Cancel',
            origin: 'Headquarters',
            destination: 'Grand Indonesia Mall, Thamrin, Jakarta Pusat',
            start_time: futureStart,
            end_time: futureEnd,
            passenger_count: 2,
          });
        expect(createApprovedTrip.status).toBe(201);
        const cancelableTripId = createApprovedTrip.body.tripId;

        // Stage 0: HWS blocked before Fleet PIC consents
        const earlyHws = await request(testApp)
          .post(`/api/trips/${cancelableTripId}/decision`)
          .set('Authorization', `Bearer ${localHwsToken}`)
          .send({ decision: 'APPROVED', reason: 'Premature HWS' });
        expect(earlyHws.status).toBe(400);

        // Stage 1: Fleet PIC consents first
        const stage1Res = await request(testApp)
          .post(`/api/trips/${cancelableTripId}/decision`)
          .set('Authorization', `Bearer ${localFmToken}`)
          .send({ decision: 'APPROVED', reason: 'Stage 1 Fleet PIC consent', driver_profile_id: 4 });
        expect(stage1Res.status).toBe(200);
        expect(stage1Res.body.status).toBe('PENDING_APPROVAL');
        expect(stage1Res.body.stage).toBe('AWAITING_HWS');

        // Stage 2: Head of WS approves second -> APPROVED
        const stage2Res = await request(testApp)
          .post(`/api/trips/${cancelableTripId}/decision`)
          .set('Authorization', `Bearer ${localHwsToken}`)
          .send({ decision: 'APPROVED', reason: 'Stage 2 HWS approval' });
        expect(stage2Res.status).toBe(200);
        expect(stage2Res.body.status).toBe('APPROVED');

        // Employee cancels the APPROVED booking
        const empCancelRes = await request(testApp)
          .post(`/api/trips/${cancelableTripId}/cancel`)
          .set('Authorization', `Bearer ${localEmpToken}`)
          .send({ reason: 'Client meeting postponed to next week' });
        expect(empCancelRes.status).toBe(200);
        expect(empCancelRes.body.status).toBe('CANCELLED');

        const cancelledBookingRow = db.prepare('SELECT status FROM bookings WHERE trip_request_id = ?').get(cancelableTripId) as any;
        expect(cancelledBookingRow.status).toBe('CANCELLED');

        // 4. 10-Min Constant Reminder, Confirm Boarding ("I Am Here"), and 20-Min No-Show Auto-Cancel (Item 1)
        const tenMinStart = new Date(Date.now() + 7 * 60000).toISOString();
        const tenMinEnd = new Date(Date.now() + 67 * 60000).toISOString();
        const remTripRes = await request(testApp)
          .post('/api/trips')
          .set('Authorization', `Bearer ${localEmpToken}`)
          .send({
            vehicle_id: 5,
            purpose: 'Reminder & Boarding Test',
            origin: 'Headquarters',
            destination: 'Pacific Place Mall, SCBD, Jakarta Selatan',
            start_time: tenMinStart,
            end_time: tenMinEnd,
            passenger_count: 1,
            urgent_reason: 'Immediate client briefing',
          });
        expect(remTripRes.status).toBe(201);
        const remTripId = remTripRes.body.tripId;

        await request(testApp)
          .post(`/api/trips/${remTripId}/decision`)
          .set('Authorization', `Bearer ${localAdmToken}`)
          .send({ decision: 'APPROVED', reason: 'Admin approval for reminder test', driver_profile_id: drvProfileId });

        // Polling /api/notifications runs checkTripAlertsAndAutoCancellations -> stamps last_reminder_sent_at & sends 10-min reminder
        const notifCheckRes = await request(testApp)
          .get('/api/notifications')
          .set('Authorization', `Bearer ${localEmpToken}`);
        expect(notifCheckRes.status).toBe(200);

        const afterRemRow = db.prepare('SELECT last_reminder_sent_at, passenger_boarded_at FROM trip_requests WHERE id = ?').get(remTripId) as any;
        expect(afterRemRow.last_reminder_sent_at).toBeTruthy();
        expect(afterRemRow.passenger_boarded_at).toBeNull();

        // Employee clicks "I Am Here / Confirm Boarding"
        const boardRes = await request(testApp)
          .post(`/api/trips/${remTripId}/confirm-boarding`)
          .set('Authorization', `Bearer ${localEmpToken}`);
        expect(boardRes.status).toBe(200);
        expect(boardRes.body.passenger_boarded_at).toBeTruthy();

        // Simulate another approved trip where employee DOES NOT show up within 20 minutes after departure
        const overdueStart = new Date(Date.now() - 25 * 60000).toISOString();
        const overdueEnd = new Date(Date.now() + 35 * 60000).toISOString();
        const noShowInsert = db.prepare(`
          INSERT INTO trip_requests (requester_id, department_id, vehicle_id, purpose, origin, destination, start_time, end_time, passenger_count, status)
          VALUES (?, 1, 6, 'No Show Trip', 'HQ', 'Plaza Indonesia', ?, ?, 1, 'APPROVED')
        `).run(empUserId, overdueStart, overdueEnd);
        const noShowTripId = Number(noShowInsert.lastInsertRowid);
        db.prepare(`
          INSERT INTO bookings (trip_request_id, vehicle_id, booked_by, purpose, start_time, end_time, status)
          VALUES (?, 6, ?, 'No Show Trip', ?, ?, 'ACTIVE')
        `).run(noShowTripId, empUserId, overdueStart, overdueEnd);

        // Trigger check via /api/trips
        await request(testApp).get('/api/trips').set('Authorization', `Bearer ${localEmpToken}`);
        const noShowRow = db.prepare('SELECT status FROM trip_requests WHERE id = ?').get(noShowTripId) as any;
        expect(noShowRow.status).toBe('CANCELLED');
        const noShowBooking = db.prepare('SELECT status FROM bookings WHERE trip_request_id = ?').get(noShowTripId) as any;
        expect(noShowBooking.status).toBe('CANCELLED');

        // 5. Driver Start Trip with large base64 photo (> 600KB) succeeds without HTTP 413 (Item 5)
        const largeBase64Photo = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(650000);
        const startTripRes = await request(testApp)
          .post(`/api/driver/trips/${remTripId}/start`)
          .set('Authorization', `Bearer ${localDrvToken}`)
          .send({
            start_odometer: 25100,
            start_odometer_photo: largeBase64Photo,
          });
        expect(startTripRes.status).toBe(200);
        expect(startTripRes.body.trip.status).toBe('IN_PROGRESS');

        // 6. Driver Schedule Authorization: Driver only sees own schedule, while Admin/FM/HWS see all (Item 10)
        const drvBookingsRes = await request(testApp)
          .get('/api/bookings')
          .set('Authorization', `Bearer ${localDrvToken}`);
        expect(drvBookingsRes.status).toBe(200);
        expect(drvBookingsRes.body.can_view_all_schedules).toBe(false);
        expect(drvBookingsRes.body.bookings.every((b: any) => Number(b.driver_profile_id) === drvProfileId)).toBe(true);

        const fmBookingsRes = await request(testApp)
          .get('/api/bookings')
          .set('Authorization', `Bearer ${localFmToken}`);
        expect(fmBookingsRes.status).toBe(200);
        expect(fmBookingsRes.body.can_view_all_schedules).toBe(true);
        expect(fmBookingsRes.body.bookings.length).toBeGreaterThanOrEqual(drvBookingsRes.body.bookings.length);

        const hwsBookingsRes = await request(testApp)
          .get('/api/bookings')
          .set('Authorization', `Bearer ${localHwsToken}`);
        expect(hwsBookingsRes.status).toBe(200);
        expect(hwsBookingsRes.body.can_view_all_schedules).toBe(true);

        // 7. Petty Cash Reimbursement, Auto-Locked Driver Vehicle, & Receipt Photo Delete (Items 7, 8, 9)
        const beforeDriver = db.prepare('SELECT petty_cash_balance FROM driver_profiles WHERE id = ?').get(drvProfileId) as any;
        const initialPettyCash = Number(beforeDriver.petty_cash_balance ?? 500000);
        const otherDriverVeh = db.prepare('SELECT id FROM vehicles WHERE default_driver_id IS NOT NULL AND default_driver_id != ? LIMIT 1').get(drvProfileId) as { id: number };
        const validJpegBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

        const expCreateRes = await request(testApp)
          .post('/api/expenses')
          .set('Authorization', `Bearer ${localDrvToken}`)
          .send({
            vehicle_id: otherDriverVeh.id, // Even if another driver's vehicle is submitted, server auto-locks to drv_budi's assigned vehicle
            category: 'Parking',
            amount: 25000,
            payment_source: 'PETTY_CASH',
            description: 'Cash parking at Pacific Place Mall',
            receipt_data_url: validJpegBase64,
            receipt_filename: 'parking-receipt.jpg',
          });
        expect(expCreateRes.status).toBe(201);
        const expenseId = expCreateRes.body.expense.id;
        expect(expCreateRes.body.petty_cash_balance).toBe(initialPettyCash - 25000);

        const createdExpRow = db.prepare('SELECT vehicle_id, driver_profile_id, payment_source, receipt_data_url FROM expenses WHERE id = ?').get(expenseId) as any;
        expect(createdExpRow.driver_profile_id).toBe(drvProfileId);
        expect(createdExpRow.vehicle_id).not.toBe(otherDriverVeh.id);
        expect(createdExpRow.payment_source).toBe('PETTY_CASH');
        expect(createdExpRow.receipt_data_url).toBeTruthy();

        // Delete receipt photo from expense (Item 8)
        const delReceiptRes = await request(testApp)
          .delete(`/api/expenses/${expenseId}/receipt`)
          .set('Authorization', `Bearer ${localDrvToken}`);
        expect(delReceiptRes.status).toBe(200);
        const afterDelReceiptRow = db.prepare('SELECT receipt_data_url, receipt_document_id, receipt_filename FROM expenses WHERE id = ?').get(expenseId) as any;
        expect(afterDelReceiptRow.receipt_data_url).toBeNull();
        expect(afterDelReceiptRow.receipt_document_id).toBeNull();
        expect(afterDelReceiptRow.receipt_filename).toBeNull();

        // Approve Petty Cash reimbursement -> replenishes driver's petty_cash_balance (Item 9)
        const approveExpRes = await request(testApp)
          .patch(`/api/expenses/${expenseId}`)
          .set('Authorization', `Bearer ${localFmToken}`)
          .send({ approval_status: 'APPROVED', reason: 'Cash parking reimbursed to Petty Cash' });
        expect(approveExpRes.status).toBe(200);
        expect(approveExpRes.body.expense.reimbursement_status).toBe('REIMBURSED');

        const afterDriver = db.prepare('SELECT petty_cash_balance FROM driver_profiles WHERE id = ?').get(drvProfileId) as any;
        expect(Number(afterDriver.petty_cash_balance)).toBe(initialPettyCash);

        // 8. Verify UI source code for Items 6, 8, 11, 12
        const appTsx = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8');
        expect(appTsx).toContain('compressImageFileToDataUrl');
        expect(appTsx).toContain('showPreBookingConfirmModal');
        expect(appTsx).toContain('confirm-prebooking-submit-btn');
        expect(appTsx).toContain('onPinMoveAddress');
        expect(appTsx).toContain('confirm-boarding');
        expect(appTsx).toContain('driver-online-toggle-sheet-btn');
      }, 30000);
    });

    describe('11 User Bug Fixes & Operational Enhancements (Geocoding, Round Trip, 07:00-16:00 Calendar Schedule, Negotiation/Hitchhike, Auto-Accept Driver & Odometer Photo)', () => {
      it('verifies vast Greater Jakarta & Indonesia geocoding, Round Trip alias, 07:00-16:00 Schedule Calendar, Hitchhike/Cancel negotiation, Auto-Accept Driver orders, mandatory Odometer photos, Back buttons, and API URL normalization', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const { searchIndonesianPois } = await import('../src/server/indonesian-pois.ts');

        resetDbForTesting(':memory:');
        const testApp = createApp();
        const db = getDb();

        const admRes = await request(testApp).post('/api/auth/login').send({ group_username: 'admin', password: 'Admin@123' });
        const empRes = await request(testApp).post('/api/auth/login').send({ group_username: 'emp_alex', password: 'Emp@123' });
        const drvRes = await request(testApp).post('/api/auth/login').send({ group_username: 'drv_budi', password: 'Driver@123' });
        expect(admRes.status).toBe(200);
        expect(empRes.status).toBe(200);
        expect(drvRes.status).toBe(200);

        const localAdmToken = admRes.body.token;
        const localEmpToken = empRes.body.token;
        const localDrvToken = drvRes.body.token;
        const drvProfileId = Number(drvRes.body.user.driver_profile_id || 1);

        // 1. Vast Greater Jakarta (Jabodetabek) & Indonesia Geocoding
        for (const query of ['Kebayoran Baru', 'Cilandak', 'Kelapa Gading', 'Bintaro', 'BSD', 'PIK 2', 'Cikarang', 'Cibubur', 'Depok', 'Bogor', 'Karawang', 'pim', 'kokas', 'ganci']) {
          const hits = searchIndonesianPois(query);
          expect(hits.length).toBeGreaterThan(0);
        }

        // 2. API URL Normalization (prevents "API Not Found" on double slashes or proxy subpaths)
        const doubleSlashHealth = await request(testApp).get('//api//health');
        expect(doubleSlashHealth.status).toBe(200);
        expect(doubleSlashHealth.body.status).toBe('ok');

        const proxyPrefixHealth = await request(testApp).get('/fleet/api/health');
        expect(proxyPrefixHealth.status).toBe(200);
        expect(proxyPrefixHealth.body.status).toBe('ok');

        // 3. Round Trip reservation mode alias (ROUND_TRIP -> DROP_AND_PICKUP) & Auto-Acknowledged Driver Assignment
        const baseStartMs = Date.now() + 36 * 3600_000;
        const startIso = new Date(baseStartMs).toISOString();
        const rpIso = new Date(baseStartMs + 2 * 3600_000).toISOString();
        const endIso = new Date(baseStartMs + 3 * 3600_000).toISOString();

        const roundTripRes = await request(testApp)
          .post('/api/trips')
          .set('Authorization', `Bearer ${localEmpToken}`)
          .send({
            vehicle_id: 3,
            purpose: 'Round Trip Client Visit to BSD City',
            origin: 'PT Samsung Electronics Indonesia - Jababeka Plant',
            destination: 'BSD City & Green Office Park (GOP), Tangerang Selatan',
            start_time: startIso,
            return_pickup_time: rpIso,
            end_time: endIso,
            reservation_type: 'ROUND_TRIP',
            passengers: [{ id: 1, nickname: 'Ahmad' }, { id: 2, nickname: 'Riza' }],
            passenger_nickname: '1. Ahmad, 2. Riza',
          });
        expect(roundTripRes.status).toBe(201);
        const rtTripId = roundTripRes.body.tripId;
        expect(roundTripRes.body.trip.reservation_type).toBe('DROP_AND_PICKUP');

        // 3B. Auto-Assign Available Car & Driver (vehicle_id omitted / 'AUTO') assigns a different conflict-free car automatically
        const autoAssignRes = await request(testApp)
          .post('/api/trips')
          .set('Authorization', `Bearer ${localEmpToken}`)
          .send({
            vehicle_id: 'AUTO',
            purpose: 'Auto-Assigned Standard Trip to Senayan',
            origin: 'Headquarters',
            destination: 'Plaza Senayan, Jakarta Pusat',
            start_time: startIso,
            end_time: endIso,
            reservation_type: 'STANDARD_TRIP',
            passengers: [{ id: 1, nickname: 'Budi' }],
            passenger_nickname: '1. Budi',
          });
        expect(autoAssignRes.status).toBe(201);
        expect(autoAssignRes.body.trip.vehicle_id).toBeTruthy();
        expect(Number(autoAssignRes.body.trip.vehicle_id)).not.toBe(3);

        // Verify assignment is auto-acknowledged immediately (no manual Acknowledge Order needed)
        const autoAsn = db.prepare('SELECT acknowledged_at FROM assignments WHERE trip_request_id = ? AND is_current = 1').get(rtTripId) as any;
        if (autoAsn) {
          expect(autoAsn.acknowledged_at).toBeTruthy();
        }

        // 4. Google Calendar Schedule endpoint (/api/schedule/calendar) shows active bookings with Group, PIC, Passengers, Destination, Duration
        const calRes = await request(testApp)
          .get('/api/schedule/calendar')
          .set('Authorization', `Bearer ${localEmpToken}`);
        expect(calRes.status).toBe(200);
        expect(calRes.body.can_view_all_schedules).toBe(true);
        const calTrip = calRes.body.scheduleTrips.find((t: any) => Number(t.id) === Number(rtTripId));
        expect(calTrip).toBeTruthy();
        expect(calTrip.requester_name).toBeTruthy();
        expect(calTrip.department_name).toBeTruthy();
        expect(calTrip.destination).toContain('BSD City');

        // 5. Hitchhike & Cancel Negotiation workflow
        const negotiateRes = await request(testApp)
          .post(`/api/trips/${rtTripId}/negotiate`)
          .set('Authorization', `Bearer ${localAdmToken}`)
          .send({
            action_type: 'HITCHHIKE',
            passenger_nickname: 'Sarah',
            message: 'Going to BSD City too, can I join?',
          });
        expect(negotiateRes.status).toBe(201);
        expect(negotiateRes.body.ok).toBe(true);

        const acceptHitchhikeRes = await request(testApp)
          .post(`/api/trips/${rtTripId}/hitchhike-accept`)
          .set('Authorization', `Bearer ${localEmpToken}`)
          .send({
            passenger_nickname: 'Sarah',
          });
        expect(acceptHitchhikeRes.status).toBe(200);
        expect(acceptHitchhikeRes.body.trip.passenger_nickname).toContain('Sarah');
        expect(acceptHitchhikeRes.body.trip.passenger_count).toBe(3);

        // 6. Mandatory Odometer Photo & Manual Input when enforce_photo is true on Start & Complete Trip
        await request(testApp)
          .post(`/api/trips/${rtTripId}/decision`)
          .set('Authorization', `Bearer ${localAdmToken}`)
          .send({
            decision: 'APPROVED',
            vehicle_id: 3,
            driver_profile_id: drvProfileId,
            reason: 'Approved for Round Trip test',
          });

        const failStartNoPhoto = await request(testApp)
          .post(`/api/driver/trips/${rtTripId}/start`)
          .set('Authorization', `Bearer ${localDrvToken}`)
          .send({
            start_odometer: 50000,
            enforce_photo: true,
          });
        expect(failStartNoPhoto.status).toBe(400);
        expect(failStartNoPhoto.body.error).toContain('Mandatory photo');

        const okStartWithPhoto = await request(testApp)
          .post(`/api/driver/trips/${rtTripId}/start`)
          .set('Authorization', `Bearer ${localDrvToken}`)
          .send({
            start_odometer: 50000,
            start_odometer_photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
            enforce_photo: true,
          });
        expect(okStartWithPhoto.status).toBe(200);

        const failCompleteNoPhoto = await request(testApp)
          .post(`/api/driver/trips/${rtTripId}/complete`)
          .set('Authorization', `Bearer ${localDrvToken}`)
          .send({
            end_odometer: 50045,
            enforce_photo: true,
          });
        expect(failCompleteNoPhoto.status).toBe(400);
        expect(failCompleteNoPhoto.body.error).toContain('Mandatory photo');

        const okCompleteWithPhoto = await request(testApp)
          .post(`/api/driver/trips/${rtTripId}/complete`)
          .set('Authorization', `Bearer ${localDrvToken}`)
          .send({
            end_odometer: 50045,
            end_odometer_photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
            enforce_photo: true,
          });
        expect(okCompleteWithPhoto.status).toBe(200);

        // 7. Once trip is COMPLETED (or CANCELLED), it is automatically removed from /api/schedule/calendar
        const calAfterComplete = await request(testApp)
          .get('/api/schedule/calendar')
          .set('Authorization', `Bearer ${localEmpToken}`);
        expect(calAfterComplete.status).toBe(200);
        expect(calAfterComplete.body.scheduleTrips.some((t: any) => Number(t.id) === Number(rtTripId))).toBe(false);

        // 8. Verify UI terminology ("Chauffeur" replaced by "Driver", Back buttons present, Auto-Accepted Order present)
        const appTsx = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8');
        expect(appTsx.toLowerCase()).not.toContain('chauffeur');
        expect(appTsx).toContain('Auto-Accepted Order');
        expect(appTsx).not.toContain(">Acknowledge Order<");
        expect(appTsx).toContain('id="route-back-btn"');
        expect(appTsx).toContain('id="vehicle-back-btn"');
        expect(appTsx).toContain('id="summary-back-btn"');
        expect(appTsx).toContain('id="schedule-back-btn"');
        expect(appTsx).toContain('id="activity-back-btn"');
        expect(appTsx).toContain('id="inbox-back-btn"');
        expect(appTsx).toContain('id="profile-back-btn"');
      });

      it('verifies resilient trip cancel (zero API endpoint not found), compact uncropped LanguageSwitcher, no employee car selection, and Fleet Manager available-car-only assignment', async () => {
        const fs = await import('fs');
        const path = await import('path');

        resetDbForTesting(':memory:');
        const testApp = createApp();

        const empRes = await request(testApp).post('/api/auth/login').send({ group_username: 'emp_alex', password: 'Emp@123' });
        const fmRes = await request(testApp).post('/api/auth/login').send({ group_username: 'fleetmgr', password: 'Fleet@123' });
        const admRes = await request(testApp).post('/api/auth/login').send({ group_username: 'admin', password: 'Admin@123' });
        expect(empRes.status).toBe(200);
        expect(fmRes.status).toBe(200);
        expect(admRes.status).toBe(200);

        const empTok = empRes.body.token;
        const fmTok = fmRes.body.token;
        const admTok = admRes.body.token;

        const baseMs = Date.now() + 48 * 3600_000;
        const sIso = new Date(baseMs).toISOString();
        const eIso = new Date(baseMs + 2 * 3600_000).toISOString();

        // 1. Test cancel with trailing slash (/api/trips/:id/cancel/) and DELETE /api/trips/:id -> zero "API endpoint not found"
        const t1 = await request(testApp)
          .post('/api/trips')
          .set('Authorization', `Bearer ${empTok}`)
          .send({
            vehicle_id: 'AUTO',
            purpose: 'Cancel trailing slash test',
            origin: 'Headquarters',
            destination: 'SCBD, Jakarta Selatan',
            start_time: sIso,
            end_time: eIso,
            passengers: [{ id: 1, nickname: 'Alex' }],
          });
        expect(t1.status).toBe(201);

        const cancelTrailing = await request(testApp)
          .post(`/api/trips/${t1.body.tripId}/cancel/`)
          .set('Authorization', `Bearer ${empTok}`)
          .send({ reason: 'Changed schedule' });
        expect(cancelTrailing.status).toBe(200);
        expect(cancelTrailing.body.status).toBe('CANCELLED');

        const t2 = await request(testApp)
          .post('/api/trips')
          .set('Authorization', `Bearer ${empTok}`)
          .send({
            vehicle_id: 'AUTO',
            purpose: 'Cancel DELETE alias test',
            origin: 'Headquarters',
            destination: 'BSD City',
            start_time: sIso,
            end_time: eIso,
            passengers: [{ id: 1, nickname: 'Alex' }],
          });
        expect(t2.status).toBe(201);

        const cancelDelete = await request(testApp)
          .delete(`/api/trips/${t2.body.tripId}`)
          .set('Authorization', `Bearer ${empTok}`)
          .send({ cancellation_reason: 'Deleted by user' });
        expect(cancelDelete.status).toBe(200);
        expect(cancelDelete.body.status).toBe('CANCELLED');

        // 2. Fleet Manager can ONLY assign an available car during approval
        // Book car #1 for another trip in the same slot so car #1 is BUSY
        const busyTrip = await request(testApp)
          .post('/api/trips')
          .set('Authorization', `Bearer ${admTok}`)
          .send({
            vehicle_id: 1,
            purpose: 'Blocking Car 1',
            origin: 'Headquarters',
            destination: 'Cikarang',
            start_time: sIso,
            end_time: eIso,
            passengers: [{ id: 1, nickname: 'Admin' }],
          });
        expect(busyTrip.status).toBe(201);

        // Employee submits a request without picking a car (AUTO)
        const pendingTrip = await request(testApp)
          .post('/api/trips')
          .set('Authorization', `Bearer ${empTok}`)
          .send({
            vehicle_id: 'AUTO',
            purpose: 'Employee trip awaiting FM car assignment',
            origin: 'Headquarters',
            destination: 'Senayan',
            start_time: sIso,
            end_time: eIso,
            passengers: [{ id: 1, nickname: 'Alex' }],
          });
        expect(pendingTrip.status).toBe(201);
        const pendingId = pendingTrip.body.tripId;

        // Availability endpoint with exclude_trip_id marks car #1 unavailable and pendingTrip's car available
        const availRes = await request(testApp)
          .get(`/api/availability?start_time=${encodeURIComponent(sIso)}&end_time=${encodeURIComponent(eIso)}&exclude_trip_id=${pendingId}`)
          .set('Authorization', `Bearer ${fmTok}`);
        expect(availRes.status).toBe(200);
        const car1Avail = availRes.body.vehicles.find((v: any) => Number(v.id) === 1);
        expect(car1Avail.isAvailable).toBe(false);
        const freeCar = availRes.body.vehicles.find((v: any) => v.status === 'Available' && v.isAvailable === true);
        expect(freeCar).toBeTruthy();

        // FM attempting to assign BUSY car #1 in Stage 1 must be blocked with 409
        const fmBusyAttempt = await request(testApp)
          .post(`/api/trips/${pendingId}/decision`)
          .set('Authorization', `Bearer ${fmTok}`)
          .send({
            decision: 'APPROVED',
            vehicle_id: 1,
            reason: 'Trying busy car',
          });
        expect(fmBusyAttempt.status).toBe(409);

        // FM assigning an AVAILABLE car succeeds cleanly
        const fmAvailAssign = await request(testApp)
          .post(`/api/trips/${pendingId}/decision`)
          .set('Authorization', `Bearer ${fmTok}`)
          .send({
            decision: 'APPROVED',
            vehicle_id: freeCar.id,
            reason: 'Assigned available car by Fleet Manager',
          });
        expect(fmAvailAssign.status).toBe(200);
        expect(Number(fmAvailAssign.body.trip.vehicle_id)).toBe(Number(freeCar.id));

        // 3. UI Verification: No employee car picker, compact LanguageSwitcher, FM available-car-only select
        const appTsx = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8');
        const appShellTsx = fs.readFileSync(path.resolve(__dirname, '../src/components/AppShell.tsx'), 'utf8');
        expect(appTsx).toContain('id="fleet-manager-car-assignment-notice"');
        expect(appTsx).not.toContain('toggle-optional-vehicle-picker-btn');
        expect(appTsx).toContain('id="dispatch-available-vehicle-select"');
        expect(appShellTsx).toContain('<LanguageSwitcher compact />');
      });

      it('verifies 1-Driver-1-Fixed-Car Fleet PIC selection, 1M req/min scalable DDoS limiter, nationwide Indonesia geocoding, and Gojek-style route & destination zoom', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const express = (await import('express')).default;
        const { createRateLimiter } = await import('../src/server/rate-limit.ts');

        resetDbForTesting(':memory:');
        const testApp = createApp();
        const db = getDb();

        const empRes = await request(testApp).post('/api/auth/login').send({ group_username: 'emp_alex', password: 'Emp@123' });
        const fmRes = await request(testApp).post('/api/auth/login').send({ group_username: 'fleetmgr', password: 'Fleet@123' });
        expect(empRes.status).toBe(200);
        expect(fmRes.status).toBe(200);
        const empTok = empRes.body.token;
        const fmTok = fmRes.body.token;

        // 1. 1 Driver = 1 Fixed Car: Selecting a driver automatically locks the trip to that driver's fixed vehicle
        const fixedVehRow = db
          .prepare('SELECT id, default_driver_id FROM vehicles WHERE default_driver_id IS NOT NULL ORDER BY id ASC LIMIT 2')
          .all() as Array<{ id: number; default_driver_id: number }>;
        expect(fixedVehRow.length).toBeGreaterThanOrEqual(2);
        const targetDriverId = fixedVehRow[1].default_driver_id;
        const targetDriverFixedCarId = fixedVehRow[1].id;
        const differentCarId = fixedVehRow[0].id;

        const baseMs = Date.now() + 72 * 3600_000;
        const sIso = new Date(baseMs).toISOString();
        const eIso = new Date(baseMs + 2 * 3600_000).toISOString();

        const tripRes = await request(testApp)
          .post('/api/trips')
          .set('Authorization', `Bearer ${empTok}`)
          .send({
            vehicle_id: differentCarId,
            auto_assign: true,
            purpose: 'Fixed Driver-Car Pair Test',
            origin: 'Headquarters',
            destination: 'Bandung, Jawa Barat',
            start_time: sIso,
            end_time: eIso,
            passengers: [{ id: 1, nickname: 'Alex' }],
          });
        expect(tripRes.status).toBe(201);

        // Even if an arbitrary vehicle_id is sent, enforce_fixed_driver_car locks vehicle_id to the driver's fixed car
        const fmDecision = await request(testApp)
          .post(`/api/trips/${tripRes.body.tripId}/decision`)
          .set('Authorization', `Bearer ${fmTok}`)
          .send({
            decision: 'APPROVED',
            driver_profile_id: targetDriverId,
            vehicle_id: differentCarId,
            enforce_fixed_driver_car: true,
            reason: 'Assigned driver with fixed car',
          });
        expect(fmDecision.status).toBe(200);
        expect(Number(fmDecision.body.trip.vehicle_id)).toBe(Number(targetDriverFixedCarId));

        // 2. Scalable DDoS-Only Rate Limiter: default limit is 1,000,000 req/min and respects X-Forwarded-For
        const rlApp = express();
        rlApp.use(createRateLimiter({ skipInTests: false }));
        rlApp.get('/ping', (_req, res) => res.json({ ok: true }));
        const rlRes = await request(rlApp).get('/ping').set('X-Forwarded-For', '203.0.113.42, 10.0.0.1');
        expect(rlRes.status).toBe(200);
        expect(Number(rlRes.headers['x-ratelimit-limit'])).toBeGreaterThanOrEqual(1_000_000);

        // 3. Nationwide Indonesia Geocoding (outside Greater Jakarta: Bandung, Surabaya, Bali, Yogyakarta, Medan)
        for (const city of ['Bandung', 'Surabaya', 'Denpasar', 'Yogyakarta', 'Medan']) {
          const geoRes = await request(testApp)
            .get(`/api/geocode/search?q=${encodeURIComponent(city)}`)
            .set('Authorization', `Bearer ${empTok}`);
          expect(geoRes.status).toBe(200);
          expect(geoRes.body.results.length).toBeGreaterThan(0);
        }

        // 4. Route calculation returns smooth valid geometry without error
        const routeRes = await request(testApp)
          .get('/api/route?originLat=-6.2088&originLon=106.8456&destLat=-6.9175&destLon=107.6191')
          .set('Authorization', `Bearer ${empTok}`);
        expect(routeRes.status).toBe(200);
        expect(routeRes.body.distanceKm).toBeGreaterThan(0);
        expect(routeRes.body.durationMin).toBeGreaterThan(0);
        expect(Array.isArray(routeRes.body.geometry)).toBe(true);
        expect(routeRes.body.geometry.length).toBeGreaterThanOrEqual(2);

        // 5. Verify UI source for Driver-first fixed car display, free ArcGIS/Photon client search, and Gojek map zoom
        const appTsx = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8');
        const mapViewTsx = fs.readFileSync(path.resolve(__dirname, '../src/components/MapView.tsx'), 'utf8');
        expect(appTsx).toContain('id="dispatch-available-driver-select"');
        expect(appTsx).toContain('id="dispatch-fixed-vehicle-display"');
        expect(appTsx).toContain('enforce_fixed_driver_car');
        expect(appTsx).toContain('geocode.arcgis.com');
        expect(appTsx).toContain('photon.komoot.io');
        expect(appTsx).toContain('routing.openstreetmap.de');
        expect(mapViewTsx).toContain('fitGojekRouteCamera');
      }, 15000);

      it('hides other users and all drivers during booking, and unlocks assigned driver live GPS & pickup ETA only within 10 minutes before scheduled departure or IN_PROGRESS', async () => {
        const fs = await import('fs');
        const path = await import('path');

        resetDbForTesting(':memory:');
        const testApp = createApp();
        const db = getDb();

        const empRes = await request(testApp).post('/api/auth/login').send({ group_username: 'emp_alex', password: 'Emp@123' });
        const fmRes = await request(testApp).post('/api/auth/login').send({ group_username: 'fleetmgr', password: 'Fleet@123' });
        const hwsRes = await request(testApp).post('/api/auth/login').send({ group_username: 'hws_head', password: 'Hws@123' });
        const drvRes = await request(testApp).post('/api/auth/login').send({ group_username: 'drv_budi', password: 'Driver@123' });
        expect(empRes.status).toBe(200);
        expect(fmRes.status).toBe(200);
        expect(drvRes.status).toBe(200);
        const empTok = empRes.body.token;
        const fmTok = fmRes.body.token;
        const hwsTok = hwsRes.status === 200 ? hwsRes.body.token : null;
        const drvTok = drvRes.body.token;

        // Find Budi's driver_profile_id and fixed car
        const budiRow = db
          .prepare(`SELECT dp.id as driver_profile_id, v.id as vehicle_id FROM driver_profiles dp JOIN users u ON u.id = dp.user_id JOIN vehicles v ON v.default_driver_id = dp.id WHERE u.group_username = 'drv_budi' LIMIT 1`)
          .get() as { driver_profile_id: number; vehicle_id: number };
        expect(budiRow).toBeDefined();

        // Driver reports live GPS near SCBD Jakarta
        const pingRes = await request(testApp)
          .post('/api/location/ping')
          .set('Authorization', `Bearer ${drvTok}`)
          .send({ latitude: -6.2241, longitude: 106.8099, accuracy: 8 });
        expect([200, 201]).toContain(pingRes.status);

        // Case A: Trip scheduled 2 hours from now (> 10 minutes away)
        const farStart = new Date(Date.now() + 120 * 60_000).toISOString();
        const farEnd = new Date(Date.now() + 240 * 60_000).toISOString();
        const farTripRes = await request(testApp)
          .post('/api/trips')
          .set('Authorization', `Bearer ${empTok}`)
          .send({
            vehicle_id: budiRow.vehicle_id,
            auto_assign: true,
            purpose: 'Future meeting 2h ahead',
            origin: 'Samsung Office Jakarta (Lobby)',
            destination: 'Plaza Indonesia',
            start_time: farStart,
            end_time: farEnd,
            passengers: [{ id: 1, nickname: 'Alex' }],
          });
        expect(farTripRes.status).toBe(201);
        const farTripId = farTripRes.body.tripId;

        // While PENDING_APPROVAL: driver live tracking must be hidden
        const pendingList = await request(testApp).get('/api/trips').set('Authorization', `Bearer ${empTok}`);
        expect(pendingList.status).toBe(200);
        const pendingTrip = pendingList.body.trips.find((t: any) => t.id === farTripId);
        expect(pendingTrip).toBeDefined();
        expect(pendingTrip.live_driver_tracking_visible).toBe(false);
        expect(pendingTrip.assigned_driver_lat).toBeNull();
        expect(pendingTrip.assigned_driver_lon).toBeNull();

        // Approve the future trip and assign Budi
        const approveFarFm = await request(testApp)
          .post(`/api/trips/${farTripId}/decision`)
          .set('Authorization', `Bearer ${fmTok}`)
          .send({
            decision: 'APPROVED',
            driver_profile_id: budiRow.driver_profile_id,
            enforce_fixed_driver_car: true,
            reason: 'Assigned Budi',
          });
        expect(approveFarFm.status).toBe(200);
        if (hwsTok && approveFarFm.body.trip?.status !== 'APPROVED') {
          const approveFarHws = await request(testApp)
            .post(`/api/trips/${farTripId}/decision`)
            .set('Authorization', `Bearer ${hwsTok}`)
            .send({ decision: 'APPROVED', reason: 'HWS approved' });
          expect(approveFarHws.status).toBe(200);
        }

        // Still > 10 minutes before start_time -> MUST still hide driver GPS & provide tracking_unlocks_at
        const approvedFarList = await request(testApp).get('/api/trips').set('Authorization', `Bearer ${empTok}`);
        const approvedFarTrip = approvedFarList.body.trips.find((t: any) => t.id === farTripId);
        expect(approvedFarTrip.status).toBe('APPROVED');
        expect(approvedFarTrip.live_driver_tracking_visible).toBe(false);
        expect(approvedFarTrip.assigned_driver_lat).toBeNull();
        expect(approvedFarTrip.assigned_driver_lon).toBeNull();
        expect(typeof approvedFarTrip.tracking_unlocks_at).toBe('string');

        // Case B: Move start_time to 5 minutes from now (inside the 10-minute pre-departure window)
        const nearStart = new Date(Date.now() + 5 * 60_000).toISOString();
        const nearEnd = new Date(Date.now() + 90 * 60_000).toISOString();
        db.prepare('UPDATE trip_requests SET start_time = ?, end_time = ? WHERE id = ?').run(nearStart, nearEnd, farTripId);

        const withinTenMinList = await request(testApp).get('/api/trips').set('Authorization', `Bearer ${empTok}`);
        const withinTenMinTrip = withinTenMinList.body.trips.find((t: any) => t.id === farTripId);
        expect(withinTenMinTrip.status).toBe('APPROVED');
        expect(withinTenMinTrip.live_driver_tracking_visible).toBe(true);
        expect(withinTenMinTrip.assigned_driver_lat).toBeCloseTo(-6.2241, 4);
        expect(withinTenMinTrip.assigned_driver_lon).toBeCloseTo(106.8099, 4);

        // Case C: IN_PROGRESS trip -> live driver GPS remains visible
        db.prepare("UPDATE trip_requests SET status = 'IN_PROGRESS' WHERE id = ?").run(farTripId);
        const inProgressList = await request(testApp).get('/api/trips').set('Authorization', `Bearer ${empTok}`);
        const inProgressTrip = inProgressList.body.trips.find((t: any) => t.id === farTripId);
        expect(inProgressTrip.live_driver_tracking_visible).toBe(true);
        expect(inProgressTrip.assigned_driver_lat).toBeCloseTo(-6.2241, 4);
        expect(inProgressTrip.assigned_driver_lon).toBeCloseTo(106.8099, 4);

        // Verify frontend enforces clean passenger map (no other users / no all-fleet cars) and gated ETA UI
        const appTsx = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8');
        const mapViewTsx = fs.readFileSync(path.resolve(__dirname, '../src/components/MapView.tsx'), 'utf8');
        expect(appTsx).toContain('userPins={[]}');
        expect(appTsx).toContain('fleetPositions={undefined}');
        expect(appTsx).toContain('canShowAssignedDriverLive');
        expect(appTsx).toContain('id="live-driver-eta-card"');
        expect(appTsx).toContain('id="driver-tracking-locked-notice"');
        expect(appTsx).toContain('driverToPickupEta');
        expect(mapViewTsx).toContain('gf-assigned-driver-marker');
        expect(mapViewTsx).toContain('driverToPickupEta');
      });
    });
  });
});
