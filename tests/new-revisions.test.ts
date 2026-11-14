import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.ts';
import { getDb, resetDbForTesting } from '../src/server/db.ts';

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

    it('generates a comprehensive multi-section executive report with all tables and IDR currency', async () => {
      const res = await request(app)
        .get('/api/reports/executive-pdf?format=html')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('GALAXYFLEET EXECUTIVE MANAGEMENT REPORT');
      expect(res.text).toContain('Vehicle Odometer & Mileage Audit Table');
      expect(res.text).toContain('Driver Working Hours & Performance Table');
      expect(res.text).toContain('Comprehensive Energy & Expense Ledger (IDR)');
      expect(res.text).toContain('Chronological Trip Manifest Log');
      expect(res.text).toContain('Indonesian Rupiah (IDR)');
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
      expect(finalDeptCount.c).toBe(12);
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
});




