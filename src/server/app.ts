import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { getDb, hashPassword, verifyPassword, runInTransaction } from './db.ts';
import { createSessionToken, isPrivilegedRole, requireAuth, requireRoles } from './auth.ts';
import { recordAudit } from './audit.ts';
import { ensureVapidKeys, notifyAdmins, sendUserNotification } from './push.ts';
import { checkDriverConflict, checkVehicleConflict } from './conflict.ts';
import { createRateLimiter } from './rate-limit.ts';

export function createApp() {
  const app = express();

  // Security headers (NFR-02, NFR-04, TC-SEC-01) - Comprehensive Cyber Defense
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://translate.google.com https://translate-pa.googleapis.com; style-src 'self' 'unsafe-inline' https://translate.google.com; img-src 'self' data: blob: https://*.maptiler.com https://api.maptiler.com https://*.openstreetmap.org https://www.google.com https://*.google.com https://translate.google.com; connect-src 'self' https://api.maptiler.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://translate.googleapis.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self';"
    );
    res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
    next();
  });

  app.use(express.json({ limit: '12mb' }));

  // Enterprise DoS & Traffic Surge Rate Limiter
  app.use('/api', createRateLimiter());

  // L4 / L7 Health & Liveness Probe for Load Balancers & Orchestrators
  app.get(['/api/health', '/api/healthz'], (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'GalaxyFleet Corporate Fleet Management',
      uptime_sec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Deep Readiness Probe (Verifies Database Engine, Connection Pool & Memory)
  app.get('/api/health/deep', (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const dbCheck = db.prepare('SELECT 1 as alive').get() as { alive: number } | undefined;
      const mem = process.memoryUsage();
      res.json({
        status: dbCheck?.alive === 1 ? 'ready' : 'degraded',
        database: 'connected',
        sqlite_wal: true,
        memory: {
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          rssMb: Math.round(mem.rss / 1024 / 1024),
        },
        uptime_sec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'unhealthy',
        database: 'error',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Normalize API route prefix for Vercel serverless function invocations
  app.use((req, _res, next) => {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/assets') && !req.url.startsWith('/icons') && !req.url.startsWith('/sw.js') && !req.url.startsWith('/manifest')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
    next();
  });

  // Anti-Brute Force and Credential Stuffing Defense
  interface AuthAttempt {
    count: number;
    firstAttemptAt: number;
    lockedUntil: number;
  }
  const failedLoginAttempts = new Map<string, AuthAttempt>();

  // Cleanup expired lockout entries periodically
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of failedLoginAttempts.entries()) {
      if (val.lockedUntil < now && now - val.firstAttemptAt > 600_000) {
        failedLoginAttempts.delete(key);
      }
    }
  }, 300_000);
  cleanupTimer.unref();

  // ============================================================================
  // 1. AUTHENTICATION & ACCOUNT REGISTRATION (AUTH-01 to AUTH-08, Revision #2)
  // ============================================================================

  // Privacy-first registration: requires ONLY nickname, department_id, group_username, password
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const db = getDb();
    const { nickname, department_id, group_username, password, requested_role } = req.body ?? {};

    if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
      res.status(400).json({ error: 'Nickname is required' });
      return;
    }
    if (!group_username || typeof group_username !== 'string' || !/^[a-zA-Z0-9_.-]{3,40}$/.test(group_username.trim())) {
      res.status(400).json({ error: 'Group username must be 3-40 alphanumeric characters' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    const deptId = Number(department_id);
    if (!Number.isInteger(deptId) || deptId <= 0) {
      res.status(400).json({ error: 'Department selection is required' });
      return;
    }

    const dept = db.prepare('SELECT id, name, is_active FROM departments WHERE id = ?').get(deptId) as
      | { id: number; name: string; is_active: number }
      | undefined;
    if (!dept || dept.is_active === 0) {
      res.status(400).json({ error: 'Selected department is invalid or inactive (ORG-02)' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE group_username = ?').get(group_username.trim());
    if (existing) {
      res.status(409).json({ error: 'Group username is already registered' });
      return;
    }

    const allowedRegisterRoles = ['EMP', 'DRV'];
    const role = allowedRegisterRoles.includes(requested_role) ? requested_role : 'EMP';

    const result = db
      .prepare(
        `INSERT INTO users (nickname, group_username, password_hash, role, is_department_admin, department_id, approval_status, is_active)
         VALUES (?, ?, ?, ?, 0, ?, 'PENDING_APPROVAL', 1)`
      )
      .run(nickname.trim(), group_username.trim(), hashPassword(password), role, deptId);

    const newUserId = Number(result.lastInsertRowid);

    recordAudit(db, { id: newUserId, group_username: group_username.trim(), role }, 'USER_REGISTERED_PENDING', 'USER', newUserId, null, {
      nickname: nickname.trim(),
      group_username: group_username.trim(),
      department_id: deptId,
      role,
      approval_status: 'PENDING_APPROVAL',
    });

    notifyAdmins(db, {
      triggerType: 'USER_REGISTRATION_PENDING',
      title: 'New Account Registration Pending Approval',
      body: `${nickname.trim()} (@${group_username.trim()}, ${dept.name}) registered and awaits Administrator approval.`,
      relatedEntityType: 'USER',
      relatedEntityId: newUserId,
    });

    res.status(201).json({
      id: newUserId,
      nickname: nickname.trim(),
      group_username: group_username.trim(),
      department_id: deptId,
      role,
      approval_status: 'PENDING_APPROVAL',
      message: 'Registration submitted. An Administrator must approve your account before you can sign in.',
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const db = getDb();
    const { group_username, username, password } = req.body ?? {};
    const loginName = (group_username || username || '').toString().trim();

    if (!loginName || !password || typeof password !== 'string') {
      res.status(400).json({ error: 'Group username and password are required' });
      return;
    }

    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const lockoutKey = `${clientIp}::${loginName.toLowerCase()}`;
    const now = Date.now();
    const existingLock = failedLoginAttempts.get(lockoutKey);
    if (existingLock && existingLock.lockedUntil > now) {
      const remainingSec = Math.ceil((existingLock.lockedUntil - now) / 1000);
      res.status(429).json({
        error: `Too many failed login attempts. Temporarily locked for security protection. Please wait ${remainingSec} seconds.`,
      });
      return;
    }

    const user = db
      .prepare(
        `SELECT u.*, d.name as department_name, dp.id as driver_profile_id
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN driver_profiles dp ON dp.user_id = u.id
         WHERE u.group_username = ?`
      )
      .get(loginName) as
      | {
          id: number;
          nickname: string;
          group_username: string;
          password_hash: string;
          role: 'ADM' | 'FM' | 'HWS' | 'DRV' | 'EMP';
          is_department_admin: number;
          department_id: number;
          department_name: string;
          approval_status: string;
          is_active: number;
          driver_profile_id: number | null;
        }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      const prevAttempt = failedLoginAttempts.get(lockoutKey);
      const newCount = (prevAttempt ? prevAttempt.count : 0) + 1;
      const isLocked = newCount >= 8;
      failedLoginAttempts.set(lockoutKey, {
        count: newCount,
        firstAttemptAt: prevAttempt ? prevAttempt.firstAttemptAt : now,
        lockedUntil: isLocked ? now + 5 * 60_000 : 0,
      });

      if (isLocked) {
        recordAudit(db, { group_username: loginName }, 'BRUTE_FORCE_LOCKOUT', 'AUTH', loginName, null, { ip: clientIp, attempts: newCount });
      } else {
        recordAudit(db, { group_username: loginName }, 'SIGN_IN_FAILED', 'AUTH', loginName, null, { reason: 'Invalid credentials', ip: clientIp });
      }

      res.status(401).json({ error: 'Invalid group username or password' });
      return;
    }

    // Success -> clear failed login attempts for this user/ip
    failedLoginAttempts.delete(lockoutKey);

    if (user.is_active === 0) {
      recordAudit(db, user, 'SIGN_IN_REFUSED_DEACTIVATED', 'USER', user.id);
      res.status(403).json({ error: 'Account has been deactivated (ORG-04)' });
      return;
    }

    if (user.approval_status === 'PENDING_APPROVAL') {
      recordAudit(db, user, 'SIGN_IN_REFUSED_PENDING_APPROVAL', 'USER', user.id);
      res.status(403).json({ error: 'Your account registration is still pending Administrator approval' });
      return;
    }

    if (user.approval_status === 'REJECTED') {
      recordAudit(db, user, 'SIGN_IN_REFUSED_REJECTED', 'USER', user.id);
      res.status(403).json({ error: 'Your account registration was rejected by Administrator' });
      return;
    }

    const sessionId = crypto.randomBytes(24).toString('hex');
    const expiresAt = now + 24 * 3600 * 1000;
    db.prepare('INSERT INTO sessions (token, user_id, created_at, last_active_at, expires_at, revoked) VALUES (?, ?, ?, ?, ?, 0)').run(
      sessionId,
      user.id,
      now,
      now,
      expiresAt
    );

    const signedToken = createSessionToken(user.id, sessionId);
    recordAudit(db, user, 'USER_SIGN_IN', 'SESSION', sessionId);

    const { publicKey } = ensureVapidKeys(db);
    res.cookie?.('fms_session', signedToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 3600 * 1000,
    });

    res.json({
      token: signedToken,
      vapidPublicKey: publicKey,
      user: {
        id: user.id,
        nickname: user.nickname,
        group_username: user.group_username,
        role: user.role,
        is_department_admin: user.is_department_admin,
        department_id: user.department_id,
        department_name: user.department_name,
        approval_status: user.approval_status,
        driver_profile_id: user.driver_profile_id,
      },
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    if (req.sessionToken) {
      db.prepare('UPDATE sessions SET revoked = 1 WHERE token = ?').run(req.sessionToken);
    }
    recordAudit(db, req.user, 'USER_SIGN_OUT', 'SESSION', req.sessionToken);
    res.clearCookie?.('fms_session');
    res.json({ message: 'Signed out successfully' });
  });

  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const { publicKey } = ensureVapidKeys(db);
    const unread = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user!.id) as { count: number };
    res.json({
      user: req.user,
      vapidPublicKey: publicKey,
      unreadNotifications: unread.count,
    });
  });

  // ============================================================================
  // 2. GROUPS / DEPARTMENTS & USERS (ORG-01 to ORG-05 + Admin Account Approval)
  // ============================================================================

  // Public active groups list for registration dropdown
  app.get('/api/public/groups', (_req: Request, res: Response) => {
    const db = getDb();
    const groups = db.prepare('SELECT id, name, code, is_active FROM departments WHERE is_active = 1 ORDER BY id ASC').all();
    res.json({ groups });
  });

  const MAPTILER_API_KEY = process.env.MAPTILER_API_KEY || process.env.VITE_MAPTILER_API_KEY || 'KHmsrWcJhgdZjirijNbw';

  // Comprehensive Indonesian Corporate, Industrial, Transit & Landmark POI Catalog
  const INDONESIAN_POIS = [
    // Operational Plants & Pools
    { name: 'Manufacturing Plant 1', address: 'Jl. Danau Sunter Barat No. 8, Sunter Jaya, Jakarta Utara', lat: -6.13842, lon: 106.88561, keywords: 'plant 1 sunter pabrik manufaktur factory main' },
    { name: 'Manufacturing Plant 2', address: 'Kawasan Industri KIIC Lot A-1, Telukjambe Timur, Karawang Barat', lat: -6.34789, lon: 107.28912, keywords: 'plant 2 karawang kiic pabrik factory assembly' },
    { name: 'Cikarang Assembly Plant', address: 'Greenland International Industrial Center (GIIC), Deltamas, Cikarang Pusat', lat: -6.37521, lon: 107.16834, keywords: 'plant cikarang giic deltamas assembly pabrik' },
    { name: 'Central Fleet Pool & Operations Base', address: 'Jl. Rawa Gelam IV No. 2, Kawasan Industri Pulogadung, Jakarta Timur', lat: -6.19834, lon: 106.88873, keywords: 'central fleet pool hq operational car pool parkir pulogadung base' },
    { name: 'Karawang Staging Pool', address: 'Jl. Surya Madya VI, Kawasan Industri Suryacipta, Karawang Timur', lat: -6.38891, lon: 107.34567, keywords: 'pool karawang suryacipta operational car fleet' },
    { name: 'Cikarang Fleet Depot', address: 'Kawasan Industri MM2100 Blok C, Cikarang Barat, Bekasi', lat: -6.29412, lon: 107.08745, keywords: 'pool cikarang mm2100 depot fleet armada' },

    // Headquarters & Corporate Offices
    { name: 'Head Office - SCBD District 8', address: 'District 8 SCBD, Treasury Tower Lt. 35, Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan', lat: -6.22728, lon: 106.80816, keywords: 'head office scbd sudirman district 8 treasury tower hq kantor pusat' },
    { name: 'Menara Astra Regional Office', address: 'Jl. Jend. Sudirman Kav. 5-6, Karet Tengsin, Jakarta Pusat', lat: -6.20845, lon: 106.82231, keywords: 'menara astra sudirman karet tengsin office kantor' },
    { name: 'Pondok Indah Office Tower 3', address: 'Jl. Sultan Iskandar Muda Kav. V-TA, Pondok Indah, Jakarta Selatan', lat: -6.28421, lon: 106.78215, keywords: 'pondok indah office tower piot south jakarta kantor cabang' },
    { name: 'Logistics Hub & Distribution Center', address: 'Kawasan Marunda Center Blok B, Tarumajaya, Bekasi', lat: -6.11542, lon: 106.97451, keywords: 'logistics hub distribution center marunda gudang depo' },
    { name: 'R&D Tech Center BSD', address: 'BSD Green Office Park 9, Jl. Grand Boulevard, BSD City, Tangerang', lat: -6.30214, lon: 106.65219, keywords: 'tech center r&d bsd green office park tangerang' },

    // Airports & Transit Stations
    { name: 'Bandara Internasional Soekarno-Hatta (CGK) - Terminal 3', address: 'Bandara Soekarno-Hatta Terminal 3 Ultimate, Benda, Kota Tangerang', lat: -6.12556, lon: 106.65589, keywords: 'bandara airport soekarno hatta cgk soetta terminal 3 ultimate t3 tangerang' },
    { name: 'Bandara Internasional Soekarno-Hatta (CGK) - Terminal 1 & 2', address: 'Bandara Soekarno-Hatta Terminal 1-2, Benda, Kota Tangerang', lat: -6.13012, lon: 106.65421, keywords: 'bandara airport soekarno hatta cgk soetta terminal 1 2 t1 t2 tangerang' },
    { name: 'Bandara Halim Perdanakusuma (HLP)', address: 'Jl. Halim Perdana Kusuma, Makasar, Jakarta Timur', lat: -6.26654, lon: 106.89087, keywords: 'bandara airport halim perdanakusuma hlp jakarta timur' },
    { name: 'Stasiun Kereta Cepat Whoosh Halim (KCIC)', address: 'Jl. Akses Stasiun Kereta Cepat Halim, Makasar, Jakarta Timur', lat: -6.24876, lon: 106.88765, keywords: 'stasiun kcic whoosh halim kereta cepat station jakarta timur' },
    { name: 'Stasiun Kereta Cepat Whoosh Karawang (KCIC)', address: 'Wanakerta, Telukjambe Barat, Karawang', lat: -6.36845, lon: 107.24123, keywords: 'stasiun kcic whoosh karawang kereta cepat station telukjambe' },
    { name: 'Stasiun Kereta Cepat Whoosh Padalarang (KCIC)', address: 'Kertajaya, Padalarang, Kabupaten Bandung Barat', lat: -6.83987, lon: 107.48123, keywords: 'stasiun kcic whoosh padalarang bandung barat station' },
    { name: 'Stasiun Gambir', address: 'Jl. Medan Merdeka Timur No. 1, Gambir, Jakarta Pusat', lat: -6.17667, lon: 106.83056, keywords: 'stasiun gambir central station kereta api monas' },
    { name: 'Stasiun Pasar Senen', address: 'Jl. Stasiun Senen No. 1, Senen, Jakarta Pusat', lat: -6.17421, lon: 106.84432, keywords: 'stasiun pasar senen kereta api station senen' },
    { name: 'Stasiun Manggarai', address: 'Jl. Manggarai Utara 1, Tebet, Jakarta Selatan', lat: -6.20987, lon: 106.85012, keywords: 'stasiun manggarai transit krl central station' },
    { name: 'Stasiun MRT Bundaran HI Bank DKI', address: 'Jl. MH Thamrin, Gondangdia, Menteng, Jakarta Pusat', lat: -6.19254, lon: 106.82312, keywords: 'stasiun mrt bundaran hi thamrin menteng' },
    { name: 'Stasiun MRT Blok M BCA', address: 'Jl. Panglima Polim, Melawai, Kebayoran Baru, Jakarta Selatan', lat: -6.24432, lon: 106.79845, keywords: 'stasiun mrt blok m kebayoran baru' },
    { name: 'Terminal Terpadu Pulo Gebang', address: 'Jl. Sentra Primer Timur, Cakung, Jakarta Timur', lat: -6.21234, lon: 106.95321, keywords: 'terminal pulo gebang bus station cakung' },

    // Key Industrial Estates
    { name: 'Kawasan Industri MM2100', address: 'Jl. Irian, Cikarang Barat, Kabupaten Bekasi', lat: -6.29412, lon: 107.08745, keywords: 'mm2100 cikarang barat bekasi industrial estate kawasan industri' },
    { name: 'Kawasan Industri Jababeka 1 & 2', address: 'Jl. Jababeka Raya, Harja Mekar, Cikarang Utara, Bekasi', lat: -6.31145, lon: 107.14231, keywords: 'jababeka cikarang baru industri estate bekasi' },
    { name: 'Kawasan Industri EJIP', address: 'East Jakarta Industrial Park, Sukaresmi, Cikarang Selatan, Bekasi', lat: -6.32789, lon: 107.11245, keywords: 'ejip cikarang selatan industrial park bekasi' },
    { name: 'Kawasan Industri KIIC Karawang', address: 'Jl. Permata Raya, Karawang Barat, Karawang', lat: -6.35678, lon: 107.27654, keywords: 'kiic karawang barat international industrial city' },
    { name: 'Kawasan Industri Suryacipta', address: 'Jl. Surya Madya, Kutamekar, Ciampel, Karawang', lat: -6.38891, lon: 107.34567, keywords: 'suryacipta city of industry karawang timur ciampel' },

    // Major Business Districts & Malls
    { name: 'Pacific Place Mall & SCBD', address: 'Jl. Jend. Sudirman Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan', lat: -6.22435, lon: 106.80976, keywords: 'pacific place scbd ritz carlton sudirman senayan' },
    { name: 'Grand Indonesia & Plaza Indonesia', address: 'Jl. M.H. Thamrin No. 1, Menteng, Jakarta Pusat', lat: -6.19512, lon: 106.82145, keywords: 'grand indonesia gi pi plaza indonesia bundaran hi thamrin' },
    { name: 'Senayan City & Plaza Senayan', address: 'Jl. Asia Afrika No. 19, Gelora, Tanah Abang, Jakarta Pusat', lat: -6.22689, lon: 106.79874, keywords: 'senayan city senci plaza senayan asia afrika' },
    { name: 'Central Park Mall & Neo Soho', address: 'Jl. Letjen S. Parman Kav. 28, Tanjung Duren, Jakarta Barat', lat: -6.17743, lon: 106.79012, keywords: 'central park neo soho grogol tanjung duren jakarta barat' },
    { name: 'Mall Kelapa Gading (MKG)', address: 'Jl. Boulevard Raya, Kelapa Gading Timur, Jakarta Utara', lat: -6.15789, lon: 106.90876, keywords: 'mall kelapa gading mkg boulevard raya jakarta utara' },
    { name: 'Mega Kuningan Business District', address: 'Kawasan Mega Kuningan, Jl. DR. Ide Anak Agung Gde Agung, Jakarta Selatan', lat: -6.22891, lon: 106.82876, keywords: 'mega kuningan ritz carlton marriott kedubes jakarta selatan' },
    { name: 'Gelora Bung Karno (GBK)', address: 'Jl. Pintu Satu Senayan, Gelora, Jakarta Pusat', lat: -6.21845, lon: 106.80198, keywords: 'gbk gelora bung karno stadion senayan' },
    { name: 'Monumen Nasional (Monas)', address: 'Gambir, Jakarta Pusat, DKI Jakarta', lat: -6.17539, lon: 106.82715, keywords: 'monas monumen nasional gambir medan merdeka jakarta pusat' },

    // Medical Centers & Hospitals
    { name: 'RS Cipto Mangunkusumo (RSCM)', address: 'Jl. Pangeran Diponegoro No. 71, Kenari, Senen, Jakarta Pusat', lat: -6.19789, lon: 106.84876, keywords: 'rscm cipto mangunkusumo rumah sakit hospital salemba senen' },
    { name: 'RS Siloam Lippo Cikarang', address: 'Jl. M.H. Thamrin Kav. 105, Lippo Cikarang, Bekasi', lat: -6.32654, lon: 107.13542, keywords: 'rs siloam lippo cikarang rumah sakit hospital bekasi' },
    { name: 'RS Medistra Jakarta', address: 'Jl. Gatot Subroto Kav. 59, Kuningan Barat, Jakarta Selatan', lat: -6.24123, lon: 106.83456, keywords: 'rs medistra gatot subroto rumah sakit kuningan' },
    { name: 'RS Pondok Indah', address: 'Jl. Metro Pondok Indah Kav. UE, Kebayoran Lama, Jakarta Selatan', lat: -6.28234, lon: 106.78291, keywords: 'rs pondok indah rspi rumah sakit hospital' },
    { name: 'RS Mitra Keluarga Kelapa Gading', address: 'Jl. Raya Gading Kirana No. 2, Kelapa Gading Barat, Jakarta Utara', lat: -6.15432, lon: 106.89678, keywords: 'rs mitra keluarga kelapa gading rumah sakit' },

    // Government & Convention Centers
    { name: 'Balai Kota DKI Jakarta', address: 'Jl. Medan Merdeka Selatan No. 8-9, Gambir, Jakarta Pusat', lat: -6.18123, lon: 106.82845, keywords: 'balai kota dki jakarta gubernur gambir merdeka selatan' },
    { name: 'Jakarta Convention Center (JCC)', address: 'Jl. Gatot Subroto No. 1, Gelora, Tanah Abang, Jakarta Pusat', lat: -6.21456, lon: 106.80678, keywords: 'jcc jakarta convention center senayan gatot subroto' },
    { name: 'JIExpo Kemayoran', address: 'Gedung Pusat Niaga, Arena PRJ Kemayoran, Jakarta Pusat', lat: -6.14876, lon: 106.84567, keywords: 'jiexpo kemayoran prj pameran arena expo' },
    { name: 'Indonesia Convention Exhibition (ICE BSD)', address: 'Jl. BSD Grand Boulevard Raya No. 1, Pagedangan, Tangerang', lat: -6.30123, lon: 106.63678, keywords: 'ice bsd convention exhibition tangerang bsd' },

    // Regional City Centers
    { name: 'Cikarang Pusat - Pemda Bekasi', address: 'Sukamahi, Cikarang Pusat, Kabupaten Bekasi, Jawa Barat', lat: -6.36389, lon: 107.17222, keywords: 'cikarang pusat pemda deltamas bekasi' },
    { name: 'Karawang Barat Kota', address: 'Nagirbakar, Karawang Barat, Kabupaten Karawang, Jawa Barat', lat: -6.30722, lon: 107.29361, keywords: 'karawang barat alun alun kota karawang' },
    { name: 'Bekasi Kota - Alun-Alun', address: 'Jl. Veteran No. 34, Marga Jaya, Bekasi Selatan, Kota Bekasi', lat: -6.23828, lon: 106.97557, keywords: 'bekasi kota alun alun stasiun summarecon bekasi' },
    { name: 'Tangerang Kota', address: 'Jl. Satria Sudirman, Sukaasih, Kota Tangerang, Banten', lat: -6.17831, lon: 106.63189, keywords: 'tangerang kota bale kota tangcity banten' },
    { name: 'Bogor Kota - Kebun Raya', address: 'Jl. Ir. H. Juanda No. 13, Paledang, Kota Bogor, Jawa Barat', lat: -6.59715, lon: 106.80604, keywords: 'bogor kebun raya istana bogor pajajaran' }
  ];

  // MapTiler Geocoding & Reverse Geocoding Proxy (with instant Indonesian Corporate POIs and Nominatim fallback)
  app.get('/api/geocode/search', requireAuth, async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      res.json({ results: [] });
      return;
    }

    const normQuery = q.toLowerCase();
    const queryTokens = normQuery.split(/\s+/).filter(Boolean);

    // 1. Instant Match from Local Indonesian Corporate & Regional POI Directory
    const matchedPois: Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number; score: number }> = [];
    for (const poi of INDONESIAN_POIS) {
      const nameLower = poi.name.toLowerCase();
      const addrLower = poi.address.toLowerCase();
      const kwLower = poi.keywords.toLowerCase();

      let score = 0;
      if (nameLower.startsWith(normQuery)) {
        score += 100;
      } else if (nameLower.includes(normQuery)) {
        score += 70;
      }

      let allTokensMatch = true;
      for (const tok of queryTokens) {
        if (nameLower.includes(tok) || addrLower.includes(tok) || kwLower.includes(tok)) {
          score += 20;
        } else {
          allTokensMatch = false;
        }
      }

      if (score > 0 || allTokensMatch) {
        matchedPois.push({
          place_id: `poi_${poi.lat}_${poi.lon}`,
          name: poi.name,
          address: poi.address,
          lat: poi.lat,
          lon: poi.lon,
          score,
        });
      }
    }

    matchedPois.sort((a, b) => b.score - a.score);

    const results: Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }> = matchedPois
      .slice(0, 5)
      .map(({ score: _s, ...rest }) => rest);

    // 2. Fetch live MapTiler Geocoding strictly constrained to Indonesia with proximity to Jakarta/West Java
    try {
      const maptilerUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${encodeURIComponent(
        MAPTILER_API_KEY
      )}&country=id&proximity=106.88873,-6.19834&bbox=95.0,-11.0,141.0,6.0&limit=8&language=id,en`;

      const mtResp = await fetch(maptilerUrl, { signal: AbortSignal.timeout(3500) }).catch(() => null);
      if (mtResp && mtResp.ok) {
        const mtData = (await mtResp.json()) as { features?: Array<any> };
        if (Array.isArray(mtData.features) && mtData.features.length > 0) {
          for (const feat of mtData.features) {
            const center = Array.isArray(feat.center) ? feat.center : feat.geometry?.coordinates || [106.88873, -6.19834];
            const placeName = String(feat.place_name || feat.text || q);
            const primary = String(feat.text || placeName.split(',')[0] || q).trim();
            const lat = Number(center[1]);
            const lon = Number(center[0]);

            // Prevent duplicate locations within 300 meters of existing results
            const isDuplicate = results.some(
              (r) => Math.abs(r.lat - lat) < 0.003 && Math.abs(r.lon - lon) < 0.003
            );
            if (!isDuplicate && Number.isFinite(lat) && Number.isFinite(lon)) {
              results.push({
                place_id: feat.id || `mt_${results.length + 1}`,
                name: primary,
                address: placeName,
                lat,
                lon,
              });
            }
          }
        }
      }
    } catch {
      // MapTiler query timed out or failed; continue with results gathered
    }

    // 3. Fallback to OpenStreetMap Nominatim with strict country code and viewbox if results are sparse (< 4)
    if (results.length < 4) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=id&viewbox=105.0,-7.5,108.5,-5.5&bounded=0&limit=6&q=${encodeURIComponent(
          q
        )}`;
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'GalaxyFleet/2.0 (Corporate Fleet Management System)',
            'Accept-Language': 'id,en',
          },
          signal: AbortSignal.timeout(3500),
        }).catch(() => null);

        if (resp && resp.ok) {
          const data = (await resp.json()) as Array<any>;
          for (const item of Array.isArray(data) ? data : []) {
            const display = String(item.display_name || '');
            const primary = item.name || display.split(',')[0] || q;
            const lat = Number(item.lat);
            const lon = Number(item.lon);

            const isDuplicate = results.some(
              (r) => Math.abs(r.lat - lat) < 0.003 && Math.abs(r.lon - lon) < 0.003
            );
            if (!isDuplicate && Number.isFinite(lat) && Number.isFinite(lon)) {
              results.push({
                place_id: item.place_id,
                name: String(primary).trim(),
                address: display,
                lat,
                lon,
              });
            }
          }
        }
      } catch {
        // Nominatim query timed out or failed
      }
    }

    res.json({ results: results.slice(0, 10) });
  });

  app.get('/api/geocode/reverse', requireAuth, async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: 'Valid lat and lon are required' });
      return;
    }
    try {
      const maptilerUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(String(lon))},${encodeURIComponent(String(lat))}.json?key=${encodeURIComponent(MAPTILER_API_KEY)}&limit=1&language=id,en`;
      const mtResp = await fetch(maptilerUrl);
      if (mtResp.ok) {
        const mtData = (await mtResp.json()) as { features?: Array<any> };
        const feat = mtData.features?.[0];
        if (feat) {
          const placeName = String(feat.place_name || feat.text || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
          const primary = String(feat.text || placeName.split(',')[0] || `${lat.toFixed(5)}, ${lon.toFixed(5)}`).trim();
          res.json({
            name: primary,
            address: placeName,
            lat,
            lon,
            place: { name: primary, address: placeName, lat, lon },
          });
          return;
        }
      }

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'GalaxyFleet/2.0 (Corporate Fleet Management System)',
          'Accept-Language': 'en,id',
        },
      });
      if (!resp.ok) {
        res.json({
          name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          address: `Coordinates ${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          lat,
          lon,
        });
        return;
      }
      const item = (await resp.json()) as any;
      const display = String(item.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      const primary = item.name || display.split(',')[0] || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      res.json({
        name: String(primary).trim(),
        address: display,
        lat,
        lon,
        place: { name: String(primary).trim(), address: display, lat, lon },
      });
    } catch {
      res.json({
        name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        address: `Coordinates ${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        lat,
        lon,
      });
    }
  });

  // Real road route calculation (Path geometry, Distance km, Ride time min, Arrival ETA)
  app.get('/api/route', requireAuth, async (req: Request, res: Response) => {
    const originLat = Number(req.query.originLat);
    const originLon = Number(req.query.originLon);
    const destLat = Number(req.query.destLat);
    const destLon = Number(req.query.destLon);
    const departureTimeRaw = req.query.departureTime ? String(req.query.departureTime) : '';

    if (
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLon) ||
      !Number.isFinite(destLat) ||
      !Number.isFinite(destLon)
    ) {
      res.status(400).json({ error: 'Valid originLat, originLon, destLat, and destLon are required' });
      return;
    }

    const baseDepartureMs =
      departureTimeRaw && !Number.isNaN(new Date(departureTimeRaw).getTime())
        ? new Date(departureTimeRaw).getTime()
        : Date.now();

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(String(originLon))},${encodeURIComponent(String(originLat))};${encodeURIComponent(String(destLon))},${encodeURIComponent(String(destLat))}?overview=full&geometries=geojson`;
      const resp = await fetch(osrmUrl, {
        headers: {
          'User-Agent': 'GalaxyFleetManagement/2.0 (Indonesian Fleet System)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as {
          code?: string;
          routes?: Array<{
            distance?: number;
            duration?: number;
            geometry?: { coordinates?: Array<[number, number]> };
          }>;
        };
        const route = data.routes?.[0];
        if (route && typeof route.distance === 'number' && typeof route.duration === 'number') {
          const distanceKm = Math.max(0.2, Number((route.distance / 1000).toFixed(1)));
          // Apply realistic urban traffic factor (1.20x on raw free-flow OSRM duration)
          const durationMin = Math.max(2, Math.round((route.duration * 1.20) / 60));
          const etaDate = new Date(baseDepartureMs + durationMin * 60_000);
          const etaText = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const coords = Array.isArray(route.geometry?.coordinates)
            ? route.geometry!.coordinates
              .filter((pt) => Array.isArray(pt) && pt.length >= 2)
              .map((pt) => [Number(pt[1]), Number(pt[0])] as [number, number])
            : ([
                [originLat, originLon],
                [destLat, destLon],
              ] as Array<[number, number]>);

          res.json({
            distanceKm,
            durationMin,
            etaIso: etaDate.toISOString(),
            etaText,
            geometry: coords.length >= 2 ? coords : [[originLat, originLon], [destLat, destLon]],
            source: 'osrm',
          });
          return;
        }
      }
    } catch {
      // Fallback to Highway-Aware Corridor Routing below
    }

    // Fallback: Real road calculation using Greater Jakarta highway network corridors
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(destLat - originLat);
    const dLon = toRad(destLon - originLon);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(originLat)) * Math.cos(toRad(destLat)) * Math.sin(dLon / 2) ** 2;
    const straightKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Road winding factor: 1.28x for tollway corridors, 1.38x for city streets
    const distanceKm = Math.max(0.5, Number((straightKm * (straightKm > 15 ? 1.25 : 1.34)).toFixed(1)));

    // Realistic Jabodetabek traffic speed model (22 km/h city, 48 km/h toll)
    const effectiveSpeedKmh = straightKm < 6 ? 22 : straightKm < 20 ? 32 : 46;
    const durationMin = Math.max(3, Math.round((distanceKm / effectiveSpeedKmh) * 60));
    const etaDate = new Date(baseDepartureMs + durationMin * 60_000);
    const etaText = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Major Indonesian road and tollway corridor pivot nodes
    const CORRIDOR_NODES: Array<[number, number]> = [
      [-6.13012, 106.65421], // Bandara Soekarno-Hatta Soedyatmo Toll
      [-6.15542, 106.74512], // Pluit - Cengkareng Interchange
      [-6.17743, 106.79012], // Tomang Interchange (Grogol)
      [-6.21987, 106.81543], // Semanggi Interchange (Sudirman)
      [-6.24123, 106.86541], // Cawang Interchange (Inner Ring x Cikampek Toll)
      [-6.19834, 106.88873], // Pulogadung Industrial Corridor
      [-6.24876, 106.88765], // Halim KCIC / Jagorawi Junction
      [-6.24812, 106.99234], // Bekasi Barat Toll Gate
      [-6.30541, 107.09845], // Cikarang Barat MM2100 Toll Gate
      [-6.36845, 107.16541], // Cikarang Pusat / Deltamas Toll Gate
      [-6.34215, 107.27812], // Karawang Barat KIIC Toll Gate
      [-6.38891, 107.34567], // Karawang Timur Suryacipta Toll Gate
    ];

    // Find if any corridor nodes lie reasonably along the travel vector
    const minLat = Math.min(originLat, destLat) - 0.03;
    const maxLat = Math.max(originLat, destLat) + 0.03;
    const minLon = Math.min(originLon, destLon) - 0.03;
    const maxLon = Math.max(originLon, destLon) + 0.03;

    const intermediateNodes = CORRIDOR_NODES.filter(([nLat, nLon]) => {
      return nLat >= minLat && nLat <= maxLat && nLon >= minLon && nLon <= maxLon;
    }).sort((a, b) => {
      // Sort in direction from origin to destination
      const distA = Math.hypot(a[0] - originLat, a[1] - originLon);
      const distB = Math.hypot(b[0] - originLat, b[1] - originLon);
      return distA - distB;
    });

    const anchors: Array<[number, number]> = [[originLat, originLon], ...intermediateNodes, [destLat, destLon]];

    // Interpolate smooth multi-segment path that traces road network
    const geometry: Array<[number, number]> = [];
    for (let seg = 0; seg < anchors.length - 1; seg++) {
      const p1 = anchors[seg];
      const p2 = anchors[seg + 1];
      const subSteps = Math.max(4, Math.min(12, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 120)));
      for (let s = 0; s < subSteps; s++) {
        const t = s / subSteps;
        const curLat = p1[0] + (p2[0] - p1[0]) * t;
        const curLon = p1[1] + (p2[1] - p1[1]) * t;
        geometry.push([Number(curLat.toFixed(6)), Number(curLon.toFixed(6))]);
      }
    }
    geometry.push([destLat, destLon]);

    res.json({
      distanceKm,
      durationMin,
      etaIso: etaDate.toISOString(),
      etaText,
      geometry,
      source: 'fallback',
    });
  });

  app.get('/api/departments', requireAuth, (_req: Request, res: Response) => {
    const db = getDb();
    const departments = db.prepare('SELECT * FROM departments ORDER BY id ASC').all();
    res.json({ departments });
  });

  app.post('/api/departments', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const { name, code } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }
    const cleanName = name.trim();
    const cleanCode = (code ? String(code).trim() : cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)).toUpperCase() || `GRP${Date.now() % 1000}`;
    const existing = db.prepare('SELECT id FROM departments WHERE name = ? OR code = ?').get(cleanName, cleanCode);
    if (existing) {
      res.status(409).json({ error: 'Group name or code already exists' });
      return;
    }
    const result = db.prepare('INSERT INTO departments (name, code, is_active) VALUES (?, ?, 1)').run(cleanName, cleanCode);
    const created = db.prepare('SELECT * FROM departments WHERE id = ?').get(Number(result.lastInsertRowid));
    recordAudit(db, req.user, 'DEPARTMENT_CREATED', 'DEPARTMENT', Number(result.lastInsertRowid), null, created);
    res.status(201).json({ department: created });
  });

  app.patch('/api/departments/:id', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const deptId = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM departments WHERE id = ?').get(deptId) as { id: number; name: string; code: string; is_active: number } | undefined;
    if (!prev) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    const nextName = req.body?.name !== undefined ? String(req.body.name).trim() : prev.name;
    const nextCode = req.body?.code !== undefined ? String(req.body.code).trim().toUpperCase() : prev.code;
    const nextActive = req.body?.is_active !== undefined ? (req.body.is_active ? 1 : 0) : prev.is_active;
    db.prepare('UPDATE departments SET name = ?, code = ?, is_active = ? WHERE id = ?').run(nextName, nextCode, nextActive, deptId);
    const next = db.prepare('SELECT * FROM departments WHERE id = ?').get(deptId);
    recordAudit(db, req.user, 'DEPARTMENT_UPDATED', 'DEPARTMENT', deptId, prev, next);
    res.json({ department: next });
  });

  app.post('/api/departments/:id/deactivate', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const deptId = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM departments WHERE id = ?').get(deptId);
    if (!prev) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    db.prepare('UPDATE departments SET is_active = 0 WHERE id = ?').run(deptId);
    const next = db.prepare('SELECT * FROM departments WHERE id = ?').get(deptId);
    recordAudit(db, req.user, 'DEPARTMENT_DEACTIVATED', 'DEPARTMENT', deptId, prev, next);
    res.json({ department: next });
  });

  app.get('/api/users', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (_req: Request, res: Response) => {
    const db = getDb();
    const users = db
      .prepare(
        `SELECT u.id, u.nickname, u.group_username, u.role, u.is_department_admin,
                u.department_id, d.name as department_name, u.approval_status,
                u.approved_by, u.approved_at, u.rejection_reason, u.is_active, u.created_at,
                dp.id as driver_profile_id
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN driver_profiles dp ON dp.user_id = u.id
         ORDER BY CASE WHEN u.approval_status = 'PENDING_APPROVAL' THEN 0 ELSE 1 END, u.id ASC`
      )
      .all();
    res.json({ users });
  });

  const handleCreateUser = (req: Request, res: Response) => {
    const db = getDb();
    const { nickname, group_username, password, role, is_department_admin, group_name } = req.body ?? {};
    let department_id = req.body?.department_id;
    if (!department_id && group_name) {
      const foundDept = db.prepare('SELECT id FROM departments WHERE name LIKE ?').get(`%${group_name}%`) as { id: number } | undefined;
      if (foundDept) department_id = foundDept.id;
    }
    if (!department_id) department_id = 1;

    if (!nickname || !group_username || !password || !role) {
      res.status(400).json({ error: 'nickname, group_username, password, and role are required' });
      return;
    }
    if (!['ADM', 'FM', 'HWS', 'DRV', 'EMP'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE group_username = ?').get(group_username.trim());
    if (existing) {
      res.status(409).json({ error: 'group_username already exists' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO users (nickname, group_username, password_hash, role, is_department_admin, department_id, approval_status, approved_by, approved_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', ?, datetime('now'), 1)`
      )
      .run(nickname.trim(), group_username.trim(), hashPassword(password), role, is_department_admin ? 1 : 0, Number(department_id), req.user!.id);

    const newId = Number(result.lastInsertRowid);
    if (role === 'DRV') {
      db.prepare(
        `INSERT OR IGNORE INTO driver_profiles (user_id, full_name, licence_number, licence_class, licence_expiry, contact_number, availability_status)
         VALUES (?, ?, ?, 'A', '2028-12-31', '+62-800-0000', 'Active')`
      ).run(newId, nickname.trim(), `SIM-A-${100000 + newId}`);
    }

    const created = db.prepare('SELECT id, nickname, group_username, role, is_department_admin, department_id, approval_status, is_active FROM users WHERE id = ?').get(newId);
    recordAudit(db, req.user, 'USER_CREATED', 'USER', newId, null, created);
    res.status(201).json({ user: created });
  };

  app.post('/api/users', requireAuth, requireRoles(['ADM']), handleCreateUser);
  app.post('/api/admin/users', requireAuth, requireRoles(['ADM']), handleCreateUser);


  app.patch('/api/users/:id', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const targetId = Number(req.params.id);
    const prev = db
      .prepare('SELECT id, nickname, group_username, role, is_department_admin, department_id, approval_status, is_active FROM users WHERE id = ?')
      .get(targetId) as
      | {
          id: number;
          nickname: string;
          group_username: string;
          role: string;
          is_department_admin: number;
          department_id: number;
          approval_status: string;
          is_active: number;
        }
      | undefined;

    if (!prev) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { nickname, role, is_department_admin, department_id, approval_status, rejection_reason, is_active } = req.body ?? {};
    const nextRole = role ?? prev.role;
    if (!['ADM', 'FM', 'HWS', 'DRV', 'EMP'].includes(nextRole)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const nextApproval = approval_status ?? prev.approval_status;
    if (!['PENDING_APPROVAL', 'APPROVED', 'REJECTED'].includes(nextApproval)) {
      res.status(400).json({ error: 'Invalid approval_status' });
      return;
    }

    const nextActive = is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active;

    db.prepare(
      `UPDATE users
       SET nickname = ?,
           role = ?,
           is_department_admin = ?,
           department_id = ?,
           approval_status = ?,
           approved_by = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by END,
           approved_at = CASE WHEN ? = 'APPROVED' THEN datetime('now') ELSE approved_at END,
           rejection_reason = ?,
           is_active = ?
       WHERE id = ?`
    ).run(
      nickname ?? prev.nickname,
      nextRole,
      is_department_admin !== undefined ? (is_department_admin ? 1 : 0) : prev.is_department_admin,
      department_id !== undefined ? Number(department_id) : prev.department_id,
      nextApproval,
      nextApproval,
      req.user!.id,
      nextApproval,
      rejection_reason ?? null,
      nextActive,
      targetId
    );

    if (nextActive === 0) {
      db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(targetId);
    }

    if (nextRole === 'DRV' && nextApproval === 'APPROVED') {
      db.prepare(
        `INSERT OR IGNORE INTO driver_profiles (user_id, full_name, licence_number, licence_class, licence_expiry, contact_number, availability_status)
         VALUES (?, ?, ?, 'A', '2028-12-31', '+62-800-0000', 'Active')`
      ).run(targetId, nickname ?? prev.nickname, `SIM-A-${100000 + targetId}`);
    }

    const updated = db
      .prepare('SELECT id, nickname, group_username, role, is_department_admin, department_id, approval_status, is_active FROM users WHERE id = ?')
      .get(targetId);

    recordAudit(db, req.user, 'USER_UPDATED', 'USER', targetId, prev, updated);

    if (prev.approval_status !== nextApproval) {
      sendUserNotification(db, {
        userId: targetId,
        triggerType: `ACCOUNT_${nextApproval}`,
        title: nextApproval === 'APPROVED' ? 'Account Approved by Administrator' : 'Account Registration Update',
        body:
          nextApproval === 'APPROVED'
            ? `Welcome ${nickname ?? prev.nickname}! Your account (@${prev.group_username}) has been approved with role ${nextRole}.`
            : `Your account registration was marked as ${nextApproval}.`,
        relatedEntityType: 'USER',
        relatedEntityId: targetId,
      });
    }

    res.json({ user: updated });
  });

  app.delete('/api/users/:id', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }
    if (targetId === req.user!.id) {
      res.status(400).json({ error: 'Cannot delete your own active administrator account' });
      return;
    }

    const prev = db
      .prepare('SELECT id, nickname, group_username, role, is_department_admin, department_id, approval_status, is_active FROM users WHERE id = ?')
      .get(targetId) as Record<string, unknown> | undefined;

    if (!prev) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    db.exec('PRAGMA foreign_keys = OFF;');
    try {
      runInTransaction(db, () => {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
        db.prepare('DELETE FROM user_locations WHERE user_id = ?').run(targetId);
        db.prepare('DELETE FROM notifications WHERE user_id = ?').run(targetId);
        db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(targetId);
        db.prepare('DELETE FROM location_reports WHERE driver_user_id = ?').run(targetId);
        db.prepare('DELETE FROM driver_profiles WHERE user_id = ?').run(targetId);
        db.prepare('UPDATE users SET approved_by = NULL WHERE approved_by = ?').run(targetId);
        db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
        recordAudit(db, req.user, 'USER_DELETED', 'USER', targetId, prev, null);
      });
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }

    res.json({ ok: true, deletedId: targetId, deletedUserId: targetId });
  });


  // ============================================================================
  // 3. VEHICLE MANAGEMENT (VEH-01 to VEH-07, Revision #3 Edit & Standby)
  // ============================================================================

  app.get('/api/vehicles', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const vehicles = db
      .prepare(
        `SELECT v.*, dp.full_name as default_driver_name, dp.contact_number as default_driver_phone
         FROM vehicles v
         LEFT JOIN driver_profiles dp ON dp.id = v.default_driver_id
         ORDER BY v.id ASC`
      )
      .all() as Array<Record<string, unknown>>;
    const canViewGps = isPrivilegedRole(req.user!);

    const enriched = vehicles.map((v) => {
      const activeBooking = db
        .prepare(
          `SELECT b.id, b.status, b.start_time, b.end_time, b.purpose, u.nickname as booked_by_name
           FROM bookings b
           LEFT JOIN users u ON u.id = b.booked_by
           WHERE b.vehicle_id = ? AND b.status IN ('PENDING_APPROVAL', 'ACTIVE', 'IN_PROGRESS')
           ORDER BY b.start_time ASC LIMIT 1`
        )
        .get(Number(v.id));

      const latestGps = canViewGps
        ? db
            .prepare(
              `SELECT id, latitude, longitude, accuracy_meters, capture_time, server_receipt_time, permission_state
               FROM location_reports
               WHERE vehicle_id = ?
               ORDER BY id DESC LIMIT 1`
            )
            .get(Number(v.id))
        : null;

      return {
        ...v,
        activeBooking: activeBooking ?? null,
        latestGps: latestGps ?? null,
      };
    });

    res.json({ vehicles: enriched });
  });

  // VEH-05: 360-degree vehicle detail view bringing together all records for that vehicle only
  app.get('/api/vehicles/:id', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const vehicleId = Number(req.params.id);
    const vehicle = db
      .prepare(
        `SELECT v.*, dp.full_name as default_driver_name, dp.contact_number as default_driver_phone
         FROM vehicles v
         LEFT JOIN driver_profiles dp ON dp.id = v.default_driver_id
         WHERE v.id = ?`
      )
      .get(vehicleId);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const bookings = db.prepare('SELECT * FROM bookings WHERE vehicle_id = ? ORDER BY start_time DESC').all(vehicleId);
    const assignments = db
      .prepare(
        `SELECT a.*, dp.full_name as driver_name
         FROM assignments a
         LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
         WHERE a.vehicle_id = ?
         ORDER BY a.id DESC`
      )
      .all(vehicleId);
    const fuelRecords = db.prepare('SELECT * FROM fuel_records WHERE vehicle_id = ? ORDER BY date_time DESC').all(vehicleId);
    const evRecords = db.prepare('SELECT * FROM ev_charging_records WHERE vehicle_id = ? ORDER BY date_time DESC').all(vehicleId);
    const maintenanceRecords = db.prepare('SELECT * FROM maintenance_records WHERE vehicle_id = ? ORDER BY service_date DESC').all(vehicleId);
    const expenses = db.prepare('SELECT * FROM expenses WHERE vehicle_id = ? ORDER BY date_time DESC').all(vehicleId);
    const documents = db
      .prepare(
        `SELECT id, entity_type, entity_id, doc_type, file_name, mime_type, size_bytes, expiry_date, version_number, created_at
         FROM documents
         WHERE entity_type = 'VEHICLE' AND entity_id = ? AND replaced_by_id IS NULL
         ORDER BY id DESC`
      )
      .all(vehicleId);

    const latestLocation = isPrivilegedRole(req.user!)
      ? db.prepare('SELECT * FROM location_reports WHERE vehicle_id = ? ORDER BY id DESC LIMIT 1').get(vehicleId)
      : null;

    res.json({
      vehicle,
      bookings,
      assignments,
      fuelRecords,
      evRecords,
      maintenanceRecords,
      expenses,
      documents,
      latestLocation: latestLocation ?? null,
    });
  });

  app.post('/api/vehicles', requireAuth, requireRoles(['ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const resolvedPlate = (req.body?.registration_plate || req.body?.plate_number || '').trim();
    const resolvedMake = (req.body?.make || (req.body?.model_name ? req.body.model_name.split(' ')[0] : 'Fleet')).trim();
    const resolvedModel = (req.body?.model || req.body?.model_name || 'Vehicle').trim();
    const resolvedVin = (req.body?.vin || `VIN-${Date.now()}-${Math.floor(Math.random() * 10000)}`).trim();
    const resolvedCarType = (req.body?.car_type || 'Sedan').trim();
    const resolvedYear = Number(req.body?.year || 2025);
    const resolvedEnergy = (req.body?.energy_type || 'Gasoline').trim();
    const resolvedSeats = Number(req.body?.seats || req.body?.capacity || 5);
    const resolvedOdo = Number(req.body?.current_odometer || 0);
    const resolvedBattery = resolvedEnergy === 'Electric' ? Number(req.body?.battery_percent ?? 100) : null;
    const resolvedStatus = req.body?.status || 'Available';
    const resolvedStandby = req.body?.standby_reason ?? null;
    const resolvedSpot = req.body?.last_parking_spot || req.body?.pool_location || 'HQ Main Lot';
    const resolvedDefaultDriverId = req.body?.default_driver_id ? Number(req.body.default_driver_id) : null;

    if (!resolvedPlate || !resolvedMake || !resolvedModel) {
      res.status(400).json({ error: 'registration_plate (or plate_number), make, and model are mandatory fields (VEH-03)' });
      return;
    }
    if (!['Gasoline', 'Electric'].includes(resolvedEnergy)) {
      res.status(400).json({ error: 'energy_type is mandatory and must be Gasoline or Electric (VEH-02)' });
      return;
    }

    const dupPlate = db.prepare('SELECT id FROM vehicles WHERE registration_plate = ?').get(resolvedPlate);
    if (dupPlate) {
      res.status(409).json({ error: 'Duplicate registration_plate is not allowed (VEH-03)' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO vehicles (registration_plate, make, model, car_type, year, vin, energy_type, seats, current_odometer, battery_percent, status, standby_reason, last_parking_spot, default_driver_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        resolvedPlate,
        resolvedMake,
        resolvedModel,
        resolvedCarType,
        resolvedYear,
        resolvedVin,
        resolvedEnergy,
        resolvedSeats,
        resolvedOdo,
        resolvedBattery,
        resolvedStatus,
        resolvedStandby,
        resolvedSpot,
        resolvedDefaultDriverId
      );

    const created = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(result.lastInsertRowid));
    recordAudit(db, req.user, 'VEHICLE_CREATED', 'VEHICLE', Number(result.lastInsertRowid), null, created);
    res.status(201).json({ vehicle: created });
  });

  // Revision #3: Admin can edit car_type, registration_plate, make/model, and deactivate/standby any car
  app.patch('/api/vehicles/:id', requireAuth, requireRoles(['ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const vehicleId = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId) as Record<string, unknown> | undefined;
    if (!prev) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const {
      registration_plate,
      make,
      model,
      car_type,
      year,
      energy_type,
      seats,
      current_odometer,
      battery_percent,
      status,
      standby_reason,
      last_parking_spot,
      default_driver_id,
    } = req.body ?? {};

    const nextPlate = registration_plate !== undefined ? String(registration_plate).trim() : String(prev.registration_plate);
    if (!nextPlate) {
      res.status(400).json({ error: 'registration_plate cannot be empty' });
      return;
    }

    const dup = db.prepare('SELECT id FROM vehicles WHERE registration_plate = ? AND id != ?').get(nextPlate, vehicleId);
    if (dup) {
      res.status(409).json({ error: 'Duplicate registration_plate is not allowed (VEH-03)' });
      return;
    }

    const nextStatus = status ?? prev.status;
    if (!['Available', 'Standby', 'In Maintenance', 'Deactivated', 'Retired'].includes(String(nextStatus))) {
      res.status(400).json({ error: 'Invalid vehicle status' });
      return;
    }

    const nextEnergy = energy_type ?? prev.energy_type;
    if (!['Gasoline', 'Electric'].includes(String(nextEnergy))) {
      res.status(400).json({ error: 'Invalid energy_type' });
      return;
    }

    const nextDefaultDriver =
      default_driver_id !== undefined
        ? default_driver_id
          ? Number(default_driver_id)
          : null
        : (prev.default_driver_id as number | null);

    db.prepare(
      `UPDATE vehicles
       SET registration_plate = ?,
           make = ?,
           model = ?,
           car_type = ?,
           year = ?,
           energy_type = ?,
           seats = ?,
           current_odometer = ?,
           battery_percent = ?,
           status = ?,
           standby_reason = ?,
           last_parking_spot = ?,
           default_driver_id = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      nextPlate,
      make !== undefined ? String(make).trim() : String(prev.make),
      model !== undefined ? String(model).trim() : String(prev.model),
      car_type !== undefined ? String(car_type).trim() : String(prev.car_type),
      year !== undefined ? Number(year) : Number(prev.year),
      nextEnergy,
      seats !== undefined ? Number(seats) : Number(prev.seats),
      current_odometer !== undefined ? Number(current_odometer) : Number(prev.current_odometer),
      battery_percent !== undefined ? (battery_percent === null ? null : Number(battery_percent)) : (prev.battery_percent === null ? null : Number(prev.battery_percent)),
      nextStatus,
      standby_reason !== undefined ? (standby_reason === null ? null : String(standby_reason)) : (prev.standby_reason === null ? null : String(prev.standby_reason)),
      last_parking_spot !== undefined ? (last_parking_spot === null ? null : String(last_parking_spot)) : (prev.last_parking_spot === null ? null : String(prev.last_parking_spot)),
      nextDefaultDriver,
      vehicleId
    );

    const updated = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
    recordAudit(db, req.user, 'VEHICLE_UPDATED', 'VEHICLE', vehicleId, prev, updated);
    res.json({ vehicle: updated });
  });

  app.delete('/api/vehicles/:id', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const vehicleId = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId) as Record<string, unknown> | undefined;
    if (!prev) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const activeTrip = db.prepare("SELECT id FROM trip_requests WHERE vehicle_id = ? AND status = 'IN_PROGRESS'").get(vehicleId);
    if (activeTrip) {
      res.status(409).json({ error: 'Cannot delete vehicle with an active in-progress trip' });
      return;
    }

    db.exec('PRAGMA foreign_keys = OFF;');
    try {
      runInTransaction(db, () => {
        db.prepare("UPDATE bookings SET status = 'CANCELLED', cancellation_reason = 'Vehicle decommissioned' WHERE vehicle_id = ? AND status = 'PENDING_APPROVAL'").run(vehicleId);
        db.prepare("UPDATE trip_requests SET status = 'CANCELLED' WHERE vehicle_id = ? AND status = 'PENDING_APPROVAL'").run(vehicleId);
        try {
          db.prepare('DELETE FROM vehicles WHERE id = ?').run(vehicleId);
        } catch {
          db.prepare("UPDATE vehicles SET status = 'Retired', default_driver_id = NULL, updated_at = datetime('now') WHERE id = ?").run(vehicleId);
        }
        recordAudit(db, req.user, 'VEHICLE_DELETED', 'VEHICLE', vehicleId, prev, null);
      });
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }

    res.json({ ok: true, deletedId: vehicleId });
  });

  // ============================================================================
  // 4. DRIVER MANAGEMENT (DRV-01 to DRV-07)
  // ============================================================================

  app.get('/api/drivers', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const drivers = db
      .prepare(
        `SELECT dp.*, u.nickname, u.group_username, u.is_active, u.department_id, d.name as department_name
         FROM driver_profiles dp
         JOIN users u ON u.id = dp.user_id
         LEFT JOIN departments d ON d.id = u.department_id
         ORDER BY dp.id ASC`
      )
      .all() as Array<Record<string, unknown>>;

    const privileged = isPrivilegedRole(req.user!);
    const sanitized = drivers.map((d) => {
      const isSelf = Number(d.user_id) === req.user!.id;
      if (privileged || isSelf) return d;
      // DRV-03: Personal fields hidden from users without access
      return {
        id: d.id,
        user_id: d.user_id,
        full_name: d.full_name,
        licence_class: d.licence_class,
        availability_status: d.availability_status,
        is_active: d.is_active,
        department_id: d.department_id,
        department_name: d.department_name,
        licence_number: null,
        contact_number: null,
        licence_expiry: null,
      };
    });

    res.json({ drivers: sanitized });
  });

  app.post('/api/drivers', requireAuth, requireRoles(['ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const resolvedName = (req.body?.full_name || req.body?.name || '').trim();
    const resolvedLicence = (req.body?.licence_number || req.body?.license_number || `SIM-${Date.now()}`).trim();
    const resolvedExpiry = (req.body?.licence_expiry || req.body?.license_expiry || '2028-12-31').trim();
    const resolvedContact = (req.body?.contact_number || req.body?.phone_number || req.body?.phone || '+62-812-0000-0000').trim();
    const licenceClass = req.body?.licence_class || 'A';
    const availabilityStatus = req.body?.availability_status || 'Active';
    const departmentId = req.body?.department_id;

    let resolvedUserId = req.body?.user_id ? Number(req.body.user_id) : null;
    if (!resolvedUserId && resolvedName) {
      const username = `drv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const u = db.prepare(
        "INSERT INTO users (nickname, group_username, password_hash, role, department_id, approval_status, is_active) VALUES (?, ?, ?, 'DRV', 1, 'APPROVED', 1)"
      ).run(resolvedName, username, hashPassword('Driver@123'));
      resolvedUserId = Number(u.lastInsertRowid);
    }

    if (!resolvedUserId || !resolvedName) {
      res.status(400).json({ error: 'Driver name is required' });
      return;
    }

    const expDate = new Date(resolvedExpiry);
    if (Number.isNaN(expDate.getTime()) || expDate.getTime() < Date.now()) {
      res.status(400).json({ error: 'Invalid or expired licence_expiry date (DRV-03)' });
      return;
    }

    if (departmentId !== undefined && Number(departmentId) > 0) {
      db.prepare('UPDATE users SET department_id = ? WHERE id = ?').run(Number(departmentId), resolvedUserId);
    }

    const existingProfile = db.prepare('SELECT id FROM driver_profiles WHERE user_id = ?').get(resolvedUserId) as { id: number } | undefined;
    let driverProfileId: number;
    if (existingProfile) {
      db.prepare(
        `UPDATE driver_profiles
         SET full_name = ?, licence_number = ?, licence_class = ?, licence_expiry = ?, contact_number = ?, availability_status = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(resolvedName, resolvedLicence, licenceClass, resolvedExpiry, resolvedContact, availabilityStatus, existingProfile.id);
      driverProfileId = existingProfile.id;
    } else {
      const result = db
        .prepare(
          `INSERT INTO driver_profiles (user_id, full_name, licence_number, licence_class, licence_expiry, contact_number, availability_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(resolvedUserId, resolvedName, resolvedLicence, licenceClass, resolvedExpiry, resolvedContact, availabilityStatus);
      driverProfileId = Number(result.lastInsertRowid);
    }


    const created = db
      .prepare(
        `SELECT dp.*, u.nickname, u.group_username, u.is_active, u.department_id, d.name as department_name
         FROM driver_profiles dp
         JOIN users u ON u.id = dp.user_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE dp.id = ?`
      )
      .get(driverProfileId);
    recordAudit(db, req.user, 'DRIVER_PROFILE_CREATED', 'DRIVER_PROFILE', driverProfileId, null, created);
    res.status(201).json({ driver: created });
  });


  app.patch('/api/drivers/:id', requireAuth, requireRoles(['ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const driverId = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM driver_profiles WHERE id = ?').get(driverId) as Record<string, unknown> | undefined;
    if (!prev) {
      res.status(404).json({ error: 'Driver profile not found' });
      return;
    }

    const { full_name, licence_number, licence_class, licence_expiry, contact_number, availability_status, department_id } = req.body ?? {};
    if (licence_expiry !== undefined) {
      const expDate = new Date(licence_expiry);
      if (Number.isNaN(expDate.getTime())) {
        res.status(400).json({ error: 'Invalid licence_expiry date (DRV-03)' });
        return;
      }
    }

    if (department_id !== undefined && Number(department_id) > 0 && prev.user_id) {
      db.prepare('UPDATE users SET department_id = ? WHERE id = ?').run(Number(department_id), Number(prev.user_id));
    }

    db.prepare(
      `UPDATE driver_profiles
       SET full_name = ?,
           licence_number = ?,
           licence_class = ?,
           licence_expiry = ?,
           contact_number = ?,
           availability_status = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      full_name ?? prev.full_name,
      licence_number ?? prev.licence_number,
      licence_class ?? prev.licence_class,
      licence_expiry ?? prev.licence_expiry,
      contact_number ?? prev.contact_number,
      availability_status ?? prev.availability_status,
      driverId
    );

    const updated = db
      .prepare(
        `SELECT dp.*, u.nickname, u.group_username, u.is_active, u.department_id, d.name as department_name
         FROM driver_profiles dp
         JOIN users u ON u.id = dp.user_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE dp.id = ?`
      )
      .get(driverId);
    recordAudit(db, req.user, 'DRIVER_PROFILE_UPDATED', 'DRIVER_PROFILE', driverId, prev, updated);
    res.json({ driver: updated });
  });

  app.delete('/api/drivers/:id', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const driverId = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM driver_profiles WHERE id = ?').get(driverId) as Record<string, unknown> | undefined;
    if (!prev) {
      res.status(404).json({ error: 'Driver profile not found' });
      return;
    }

    const activeTrip = db.prepare(`
      SELECT tr.id FROM assignments a
      JOIN trip_requests tr ON tr.id = a.trip_request_id
      WHERE a.driver_profile_id = ? AND a.is_current = 1 AND tr.status = 'IN_PROGRESS'
    `).get(driverId);
    if (activeTrip) {
      res.status(409).json({ error: 'Cannot delete driver currently on an active in-progress trip' });
      return;
    }

    db.exec('PRAGMA foreign_keys = OFF;');
    try {
      runInTransaction(db, () => {
        db.prepare('UPDATE vehicles SET default_driver_id = NULL WHERE default_driver_id = ?').run(driverId);
        if (prev.user_id) {
          db.prepare("UPDATE users SET is_active = 0, approval_status = 'REJECTED' WHERE id = ?").run(Number(prev.user_id));
        }
        try {
          db.prepare('DELETE FROM driver_profiles WHERE id = ?').run(driverId);
        } catch {
          db.prepare("UPDATE driver_profiles SET availability_status = 'Inactive', updated_at = datetime('now') WHERE id = ?").run(driverId);
        }
        recordAudit(db, req.user, 'DRIVER_DELETED', 'DRIVER_PROFILE', driverId, prev, null);
      });
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }

    res.json({ ok: true, deletedId: driverId });
  });

  // ============================================================================
  // 5. LIVE AVAILABILITY CHECK, TRIP REQUESTS, APPROVALS, BOOKINGS & ASSIGNMENTS
  //    (REQ, BKG, ASN + Revision #1 No Self-Drive + Revision #4 Immediate Block)
  // ============================================================================

  app.get('/api/availability', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const startTime = String(req.query.start_time || '');
    const endTime = String(req.query.end_time || '');
    if (!startTime || !endTime) {
      res.status(400).json({ error: 'start_time and end_time query parameters are required' });
      return;
    }

    const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY id ASC').all() as Array<{ id: number } & Record<string, unknown>>;
    const drivers = db
      .prepare(
        `SELECT dp.id, dp.user_id, dp.full_name, dp.licence_class, dp.availability_status
         FROM driver_profiles dp
         JOIN users u ON u.id = dp.user_id
         WHERE u.is_active = 1
         ORDER BY dp.id ASC`
      )
      .all() as Array<{ id: number } & Record<string, unknown>>;

    const vehicleAvailability = vehicles.map((v) => {
      const check = checkVehicleConflict(db, v.id, startTime, endTime);
      return {
        ...v,
        isAvailable: !check.hasConflict,
        conflictReason: check.reason ?? null,
      };
    });

    const driverAvailability = drivers.map((d) => {
      const check = checkDriverConflict(db, d.id, startTime, endTime);
      return {
        ...d,
        isAvailable: !check.hasConflict,
        conflictReason: check.reason ?? null,
      };
    });

    res.json({ vehicles: vehicleAvailability, drivers: driverAvailability });
  });

  app.get('/api/trips', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    try {
      checkTripAlertsAndAutoCancellations(db);
    } catch {}
    const user = req.user!;
    let rows: Array<Record<string, unknown>>;

    const baseSelect = `
      SELECT tr.*,
             u.nickname as requester_name,
             u.group_username as requester_username,
             d.name as department_name,
             v.registration_plate, v.make, v.model, v.car_type, v.energy_type, v.battery_percent,
             b.id as booking_id, b.status as booking_status,
             a.id as assignment_id, a.driver_profile_id, a.acknowledged_at,
             dp.full_name as assigned_driver_name,
             dp.contact_number as assigned_driver_phone
      FROM trip_requests tr
      JOIN users u ON u.id = tr.requester_id
      JOIN departments d ON d.id = tr.department_id
      JOIN vehicles v ON v.id = tr.vehicle_id
      LEFT JOIN bookings b ON b.trip_request_id = tr.id AND b.status != 'CANCELLED'
      LEFT JOIN assignments a ON a.trip_request_id = tr.id AND a.is_current = 1
      LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
    `;

    if (isPrivilegedRole(user)) {
      rows = db.prepare(`${baseSelect} ORDER BY tr.id DESC`).all() as Array<Record<string, unknown>>;
    } else if (user.is_department_admin === 1) {
      rows = db.prepare(`${baseSelect} WHERE tr.department_id = ? ORDER BY tr.id DESC`).all(user.department_id) as Array<Record<string, unknown>>;
    } else if (user.role === 'DRV') {
      rows = db
        .prepare(`${baseSelect} WHERE a.driver_profile_id = ? OR tr.preferred_driver_id = ? ORDER BY tr.start_time DESC`)
        .all(user.driver_profile_id ?? -1, user.driver_profile_id ?? -1) as Array<Record<string, unknown>>;
    } else {
      rows = db.prepare(`${baseSelect} WHERE tr.requester_id = ? ORDER BY tr.id DESC`).all(user.id) as Array<Record<string, unknown>>;
    }

    const enriched = rows.map((r) => {
      const decisions = db
        .prepare(
          `SELECT ad.*, u.nickname as decider_name
           FROM approval_decisions ad
           JOIN users u ON u.id = ad.decider_id
           WHERE ad.trip_request_id = ?
           ORDER BY ad.id ASC`
        )
        .all(Number(r.id));
      const events = db.prepare('SELECT * FROM trip_events WHERE trip_request_id = ? ORDER BY id ASC').all(Number(r.id));
      return { ...r, decisions, events };
    });

    res.json({ trips: enriched });
  });

  app.get('/api/trips/:id', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const tripId = Number(req.params.id);
    const trip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) as
      | { id: number; requester_id: number; department_id: number }
      | undefined;

    if (!trip) {
      res.status(404).json({ error: 'Trip request not found' });
      return;
    }

    const user = req.user!;
    const assigned = db
      .prepare('SELECT id FROM assignments WHERE trip_request_id = ? AND driver_profile_id = ? AND is_current = 1')
      .get(tripId, user.driver_profile_id ?? -1);

    const canAccess =
      isPrivilegedRole(user) ||
      trip.requester_id === user.id ||
      (user.is_department_admin === 1 && trip.department_id === user.department_id) ||
      Boolean(assigned);

    if (!canAccess) {
      recordAudit(db, user, 'PERMISSION_DENIED', 'TRIP_REQUEST', tripId);
      res.status(403).json({ error: 'Forbidden: you do not have access to this trip request (AUTH-05, REQ-08)' });
      return;
    }

    const decisions = db.prepare('SELECT * FROM approval_decisions WHERE trip_request_id = ? ORDER BY id ASC').all(tripId);
    const assignments = db.prepare('SELECT * FROM assignments WHERE trip_request_id = ? ORDER BY id ASC').all(tripId);
    const events = db.prepare('SELECT * FROM trip_events WHERE trip_request_id = ? ORDER BY id ASC').all(tripId);

    res.json({ trip, decisions, assignments, events });
  });

  // Create Trip Request -> Immediately blocks vehicle (and driver if selected) even before approval (Revision #4)
  app.post('/api/trips', requireAuth, requireRoles(['EMP', 'ADM', 'FM', 'HWS'], true), (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const { vehicle_id, preferred_driver_id, purpose, origin, destination, start_time, end_time, passenger_count, passenger_nickname, passengers, notes, self_drive } =
      req.body ?? {};

    // Revision #1: Self-drive is strictly prohibited
    if (self_drive === true || self_drive === 'true' || self_drive === 1) {
      res.status(400).json({ error: 'Self-drive is disabled. All company vehicle bookings require an assigned driver.' });
      return;
    }

    if (!purpose || !origin || !destination || !start_time || !end_time || !vehicle_id) {
      res.status(400).json({ error: 'purpose, origin, destination, start_time, end_time, and vehicle_id are mandatory (REQ-02)' });
      return;
    }

    const startMs = new Date(start_time).getTime();
    const endMs = new Date(end_time).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      res.status(400).json({ error: 'End time must be after start time (REQ-02)' });
      return;
    }

    let pax = Number(passenger_count ?? 1);
    let finalPaxNickname = passenger_nickname ? String(passenger_nickname).trim() : null;
    let passengersJson: string | null = null;

    if (Array.isArray(passengers) && passengers.length > 0) {
      const cleanList = passengers
        .map((p: any, idx: number) => ({
          id: idx + 1,
          nickname: String(p?.nickname || p?.name || p || '').trim(),
        }))
        .filter((p: { nickname: string }) => Boolean(p.nickname));

      if (cleanList.length > 0) {
        pax = cleanList.length;
        passengersJson = JSON.stringify(cleanList);
        finalPaxNickname = cleanList.map((p, idx) => `${idx + 1}. ${p.nickname}`).join(', ');
      }
    }

    if (!Number.isInteger(pax) || pax <= 0) {
      res.status(400).json({ error: 'passenger_count must be a positive integer (REQ-02)' });
      return;
    }

    try {
      const createdPayload = runInTransaction(db, () => {
        const vConflict = checkVehicleConflict(db, Number(vehicle_id), start_time, end_time);
        if (vConflict.hasConflict) {
          const err = new Error(vConflict.reason || 'Vehicle conflict');
          (err as Error & { status?: number }).status = 409;
          throw err;
        }

        let chosenDriverId: number | null = preferred_driver_id ? Number(preferred_driver_id) : null;
        if (!chosenDriverId) {
          const veh = db.prepare('SELECT default_driver_id FROM vehicles WHERE id = ?').get(Number(vehicle_id)) as
            | { default_driver_id: number | null }
            | undefined;
          if (veh?.default_driver_id) {
            chosenDriverId = veh.default_driver_id;
          }
        }

        if (chosenDriverId) {
          const dConflict = checkDriverConflict(db, chosenDriverId, start_time, end_time);
          if (dConflict.hasConflict) {
            const err = new Error(dConflict.reason || 'Driver conflict');
            (err as Error & { status?: number }).status = 409;
            throw err;
          }
        }

        const tripRes = db
          .prepare(
            `INSERT INTO trip_requests (
              requester_id, department_id, vehicle_id, preferred_driver_id, passenger_nickname, passengers_json,
              purpose, origin, destination, start_time, end_time, passenger_count, notes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')`
          )
          .run(
            user.id,
            user.department_id,
            Number(vehicle_id),
            chosenDriverId,
            finalPaxNickname,
            passengersJson,
            String(purpose).trim(),
            String(origin).trim(),
            String(destination).trim(),
            start_time,
            end_time,
            pax,
            notes ? String(notes).trim() : null
          );

        const tripId = Number(tripRes.lastInsertRowid);

        // Revision #4: Immediately create PENDING_APPROVAL booking to block the vehicle schedule right away
        const bookingRes = db
          .prepare(
            `INSERT INTO bookings (trip_request_id, vehicle_id, booked_by, purpose, start_time, end_time, buffer_minutes, status)
             VALUES (?, ?, ?, ?, ?, ?, 15, 'PENDING_APPROVAL')`
          )
          .run(tripId, Number(vehicle_id), user.id, String(purpose).trim(), start_time, end_time);

        const bookingId = Number(bookingRes.lastInsertRowid);

        // Revision #4: If driver is requested/selected at booking time, immediately block that driver's schedule too
        let assignmentId: number | null = null;
        if (chosenDriverId) {
          const asnRes = db
            .prepare(
              `INSERT INTO assignments (trip_request_id, booking_id, vehicle_id, driver_profile_id, assigned_by, reason, effective_start, effective_end, is_current)
               VALUES (?, ?, ?, ?, ?, 'Reserved upon trip booking submission (Pending Approval)', ?, ?, 1)`
            )
            .run(tripId, bookingId, Number(vehicle_id), chosenDriverId, user.id, start_time, end_time);
          assignmentId = Number(asnRes.lastInsertRowid);
        }

        const trip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId);
        recordAudit(db, user, 'TRIP_REQUEST_SUBMITTED', 'TRIP_REQUEST', tripId, null, { trip, bookingId, assignmentId });

        return { trip, bookingId, assignmentId, tripId };
      });

      notifyAdmins(db, {
        triggerType: 'TRIP_REQUEST_SUBMITTED',
        title: 'New Vehicle Booking Awaiting Approval',
        body: `${user.nickname} booked a car for "${purpose}" (${origin} -> ${destination}). Vehicle slot is locked pending your approval.`,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: createdPayload.tripId,
      });

      sendUserNotification(db, {
        userId: user.id,
        triggerType: 'BOOKING_SUBMITTED',
        title: 'Booking Reserved (Pending Approval)',
        body: `Your booking for "${purpose}" has locked the vehicle schedule and awaits Admin approval.`,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: createdPayload.tripId,
      });

      res.status(201).json(createdPayload);
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 400;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  // Approve or Reject Trip Request (REQ-04, REQ-05, REQ-06, REQ-10 + One-Click Dispatch)
  app.post('/api/trips/:id/decision', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const tripId = Number(req.params.id);
    const { decision, reason, vehicle_id, driver_profile_id } = req.body ?? {};

    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
      return;
    }

    const trip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) as
      | {
          id: number;
          requester_id: number;
          vehicle_id: number;
          preferred_driver_id: number | null;
          purpose: string;
          origin: string;
          destination: string;
          start_time: string;
          end_time: string;
          status: string;
        }
      | undefined;

    if (!trip) {
      res.status(404).json({ error: 'Trip request not found' });
      return;
    }

    // REQ-10: Prevent a user from approving a request they submitted themselves
    if (trip.requester_id === user.id) {
      recordAudit(db, user, 'SELF_APPROVAL_REFUSED', 'TRIP_REQUEST', tripId, null, { decision });
      res.status(403).json({ error: 'Submitters cannot approve or decide on their own trip request (REQ-10)' });
      return;
    }

    if (decision === 'REJECTED' && (!reason || !String(reason).trim())) {
      res.status(400).json({ error: 'A rejection reason is mandatory when rejecting a trip request (REQ-05)' });
      return;
    }

    try {
      const outcome = runInTransaction(db, () => {
        // Append-only Approval Decision record (REQ-06)
        const decRes = db
          .prepare(
            `INSERT INTO approval_decisions (trip_request_id, decider_id, decider_role, decision, reason)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(tripId, user.id, user.role, decision, reason ? String(reason).trim() : 'Approved');

        const decisionId = Number(decRes.lastInsertRowid);

        if (decision === 'REJECTED') {
          db.prepare("UPDATE trip_requests SET status = 'REJECTED', updated_at = datetime('now') WHERE id = ?").run(tripId);
          db.prepare("UPDATE bookings SET status = 'CANCELLED', cancellation_reason = ?, updated_at = datetime('now') WHERE trip_request_id = ?").run(
            `Rejected: ${reason}`,
            tripId
          );
          db.prepare('UPDATE assignments SET is_current = 0 WHERE trip_request_id = ?').run(tripId);

          recordAudit(db, user, 'TRIP_REQUEST_REJECTED', 'TRIP_REQUEST', tripId, { status: trip.status }, { status: 'REJECTED', reason });
          return { decisionId, status: 'REJECTED', assignedDriverUserId: null as number | null };
        }

        // APPROVED path
        const targetVehicleId = vehicle_id ? Number(vehicle_id) : trip.vehicle_id;
        const vConflict = checkVehicleConflict(db, targetVehicleId, trip.start_time, trip.end_time, undefined, tripId);
        if (vConflict.hasConflict) {
          const err = new Error(vConflict.reason || 'Vehicle conflict');
          (err as Error & { status?: number }).status = 409;
          throw err;
        }

        let targetDriverProfileId = driver_profile_id ? Number(driver_profile_id) : trip.preferred_driver_id;
        if (!targetDriverProfileId) {
          const veh = db.prepare('SELECT default_driver_id FROM vehicles WHERE id = ?').get(targetVehicleId) as
            | { default_driver_id: number | null }
            | undefined;
          if (veh?.default_driver_id) {
            targetDriverProfileId = veh.default_driver_id;
          }
        }
        if (targetDriverProfileId) {
          const dConflict = checkDriverConflict(db, targetDriverProfileId, trip.start_time, trip.end_time, tripId);
          if (dConflict.hasConflict) {
            const err = new Error(dConflict.reason || 'Driver conflict');
            (err as Error & { status?: number }).status = 409;
            throw err;
          }
        }

        db.prepare("UPDATE trip_requests SET status = 'APPROVED', vehicle_id = ?, updated_at = datetime('now') WHERE id = ?").run(targetVehicleId, tripId);

        const existingBooking = db.prepare("SELECT id FROM bookings WHERE trip_request_id = ? AND status != 'CANCELLED'").get(tripId) as { id: number } | undefined;
        let bookingId: number;
        if (existingBooking) {
          bookingId = existingBooking.id;
          db.prepare("UPDATE bookings SET vehicle_id = ?, status = 'ACTIVE', updated_at = datetime('now') WHERE id = ?").run(targetVehicleId, bookingId);
        } else {
          const bRes = db
            .prepare(
              `INSERT INTO bookings (trip_request_id, vehicle_id, booked_by, purpose, start_time, end_time, buffer_minutes, status)
               VALUES (?, ?, ?, ?, ?, ?, 15, 'ACTIVE')`
            )
            .run(tripId, targetVehicleId, trip.requester_id, trip.purpose, trip.start_time, trip.end_time);
          bookingId = Number(bRes.lastInsertRowid);
        }

        let assignedDriverUserId: number | null = null;
        if (targetDriverProfileId) {
          db.prepare('UPDATE assignments SET is_current = 0 WHERE trip_request_id = ?').run(tripId);
          db.prepare(
            `INSERT INTO assignments (trip_request_id, booking_id, vehicle_id, driver_profile_id, assigned_by, reason, effective_start, effective_end, is_current)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
          ).run(
            tripId,
            bookingId,
            targetVehicleId,
            targetDriverProfileId,
            user.id,
            reason ? String(reason).trim() : 'Approved and dispatched',
            trip.start_time,
            trip.end_time
          );

          const drvRow = db.prepare('SELECT user_id FROM driver_profiles WHERE id = ?').get(targetDriverProfileId) as { user_id: number } | undefined;
          assignedDriverUserId = drvRow?.user_id ?? null;
        }

        recordAudit(db, user, 'TRIP_REQUEST_APPROVED', 'TRIP_REQUEST', tripId, { status: trip.status }, {
          status: 'APPROVED',
          vehicle_id: targetVehicleId,
          driver_profile_id: targetDriverProfileId,
        });

        return { decisionId, status: 'APPROVED', assignedDriverUserId };
      });

      // Send Push + In-App Notifications (Revision #5)
      sendUserNotification(db, {
        userId: trip.requester_id,
        triggerType: `TRIP_${outcome.status}`,
        title: outcome.status === 'APPROVED' ? 'Booking Approved & Dispatched' : 'Booking Request Rejected',
        body:
          outcome.status === 'APPROVED'
            ? `Your booking "${trip.purpose}" (${trip.origin} -> ${trip.destination}) has been approved.`
            : `Your booking "${trip.purpose}" was rejected. Reason: ${reason}`,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: tripId,
      });

      if (outcome.assignedDriverUserId) {
        sendUserNotification(db, {
          userId: outcome.assignedDriverUserId,
          triggerType: 'DISPATCH_ORDER_ASSIGNED',
          title: 'New Dispatch Order Assigned',
          body: `Dispatch order for "${trip.purpose}" (${trip.origin} -> ${trip.destination}) starting at ${trip.start_time}. Please acknowledge in the Driver PWA.`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: tripId,
        });
      }

      const decisions = db.prepare('SELECT * FROM approval_decisions WHERE trip_request_id = ? ORDER BY id ASC').all(tripId);
      const updatedTrip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId);
      res.json({ trip: updatedTrip, decisions });
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 400;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  // Resubmit a rejected trip request (REQ-05, REQ-06, TC-REQ-02)
  app.post('/api/trips/:id/resubmit', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const tripId = Number(req.params.id);
    const trip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) as
      | {
          id: number;
          requester_id: number;
          vehicle_id: number;
          purpose: string;
          origin: string;
          destination: string;
          start_time: string;
          end_time: string;
          passenger_count: number;
          status: string;
        }
      | undefined;

    if (!trip) {
      res.status(404).json({ error: 'Trip request not found' });
      return;
    }
    if (trip.requester_id !== user.id && !isPrivilegedRole(user)) {
      res.status(403).json({ error: 'Only the requester or an Admin may resubmit this request' });
      return;
    }
    if (trip.status !== 'REJECTED') {
      res.status(400).json({ error: 'Only REJECTED trip requests can be resubmitted (REQ-07)' });
      return;
    }

    const nextPurpose = req.body?.purpose ? String(req.body.purpose).trim() : trip.purpose;
    const nextStart = req.body?.start_time || trip.start_time;
    const nextEnd = req.body?.end_time || trip.end_time;
    const nextVehicleId = req.body?.vehicle_id ? Number(req.body.vehicle_id) : trip.vehicle_id;

    try {
      const updated = runInTransaction(db, () => {
        const vConflict = checkVehicleConflict(db, nextVehicleId, nextStart, nextEnd, undefined, tripId);
        if (vConflict.hasConflict) {
          const err = new Error(vConflict.reason || 'Vehicle conflict');
          (err as Error & { status?: number }).status = 409;
          throw err;
        }

        db.prepare(
          `UPDATE trip_requests
           SET purpose = ?, vehicle_id = ?, start_time = ?, end_time = ?, status = 'PENDING_APPROVAL', updated_at = datetime('now')
           WHERE id = ?`
        ).run(nextPurpose, nextVehicleId, nextStart, nextEnd, tripId);

        db.prepare(
          `INSERT INTO bookings (trip_request_id, vehicle_id, booked_by, purpose, start_time, end_time, buffer_minutes, status)
           VALUES (?, ?, ?, ?, ?, ?, 15, 'PENDING_APPROVAL')`
        ).run(tripId, nextVehicleId, user.id, nextPurpose, nextStart, nextEnd);

        const row = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId);
        recordAudit(db, user, 'TRIP_REQUEST_RESUBMITTED', 'TRIP_REQUEST', tripId, trip, row);
        return row;
      });

      res.json({ trip: updated });
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 400;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  // Protect approval_decisions against any attempt to edit or delete via API (REQ-06, TC-REQ-02)
  app.all('/api/approval-decisions/:id', requireAuth, (req: Request, res: Response) => {
    recordAudit(getDb(), req.user, 'IMMUTABLE_DECISION_EDIT_REFUSED', 'APPROVAL_DECISION', String(req.params.id));
    res.status(405).json({ error: 'Approval decisions are immutable and can never be modified or deleted (REQ-06)' });
  });

  // Direct Bookings & Schedule endpoints (BKG-01 to BKG-11)
  app.get('/api/bookings', requireAuth, (_req: Request, res: Response) => {
    const db = getDb();
    const bookings = db
      .prepare(
        `SELECT b.*, v.registration_plate, v.make, v.model, v.car_type, v.energy_type,
                u.nickname as booked_by_name,
                a.driver_profile_id, dp.full_name as driver_name
         FROM bookings b
         JOIN vehicles v ON v.id = b.vehicle_id
         JOIN users u ON u.id = b.booked_by
         LEFT JOIN assignments a ON (a.booking_id = b.id OR (a.trip_request_id = b.trip_request_id AND b.trip_request_id IS NOT NULL)) AND a.is_current = 1
         LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
         ORDER BY b.start_time DESC`
      )
      .all();
    res.json({ bookings });
  });

  app.post('/api/bookings', requireAuth, requireRoles(['ADM', 'FM', 'HWS', 'EMP'], true), (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const { vehicle_id, purpose, start_time, end_time, buffer_minutes, trip_request_id } = req.body ?? {};

    if (!vehicle_id || !start_time || !end_time) {
      res.status(400).json({ error: 'vehicle_id, start_time, and end_time are required (BKG-01)' });
      return;
    }

    const buf = buffer_minutes !== undefined ? Number(buffer_minutes) : 0;

    try {
      const booking = runInTransaction(db, () => {
        const conflict = checkVehicleConflict(db, Number(vehicle_id), start_time, end_time, undefined, undefined, buf);
        if (conflict.hasConflict) {
          const err = new Error(conflict.reason || 'Vehicle booking overlap conflict');
          (err as Error & { status?: number }).status = 409;
          throw err;
        }

        const initialStatus = isPrivilegedRole(user) ? 'ACTIVE' : 'PENDING_APPROVAL';
        const result = db
          .prepare(
            `INSERT INTO bookings (trip_request_id, vehicle_id, booked_by, purpose, start_time, end_time, buffer_minutes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(trip_request_id ? Number(trip_request_id) : null, Number(vehicle_id), user.id, purpose || 'Reserved Vehicle Slot', start_time, end_time, buf, initialStatus);

        const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(Number(result.lastInsertRowid));
        recordAudit(db, user, 'BOOKING_CREATED', 'BOOKING', Number(result.lastInsertRowid), null, row);
        return row;
      });

      res.status(201).json({ booking });
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 400;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/bookings/:id', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const bookingId = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as
      | {
          id: number;
          trip_request_id: number | null;
          vehicle_id: number;
          booked_by: number;
          purpose: string;
          start_time: string;
          end_time: string;
          buffer_minutes: number;
          status: string;
        }
      | undefined;

    if (!prev) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!isPrivilegedRole(user) && prev.booked_by !== user.id) {
      recordAudit(db, user, 'PERMISSION_DENIED', 'BOOKING', bookingId);
      res.status(403).json({ error: 'Forbidden (AUTH-05)' });
      return;
    }

    const nextStart = req.body?.start_time || prev.start_time;
    const nextEnd = req.body?.end_time || prev.end_time;
    const nextPurpose = req.body?.purpose || prev.purpose;
    const nextStatus = req.body?.status || prev.status;

    try {
      const updated = runInTransaction(db, () => {
        if (nextStatus !== 'CANCELLED') {
          const conflict = checkVehicleConflict(db, prev.vehicle_id, nextStart, nextEnd, bookingId, undefined, prev.buffer_minutes);
          if (conflict.hasConflict) {
            const err = new Error(conflict.reason || 'Booking overlap');
            (err as Error & { status?: number }).status = 409;
            throw err;
          }
        }

        db.prepare(
          `UPDATE bookings
           SET purpose = ?, start_time = ?, end_time = ?, status = ?, cancellation_reason = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).run(nextPurpose, nextStart, nextEnd, nextStatus, req.body?.cancellation_reason ?? null, bookingId);

        if (nextStatus === 'CANCELLED') {
          db.prepare('UPDATE assignments SET is_current = 0 WHERE booking_id = ?').run(bookingId);
          if (prev.trip_request_id) {
            db.prepare('UPDATE assignments SET is_current = 0 WHERE trip_request_id = ?').run(prev.trip_request_id);
            db.prepare(
              `UPDATE trip_requests
               SET status = CASE WHEN status IN ('PENDING_APPROVAL', 'APPROVED') THEN 'CANCELLED' ELSE status END,
                   updated_at = datetime('now')
               WHERE id = ?`
            ).run(prev.trip_request_id);
          }
        }

        const nextRow = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
        db.prepare(
          `INSERT INTO booking_history (booking_id, changed_by, action, previous_values_json, new_values_json)
           VALUES (?, ?, ?, ?, ?)`
        ).run(bookingId, user.id, nextStatus === 'CANCELLED' ? 'CANCELLED' : 'UPDATED', JSON.stringify(prev), JSON.stringify(nextRow));

        recordAudit(db, user, 'BOOKING_UPDATED', 'BOOKING', bookingId, prev, nextRow);
        return nextRow;
      });

      const history = db.prepare('SELECT * FROM booking_history WHERE booking_id = ? ORDER BY id ASC').all(bookingId);
      res.json({ booking: updated, history });
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 400;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  app.get('/api/bookings/:id/history', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const bookingId = Number(req.params.id);
    const history = db.prepare('SELECT * FROM booking_history WHERE booking_id = ? ORDER BY id ASC').all(bookingId);
    res.json({ history });
  });

  // Vehicle & Driver Assignments (ASN-01 to ASN-07)
  app.get('/api/assignments', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const tripRequestId = req.query.trip_request_id ? Number(req.query.trip_request_id) : null;
    const rows = tripRequestId
      ? db
          .prepare(
            `SELECT a.*, dp.full_name as driver_name, v.registration_plate, u.nickname as assigned_by_name
             FROM assignments a
             JOIN driver_profiles dp ON dp.id = a.driver_profile_id
             JOIN vehicles v ON v.id = a.vehicle_id
             JOIN users u ON u.id = a.assigned_by
             WHERE a.trip_request_id = ?
             ORDER BY a.id ASC`
          )
          .all(tripRequestId)
      : db
          .prepare(
            `SELECT a.*, dp.full_name as driver_name, v.registration_plate, u.nickname as assigned_by_name
             FROM assignments a
             JOIN driver_profiles dp ON dp.id = a.driver_profile_id
             JOIN vehicles v ON v.id = a.vehicle_id
             JOIN users u ON u.id = a.assigned_by
             ORDER BY a.id DESC`
          )
          .all();

    res.json({ assignments: rows });
  });

  app.post('/api/assignments', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const { trip_request_id, booking_id, vehicle_id, driver_profile_id, effective_start, effective_end, reason } = req.body ?? {};

    if (!vehicle_id || !driver_profile_id || !effective_start || !effective_end) {
      res.status(400).json({ error: 'vehicle_id, driver_profile_id, effective_start, and effective_end are required (ASN-01)' });
      return;
    }

    try {
      const resultPayload = runInTransaction(db, () => {
        const linkedBooking =
          !booking_id && trip_request_id
            ? (db.prepare("SELECT id FROM bookings WHERE trip_request_id = ? AND status != 'CANCELLED' ORDER BY id DESC LIMIT 1").get(Number(trip_request_id)) as
                | { id: number }
                | undefined)
            : undefined;
        const resolvedBookingId = booking_id ? Number(booking_id) : linkedBooking?.id ?? null;

        // ASN-05: Check that vehicle does not have an overlapping active booking for a different trip
        const vConflict = checkVehicleConflict(
          db,
          Number(vehicle_id),
          effective_start,
          effective_end,
          resolvedBookingId ?? undefined,
          trip_request_id ? Number(trip_request_id) : undefined,
          0
        );
        if (vConflict.hasConflict) {
          const err = new Error(vConflict.reason || 'Vehicle conflict (ASN-05)');
          (err as Error & { status?: number }).status = 409;
          throw err;
        }

        // ASN-03 & ASN-06: Check driver eligibility and driver overlap
        const dConflict = checkDriverConflict(
          db,
          Number(driver_profile_id),
          effective_start,
          effective_end,
          trip_request_id ? Number(trip_request_id) : undefined,
          resolvedBookingId ?? undefined
        );
        if (dConflict.hasConflict) {
          const err = new Error(dConflict.reason || 'Driver conflict (ASN-03)');
          (err as Error & { status?: number }).status = 409;
          throw err;
        }

        // ASN-04: Preserve earlier assignment records by marking them is_current = 0 and inserting a new record
        if (trip_request_id) {
          db.prepare('UPDATE assignments SET is_current = 0 WHERE trip_request_id = ?').run(Number(trip_request_id));
          db.prepare("UPDATE trip_requests SET vehicle_id = ?, updated_at = datetime('now') WHERE id = ?").run(Number(vehicle_id), Number(trip_request_id));
        }
        if (resolvedBookingId) {
          db.prepare('UPDATE assignments SET is_current = 0 WHERE booking_id = ?').run(resolvedBookingId);
        }

        const ins = db
          .prepare(
            `INSERT INTO assignments (
              trip_request_id, booking_id, vehicle_id, driver_profile_id, assigned_by, reason, effective_start, effective_end, is_current
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
          )
          .run(
            trip_request_id ? Number(trip_request_id) : null,
            resolvedBookingId,
            Number(vehicle_id),
            Number(driver_profile_id),
            user.id,
            reason ? String(reason).trim() : 'Vehicle and driver assigned',
            effective_start,
            effective_end
          );

        const newId = Number(ins.lastInsertRowid);
        const created = db.prepare('SELECT * FROM assignments WHERE id = ?').get(newId);
        recordAudit(db, user, 'ASSIGNMENT_RECORDED', 'ASSIGNMENT', newId, null, created);

        const drvRow = db.prepare('SELECT user_id FROM driver_profiles WHERE id = ?').get(Number(driver_profile_id)) as { user_id: number } | undefined;
        return { created, driverUserId: drvRow?.user_id ?? null, newId };
      });

      if (resultPayload.driverUserId) {
        sendUserNotification(db, {
          userId: resultPayload.driverUserId,
          triggerType: 'DISPATCH_ORDER_ASSIGNED',
          title: 'New Dispatch Assignment',
          body: `You have been assigned to vehicle #${vehicle_id} from ${effective_start} to ${effective_end}.`,
          relatedEntityType: 'ASSIGNMENT',
          relatedEntityId: resultPayload.newId,
        });
      }

      res.status(201).json({ assignment: resultPayload.created });
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 400;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  // ============================================================================
  // 6. DRIVER PWA OPERATIONAL ACTIONS (TRP-01 to TRP-11)
  // ============================================================================

  app.get('/api/driver/dispatches', requireAuth, requireRoles(['DRV', 'ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const filterDriverProfileId = user.role === 'DRV' ? user.driver_profile_id : req.query.driver_profile_id ? Number(req.query.driver_profile_id) : null;

    const query = `
      SELECT a.id as assignment_id, a.trip_request_id, a.booking_id, a.vehicle_id, a.driver_profile_id,
             a.effective_start, a.effective_end, a.acknowledged_at, a.reason as assignment_reason,
             tr.purpose, tr.origin, tr.destination, tr.passenger_count, tr.notes, tr.status as trip_status,
             tr.start_odometer, tr.end_odometer, tr.distance_km,
             v.registration_plate, v.make, v.model, v.car_type, v.energy_type, v.current_odometer, v.battery_percent, v.last_parking_spot,
             u.nickname as requester_name, d.name as department_name
      FROM assignments a
      LEFT JOIN trip_requests tr ON tr.id = a.trip_request_id
      JOIN vehicles v ON v.id = a.vehicle_id
      LEFT JOIN users u ON u.id = tr.requester_id
      LEFT JOIN departments d ON d.id = tr.department_id
      WHERE a.is_current = 1
      ${filterDriverProfileId ? 'AND a.driver_profile_id = ?' : ''}
      ORDER BY a.effective_start DESC
    `;

    const dispatches = filterDriverProfileId ? db.prepare(query).all(filterDriverProfileId) : db.prepare(query).all();
    res.json({ dispatches });
  });

  // TRP-02: Acknowledge assignment
  app.post('/api/driver/trips/:id/acknowledge', requireAuth, requireRoles(['DRV', 'ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const tripId = Number(req.params.id);
    const asn = db.prepare('SELECT * FROM assignments WHERE trip_request_id = ? AND is_current = 1').get(tripId) as
      | { id: number; driver_profile_id: number }
      | undefined;

    if (!asn) {
      res.status(404).json({ error: 'Active assignment for this trip not found' });
      return;
    }

    if (req.user!.role === 'DRV' && asn.driver_profile_id !== req.user!.driver_profile_id) {
      res.status(403).json({ error: 'This trip is not assigned to your driver profile (TRP-01)' });
      return;
    }

    db.prepare("UPDATE assignments SET acknowledged_at = datetime('now') WHERE id = ?").run(asn.id);
    db.prepare(
      `INSERT INTO trip_events (trip_request_id, assignment_id, driver_user_id, event_type, notes)
       VALUES (?, ?, ?, 'ACKNOWLEDGED', 'Driver acknowledged dispatch order')`
    ).run(tripId, asn.id, req.user!.id);

    recordAudit(db, req.user, 'DISPATCH_ACKNOWLEDGED', 'TRIP_REQUEST', tripId);
    res.json({ acknowledged: true, acknowledged_at: new Date().toISOString() });
  });

  // TRP-03 & TRP-04: Start trip and record start odometer
  app.post('/api/driver/trips/:id/start', requireAuth, requireRoles(['DRV', 'ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const tripId = Number(req.params.id);
    const { start_odometer, battery_percent, override_reason } = req.body ?? {};

    const trip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) as
      | { id: number; vehicle_id: number; requester_id: number; purpose: string; status: string }
      | undefined;
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(trip.vehicle_id) as
      | { id: number; current_odometer: number; energy_type: string }
      | undefined;
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const odo = start_odometer !== undefined ? Number(start_odometer) : vehicle.current_odometer;
    if (Number.isNaN(odo) || odo < 0) {
      res.status(400).json({ error: 'Valid start_odometer is required' });
      return;
    }
    if (odo < vehicle.current_odometer && !override_reason) {
      res.status(409).json({
        error: `Odometer reading (${odo} km) is lower than vehicle's previous recorded reading (${vehicle.current_odometer} km). Provide override_reason for audited correction (TRP-11).`,
      });
      return;
    }

    const { start_odometer_photo, photo_base64, start_odometer_photo_url, enforce_photo } = req.body ?? {};
    const photoUrl = start_odometer_photo_url || start_odometer_photo || photo_base64 || null;
    const isEnforcePhoto = enforce_photo === true || req.headers['x-enforce-photo'] === 'true';
    if (isEnforcePhoto && !photoUrl) {
      res.status(400).json({ error: 'Mandatory photo: Start odometer photo capture is required before starting trip' });
      return;
    }
    const nowIso = new Date().toISOString();

    db.prepare(
      `UPDATE trip_requests
       SET status = 'IN_PROGRESS',
           start_odometer = ?,
           start_odometer_photo_url = COALESCE(?, start_odometer_photo_url),
           start_odometer_time = ?,
           actual_start_time = COALESCE(actual_start_time, ?),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(odo, photoUrl, nowIso, nowIso, tripId);

    if (photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('data:')) {
      try {
        const raw = photoUrl.replace(/^data:[^;]+;base64,/, '');
        db.prepare(
          `INSERT INTO documents (entity_type, entity_id, doc_type, file_name, mime_type, size_bytes, content_base64, is_personal_restricted, version_number, uploaded_by)
           VALUES ('VEHICLE', ?, 'Inspection', ?, 'image/jpeg', ?, ?, 0, 1, ?)`
        ).run(trip.vehicle_id, `start_odo_trip_${tripId}.jpg`, Buffer.byteLength(raw, 'base64'), raw, req.user!.id);
      } catch {}
    }

    db.prepare("UPDATE bookings SET status = 'IN_PROGRESS', updated_at = datetime('now') WHERE trip_request_id = ? AND status != 'CANCELLED'").run(tripId);
    db.prepare("UPDATE vehicles SET current_odometer = ?, battery_percent = COALESCE(?, battery_percent), updated_at = datetime('now') WHERE id = ?").run(
      odo,
      vehicle.energy_type === 'Electric' && battery_percent !== undefined ? Number(battery_percent) : null,
      vehicle.id
    );

    db.prepare(
      `INSERT INTO trip_events (trip_request_id, driver_user_id, event_type, odometer_km, battery_percent, notes)
       VALUES (?, ?, 'TRIP_STARTED', ?, ?, ?)`
    ).run(tripId, req.user!.id, odo, battery_percent !== undefined ? Number(battery_percent) : null, override_reason || 'Trip started with odometer photo verified');

    recordAudit(db, req.user, 'TRIP_STARTED', 'TRIP_REQUEST', tripId, { status: trip.status }, { status: 'IN_PROGRESS', start_odometer: odo, start_odometer_photo: Boolean(photoUrl) });

    sendUserNotification(db, {
      userId: trip.requester_id,
      triggerType: 'TRIP_STARTED',
      title: 'Your Trip Has Started',
      body: `Driver has started trip "${trip.purpose}" (Start Odometer: ${odo} km).`,
      relatedEntityType: 'TRIP_REQUEST',
      relatedEntityId: tripId,
    });

    res.json({ trip: db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) });
  });

  // TRP-03, TRP-04, TRP-06: End trip, record end odometer, EV battery %, and parking return spot
  app.post('/api/driver/trips/:id/complete', requireAuth, requireRoles(['DRV', 'ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const tripId = Number(req.params.id);
    const { end_odometer, end_odometer_photo, photo_base64, battery_percent, parking_return_note } = req.body ?? {};

    const trip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) as
      | { id: number; vehicle_id: number; requester_id: number; purpose: string; status: string; start_odometer: number | null }
      | undefined;

    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }

    // TRP-03: A trip cannot end before it has started
    if (trip.status !== 'IN_PROGRESS') {
      res.status(400).json({ error: 'Cannot complete a trip before it has been started (TRP-03)' });
      return;
    }

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(trip.vehicle_id) as
      | { id: number; current_odometer: number; energy_type: string }
      | undefined;

    const startOdo = trip.start_odometer ?? vehicle?.current_odometer ?? 0;
    const endOdo = Number(end_odometer);
    if (Number.isNaN(endOdo) || endOdo < startOdo) {
      res.status(400).json({ error: `End odometer (${end_odometer}) cannot be lower than start odometer (${startOdo} km) (TRP-11)` });
      return;
    }

    if (battery_percent !== undefined && battery_percent !== null) {
      if (vehicle?.energy_type !== 'Electric') {
        res.status(400).json({ error: 'Battery percentage is accepted for Electric vehicles only (TRP-06)' });
        return;
      }
      const bp = Number(battery_percent);
      if (Number.isNaN(bp) || bp < 0 || bp > 100) {
        res.status(400).json({ error: 'Battery percentage must be between 0 and 100 (TRP-06)' });
        return;
      }
    }

    const distanceKm = endOdo - startOdo;
    const { end_odometer_photo_url, enforce_photo } = req.body ?? {};
    const endPhotoUrl = end_odometer_photo_url || end_odometer_photo || photo_base64 || null;
    const isEnforcePhoto = enforce_photo === true || req.headers['x-enforce-photo'] === 'true';
    if (isEnforcePhoto && !endPhotoUrl) {
      res.status(400).json({ error: 'Mandatory photo: End odometer photo capture is required before completing trip' });
      return;
    }
    const completeNowIso = new Date().toISOString();

    db.prepare(
      `UPDATE trip_requests
       SET status = 'COMPLETED',
           end_odometer = ?,
           end_odometer_photo_url = COALESCE(?, end_odometer_photo_url),
           end_odometer_time = ?,
           distance_km = ?,
           actual_end_time = ?,
           parking_return_note = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(endOdo, endPhotoUrl, completeNowIso, distanceKm, completeNowIso, parking_return_note || 'HQ Main Lot', tripId);

    if (endPhotoUrl && typeof endPhotoUrl === 'string' && endPhotoUrl.startsWith('data:')) {
      try {
        const raw = endPhotoUrl.replace(/^data:[^;]+;base64,/, '');
        db.prepare(
          `INSERT INTO documents (entity_type, entity_id, doc_type, file_name, mime_type, size_bytes, content_base64, is_personal_restricted, version_number, uploaded_by)
           VALUES ('VEHICLE', ?, 'Inspection', ?, 'image/jpeg', ?, ?, 0, 1, ?)`
        ).run(trip.vehicle_id, `end_odo_trip_${tripId}.jpg`, Buffer.byteLength(raw, 'base64'), raw, req.user!.id);
      } catch {}
    }

    db.prepare("UPDATE bookings SET status = 'COMPLETED', updated_at = datetime('now') WHERE trip_request_id = ? AND status != 'CANCELLED'").run(tripId);

    db.prepare(
      `UPDATE vehicles
       SET current_odometer = ?,
           battery_percent = COALESCE(?, battery_percent),
           last_parking_spot = COALESCE(?, last_parking_spot),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      endOdo,
      vehicle?.energy_type === 'Electric' && battery_percent !== undefined ? Number(battery_percent) : null,
      parking_return_note || null,
      trip.vehicle_id
    );

    db.prepare(
      `INSERT INTO trip_events (trip_request_id, driver_user_id, event_type, odometer_km, battery_percent, notes)
       VALUES (?, ?, 'TRIP_COMPLETED', ?, ?, ?)`
    ).run(tripId, req.user!.id, endOdo, battery_percent !== undefined ? Number(battery_percent) : null, `Completed (${distanceKm} km)`);

    recordAudit(db, req.user, 'TRIP_COMPLETED', 'TRIP_REQUEST', tripId, { status: 'IN_PROGRESS' }, {
      status: 'COMPLETED',
      start_odometer: startOdo,
      end_odometer: endOdo,
      distance_km: distanceKm,
    });

    sendUserNotification(db, {
      userId: trip.requester_id,
      triggerType: 'TRIP_COMPLETED',
      title: 'Trip Completed',
      body: `Trip "${trip.purpose}" is complete. Distance traveled: ${distanceKm} km.`,
      relatedEntityType: 'TRIP_REQUEST',
      relatedEntityId: tripId,
    });

    res.json({ trip: db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) });
  });

  // TRP-08 & TRP-09: Vehicle inspection & damage report
  app.post('/api/driver/trips/:id/inspection', requireAuth, requireRoles(['DRV', 'ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const tripId = Number(req.params.id);
    const { tires_ok, brakes_ok, lights_ok, cleanliness_ok, notes } = req.body ?? {};

    const payload = { tires_ok: Boolean(tires_ok), brakes_ok: Boolean(brakes_ok), lights_ok: Boolean(lights_ok), cleanliness_ok: Boolean(cleanliness_ok), notes };
    const result = db
      .prepare(
        `INSERT INTO trip_events (trip_request_id, driver_user_id, event_type, notes, payload_json)
         VALUES (?, ?, 'INSPECTION_SUBMITTED', ?, ?)`
      )
      .run(tripId, req.user!.id, notes || 'Pre-trip inspection submitted', JSON.stringify(payload));

    recordAudit(db, req.user, 'INSPECTION_SUBMITTED', 'TRIP_EVENT', Number(result.lastInsertRowid), null, payload);
    res.status(201).json({ eventId: Number(result.lastInsertRowid), inspection: payload });
  });

  app.post('/api/driver/trips/:id/damage', requireAuth, requireRoles(['DRV', 'ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const tripId = Number(req.params.id);
    const { description, severity, photo_base64, file_name } = req.body ?? {};
    if (!description) {
      res.status(400).json({ error: 'Damage description is required (TRP-09)' });
      return;
    }

    const payload = { description, severity: severity || 'Minor', hasPhoto: Boolean(photo_base64), file_name };
    const result = db
      .prepare(
        `INSERT INTO trip_events (trip_request_id, driver_user_id, event_type, notes, payload_json)
         VALUES (?, ?, 'DAMAGE_REPORTED', ?, ?)`
      )
      .run(tripId, req.user!.id, description, JSON.stringify(payload));

    notifyAdmins(db, {
      triggerType: 'DAMAGE_REPORTED',
      title: 'Vehicle Damage Reported',
      body: `${req.user!.nickname} reported ${severity || 'Minor'} damage on Trip #${tripId}: ${description}`,
      relatedEntityType: 'TRIP_REQUEST',
      relatedEntityId: tripId,
    });

    recordAudit(db, req.user, 'DAMAGE_REPORTED', 'TRIP_EVENT', Number(result.lastInsertRowid), null, payload);
    res.status(201).json({ eventId: Number(result.lastInsertRowid), damage: payload });
  });

  // ============================================================================
  // 7. GASOLINE FUEL (FUEL-01 to 08) & EV CHARGING (EV-01 to 07)
  // ============================================================================

  app.get('/api/fuel', requireAuth, (_req: Request, res: Response) => {
    const db = getDb();
    const records = db
      .prepare(
        `SELECT f.*, v.registration_plate, v.make, v.model, u.nickname as recorded_by_name
         FROM fuel_records f
         JOIN vehicles v ON v.id = f.vehicle_id
         JOIN users u ON u.id = f.recorded_by
         ORDER BY f.date_time DESC`
      )
      .all();
    res.json({ fuelRecords: records });
  });

  app.post('/api/fuel', requireAuth, requireRoles(['ADM', 'FM', 'DRV']), (req: Request, res: Response) => {
    const db = getDb();
    const { vehicle_id, trip_request_id, date_time, litres, cost, odometer_km, station, receipt_document_id, override_reason } = req.body ?? {};

    if (!vehicle_id || litres === undefined || cost === undefined || odometer_km === undefined) {
      res.status(400).json({ error: 'vehicle_id, litres, cost, and odometer_km are required (FUEL-03)' });
      return;
    }

    const numLitres = Number(litres);
    const numCost = Number(cost);
    const numOdo = Number(odometer_km);

    if (Number.isNaN(numLitres) || numLitres <= 0 || Number.isNaN(numCost) || numCost < 0 || Number.isNaN(numOdo) || numOdo < 0) {
      res.status(400).json({ error: 'litres must be positive and cost/odometer_km must be non-negative numeric values (FUEL-03)' });
      return;
    }

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(vehicle_id)) as
      | { id: number; energy_type: string; current_odometer: number; registration_plate: string }
      | undefined;

    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    // VEH-02 & FUEL-02: Refuse gasoline fuel record on an Electric vehicle
    if (vehicle.energy_type !== 'Gasoline') {
      res.status(400).json({ error: `Cannot create a Gasoline fuel record for Electric vehicle ${vehicle.registration_plate} (VEH-02, FUEL-02)` });
      return;
    }

    // FUEL-07: Check odometer against vehicle's previous reading
    if (numOdo < vehicle.current_odometer && !override_reason) {
      res.status(409).json({
        error: `Odometer reading (${numOdo} km) is lower than vehicle's previous reading (${vehicle.current_odometer} km). Supply override_reason for audited override (FUEL-07).`,
        code: 'ODOMETER_LOWER_THAN_PREVIOUS',
      });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO fuel_records (vehicle_id, trip_request_id, recorded_by, date_time, litres, cost, odometer_km, station, receipt_document_id, override_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        vehicle.id,
        trip_request_id ? Number(trip_request_id) : null,
        req.user!.id,
        date_time || new Date().toISOString(),
        numLitres,
        numCost,
        numOdo,
        station || null,
        receipt_document_id ? Number(receipt_document_id) : null,
        override_reason || null
      );

    if (numOdo > vehicle.current_odometer) {
      db.prepare("UPDATE vehicles SET current_odometer = ?, updated_at = datetime('now') WHERE id = ?").run(numOdo, vehicle.id);
    }

    const created = db.prepare('SELECT * FROM fuel_records WHERE id = ?').get(Number(result.lastInsertRowid));
    recordAudit(db, req.user, override_reason ? 'FUEL_RECORD_CREATED_WITH_OVERRIDE' : 'FUEL_RECORD_CREATED', 'FUEL_RECORD', Number(result.lastInsertRowid), null, created);
    res.status(201).json({ fuelRecord: created });
  });

  app.patch('/api/fuel/:id', requireAuth, requireRoles(['ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const recordId = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM fuel_records WHERE id = ?').get(recordId) as Record<string, unknown> | undefined;
    if (!prev) {
      res.status(404).json({ error: 'Fuel record not found' });
      return;
    }

    const { litres, cost, odometer_km, station } = req.body ?? {};
    db.prepare(
      `UPDATE fuel_records
       SET litres = ?, cost = ?, odometer_km = ?, station = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      litres !== undefined ? Number(litres) : Number(prev.litres),
      cost !== undefined ? Number(cost) : Number(prev.cost),
      odometer_km !== undefined ? Number(odometer_km) : Number(prev.odometer_km),
      station !== undefined ? (station === null ? null : String(station)) : (prev.station === null ? null : String(prev.station)),
      recordId
    );

    const updated = db.prepare('SELECT * FROM fuel_records WHERE id = ?').get(recordId);
    recordAudit(db, req.user, 'FUEL_RECORD_UPDATED', 'FUEL_RECORD', recordId, prev, updated);
    res.json({ fuelRecord: updated });
  });

  // EV Charging Records (EV-01 to EV-07)
  app.get('/api/ev-charging', requireAuth, (_req: Request, res: Response) => {
    const db = getDb();
    const records = db
      .prepare(
        `SELECT e.*, v.registration_plate, v.make, v.model, u.nickname as recorded_by_name
         FROM ev_charging_records e
         JOIN vehicles v ON v.id = e.vehicle_id
         JOIN users u ON u.id = e.recorded_by
         ORDER BY e.date_time DESC`
      )
      .all();
    res.json({ evRecords: records });
  });

  app.post('/api/ev-charging', requireAuth, requireRoles(['ADM', 'FM', 'DRV']), (req: Request, res: Response) => {
    const db = getDb();
    const { vehicle_id, trip_request_id, date_time, kwh_added, cost, battery_start_pct, battery_end_pct, odometer_km, station, receipt_document_id } = req.body ?? {};

    if (!vehicle_id || kwh_added === undefined || cost === undefined || battery_start_pct === undefined || battery_end_pct === undefined) {
      res.status(400).json({ error: 'vehicle_id, kwh_added, cost, battery_start_pct, and battery_end_pct are required (EV-01 to EV-04)' });
      return;
    }

    const kwh = Number(kwh_added);
    const numCost = Number(cost);
    const startPct = Number(battery_start_pct);
    const endPct = Number(battery_end_pct);

    if (Number.isNaN(kwh) || kwh <= 0 || Number.isNaN(numCost) || numCost < 0) {
      res.status(400).json({ error: 'kwh_added must be positive and cost must be non-negative (EV-02, EV-03)' });
      return;
    }

    if (Number.isNaN(startPct) || startPct < 0 || startPct > 100 || Number.isNaN(endPct) || endPct < 0 || endPct > 100 || endPct < startPct) {
      res.status(400).json({ error: 'Battery percentages must be between 0 and 100, and end percentage must not be below start percentage (EV-04)' });
      return;
    }

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(vehicle_id)) as
      | { id: number; energy_type: string; registration_plate: string; current_odometer: number }
      | undefined;

    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    // VEH-02 & EV-05: Refuse EV charging record on a Gasoline vehicle
    if (vehicle.energy_type !== 'Electric') {
      res.status(400).json({ error: `Cannot create an EV charging record for Gasoline vehicle ${vehicle.registration_plate} (VEH-02, EV-05)` });
      return;
    }

    const odo = odometer_km !== undefined ? Number(odometer_km) : vehicle.current_odometer;

    const result = db
      .prepare(
        `INSERT INTO ev_charging_records (
          vehicle_id, trip_request_id, recorded_by, date_time, kwh_added, cost, battery_start_pct, battery_end_pct, odometer_km, station, receipt_document_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        vehicle.id,
        trip_request_id ? Number(trip_request_id) : null,
        req.user!.id,
        date_time || new Date().toISOString(),
        kwh,
        numCost,
        startPct,
        endPct,
        odo,
        station || null,
        receipt_document_id ? Number(receipt_document_id) : null
      );

    db.prepare("UPDATE vehicles SET battery_percent = ?, current_odometer = MAX(current_odometer, ?), updated_at = datetime('now') WHERE id = ?").run(
      endPct,
      odo,
      vehicle.id
    );

    const created = db.prepare('SELECT * FROM ev_charging_records WHERE id = ?').get(Number(result.lastInsertRowid));
    recordAudit(db, req.user, 'EV_CHARGING_RECORD_CREATED', 'EV_CHARGING_RECORD', Number(result.lastInsertRowid), null, created);
    res.status(201).json({ evRecord: created });
  });

  // ============================================================================
  // 8. MAINTENANCE (MNT), EXPENSES (EXP), AND PROTECTED DOCUMENTS (DOC)
  // ============================================================================

  app.get('/api/maintenance', requireAuth, (_req: Request, res: Response) => {
    const db = getDb();
    const records = db
      .prepare(
        `SELECT m.*, v.registration_plate, v.make, v.model, v.energy_type
         FROM maintenance_records m
         JOIN vehicles v ON v.id = m.vehicle_id
         ORDER BY m.service_date DESC`
      )
      .all();
    res.json({ maintenanceRecords: records });
  });

  app.post('/api/maintenance', requireAuth, requireRoles(['ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const {
      vehicle_id,
      maintenance_type,
      applicable_energy_type,
      service_date,
      end_date,
      odometer_km,
      provider,
      cost,
      status,
      blocks_availability,
      next_due_date,
      next_due_odometer_km,
      notes,
    } = req.body ?? {};

    if (!vehicle_id || !maintenance_type || !service_date || !provider || cost === undefined) {
      res.status(400).json({ error: 'vehicle_id, maintenance_type, service_date, provider, and cost are required (MNT-02)' });
      return;
    }

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(vehicle_id)) as
      | { id: number; energy_type: string; registration_plate: string; current_odometer: number }
      | undefined;
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const appEnergy = applicable_energy_type || 'Both';
    // MNT-05: Refuse maintenance type not applicable to vehicle's energy type
    if (appEnergy !== 'Both' && appEnergy !== vehicle.energy_type) {
      res.status(400).json({
        error: `Maintenance type "${maintenance_type}" (${appEnergy} only) is not applicable to ${vehicle.energy_type} vehicle ${vehicle.registration_plate} (MNT-05)`,
      });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO maintenance_records (
          vehicle_id, recorded_by, maintenance_type, applicable_energy_type, service_date, end_date,
          odometer_km, provider, cost, status, blocks_availability, next_due_date, next_due_odometer_km, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        vehicle.id,
        req.user!.id,
        maintenance_type,
        appEnergy,
        service_date,
        end_date || service_date,
        Number(odometer_km ?? vehicle.current_odometer),
        provider,
        Number(cost),
        status || 'Scheduled',
        blocks_availability !== undefined ? (blocks_availability ? 1 : 0) : 1,
        next_due_date || null,
        next_due_odometer_km ? Number(next_due_odometer_km) : null,
        notes || null
      );

    const created = db.prepare('SELECT * FROM maintenance_records WHERE id = ?').get(Number(result.lastInsertRowid));
    recordAudit(db, req.user, 'MAINTENANCE_CREATED', 'MAINTENANCE_RECORD', Number(result.lastInsertRowid), null, created);
    res.status(201).json({ maintenanceRecord: created });
  });

  app.patch('/api/maintenance/:id', requireAuth, requireRoles(['ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const id = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM maintenance_records WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!prev) {
      res.status(404).json({ error: 'Maintenance record not found' });
      return;
    }

    const { cost, status, notes, provider } = req.body ?? {};
    db.prepare(
      `UPDATE maintenance_records
       SET cost = ?, status = ?, notes = ?, provider = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      cost !== undefined ? Number(cost) : Number(prev.cost),
      status !== undefined ? String(status) : String(prev.status),
      notes !== undefined ? (notes === null ? null : String(notes)) : (prev.notes === null ? null : String(prev.notes)),
      provider !== undefined ? String(provider) : String(prev.provider),
      id
    );

    const updated = db.prepare('SELECT * FROM maintenance_records WHERE id = ?').get(id);
    recordAudit(db, req.user, 'MAINTENANCE_UPDATED', 'MAINTENANCE_RECORD', id, prev, updated);
    res.json({ maintenanceRecord: updated });
  });

  // Expenses (EXP-01 to EXP-08, Driver Reimbursements)
  app.get('/api/expenses', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const isPrivileged = isPrivilegedRole(req.user!);
    const sql = isPrivileged
      ? `SELECT e.*, v.registration_plate, v.make, v.model, u.nickname as submitted_by_name
         FROM expenses e
         JOIN vehicles v ON v.id = e.vehicle_id
         JOIN users u ON u.id = e.submitted_by
         ORDER BY e.date_time DESC`
      : `SELECT e.*, v.registration_plate, v.make, v.model, u.nickname as submitted_by_name
         FROM expenses e
         JOIN vehicles v ON v.id = e.vehicle_id
         JOIN users u ON u.id = e.submitted_by
         WHERE e.submitted_by = ?
         ORDER BY e.date_time DESC`;
    const expenses = isPrivileged ? db.prepare(sql).all() : db.prepare(sql).all(req.user!.id);
    res.json({ expenses });
  });

  app.post('/api/expenses', requireAuth, requireRoles(['ADM', 'FM', 'DRV', 'EMP'], true), (req: Request, res: Response) => {
    const db = getDb();
    const {
      vehicle_id,
      trip_request_id,
      date_time,
      category,
      amount,
      description,
      receipt_document_id,
      receipt_base64,
      receipt_data_url,
      receipt_mime_type,
      receipt_filename,
    } = req.body ?? {};

    if (!vehicle_id || !category || amount === undefined || !description) {
      res.status(400).json({ error: 'vehicle_id, category, amount, and description are mandatory (EXP-02)' });
      return;
    }

    const normalizedCategory = category === 'Gasoline' ? 'Gas' : category === 'EV Charging' ? 'Charging' : category;
    if (!['Parking', 'Toll', 'Gas', 'Charging', 'Cleaning', 'Accessories', 'Other'].includes(normalizedCategory)) {
      res.status(400).json({ error: 'Invalid expense category. Supported categories: Parking, Toll, Gas, Charging, Cleaning, Other' });
      return;
    }

    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Expense amount must be a positive number (EXP-02)' });
      return;
    }

    let finalDocId: number | null = receipt_document_id ? Number(receipt_document_id) : null;
    let finalDataUrl: string | null = null;
    let finalFilename: string | null = receipt_filename ? String(receipt_filename).trim() : null;

    const rawDataUrlOrBase64 = receipt_base64 || receipt_data_url;
    if (rawDataUrlOrBase64 && typeof rawDataUrlOrBase64 === 'string') {
      let inferredMime = receipt_mime_type || 'image/jpeg';
      let rawBase64 = rawDataUrlOrBase64;
      const dataUriMatch = rawDataUrlOrBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        inferredMime = dataUriMatch[1];
        rawBase64 = dataUriMatch[2];
      }

      const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
      if (!allowedMimes.includes(inferredMime)) {
        res.status(400).json({ error: `Disallowed receipt file type: ${inferredMime}. Allowed: PDF, PNG, JPEG, WEBP` });
        return;
      }

      const buffer = Buffer.from(rawBase64, 'base64');
      const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
      if (buffer.length === 0 || buffer.length > MAX_RECEIPT_BYTES) {
        res.status(400).json({ error: `Receipt file size (${buffer.length} bytes) exceeds 8 MB limit or is empty` });
        return;
      }

      // Anti-Malware / Cyber Defense: scan for EICAR standard antivirus test signature
      const asciiPreview = buffer.subarray(0, 512).toString('utf8');
      if (asciiPreview.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
        recordAudit(db, req.user, 'MALWARE_RECEIPT_BLOCKED', 'DOCUMENT', finalFilename || 'receipt');
        res.status(422).json({ error: 'Malicious file content detected (EICAR signature quarantined)' });
        return;
      }

      // Cyber Defense: Validate magic bytes to refuse disguised PE/ELF/Script executables
      if (
        (buffer[0] === 0x4d && buffer[1] === 0x5a) || // Windows PE / EXE 'MZ'
        (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) || // Linux ELF
        (buffer[0] === 0x23 && buffer[1] === 0x21) // Shebang script '#!'
      ) {
        recordAudit(db, req.user, 'EXECUTABLE_RECEIPT_BLOCKED', 'DOCUMENT', finalFilename || 'receipt');
        res.status(400).json({ error: 'Executable file disguised as receipt refused' });
        return;
      }

      const isPdfMagic = buffer.subarray(0, 4).toString('ascii') === '%PDF';
      const isPngMagic = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      const isJpegMagic = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const isWebpMagic = buffer.subarray(0, 4).toString('ascii') === 'RIFF';

      if (
        (inferredMime === 'application/pdf' && !isPdfMagic) ||
        (inferredMime === 'image/png' && !isPngMagic) ||
        (inferredMime === 'image/jpeg' && !isJpegMagic) ||
        (inferredMime === 'image/webp' && !isWebpMagic)
      ) {
        res.status(400).json({ error: 'File content signature does not match declared MIME type' });
        return;
      }

      finalFilename = finalFilename || `receipt_${Date.now()}.${inferredMime === 'application/pdf' ? 'pdf' : inferredMime.split('/')[1] || 'jpg'}`;
      finalDataUrl = `data:${inferredMime};base64,${rawBase64}`;

      const docRes = db
        .prepare(
          `INSERT INTO documents (
            entity_type, entity_id, doc_type, file_name, mime_type, size_bytes, content_base64,
            is_personal_restricted, version_number, uploaded_by
          ) VALUES ('EXPENSE', 0, 'Receipt', ?, ?, ?, ?, 0, 1, ?)`
        )
        .run(finalFilename, inferredMime, buffer.length, rawBase64, req.user!.id);

      finalDocId = Number(docRes.lastInsertRowid);
    } else if (finalDocId) {
      const existingDoc = db.prepare('SELECT file_name, mime_type, content_base64 FROM documents WHERE id = ?').get(finalDocId) as
        | { file_name: string; mime_type: string; content_base64: string }
        | undefined;
      if (existingDoc) {
        finalFilename = existingDoc.file_name;
        finalDataUrl = `data:${existingDoc.mime_type};base64,${existingDoc.content_base64}`;
      }
    }

    const result = db
      .prepare(
        `INSERT INTO expenses (
          vehicle_id, trip_request_id, submitted_by, date_time, category, amount, description,
          receipt_document_id, receipt_data_url, receipt_filename
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        Number(vehicle_id),
        trip_request_id ? Number(trip_request_id) : null,
        req.user!.id,
        date_time || new Date().toISOString(),
        category,
        numAmount,
        String(description).trim(),
        finalDocId,
        finalDataUrl,
        finalFilename
      );

    const expenseId = Number(result.lastInsertRowid);
    if (finalDocId) {
      db.prepare('UPDATE documents SET entity_id = ? WHERE id = ?').run(expenseId, finalDocId);
    }

    const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
    recordAudit(db, req.user, 'EXPENSE_CREATED', 'EXPENSE', expenseId, null, created);
    res.status(201).json({ expense: created });
  });

  app.patch('/api/expenses/:id', requireAuth, requireRoles(['ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const id = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!prev) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const { amount, description, approval_status, reimbursement_status, reason } = req.body ?? {};
    db.prepare(
      `UPDATE expenses
       SET amount = ?, description = ?, approval_status = ?, reimbursement_status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      amount !== undefined ? Number(amount) : Number(prev.amount),
      description !== undefined ? String(description) : String(prev.description),
      approval_status !== undefined ? String(approval_status) : String(prev.approval_status),
      reimbursement_status !== undefined ? String(reimbursement_status) : String(prev.reimbursement_status),
      id
    );

    if (approval_status && approval_status !== prev.approval_status) {
      db.prepare('INSERT INTO expense_decisions (expense_id, decider_id, decision, reason) VALUES (?, ?, ?, ?)').run(
        id,
        req.user!.id,
        approval_status,
        reason || 'Reviewed by Admin'
      );
    }

    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    recordAudit(db, req.user, 'EXPENSE_UPDATED', 'EXPENSE', id, prev, updated);
    res.json({ expense: updated });
  });

  // Protected Documents (DOC-01 to DOC-08)
  app.get('/api/documents', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const includeHistory = req.query.include_versions === '1';
    const rows = db
      .prepare(
        `SELECT id, entity_type, entity_id, doc_type, file_name, mime_type, size_bytes, expiry_date,
                is_personal_restricted, version_number, replaced_by_id, uploaded_by, created_at
         FROM documents
         ${includeHistory ? '' : 'WHERE replaced_by_id IS NULL'}
         ORDER BY id DESC`
      )
      .all() as Array<Record<string, unknown>>;

    const privileged = isPrivilegedRole(req.user!);
    const filtered = rows.filter((d) => {
      if (Number(d.is_personal_restricted) === 1 && !privileged && Number(d.uploaded_by) !== req.user!.id) {
        return false;
      }
      return true;
    });

    res.json({ documents: filtered });
  });

  app.post('/api/documents', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const { entity_type, entity_id, doc_type, file_name, mime_type, content_base64, expiry_date, replaces_document_id } = req.body ?? {};

    if (!entity_type || !entity_id || !doc_type || !file_name || !mime_type || !content_base64) {
      res.status(400).json({ error: 'entity_type, entity_id, doc_type, file_name, mime_type, and content_base64 are required (DOC-01)' });
      return;
    }

    const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(mime_type)) {
      res.status(400).json({ error: `Disallowed file MIME type: ${mime_type} (DOC-04)` });
      return;
    }

    const rawBase64 = String(content_base64).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');

    // DOC-04: Enforce max size (5 MB)
    const MAX_BYTES = 5 * 1024 * 1024;
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      res.status(400).json({ error: `File size (${buffer.length} bytes) exceeds 5 MB limit or is empty (DOC-04)` });
      return;
    }

    // DOC-08: Scan for EICAR standard antivirus signature
    const asciiPreview = buffer.subarray(0, 512).toString('utf8');
    if (asciiPreview.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      recordAudit(db, req.user, 'MALWARE_UPLOAD_BLOCKED', 'DOCUMENT', file_name);
      res.status(422).json({ error: 'Malicious file content detected (EICAR signature quarantined) (DOC-08)' });
      return;
    }

    // DOC-04: Validate actual content magic bytes (refuse renamed executables MZ, ELF, #!)
    if (
      (buffer[0] === 0x4d && buffer[1] === 0x5a) || // Windows PE / EXE 'MZ'
      (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) || // Linux ELF
      (buffer[0] === 0x23 && buffer[1] === 0x21) // Shebang script '#!'
    ) {
      recordAudit(db, req.user, 'EXECUTABLE_UPLOAD_BLOCKED', 'DOCUMENT', file_name);
      res.status(400).json({ error: 'Executable file disguised with allowed extension refused (DOC-04)' });
      return;
    }

    const isPdfMagic = buffer.subarray(0, 4).toString('ascii') === '%PDF';
    const isPngMagic = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpegMagic = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebpMagic = buffer.subarray(0, 4).toString('ascii') === 'RIFF';

    if (
      (mime_type === 'application/pdf' && !isPdfMagic) ||
      (mime_type === 'image/png' && !isPngMagic) ||
      (mime_type === 'image/jpeg' && !isJpegMagic) ||
      (mime_type === 'image/webp' && !isWebpMagic)
    ) {
      res.status(400).json({ error: 'File content signature does not match declared MIME type (DOC-04)' });
      return;
    }

    let versionNumber = 1;
    if (replaces_document_id) {
      const oldDoc = db.prepare('SELECT id, version_number FROM documents WHERE id = ?').get(Number(replaces_document_id)) as
        | { id: number; version_number: number }
        | undefined;
      if (oldDoc) {
        versionNumber = oldDoc.version_number + 1;
      }
    }

    const isPersonal = entity_type === 'DRIVER' || doc_type === 'Driver Licence' ? 1 : 0;

    const result = db
      .prepare(
        `INSERT INTO documents (
          entity_type, entity_id, doc_type, file_name, mime_type, size_bytes, content_base64,
          expiry_date, is_personal_restricted, version_number, uploaded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entity_type,
        Number(entity_id),
        doc_type,
        file_name,
        mime_type,
        buffer.length,
        rawBase64,
        expiry_date || null,
        isPersonal,
        versionNumber,
        req.user!.id
      );

    const newDocId = Number(result.lastInsertRowid);
    if (replaces_document_id) {
      db.prepare('UPDATE documents SET replaced_by_id = ? WHERE id = ?').run(newDocId, Number(replaces_document_id));
    }

    const created = db
      .prepare(
        'SELECT id, entity_type, entity_id, doc_type, file_name, mime_type, size_bytes, expiry_date, version_number, replaced_by_id, created_at FROM documents WHERE id = ?'
      )
      .get(newDocId);

    recordAudit(db, req.user, 'DOCUMENT_UPLOADED', 'DOCUMENT', newDocId, null, created);
    res.status(201).json({ document: created });
  });

  // DOC-05 & AUD-05: Protected document retrieval (no public links; audits personal document access)
  app.get('/api/documents/:id', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const docId = Number(req.params.id);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as
      | {
          id: number;
          entity_type: string;
          entity_id: number;
          doc_type: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          content_base64: string;
          is_personal_restricted: number;
          uploaded_by: number;
          version_number: number;
        }
      | undefined;

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const user = req.user!;
    const canView = isPrivilegedRole(user) || doc.uploaded_by === user.id || (doc.is_personal_restricted === 0 && user.role !== 'EMP');
    if (!canView) {
      recordAudit(db, user, 'PERMISSION_DENIED', 'DOCUMENT', docId);
      res.status(403).json({ error: 'Forbidden: you are not authorized to access this protected document (DOC-05)' });
      return;
    }

    if (doc.is_personal_restricted === 1) {
      recordAudit(db, user, 'PERSONAL_DOCUMENT_VIEWED', 'DOCUMENT', docId, null, { doc_type: doc.doc_type, file_name: doc.file_name });
    }

    res.json({ document: doc });
  });

  // ============================================================================
  // 9. ALL-USER LOCATION PINPOINTS & BEST-EFFORT GPS REPORTING (GPS-01 to GPS-18)
  // ============================================================================

  // Any authenticated user (EMP, DRV, FM, HWS, ADM) can send their live detected GPS coordinates
  app.post('/api/location/ping', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const { latitude, longitude, accuracy_meters, address_label } = req.body ?? {};
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Valid latitude [-90, 90] and longitude [-180, 180] are required' });
      return;
    }

    const acc = accuracy_meters !== undefined && accuracy_meters !== null ? Number(accuracy_meters) : null;
    const label = address_label ? String(address_label).trim() : null;
    const nowIso = new Date().toISOString();

    db.prepare(
      `INSERT INTO user_locations (user_id, latitude, longitude, accuracy_meters, address_label, updated_at)
       VALUES (?, ?, ?, ?, COALESCE(?, (SELECT address_label FROM user_locations WHERE user_id = ?)), ?)
       ON CONFLICT(user_id) DO UPDATE SET
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         accuracy_meters = excluded.accuracy_meters,
         address_label = COALESCE(excluded.address_label, user_locations.address_label),
         updated_at = excluded.updated_at`
    ).run(user.id, lat, lng, acc, label, user.id, nowIso);

    // If this user also has a driver profile, record in location_reports as well
    if (user.driver_profile_id) {
      const activeAsn = db
        .prepare('SELECT id, vehicle_id FROM assignments WHERE driver_profile_id = ? AND is_current = 1 ORDER BY id DESC LIMIT 1')
        .get(user.driver_profile_id) as { id: number; vehicle_id: number } | undefined;

      db.prepare(
        `INSERT INTO location_reports (
          driver_profile_id, driver_user_id, vehicle_id, assignment_id,
          latitude, longitude, accuracy_meters, capture_time, server_receipt_time,
          permission_state, phone_state, is_flagged_implausible, flag_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'GRANTED', 'FOREGROUND', 0, NULL)`
      ).run(user.driver_profile_id, user.id, activeAsn?.vehicle_id ?? null, activeAsn?.id ?? null, lat, lng, acc, nowIso, nowIso);
    }

    const saved = db
      .prepare(
        `SELECT ul.user_id, u.nickname, u.group_username, u.role, d.name as group_name,
                ul.latitude, ul.longitude, ul.accuracy_meters, ul.address_label, ul.updated_at
         FROM user_locations ul
         JOIN users u ON u.id = ul.user_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE ul.user_id = ?`
      )
      .get(user.id);

    res.status(201).json({ location: saved });
  });

  // Returns all active users' pinpoint locations for rendering dots on the map
  app.get('/api/location/pins', requireAuth, (_req: Request, res: Response) => {
    const db = getDb();
    const pins = db
      .prepare(
        `SELECT ul.user_id, u.nickname, u.group_username, u.role, d.name as group_name,
                ul.latitude, ul.longitude, ul.accuracy_meters, ul.address_label, ul.updated_at
         FROM user_locations ul
         JOIN users u ON u.id = ul.user_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.is_active = 1
         ORDER BY ul.updated_at DESC`
      )
      .all();
    res.json({ pins });
  });

  app.post('/api/gps/report', requireAuth, requireRoles(['DRV', 'ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const { latitude, longitude, accuracy_meters, capture_time, permission_state, phone_state, driver_profile_id } = req.body ?? {};

    const targetDriverProfileId = user.driver_profile_id || (driver_profile_id ? Number(driver_profile_id) : 1);
    const permState = permission_state || 'GRANTED';
    if (!['GRANTED', 'DENIED', 'UNAVAILABLE'].includes(permState)) {
      res.status(400).json({ error: 'Invalid permission_state' });
      return;
    }

    const serverReceiptTime = new Date().toISOString();
    const clientCaptureTime = capture_time || serverReceiptTime;
    const captureMs = new Date(clientCaptureTime).getTime();
    const receiptMs = new Date(serverReceiptTime).getTime();

    if (Number.isNaN(captureMs)) {
      res.status(400).json({ error: 'Invalid capture_time timestamp (GPS-16)' });
      return;
    }

    // GPS-16: Refuse coordinates out of valid range or capture_time in the future (> 5 min tolerance)
    if (permState === 'GRANTED') {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (Number.isNaN(lat) || lat < -90 || lat > 90 || Number.isNaN(lng) || lng < -180 || lng > 180) {
        res.status(400).json({ error: 'Invalid GPS coordinates: latitude must be [-90, 90] and longitude [-180, 180] (GPS-16)' });
        return;
      }
    }

    if (captureMs - receiptMs > 5 * 60 * 1000) {
      res.status(400).json({ error: 'Implausible capture_time in the future refused (GPS-16)' });
      return;
    }

    const isOldClock = Math.abs(receiptMs - captureMs) > 60 * 60 * 1000 ? 1 : 0;
    const flagReason = isOldClock ? 'Device capture_time differs from server_receipt_time by more than 60 minutes' : null;

    // GPS-18: Link to active assignment and vehicle at capture time
    const activeAsn = db
      .prepare('SELECT id, vehicle_id FROM assignments WHERE driver_profile_id = ? AND is_current = 1 ORDER BY id DESC LIMIT 1')
      .get(targetDriverProfileId) as { id: number; vehicle_id: number } | undefined;

    const result = db
      .prepare(
        `INSERT INTO location_reports (
          driver_profile_id, driver_user_id, vehicle_id, assignment_id,
          latitude, longitude, accuracy_meters, capture_time, server_receipt_time,
          permission_state, phone_state, is_flagged_implausible, flag_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        targetDriverProfileId,
        user.id,
        activeAsn?.vehicle_id ?? null,
        activeAsn?.id ?? null,
        permState === 'GRANTED' ? Number(latitude) : null,
        permState === 'GRANTED' ? Number(longitude) : null,
        permState === 'GRANTED' && accuracy_meters !== undefined && accuracy_meters !== null ? Number(accuracy_meters) : null,
        clientCaptureTime,
        serverReceiptTime,
        permState,
        phone_state || 'FOREGROUND',
        isOldClock,
        flagReason
      );

    if (permState === 'GRANTED') {
      db.prepare(
        `INSERT INTO user_locations (user_id, latitude, longitude, accuracy_meters, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           accuracy_meters = excluded.accuracy_meters,
           updated_at = excluded.updated_at`
      ).run(user.id, Number(latitude), Number(longitude), accuracy_meters !== undefined && accuracy_meters !== null ? Number(accuracy_meters) : null, serverReceiptTime);
    }

    const report = db.prepare('SELECT * FROM location_reports WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ report });
  });

  app.get('/api/gps/latest', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (req: Request, res: Response) => {
    const db = getDb();
    const staleSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'gps_stale_threshold_minutes'").get() as { value: string } | undefined;
    const staleThresholdMinutes = Number(staleSetting?.value || 25);

    const drivers = db
      .prepare(
        `SELECT dp.id as driver_profile_id, dp.full_name as driver_name, dp.availability_status
         FROM driver_profiles dp
         ORDER BY dp.id ASC`
      )
      .all() as Array<{ driver_profile_id: number; driver_name: string; availability_status: string }>;

    const nowMs = Date.now();
    const summaries = drivers.map((d) => {
      const latest = db
        .prepare(
          `SELECT lr.*, v.registration_plate, v.make, v.model
           FROM location_reports lr
           LEFT JOIN vehicles v ON v.id = lr.vehicle_id
           WHERE lr.driver_profile_id = ?
           ORDER BY lr.id DESC LIMIT 1`
        )
        .get(d.driver_profile_id) as Record<string, unknown> | undefined;

      if (!latest) {
        return {
          ...d,
          display_state: 'NO_REPORT_YET',
          status_label: 'No report yet',
          is_current: false,
          report: null,
        };
      }

      if (latest.permission_state === 'DENIED') {
        return {
          ...d,
          display_state: 'PERMISSION_DENIED',
          status_label: 'Permission denied (not current)',
          is_current: false,
          report: latest,
        };
      }

      if (latest.permission_state === 'UNAVAILABLE') {
        return {
          ...d,
          display_state: 'LOCATION_UNAVAILABLE',
          status_label: 'Location unavailable (not current)',
          is_current: false,
          report: latest,
        };
      }

      const ageMinutes = Math.max(0, Math.round((nowMs - new Date(String(latest.capture_time)).getTime()) / 60000));
      const isStale = ageMinutes > staleThresholdMinutes;

      return {
        ...d,
        display_state: isStale ? 'STALE' : 'RECENT',
        status_label: isStale
          ? `Stale report (${ageMinutes}m old — last known position, not current)`
          : `Recent periodic report (${ageMinutes}m ago)`,
        age_minutes: ageMinutes,
        stale_threshold_minutes: staleThresholdMinutes,
        is_current: !isStale,
        accuracy_label: latest.accuracy_meters !== null && latest.accuracy_meters !== undefined ? `±${latest.accuracy_meters}m` : 'Accuracy unavailable',
        report: latest,
      };
    });

    recordAudit(db, req.user, 'LOCATION_LATEST_VIEWED', 'LOCATION_REPORT', 'ALL');

    res.json({
      notice:
        'Periodic location reporting only (target every 20 minutes while the driver PWA is active and permission is granted). Not continuous or live tracking (GPS-03).',
      staleThresholdMinutes,
      drivers: summaries,
    });
  });

  app.get('/api/gps/history', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (req: Request, res: Response) => {
    const db = getDb();
    const driverProfileId = req.query.driver_profile_id ? Number(req.query.driver_profile_id) : null;
    const reports = driverProfileId
      ? db.prepare('SELECT * FROM location_reports WHERE driver_profile_id = ? ORDER BY id DESC LIMIT 100').all(driverProfileId)
      : db.prepare('SELECT * FROM location_reports ORDER BY id DESC LIMIT 100').all();

    // AUD-05: Viewing of location history shall itself be recorded as an audit event
    recordAudit(db, req.user, 'LOCATION_HISTORY_VIEWED', 'LOCATION_REPORT', driverProfileId ?? 'ALL');
    res.json({ reports });
  });

  app.all('/api/gps/reports/:id', requireAuth, (req: Request, res: Response) => {
    recordAudit(getDb(), req.user, 'IMMUTABLE_GPS_EDIT_REFUSED', 'LOCATION_REPORT', String(req.params.id));
    res.status(405).json({ error: 'Location reports are append-only and cannot be modified or overwritten (GPS-09)' });
  });

  app.post('/api/gps/retention-cleanup', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const daysSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'gps_retention_days'").get() as { value: string } | undefined;
    const retentionDays = req.body?.retention_days !== undefined ? Number(req.body.retention_days) : Number(daysSetting?.value || 90);
    const cutoffIso = new Date(Date.now() - retentionDays * 86400000).toISOString();

    const result = db.prepare('DELETE FROM location_reports WHERE capture_time < ?').run(cutoffIso);
    recordAudit(db, req.user, 'GPS_RETENTION_APPLIED', 'LOCATION_REPORT', null, null, { retentionDays, deletedCount: result.changes });
    res.json({ deletedCount: result.changes, cutoffIso });
  });

  // ============================================================================
  // 10. ADMIN USAGE ANALYTICS (Revision #6: Completed Trips, Distance Summary
  //     per Day, Week, Month per Car, per Driver, and Combined Overall)
  // ============================================================================

  app.get('/api/analytics/usage', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (_req: Request, res: Response) => {
    const db = getDb();
    const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY id ASC').all() as Array<{
      id: number;
      registration_plate: string;
      make: string;
      model: string;
      car_type: string;
      energy_type: string;
      status: string;
      current_odometer: number;
      battery_percent: number | null;
    }>;

    const completedTrips = db
      .prepare(
        `SELECT tr.*,
                v.registration_plate,
                v.registration_plate as vehicle_plate,
                v.make,
                v.model,
                v.car_type,
                v.energy_type,
                a.driver_profile_id,
                COALESCE(dp.full_name, pref_dp.full_name, 'Standby Driver') as driver_name,
                COALESCE(dp.licence_number, pref_dp.licence_number, '—') as driver_licence_number,
                COALESCE(dp.photo_url, pref_dp.photo_url) as driver_photo_url,
                u.nickname as requester_nickname,
                u.group_username as requester_username,
                dept.name as requester_department
         FROM trip_requests tr
         JOIN vehicles v ON v.id = tr.vehicle_id
         LEFT JOIN assignments a ON a.trip_request_id = tr.id AND a.is_current = 1
         LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
         LEFT JOIN driver_profiles pref_dp ON pref_dp.id = tr.preferred_driver_id
         LEFT JOIN users u ON u.id = tr.requester_id
         LEFT JOIN departments dept ON dept.id = tr.department_id
         WHERE tr.status = 'COMPLETED'
         ORDER BY tr.id DESC`
      )
      .all() as Array<{
      id: number;
      vehicle_id: number;
      registration_plate: string;
      vehicle_plate: string;
      make: string;
      model: string;
      car_type: string;
      energy_type: string;
      driver_profile_id: number | null;
      driver_name: string;
      driver_licence_number: string;
      driver_photo_url: string | null;
      requester_nickname: string | null;
      requester_username: string | null;
      requester_department: string | null;
      passenger_nickname: string | null;
      passengers_json: string | null;
      passenger_count: number;
      purpose: string;
      origin: string;
      destination: string;
      start_time: string;
      end_time: string;
      start_odometer: number | null;
      start_odometer_photo_url: string | null;
      start_odometer_time: string | null;
      end_odometer: number | null;
      end_odometer_photo_url: string | null;
      end_odometer_time: string | null;
      distance_km: number | null;
      actual_start_time: string | null;
      actual_end_time: string | null;
    }>;

    const now = new Date();
    const todayPrefix = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const monthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
    const weekAgoMs = now.getTime() - 7 * 86400000;

    const getIsoWeekKey = (dateStr: string) => {
      const d = new Date(dateStr);
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    };

    // Per-Vehicle Day / Week / Month / All-Time breakdown
    const perVehicle = vehicles.map((v) => {
      const vTrips = completedTrips.filter((t) => t.vehicle_id === v.id);
      let dayTrips = 0;
      let dayKm = 0;
      let weekTrips = 0;
      let weekKm = 0;
      let monthTrips = 0;
      let monthKm = 0;
      let totalTrips = 0;
      let totalKm = 0;

      const byDay: Record<string, { trips: number; distanceKm: number }> = {};
      const byWeek: Record<string, { trips: number; distanceKm: number }> = {};
      const byMonth: Record<string, { trips: number; distanceKm: number }> = {};

      for (const t of vTrips) {
        const refTime = t.actual_end_time || t.end_time;
        const dKey = refTime.slice(0, 10);
        const mKey = refTime.slice(0, 7);
        const wKey = getIsoWeekKey(refTime);
        const dist = t.distance_km ?? Math.max(0, (t.end_odometer ?? 0) - (t.start_odometer ?? 0));

        totalTrips += 1;
        totalKm += dist;

        if (dKey === todayPrefix) {
          dayTrips += 1;
          dayKm += dist;
        }
        if (new Date(refTime).getTime() >= weekAgoMs) {
          weekTrips += 1;
          weekKm += dist;
        }
        if (mKey === monthPrefix) {
          monthTrips += 1;
          monthKm += dist;
        }

        byDay[dKey] = { trips: (byDay[dKey]?.trips || 0) + 1, distanceKm: (byDay[dKey]?.distanceKm || 0) + dist };
        byWeek[wKey] = { trips: (byWeek[wKey]?.trips || 0) + 1, distanceKm: (byWeek[wKey]?.distanceKm || 0) + dist };
        byMonth[mKey] = { trips: (byMonth[mKey]?.trips || 0) + 1, distanceKm: (byMonth[mKey]?.distanceKm || 0) + dist };
      }

      // Separate Fuel (Gasoline) vs EV Charging metrics (EV-05, RPT-04, FUEL-08, EV-07)
      const fuelAgg = db
        .prepare('SELECT COALESCE(SUM(litres), 0) as total_litres, COALESCE(SUM(cost), 0) as fuel_cost FROM fuel_records WHERE vehicle_id = ?')
        .get(v.id) as { total_litres: number; fuel_cost: number };
      const evAgg = db
        .prepare('SELECT COALESCE(SUM(kwh_added), 0) as total_kwh, COALESCE(SUM(cost), 0) as ev_cost FROM ev_charging_records WHERE vehicle_id = ?')
        .get(v.id) as { total_kwh: number; ev_cost: number };
      const maintAgg = db
        .prepare('SELECT COALESCE(SUM(cost), 0) as maint_cost FROM maintenance_records WHERE vehicle_id = ?')
        .get(v.id) as { maint_cost: number };
      const expAgg = db
        .prepare('SELECT COALESCE(SUM(amount), 0) as expense_cost FROM expenses WHERE vehicle_id = ?')
        .get(v.id) as { expense_cost: number };

      return {
        vehicle_id: v.id,
        registration_plate: v.registration_plate,
        make: v.make,
        model: v.model,
        car_type: v.car_type,
        energy_type: v.energy_type,
        status: v.status,
        current_odometer: v.current_odometer,
        battery_percent: v.battery_percent,
        day: { trips: dayTrips, distanceKm: dayKm },
        week: { trips: weekTrips, distanceKm: weekKm },
        month: { trips: monthTrips, distanceKm: monthKm },
        overall: { trips: totalTrips, distanceKm: totalKm },
        byDay,
        byWeek,
        byMonth,
        energy:
          v.energy_type === 'Gasoline'
            ? {
                measureUnit: 'Litres',
                totalLitres: Number(fuelAgg.total_litres.toFixed(2)),
                energyCost: Number(fuelAgg.fuel_cost.toFixed(2)),
                efficiencyKmPerLitre: fuelAgg.total_litres > 0 ? Number((totalKm / fuelAgg.total_litres).toFixed(2)) : null,
              }
            : {
                measureUnit: 'kWh',
                totalKwh: Number(evAgg.total_kwh.toFixed(2)),
                energyCost: Number(evAgg.ev_cost.toFixed(2)),
                efficiencyKwhPer100Km: totalKm > 0 ? Number(((evAgg.total_kwh / totalKm) * 100).toFixed(2)) : null,
              },
        maintenanceCost: Number(maintAgg.maint_cost.toFixed(2)),
        nonEnergyExpenseCost: Number(expAgg.expense_cost.toFixed(2)),
        // EXP-06: Combined cost counts energy and expenses once without double-counting
        totalOperatingCost: Number((fuelAgg.fuel_cost + evAgg.ev_cost + maintAgg.maint_cost + expAgg.expense_cost).toFixed(2)),
      };
    });

    // Overall Combined across ALL 8 vehicles (Revision #6)
    const combinedByDay: Record<string, { trips: number; distanceKm: number }> = {};
    const combinedByWeek: Record<string, { trips: number; distanceKm: number }> = {};
    const combinedByMonth: Record<string, { trips: number; distanceKm: number }> = {};

    for (const pv of perVehicle) {
      for (const [k, val] of Object.entries(pv.byDay)) {
        combinedByDay[k] = { trips: (combinedByDay[k]?.trips || 0) + val.trips, distanceKm: (combinedByDay[k]?.distanceKm || 0) + val.distanceKm };
      }
      for (const [k, val] of Object.entries(pv.byWeek)) {
        combinedByWeek[k] = { trips: (combinedByWeek[k]?.trips || 0) + val.trips, distanceKm: (combinedByWeek[k]?.distanceKm || 0) + val.distanceKm };
      }
      for (const [k, val] of Object.entries(pv.byMonth)) {
        combinedByMonth[k] = { trips: (combinedByMonth[k]?.trips || 0) + val.trips, distanceKm: (combinedByMonth[k]?.distanceKm || 0) + val.distanceKm };
      }
    }

    const combinedOverall = {
      day: {
        trips: perVehicle.reduce((acc, v) => acc + v.day.trips, 0),
        distanceKm: perVehicle.reduce((acc, v) => acc + v.day.distanceKm, 0),
      },
      week: {
        trips: perVehicle.reduce((acc, v) => acc + v.week.trips, 0),
        distanceKm: perVehicle.reduce((acc, v) => acc + v.week.distanceKm, 0),
      },
      month: {
        trips: perVehicle.reduce((acc, v) => acc + v.month.trips, 0),
        distanceKm: perVehicle.reduce((acc, v) => acc + v.month.distanceKm, 0),
      },
      allTime: {
        trips: perVehicle.reduce((acc, v) => acc + v.overall.trips, 0),
        distanceKm: perVehicle.reduce((acc, v) => acc + v.overall.distanceKm, 0),
      },
      byDay: combinedByDay,
      byWeek: combinedByWeek,
      byMonth: combinedByMonth,
      // RPT-04 & EV-05: Keep Gasoline Litres and Electric kWh strictly separate!
      gasolineSummary: {
        vehicleCount: perVehicle.filter((v) => v.energy_type === 'Gasoline').length,
        totalLitres: Number(
          perVehicle
            .filter((v) => v.energy_type === 'Gasoline')
            .reduce((s, v) => s + (v.energy.totalLitres || 0), 0)
            .toFixed(2)
        ),
        totalFuelCost: Number(
          perVehicle
            .filter((v) => v.energy_type === 'Gasoline')
            .reduce((s, v) => s + v.energy.energyCost, 0)
            .toFixed(2)
        ),
      },
      electricSummary: {
        vehicleCount: perVehicle.filter((v) => v.energy_type === 'Electric').length,
        totalKwh: Number(
          perVehicle
            .filter((v) => v.energy_type === 'Electric')
            .reduce((s, v) => s + (v.energy.totalKwh || 0), 0)
            .toFixed(2)
        ),
        totalChargingCost: Number(
          perVehicle
            .filter((v) => v.energy_type === 'Electric')
            .reduce((s, v) => s + v.energy.energyCost, 0)
            .toFixed(2)
        ),
      },
    };

    // Per-Driver Usage Summary (Revision #6)
    const drivers = db.prepare('SELECT id, full_name, availability_status FROM driver_profiles ORDER BY id ASC').all() as Array<{
      id: number;
      full_name: string;
      availability_status: string;
    }>;

    const perDriver = drivers.map((drv) => {
      const dTrips = completedTrips.filter((t) => t.driver_profile_id === drv.id);
      let dayTrips = 0;
      let dayKm = 0;
      let weekTrips = 0;
      let weekKm = 0;
      let monthTrips = 0;
      let monthKm = 0;
      let totalTrips = 0;
      let totalKm = 0;

      for (const t of dTrips) {
        const refTime = t.actual_end_time || t.end_time;
        const dKey = refTime.slice(0, 10);
        const mKey = refTime.slice(0, 7);
        const dist = t.distance_km ?? Math.max(0, (t.end_odometer ?? 0) - (t.start_odometer ?? 0));

        totalTrips += 1;
        totalKm += dist;
        if (dKey === todayPrefix) {
          dayTrips += 1;
          dayKm += dist;
        }
        if (new Date(refTime).getTime() >= weekAgoMs) {
          weekTrips += 1;
          weekKm += dist;
        }
        if (mKey === monthPrefix) {
          monthTrips += 1;
          monthKm += dist;
        }
      }

      return {
        driver_profile_id: drv.id,
        driver_name: drv.full_name,
        availability_status: drv.availability_status,
        day: { trips: dayTrips, distanceKm: dayKm },
        week: { trips: weekTrips, distanceKm: weekKm },
        month: { trips: monthTrips, distanceKm: monthKm },
        overall: { trips: totalTrips, distanceKm: totalKm },
      };
    });

    // Elapsed Trip Duration Calculation (Hours & Minutes count)
    const tripsWithDuration = completedTrips.map((t: any) => {
      const s = t.actual_start_time || t.start_time;
      const e = t.actual_end_time || t.end_time;
      const sMs = new Date(s).getTime();
      const eMs = new Date(e).getTime();
      const durationMin = Math.max(1, Math.round((eMs - sMs) / 60000));
      const hours = Math.floor(durationMin / 60);
      const mins = durationMin % 60;
      return {
        ...t,
        durationMinutes: durationMin,
        durationFormatted: `${hours} Hours ${mins} Minutes`,
      };
    });

    const totalDurationMinutes = tripsWithDuration.reduce((acc: number, t: any) => acc + t.durationMinutes, 0);
    const totalDurationFormatted = `${Math.floor(totalDurationMinutes / 60)} Hours ${totalDurationMinutes % 60} Minutes`;

    // Expense Category Totals in IDR
    const expenseRows = db.prepare(`
      SELECT category, SUM(amount) as total_amount
      FROM expenses
      GROUP BY category
    `).all() as Array<{ category: string; total_amount: number }>;

    const expenseCategoriesIdr: Record<string, number> = {
      Gas: 0,
      Charging: 0,
      Toll: 0,
      Parking: 0,
      Cleaning: 0,
      Other: 0,
    };
    for (const row of expenseRows) {
      const cat = row.category === 'Gasoline' ? 'Gas' : row.category === 'EV Charging' ? 'Charging' : row.category;
      expenseCategoriesIdr[cat] = (expenseCategoriesIdr[cat] || 0) + Number(row.total_amount);
    }

    const fuelAggTotal = db.prepare('SELECT COALESCE(SUM(cost), 0) as s, COALESCE(SUM(litres), 0) as l FROM fuel_records').get() as { s: number; l: number };
    const evAggTotal = db.prepare('SELECT COALESCE(SUM(cost), 0) as s, COALESCE(SUM(kwh_added), 0) as k FROM ev_charging_records').get() as { s: number; k: number };
    const maintAggTotal = db.prepare('SELECT COALESCE(SUM(cost), 0) as s FROM maintenance_records').get() as { s: number };
    const totalOperatingCostIdr =
      fuelAggTotal.s +
      evAggTotal.s +
      maintAggTotal.s +
      (expenseCategoriesIdr.Toll || 0) +
      (expenseCategoriesIdr.Parking || 0) +
      (expenseCategoriesIdr.Cleaning || 0) +
      (expenseCategoriesIdr.Other || 0);

    res.json({
      combinedOverall,
      perVehicle,
      perDriver,
      tripDurationSummary: {
        totalCompletedTrips: completedTrips.length,
        totalDurationMinutes,
        totalDurationFormatted,
        trips: tripsWithDuration,
      },
      expensesBreakdownIdr: {
        gas_idr: fuelAggTotal.s,
        gas_litres: fuelAggTotal.l,
        electric_idr: evAggTotal.s,
        electric_kwh: evAggTotal.k,
        toll_idr: expenseCategoriesIdr.Toll || 0,
        parking_idr: expenseCategoriesIdr.Parking || 0,
        maint_idr: maintAggTotal.s,
        cleaning_idr: expenseCategoriesIdr.Cleaning || 0,
        other_idr: expenseCategoriesIdr.Other || 0,
        total_operational_cost_idr: totalOperatingCostIdr,
      },
    });
  });

  // Admin Fleet Live Map: All operational car positions and statuses
  app.get('/api/admin/fleet-map-positions', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (_req: Request, res: Response) => {
    const db = getDb();
    const vehicles = db.prepare(`
      SELECT v.*,
             dp.id as default_driver_profile_id,
             dp.full_name as default_driver_name,
             dp.contact_number as default_driver_phone,
             dp.photo_url as default_driver_photo,
             dp.licence_number as default_driver_licence,
             dp.licence_expiry as default_driver_licence_expiry
      FROM vehicles v
      LEFT JOIN driver_profiles dp ON dp.id = v.default_driver_id
      WHERE v.status != 'Retired'
      ORDER BY v.id ASC
    `).all() as any[];

    const DEFAULT_POOL = { lat: -6.19834, lon: 106.88873, name: 'Central Fleet Pool (Pulogadung)' };
    const HQ_POOL = { lat: -6.22728, lon: 106.80816, name: 'SCBD Head Office Basement B1' };

    const positions = vehicles.map((v, index) => {
      const activeTrip = db.prepare(`
        SELECT tr.*,
               dp.id as assigned_driver_id,
               dp.full_name as assigned_driver_name,
               dp.contact_number as assigned_driver_phone,
               dp.photo_url as assigned_driver_photo,
               dp.licence_number as assigned_driver_licence,
               dp.licence_expiry as assigned_driver_licence_expiry,
               u_req.nickname as requester_nickname,
               u_req.group_username as requester_username,
               d_req.name as requester_department
        FROM trip_requests tr
        LEFT JOIN assignments a ON a.trip_request_id = tr.id AND a.is_current = 1
        LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
        LEFT JOIN users u_req ON u_req.id = tr.requester_id
        LEFT JOIN departments d_req ON d_req.id = tr.department_id
        WHERE tr.vehicle_id = ? AND tr.status = 'IN_PROGRESS'
        ORDER BY tr.id DESC LIMIT 1
      `).get(v.id) as any;

      const latestGps = db.prepare(`
        SELECT latitude, longitude, capture_time, phone_state, accuracy_meters
        FROM location_reports
        WHERE vehicle_id = ?
        ORDER BY id DESC LIMIT 1
      `).get(v.id) as any;

      let lat = latestGps?.latitude;
      let lon = latestGps?.longitude;
      let locationName = latestGps ? `GPS Live (${latestGps.accuracy_meters || 10}m)` : v.last_parking_spot || DEFAULT_POOL.name;

      if (!lat || !lon) {
        const base = v.last_parking_spot?.includes('SCBD') ? HQ_POOL : DEFAULT_POOL;
        const offsetLat = ((index % 4) - 1.5) * 0.0008;
        const offsetLon = (Math.floor(index / 4) - 0.5) * 0.0009;
        lat = Number((base.lat + offsetLat).toFixed(6));
        lon = Number((base.lon + offsetLon).toFixed(6));
      }

      let rideDuration = '';
      if (activeTrip) {
        const startMs = new Date(activeTrip.actual_start_time || activeTrip.start_time).getTime();
        const diffMins = Math.max(1, Math.round((Date.now() - startMs) / 60000));
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        rideDuration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
      }

      return {
        id: v.id,
        registration_plate: v.registration_plate,
        plate_number: v.registration_plate,
        make: v.make,
        model: v.model,
        model_name: `${v.make} ${v.model}`,
        car_type: v.car_type,
        energy_type: v.energy_type,
        status: activeTrip ? 'IN_TRIP' : v.status,
        battery_percent: v.battery_percent,
        current_odometer: v.current_odometer,
        latitude: lat,
        longitude: lon,
        lat: lat,
        lng: lon,
        location_label: locationName,
        driver_name: activeTrip?.assigned_driver_name || v.default_driver_name || 'Standby Driver',
        driver_phone: activeTrip?.assigned_driver_phone || v.default_driver_phone || '',
        driver_photo_url: activeTrip?.assigned_driver_photo || v.default_driver_photo || null,
        driver_licence_number: activeTrip?.assigned_driver_licence || v.default_driver_licence || '',
        driver_licence_expiry: activeTrip?.assigned_driver_licence_expiry || v.default_driver_licence_expiry || '',
        active_trip: activeTrip ? {
          id: activeTrip.id,
          purpose: activeTrip.purpose,
          origin: activeTrip.origin,
          destination: activeTrip.destination,
          start_time: activeTrip.start_time,
          actual_start_time: activeTrip.actual_start_time,
          start_odometer: activeTrip.start_odometer,
          start_odometer_photo_url: activeTrip.start_odometer_photo_url,
          start_odometer_time: activeTrip.start_odometer_time,
          passenger_nickname: activeTrip.passenger_nickname,
          passengers_json: activeTrip.passengers_json,
          passenger_count: activeTrip.passenger_count,
          requester_nickname: activeTrip.requester_nickname || 'Lead Passenger',
          requester_username: activeTrip.requester_username || '',
          requester_department: activeTrip.requester_department || 'General Fleet',
          ride_duration_formatted: rideDuration,
        } : null,
      };
    });

    res.json({ fleetPositions: positions, vehicles: positions });
  });

  // Admin System Reset: Clean Production Slate or Reset Operations Only
  app.post('/api/admin/system/reset-data', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const { mode, vehicle_odometers, confirmation_code } = req.body || {};
    if (confirmation_code !== 'RESET') {
      return res.status(400).json({ error: 'Please enter the exact confirmation code "RESET" to confirm this action.' });
    }

    const db = getDb();
    try {
      runInTransaction(db, () => {
        db.exec('DROP TRIGGER IF EXISTS prevent_approval_decision_delete;');
        db.exec('DROP TRIGGER IF EXISTS prevent_approval_decision_update;');
        db.exec('DROP TRIGGER IF EXISTS prevent_assignment_delete;');

        if (mode === 'OPERATIONS_ONLY') {
          db.prepare('DELETE FROM trip_events').run();
          db.prepare('DELETE FROM location_reports').run();
          db.prepare('DELETE FROM assignments').run();
          db.prepare('DELETE FROM booking_history').run();
          db.prepare('DELETE FROM approval_decisions').run();
          db.prepare('DELETE FROM bookings').run();
          db.prepare('DELETE FROM expense_decisions').run();
          db.prepare('DELETE FROM expenses').run();
          db.prepare('DELETE FROM fuel_records').run();
          db.prepare('DELETE FROM ev_charging_records').run();
          db.prepare('DELETE FROM maintenance_records').run();
          db.prepare('DELETE FROM trip_requests').run();
          db.prepare('DELETE FROM notifications').run();

          // Reset vehicles odometers and reset status to Available
          const vehicles = db.prepare('SELECT id FROM vehicles').all() as Array<{ id: number }>;
          const updateVeh = db.prepare(
            "UPDATE vehicles SET current_odometer = ?, status = ?, battery_percent = 100, standby_reason = NULL, updated_at = datetime('now') WHERE id = ?"
          );
          for (const v of vehicles) {
            const newOdo =
              vehicle_odometers && typeof vehicle_odometers[v.id] === 'number'
                ? Math.max(0, Math.round(vehicle_odometers[v.id]))
                : 0;
            updateVeh.run(newOdo, 'Available', v.id);
          }

          // Reset driver availability
          db.prepare("UPDATE driver_profiles SET availability_status = 'Active'").run();

          recordAudit(db, req.user, 'ADMIN_OPERATIONS_RESET', 'SYSTEM', 0, null, {
            mode: 'OPERATIONS_ONLY',
            vehicles_reset: vehicles.length,
          });
        } else if (mode === 'FACTORY_RESET') {
          db.prepare('DELETE FROM trip_events').run();
          db.prepare('DELETE FROM location_reports').run();
          db.prepare('DELETE FROM assignments').run();
          db.prepare('DELETE FROM booking_history').run();
          db.prepare('DELETE FROM approval_decisions').run();
          db.prepare('DELETE FROM bookings').run();
          db.prepare('DELETE FROM expense_decisions').run();
          db.prepare('DELETE FROM expenses').run();
          db.prepare('DELETE FROM fuel_records').run();
          db.prepare('DELETE FROM ev_charging_records').run();
          db.prepare('DELETE FROM maintenance_records').run();
          db.prepare('DELETE FROM trip_requests').run();
          db.prepare('DELETE FROM notifications').run();
          db.prepare('DELETE FROM documents').run();
          db.prepare('UPDATE vehicles SET default_driver_id = NULL').run();
          db.prepare('DELETE FROM vehicles').run();
          db.prepare('DELETE FROM driver_profiles').run();
          db.prepare('DELETE FROM user_locations WHERE user_id != ?').run(req.user!.id);
          db.prepare('DELETE FROM push_subscriptions WHERE user_id != ?').run(req.user!.id);
          db.prepare('DELETE FROM sessions WHERE user_id != ?').run(req.user!.id);
          db.prepare('UPDATE users SET approved_by = NULL').run();
          db.prepare("DELETE FROM users WHERE role != 'ADM'").run();

          recordAudit(db, req.user, 'ADMIN_FACTORY_RESET', 'SYSTEM', 0, null, {
            mode: 'FACTORY_RESET',
          });
        } else {
          throw new Error('Invalid reset mode specified. Supported modes: OPERATIONS_ONLY, FACTORY_RESET');
        }

        db.exec(`
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

          CREATE TRIGGER IF NOT EXISTS prevent_assignment_delete
          BEFORE DELETE ON assignments
          BEGIN
            SELECT RAISE(ABORT, 'Assignment records are append-only and cannot be deleted (ASN-04)');
          END;
        `);
      });

      res.json({
        success: true,
        mode,
        message:
          mode === 'FACTORY_RESET'
            ? 'Complete factory reset successful. The system has been returned to a clean production slate with 12 company groups and your Administrator account ready for real fleet registration.'
            : 'Operational test data wiped successfully. Vehicles and drivers remain intact with updated starting odometers.',
      });
    } catch (err: any) {
      console.error('System reset failed:', err);
      res.status(500).json({ error: err.message || 'System reset failed' });
    }
  });

  // Comprehensive Multi-Section Executive Report Generator (HTML/PDF Printable Document)
  app.get('/api/reports/executive-pdf', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (_req: Request, res: Response) => {
    const db = getDb();
    const completedTrips = db
      .prepare(
        `SELECT tr.*,
                v.registration_plate,
                v.make,
                v.model,
                v.energy_type,
                COALESCE(dp.full_name, pref_dp.full_name, 'Standby Driver') as driver_name,
                COALESCE(dp.licence_number, pref_dp.licence_number, '—') as driver_licence_number,
                u.nickname as requester_nickname,
                dept.name as requester_department
         FROM trip_requests tr
         JOIN vehicles v ON v.id = tr.vehicle_id
         LEFT JOIN assignments a ON a.trip_request_id = tr.id AND a.is_current = 1
         LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
         LEFT JOIN driver_profiles pref_dp ON pref_dp.id = tr.preferred_driver_id
         LEFT JOIN users u ON u.id = tr.requester_id
         LEFT JOIN departments dept ON dept.id = tr.department_id
         WHERE tr.status = 'COMPLETED'
         ORDER BY tr.id DESC`
      )
      .all() as any[];

    const vehicles = db.prepare("SELECT * FROM vehicles WHERE status != 'Retired' ORDER BY id ASC").all() as any[];
    const drivers = db.prepare("SELECT * FROM driver_profiles ORDER BY id ASC").all() as any[];

    let totalDurationMinutes = 0;
    const tripsWithDuration = completedTrips.map((t) => {
      const s = new Date(t.actual_start_time || t.start_time).getTime();
      const e = new Date(t.actual_end_time || t.end_time).getTime();
      const durationMin = Math.max(1, Math.round((e - s) / 60000));
      totalDurationMinutes += durationMin;
      const hours = Math.floor(durationMin / 60);
      const mins = durationMin % 60;

      let paxList = t.passenger_nickname || 'Employee';
      if (t.passengers_json) {
        try {
          const parsed = JSON.parse(t.passengers_json);
          if (Array.isArray(parsed) && parsed.length > 0) {
            paxList = parsed.map((p: any, idx: number) => `Pax ${idx + 1}: ${p.nickname || 'Guest'}`).join(', ');
          }
        } catch {}
      }

      return {
        ...t,
        durationMinutes: durationMin,
        durationFormatted: `${hours}h ${mins}m`,
        paxList,
      };
    });

    const totalHours = Math.floor(totalDurationMinutes / 60);
    const totalMins = totalDurationMinutes % 60;
    const totalKm = completedTrips.reduce((acc, t) => acc + (t.distance_km || 0), 0);

    const fuelAgg = db.prepare('SELECT COALESCE(SUM(cost), 0) as s, COALESCE(SUM(litres), 0) as l FROM fuel_records').get() as { s: number; l: number };
    const evAgg = db.prepare('SELECT COALESCE(SUM(cost), 0) as s, COALESCE(SUM(kwh_added), 0) as k FROM ev_charging_records').get() as { s: number; k: number };
    const tollAgg = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE category = 'Toll'").get() as { s: number };
    const parkingAgg = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE category = 'Parking'").get() as { s: number };
    const maintAgg = db.prepare('SELECT COALESCE(SUM(cost), 0) as s FROM maintenance_records').get() as { s: number };
    const totalCostIdr = fuelAgg.s + evAgg.s + tollAgg.s + parkingAgg.s + maintAgg.s;

    const formatIdr = (num: number) => `Rp ${Number(num || 0).toLocaleString('id-ID')}`;

    // Per-vehicle metrics
    const vehicleRowsHtml = vehicles.map((v) => {
      const vTrips = completedTrips.filter((t) => t.vehicle_id === v.id);
      const vKm = vTrips.reduce((acc, t) => acc + (t.distance_km || 0), 0);
      const startOdo = Math.max(0, (v.current_odometer || 0) - vKm);
      const isEv = v.energy_type === 'Electric';
      const energyAgg = isEv
        ? db.prepare('SELECT COALESCE(SUM(kwh_added), 0) as q, COALESCE(SUM(cost), 0) as c FROM ev_charging_records WHERE vehicle_id = ?').get(v.id) as { q: number; c: number }
        : db.prepare('SELECT COALESCE(SUM(litres), 0) as q, COALESCE(SUM(cost), 0) as c FROM fuel_records WHERE vehicle_id = ?').get(v.id) as { q: number; c: number };

      const efficiency = isEv
        ? (vKm > 0 && energyAgg.q > 0 ? `${((energyAgg.q / vKm) * 100).toFixed(1)} kWh/100km` : '—')
        : (energyAgg.q > 0 ? `${(vKm / energyAgg.q).toFixed(1)} km/L` : '—');

      return `
        <tr>
          <td><strong>${v.registration_plate}</strong></td>
          <td>${v.make} ${v.model} (${v.car_type})</td>
          <td><span class="badge ${isEv ? 'badge-ev' : 'badge-gas'}">${v.energy_type}</span></td>
          <td class="mono right">${startOdo.toLocaleString('id-ID')} km</td>
          <td class="mono right">${Number(v.current_odometer || 0).toLocaleString('id-ID')} km</td>
          <td class="mono right font-bold">${vKm.toLocaleString('id-ID')} km</td>
          <td class="center font-bold">${vTrips.length}</td>
          <td class="mono right">${energyAgg.q > 0 ? `${energyAgg.q.toFixed(1)} ${isEv ? 'kWh' : 'L'}` : '0'}</td>
          <td class="mono right font-bold">${formatIdr(energyAgg.c)}</td>
          <td class="center mono">${efficiency}</td>
        </tr>
      `;
    }).join('');

    // Per-driver metrics
    const driverRowsHtml = drivers.map((d) => {
      const dTrips = tripsWithDuration.filter((t) => t.driver_profile_id === d.id || t.preferred_driver_id === d.id);
      const dMin = dTrips.reduce((acc, t) => acc + t.durationMinutes, 0);
      const dHours = Math.floor(dMin / 60);
      const dRemainMin = dMin % 60;
      const dKm = dTrips.reduce((acc, t) => acc + (t.distance_km || 0), 0);
      const dExpenses = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE description LIKE ?").get(`%${d.full_name}%`) as { s: number };

      return `
        <tr>
          <td><strong>${d.full_name}</strong></td>
          <td class="mono">${d.licence_number} (Exp: ${d.licence_expiry || '—'})</td>
          <td class="center font-bold">${dTrips.length}</td>
          <td class="font-bold text-green">${dHours}h ${dRemainMin}m</td>
          <td class="mono right font-bold">${dKm.toLocaleString('id-ID')} km</td>
          <td class="mono right">${formatIdr(dExpenses.s)}</td>
          <td><span class="badge ${d.availability_status === 'Active' ? 'badge-ev' : 'badge-neutral'}">${d.availability_status}</span></td>
        </tr>
      `;
    }).join('');

    // Trip Manifest Log rows
    const tripRowsHtml = tripsWithDuration.map((t) => {
      return `
        <tr>
          <td class="mono">#${t.id}</td>
          <td class="mono" style="font-size:11px;">${(t.actual_start_time || t.start_time).slice(0, 16).replace('T', ' ')}</td>
          <td><strong>${t.registration_plate}</strong><br/><span style="font-size:11px;color:#64748b;">${t.make} ${t.model}</span></td>
          <td><strong>${t.driver_name}</strong></td>
          <td>${t.requester_nickname} <span style="color:#64748b;font-size:11px;">(${t.requester_department || 'General'})</span></td>
          <td style="font-size:11.5px;max-width:140px;">${t.paxList}</td>
          <td>${t.origin || 'HQ Pool'} ➔ <strong>${t.destination}</strong><br/><span style="font-size:11px;color:#64748b;">${t.purpose}</span></td>
          <td class="mono right">${t.start_odometer !== null ? `${t.start_odometer.toLocaleString('id-ID')} km` : '—'}</td>
          <td class="mono right">${t.end_odometer !== null ? `${t.end_odometer.toLocaleString('id-ID')} km` : '—'}</td>
          <td class="mono right font-bold">${t.distance_km || 0} km</td>
          <td class="font-bold text-green">${t.durationFormatted}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GalaxyFleet Executive Management Report</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 24px;
      line-height: 1.45;
    }
    .report-wrap {
      max-width: 1240px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #0072de;
      padding-bottom: 18px;
      margin-bottom: 22px;
    }
    .brand-title { font-size: 24px; font-weight: 800; color: #0072de; margin: 0; letter-spacing: -0.5px; }
    .brand-subtitle { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .kpi-label { font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi-val { font-size: 21px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      border-left: 4px solid #0072de;
      padding-left: 10px;
      margin: 26px 0 12px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 18px;
    }
    th, td {
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    th {
      background: #f1f5f9;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.03em;
    }
    tr:nth-child(even) td { background: #fafafa; }
    .right { text-align: right; }
    .center { text-align: center; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .font-bold { font-weight: 700; }
    .text-blue { color: #0072de; }
    .text-green { color: #059669; }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 800;
    }
    .badge-ev { background: #ecfdf5; color: #059669; }
    .badge-gas { background: #e0edff; color: #0072de; }
    .badge-neutral { background: #f1f5f9; color: #475569; }
    .sign-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
    }
    .sign-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      background: #fdfdfd;
    }
    .sign-line {
      margin-top: 50px;
      border-top: 1.5px solid #0f172a;
      padding-top: 6px;
      font-weight: 700;
      font-size: 12px;
    }
    .no-print {
      margin-bottom: 16px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn {
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: none;
    }
    .btn-blue { background: #0072de; color: #fff; }
    @media print {
      body { background: #fff; padding: 0; }
      .report-wrap { border: none; box-shadow: none; padding: 0; }
      .no-print { display: none !important; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn btn-blue" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="report-wrap">
    <div class="header">
      <div>
        <h1 class="brand-title">GALAXYFLEET EXECUTIVE MANAGEMENT REPORT</h1>
        <div class="brand-subtitle">Official Fleet Operations, Vehicle Odometer Audit & Financial Ledger • Currency: Indonesian Rupiah (IDR)</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px;font-weight:700;color:#0f172a;">Generated: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
        <div style="font-size:11px;color:#94a3b8;font-family:monospace;">STRICTLY CONFIDENTIAL</div>
      </div>
    </div>

    <!-- Section 1: Executive KPI Summary -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Completed Trips</div>
        <div class="kpi-val text-blue">${completedTrips.length} Trips</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">Across ${vehicles.length} Operational Cars</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cumulative Driving Time</div>
        <div class="kpi-val text-green">${totalHours}h ${totalMins}m</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">Total Driver Road Time</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Distance Traveled</div>
        <div class="kpi-val mono">${totalKm.toLocaleString('id-ID')} km</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">Verified Fleet Kilometers</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Operating Expenditure</div>
        <div class="kpi-val mono text-blue" style="font-size:18px;">${formatIdr(totalCostIdr)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">Fuel, EV, Toll, Parking & Maint</div>
      </div>
    </div>

    <!-- Section 2: Vehicle Odometer & Mileage Audit Table -->
    <div class="section-title">1. Vehicle Odometer & Mileage Audit Table</div>
    <table>
      <thead>
        <tr>
          <th>Plate</th>
          <th>Make & Model</th>
          <th>Energy</th>
          <th class="right">Baseline Odo</th>
          <th class="right">Current Odo</th>
          <th class="right">Traveled</th>
          <th class="center">Trips</th>
          <th class="right">Fuel/Energy</th>
          <th class="right">Cost (IDR)</th>
          <th class="center">Efficiency</th>
        </tr>
      </thead>
      <tbody>
        ${vehicleRowsHtml || '<tr><td colspan="10" class="center">No vehicles registered yet.</td></tr>'}
      </tbody>
    </table>

    <!-- Section 3: Driver Performance & Working Hours Table -->
    <div class="section-title">2. Driver Working Hours & Performance Table</div>
    <table>
      <thead>
        <tr>
          <th>Driver Name</th>
          <th>Driving License (SIM)</th>
          <th class="center">Trips</th>
          <th>Driving Hours</th>
          <th class="right">Total Distance</th>
          <th class="right">Reimbursements</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${driverRowsHtml || '<tr><td colspan="7" class="center">No drivers registered yet.</td></tr>'}
      </tbody>
    </table>

    <!-- Section 4: Energy & Operating Expense Ledger in IDR -->
    <div class="section-title">3. Comprehensive Energy & Expense Ledger (IDR)</div>
    <table>
      <thead>
        <tr>
          <th>Expense Category</th>
          <th>Quantity / Usage</th>
          <th>Description</th>
          <th class="right">Total Cost (IDR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>⛽ Gasoline Fuel</strong></td>
          <td class="mono">${fuelAgg.l.toFixed(1)} Litres</td>
          <td>Gasoline Fleet Refueling</td>
          <td class="mono right font-bold">${formatIdr(fuelAgg.s)}</td>
        </tr>
        <tr>
          <td><strong>⚡ Electric Charging (EV)</strong></td>
          <td class="mono">${evAgg.k.toFixed(1)} kWh</td>
          <td>EV Charging Stations & Fast Chargers</td>
          <td class="mono right font-bold">${formatIdr(evAgg.s)}</td>
        </tr>
        <tr>
          <td><strong>🛣️ Tollway Operational Fees</strong></td>
          <td>Receipt Verified</td>
          <td>Highway E-Toll Card Reimbursements</td>
          <td class="mono right font-bold">${formatIdr(tollAgg.s)}</td>
        </tr>
        <tr>
          <td><strong>🅿️ Parking Facility Fees</strong></td>
          <td>Receipt Verified</td>
          <td>Official Operational Parking Fees</td>
          <td class="mono right font-bold">${formatIdr(parkingAgg.s)}</td>
        </tr>
        <tr>
          <td><strong>🔧 Scheduled Maintenance & Service</strong></td>
          <td>Periodic Inspections</td>
          <td>Workshop Services & Repairs</td>
          <td class="mono right font-bold">${formatIdr(maintAgg.s)}</td>
        </tr>
        <tr style="background:#f1f5f9;font-weight:800;">
          <td colspan="3">GRAND TOTAL OPERATIONAL EXPENDITURE</td>
          <td class="mono right text-blue" style="font-size:14px;">${formatIdr(totalCostIdr)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Section 5: Trip Manifest Log -->
    <div class="section-title">4. Chronological Trip Manifest Log</div>
    <table>
      <thead>
        <tr>
          <th>Trip</th>
          <th>Date & Time</th>
          <th>Vehicle</th>
          <th>Driver</th>
          <th>Requester</th>
          <th>Passengers</th>
          <th>Route & Purpose</th>
          <th class="right">Start Odo</th>
          <th class="right">End Odo</th>
          <th class="right">Distance</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        ${tripRowsHtml || '<tr><td colspan="11" class="center">No completed trips on record.</td></tr>'}
      </tbody>
    </table>

    <!-- Section 6: Executive Sign-off Signatures -->
    <div class="sign-grid">
      <div class="sign-box">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Prepared By</div>
        <div class="sign-line">Fleet Operations Dispatcher</div>
      </div>
      <div class="sign-box">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Reviewed By</div>
        <div class="sign-line">Head of Workplace Services (HWS)</div>
      </div>
      <div class="sign-box">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Approved By</div>
        <div class="sign-line">Executive General Manager</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    if (_req.query.format === 'html' || _req.headers.accept?.includes('text/html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(htmlContent);
    }

    const pdfBuffer = Buffer.from(
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n4 0 obj\n<< /Length 950 >>\nstream\nBT\n/F1 18 Tf 50 780 Td (GALAXYFLEET EXECUTIVE MANAGEMENT REPORT) Tj\n/F2 10 Tf 0 -20 Td (Executive Briefing | Currency: Indonesian Rupiah [IDR]) Tj\n/F1 12 Tf 0 -30 Td (1. OPERATIONAL FLEET SUMMARY) Tj\n/F2 10 Tf 0 -18 Td (- Total Operational Vehicles: ${vehicles.length} cars) Tj\n0 -15 Td (- Total Completed Trips: ${completedTrips.length} trips) Tj\n0 -15 Td (- Total Cumulative Trip Duration: ${totalHours} Hours ${totalMins} Minutes) Tj\n0 -15 Td (- Total Distance Traveled: ${totalKm} km) Tj\n0 -15 Td (- Total Operational Expenditure: Rp ${Number(totalCostIdr).toLocaleString('id-ID')}) Tj\n/F1 12 Tf 0 -30 Td (2. ENERGY & EXPENSE BREAKDOWN IN IDR) Tj\n/F2 10 Tf 0 -18 Td (- Gasoline: ${fuelAgg.l} Litres | Cost: Rp ${Number(fuelAgg.s).toLocaleString('id-ID')}) Tj\n0 -15 Td (- Electric EV: ${evAgg.k} kWh | Cost: Rp ${Number(evAgg.s).toLocaleString('id-ID')}) Tj\n0 -15 Td (- Tollway Operational Fees: Rp ${Number(tollAgg.s).toLocaleString('id-ID')}) Tj\n0 -15 Td (- Parking Facility Fees: Rp ${Number(parkingAgg.s).toLocaleString('id-ID')}) Tj\n/F1 10 Tf 0 -40 Td (CONFIDENTIAL - STRICTLY FOR COMPANY INTERNAL EXECUTIVE REVIEW) Tj\nET\nendstream\nendobj\nxref\n0 7\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000300 00000 n \n0000000210 00000 n \n0000000255 00000 n \ntrailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n1350\n%%EOF\n`,
      'utf8'
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fleet_executive_report_idr.pdf"');
    res.send(pdfBuffer);
  });

  // Revision: 5-minute reminder & 20-minute auto-cancellation for passenger no-show
  function checkTripAlertsAndAutoCancellations(db: ReturnType<typeof getDb>) {
    const now = new Date();
    const nowMs = now.getTime();

    // 1. 20-minute auto-cancellation for approved trips that haven't departed
    const approvedTrips = db
      .prepare(
        `SELECT tr.id, tr.requester_id, tr.purpose, tr.origin, tr.destination, tr.start_time,
                v.registration_plate, dp.user_id as driver_user_id
         FROM trip_requests tr
         JOIN vehicles v ON v.id = tr.vehicle_id
         LEFT JOIN assignments a ON a.trip_request_id = tr.id AND a.is_current = 1
         LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
         WHERE tr.status = 'APPROVED'`
      )
      .all() as Array<{
      id: number;
      requester_id: number;
      purpose: string;
      origin: string;
      destination: string;
      start_time: string;
      registration_plate: string;
      driver_user_id: number | null;
    }>;

    for (const t of approvedTrips) {
      const startMs = new Date(t.start_time).getTime();
      if (!Number.isNaN(startMs)) {
        if (nowMs >= startMs + 20 * 60 * 1000) {
          try {
            db.prepare("UPDATE trip_requests SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?").run(t.id);
            db.prepare(
              "UPDATE bookings SET status = 'CANCELLED', cancellation_reason = 'Auto-cancelled: Passenger no-show within 20 minutes', updated_at = datetime('now') WHERE trip_request_id = ?"
            ).run(t.id);
            db.prepare('UPDATE assignments SET is_current = 0 WHERE trip_request_id = ?').run(t.id);

            sendUserNotification(db, {
              userId: t.requester_id,
              triggerType: 'BOOKING_AUTO_CANCEL_NO_SHOW',
              title: 'Booking Cancelled (20-Min No Show)',
              body: `Your booking for "${t.purpose}" (${t.registration_plate}) was automatically cancelled because departure was not initiated within 20 minutes of schedule. The vehicle and driver have been released.`,
              relatedEntityType: 'TRIP_REQUEST',
              relatedEntityId: t.id,
            });

            if (t.driver_user_id) {
              sendUserNotification(db, {
                userId: t.driver_user_id,
                triggerType: 'DISPATCH_AUTO_CANCEL_NO_SHOW',
                title: 'Dispatch Order Cancelled (Passenger No-Show)',
                body: `Trip "${t.purpose}" was automatically cancelled due to passenger no-show after 20 minutes. Vehicle ${t.registration_plate} is now available.`,
                relatedEntityType: 'TRIP_REQUEST',
                relatedEntityId: t.id,
              });
            }
          } catch (e) {
            console.error('Error auto-cancelling trip:', e);
          }
        } else {
          // 5-minute reminder before start time (between 0 and 5 minutes prior)
          const diffMs = startMs - nowMs;
          if (diffMs > 0 && diffMs <= 5 * 60 * 1000) {
            const sent = db
              .prepare(
                "SELECT id FROM notifications WHERE user_id = ? AND related_entity_id = ? AND trigger_type = 'TRIP_5MIN_CONFIRMATION'"
              )
              .get(t.requester_id, t.id);

            if (!sent) {
              sendUserNotification(db, {
                userId: t.requester_id,
                triggerType: 'TRIP_5MIN_CONFIRMATION',
                title: 'Trip Starting in 5 Minutes',
                body: `Your ride with ${t.registration_plate} starts in 5 minutes (${t.start_time.slice(11, 16)}). Please confirm you are ready to depart or let dispatch know if your schedule changed.`,
                relatedEntityType: 'TRIP_REQUEST',
                relatedEntityId: t.id,
              });
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // 11. NOTIFICATIONS, WEB PUSH, REMINDERS, AUDIT LOG & DATA IMPORT
  // ============================================================================

  app.get('/api/notifications', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    try {
      checkTripAlertsAndAutoCancellations(db);
    } catch {}
    const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user!.id);
    res.json({ notifications });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
    res.json({ ok: true });
  });

  app.post('/api/notifications/subscribe', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const { endpoint, keys } = req.body ?? {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Valid Web Push subscription (endpoint, keys.p256dh, keys.auth) is required' });
      return;
    }

    db.prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
    ).run(req.user!.id, endpoint, keys.p256dh, keys.auth, req.headers['user-agent'] || null);

    res.status(201).json({ subscribed: true });
  });

  app.post('/api/notifications/test', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const id = sendUserNotification(db, {
      userId: req.user!.id,
      triggerType: 'TEST_NOTIFICATION',
      title: 'Fleet PWA Push Notification Active',
      body: req.body?.body || 'You will receive instant booking updates, reminders, and dispatch alerts.',
    });
    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    res.status(201).json({ notification });
  });

  // Revision #5: Send Booking & Dispatch Reminders for upcoming trips
  app.post('/api/notifications/send-reminders', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (req: Request, res: Response) => {
    const db = getDb();
    const upcomingTrips = db
      .prepare(
        `SELECT tr.id, tr.requester_id, tr.purpose, tr.origin, tr.destination, tr.start_time,
                v.registration_plate, dp.user_id as driver_user_id
         FROM trip_requests tr
         JOIN vehicles v ON v.id = tr.vehicle_id
         LEFT JOIN assignments a ON a.trip_request_id = tr.id AND a.is_current = 1
         LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
         WHERE tr.status IN ('PENDING_APPROVAL', 'APPROVED')`
      )
      .all() as Array<{
      id: number;
      requester_id: number;
      purpose: string;
      origin: string;
      destination: string;
      start_time: string;
      registration_plate: string;
      driver_user_id: number | null;
    }>;

    let sentCount = 0;
    for (const t of upcomingTrips) {
      sendUserNotification(db, {
        userId: t.requester_id,
        triggerType: 'BOOKING_REMINDER',
        title: 'Upcoming Vehicle Booking Reminder',
        body: `Reminder: Your booking "${t.purpose}" (${t.registration_plate}) is scheduled for ${t.start_time}.`,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: t.id,
      });
      sentCount += 1;

      if (t.driver_user_id) {
        sendUserNotification(db, {
          userId: t.driver_user_id,
          triggerType: 'DISPATCH_REMINDER',
          title: 'Upcoming Dispatch Order Reminder',
          body: `Reminder: Dispatch order "${t.purpose}" (${t.origin} -> ${t.destination}) with ${t.registration_plate} starts at ${t.start_time}.`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: t.id,
        });
        sentCount += 1;
      }
    }

    recordAudit(db, req.user, 'BOOKING_REMINDERS_SENT', 'NOTIFICATION', null, null, { sentCount });
    res.json({ sentCount });
  });

  // Audit History (AUD-01 to AUD-05)
  app.get('/api/audit', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (_req: Request, res: Response) => {
    const db = getDb();
    const events = db.prepare('SELECT * FROM audit_events ORDER BY id DESC LIMIT 200').all();
    res.json({ auditEvents: events });
  });

  app.all('/api/audit/:id', requireAuth, (_req: Request, res: Response) => {
    res.status(405).json({ error: 'Audit events are immutable and cannot be modified or deleted (AUD-02)' });
  });

  // Data Import with Dry Run & Reconciliation (IMP-01 to IMP-03, TC-IMP-01)
  app.post('/api/import', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const { dry_run, vehicles: importVehicles } = req.body ?? {};
    if (!Array.isArray(importVehicles)) {
      res.status(400).json({ error: 'vehicles array is required for import' });
      return;
    }

    const validRows: Array<Record<string, unknown>> = [];
    const invalidRows: Array<{ index: number; error: string; row: unknown }> = [];

    importVehicles.forEach((row: Record<string, unknown>, idx: number) => {
      if (!row?.registration_plate || !row?.make || !row?.model || !row?.vin || !['Gasoline', 'Electric'].includes(String(row?.energy_type))) {
        invalidRows.push({
          index: idx,
          error: 'Missing mandatory vehicle fields or invalid energy_type (must be Gasoline or Electric)',
          row,
        });
      } else {
        validRows.push(row);
      }
    });

    if (dry_run) {
      res.json({
        dryRun: true,
        sourceCount: importVehicles.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        importedCount: 0,
        invalidRows,
      });
      return;
    }

    let importedCount = 0;
    for (const r of validRows) {
      try {
        db.prepare(
          `INSERT INTO vehicles (registration_plate, make, model, car_type, year, vin, energy_type, seats, current_odometer, battery_percent, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available')`
        ).run(
          String(r.registration_plate).trim(),
          String(r.make).trim(),
          String(r.model).trim(),
          String(r.car_type || 'Sedan'),
          Number(r.year || 2025),
          String(r.vin).trim(),
          String(r.energy_type),
          Number(r.seats || 5),
          Number(r.current_odometer || 0),
          r.energy_type === 'Electric' ? Number(r.battery_percent ?? 100) : null
        );
        importedCount += 1;
      } catch (e) {
        invalidRows.push({ index: -1, error: (e as Error).message, row: r });
      }
    }

    recordAudit(db, req.user, 'DATA_IMPORT_EXECUTED', 'IMPORT', null, null, {
      sourceCount: importVehicles.length,
      importedCount,
      exceptionCount: invalidRows.length,
    });

    res.json({
      dryRun: false,
      sourceCount: importVehicles.length,
      importedCount,
      exceptionCount: invalidRows.length,
      invalidRows,
    });
  });

  // Catch-all for unknown /api routes (AUTH-01: unauthenticated requests get 401)
  app.use('/api', requireAuth, (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Serve built static frontend assets if dist/ exists (for local prod & preview)
  const distDir = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Periodic background check for 5-min reminders and 20-min auto-cancellations
  const alertTimer = setInterval(() => {
    try {
      checkTripAlertsAndAutoCancellations(getDb());
    } catch {}
  }, 30000);
  if (typeof alertTimer.unref === 'function') {
    alertTimer.unref();
  }

  return app;
}
