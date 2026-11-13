import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.ts';
import { resetDbForTesting } from '../src/server/db.ts';

describe('Internal Company Fleet Management System — Full PRD & Revision Acceptance Suite', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    resetDbForTesting(':memory:');
    app = createApp();
  });

  async function loginAs(group_username: string, password: string) {
    const res = await request(app).post('/api/auth/login').send({ group_username, password });
    expect(res.status).toBe(200);
    return res.body.token as string;
  }

  // ==========================================================================
  // 1. AUTHENTICATION, REGISTRATION APPROVAL & RBAC (TC-AUTH-01..05, TC-REV-01)
  // ==========================================================================
  it('TC-AUTH-01: refuses unauthenticated access to protected business endpoints with 401 and no business data', async () => {
    const endpoints = ['/api/vehicles', '/api/departments', '/api/trips', '/api/bookings', '/api/drivers', '/api/analytics/usage', '/api/audit'];
    for (const ep of endpoints) {
      const res = await request(app).get(ep);
      expect(res.status).toBe(401);
      expect(res.body.vehicles).toBeUndefined();
      expect(res.body.trips).toBeUndefined();
    }
  });

  it('TC-REV-01: supports 4-field registration (nickname, dept, group_username, password) and blocks login until Administrator approves', async () => {
    // 1. Register with only nickname, department_id, group_username, password
    const regRes = await request(app).post('/api/auth/register').send({
      nickname: 'Riko',
      department_id: 3,
      group_username: 'eng_riko',
      password: 'Password123!',
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.approval_status).toBe('PENDING_APPROVAL');
    const newUserId = regRes.body.id;

    // 2. Attempt sign-in before Admin approval -> must be refused with 403
    const prematureLogin = await request(app).post('/api/auth/login').send({
      group_username: 'eng_riko',
      password: 'Password123!',
    });
    expect(prematureLogin.status).toBe(403);
    expect(prematureLogin.body.error).toMatch(/pending Administrator approval/i);

    // 3. Admin approves registration
    const adminToken = await loginAs('admin', 'Admin@123');
    const approveRes = await request(app)
      .patch(`/api/users/${newUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approval_status: 'APPROVED', role: 'EMP' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.user.approval_status).toBe('APPROVED');

    // 4. Now user can sign in
    const validLogin = await request(app).post('/api/auth/login').send({
      group_username: 'eng_riko',
      password: 'Password123!',
    });
    expect(validLogin.status).toBe(200);
    expect(validLogin.body.user.group_username).toBe('eng_riko');
  });

  it('TC-AUTH-02, TC-AUTH-03 & TC-AUTH-04: supports all 5 confirmed roles + Dept Admin, enforces server-side RBAC, and audits denied access', async () => {
    const adminToken = await loginAs('admin', 'Admin@123');
    const fmToken = await loginAs('fleetmgr', 'Fleet@123');
    const hwsToken = await loginAs('hws_head', 'Hws@123');
    const drvToken = await loginAs('drv_budi', 'Driver@123');
    const empToken = await loginAs('emp_alex', 'Emp@123');

    expect(adminToken).toBeTruthy();
    expect(fmToken).toBeTruthy();
    expect(hwsToken).toBeTruthy();
    expect(drvToken).toBeTruthy();
    expect(empToken).toBeTruthy();

    // Employee trying to access Admin user management -> 403
    const deniedUsers = await request(app).get('/api/users').set('Authorization', `Bearer ${empToken}`);
    expect(deniedUsers.status).toBe(403);

    // Employee trying to view GPS location history -> 403 (TC-GPS-13)
    const deniedGps = await request(app).get('/api/gps/history').set('Authorization', `Bearer ${empToken}`);
    expect(deniedGps.status).toBe(403);

    // Verify denial was audited (AUTH-08)
    const auditRes = await request(app).get('/api/audit').set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);
    const hasDenialAudit = auditRes.body.auditEvents.some((e: any) => e.action === 'PERMISSION_DENIED');
    expect(hasDenialAudit).toBe(true);
  });

  it('TC-AUTH-05: invalidates session on sign-out and rejects replayed token', async () => {
    const token = await loginAs('emp_alex', 'Emp@123');
    const meBefore = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meBefore.status).toBe(200);

    const outRes = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(outRes.status).toBe(200);

    const meAfter = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meAfter.status).toBe(401);
  });

  // ==========================================================================
  // 2. DEPARTMENTS & USERS (TC-ORG-01..03)
  // ==========================================================================
  it('TC-ORG-01, TC-ORG-02 & TC-ORG-03: maintains 9 departments, deactivates users without deleting history, and refuses deactivated login', async () => {
    const adminToken = await loginAs('admin', 'Admin@123');
    const deptRes = await request(app).get('/api/departments').set('Authorization', `Bearer ${adminToken}`);
    expect(deptRes.status).toBe(200);
    expect(deptRes.body.departments).toHaveLength(9);

    // Deactivate user #9 (emp_alex) who has historical completed trips
    const deactRes = await request(app)
      .patch('/api/users/9')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: false });
    expect(deactRes.status).toBe(200);

    // Attempt login as deactivated user -> 403
    const loginAttempt = await request(app).post('/api/auth/login').send({
      group_username: 'emp_alex',
      password: 'Emp@123',
    });
    expect(loginAttempt.status).toBe(403);

    // Historical trips by emp_alex remain intact and attributable
    const tripsRes = await request(app).get('/api/trips').set('Authorization', `Bearer ${adminToken}`);
    const alexTrips = tripsRes.body.trips.filter((t: any) => t.requester_id === 9);
    expect(alexTrips.length).toBeGreaterThan(0);
    expect(alexTrips[0].requester_name).toContain('Alex');
  });

  // ==========================================================================
  // 3. VEHICLES, GAS/EV DISTINCTION & STANDBY CONTROL (TC-VEH-01..05, TC-REV-03)
  // ==========================================================================
  it('TC-VEH-01..05 & TC-REV-03: seeds 8 vehicles (5 Gas, 3 EV), enforces energy_type rules, and allows Admin to edit plate/car_type and set Standby', async () => {
    const adminToken = await loginAs('admin', 'Admin@123');
    const vehRes = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${adminToken}`);
    expect(vehRes.status).toBe(200);
    expect(vehRes.body.vehicles).toHaveLength(8);
    expect(vehRes.body.vehicles.filter((v: any) => v.energy_type === 'Gasoline')).toHaveLength(5);
    expect(vehRes.body.vehicles.filter((v: any) => v.energy_type === 'Electric')).toHaveLength(3);

    // TC-VEH-02: Refuse gasoline fuel record on Electric vehicle (#6) and EV charging on Gasoline vehicle (#1)
    const badFuel = await request(app).post('/api/fuel').set('Authorization', `Bearer ${adminToken}`).send({
      vehicle_id: 6,
      litres: 30,
      cost: 40,
      odometer_km: 16000,
    });
    expect(badFuel.status).toBe(400);

    const badEv = await request(app).post('/api/ev-charging').set('Authorization', `Bearer ${adminToken}`).send({
      vehicle_id: 1,
      kwh_added: 40,
      cost: 15,
      battery_start_pct: 20,
      battery_end_pct: 80,
    });
    expect(badEv.status).toBe(400);

    // TC-VEH-04: Refuse duplicate plate
    const dupPlate = await request(app).post('/api/vehicles').set('Authorization', `Bearer ${adminToken}`).send({
      registration_plate: 'B 1001 FMS',
      make: 'Toyota',
      model: 'Camry',
      vin: 'UNIQUEVIN999',
      energy_type: 'Gasoline',
    });
    expect(dupPlate.status).toBe(409);

    // TC-REV-03: Admin edits vehicle car_type, license plate, and puts vehicle on Standby
    const editRes = await request(app).patch('/api/vehicles/4').set('Authorization', `Bearer ${adminToken}`).send({
      registration_plate: 'B 1004 VIP',
      car_type: 'VIP Executive MPV',
      status: 'Standby',
      standby_reason: 'Reserved for Board Summit',
    });
    expect(editRes.status).toBe(200);
    expect(editRes.body.vehicle.registration_plate).toBe('B 1004 VIP');
    expect(editRes.body.vehicle.car_type).toBe('VIP Executive MPV');
    expect(editRes.body.vehicle.status).toBe('Standby');

    // Attempt booking a Standby vehicle -> refused with 409 (BKG-08, TC-VEH-05)
    const empToken = await loginAs('emp_sara', 'Emp@123');
    const standbyBook = await request(app).post('/api/trips').set('Authorization', `Bearer ${empToken}`).send({
      vehicle_id: 4,
      purpose: 'Try booking standby car',
      origin: 'HQ',
      destination: 'Client Site',
      start_time: '2027-05-01T09:00:00.000Z',
      end_time: '2027-05-01T11:00:00.000Z',
      passenger_count: 2,
    });
    expect(standbyBook.status).toBe(409);
    expect(standbyBook.body.error).toMatch(/Standby/i);
  });

  // ==========================================================================
  // 4. DRIVERS & PERSONAL DATA PRIVACY (TC-DRV-01..02)
  // ==========================================================================
  it('TC-DRV-01 & TC-DRV-02: restricts personal driver fields from general employees and prevents assigning unavailable drivers', async () => {
    const empToken = await loginAs('emp_alex', 'Emp@123');
    const adminToken = await loginAs('admin', 'Admin@123');

    const empDrvView = await request(app).get('/api/drivers').set('Authorization', `Bearer ${empToken}`);
    expect(empDrvView.status).toBe(200);
    expect(empDrvView.body.drivers[0].licence_number).toBeNull();
    expect(empDrvView.body.drivers[0].contact_number).toBeNull();

    const admDrvView = await request(app).get('/api/drivers').set('Authorization', `Bearer ${adminToken}`);
    expect(admDrvView.body.drivers[0].licence_number).toBeTruthy();

    // Set Driver #4 to 'On Leave' and verify assignment is refused
    await request(app).patch('/api/drivers/4').set('Authorization', `Bearer ${adminToken}`).send({
      availability_status: 'On Leave',
    });

    const assignLeave = await request(app).post('/api/assignments').set('Authorization', `Bearer ${adminToken}`).send({
      vehicle_id: 5,
      driver_profile_id: 4,
      effective_start: '2027-06-01T09:00:00.000Z',
      effective_end: '2027-06-01T12:00:00.000Z',
    });
    expect(assignLeave.status).toBe(409);
  });

  // ==========================================================================
  // 5. NO SELF-DRIVE & IMMEDIATE BLOCK ON UNAPPROVED BOOKING (TC-REV-02, TC-REV-04)
  // ==========================================================================
  it('TC-REV-02 & TC-REV-04: rejects self-drive and immediately blocks vehicle and driver schedule on unapproved bookings', async () => {
    const alexToken = await loginAs('emp_alex', 'Emp@123');
    const saraToken = await loginAs('emp_sara', 'Emp@123');

    // TC-REV-02: Self-drive is rejected
    const selfDriveAttempt = await request(app).post('/api/trips').set('Authorization', `Bearer ${alexToken}`).send({
      vehicle_id: 1,
      purpose: 'Self drive test',
      origin: 'HQ',
      destination: 'Mall',
      start_time: '2027-07-10T09:00:00.000Z',
      end_time: '2027-07-10T11:00:00.000Z',
      self_drive: true,
    });
    expect(selfDriveAttempt.status).toBe(400);
    expect(selfDriveAttempt.body.error).toMatch(/Self-drive is disabled/i);

    // TC-REV-04: Alex books Vehicle #1 + Driver #1 for 10:00-12:00 (status is PENDING_APPROVAL, not approved yet!)
    const firstBooking = await request(app).post('/api/trips').set('Authorization', `Bearer ${alexToken}`).send({
      vehicle_id: 1,
      preferred_driver_id: 1,
      purpose: 'Engineering Site Survey',
      origin: 'HQ',
      destination: 'Plant B',
      start_time: '2027-07-10T10:00:00.000Z',
      end_time: '2027-07-10T12:00:00.000Z',
      passenger_count: 3,
    });
    expect(firstBooking.status).toBe(201);
    expect(firstBooking.body.trip.status).toBe('PENDING_APPROVAL');

    // Sara immediately tries to book Vehicle #1 for 10:30-11:30 before Admin approves Alex's booking -> MUST BE BLOCKED!
    const overlappingVehicleAttempt = await request(app).post('/api/trips').set('Authorization', `Bearer ${saraToken}`).send({
      vehicle_id: 1,
      purpose: 'Sales Meeting',
      origin: 'HQ',
      destination: 'Client Office',
      start_time: '2027-07-10T10:30:00.000Z',
      end_time: '2027-07-10T11:30:00.000Z',
      passenger_count: 2,
    });
    expect(overlappingVehicleAttempt.status).toBe(409);
    expect(overlappingVehicleAttempt.body.error).toMatch(/Pending Approval reservation/i);

    // Sara tries to book a DIFFERENT vehicle (#2) but with Driver #1 during 10:30-11:30 -> Driver #1 is ALSO blocked!
    const overlappingDriverAttempt = await request(app).post('/api/trips').set('Authorization', `Bearer ${saraToken}`).send({
      vehicle_id: 2,
      preferred_driver_id: 1,
      purpose: 'Sales Meeting with Driver 1',
      origin: 'HQ',
      destination: 'Client Office',
      start_time: '2027-07-10T10:30:00.000Z',
      end_time: '2027-07-10T11:30:00.000Z',
      passenger_count: 2,
    });
    expect(overlappingDriverAttempt.status).toBe(409);
    expect(overlappingDriverAttempt.body.error).toMatch(/already assigned\/blocked/i);
  });

  // ==========================================================================
  // 6. APPROVAL HISTORY, SELF-APPROVAL BLOCK & CONCURRENCY (TC-REQ-02..03, TC-BKG-03, TC-ASN-03..04)
  // ==========================================================================
  it('TC-REQ-02 & TC-REQ-03: prevents self-approval and preserves append-only reject-then-approve decision history', async () => {
    const hwsToken = await loginAs('hws_head', 'Hws@123');
    const adminToken = await loginAs('admin', 'Admin@123');

    // HWS submits a trip request
    const createRes = await request(app).post('/api/trips').set('Authorization', `Bearer ${hwsToken}`).send({
      vehicle_id: 2,
      purpose: 'Facility Audit',
      origin: 'HQ',
      destination: 'Branch C',
      start_time: '2027-08-01T08:00:00.000Z',
      end_time: '2027-08-01T10:00:00.000Z',
    });
    expect(createRes.status).toBe(201);
    const tripId = createRes.body.tripId;

    // TC-REQ-03: HWS attempts to approve their own request -> 403
    const selfApprove = await request(app)
      .post(`/api/trips/${tripId}/decision`)
      .set('Authorization', `Bearer ${hwsToken}`)
      .send({ decision: 'APPROVED' });
    expect(selfApprove.status).toBe(403);

    // Admin rejects first
    const rejectRes = await request(app)
      .post(`/api/trips/${tripId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'REJECTED', reason: 'Please shift by 1 hour' });
    expect(rejectRes.status).toBe(200);

    // Resubmit then Admin approves
    await request(app)
      .post(`/api/trips/${tripId}/resubmit`)
      .set('Authorization', `Bearer ${hwsToken}`)
      .send({ start_time: '2027-08-01T09:00:00.000Z', end_time: '2027-08-01T11:00:00.000Z' });

    const approveRes = await request(app)
      .post(`/api/trips/${tripId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED', reason: 'Updated slot approved', driver_profile_id: 2 });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.decisions).toHaveLength(2);
    expect(approveRes.body.decisions[0].decision).toBe('REJECTED');
    expect(approveRes.body.decisions[1].decision).toBe('APPROVED');

    // Attempt to delete or edit an earlier decision via API -> 405
    const delAttempt = await request(app)
      .delete(`/api/approval-decisions/${approveRes.body.decisions[0].id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delAttempt.status).toBe(405);
  });

  it('TC-BKG-03 & TC-ASN-03..04: handles simultaneous concurrent bookings/assignments and preserves reassignment history', async () => {
    const alexToken = await loginAs('emp_alex', 'Emp@123');
    const saraToken = await loginAs('emp_sara', 'Emp@123');
    const adminToken = await loginAs('admin', 'Admin@123');

    // Simultaneous booking requests for the same vehicle and slot
    const [b1, b2] = await Promise.all([
      request(app).post('/api/bookings').set('Authorization', `Bearer ${alexToken}`).send({
        vehicle_id: 3,
        purpose: 'Concurrent Booking A',
        start_time: '2027-09-10T13:00:00.000Z',
        end_time: '2027-09-10T15:00:00.000Z',
      }),
      request(app).post('/api/bookings').set('Authorization', `Bearer ${saraToken}`).send({
        vehicle_id: 3,
        purpose: 'Concurrent Booking B',
        start_time: '2027-09-10T13:00:00.000Z',
        end_time: '2027-09-10T15:00:00.000Z',
      }),
    ]);

    const statuses = [b1.status, b2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // TC-ASN-04: Reassign driver and verify both old and new Assignment records exist in time order
    const tripRes = await request(app).post('/api/trips').set('Authorization', `Bearer ${alexToken}`).send({
      vehicle_id: 5,
      preferred_driver_id: 1,
      purpose: 'Logistics Transfer',
      origin: 'HQ',
      destination: 'Port',
      start_time: '2027-09-15T09:00:00.000Z',
      end_time: '2027-09-15T12:00:00.000Z',
    });
    expect(tripRes.status, JSON.stringify(tripRes.body)).toBe(201);
    const tripId = tripRes.body.tripId;

    const reassignRes = await request(app).post('/api/assignments').set('Authorization', `Bearer ${adminToken}`).send({
      trip_request_id: tripId,
      vehicle_id: 5,
      driver_profile_id: 3,
      effective_start: '2027-09-15T09:00:00.000Z',
      effective_end: '2027-09-15T12:00:00.000Z',
      reason: 'Reassigned to Citra',
    });
    expect(reassignRes.status, JSON.stringify(reassignRes.body)).toBe(201);

    const asnHistory = await request(app)
      .get(`/api/assignments?trip_request_id=${tripId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(asnHistory.body.assignments).toHaveLength(2);
    expect(asnHistory.body.assignments[0].driver_profile_id).toBe(1);
    expect(asnHistory.body.assignments[0].is_current).toBe(0);
    expect(asnHistory.body.assignments[1].driver_profile_id).toBe(3);
    expect(asnHistory.body.assignments[1].is_current).toBe(1);
  });

  // ==========================================================================
  // 7. PROTECTED DOCUMENTS & EICAR ANTIVIRUS SCAN (TC-DOC-01..05)
  // ==========================================================================
  it('TC-DOC-02, TC-DOC-04 & TC-DOC-05: blocks EICAR test virus and disguised executables, and preserves document version history', async () => {
    const adminToken = await loginAs('admin', 'Admin@123');

    // EICAR standard signature -> refused with 422
    const eicarBase64 = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*').toString('base64');
    const eicarRes = await request(app).post('/api/documents').set('Authorization', `Bearer ${adminToken}`).send({
      entity_type: 'VEHICLE',
      entity_id: 1,
      doc_type: 'Insurance',
      file_name: 'eicar.pdf',
      mime_type: 'application/pdf',
      content_base64: eicarBase64,
    });
    expect(eicarRes.status).toBe(422);

    // Renamed executable 'MZ...' -> refused with 400
    const exeBase64 = Buffer.from('MZ\x90\x00\x03\x00\x00\x00').toString('base64');
    const exeRes = await request(app).post('/api/documents').set('Authorization', `Bearer ${adminToken}`).send({
      entity_type: 'VEHICLE',
      entity_id: 1,
      doc_type: 'Insurance',
      file_name: 'disguised.pdf',
      mime_type: 'application/pdf',
      content_base64: exeBase64,
    });
    expect(exeRes.status).toBe(400);

    // Valid PDF v1 then replace with v2 -> v1 remains retrievable (TC-DOC-04)
    const validPdf = Buffer.from('%PDF-1.4\n%Valid PDF Content').toString('base64');
    const v1Res = await request(app).post('/api/documents').set('Authorization', `Bearer ${adminToken}`).send({
      entity_type: 'VEHICLE',
      entity_id: 1,
      doc_type: 'Registration',
      file_name: 'stnk_2026.pdf',
      mime_type: 'application/pdf',
      content_base64: validPdf,
    });
    expect(v1Res.status).toBe(201);
    const v1Id = v1Res.body.document.id;

    const v2Res = await request(app).post('/api/documents').set('Authorization', `Bearer ${adminToken}`).send({
      entity_type: 'VEHICLE',
      entity_id: 1,
      doc_type: 'Registration',
      file_name: 'stnk_2027.pdf',
      mime_type: 'application/pdf',
      content_base64: validPdf,
      replaces_document_id: v1Id,
    });
    expect(v2Res.status).toBe(201);
    expect(v2Res.body.document.version_number).toBe(2);

    const retrieveV1 = await request(app).get(`/api/documents/${v1Id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(retrieveV1.status).toBe(200);
    expect(retrieveV1.body.document.file_name).toBe('stnk_2026.pdf');
  });

  // ==========================================================================
  // 8. DRIVER TRIP COMPLETION, USAGE ANALYTICS & PUSH NOTIFICATIONS (TC-REV-05, TC-REV-06)
  // ==========================================================================
  it('TC-REV-05 & TC-REV-06: completes trip lifecycle, computes day/week/month distance per car and combined, and delivers push notifications', async () => {
    const alexToken = await loginAs('emp_alex', 'Emp@123');
    const adminToken = await loginAs('admin', 'Admin@123');
    const driverToken = await loginAs('drv_budi', 'Driver@123');

    // Subscribe Driver to Web Push (TC-REV-05)
    const subRes = await request(app).post('/api/notifications/subscribe').set('Authorization', `Bearer ${driverToken}`).send({
      endpoint: 'https://test-push.internal/driver-budi',
      keys: { p256dh: 'key1', auth: 'auth1' },
    });
    expect(subRes.status).toBe(201);

    // 1. User books Vehicle #1 (Current Odometer 34,200 km)
    const bookRes = await request(app).post('/api/trips').set('Authorization', `Bearer ${alexToken}`).send({
      vehicle_id: 1,
      preferred_driver_id: 1,
      purpose: 'Data Center Inspection',
      origin: 'HQ',
      destination: 'Sentul DC',
      start_time: '2027-10-01T08:00:00.000Z',
      end_time: '2027-10-01T12:00:00.000Z',
      passenger_count: 2,
    });
    expect(bookRes.status).toBe(201);
    const tripId = bookRes.body.tripId;

    // 2. Admin approves & dispatches Driver #1
    const approveRes = await request(app)
      .post(`/api/trips/${tripId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED', driver_profile_id: 1, vehicle_id: 1 });
    expect(approveRes.status).toBe(200);

    // 3. Driver acknowledges, starts trip (34,200 km), and completes trip (34,275 km => +75 km)
    const ackRes = await request(app).post(`/api/driver/trips/${tripId}/acknowledge`).set('Authorization', `Bearer ${driverToken}`);
    expect(ackRes.status).toBe(200);

    const startRes = await request(app)
      .post(`/api/driver/trips/${tripId}/start`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ start_odometer: 34200 });
    expect(startRes.status).toBe(200);

    const compRes = await request(app)
      .post(`/api/driver/trips/${tripId}/complete`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ end_odometer: 34275, parking_return_note: 'Basement B1 - Slot A01' });
    expect(compRes.status).toBe(200);
    expect(compRes.body.trip.distance_km).toBe(75);

    // 4. Verify Usage Analytics (TC-REV-06: per day, week, month, per car, per driver, and combined across all cars)
    const usageRes = await request(app).get('/api/analytics/usage').set('Authorization', `Bearer ${adminToken}`);
    expect(usageRes.status).toBe(200);

    const car1Usage = usageRes.body.perVehicle.find((v: any) => v.vehicle_id === 1);
    expect(car1Usage).toBeTruthy();
    // Seeded trip for car 1 today was 85 km + new completed trip 75 km = 160 km today!
    expect(car1Usage.day.distanceKm).toBe(160);
    expect(car1Usage.day.trips).toBe(2);

    // Combined overall across all 8 cars
    expect(usageRes.body.combinedOverall.day.distanceKm).toBeGreaterThanOrEqual(198);
    expect(usageRes.body.combinedOverall.allTime.trips).toBe(7);
    // Separate Gasoline Litres vs Electric kWh (EV-05, RPT-04)
    expect(usageRes.body.combinedOverall.gasolineSummary.totalLitres).toBeGreaterThan(0);
    expect(usageRes.body.combinedOverall.electricSummary.totalKwh).toBeGreaterThan(0);
  });

  // ==========================================================================
  // 9. BEST-EFFORT GPS VALIDATION & DATA IMPORT DRY-RUN (TC-GPS-05..10, TC-IMP-01)
  // ==========================================================================
  it('TC-GPS-05..10 & TC-IMP-01: stores capture & receipt timestamps, rejects future/invalid coordinates, and runs dry-run import', async () => {
    const driverToken = await loginAs('drv_budi', 'Driver@123');
    const adminToken = await loginAs('admin', 'Admin@123');

    // Valid GPS report
    const gpsOk = await request(app).post('/api/gps/report').set('Authorization', `Bearer ${driverToken}`).send({
      latitude: -6.2251,
      longitude: 106.8102,
      accuracy_meters: 9.5,
      capture_time: new Date(Date.now() - 30000).toISOString(),
      permission_state: 'GRANTED',
    });
    expect(gpsOk.status).toBe(201);
    expect(gpsOk.body.report.capture_time).not.toBe(gpsOk.body.report.server_receipt_time);

    // Invalid coordinates -> 400
    const gpsBadCoord = await request(app).post('/api/gps/report').set('Authorization', `Bearer ${driverToken}`).send({
      latitude: 135.0,
      longitude: 106.8,
      permission_state: 'GRANTED',
    });
    expect(gpsBadCoord.status).toBe(400);

    // Attempt to overwrite/edit a location report -> 405 (GPS-09)
    const gpsEdit = await request(app)
      .patch(`/api/gps/reports/${gpsOk.body.report.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ latitude: 0 });
    expect(gpsEdit.status).toBe(405);

    // TC-IMP-01: Dry-run import validates rows and creates no records
    const impDry = await request(app)
      .post('/api/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dry_run: true,
        vehicles: [
          { registration_plate: 'B 9001 NEW', make: 'Toyota', model: 'Fortuner', vin: 'VINFORTUNER01', energy_type: 'Gasoline' },
          { registration_plate: '', make: 'Broken', model: 'Row', vin: '', energy_type: 'InvalidType' },
        ],
      });
    expect(impDry.status).toBe(200);
    expect(impDry.body.validCount).toBe(1);
    expect(impDry.body.invalidCount).toBe(1);
    expect(impDry.body.importedCount).toBe(0);
  });
});
