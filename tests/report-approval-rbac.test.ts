import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.ts';
import { resetDbForTesting } from '../src/server/db.ts';
import { getVehiclePhotoIconUrl } from '../src/components/CarAvatarArt';

describe('Car Photo Icons (Stargazer & Ioniq 5), Digital Report Approvals (Friday & End of Month), and FM/HWS Account RBAC Fix', () => {
  let app: ReturnType<typeof createApp>;
  let admToken = '';
  let fmToken = '';
  let hwsToken = '';
  let empUserId = 0;
  let deptId = 1;

  beforeAll(async () => {
    resetDbForTesting(':memory:');
    app = createApp();

    const admRes = await request(app)
      .post('/api/auth/login')
      .send({ group_username: 'admin', password: 'Admin@123' });
    expect(admRes.status).toBe(200);
    admToken = admRes.body.token;

    const fmRes = await request(app)
      .post('/api/auth/login')
      .send({ group_username: 'fleetmgr', password: 'Fleet@123' });
    expect(fmRes.status).toBe(200);
    fmToken = fmRes.body.token;

    const hwsRes = await request(app)
      .post('/api/auth/login')
      .send({ group_username: 'hws_head', password: 'Hws@123' });
    expect(hwsRes.status).toBe(200);
    hwsToken = hwsRes.body.token;

    const usersRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${admToken}`);
    expect(usersRes.status).toBe(200);
    const emp = (usersRes.body.users || []).find((u: any) => u.role === 'EMP');
    expect(emp).toBeTruthy();
    empUserId = emp.id;
    deptId = emp.department_id || 1;
  });

  it('maps Stargazer/Gasoline and Ioniq 5/Electric to transparent photo PNG icons', () => {
    expect(fs.existsSync(path.resolve('public/icons/car-stargazer.png'))).toBe(true);
    expect(fs.existsSync(path.resolve('public/icons/car-ioniq5.png'))).toBe(true);
    expect(getVehiclePhotoIconUrl('Hyundai Stargazer Prime', 'Gasoline')).toBe('/icons/car-stargazer.png');
    expect(getVehiclePhotoIconUrl('Toyota Camry 2.5 V', 'Gasoline')).toBe('/icons/car-stargazer.png');
    expect(getVehiclePhotoIconUrl('Hyundai Ioniq 5 Signature', 'Electric')).toBe('/icons/car-ioniq5.png');
    expect(getVehiclePhotoIconUrl('BYD Atto 3', 'Electric')).toBe('/icons/car-ioniq5.png');
  });

  it('removes account registration/creation/modification/deletion authority from FM and HWS while preserving ADM', async () => {
    for (const token of [fmToken, hwsToken]) {
      const createRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nickname: 'Unauthorized User',
          group_username: `unauth_${Date.now()}`,
          password: 'Password@123',
          department_id: deptId,
          role: 'EMP',
        });
      expect(createRes.status).toBe(403);

      const patchRes = await request(app)
        .patch(`/api/users/${empUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ approval_status: 'APPROVED', role: 'EMP' });
      expect(patchRes.status).toBe(403);

      const delRes = await request(app)
        .delete(`/api/users/${empUserId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(403);
    }

    // Verify UI source strictly gates account management sections to ADM only
    const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
    expect(appSource).toContain("{user.role === 'ADM' && (\n              <section className=\"gf-card-flat\">\n                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>\n                  <h2 className=\"type-section\" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14.5px' }}>\n                    <UserCheck size={16} /> {t('Pending Account Registrations')}");
    expect(appSource).toContain("{user.role === 'ADM' && (\n              <section className=\"gf-card-flat\">\n                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>\n                  <div>\n                    <h2 className=\"type-section\">{t('User Registry & Account Management')}");
  });

  it('triggers Weekly (Friday) and Monthly (End of Month) digital report approval popups and records FM + HWS digital signatures', async () => {
    // 1. Friday (2026-11-20) -> Weekly Summary popup appears for FM & HWS, not ADM
    const fmFri = await request(app)
      .get('/api/reports/approvals?simulate_date=2026-11-20')
      .set('Authorization', `Bearer ${fmToken}`);
    expect(fmFri.status).toBe(200);
    expect(fmFri.body.scheduleInfo.isFriday).toBe(true);
    expect(fmFri.body.pendingPopup).toBeTruthy();
    expect(fmFri.body.pendingPopup.period_type).toBe('WEEKLY');

    const admFri = await request(app)
      .get('/api/reports/approvals?simulate_date=2026-11-20')
      .set('Authorization', `Bearer ${admToken}`);
    expect(admFri.status).toBe(200);
    expect(admFri.body.pendingPopup).toBeNull();

    const weeklyId = fmFri.body.pendingPopup.id;

    // Admin cannot forge FM/HWS digital report sign-off
    const admSignAttempt = await request(app)
      .post(`/api/reports/approvals/${weeklyId}/decision`)
      .set('Authorization', `Bearer ${admToken}`)
      .send({ decision: 'APPROVED' });
    expect(admSignAttempt.status).toBe(403);

    // FM signs digitally
    const fmSign = await request(app)
      .post(`/api/reports/approvals/${weeklyId}/decision`)
      .set('Authorization', `Bearer ${fmToken}`)
      .send({ decision: 'APPROVED', notes: 'Weekly fleet mileage verified' });
    expect(fmSign.status).toBe(200);
    expect(fmSign.body.signatureHash).toMatch(/^GF-DIGI-[A-F0-9]{12}$/);
    expect(fmSign.body.overall_status).toBe('PARTIALLY_APPROVED');
    expect(fmSign.body.approval.fm_status).toBe('APPROVED');
    expect(fmSign.body.approval.hws_status).toBe('PENDING');

    // Popup no longer shows for FM on Friday, but still shows for HWS
    const fmFriAfter = await request(app)
      .get('/api/reports/approvals?simulate_date=2026-11-20')
      .set('Authorization', `Bearer ${fmToken}`);
    expect(fmFriAfter.body.pendingPopup).toBeNull();

    const hwsFri = await request(app)
      .get('/api/reports/approvals?simulate_date=2026-11-20')
      .set('Authorization', `Bearer ${hwsToken}`);
    expect(hwsFri.body.pendingPopup?.id).toBe(weeklyId);

    // HWS signs digitally -> fully APPROVED
    const hwsSign = await request(app)
      .post(`/api/reports/approvals/${weeklyId}/decision`)
      .set('Authorization', `Bearer ${hwsToken}`)
      .send({ decision: 'APPROVED', notes: 'Approved by Head of WS' });
    expect(hwsSign.status).toBe(200);
    expect(hwsSign.body.signatureHash).toMatch(/^GF-DIGI-[A-F0-9]{12}$/);
    expect(hwsSign.body.overall_status).toBe('APPROVED');

    // 2. End of Month (2026-11-30) -> Monthly Summary popup appears for FM & HWS
    const hwsMonthEnd = await request(app)
      .get('/api/reports/approvals?simulate_date=2026-11-30')
      .set('Authorization', `Bearer ${hwsToken}`);
    expect(hwsMonthEnd.status).toBe(200);
    expect(hwsMonthEnd.body.scheduleInfo.isEndOfMonth).toBe(true);
    expect(hwsMonthEnd.body.pendingPopup).toBeTruthy();
    expect(hwsMonthEnd.body.pendingPopup.period_type).toBe('MONTHLY');
  });
});
