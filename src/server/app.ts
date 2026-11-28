import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getDb, hashPassword, verifyPassword, runInTransaction, findDriverGroupId, ensureDriverGroup, resolveAppRoot, type AppDatabase } from './db.ts';
import { ensureSqlEngineLoaded, isSqlEngineReady } from './sqlite-compat.ts';
import { createSessionToken, isPrivilegedRole, requireAuth, requireRoles } from './auth.ts';
import { recordAudit } from './audit.ts';
import { ensureVapidKeys, notifyAdmins, notifyRole, sendUserNotification } from './push.ts';
import { checkDriverConflict, checkVehicleConflict } from './conflict.ts';
import { createRateLimiter } from './rate-limit.ts';
import { liveEvents, type LiveEvent } from './events.ts';
import { searchIndonesianPois, reverseGeocodeIndonesianPoi } from './indonesian-pois.ts';

export function fetchEnrichedTrip(db: AppDatabase, tripId: number): Record<string, unknown> | null {
  const baseSelect = `
    SELECT tr.*,
           u.nickname as requester_name,
           u.group_username as requester_username,
           d.name as department_name,
           v.registration_plate, v.make, v.model, v.car_type, v.energy_type, v.battery_percent, v.seats,
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
    WHERE tr.id = ?
  `;
  const row = db.prepare(baseSelect).get(tripId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const hwsCountRow = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'HWS' AND is_active = 1 AND approval_status = 'APPROVED'").get() as { c: number };
  const hasHwsAccount = (hwsCountRow?.c ?? 0) > 0;

  const decisions = db
    .prepare(
      `SELECT ad.*, u.nickname as decider_name
       FROM approval_decisions ad
       JOIN users u ON u.id = ad.decider_id
       WHERE ad.trip_request_id = ?
       ORDER BY ad.id ASC`
    )
    .all(tripId) as any[];
  const events = db.prepare('SELECT * FROM trip_events WHERE trip_request_id = ? ORDER BY id ASC').all(tripId);
  const assignments = db.prepare('SELECT * FROM assignments WHERE trip_request_id = ? ORDER BY id ASC').all(tripId);
  const picApproved = decisions.some((d: any) => d.decider_role === 'FM' && d.decision === 'APPROVED');
  const hwsApproved = decisions.some((d: any) => d.decider_role === 'HWS' && d.decision === 'APPROVED');
  const admDelegated = decisions.some((d: any) => d.decider_role === 'ADM' && d.decision === 'APPROVED');

  return {
    ...row,
    decisions,
    events,
    assignments,
    requires_dual_approval: hasHwsAccount,
    pic_approved: picApproved,
    hws_approved: hwsApproved,
    adm_delegated: admDelegated,
    is_urgent: Number(row.is_urgent || 0) === 1,
    urgent_reason: (row.urgent_reason as string) || null,
    requires_pic_urgent_approval: Number(row.is_urgent || 0) === 1 && !picApproved,
    reservation_type: (row.reservation_type as string) || 'ONE_WAY',
    return_pickup_time: (row.return_pickup_time as string) || null,
  };
}

export function broadcastTripUpdate(db: AppDatabase, tripId: number, eventType = 'TRIP_UPDATED', extraData?: any) {
  try {
    const enrichedTrip = fetchEnrichedTrip(db, tripId);
    if (!enrichedTrip) return null;

    // Send to requester
    liveEvents.broadcast({
      type: eventType,
      userId: enrichedTrip.requester_id as number,
      data: { trip: enrichedTrip, ...extraData },
    });

    // Send to assigned driver if one exists
    const driverRow = db.prepare(`
      SELECT dp.user_id
      FROM assignments a
      JOIN driver_profiles dp ON dp.id = a.driver_profile_id
      WHERE a.trip_request_id = ? AND a.is_current = 1
    `).get(tripId) as { user_id: number } | undefined;

    if (driverRow?.user_id) {
      liveEvents.broadcast({
        type: eventType,
        userId: driverRow.user_id,
        data: { trip: enrichedTrip, ...extraData },
      });
    }

    // Broadcast to privileged roles (ADM, FM, HWS)
    liveEvents.broadcast({
      type: eventType,
      role: 'ADM',
      data: { trip: enrichedTrip, ...extraData },
    });
    liveEvents.broadcast({
      type: eventType,
      role: 'FM',
      data: { trip: enrichedTrip, ...extraData },
    });
    liveEvents.broadcast({
      type: eventType,
      role: 'HWS',
      data: { trip: enrichedTrip, ...extraData },
    });

    // Broadcast lightweight schedule update to all authenticated clients so the Driver Schedule calendar stays live
    liveEvents.broadcast({
      type: 'SCHEDULE_UPDATED',
      data: {
        trip: {
          id: enrichedTrip.id,
          requester_id: enrichedTrip.requester_id,
          requester_name: enrichedTrip.requester_name,
          requester_username: enrichedTrip.requester_username,
          department_id: enrichedTrip.department_id,
          department_name: enrichedTrip.department_name,
          vehicle_id: enrichedTrip.vehicle_id,
          registration_plate: enrichedTrip.registration_plate,
          make: enrichedTrip.make,
          model: enrichedTrip.model,
          car_type: enrichedTrip.car_type,
          energy_type: enrichedTrip.energy_type,
          seats: enrichedTrip.seats,
          passenger_nickname: enrichedTrip.passenger_nickname,
          passengers_json: enrichedTrip.passengers_json,
          passenger_count: enrichedTrip.passenger_count,
          purpose: enrichedTrip.purpose,
          origin: enrichedTrip.origin,
          destination: enrichedTrip.destination,
          start_time: enrichedTrip.start_time,
          end_time: enrichedTrip.end_time,
          status: enrichedTrip.status,
          booking_status: enrichedTrip.booking_status,
          reservation_type: enrichedTrip.reservation_type,
          return_pickup_time: enrichedTrip.return_pickup_time,
          driver_profile_id: enrichedTrip.driver_profile_id,
          assigned_driver_name: enrichedTrip.assigned_driver_name,
          assigned_driver_phone: enrichedTrip.assigned_driver_phone,
        },
      },
    });

    return enrichedTrip;
  } catch {
    return null;
  }
}

export function createApp() {
  const app = express();
  app.set('trust proxy', true);

  // Security headers (NFR-02, NFR-04, TC-SEC-01) - Comprehensive Cyber Defense
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com https://www.gstatic.com https://ssl.gstatic.com; style-src 'self' 'unsafe-inline' https://translate.google.com https://translate.googleapis.com https://www.gstatic.com https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com https://ssl.gstatic.com; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://*.arcgisonline.com https://*.opentopomap.org https://*.maptiler.com https://api.maptiler.com https://*.openstreetmap.org https://www.google.com https://*.google.com https://translate.google.com https://translate.googleapis.com https://www.gstatic.com https://ssl.gstatic.com; connect-src 'self' https://api.maptiler.com https://nominatim.openstreetmap.org https://photon.komoot.io https://geocode.arcgis.com https://router.project-osrm.org https://routing.openstreetmap.de https://translate.googleapis.com https://translate-pa.googleapis.com https://translate.google.com; frame-src 'self' https://translate.google.com https://translate.googleapis.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self';"
    );
    res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Normalize double slashes, trailing slashes, and subfolder prefixes (e.g., //api/..., /index.php/api/..., /fleet/api/...)
  // so reverse proxies, cPanel Phusion Passenger, or trailing-slash client requests never trigger "API endpoint not found"
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const qIdx = req.url.indexOf('?');
    let pathPart = qIdx >= 0 ? req.url.slice(0, qIdx) : req.url;
    const queryPart = qIdx >= 0 ? req.url.slice(qIdx) : '';

    if (pathPart.includes('//')) {
      pathPart = pathPart.replace(/\/+/g, '/');
    }
    const apiIdx = pathPart.indexOf('/api/');
    if (apiIdx > 0) {
      pathPart = pathPart.slice(apiIdx);
    } else if (pathPart === '/api' || pathPart.endsWith('/api')) {
      pathPart = '/api';
    }
    if (pathPart.startsWith('/api/') && pathPart.length > 5 && pathPart.endsWith('/')) {
      pathPart = pathPart.slice(0, -1);
    }
    req.url = `${pathPart}${queryPart}`;
    if (pathPart.startsWith('/api') && !pathPart.startsWith('/api/maps/tiles/')) {
      _res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      _res.setHeader('Pragma', 'no-cache');
      _res.setHeader('Expires', '0');
    }
    next();
  });

  // Built-in MapTiler API Key & Multi-Provider Map Tile Proxy (Streets, Satellite, Terrain)
  // Mounted before rate limiter so concurrent Leaflet tile loads never trigger HTTP 429
  const DEFAULT_MAPTILER_API_KEY = process.env.MAPTILER_API_KEY || process.env.VITE_MAPTILER_API_KEY || 'KHmsrWcJhgdZjirijNbw';
  const tileBinaryCache = new Map<string, { buffer: Buffer; contentType: string; expiresAt: number }>();

  app.get('/api/maps/config', (_req: Request, res: Response) => {
    res.json({
      provider: 'MapTiler + Google Maps + CartoDB + OpenStreetMap',
      apiKeyConfigured: Boolean(DEFAULT_MAPTILER_API_KEY),
      apiKey: DEFAULT_MAPTILER_API_KEY,
      tileProxyUrl: '/api/maps/tiles/{layer}/{z}/{x}/{y}',
    });
  });

  app.get('/api/maps/tiles/:layer/:z/:x/:y', async (req: Request, res: Response) => {
    const layer = String(req.params.layer || 'streets').toLowerCase();
    const z = Math.max(0, Math.min(22, parseInt(String(req.params.z), 10) || 12));
    const x = Math.max(0, parseInt(String(req.params.x), 10) || 0);
    const y = Math.max(0, parseInt(String(req.params.y).replace(/\.(png|jpg|jpeg|webp)$/i, ''), 10) || 0);
    const customKey = typeof req.query.key === 'string' && req.query.key.trim() ? req.query.key.trim() : DEFAULT_MAPTILER_API_KEY;

    const cacheKey = `${layer}:${z}:${x}:${y}`;
    const cached = tileBinaryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached.buffer);
      return;
    }

    const subCarto = ['a', 'b', 'c', 'd'][(x + y) % 4];
    const subGoogle = ['0', '1', '2', '3'][(x + y) % 4];
    const subOsm = ['a', 'b', 'c'][(x + y) % 3];

    const candidateUrls: string[] =
      layer === 'satellite'
        ? [
            `https://mt${subGoogle}.google.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}`,
            `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
            ...(customKey && customKey !== DEFAULT_MAPTILER_API_KEY ? [`https://api.maptiler.com/maps/hybrid/256/${z}/${x}/${y}.jpg?key=${encodeURIComponent(customKey)}`] : []),
          ]
        : layer === 'terrain'
        ? [
            `https://mt${subGoogle}.google.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}`,
            `https://${subOsm}.tile.openstreetmap.org/${z}/${x}/${y}.png`,
            ...(customKey && customKey !== DEFAULT_MAPTILER_API_KEY ? [`https://api.maptiler.com/maps/outdoor-v2/256/${z}/${x}/${y}.png?key=${encodeURIComponent(customKey)}`] : []),
          ]
        : [
            `https://mt${subGoogle}.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`,
            `https://${subCarto}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
            `https://${subOsm}.tile.openstreetmap.org/${z}/${x}/${y}.png`,
            ...(customKey && customKey !== DEFAULT_MAPTILER_API_KEY ? [`https://api.maptiler.com/maps/streets-v2/256/${z}/${x}/${y}.png?key=${encodeURIComponent(customKey)}`] : []),
          ];

    for (const url of candidateUrls) {
      try {
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(3500),
        });
        if (resp.ok) {
          const contentType = resp.headers.get('content-type') || (layer === 'satellite' ? 'image/jpeg' : 'image/png');
          if (contentType.startsWith('image/')) {
            const arrayBuf = await resp.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            if (buffer.length > 100) {
              if (tileBinaryCache.size >= 800) {
                const oldestKey = tileBinaryCache.keys().next().value;
                if (oldestKey !== undefined) tileBinaryCache.delete(oldestKey);
              }
              tileBinaryCache.set(cacheKey, {
                buffer,
                contentType,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000,
              });
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.send(buffer);
              return;
            }
          }
        }
      } catch {
        // Failover to next tile provider
      }
    }

    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#f5efe4"/><path d="M0 64 H256 M0 128 H256 M0 192 H256 M64 0 V256 M128 0 V256 M192 0 V256" stroke="#e2dacb" stroke-width="1"/><path d="M0 40 Q128 110 256 180 M40 256 Q140 120 220 0" stroke="#ffffff" stroke-width="4" fill="none"/></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(fallbackSvg);
  });

  // Enterprise DoS & Traffic Surge Rate Limiter
  app.use('/api', createRateLimiter());

  // L4 / L7 Health & Liveness Probe for Load Balancers & Orchestrators
  app.get(['/api/health', '/api/healthz'], (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'GalaxyFleet Corporate Fleet Management',
      api_build: '2026-11-28-live-sync-v6',
      features: ['negotiation_hydration', 'notification_respond_fallback', 'negotiate_route_aliases', 'different_location_transfer', 'multi_worker_sqljs_sync', 'gojek_topdown_cars', 'i18n_notifications', 'editable_vehicle_seats'],
      uptime_sec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Ensure async WASM SQL engine is ready before any /api database route runs (no-op when native node:sqlite is active)
  app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
    if (req.path === '/health' || req.path === '/healthz' || isSqlEngineReady()) {
      next();
      return;
    }
    ensureSqlEngineLoaded().then(() => next(), (err) => next(err));
  });

  // Deep Readiness Probe (Verifies Database Engine, Connection Pool & Memory)
  app.get('/api/health/deep', (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const dbCheck = db.prepare('SELECT 1 as alive').get() as { alive: number } | undefined;
      const mem = process.memoryUsage();
      res.json({
        status: dbCheck?.alive === 1 ? 'ready' : 'degraded',
        api_build: '2026-11-28-live-sync-v6',
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
    const { nickname, department_id, group_username, password, requested_role, contact_number } = req.body ?? {};

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
    const cleanContact = contact_number !== undefined && contact_number !== null ? String(contact_number).trim() : '';
    if (contact_number !== undefined && cleanContact.replace(/\D/g, '').length < 8) {
      res.status(400).json({ error: 'Valid WhatsApp / mobile phone number (at least 8 digits) is required' });
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
        `INSERT INTO users (nickname, group_username, password_hash, role, is_department_admin, department_id, approval_status, is_active, contact_number)
         VALUES (?, ?, ?, ?, 0, ?, 'PENDING_APPROVAL', 1, ?)`
      )
      .run(nickname.trim(), group_username.trim(), hashPassword(password), role, deptId, cleanContact || null);

    const newUserId = Number(result.lastInsertRowid);

    recordAudit(db, { id: newUserId, group_username: group_username.trim(), role }, 'USER_REGISTERED_PENDING', 'USER', newUserId, null, {
      nickname: nickname.trim(),
      group_username: group_username.trim(),
      department_id: deptId,
      role,
      contact_number: cleanContact || null,
      approval_status: 'PENDING_APPROVAL',
    });

    notifyAdmins(db, {
      triggerType: 'USER_REGISTRATION_PENDING',
      title: 'New Account Registration Pending Approval',
      body: `${nickname.trim()} (@${group_username.trim()}, ${dept.name}${cleanContact ? `, WA: ${cleanContact}` : ''}) registered and awaits Administrator approval.`,
      relatedEntityType: 'USER',
      relatedEntityId: newUserId,
    });

    res.status(201).json({
      id: newUserId,
      nickname: nickname.trim(),
      group_username: group_username.trim(),
      department_id: deptId,
      role,
      contact_number: cleanContact || null,
      approval_status: 'PENDING_APPROVAL',
      message: 'Registration submitted. An Administrator must approve your account before you can sign in.',
    });
  });

  // Public Forgot Password Request (Admin-assisted direct reset + free WhatsApp Admin contact link)
  app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
    const db = getDb();
    const { group_username, username, contact_number, notes } = req.body ?? {};
    const rawUser = String(group_username || username || '').trim();
    const rawPhone = String(contact_number || '').trim();
    const cleanNotes = notes ? String(notes).trim().slice(0, 300) : '';

    if (!rawUser) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }
    const inputDigits = rawPhone.replace(/\D/g, '');
    if (inputDigits.length < 8) {
      res.status(400).json({ error: 'Valid WhatsApp / phone number (at least 8 digits) is required' });
      return;
    }

    const userRow = db
      .prepare(
        `SELECT u.id, u.nickname, u.group_username, u.role, u.is_active,
                COALESCE(NULLIF(TRIM(u.contact_number), ''), dp.contact_number, '') as stored_phone,
                d.name as department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN driver_profiles dp ON dp.user_id = u.id
         WHERE LOWER(u.group_username) = LOWER(?)`
      )
      .get(rawUser) as any;

    if (!userRow) {
      res.status(404).json({ error: 'Username not found. Please check your username or contact the Fleet Admin.' });
      return;
    }
    if (userRow.is_active === 0) {
      res.status(403).json({ error: 'This account is deactivated. Please contact the Administrator.' });
      return;
    }

    const normPhone = (p: string) => {
      const d = p.replace(/\D/g, '');
      return d.startsWith('0') ? `62${d.slice(1)}` : d;
    };
    const storedNorm = normPhone(String(userRow.stored_phone || ''));
    const inputNorm = normPhone(rawPhone);
    if (storedNorm.length >= 8 && storedNorm !== inputNorm && storedNorm.slice(-8) !== inputNorm.slice(-8)) {
      res.status(400).json({ error: 'WhatsApp number does not match the phone number saved in your profile. Please check or contact the Fleet Admin.' });
      return;
    }

    const existingPending = db
      .prepare("SELECT id FROM password_reset_requests WHERE user_id = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1")
      .get(userRow.id) as { id: number } | undefined;

    let requestId: number;
    if (existingPending) {
      db.prepare("UPDATE password_reset_requests SET contact_number = ?, notes = ?, created_at = datetime('now') WHERE id = ?").run(
        rawPhone,
        cleanNotes || null,
        existingPending.id
      );
      requestId = existingPending.id;
    } else {
      const ins = db
        .prepare(
          `INSERT INTO password_reset_requests (user_id, group_username, contact_number, notes, status)
           VALUES (?, ?, ?, ?, 'PENDING')`
        )
        .run(userRow.id, userRow.group_username, rawPhone, cleanNotes || null);
      requestId = Number(ins.lastInsertRowid);
    }

    notifyAdmins(db, {
      triggerType: 'PASSWORD_RESET_REQUESTED',
      title: `Password Reset Request: ${userRow.nickname}`,
      body: `${userRow.nickname} (@${userRow.group_username}, ${userRow.department_name || 'Group'}) requested a password reset. WhatsApp: ${rawPhone}.${cleanNotes ? ` Note: "${cleanNotes}"` : ''} Open Admin Console to set a new temporary password.`,
      relatedEntityType: 'USER',
      relatedEntityId: Number(userRow.id),
    });

    recordAudit(db, { id: userRow.id, group_username: userRow.group_username, role: userRow.role }, 'PASSWORD_RESET_REQUESTED', 'USER', userRow.id, null, {
      request_id: requestId,
      contact_number: rawPhone,
    });

    const waText = encodeURIComponent(
      `Halo Admin GalaxyFleet, saya ${userRow.nickname} (@${userRow.group_username}) mengajukan reset password melalui aplikasi. Nomor WhatsApp saya: ${rawPhone}. Mohon bantuannya untuk reset password akun saya. Terima kasih.`
    );
    res.status(201).json({
      ok: true,
      requestId,
      message: 'Password reset request sent to the Administrator. You can also message the Admin on WhatsApp below for faster assistance.',
      admin_whatsapp_url: `https://wa.me/6281381016286?text=${waText}`,
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
        `SELECT u.*, d.name as department_name, dp.id as driver_profile_id,
                COALESCE(u.contact_number, dp.contact_number, '') as contact_number,
                COALESCE(u.photo_url, dp.photo_url) as photo_url
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
          contact_number?: string;
          photo_url?: string | null;
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
        contact_number: user.contact_number || '',
        photo_url: user.photo_url || null,
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

  // Real-Time Server-Sent Events (SSE) Stream for Ultra-Low Latency Updates (< 50ms)
  app.get('/api/live/stream', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    res.write(`retry: 1500\n: connected (user ${user.id}, role ${user.role})\n\n`);

    const onLiveEvent = (event: LiveEvent) => {
      try {
        const matchesUser = event.userId === undefined || Number(event.userId) === Number(user.id);
        const matchesRole =
          event.role === undefined ||
          event.role === user.role ||
          (user.role === 'ADM' && ['FM', 'HWS'].includes(event.role));

        if (matchesUser && matchesRole) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      } catch {
        // Socket closed
      }
    };

    liveEvents.on('live_event', onLiveEvent);

    const heartbeatTimer = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      } catch {
        clearInterval(heartbeatTimer);
      }
    }, 10_000);
    heartbeatTimer.unref();

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      liveEvents.removeListener('live_event', onLiveEvent);
    });
  });

  // User Profile: View current account details
  app.get('/api/user/profile', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = db.prepare(`
      SELECT u.id, u.nickname, u.group_username, u.role, u.is_department_admin,
             u.department_id, d.name as department_name, u.approval_status, u.is_active,
             COALESCE(u.contact_number, dp.contact_number, '') as contact_number,
             COALESCE(u.photo_url, dp.photo_url) as photo_url,
             dp.id as driver_profile_id, dp.licence_number, dp.licence_class, dp.licence_expiry,
             u.created_at
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN driver_profiles dp ON dp.user_id = u.id
      WHERE u.id = ?
    `).get(req.user!.id);
    res.json({ user });
  });

  // User Profile: Update current account details (nickname, contact_number, photo_url; ADM can also adjust department_id)
  app.patch('/api/user/profile', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const userId = req.user!.id;
    const { nickname, contact_number, photo_url, department_id } = req.body ?? {};

    if (nickname !== undefined) {
      if (typeof nickname !== 'string' || nickname.trim().length < 2) {
        res.status(400).json({ error: 'Nickname must be at least 2 characters long' });
        return;
      }
    }
    if (contact_number !== undefined) {
      const digits = String(contact_number || '').replace(/\D/g, '');
      if (digits.length < 8) {
        res.status(400).json({ error: 'Valid WhatsApp / mobile phone number (at least 8 digits) is required for account recovery' });
        return;
      }
    }

    let validDeptId: number | undefined;
    if (req.user!.role === 'ADM' && department_id !== undefined && department_id !== null && department_id !== '') {
      const parsedDeptId = Number(department_id);
      const deptRow = Number.isInteger(parsedDeptId)
        ? (db.prepare('SELECT id, is_active FROM departments WHERE id = ?').get(parsedDeptId) as { id: number; is_active: number } | undefined)
        : undefined;
      if (!deptRow || deptRow.is_active === 0) {
        res.status(400).json({ error: 'Selected group is invalid or inactive' });
        return;
      }
      validDeptId = parsedDeptId;
    }

    const trimmedNickname = nickname !== undefined ? String(nickname).trim() : undefined;
    const trimmedContact = contact_number !== undefined ? String(contact_number).trim() : undefined;
    const cleanPhoto = photo_url !== undefined ? (photo_url ? String(photo_url) : null) : undefined;

    // Update users table
    if (trimmedNickname !== undefined || trimmedContact !== undefined || cleanPhoto !== undefined || validDeptId !== undefined) {
      db.prepare(`
        UPDATE users
        SET nickname = COALESCE(?, nickname),
            contact_number = COALESCE(?, contact_number),
            photo_url = COALESCE(?, photo_url),
            department_id = COALESCE(?, department_id)
        WHERE id = ?
      `).run(
        trimmedNickname ?? null,
        trimmedContact ?? null,
        cleanPhoto ?? null,
        validDeptId ?? null,
        userId
      );
    }

    // If driver, sync with driver_profiles
    if (req.user!.driver_profile_id) {
      db.prepare(`
        UPDATE driver_profiles
        SET full_name = COALESCE(?, full_name),
            contact_number = COALESCE(?, contact_number),
            photo_url = COALESCE(?, photo_url),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        trimmedNickname ?? null,
        trimmedContact ?? null,
        cleanPhoto ?? null,
        req.user!.driver_profile_id
      );
    }

    recordAudit(db, req.user, 'PROFILE_UPDATED', 'USER', userId, null, {
      nickname: trimmedNickname,
      hasContact: Boolean(trimmedContact),
      hasPhoto: Boolean(cleanPhoto),
      ...(validDeptId !== undefined ? { department_id: validDeptId } : {}),
    });

    const updatedUser = db.prepare(`
      SELECT u.id, u.nickname, u.group_username, u.role, u.is_department_admin,
             u.department_id, d.name as department_name, u.approval_status, u.is_active,
             COALESCE(u.contact_number, dp.contact_number, '') as contact_number,
             COALESCE(u.photo_url, dp.photo_url) as photo_url,
             dp.id as driver_profile_id
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN driver_profiles dp ON dp.user_id = u.id
      WHERE u.id = ?
    `).get(userId);

    res.json({ success: true, message: 'Profile updated successfully', user: updatedUser });
  });

  // User Profile: Change account password
  app.post('/api/user/change-password', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const userId = req.user!.id;
    const { current_password, new_password } = req.body ?? {};

    if (!current_password || typeof current_password !== 'string') {
      res.status(400).json({ error: 'Current password is required' });
      return;
    }

    if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    const userRow = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined;
    if (!userRow || !verifyPassword(current_password, userRow.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    if (current_password === new_password) {
      res.status(400).json({ error: 'New password must be different from current password' });
      return;
    }

    const newHash = hashPassword(new_password);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

    recordAudit(db, req.user, 'PASSWORD_CHANGED', 'USER', userId, null, { timestamp: new Date().toISOString() });
    res.json({ success: true, message: 'Password updated successfully' });
  });

  // ============================================================================
  // 2. GROUPS / DEPARTMENTS & USERS (ORG-01 to ORG-05 + Admin Account Approval)
  // ============================================================================

  // Public active groups list for registration dropdown
  app.get('/api/public/groups', (_req: Request, res: Response) => {
    const db = getDb();
    ensureDriverGroup(db);
    const groups = db.prepare('SELECT id, name, code, is_active FROM departments WHERE is_active = 1 ORDER BY id ASC').all();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ groups });
  });

  const MAPTILER_API_KEY = process.env.MAPTILER_API_KEY || process.env.VITE_MAPTILER_API_KEY || 'KHmsrWcJhgdZjirijNbw';

  interface GeoSearchEntry {
    expiresAt: number;
    results: Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }>;
  }
  interface ReverseGeoEntry {
    expiresAt: number;
    payload: {
      name: string;
      address: string;
      lat: number;
      lon: number;
      place: { name: string; address: string; lat: number; lon: number };
    };
  }
  interface RouteCacheEntry {
    expiresAt: number;
    distanceKm: number;
    durationMin: number;
    geometry: Array<[number, number]>;
    source: string;
  }

  const geocodeSearchCache = new Map<string, GeoSearchEntry>();
  const reverseGeocodeCache = new Map<string, ReverseGeoEntry>();
  const routeCalcCache = new Map<string, RouteCacheEntry>();

  const setBoundedCache = <V>(cache: Map<string, V>, key: string, value: V, maxSize = 500) => {
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(key, value);
  };

  // Comprehensive Nationwide Indonesian Geocoding Proxy (Local POIs + Parallel MapTiler + Nominatim + Photon + ArcGIS)
  app.get('/api/geocode/search', requireAuth, async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      res.json({ results: [] });
      return;
    }

    const cacheKey = q.toLowerCase();
    const cached = geocodeSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ results: cached.results });
      return;
    }

    // 1. Instant Match from Nationwide & Greater Jakarta Indonesian POI Directory
    const matchedPois = searchIndonesianPois(q, 18);
    const results: Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }> = matchedPois
      .map(({ score: _s, ...rest }) => rest);

    const isInsideIndonesia = (lat: number, lon: number) =>
      Number.isFinite(lat) && Number.isFinite(lon) && lat >= -11.5 && lat <= 6.5 && lon >= 94.5 && lon <= 141.5;

    const pushUniqueResult = (candidate: { place_id: string | number; name: string; address: string; lat: number; lon: number }) => {
      if (!isInsideIndonesia(candidate.lat, candidate.lon)) return;
      const duplicate = results.some(
        (r) => Math.abs(r.lat - candidate.lat) < 0.0006 && Math.abs(r.lon - candidate.lon) < 0.0006
      );
      if (!duplicate) {
        results.push(candidate);
      }
    };

    // 2. Fetch ArcGIS World Geocoder, MapTiler, OSM Nominatim, & Photon Komoot across ALL of Indonesia in parallel (no Jabodetabek-only lock)
    const arcgisPromise = (async () => {
      const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(
        q
      )}&countryCode=IDN&maxLocations=15&outFields=PlaceName,Place_addr,Match_addr,City,Region&f=pjson`;
      const resp = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4500),
      });
      if (!resp.ok) return [] as Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }>;
      const data = (await resp.json()) as { candidates?: Array<any> };
      const list: Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }> = [];
      for (const cand of Array.isArray(data.candidates) ? data.candidates : []) {
        const lat = Number(cand.location?.y);
        const lon = Number(cand.location?.x);
        const attrs = cand.attributes || {};
        const primary = String(attrs.PlaceName || cand.address?.split(',')[0] || q).trim();
        const address = String(attrs.Place_addr || attrs.Match_addr || cand.address || primary).trim();
        if (isInsideIndonesia(lat, lon)) {
          list.push({
            place_id: `arc_${lat.toFixed(4)}_${lon.toFixed(4)}`,
            name: primary,
            address,
            lat,
            lon,
          });
        }
      }
      return list;
    })();

    const maptilerPromise = (async () => {
      const maptilerUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${encodeURIComponent(
        MAPTILER_API_KEY
      )}&country=id&bbox=94.5,-11.2,141.5,6.2&limit=12&language=id,en`;
      const mtResp = await fetch(maptilerUrl, { signal: AbortSignal.timeout(4500) });
      if (!mtResp.ok) return [] as Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }>;
      const mtData = (await mtResp.json()) as { features?: Array<any> };
      const list: Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }> = [];
      for (const feat of Array.isArray(mtData.features) ? mtData.features : []) {
        const center = Array.isArray(feat.center) ? feat.center : feat.geometry?.coordinates || [];
        const placeName = String(feat.place_name || feat.text || q);
        const primary = String(feat.text || placeName.split(',')[0] || q).trim();
        const lat = Number(center[1]);
        const lon = Number(center[0]);
        if (isInsideIndonesia(lat, lon)) {
          list.push({
            place_id: feat.id || `mt_${lat.toFixed(4)}_${lon.toFixed(4)}`,
            name: primary,
            address: placeName,
            lat,
            lon,
          });
        }
      }
      return list;
    })();

    const nominatimPromise = (async () => {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=id&limit=15&q=${encodeURIComponent(
        q
      )}`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'GalaxyFleet/2.0 (Corporate Fleet Management System)',
          'Accept-Language': 'id,en',
        },
        signal: AbortSignal.timeout(4500),
      });
      if (!resp.ok) return [] as Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }>;
      const data = (await resp.json()) as Array<any>;
      const list: Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }> = [];
      for (const item of Array.isArray(data) ? data : []) {
        const display = String(item.display_name || '');
        const primary = item.name || display.split(',')[0] || q;
        const lat = Number(item.lat);
        const lon = Number(item.lon);
        if (isInsideIndonesia(lat, lon)) {
          list.push({
            place_id: item.place_id || `nom_${lat.toFixed(4)}_${lon.toFixed(4)}`,
            name: String(primary).trim(),
            address: display,
            lat,
            lon,
          });
        }
      }
      return list;
    })();

    const photonPromise = (async () => {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=94.5,-11.2,141.5,6.2&limit=15`;
      const resp = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4500),
      });
      if (!resp.ok) return [] as Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }>;
      const data = (await resp.json()) as { features?: Array<any> };
      const list: Array<{ place_id: string | number; name: string; address: string; lat: number; lon: number }> = [];
      for (const feat of Array.isArray(data.features) ? data.features : []) {
        const coords = feat.geometry?.coordinates || [];
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);
        const props = feat.properties || {};
        const primary = String(props.name || props.street || props.city || props.county || q).trim();
        const addrParts = [
          props.name,
          props.street,
          props.district || props.locality,
          props.city || props.county,
          props.state,
          props.country,
        ]
          .filter(Boolean)
          .map((s) => String(s).trim());
        const uniqueAddrParts = Array.from(new Set(addrParts));
        const address = uniqueAddrParts.join(', ') || primary;
        if (isInsideIndonesia(lat, lon) && (!props.countrycode || String(props.countrycode).toUpperCase() === 'ID')) {
          list.push({
            place_id: `ph_${props.osm_id || `${lat.toFixed(4)}_${lon.toFixed(4)}`}`,
            name: primary,
            address,
            lat,
            lon,
          });
        }
      }
      return list;
    })();

    const settled = await Promise.allSettled([arcgisPromise, maptilerPromise, nominatimPromise, photonPromise]);
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        for (const item of outcome.value) {
          pushUniqueResult(item);
        }
      }
    }

    const finalResults = results.slice(0, 35);
    if (finalResults.length > 0) {
      setBoundedCache(geocodeSearchCache, cacheKey, {
        expiresAt: Date.now() + 10 * 60_000,
        results: finalResults,
      });
    }
    res.json({ results: finalResults });
  });

  app.get('/api/geocode/reverse', requireAuth, async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: 'Valid lat and lon are required' });
      return;
    }

    const revKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cachedRev = reverseGeocodeCache.get(revKey);
    if (cachedRev && cachedRev.expiresAt > Date.now()) {
      res.json(cachedRev.payload);
      return;
    }

    const localPoi = reverseGeocodeIndonesianPoi(lat, lon);
    if (localPoi && localPoi.distanceKm <= 0.25) {
      const payload = {
        name: localPoi.name,
        address: localPoi.address,
        lat,
        lon,
        place: { name: localPoi.name, address: localPoi.address, lat, lon },
      };
      setBoundedCache(reverseGeocodeCache, revKey, {
        expiresAt: Date.now() + 15 * 60_000,
        payload,
      });
      res.json(payload);
      return;
    }

    try {
      const maptilerUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(String(lon))},${encodeURIComponent(String(lat))}.json?key=${encodeURIComponent(MAPTILER_API_KEY)}&limit=1&language=id,en`;
      const mtResp = await fetch(maptilerUrl, { signal: AbortSignal.timeout(2200) }).catch(() => null);
      if (mtResp && mtResp.ok) {
        const mtData = (await mtResp.json()) as { features?: Array<any> };
        const feat = mtData.features?.[0];
        if (feat) {
          const placeName = String(feat.place_name || feat.text || localPoi?.address || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
          const primary = String(feat.text || placeName.split(',')[0] || localPoi?.name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`).trim();
          const payload = {
            name: primary,
            address: placeName,
            lat,
            lon,
            place: { name: primary, address: placeName, lat, lon },
          };
          setBoundedCache(reverseGeocodeCache, revKey, {
            expiresAt: Date.now() + 15 * 60_000,
            payload,
          });
          res.json(payload);
          return;
        }
      }

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'GalaxyFleet/2.0 (Corporate Fleet Management System)',
          'Accept-Language': 'id,en',
        },
        signal: AbortSignal.timeout(2200),
      }).catch(() => null);

      if (!resp || !resp.ok) {
        const fallbackName = localPoi?.name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        const fallbackAddr = localPoi?.address || `Coordinates ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        res.json({
          name: fallbackName,
          address: fallbackAddr,
          lat,
          lon,
          place: { name: fallbackName, address: fallbackAddr, lat, lon },
        });
        return;
      }
      const item = (await resp.json()) as any;
      const display = String(item.display_name || localPoi?.address || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      const primary = String(item.name || display.split(',')[0] || localPoi?.name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`).trim();
      const payload = {
        name: primary,
        address: display,
        lat,
        lon,
        place: { name: primary, address: display, lat, lon },
      };
      setBoundedCache(reverseGeocodeCache, revKey, {
        expiresAt: Date.now() + 15 * 60_000,
        payload,
      });
      res.json(payload);
    } catch {
      const fallbackName = localPoi?.name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      const fallbackAddr = localPoi?.address || `Coordinates ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      res.json({
        name: fallbackName,
        address: fallbackAddr,
        lat,
        lon,
        place: { name: fallbackName, address: fallbackAddr, lat, lon },
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

    const routeCacheKey = `${originLat.toFixed(4)},${originLon.toFixed(4)}->${destLat.toFixed(4)},${destLon.toFixed(4)}`;
    const cachedRoute = routeCalcCache.get(routeCacheKey);
    if (cachedRoute && cachedRoute.expiresAt > Date.now()) {
      const etaDate = new Date(baseDepartureMs + cachedRoute.durationMin * 60_000);
      res.json({
        distanceKm: cachedRoute.distanceKm,
        durationMin: cachedRoute.durationMin,
        etaIso: etaDate.toISOString(),
        etaText: etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        geometry: cachedRoute.geometry,
        source: cachedRoute.source,
      });
      return;
    }

    const routingEndpoints = [
      {
        name: 'osrm',
        url: `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(String(originLon))},${encodeURIComponent(String(originLat))};${encodeURIComponent(String(destLon))},${encodeURIComponent(String(destLat))}?overview=full&geometries=geojson`,
      },
      {
        name: 'osm-de-car',
        url: `https://routing.openstreetmap.de/routed-car/route/v1/driving/${encodeURIComponent(String(originLon))},${encodeURIComponent(String(originLat))};${encodeURIComponent(String(destLon))},${encodeURIComponent(String(destLat))}?overview=full&geometries=geojson`,
      },
    ];

    for (const provider of routingEndpoints) {
      try {
        const resp = await fetch(provider.url, {
          headers: {
            'User-Agent': 'GalaxyFleetManagement/2.0 (Indonesian Fleet System)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(4000),
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
            const finalGeometry =
              coords.length >= 2 ? coords : ([[originLat, originLon], [destLat, destLon]] as Array<[number, number]>);

            setBoundedCache(routeCalcCache, routeCacheKey, {
              expiresAt: Date.now() + 15 * 60_000,
              distanceKm,
              durationMin,
              geometry: finalGeometry,
              source: provider.name,
            });

            res.json({
              distanceKm,
              durationMin,
              etaIso: etaDate.toISOString(),
              etaText,
              geometry: finalGeometry,
              source: provider.name,
            });
            return;
          }
        }
      } catch {
        // Try next routing provider
      }
    }

    // Smooth non-zigzagging Bezier arc fallback when external routing servers are temporarily unreachable
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(destLat - originLat);
    const dLon = toRad(destLon - originLon);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(originLat)) * Math.cos(toRad(destLat)) * Math.sin(dLon / 2) ** 2;
    const straightKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distanceKm = Math.max(0.5, Number((straightKm * (straightKm > 30 ? 1.22 : straightKm > 10 ? 1.28 : 1.34)).toFixed(1)));
    const effectiveSpeedKmh = straightKm < 6 ? 24 : straightKm < 20 ? 34 : straightKm < 80 ? 52 : 68;
    const durationMin = Math.max(3, Math.round((distanceKm / effectiveSpeedKmh) * 60));
    const etaDate = new Date(baseDepartureMs + durationMin * 60_000);
    const etaText = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const ctrlLat = (originLat + destLat) / 2 + (destLon - originLon) * 0.1;
    const ctrlLon = (originLon + destLon) / 2 - (destLat - originLat) * 0.1;
    const steps = 24;
    const geometry: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const omt = 1 - t;
      const lat = omt * omt * originLat + 2 * omt * t * ctrlLat + t * t * destLat;
      const lon = omt * omt * originLon + 2 * omt * t * ctrlLon + t * t * destLon;
      geometry.push([Number(lat.toFixed(6)), Number(lon.toFixed(6))]);
    }

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
    ensureDriverGroup(db);
    const departments = db.prepare('SELECT * FROM departments ORDER BY id ASC').all();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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
                COALESCE(NULLIF(TRIM(u.contact_number), ''), dp.contact_number, '') as contact_number,
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
    if (!department_id && role === 'DRV') {
      department_id = findDriverGroupId(db) ?? 1;
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
        db.prepare('DELETE FROM password_reset_requests WHERE user_id = ?').run(targetId);
        db.prepare('DELETE FROM negotiation_requests WHERE requester_user_id = ? OR holder_user_id = ?').run(targetId, targetId);
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

  // Admin Password Reset Queue & Direct Password Reset (ADM only)
  app.get('/api/admin/password-reset-requests', requireAuth, requireRoles(['ADM']), (_req: Request, res: Response) => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT prr.*,
                u.nickname as user_nickname,
                u.role as user_role,
                u.is_active as user_is_active,
                COALESCE(NULLIF(TRIM(u.contact_number), ''), dp.contact_number, prr.contact_number) as resolved_phone,
                d.name as department_name,
                h.nickname as handled_by_name
         FROM password_reset_requests prr
         JOIN users u ON u.id = prr.user_id
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN driver_profiles dp ON dp.user_id = u.id
         LEFT JOIN users h ON h.id = prr.handled_by
         ORDER BY CASE WHEN prr.status = 'PENDING' THEN 0 ELSE 1 END, prr.created_at DESC
         LIMIT 50`
      )
      .all();
    res.json({ requests: rows });
  });

  app.post('/api/admin/password-reset-requests/:id/dismiss', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const requestId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(requestId) as any;
    if (!existing) {
      res.status(404).json({ error: 'Password reset request not found' });
      return;
    }
    db.prepare(
      "UPDATE password_reset_requests SET status = 'DISMISSED', handled_by = ?, handled_at = datetime('now') WHERE id = ?"
    ).run(req.user!.id, requestId);
    recordAudit(db, req.user, 'PASSWORD_RESET_DISMISSED', 'USER', Number(existing.user_id), existing, {
      request_id: requestId,
      status: 'DISMISSED',
    });
    res.json({ ok: true, id: requestId, status: 'DISMISSED' });
  });

  app.post('/api/admin/users/:id/reset-password', requireAuth, requireRoles(['ADM']), (req: Request, res: Response) => {
    const db = getDb();
    const targetId = Number(req.params.id);
    const { new_password } = req.body ?? {};
    const cleanPassword = String(new_password ?? '');

    if (cleanPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const target = db
      .prepare(
        `SELECT u.id, u.nickname, u.group_username, u.role, u.is_active,
                COALESCE(NULLIF(TRIM(u.contact_number), ''), dp.contact_number, '') as resolved_phone
         FROM users u
         LEFT JOIN driver_profiles dp ON dp.user_id = u.id
         WHERE u.id = ?`
      )
      .get(targetId) as any;
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const latestPending = db
      .prepare("SELECT contact_number FROM password_reset_requests WHERE user_id = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1")
      .get(targetId) as { contact_number?: string } | undefined;

    const newHash = hashPassword(cleanPassword);
    runInTransaction(db, () => {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, targetId);
      // Revoke existing sessions for target user (unless admin is resetting their own password)
      if (targetId !== req.user!.id) {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
      }
      db.prepare(
        "UPDATE password_reset_requests SET status = 'COMPLETED', handled_by = ?, handled_at = datetime('now') WHERE user_id = ? AND status = 'PENDING'"
      ).run(req.user!.id, targetId);
      recordAudit(db, req.user, 'ADMIN_PASSWORD_RESET', 'USER', targetId, null, {
        reset_by: req.user!.group_username,
        target_username: target.group_username,
        sessions_revoked: targetId !== req.user!.id,
      });
    });

    sendUserNotification(db, {
      userId: targetId,
      triggerType: 'PASSWORD_RESET_COMPLETED',
      title: 'Password Reset by Administrator',
      body: `Your password was reset by Administrator ${req.user!.nickname}. Please sign in with your new temporary password and update it in Profile → Change Password.`,
      relatedEntityType: 'USER',
      relatedEntityId: targetId,
    });

    const phoneSource = String(target.resolved_phone || latestPending?.contact_number || '').trim();
    const digitsOnly = phoneSource.replace(/\D/g, '');
    const waDigits = digitsOnly.startsWith('0') ? `62${digitsOnly.slice(1)}` : digitsOnly;
    const waMessage = encodeURIComponent(
      `Halo ${target.nickname}, password akun GalaxyFleet Anda (@${target.group_username}) telah direset oleh Admin.\n\nPassword sementara baru: ${cleanPassword}\n\nSilakan login dan segera ganti password Anda di menu Profile -> Change Password.`
    );
    const whatsappUrl = waDigits.length >= 8 ? `https://wa.me/${waDigits}?text=${waMessage}` : null;

    res.json({
      ok: true,
      user: {
        id: Number(target.id),
        nickname: target.nickname,
        group_username: target.group_username,
        contact_number: phoneSource,
      },
      temporary_password: cleanPassword,
      whatsapp_url: whatsappUrl,
      message: `Password for ${target.nickname} (@${target.group_username}) has been reset and previous sessions were signed out.`,
    });
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
    try { liveEvents.broadcast({ type: 'VEHICLE_UPDATED', data: { vehicle: created } }); } catch {}
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

    const nextSeats = seats !== undefined && seats !== '' ? Number(seats) : Number(prev.seats);
    if (!Number.isInteger(nextSeats) || nextSeats < 1 || nextSeats > 50) {
      res.status(400).json({ error: 'seats must be an integer between 1 and 50' });
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
      nextSeats,
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
    try { liveEvents.broadcast({ type: 'VEHICLE_UPDATED', data: { vehicle: updated } }); } catch {}
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

    try { liveEvents.broadcast({ type: 'VEHICLE_UPDATED', data: { deletedId: vehicleId } }); } catch {}
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
    const resolvedPhoto = req.body?.photo_url || req.body?.photo || null;
    const licenceClass = req.body?.licence_class || 'A';
    const availabilityStatus = req.body?.availability_status || 'Active';
    const departmentId = req.body?.department_id;

    let resolvedUserId = req.body?.user_id ? Number(req.body.user_id) : null;
    if (!resolvedUserId && resolvedName) {
      const username = `drv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const fallbackDeptId =
        departmentId !== undefined && Number(departmentId) > 0
          ? Number(departmentId)
          : (findDriverGroupId(db) ?? 1);
      const u = db.prepare(
        "INSERT INTO users (nickname, group_username, password_hash, role, department_id, approval_status, is_active) VALUES (?, ?, ?, 'DRV', ?, 'APPROVED', 1)"
      ).run(resolvedName, username, hashPassword('Driver@123'), fallbackDeptId);
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
         SET full_name = ?, licence_number = ?, licence_class = ?, licence_expiry = ?, contact_number = ?, availability_status = ?, photo_url = COALESCE(?, photo_url), updated_at = datetime('now')
         WHERE id = ?`
      ).run(resolvedName, resolvedLicence, licenceClass, resolvedExpiry, resolvedContact, availabilityStatus, resolvedPhoto, existingProfile.id);
      driverProfileId = existingProfile.id;
    } else {
      const result = db
        .prepare(
          `INSERT INTO driver_profiles (user_id, full_name, licence_number, licence_class, licence_expiry, contact_number, availability_status, photo_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(resolvedUserId, resolvedName, resolvedLicence, licenceClass, resolvedExpiry, resolvedContact, availabilityStatus, resolvedPhoto);
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

    const { full_name, licence_number, licence_class, licence_expiry, contact_number, availability_status, department_id, photo_url } = req.body ?? {};
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
           photo_url = COALESCE(?, photo_url),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      full_name ?? prev.full_name,
      licence_number ?? prev.licence_number,
      licence_class ?? prev.licence_class,
      licence_expiry ?? prev.licence_expiry,
      contact_number ?? prev.contact_number,
      availability_status ?? prev.availability_status,
      photo_url !== undefined ? photo_url : prev.photo_url,
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

  // Dedicated Driver Profile Photo Upload Endpoint (Accessible by Driver themselves, FM, or ADM)
  app.post('/api/driver/profile/photo', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const { photo_url, driver_id } = req.body ?? {};

    if (!photo_url || typeof photo_url !== 'string') {
      res.status(400).json({ error: 'Valid photo_url is required' });
      return;
    }

    let targetDriverId: number | null = null;
    if (user.role === 'ADM' || user.role === 'FM') {
      targetDriverId = driver_id ? Number(driver_id) : (user.driver_profile_id ?? null);
    } else if (user.role === 'DRV') {
      targetDriverId = user.driver_profile_id ?? null;
    }

    if (!targetDriverId) {
      // Find driver profile by user id
      const dp = db.prepare('SELECT id FROM driver_profiles WHERE user_id = ?').get(user.id) as { id: number } | undefined;
      targetDriverId = dp ? dp.id : null;
    }

    if (!targetDriverId) {
      res.status(404).json({ error: 'Driver profile not found for this account' });
      return;
    }

    db.prepare("UPDATE driver_profiles SET photo_url = ?, updated_at = datetime('now') WHERE id = ?").run(photo_url, targetDriverId);

    const updated = db.prepare('SELECT * FROM driver_profiles WHERE id = ?').get(targetDriverId);
    recordAudit(db, req.user, 'DRIVER_PHOTO_UPDATED', 'DRIVER_PROFILE', targetDriverId, null, { photo_url });
    res.json({ success: true, driver: updated });
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
    const excludeTripIdRaw = req.query.exclude_trip_id ? Number(req.query.exclude_trip_id) : undefined;
    const excludeTripId = excludeTripIdRaw && Number.isFinite(excludeTripIdRaw) ? excludeTripIdRaw : undefined;
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
      const check = checkVehicleConflict(db, v.id, startTime, endTime, undefined, excludeTripId);
      return {
        ...v,
        isAvailable: !check.hasConflict,
        conflictReason: check.reason ?? null,
      };
    });

    const driverAvailability = drivers.map((d) => {
      const check = checkDriverConflict(db, d.id, startTime, endTime, excludeTripId);
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
             COALESCE(d.name, 'Group') as department_name,
             v.registration_plate, v.make, v.model, v.car_type, v.energy_type, v.battery_percent, v.seats,
             b.id as booking_id, b.status as booking_status,
             a.id as assignment_id, a.driver_profile_id, a.acknowledged_at,
             dp.user_id as assigned_driver_user_id,
             dp.full_name as assigned_driver_name,
             dp.contact_number as assigned_driver_phone
      FROM trip_requests tr
      JOIN users u ON u.id = tr.requester_id
      LEFT JOIN departments d ON d.id = tr.department_id
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

    const hwsCountRow = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'HWS' AND is_active = 1 AND approval_status = 'APPROVED'").get() as { c: number };
    const hasHwsAccount = (hwsCountRow?.c ?? 0) > 0;
    const nowMs = Date.now();
    const TEN_MINUTES_MS = 10 * 60 * 1000;

    const enriched = rows.map((r) => {
      const decisions = db
        .prepare(
          `SELECT ad.*, u.nickname as decider_name
           FROM approval_decisions ad
           JOIN users u ON u.id = ad.decider_id
           WHERE ad.trip_request_id = ?
           ORDER BY ad.id ASC`
        )
        .all(Number(r.id)) as any[];
      const events = db.prepare('SELECT * FROM trip_events WHERE trip_request_id = ? ORDER BY id ASC').all(Number(r.id));
      const picApproved = decisions.some((d: any) => d.decider_role === 'FM' && d.decision === 'APPROVED');
      const hwsApproved = decisions.some((d: any) => d.decider_role === 'HWS' && d.decision === 'APPROVED');
      const admDelegated = decisions.some((d: any) => d.decider_role === 'ADM' && d.decision === 'APPROVED');

      const startMs = r.start_time ? new Date(String(r.start_time)).getTime() : NaN;
      const trackingUnlocksAt = Number.isFinite(startMs) ? new Date(startMs - TEN_MINUTES_MS).toISOString() : null;
      const hasAssignedDriver = Boolean(r.driver_profile_id || r.assigned_driver_user_id);
      const isWithinTenMinWindow =
        r.status === 'IN_PROGRESS' ||
        (r.status === 'APPROVED' && Number.isFinite(startMs) && startMs - nowMs <= TEN_MINUTES_MS);
      const liveDriverTrackingVisible = hasAssignedDriver && isWithinTenMinWindow;

      let assignedDriverLat: number | null = null;
      let assignedDriverLon: number | null = null;
      let assignedDriverGpsUpdatedAt: string | null = null;

      if (liveDriverTrackingVisible) {
        const latestGps = r.driver_profile_id
          ? (db
              .prepare(
                `SELECT latitude, longitude, server_receipt_time as updated_at
                 FROM location_reports
                 WHERE driver_profile_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL AND is_flagged_implausible = 0
                 ORDER BY id DESC LIMIT 1`
              )
              .get(Number(r.driver_profile_id)) as { latitude: number; longitude: number; updated_at: string } | undefined)
          : undefined;

        const latestPin = r.assigned_driver_user_id
          ? (db
              .prepare(
                `SELECT latitude, longitude, updated_at
                 FROM user_locations
                 WHERE user_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
                 LIMIT 1`
              )
              .get(Number(r.assigned_driver_user_id)) as { latitude: number; longitude: number; updated_at: string } | undefined)
          : undefined;

        const latestVehGps =
          !latestGps && !latestPin && r.vehicle_id
            ? (db
                .prepare(
                  `SELECT latitude, longitude, server_receipt_time as updated_at
                   FROM location_reports
                   WHERE vehicle_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL AND is_flagged_implausible = 0
                   ORDER BY id DESC LIMIT 1`
                )
                .get(Number(r.vehicle_id)) as { latitude: number; longitude: number; updated_at: string } | undefined)
            : undefined;

        const candidates = [latestGps, latestPin, latestVehGps].filter(Boolean) as Array<{
          latitude: number;
          longitude: number;
          updated_at: string;
        }>;
        if (candidates.length > 0) {
          candidates.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
          assignedDriverLat = Number(candidates[0].latitude);
          assignedDriverLon = Number(candidates[0].longitude);
          assignedDriverGpsUpdatedAt = candidates[0].updated_at || null;
        }
      }

      return {
        ...r,
        decisions,
        events,
        requires_dual_approval: hasHwsAccount,
        pic_approved: picApproved,
        hws_approved: hwsApproved,
        adm_delegated: admDelegated,
        is_urgent: Number(r.is_urgent || 0) === 1,
        urgent_reason: (r.urgent_reason as string) || null,
        requires_pic_urgent_approval: Number(r.is_urgent || 0) === 1 && !picApproved,
        reservation_type: (r.reservation_type as string) || 'ONE_WAY',
        return_pickup_time: (r.return_pickup_time as string) || null,
        live_driver_tracking_visible: liveDriverTrackingVisible,
        tracking_unlocks_at: trackingUnlocksAt,
        assigned_driver_lat: assignedDriverLat,
        assigned_driver_lon: assignedDriverLon,
        assigned_driver_gps_updated_at: assignedDriverGpsUpdatedAt,
      };
    });

    res.set('Cache-Control', 'no-store');
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
    const {
      vehicle_id,
      preferred_driver_id,
      purpose,
      origin,
      destination,
      start_time,
      end_time,
      passenger_count,
      passenger_nickname,
      passengers,
      notes,
      self_drive,
      is_urgent,
      urgent_reason,
      reservation_type,
      return_pickup_time,
    } = req.body ?? {};

    // Revision #1: Self-drive is strictly prohibited
    if (self_drive === true || self_drive === 'true' || self_drive === 1) {
      res.status(400).json({ error: 'Self-drive is disabled. All company vehicle bookings require an assigned driver.' });
      return;
    }

    if (!purpose || !origin || !destination || !start_time || !end_time) {
      res.status(400).json({ error: 'purpose, origin, destination, start_time, and end_time are mandatory (REQ-02)' });
      return;
    }

    const startMs = new Date(start_time).getTime();
    const endMs = new Date(end_time).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      res.status(400).json({ error: 'End time must be after start time (REQ-02)' });
      return;
    }

    const rawReservationType = reservation_type ? String(reservation_type).trim().toUpperCase() : 'ONE_WAY';
    const finalReservationType =
      rawReservationType === 'ROUND_TRIP'
        ? 'DROP_AND_PICKUP'
        : rawReservationType === 'STANDARD_TRIP'
        ? 'ONE_WAY'
        : rawReservationType;
    if (!['ONE_WAY', 'DROP_AND_PICKUP', 'FULL_DAY'].includes(finalReservationType)) {
      res.status(400).json({ error: 'reservation_type must be ONE_WAY, DROP_AND_PICKUP (Round Trip), or FULL_DAY' });
      return;
    }

    let finalReturnPickupTime: string | null = null;
    if (finalReservationType === 'DROP_AND_PICKUP') {
      const rpMs = return_pickup_time ? new Date(return_pickup_time).getTime() : NaN;
      if (!return_pickup_time || Number.isNaN(rpMs)) {
        res.status(400).json({ error: 'return_pickup_time is required for Round Trip (Drop & Pick Up) bookings' });
        return;
      }
      if (rpMs <= startMs) {
        res.status(400).json({ error: 'Return pick-up time after event must be after departure time' });
        return;
      }
      if (endMs < rpMs) {
        res.status(400).json({ error: 'Final return time must be at or after the post-event pick-up time' });
        return;
      }
      finalReturnPickupTime = new Date(rpMs).toISOString();
    }

    const modeSummary =
      finalReservationType === 'FULL_DAY'
        ? ' [Full Day]'
        : finalReservationType === 'DROP_AND_PICKUP'
        ? ` [Round Trip • Return Pick-Up: ${new Date(finalReturnPickupTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]`
        : '';

    const now = Date.now();
    // Allow slight tolerance of 60 seconds for clock skew
    if (startMs < now - 60000) {
      res.status(400).json({ error: 'Departure time cannot be in the past' });
      return;
    }

    const leadTimeMinutes = Math.round((startMs - now) / 60000);
    // Booking rule: bookings must be scheduled at least 2 hours (120 minutes) in advance
    const calculatedIsUrgent = leadTimeMinutes < 120 ? 1 : 0;
    const finalIsUrgent = is_urgent === 1 || is_urgent === true || calculatedIsUrgent === 1 ? 1 : 0;
    const finalUrgentReason = urgent_reason ? String(urgent_reason).trim() : null;

    if (finalIsUrgent === 1 && !finalUrgentReason && user.role === 'EMP' && (!notes || !notes.trim()) && (!purpose || purpose.trim().length < 5)) {
      res.status(400).json({
        error:
          'Company fleet rule requires booking at least 2 hours before departure. Urgent requests departing within 2 hours require an urgent justification and mandatory Fleet Operation PIC approval.',
      });
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

    const autoAssignRequested =
      req.body?.auto_assign === true ||
      req.body?.auto_assign === 1 ||
      !vehicle_id ||
      String(vehicle_id).toUpperCase() === 'AUTO';

    try {
      const createdPayload = runInTransaction(db, () => {
        const parsedVehId =
          vehicle_id && String(vehicle_id).toUpperCase() !== 'AUTO' ? Number(vehicle_id) : NaN;
        let resolvedVehicleId: number | null =
          Number.isFinite(parsedVehId) && parsedVehId > 0 ? parsedVehId : null;
        let chosenDriverId: number | null = preferred_driver_id ? Number(preferred_driver_id) : null;

        // If auto_assign is enabled and the client's tentative vehicle just conflicted in a race, fall back to pool auto-pick
        if (resolvedVehicleId && autoAssignRequested) {
          const tentativeCheck = checkVehicleConflict(db, resolvedVehicleId, start_time, end_time);
          if (tentativeCheck.hasConflict) {
            resolvedVehicleId = null;
          }
        }

        if (!resolvedVehicleId) {
          // Item #4: Auto-assign any available conflict-free car/driver so user doesn't have to manually pick a car
          const candidateVehicles = db
            .prepare("SELECT id, seats, default_driver_id FROM vehicles WHERE status = 'Available' ORDER BY seats >= ? DESC, id ASC")
            .all(pax) as Array<{ id: number; seats: number; default_driver_id: number | null }>;

          for (const cand of candidateVehicles) {
            const vc = checkVehicleConflict(db, cand.id, start_time, end_time);
            if (vc.hasConflict) continue;
            const candDriverId = chosenDriverId || cand.default_driver_id;
            if (candDriverId) {
              const dc = checkDriverConflict(db, candDriverId, start_time, end_time);
              if (dc.hasConflict) {
                // Vehicle is free, let Fleet Manager assign another driver if default driver is busy
                resolvedVehicleId = cand.id;
                chosenDriverId = null;
                break;
              }
              resolvedVehicleId = cand.id;
              chosenDriverId = candDriverId;
              break;
            }
            resolvedVehicleId = cand.id;
            break;
          }

          if (!resolvedVehicleId) {
            const err = new Error('All company vehicles are currently booked for this time slot. Open "Set Schedule" to hitchhike or negotiate with the current holder.');
            (err as Error & { status?: number }).status = 409;
            throw err;
          }
        } else {
          const vehCapacityRow = db
            .prepare('SELECT id, registration_plate, seats FROM vehicles WHERE id = ?')
            .get(resolvedVehicleId) as { id: number; registration_plate: string; seats: number } | undefined;
          if (vehCapacityRow) {
            const maxVehSeats = Number(vehCapacityRow.seats || 5);
            if (pax > maxVehSeats) {
              const err = new Error(`Vehicle ${vehCapacityRow.registration_plate} supports at most ${maxVehSeats} passenger(s).`);
              (err as Error & { status?: number }).status = 400;
              throw err;
            }
          }
          const vConflict = checkVehicleConflict(db, resolvedVehicleId, start_time, end_time);
          if (vConflict.hasConflict) {
            const err = new Error(vConflict.reason || 'Vehicle conflict');
            (err as Error & { status?: number }).status = 409;
            throw err;
          }

          if (!chosenDriverId) {
            const veh = db.prepare('SELECT default_driver_id FROM vehicles WHERE id = ?').get(resolvedVehicleId) as
              | { default_driver_id: number | null }
              | undefined;
            if (veh?.default_driver_id) {
              chosenDriverId = veh.default_driver_id;
            }
          }

          if (chosenDriverId) {
            const dConflict = checkDriverConflict(db, chosenDriverId, start_time, end_time);
            if (dConflict.hasConflict) {
              if (autoAssignRequested) {
                // Keep the available car and let Fleet Manager assign an available driver on approval
                chosenDriverId = null;
              } else {
                const err = new Error(dConflict.reason || 'Driver conflict');
                (err as Error & { status?: number }).status = 409;
                throw err;
              }
            }
          }
        }

        const tripRes = db
          .prepare(
            `INSERT INTO trip_requests (
              requester_id, department_id, vehicle_id, preferred_driver_id, passenger_nickname, passengers_json,
              purpose, origin, destination, start_time, end_time, passenger_count, notes, status,
              is_urgent, urgent_reason, reservation_type, return_pickup_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?, ?)`
          )
          .run(
            user.id,
            user.department_id,
            resolvedVehicleId,
            chosenDriverId,
            finalPaxNickname,
            passengersJson,
            String(purpose).trim(),
            String(origin).trim(),
            String(destination).trim(),
            start_time,
            end_time,
            pax,
            notes ? String(notes).trim() : null,
            finalIsUrgent,
            finalUrgentReason,
            finalReservationType,
            finalReturnPickupTime
          );

        const tripId = Number(tripRes.lastInsertRowid);

        // Revision #4: Immediately create PENDING_APPROVAL booking to block the vehicle schedule right away
        const bookingRes = db
          .prepare(
            `INSERT INTO bookings (trip_request_id, vehicle_id, booked_by, purpose, start_time, end_time, buffer_minutes, status)
             VALUES (?, ?, ?, ?, ?, ?, 15, 'PENDING_APPROVAL')`
          )
          .run(tripId, resolvedVehicleId, user.id, String(purpose).trim(), start_time, end_time);

        const bookingId = Number(bookingRes.lastInsertRowid);

        // Revision #4 & Item #10: If driver is requested/selected at booking time, immediately block that driver's schedule and auto-accept (acknowledged_at = datetime('now'))
        let assignmentId: number | null = null;
        if (chosenDriverId) {
          const asnRes = db
            .prepare(
              `INSERT INTO assignments (trip_request_id, booking_id, vehicle_id, driver_profile_id, assigned_by, reason, effective_start, effective_end, is_current, acknowledged_at)
               VALUES (?, ?, ?, ?, ?, 'Reserved upon trip booking submission (Pending Approval)', ?, ?, 1, datetime('now'))`
            )
            .run(tripId, bookingId, resolvedVehicleId, chosenDriverId, user.id, start_time, end_time);
          assignmentId = Number(asnRes.lastInsertRowid);
        }

        const trip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId);
        recordAudit(db, user, 'TRIP_REQUEST_SUBMITTED', 'TRIP_REQUEST', tripId, null, { trip, bookingId, assignmentId });

        return { trip, bookingId, assignmentId, tripId };
      });

      notifyAdmins(db, {
        triggerType: 'TRIP_REQUEST_SUBMITTED',
        title: 'New Vehicle Booking Awaiting Approval',
        body: `${user.nickname} booked a car for "${purpose}"${modeSummary} (${origin} -> ${destination}). Vehicle slot is locked pending your approval.`,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: createdPayload.tripId,
      });

      sendUserNotification(db, {
        userId: user.id,
        triggerType: 'BOOKING_SUBMITTED',
        title: 'Booking Reserved (Pending Approval)',
        body: `Your booking for "${purpose}"${modeSummary} has locked the vehicle schedule and awaits Admin approval.`,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: createdPayload.tripId,
      });

      if (finalIsUrgent === 1) {
        notifyRole(db, 'FM', {
          triggerType: 'URGENT_TRIP_NEEDS_APPROVAL',
          title: 'Urgent Car Request (< 2h Advance)',
          body: `${user.nickname} submitted an URGENT request for "${purpose}"${modeSummary} departing at ${start_time} (${leadTimeMinutes} min from now). Fleet Operation PIC authorization is required.`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: createdPayload.tripId,
        });
      }

      broadcastTripUpdate(db, createdPayload.tripId, 'TRIP_CREATED');
      res.status(201).json(createdPayload);
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 400;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  // Approve or Reject Trip Request (Dual-Approval Workflow: FM + HWS or Admin Delegation)
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
          reservation_type?: string;
          return_pickup_time?: string | null;
          status: string;
        }
      | undefined;

    if (!trip) {
      res.status(404).json({ error: 'Trip request not found' });
      return;
    }

    const modeTag =
      trip.reservation_type === 'FULL_DAY'
        ? ' [Full Day]'
        : trip.reservation_type === 'DROP_AND_PICKUP'
        ? ` [Round Trip${
            trip.return_pickup_time
              ? ` • Return Pick-Up ${new Date(trip.return_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : ''
          }]`
        : '';

    // REQ-10: Prevent a user from approving a request they submitted themselves
    if (trip.requester_id === user.id) {
      recordAudit(db, user, 'SELF_APPROVAL_REFUSED', 'TRIP_REQUEST', tripId, null, { decision });
      res.status(403).json({ error: 'Submitters cannot approve or decide on their own trip request (REQ-10)' });
      return;
    }

    // Dual-Approval Check: Check if an active Head Of WS Part (HWS) account exists in the company
    const hwsCountRow = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'HWS' AND is_active = 1 AND approval_status = 'APPROVED'").get() as { c: number };
    const hasHwsAccount = (hwsCountRow?.c ?? 0) > 0;

    const priorApprovals = db
      .prepare("SELECT * FROM approval_decisions WHERE trip_request_id = ? AND decision = 'APPROVED'")
      .all(tripId) as Array<{ id: number; decider_id: number; decider_role: string }>;

    const picApprovedPrior = priorApprovals.some((a) => a.decider_role === 'FM');
    const hwsApprovedPrior = priorApprovals.some((a) => a.decider_role === 'HWS');

    // Once a booking is APPROVED, IN_PROGRESS, COMPLETED, or CANCELLED, Fleet PIC / Head of WS / Admin cannot modify or reject it.
    // Approved bookings can only be cancelled by the requester (pemesan) themselves.
    if (['APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(trip.status)) {
      recordAudit(db, user, 'POST_APPROVAL_DECISION_REFUSED', 'TRIP_REQUEST', tripId, { status: trip.status }, { attempted_decision: decision });
      res.status(400).json({
        error: `Booking #${tripId} is already ${trip.status} and locked. Approved bookings cannot be modified or rejected by approvers; only the requester can cancel their booking.`,
      });
      return;
    }

    // Once Fleet PIC has approved Stage 1 (picApprovedPrior === true), the booking CANNOT be rejected or edited by Fleet PIC, Head of WS, or Admin.
    // Only Stage 2 final sign-off (APPROVED) is permitted, and only the requester (pemesan) can cancel the order.
    if (picApprovedPrior && (decision === 'REJECTED' || user.role === 'FM')) {
      recordAudit(db, user, 'POST_PIC_APPROVAL_EDIT_OR_REJECT_REFUSED', 'TRIP_REQUEST', tripId, { status: trip.status, pic_approved: true }, { attempted_decision: decision, role: user.role });
      res.status(400).json({
        error: `Booking #${tripId} is already APPROVED by Fleet PIC and locked. It cannot be rejected or edited; only the requester can cancel their booking.`,
      });
      return;
    }

    if (decision === 'REJECTED' && (!reason || !String(reason).trim())) {
      res.status(400).json({ error: 'A rejection reason is mandatory when rejecting a trip request (REQ-05)' });
      return;
    }

    try {
      const outcome = runInTransaction(db, () => {
        if (decision === 'REJECTED') {
          db.prepare(
            `INSERT INTO approval_decisions (trip_request_id, decider_id, decider_role, decision, reason)
             VALUES (?, ?, ?, 'REJECTED', ?)`
          ).run(tripId, user.id, user.role, reason ? String(reason).trim() : 'Rejected');

          db.prepare("UPDATE trip_requests SET status = 'REJECTED', updated_at = datetime('now') WHERE id = ?").run(tripId);
          db.prepare("UPDATE bookings SET status = 'CANCELLED', cancellation_reason = ?, updated_at = datetime('now') WHERE trip_request_id = ?").run(
            `Rejected: ${reason}`,
            tripId
          );
          db.prepare('UPDATE assignments SET is_current = 0 WHERE trip_request_id = ?').run(tripId);

          recordAudit(db, user, 'TRIP_REQUEST_REJECTED', 'TRIP_REQUEST', tripId, { status: trip.status }, { status: 'REJECTED', reason });
          return { status: 'REJECTED', isFinal: true, assignedDriverUserId: null as number | null };
        }

        const tripIsUrgent = Number((trip as any).is_urgent || 0) === 1;

        // APPROVED path: Strict Approval Hierarchy (1. Fleet Operation PIC Consent -> 2. Head Of WS Part Approval)
        if (hasHwsAccount || (tripIsUrgent && !picApprovedPrior)) {
          if (user.role === 'FM') {
            if (picApprovedPrior) {
              const err = new Error('Fleet Operation PIC has already consented to this request. Awaiting Head Of WS Part authorization.');
              (err as Error & { status?: number }).status = 400;
              throw err;
            }
            if (hasHwsAccount && !hwsApprovedPrior) {
              // Stage 1: Consented by Fleet Operation PIC, awaiting Head Of WS Part final approval
              const enforceFixedDriverCar = req.body?.enforce_fixed_driver_car === true;
              let stage1DriverId: number | null = driver_profile_id ? Number(driver_profile_id) : trip.preferred_driver_id;
              let targetVehicleId = vehicle_id ? Number(vehicle_id) : trip.vehicle_id;

              if (enforceFixedDriverCar && stage1DriverId) {
                const fixedVeh = db
                  .prepare('SELECT id FROM vehicles WHERE default_driver_id = ? LIMIT 1')
                  .get(stage1DriverId) as { id: number } | undefined;
                if (fixedVeh?.id) {
                  targetVehicleId = fixedVeh.id;
                }
              }

              const vConflictStage1 = checkVehicleConflict(db, targetVehicleId, trip.start_time, trip.end_time, undefined, tripId);
              if (vConflictStage1.hasConflict) {
                const err = new Error(vConflictStage1.reason || 'Selected vehicle is not available for this time slot');
                (err as Error & { status?: number }).status = 409;
                throw err;
              }

              if (!stage1DriverId) {
                const vehRow = db.prepare('SELECT default_driver_id FROM vehicles WHERE id = ?').get(targetVehicleId) as
                  | { default_driver_id: number | null }
                  | undefined;
                if (vehRow?.default_driver_id) {
                  stage1DriverId = vehRow.default_driver_id;
                }
              }
              if (stage1DriverId) {
                const dConflictStage1 = checkDriverConflict(db, stage1DriverId, trip.start_time, trip.end_time, tripId);
                if (dConflictStage1.hasConflict) {
                  const err = new Error(dConflictStage1.reason || 'Selected driver is not available for this time slot');
                  (err as Error & { status?: number }).status = 409;
                  throw err;
                }
              }

              const baseReason = reason ? String(reason).trim() : 'Consented by Fleet Operation PIC';
              const stage1Reason = tripIsUrgent
                ? `${baseReason} [Urgent Request Approved by Fleet Operation PIC]`.trim()
                : baseReason;
              const decRes = db
                .prepare(
                  `INSERT INTO approval_decisions (trip_request_id, decider_id, decider_role, decision, reason)
                   VALUES (?, ?, 'FM', 'APPROVED', ?)`
                )
                .run(tripId, user.id, stage1Reason);

              db.prepare(
                `UPDATE trip_requests
                 SET vehicle_id = ?,
                     preferred_driver_id = ?,
                     updated_at = datetime('now')
                 WHERE id = ?`
              ).run(targetVehicleId, stage1DriverId, tripId);

              const existingBkg = db.prepare("SELECT id FROM bookings WHERE trip_request_id = ? AND status != 'CANCELLED'").get(tripId) as
                | { id: number }
                | undefined;
              let stage1BookingId: number;
              if (existingBkg) {
                stage1BookingId = existingBkg.id;
                db.prepare("UPDATE bookings SET vehicle_id = ?, updated_at = datetime('now') WHERE id = ?").run(targetVehicleId, stage1BookingId);
              } else {
                const bRes = db
                  .prepare(
                    `INSERT INTO bookings (trip_request_id, vehicle_id, booked_by, purpose, start_time, end_time, buffer_minutes, status)
                     VALUES (?, ?, ?, ?, ?, ?, 15, 'PENDING_APPROVAL')`
                  )
                  .run(tripId, targetVehicleId, trip.requester_id, trip.purpose, trip.start_time, trip.end_time);
                stage1BookingId = Number(bRes.lastInsertRowid);
              }

              if (stage1DriverId) {
                db.prepare('UPDATE assignments SET is_current = 0 WHERE trip_request_id = ?').run(tripId);
                db.prepare(
                  `INSERT INTO assignments (trip_request_id, booking_id, vehicle_id, driver_profile_id, assigned_by, reason, effective_start, effective_end, is_current, acknowledged_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`
                ).run(tripId, stage1BookingId, targetVehicleId, stage1DriverId, user.id, stage1Reason, trip.start_time, trip.end_time);
              }

              recordAudit(db, user, 'TRIP_STAGE_APPROVED', 'TRIP_REQUEST', tripId, { status: trip.status }, {
                stage: 'AWAITING_HWS',
                is_urgent: tripIsUrgent,
                vehicle_id: targetVehicleId,
                driver_profile_id: stage1DriverId,
              });
              return { status: 'PENDING_APPROVAL', isFinal: false, stage: 'AWAITING_HWS', decisionId: Number(decRes.lastInsertRowid) };
            }
          } else if (user.role === 'HWS') {
            if (hwsApprovedPrior) {
              const err = new Error('Head Of WS Part has already approved this request.');
              (err as Error & { status?: number }).status = 400;
              throw err;
            }
            if (!picApprovedPrior) {
              const err = new Error('Approval Hierarchy: Fleet Operation PIC must consent first before Head Of WS Part can approve.');
              (err as Error & { status?: number }).status = 400;
              throw err;
            }
          }
        }

        // Final Approval reached (FM consented + HWS approved, or Admin delegation, or single-stage when no HWS account)
        const isDelegated = user.role === 'ADM' && ((hasHwsAccount && (!picApprovedPrior || !hwsApprovedPrior)) || (tripIsUrgent && !picApprovedPrior));
        let finalReason = reason ? String(reason).trim() : 'Approved and dispatched';
        if (isDelegated) {
          finalReason = `${finalReason} [Approved & Delegated by Admin${tripIsUrgent ? ' (Urgent Request)' : ''}]`.trim();
        } else if (tripIsUrgent && user.role === 'FM') {
          finalReason = `${finalReason} [Urgent Request Approved by Fleet Operation PIC]`.trim();
        }

        const decRes = db
          .prepare(
            `INSERT INTO approval_decisions (trip_request_id, decider_id, decider_role, decision, reason)
             VALUES (?, ?, ?, 'APPROVED', ?)`
          )
          .run(tripId, user.id, user.role, finalReason);

        // If Fleet PIC already approved in Stage 1 (picApprovedPrior), lock driver & vehicle strictly to Stage 1's assignment (cannot edit after Fleet PIC approval)
        const stage1LockedAsn = picApprovedPrior
          ? (db
              .prepare('SELECT vehicle_id, driver_profile_id FROM assignments WHERE trip_request_id = ? AND is_current = 1 ORDER BY id DESC LIMIT 1')
              .get(tripId) as { vehicle_id: number; driver_profile_id: number } | undefined)
          : undefined;

        const enforceFixedDriverCarFinal = req.body?.enforce_fixed_driver_car === true;
        let targetDriverProfileId = picApprovedPrior
          ? stage1LockedAsn?.driver_profile_id ?? trip.preferred_driver_id
          : driver_profile_id
          ? Number(driver_profile_id)
          : trip.preferred_driver_id;
        let targetVehicleId = picApprovedPrior
          ? stage1LockedAsn?.vehicle_id ?? trip.vehicle_id
          : vehicle_id
          ? Number(vehicle_id)
          : trip.vehicle_id;

        if (!picApprovedPrior && enforceFixedDriverCarFinal && targetDriverProfileId) {
          const fixedVehFinal = db
            .prepare('SELECT id FROM vehicles WHERE default_driver_id = ? LIMIT 1')
            .get(targetDriverProfileId) as { id: number } | undefined;
          if (fixedVehFinal?.id) {
            targetVehicleId = fixedVehFinal.id;
          }
        }

        const vConflict = checkVehicleConflict(db, targetVehicleId, trip.start_time, trip.end_time, undefined, tripId);
        if (vConflict.hasConflict) {
          const err = new Error(vConflict.reason || 'Vehicle conflict');
          (err as Error & { status?: number }).status = 409;
          throw err;
        }

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
          // Item #10: Auto-accept driver dispatch upon assignment (acknowledged_at = datetime('now'))
          db.prepare(
            `INSERT INTO assignments (trip_request_id, booking_id, vehicle_id, driver_profile_id, assigned_by, reason, effective_start, effective_end, is_current, acknowledged_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`
          ).run(
            tripId,
            bookingId,
            targetVehicleId,
            targetDriverProfileId,
            user.id,
            finalReason,
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
          is_delegated: isDelegated,
        });

        return { status: 'APPROVED', isFinal: true, assignedDriverUserId, decisionId: Number(decRes.lastInsertRowid), isDelegated };
      });

      // Notification Dispatch (Stage-aware and role-aware)
      if (outcome.status === 'REJECTED') {
        sendUserNotification(db, {
          userId: trip.requester_id,
          triggerType: 'TRIP_REJECTED',
          title: 'Booking Request Rejected',
          body: `Your booking "${trip.purpose}"${modeTag} was rejected. Reason: ${reason}`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: tripId,
        });
        notifyAdmins(db, {
          triggerType: 'TRIP_REJECTED',
          title: 'Trip Request Rejected',
          body: `${user.nickname} (${user.role}) rejected Trip #${tripId}${modeTag}. Reason: ${reason}`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: tripId,
        });
      } else if (!outcome.isFinal && outcome.stage === 'AWAITING_HWS') {
        // Fleet Operation PIC approved; alert Head Of WS Part
        notifyRole(db, 'HWS', {
          triggerType: 'TRIP_NEEDS_HWS_APPROVAL',
          title: 'Action Required: Head Of WS Part Approval',
          body: `Fleet Operation PIC approved Trip #${tripId} ("${trip.purpose}")${modeTag}. Your Head Of WS Part authorization is required.`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: tripId,
        });
        sendUserNotification(db, {
          userId: trip.requester_id,
          triggerType: 'TRIP_STAGE_APPROVED',
          title: 'Booking Approved by Fleet Operation PIC',
          body: `Your booking "${trip.purpose}"${modeTag} was approved by Fleet Operation PIC, awaiting Head Of WS Part review.`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: tripId,
        });
      } else if (!outcome.isFinal && outcome.stage === 'AWAITING_FM') {
        // Head Of WS Part approved; alert Fleet Operation PIC (mandatory for urgent trips)
        const isUrgent = Number((trip as any).is_urgent || 0) === 1;
        notifyRole(db, 'FM', {
          triggerType: isUrgent ? 'URGENT_TRIP_NEEDS_PIC_APPROVAL' : 'TRIP_NEEDS_PIC_APPROVAL',
          title: isUrgent ? 'Action Required: Urgent Trip PIC Authorization' : 'Action Required: Fleet Operation PIC Dispatch',
          body: isUrgent
            ? `Head Of WS Part approved Urgent Trip #${tripId} ("${trip.purpose}")${modeTag}. Your mandatory Fleet Operation PIC approval and driver dispatch is required immediately.`
            : `Head Of WS Part approved Trip #${tripId} ("${trip.purpose}")${modeTag}. Please confirm vehicle and driver dispatch.`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: tripId,
        });
        sendUserNotification(db, {
          userId: trip.requester_id,
          triggerType: 'TRIP_STAGE_APPROVED',
          title: 'Booking Approved by Head Of WS Part',
          body: `Your booking "${trip.purpose}"${modeTag} was approved by Head Of WS Part, awaiting Fleet Operation PIC dispatch.`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: tripId,
        });
      } else if (outcome.status === 'APPROVED') {
        // Final Approval & Dispatch
        sendUserNotification(db, {
          userId: trip.requester_id,
          triggerType: 'TRIP_APPROVED',
          title: 'Booking Approved & Dispatched',
          body: `Your booking "${trip.purpose}"${modeTag} (${trip.origin} -> ${trip.destination}) has been approved and dispatched.`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: tripId,
        });

        if (outcome.assignedDriverUserId) {
          sendUserNotification(db, {
            userId: outcome.assignedDriverUserId,
            triggerType: 'DISPATCH_ORDER_ASSIGNED',
            title: 'New Dispatch Order Assigned (Auto-Accepted)',
            body: `Dispatch order for "${trip.purpose}"${modeTag} (${trip.origin} -> ${trip.destination}) starting at ${trip.start_time} has been automatically accepted. Upload start odometer photo to begin trip.`,
            relatedEntityType: 'TRIP_REQUEST',
            relatedEntityId: tripId,
          });
        }

        notifyAdmins(db, {
          triggerType: 'TRIP_APPROVED_AND_DISPATCHED',
          title: 'Trip Request Dispatched',
          body: `Trip #${tripId} ("${trip.purpose}")${modeTag} is fully approved and dispatched.`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: tripId,
        });
      }

      const eventType = outcome.status === 'APPROVED' ? 'TRIP_APPROVED' : outcome.status === 'REJECTED' ? 'TRIP_REJECTED' : 'TRIP_STAGE_APPROVED';
      const enrichedTrip = broadcastTripUpdate(db, tripId, eventType, {
        decision: outcome.status,
        stage: (outcome as any).stage,
        isFinal: outcome.isFinal,
        isDelegated: Boolean((outcome as any).isDelegated),
      });

      const decisions = db.prepare('SELECT * FROM approval_decisions WHERE trip_request_id = ? ORDER BY id ASC').all(tripId);
      res.json({
        trip: enrichedTrip || db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId),
        decisions,
        status: outcome.status,
        stage: (outcome as any).stage,
        isFinal: outcome.isFinal,
        isDelegated: Boolean((outcome as any).isDelegated),
      });
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
          reservation_type?: string;
          return_pickup_time?: string | null;
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
    const rawNextResType = req.body?.reservation_type
      ? String(req.body.reservation_type).trim().toUpperCase()
      : (trip.reservation_type || 'ONE_WAY');
    const nextReservationType =
      rawNextResType === 'ROUND_TRIP'
        ? 'DROP_AND_PICKUP'
        : rawNextResType === 'STANDARD_TRIP'
        ? 'ONE_WAY'
        : rawNextResType;
    if (!['ONE_WAY', 'DROP_AND_PICKUP', 'FULL_DAY'].includes(nextReservationType)) {
      res.status(400).json({ error: 'reservation_type must be ONE_WAY, DROP_AND_PICKUP (Round Trip), or FULL_DAY' });
      return;
    }
    const nextStartMs = new Date(nextStart).getTime();
    const nextEndMs = new Date(nextEnd).getTime();
    if (Number.isNaN(nextStartMs) || Number.isNaN(nextEndMs) || nextEndMs <= nextStartMs) {
      res.status(400).json({ error: 'End time must be after start time (REQ-02)' });
      return;
    }
    let nextReturnPickup: string | null = null;
    if (nextReservationType === 'DROP_AND_PICKUP') {
      const rawReturn = req.body?.return_pickup_time !== undefined ? req.body.return_pickup_time : trip.return_pickup_time;
      const rpMs = rawReturn ? new Date(rawReturn).getTime() : NaN;
      if (!rawReturn || Number.isNaN(rpMs)) {
        res.status(400).json({ error: 'return_pickup_time is required for Round Trip (Drop & Pick Up) bookings' });
        return;
      }
      if (rpMs <= nextStartMs) {
        res.status(400).json({ error: 'Return pick-up time after event must be after departure time' });
        return;
      }
      if (nextEndMs < rpMs) {
        res.status(400).json({ error: 'Final return time must be at or after the post-event pick-up time' });
        return;
      }
      nextReturnPickup = new Date(rpMs).toISOString();
    }

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
           SET purpose = ?, vehicle_id = ?, start_time = ?, end_time = ?, reservation_type = ?, return_pickup_time = ?, status = 'PENDING_APPROVAL', updated_at = datetime('now')
           WHERE id = ?`
        ).run(nextPurpose, nextVehicleId, nextStart, nextEnd, nextReservationType, nextReturnPickup, tripId);

        db.prepare(
          `INSERT INTO bookings (trip_request_id, vehicle_id, booked_by, purpose, start_time, end_time, buffer_minutes, status)
           VALUES (?, ?, ?, ?, ?, ?, 15, 'PENDING_APPROVAL')`
        ).run(tripId, nextVehicleId, user.id, nextPurpose, nextStart, nextEnd);

        const row = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId);
        recordAudit(db, user, 'TRIP_REQUEST_RESUBMITTED', 'TRIP_REQUEST', tripId, trip, row);
        return row;
      });

      broadcastTripUpdate(db, tripId, 'TRIP_RESUBMITTED');
      res.json({ trip: updated });
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 400;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  // Confirm Passenger Boarding / Arrival ("I Am Here / Confirm Boarding") to prevent 20-minute no-show auto-cancel
  app.post('/api/trips/:id/confirm-boarding', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const tripId = Number(req.params.id);
    const trip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) as
      | {
          id: number;
          requester_id: number;
          vehicle_id: number;
          purpose: string;
          status: string;
          passenger_boarded_at?: string | null;
        }
      | undefined;

    if (!trip) {
      res.status(404).json({ error: 'Trip request not found' });
      return;
    }

    const assigned = db
      .prepare('SELECT id, driver_profile_id FROM assignments WHERE trip_request_id = ? AND is_current = 1')
      .get(tripId) as { id: number; driver_profile_id: number } | undefined;

    const isAssignedDriver = Boolean(user.role === 'DRV' && assigned && assigned.driver_profile_id === user.driver_profile_id);
    if (trip.requester_id !== user.id && !isPrivilegedRole(user) && !isAssignedDriver) {
      res.status(403).json({ error: 'Only the passenger who booked the car, the assigned driver, or an Admin can confirm boarding' });
      return;
    }

    if (!['APPROVED', 'IN_PROGRESS'].includes(trip.status)) {
      res.status(400).json({ error: 'Boarding can only be confirmed for APPROVED or IN_PROGRESS bookings' });
      return;
    }

    const boardedAt = new Date().toISOString();
    db.prepare("UPDATE trip_requests SET passenger_boarded_at = COALESCE(passenger_boarded_at, ?), updated_at = datetime('now') WHERE id = ?").run(
      boardedAt,
      tripId
    );

    if (assigned) {
      const drvUser = db.prepare('SELECT user_id FROM driver_profiles WHERE id = ?').get(assigned.driver_profile_id) as { user_id: number } | undefined;
      if (drvUser?.user_id && drvUser.user_id !== user.id) {
        sendUserNotification(db, {
          userId: drvUser.user_id,
          triggerType: 'PASSENGER_CONFIRMED_BOARDING',
          title: 'Passenger Ready at Vehicle',
          body: `${user.nickname} confirmed boarding for "${trip.purpose}". You may proceed to Start Trip.`,
          relatedEntityType: 'TRIP_REQUEST',
          relatedEntityId: tripId,
        });
      }
    }

    recordAudit(db, user, 'PASSENGER_BOARDING_CONFIRMED', 'TRIP_REQUEST', tripId, null, { passenger_boarded_at: boardedAt });
    const enriched = broadcastTripUpdate(db, tripId, 'TRIP_UPDATED', { passenger_boarded_at: boardedAt });
    res.json({ ok: true, passenger_boarded_at: boardedAt, trip: enriched });
  });

  // Cancel a trip request (Employee can cancel both PENDING_APPROVAL and APPROVED bookings; frees vehicle & driver slot immediately)
  const handleCancelTripRequest = (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const rawId = req.params.id ?? req.body?.trip_id ?? req.body?.id ?? req.query?.trip_id;
    const tripId = Number(rawId);
    if (!tripId || !Number.isFinite(tripId)) {
      res.status(400).json({ error: 'Valid trip ID is required to cancel a trip' });
      return;
    }
    const cancellationReason = req.body?.reason || req.body?.cancellation_reason
      ? String(req.body.reason || req.body.cancellation_reason).trim()
      : 'Cancelled by passenger (schedule/plan changed)';

    const trip = db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) as
      | {
          id: number;
          requester_id: number;
          vehicle_id: number;
          purpose: string;
          origin: string;
          destination: string;
          start_time: string;
          status: string;
        }
      | undefined;

    if (!trip) {
      res.status(404).json({ error: 'Trip request not found' });
      return;
    }

    if (trip.requester_id !== user.id) {
      recordAudit(db, user, 'UNAUTHORIZED_TRIP_CANCEL_REFUSED', 'TRIP_REQUEST', tripId, { status: trip.status }, { attempted_by: user.id, role: user.role });
      res.status(403).json({ error: 'Only the requester (pemesan) who created this booking can cancel it.' });
      return;
    }

    if (!['PENDING_APPROVAL', 'APPROVED'].includes(trip.status)) {
      res.status(400).json({ error: `Cannot cancel a trip in ${trip.status} status. Only PENDING_APPROVAL or APPROVED bookings can be cancelled.` });
      return;
    }

    const activeAssignment = db
      .prepare(
        `SELECT a.id, a.driver_profile_id, dp.user_id as driver_user_id, v.registration_plate
         FROM trip_requests tr
         LEFT JOIN vehicles v ON v.id = tr.vehicle_id
         LEFT JOIN assignments a ON a.trip_request_id = tr.id AND a.is_current = 1
         LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
         WHERE tr.id = ?`
      )
      .get(tripId) as { id: number | null; driver_profile_id: number | null; driver_user_id: number | null; registration_plate: string | null } | undefined;

    runInTransaction(db, () => {
      db.prepare("UPDATE trip_requests SET status = 'CANCELLED', notes = COALESCE(notes || ' | ', '') || ?, updated_at = datetime('now') WHERE id = ?").run(
        `[Cancelled: ${cancellationReason}]`,
        tripId
      );
      db.prepare(
        "UPDATE bookings SET status = 'CANCELLED', cancellation_reason = ?, updated_at = datetime('now') WHERE trip_request_id = ?"
      ).run(cancellationReason, tripId);
      db.prepare('UPDATE assignments SET is_current = 0 WHERE trip_request_id = ?').run(tripId);

      recordAudit(db, user, 'TRIP_REQUEST_CANCELLED', 'TRIP_REQUEST', tripId, { status: trip.status }, {
        status: 'CANCELLED',
        cancellation_reason: cancellationReason,
      });
    });

    if (activeAssignment?.driver_user_id) {
      sendUserNotification(db, {
        userId: activeAssignment.driver_user_id,
        triggerType: 'DISPATCH_CANCELLED_BY_PASSENGER',
        title: 'Booking Cancelled by Passenger',
        body: `Trip "${trip.purpose}" (${activeAssignment.registration_plate || 'Fleet Car'}) scheduled for ${trip.start_time} was cancelled by ${user.nickname}. Reason: ${cancellationReason}. Your slot is now free.`,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: tripId,
      });
    }

    notifyAdmins(db, {
      triggerType: 'TRIP_CANCELLED_BY_REQUESTER',
      title: 'Approved/Pending Booking Cancelled',
      body: `${user.nickname} cancelled Trip #${tripId} ("${trip.purpose}"). Vehicle and driver slot have been released.`,
      relatedEntityType: 'TRIP_REQUEST',
      relatedEntityId: tripId,
    });

    const enriched = broadcastTripUpdate(db, tripId, 'TRIP_UPDATED', { status: 'CANCELLED', cancellation_reason: cancellationReason });
    res.json({ ok: true, status: 'CANCELLED', trip: enriched });
  };

  app.post('/api/trips/:id/cancel', requireAuth, handleCancelTripRequest);
  app.patch('/api/trips/:id/cancel', requireAuth, handleCancelTripRequest);
  app.put('/api/trips/:id/cancel', requireAuth, handleCancelTripRequest);
  app.delete('/api/trips/:id/cancel', requireAuth, handleCancelTripRequest);
  app.delete('/api/trips/:id', requireAuth, handleCancelTripRequest);
  app.post('/api/trips/cancel', requireAuth, handleCancelTripRequest);
  app.post('/api/bookings/:id/cancel', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const bookingId = Number(req.params.id);
    const bkg = db.prepare('SELECT id, trip_request_id FROM bookings WHERE id = ?').get(bookingId) as
      | { id: number; trip_request_id: number | null }
      | undefined;
    if (bkg?.trip_request_id) {
      req.params.id = String(bkg.trip_request_id);
      handleCancelTripRequest(req, res);
      return;
    }
    res.status(404).json({ error: 'Booking not found' });
  });

  // Protect approval_decisions against any attempt to edit or delete via API (REQ-06, TC-REQ-02)
  app.all('/api/approval-decisions/:id', requireAuth, (req: Request, res: Response) => {
    recordAudit(getDb(), req.user, 'IMMUTABLE_DECISION_EDIT_REFUSED', 'APPROVAL_DECISION', String(req.params.id));
    res.status(405).json({ error: 'Approval decisions are immutable and can never be modified or deleted (REQ-06)' });
  });

  // Item #5: Google Calendar-style Schedule Endpoint (24 Hours: 00:00 to 24:00)
  // - Employees, Admins, FM, HWS see all active bookings across all cars (Group, PIC, Passengers, Destination, Duration)
  // - Drivers (DRV) see only their own assigned schedule
  // - Completed, Cancelled, and Rejected bookings are automatically excluded (removed from schedule)
  app.get('/api/schedule/calendar', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const canViewAllSchedules = user.role !== 'DRV';

    const baseSelect = `
      SELECT tr.id, tr.requester_id, tr.department_id, tr.vehicle_id, tr.preferred_driver_id,
             tr.passenger_nickname, tr.passengers_json, tr.purpose, tr.origin, tr.destination,
             tr.start_time, tr.end_time, tr.passenger_count, tr.status, tr.reservation_type, tr.return_pickup_time,
             u.nickname as requester_name,
             u.group_username as requester_username,
             u.contact_number as requester_contact,
             COALESCE(dp.contact_number, def_dp.contact_number) as assigned_driver_phone,
             COALESCE(d.name, 'Group') as department_name,
             v.registration_plate, v.make, v.model, v.car_type, v.energy_type, v.seats,
             b.id as booking_id, b.status as booking_status,
             a.id as assignment_id, a.driver_profile_id,
             COALESCE(dp.full_name, def_dp.full_name, 'Pool Driver') as assigned_driver_name
      FROM trip_requests tr
      JOIN users u ON u.id = tr.requester_id
      LEFT JOIN departments d ON d.id = tr.department_id
      JOIN vehicles v ON v.id = tr.vehicle_id
      LEFT JOIN bookings b ON b.trip_request_id = tr.id AND b.status NOT IN ('CANCELLED', 'COMPLETED')
      LEFT JOIN assignments a ON a.trip_request_id = tr.id AND a.is_current = 1
      LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
      LEFT JOIN driver_profiles def_dp ON def_dp.id = v.default_driver_id
      WHERE tr.status IN ('PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS')
        AND (b.status IS NULL OR b.status NOT IN ('CANCELLED', 'COMPLETED'))
    `;

    const tripRows =
      user.role === 'DRV'
        ? db
            .prepare(`${baseSelect} AND (a.driver_profile_id = ? OR tr.preferred_driver_id = ? OR v.default_driver_id = ?) ORDER BY tr.start_time ASC`)
            .all(user.driver_profile_id ?? -1, user.driver_profile_id ?? -1, user.driver_profile_id ?? -1)
        : db.prepare(`${baseSelect} ORDER BY tr.start_time ASC`).all();

    // Also include standalone active bookings (created directly via /api/bookings without a trip_request_id)
    const standaloneQuery = `
      SELECT (-100000 - b.id) as id, b.booked_by as requester_id, u.department_id as department_id,
             b.vehicle_id, v.default_driver_id as preferred_driver_id,
             u.nickname as passenger_nickname, NULL as passengers_json, b.purpose,
             '' as origin, b.purpose as destination,
             b.start_time, b.end_time, 1 as passenger_count,
             CASE WHEN b.status = 'ACTIVE' THEN 'APPROVED' ELSE b.status END as status,
             'ONE_WAY' as reservation_type, NULL as return_pickup_time,
             u.nickname as requester_name, u.group_username as requester_username, u.contact_number as requester_contact,
             def_dp.contact_number as assigned_driver_phone,
             COALESCE(d.name, 'Operations') as department_name,
             v.registration_plate, v.make, v.model, v.car_type, v.energy_type, v.seats,
             b.id as booking_id, b.status as booking_status,
             NULL as assignment_id, v.default_driver_id as driver_profile_id,
             COALESCE(def_dp.full_name, 'Pool Driver') as assigned_driver_name
      FROM bookings b
      JOIN users u ON u.id = b.booked_by
      LEFT JOIN departments d ON d.id = u.department_id
      JOIN vehicles v ON v.id = b.vehicle_id
      LEFT JOIN driver_profiles def_dp ON def_dp.id = v.default_driver_id
      WHERE b.trip_request_id IS NULL
        AND b.status IN ('PENDING_APPROVAL', 'ACTIVE', 'IN_PROGRESS')
    `;
    const standaloneRows =
      user.role === 'DRV'
        ? db.prepare(`${standaloneQuery} AND v.default_driver_id = ? ORDER BY b.start_time ASC`).all(user.driver_profile_id ?? -1)
        : db.prepare(`${standaloneQuery} ORDER BY b.start_time ASC`).all();

    const rows = [...tripRows, ...standaloneRows].sort((a: any, b: any) =>
      String(a.start_time || '').localeCompare(String(b.start_time || ''))
    );

    res.set('Cache-Control', 'no-store');
    res.json({ scheduleTrips: rows, trips: rows, can_view_all_schedules: canViewAllSchedules });
  });

  // Schedule & Trip Audit History: Review past completed (and cancelled/rejected) bookings & full trip information
  app.get('/api/schedule/audit', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const statusFilter = String(req.query.status || 'ALL').trim().toUpperCase();
    const dateFilter = String(req.query.date || '').trim();
    const qFilter = String(req.query.q || '').trim().toLowerCase();

    const baseSelect = `
      SELECT tr.id, tr.requester_id, tr.department_id, tr.vehicle_id, tr.preferred_driver_id,
             tr.passenger_nickname, tr.passengers_json, tr.purpose, tr.origin, tr.destination,
             tr.start_time, tr.end_time, tr.passenger_count, tr.status,
             tr.start_odometer, tr.end_odometer, tr.distance_km,
             tr.actual_start_time, tr.actual_end_time, tr.parking_return_note,
             tr.reservation_type, tr.return_pickup_time, tr.created_at, tr.updated_at,
             u.nickname as requester_name,
             u.group_username as requester_username,
             u.contact_number as requester_contact,
             d.name as department_name,
             v.registration_plate, v.make, v.model, v.car_type, v.energy_type, v.seats,
             (SELECT b.status FROM bookings b WHERE b.trip_request_id = tr.id ORDER BY b.id DESC LIMIT 1) as booking_status,
             (SELECT b.cancellation_reason FROM bookings b WHERE b.trip_request_id = tr.id ORDER BY b.id DESC LIMIT 1) as cancellation_reason,
             COALESCE(
               (SELECT dp.full_name FROM assignments a JOIN driver_profiles dp ON dp.id = a.driver_profile_id WHERE a.trip_request_id = tr.id ORDER BY a.is_current DESC, a.id DESC LIMIT 1),
               def_dp.full_name,
               'Pool Driver'
             ) as assigned_driver_name,
             COALESCE(
               (SELECT dp.contact_number FROM assignments a JOIN driver_profiles dp ON dp.id = a.driver_profile_id WHERE a.trip_request_id = tr.id ORDER BY a.is_current DESC, a.id DESC LIMIT 1),
               def_dp.contact_number
             ) as assigned_driver_phone
      FROM trip_requests tr
      JOIN users u ON u.id = tr.requester_id
      JOIN departments d ON d.id = tr.department_id
      JOIN vehicles v ON v.id = tr.vehicle_id
      LEFT JOIN driver_profiles def_dp ON def_dp.id = v.default_driver_id
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (statusFilter === 'COMPLETED' || statusFilter === 'CANCELLED' || statusFilter === 'REJECTED') {
      whereClauses.push('tr.status = ?');
      params.push(statusFilter);
    } else if (statusFilter === 'PAST') {
      whereClauses.push("tr.status IN ('COMPLETED', 'CANCELLED', 'REJECTED')");
    }

    if (!isPrivilegedRole(user)) {
      if (user.role === 'DRV') {
        whereClauses.push('(EXISTS (SELECT 1 FROM assignments a WHERE a.trip_request_id = tr.id AND a.driver_profile_id = ?) OR tr.preferred_driver_id = ? OR v.default_driver_id = ?)');
        params.push(user.driver_profile_id ?? -1, user.driver_profile_id ?? -1, user.driver_profile_id ?? -1);
      } else {
        whereClauses.push('tr.requester_id = ?');
        params.push(user.id);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = db.prepare(`${baseSelect} ${whereSql} ORDER BY tr.start_time DESC, tr.id DESC LIMIT 300`).all(...params) as any[];

    const decisionsStmt = db.prepare(
      `SELECT ad.id, ad.decider_role, ad.decision, ad.reason, ad.created_at, u.nickname as decider_name
       FROM approval_decisions ad
       JOIN users u ON u.id = ad.decider_id
       WHERE ad.trip_request_id = ?
       ORDER BY ad.id ASC`
    );

    const enriched = rows
      .filter((row) => {
        if (dateFilter) {
          const s = new Date(row.start_time);
          const localDate = !Number.isNaN(s.getTime())
            ? `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`
            : '';
          if (localDate !== dateFilter && !String(row.start_time || '').startsWith(dateFilter)) {
            return false;
          }
        }
        if (qFilter) {
          const hay = [
            row.id,
            row.requester_name,
            row.department_name,
            row.registration_plate,
            row.make,
            row.model,
            row.assigned_driver_name,
            row.origin,
            row.destination,
            row.purpose,
            row.passenger_nickname,
            row.status,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(qFilter)) return false;
        }
        return true;
      })
      .map((row) => ({
        ...row,
        decisions: decisionsStmt.all(row.id),
      }));

    res.set('Cache-Control', 'no-store');
    res.json({ records: enriched, total: enriched.length });
  });

  // Item #5: Negotiate with current booking holder to Hitchhike (Join Ride if same destination) or Request Cancellation
  const handleNegotiateTripRequest = (req: Request, res: Response, rawTripId?: number) => {
    const db = getDb();
    const user = req.user!;
    let tripId = Number(rawTripId ?? req.params.id ?? req.body?.trip_id ?? 0);
    const { action_type, passenger_nickname, message, origin, destination, purpose } = req.body ?? {};
    const actionNorm = String(action_type || 'HITCHHIKE').toUpperCase();

    if (!['HITCHHIKE', 'REQUEST_CANCEL'].includes(actionNorm)) {
      res.status(400).json({ error: 'action_type must be HITCHHIKE or REQUEST_CANCEL' });
      return;
    }

    // Resolve negative synthetic standalone booking IDs (-100000 - booking.id) or explicit booking_id
    if (tripId <= -100000 || (!tripId && req.body?.booking_id)) {
      const bookingLookupId = tripId <= -100000 ? -100000 - tripId : Number(req.body?.booking_id || 0);
      if (bookingLookupId > 0) {
        const bk = db.prepare('SELECT id, trip_request_id FROM bookings WHERE id = ?').get(bookingLookupId) as
          | { id: number; trip_request_id: number | null }
          | undefined;
        if (bk?.trip_request_id) {
          tripId = Number(bk.trip_request_id);
        }
      }
    }

    const trip = db
      .prepare(
        `SELECT tr.*, u.nickname as requester_name, COALESCE(d.name, 'Group') as department_name, v.registration_plate, v.make, v.model, v.seats
         FROM trip_requests tr
         JOIN users u ON u.id = tr.requester_id
         LEFT JOIN departments d ON d.id = tr.department_id
         JOIN vehicles v ON v.id = tr.vehicle_id
         WHERE tr.id = ?`
      )
      .get(tripId) as any;

    if (!trip) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (!['PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS'].includes(trip.status)) {
      res.status(400).json({ error: 'This booking is no longer active on the schedule' });
      return;
    }

    const reqDept = db.prepare('SELECT name FROM departments WHERE id = ?').get(user.department_id) as { name: string } | undefined;
    const reqDeptName = reqDept?.name || 'Group';
    const noteText = String(message ?? req.body?.note ?? '').trim();

    const parseExistingPax = (t: any): Array<{ id: number; nickname: string }> => {
      const rawNames: string[] = [];
      if (t.passengers_json) {
        try {
          const parsed = JSON.parse(t.passengers_json);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              const raw = String(p?.nickname || p?.name || p || '').trim();
              for (const part of raw.split(/[,\n]+/)) {
                const clean = part.replace(/^\d+\.\s*/, '').trim();
                if (clean) rawNames.push(clean);
              }
            }
          }
        } catch {}
      }
      if (rawNames.length === 0 && t.passenger_nickname) {
        for (const part of String(t.passenger_nickname).split(/[,\n]+/)) {
          const clean = part.replace(/^\d+\.\s*/, '').trim();
          if (clean) rawNames.push(clean);
        }
      }
      const seen = new Set<string>();
      const list: Array<{ id: number; nickname: string }> = [];
      for (const name of rawNames) {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ id: list.length + 1, nickname: name });
        }
      }
      return list;
    };

    const parseRequestedPax = (rawArr: any, rawStr: any, fallback: string): string[] => {
      const candidates: string[] = [];
      if (Array.isArray(rawArr)) {
        for (const item of rawArr) {
          const raw = String(typeof item === 'object' && item !== null ? (item.nickname || item.name || '') : item || '').trim();
          for (const part of raw.split(/[,\n]+/)) {
            const n = part.replace(/^\d+\.\s*/, '').trim();
            if (n) candidates.push(n);
          }
        }
      }
      if (candidates.length === 0 && rawStr) {
        for (const part of String(rawStr).split(/[,\n]+/)) {
          const n = part.replace(/^\d+\.\s*/, '').trim();
          if (n) candidates.push(n);
        }
      }
      if (candidates.length === 0 && fallback) {
        candidates.push(fallback.trim());
      }
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const name of candidates) {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(name);
        }
      }
      return unique;
    };

    if (actionNorm === 'HITCHHIKE') {
      const existingPending = db
        .prepare(
          `SELECT id FROM negotiation_requests
           WHERE trip_request_id = ? AND requester_user_id = ? AND action_type = 'HITCHHIKE' AND status = 'PENDING'
           LIMIT 1`
        )
        .get(tripId, user.id);
      if (existingPending) {
        res.status(409).json({ error: 'You already have a pending hitchhike request for this booking.' });
        return;
      }

      const currentPax = parseExistingPax(trip);
      const currentKeys = new Set(currentPax.map((p) => p.nickname.toLowerCase()));
      const requestedPax = parseRequestedPax(req.body?.passengers, passenger_nickname, user.nickname);
      const newPax = requestedPax.filter((n) => !currentKeys.has(n.toLowerCase()));

      if (newPax.length === 0) {
        res.status(409).json({ error: 'Requested passenger is already listed on this booking.' });
        return;
      }

      const maxSeats = Number(trip.seats || 5);
      const remainingSeats = Math.max(0, maxSeats - currentPax.length);
      if (remainingSeats <= 0) {
        res.status(400).json({ error: `Vehicle ${trip.registration_plate} is already at full passenger capacity (${maxSeats} seats).` });
        return;
      }
      if (newPax.length > remainingSeats) {
        res.status(400).json({ error: `Only ${remainingSeats} seat(s) remaining on ${trip.registration_plate} (${maxSeats} seats max).` });
        return;
      }

      const paxSummary = newPax.join(', ');
      const title = `Hitchhike (Join Ride) Request: ${user.nickname} (${reqDeptName})`;
      const body = `${user.nickname} (${reqDeptName}) would like to hitchhike / join your booked car (${trip.registration_plate} • ${trip.make} ${trip.model}) heading to "${trip.destination}" (${new Date(trip.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(trip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). Passenger(s) to add (${newPax.length}): ${paxSummary}.${noteText ? ` Note: "${noteText}"` : ''}`;

      const notifId = sendUserNotification(db, {
        userId: trip.requester_id,
        triggerType: 'NEGOTIATE_HITCHHIKE_REQUEST',
        title,
        body,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: tripId,
        skipSseBroadcast: true,
      });

      const negRes = db
        .prepare(
          `INSERT INTO negotiation_requests (trip_request_id, notification_id, action_type, requester_user_id, holder_user_id, passenger_nickname, destination, message, status)
           VALUES (?, ?, 'HITCHHIKE', ?, ?, ?, ?, ?, 'PENDING')`
        )
        .run(tripId, notifId, user.id, trip.requester_id, paxSummary, destination || trip.destination, noteText || null);
      const negotiationId = Number(negRes.lastInsertRowid);

      try {
        liveEvents.broadcast({
          type: 'NOTIFICATION',
          userId: trip.requester_id,
          data: {
            id: notifId,
            user_id: trip.requester_id,
            trigger_type: 'NEGOTIATE_HITCHHIKE_REQUEST',
            title,
            body,
            related_entity_type: 'TRIP_REQUEST',
            related_entity_id: tripId,
            is_read: 0,
            created_at: new Date().toISOString(),
            negotiation_id: negotiationId,
            negotiation_action_type: 'HITCHHIKE',
            negotiation_status: 'PENDING',
            negotiation_requester_id: user.id,
            negotiation_requester_name: user.nickname,
            negotiation_passenger_nickname: paxSummary,
            negotiation_destination: destination || trip.destination,
            negotiation_message: noteText || null,
          },
        });
      } catch {}

      recordAudit(db, user, 'TRIP_HITCHHIKE_REQUESTED', 'TRIP_REQUEST', tripId, null, {
        negotiation_id: negotiationId,
        requester_id: user.id,
        requester_name: user.nickname,
        passenger_nickname: paxSummary,
        passengers: newPax,
        destination: destination || trip.destination,
        message: noteText,
      });

      res.status(201).json({
        ok: true,
        action_type: 'HITCHHIKE',
        notificationId: notifId,
        negotiationId,
        passengers: newPax,
        message: `Hitchhike request sent to ${trip.requester_name} (${trip.department_name}).`,
      });
      return;
    }

    // REQUEST_CANCEL negotiation — capture requester's passenger list (limited by car seats) for automatic swap on accept
    const existingPendingCancel = db
      .prepare(
        `SELECT id FROM negotiation_requests
         WHERE trip_request_id = ? AND requester_user_id = ? AND action_type = 'REQUEST_CANCEL' AND status = 'PENDING'
         LIMIT 1`
      )
      .get(tripId, user.id);
    if (existingPendingCancel) {
      res.status(409).json({ error: 'You already have a pending cancellation/switch request for this booking.' });
      return;
    }

    const cancelPaxList = parseRequestedPax(req.body?.passengers, passenger_nickname, user.nickname);
    const maxSeatsForCancel = Number(trip.seats || 5);
    if (cancelPaxList.length > maxSeatsForCancel) {
      res.status(400).json({ error: `Vehicle ${trip.registration_plate} supports at most ${maxSeatsForCancel} passenger(s).` });
      return;
    }
    const cancelPaxSummary = cancelPaxList.join(', ');
    const nextOrigin = String(origin || '').trim() || String(trip.origin || '');
    const nextDestination = String(destination || '').trim() || String(trip.destination || '');
    const nextPurpose = String(purpose || '').trim() || null;
    const isDifferentLocation =
      nextOrigin.toLowerCase() !== String(trip.origin || '').trim().toLowerCase() ||
      nextDestination.toLowerCase() !== String(trip.destination || '').trim().toLowerCase();

    const title = `Schedule Negotiation (Cancel & Transfer): ${user.nickname} (${reqDeptName})`;
    const body = `${user.nickname} (${reqDeptName}) is requesting to transfer your booking slot on ${trip.registration_plate} (${trip.make} ${trip.model}, ${new Date(trip.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(trip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).\nNew Route (${isDifferentLocation ? 'Different Location' : 'Same Location'}): ${nextOrigin} → ${nextDestination}.\nNew Passenger(s) (${cancelPaxList.length}): ${cancelPaxSummary}.${nextPurpose ? `\nPurpose: ${nextPurpose}.` : ''}${noteText ? `\nMessage: "${noteText}"` : ''}\nAccept to cancel your booking and transfer this timeslot to them (their booking will require fresh Fleet Manager & Head of WS approval), or reject to keep your booking.`;

    const notifId = sendUserNotification(db, {
      userId: trip.requester_id,
      triggerType: 'NEGOTIATE_CANCEL_REQUEST',
      title,
      body,
      relatedEntityType: 'TRIP_REQUEST',
      relatedEntityId: tripId,
      skipSseBroadcast: true,
    });

    const negRes = db
      .prepare(
        `INSERT INTO negotiation_requests (trip_request_id, notification_id, action_type, requester_user_id, holder_user_id, passenger_nickname, origin, destination, purpose, message, status)
         VALUES (?, ?, 'REQUEST_CANCEL', ?, ?, ?, ?, ?, ?, ?, 'PENDING')`
      )
      .run(tripId, notifId, user.id, trip.requester_id, cancelPaxSummary, nextOrigin, nextDestination, nextPurpose, noteText || null);
    const negotiationId = Number(negRes.lastInsertRowid);

    try {
      liveEvents.broadcast({
        type: 'NOTIFICATION',
        userId: trip.requester_id,
        data: {
          id: notifId,
          user_id: trip.requester_id,
          trigger_type: 'NEGOTIATE_CANCEL_REQUEST',
          title,
          body,
          related_entity_type: 'TRIP_REQUEST',
          related_entity_id: tripId,
          is_read: 0,
          created_at: new Date().toISOString(),
          negotiation_id: negotiationId,
          negotiation_action_type: 'REQUEST_CANCEL',
          negotiation_status: 'PENDING',
          negotiation_requester_id: user.id,
          negotiation_requester_name: user.nickname,
          negotiation_passenger_nickname: cancelPaxSummary,
          negotiation_origin: nextOrigin,
          negotiation_destination: nextDestination,
          negotiation_purpose: nextPurpose,
          negotiation_message: noteText || null,
          negotiation_vehicle_plate: trip.registration_plate,
          negotiation_vehicle_name: `${trip.make} ${trip.model}`.trim(),
          negotiation_start_time: trip.start_time,
          negotiation_end_time: trip.end_time,
        },
      });
    } catch {}

    recordAudit(db, user, 'TRIP_CANCEL_NEGOTIATION_REQUESTED', 'TRIP_REQUEST', tripId, null, {
      negotiation_id: negotiationId,
      requester_id: user.id,
      requester_name: user.nickname,
      origin: nextOrigin,
      destination: nextDestination,
      purpose: nextPurpose,
      passengers: cancelPaxList,
      message: noteText,
    });

    res.status(201).json({
      ok: true,
      action_type: 'REQUEST_CANCEL',
      notificationId: notifId,
      negotiationId,
      origin: nextOrigin,
      destination: nextDestination,
      purpose: nextPurpose,
      passengers: cancelPaxList,
      message: `Cancellation & transfer request sent to ${trip.requester_name} (${trip.department_name}).`,
    });
  };

  app.post('/api/trips/:id/negotiate', requireAuth, (req: Request, res: Response) => {
    handleNegotiateTripRequest(req, res, Number(req.params.id));
  });

  app.post(['/api/trips/negotiate', '/api/negotiations'], requireAuth, (req: Request, res: Response) => {
    handleNegotiateTripRequest(req, res, Number(req.body?.trip_id || req.body?.tripId || 0));
  });

  app.post('/api/bookings/:id/negotiate', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const bookingId = Number(req.params.id);
    const bk = db.prepare('SELECT id, trip_request_id FROM bookings WHERE id = ?').get(bookingId) as
      | { id: number; trip_request_id: number | null }
      | undefined;
    handleNegotiateTripRequest(req, res, bk?.trip_request_id ? Number(bk.trip_request_id) : -100000 - bookingId);
  });

  const isLegacyCancelNotificationRow = (n: any) => {
    const trig = String(n?.trigger_type || '').toUpperCase();
    const title = String(n?.title || '');
    return (
      trig === 'NEGOTIATE_CANCEL_REQUEST' ||
      trig === 'CANCEL_NEGOTIATION_REQUEST' ||
      /schedule negotiation.*(cancel|transfer)/i.test(title)
    );
  };

  const isLegacyHitchhikeNotificationRow = (n: any) => {
    const trig = String(n?.trigger_type || '').toUpperCase();
    const title = String(n?.title || '');
    return (
      trig === 'NEGOTIATE_HITCHHIKE_REQUEST' ||
      trig === 'HITCHHIKE_REQUEST' ||
      /schedule negotiation.*hitchhike/i.test(title)
    );
  };

  const hydrateLegacyNegotiationNotification = (db: ReturnType<typeof getDb>, n: any, holderUserId: number) => {
    if (!n || n.negotiation_id) return n;
    const isCancelNotif = isLegacyCancelNotificationRow(n);
    const isHitchhikeNotif = isLegacyHitchhikeNotificationRow(n);
    if (!isCancelNotif && !isHitchhikeNotif) return n;

    const expectedType = isCancelNotif ? 'REQUEST_CANCEL' : 'HITCHHIKE';
    const deliveryUpper = String(n.delivery_status || '').toUpperCase();
    if (deliveryUpper === 'ACCEPTED' || deliveryUpper === 'REJECTED') {
      return {
        ...n,
        negotiation_action_type: n.negotiation_action_type || expectedType,
        negotiation_status: deliveryUpper,
      };
    }

    // 1. Try linking to an existing negotiation_requests row for the same trip & holder
    if (n.related_entity_id) {
      const fb = db
        .prepare(
          `SELECT nr.*, u.nickname as requester_name
           FROM negotiation_requests nr
           LEFT JOIN users u ON u.id = nr.requester_user_id
           WHERE nr.trip_request_id = ? AND nr.holder_user_id = ? AND nr.action_type = ?
           ORDER BY CASE WHEN nr.status = 'PENDING' THEN 0 ELSE 1 END, nr.id DESC
           LIMIT 1`
        )
        .get(Number(n.related_entity_id), Number(holderUserId), expectedType) as any;
      if (fb) {
        if (!fb.notification_id && n.id) {
          try {
            db.prepare('UPDATE negotiation_requests SET notification_id = ? WHERE id = ? AND notification_id IS NULL').run(
              Number(n.id),
              Number(fb.id)
            );
          } catch {}
        }
        return {
          ...n,
          negotiation_id: fb.id,
          negotiation_action_type: fb.action_type,
          negotiation_status: fb.status,
          negotiation_requester_id: fb.requester_user_id,
          negotiation_requester_name: fb.requester_name,
          negotiation_passenger_nickname: fb.passenger_nickname,
          negotiation_origin: fb.origin,
          negotiation_destination: fb.destination,
          negotiation_purpose: fb.purpose,
          negotiation_message: fb.message,
          negotiation_transferred_trip_id: fb.transferred_trip_id,
        };
      }
    }

    if (!isCancelNotif) return n;

    // 2. Auto-hydrate legacy unlinked Cancel/Transfer notification (e.g., created by an older build without negotiation_requests)
    let trip: any = null;
    if (n.related_entity_id) {
      trip = db
        .prepare(
          `SELECT tr.*, v.registration_plate, v.make, v.model
           FROM trip_requests tr
           LEFT JOIN vehicles v ON v.id = tr.vehicle_id
           WHERE tr.id = ?`
        )
        .get(Number(n.related_entity_id));
    }
    if (!trip) {
      const plateMatch = String(n.body || '').match(/\bon\s+([A-Z]{1,2}\s+\d{1,4}\s+[A-Z]{1,3})\b/i);
      if (plateMatch?.[1]) {
        trip = db
          .prepare(
            `SELECT tr.*, v.registration_plate, v.make, v.model
             FROM trip_requests tr
             JOIN vehicles v ON v.id = tr.vehicle_id
             WHERE tr.requester_id = ?
               AND LOWER(TRIM(v.registration_plate)) = LOWER(TRIM(?))
               AND tr.status IN ('PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS')
             ORDER BY tr.id DESC
             LIMIT 1`
          )
          .get(Number(holderUserId), plateMatch[1]);
      }
    }

    if (!trip || !['PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS'].includes(String(trip.status || ''))) {
      return {
        ...n,
        negotiation_action_type: 'REQUEST_CANCEL',
        negotiation_status: 'REJECTED',
      };
    }

    const titleText = String(n.title || '');
    const bodyText = String(n.body || '');
    const stripTrailingGroup = (raw: string) => raw.replace(/\s*\([^()]*\)\s*$/, '').trim();

    let candidateName = '';
    const colonIdx = titleText.indexOf(':');
    if (colonIdx >= 0) {
      candidateName = stripTrailingGroup(titleText.slice(colonIdx + 1).trim());
    }
    if (!candidateName) {
      const bodyReqMatch = bodyText.match(/^(.+?)\s+is requesting to\s+/i);
      if (bodyReqMatch?.[1]) {
        candidateName = stripTrailingGroup(bodyReqMatch[1].trim());
      }
    }

    let requesterUser: any = null;
    if (candidateName) {
      requesterUser =
        db
          .prepare(
            `SELECT id, nickname, group_username
             FROM users
             WHERE id != ?
               AND (LOWER(TRIM(nickname)) = LOWER(TRIM(?)) OR LOWER(TRIM(group_username)) = LOWER(TRIM(?)))
             ORDER BY id ASC
             LIMIT 1`
          )
          .get(Number(holderUserId), candidateName, candidateName) ||
        db
          .prepare(
            `SELECT id, nickname, group_username
             FROM users
             WHERE id != ?
               AND LOWER(TRIM(nickname)) LIKE LOWER(?)
             ORDER BY id ASC
             LIMIT 1`
          )
          .get(Number(holderUserId), `${candidateName}%`) ||
        db
          .prepare(
            `SELECT id, nickname, group_username
             FROM users
             WHERE id != ?
               AND LOWER(TRIM(nickname)) LIKE LOWER(?)
             ORDER BY id ASC
             LIMIT 1`
          )
          .get(Number(holderUserId), `%${candidateName}%`);
    }
    if (!requesterUser) {
      const auditActor = db
        .prepare(
          `SELECT u.id, u.nickname, u.group_username
           FROM audit_logs al
           JOIN users u ON u.id = al.actor_user_id
           WHERE al.entity_type = 'TRIP_REQUEST'
             AND al.entity_id = ?
             AND al.actor_user_id != ?
             AND (al.action LIKE '%CANCEL%' OR al.action LIKE '%NEGOTIAT%')
           ORDER BY al.id DESC
           LIMIT 1`
        )
        .get(Number(trip.id), Number(holderUserId));
      if (auditActor) requesterUser = auditActor;
    }

    const routeMatch = bodyText.match(/New Route\s*\([^)]*\):\s*([^\n→]+?)\s*→\s*([^\n.]+)/i);
    const legacyDestMatch = bodyText.match(/\bto\s+"([^"]+)"/i);
    const paxMatch = bodyText.match(/New Passenger(?:\(s\))?\s*\(\d+\):\s*([^\n.]+)/i);
    const msgMatch = bodyText.match(/(?:Reason\s*\/\s*Message|Message):\s*"([^"]+)"/i);

    const parsedOrigin = String(routeMatch?.[1] || '').trim() || String(trip.origin || '');
    const parsedDest = String(routeMatch?.[2] || legacyDestMatch?.[1] || '').trim() || String(trip.destination || '');
    const parsedPax = String(paxMatch?.[1] || '').trim() || String(requesterUser?.nickname || candidateName || 'Colleague').trim();
    const parsedMessage = msgMatch?.[1] ? String(msgMatch[1]).trim() : null;
    const vehicleName = `${trip.make || ''} ${trip.model || ''}`.trim();

    if (requesterUser) {
      try {
        const ins = db
          .prepare(
            `INSERT INTO negotiation_requests (
               trip_request_id, notification_id, action_type, requester_user_id, holder_user_id,
               passenger_nickname, origin, destination, purpose, message, status
             ) VALUES (?, ?, 'REQUEST_CANCEL', ?, ?, ?, ?, ?, NULL, ?, 'PENDING')`
          )
          .run(
            Number(trip.id),
            n.id ? Number(n.id) : null,
            Number(requesterUser.id),
            Number(holderUserId),
            parsedPax,
            parsedOrigin,
            parsedDest,
            parsedMessage
          );
        const hydratedNegId = Number(ins.lastInsertRowid);
        return {
          ...n,
          related_entity_id: n.related_entity_id || Number(trip.id),
          negotiation_id: hydratedNegId,
          negotiation_action_type: 'REQUEST_CANCEL',
          negotiation_status: 'PENDING',
          negotiation_requester_id: Number(requesterUser.id),
          negotiation_requester_name: requesterUser.nickname,
          negotiation_passenger_nickname: parsedPax,
          negotiation_origin: parsedOrigin,
          negotiation_destination: parsedDest,
          negotiation_purpose: null,
          negotiation_message: parsedMessage,
          negotiation_original_origin: n.negotiation_original_origin || trip.origin,
          negotiation_original_destination: n.negotiation_original_destination || trip.destination,
          negotiation_start_time: n.negotiation_start_time || trip.start_time,
          negotiation_end_time: n.negotiation_end_time || trip.end_time,
          negotiation_vehicle_plate: n.negotiation_vehicle_plate || trip.registration_plate,
          negotiation_vehicle_name: n.negotiation_vehicle_name || vehicleName,
        };
      } catch {}
    }

    return {
      ...n,
      related_entity_id: n.related_entity_id || Number(trip.id),
      negotiation_action_type: 'REQUEST_CANCEL',
      negotiation_status: 'PENDING',
      negotiation_requester_name: candidateName || 'Requester',
      negotiation_passenger_nickname: parsedPax,
      negotiation_origin: parsedOrigin,
      negotiation_destination: parsedDest,
      negotiation_message: parsedMessage,
      negotiation_original_origin: n.negotiation_original_origin || trip.origin,
      negotiation_original_destination: n.negotiation_original_destination || trip.destination,
      negotiation_start_time: n.negotiation_start_time || trip.start_time,
      negotiation_end_time: n.negotiation_end_time || trip.end_time,
      negotiation_vehicle_plate: n.negotiation_vehicle_plate || trip.registration_plate,
      negotiation_vehicle_name: n.negotiation_vehicle_name || vehicleName,
    };
  };

  // Shared executor for accepting or rejecting a negotiation request (used by both /api/negotiations/:id/respond and /api/notifications/:id/respond-negotiation)
  const executeNegotiationResponse = (
    req: Request,
    res: Response,
    negId: number,
    decisionNorm: string,
    reasonText: string
  ) => {
    const db = getDb();
    const user = req.user!;

    if (!['ACCEPT', 'REJECT'].includes(decisionNorm)) {
      res.status(400).json({ error: 'decision must be ACCEPT or REJECT' });
      return;
    }

    const nr = db
      .prepare(
        `SELECT nr.*, req_u.nickname as requester_name, req_u.department_id as requester_department_id
         FROM negotiation_requests nr
         JOIN users req_u ON req_u.id = nr.requester_user_id
         WHERE nr.id = ?`
      )
      .get(negId) as any;

    if (!nr) {
      res.status(404).json({ error: 'Negotiation request not found' });
      return;
    }

    if (Number(nr.holder_user_id) !== Number(user.id) && !isPrivilegedRole(user)) {
      res.status(403).json({ error: 'Only the current booking holder or an Admin can respond to this request' });
      return;
    }

    if (nr.status !== 'PENDING') {
      res.status(409).json({ error: `This request has already been ${String(nr.status).toLowerCase()}` });
      return;
    }

    const trip = db
      .prepare(
        `SELECT tr.*, v.seats, v.registration_plate, v.make, v.model
         FROM trip_requests tr
         JOIN vehicles v ON v.id = tr.vehicle_id
         WHERE tr.id = ?`
      )
      .get(nr.trip_request_id) as any;

    if (!trip) {
      res.status(404).json({ error: 'Associated booking not found' });
      return;
    }

    if (nr.notification_id) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(nr.notification_id);
    }

    // ---- REJECT (either HITCHHIKE or REQUEST_CANCEL) ----
    if (decisionNorm === 'REJECT') {
      const claimRej = db
        .prepare(
          `UPDATE negotiation_requests
           SET status = 'REJECTED', decided_by = ?, decided_at = datetime('now')
           WHERE id = ? AND status = 'PENDING'`
        )
        .run(user.id, negId);
      if (claimRej.changes === 0) {
        res.status(409).json({ error: 'This request has already been processed' });
        return;
      }

      const isHitchhike = nr.action_type === 'HITCHHIKE';
      sendUserNotification(db, {
        userId: Number(nr.requester_user_id),
        triggerType: isHitchhike ? 'HITCHHIKE_REJECTED' : 'CANCEL_NEGOTIATION_REJECTED',
        title: isHitchhike ? 'Hitchhike Request Declined' : 'Cancellation Request Declined',
        body: isHitchhike
          ? `${user.nickname} declined your hitchhike request on ${trip.registration_plate} (${trip.make} ${trip.model}) to "${trip.destination}".${reasonText ? ` Note: "${reasonText}"` : ''}`
          : `${user.nickname} declined your cancellation/transfer request for ${trip.registration_plate} (${trip.make} ${trip.model}) to "${trip.destination}". Their booking remains active.${reasonText ? ` Note: "${reasonText}"` : ''}`,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: Number(trip.id),
      });

      recordAudit(
        db,
        user,
        isHitchhike ? 'TRIP_HITCHHIKE_REJECTED' : 'TRIP_CANCEL_NEGOTIATION_REJECTED',
        'TRIP_REQUEST',
        Number(trip.id),
        { negotiation_id: negId, status: 'PENDING' },
        { status: 'REJECTED', reason: reasonText || null }
      );

      res.json({ ok: true, status: 'REJECTED', negotiationId: negId, action_type: nr.action_type });
      return;
    }

    // ---- ACCEPT ----
    if (!['PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS'].includes(trip.status)) {
      res.status(400).json({ error: 'This booking is no longer active on the schedule' });
      return;
    }

    // ACCEPT HITCHHIKE -> atomically claim PENDING request and add all requested passengers as separate numbered entries
    if (nr.action_type === 'HITCHHIKE') {
      const rawExisting: string[] = [];
      if (trip.passengers_json) {
        try {
          const parsed = JSON.parse(trip.passengers_json);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              const raw = String(p?.nickname || p?.name || p || '').trim();
              for (const part of raw.split(/[,\n]+/)) {
                const clean = part.replace(/^\d+\.\s*/, '').trim();
                if (clean) rawExisting.push(clean);
              }
            }
          }
        } catch {}
      }
      if (rawExisting.length === 0 && trip.passenger_nickname) {
        for (const part of String(trip.passenger_nickname).split(/[,\n]+/)) {
          const clean = part.replace(/^\d+\.\s*/, '').trim();
          if (clean) rawExisting.push(clean);
        }
      }

      const currentList: Array<{ id: number; nickname: string }> = [];
      const seenLower = new Set<string>();
      for (const name of rawExisting) {
        const key = name.toLowerCase();
        if (!seenLower.has(key)) {
          seenLower.add(key);
          currentList.push({ id: currentList.length + 1, nickname: name });
        }
      }

      const requestedNames = String(nr.passenger_nickname || nr.requester_name || 'Colleague')
        .split(/[,\n]+/)
        .map((s) => s.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);

      const toAdd: string[] = [];
      for (const name of requestedNames) {
        const key = name.toLowerCase();
        if (!seenLower.has(key)) {
          seenLower.add(key);
          toAdd.push(name);
        }
      }

      const maxSeats = Number(trip.seats || 5);
      if (currentList.length + toAdd.length > maxSeats) {
        const remaining = Math.max(0, maxSeats - currentList.length);
        res.status(400).json({ error: `Vehicle ${trip.registration_plate} only has ${remaining} seat(s) remaining (${maxSeats} seats max)` });
        return;
      }

      for (const name of toAdd) {
        currentList.push({ id: currentList.length + 1, nickname: name });
      }
      const nextPaxCount = currentList.length;
      const nextPaxJson = JSON.stringify(currentList);
      const nextPaxNickname = currentList.map((p, idx) => `${idx + 1}. ${p.nickname}`).join(', ');

      const claimed = runInTransaction(db, () => {
        const claim = db
          .prepare(
            `UPDATE negotiation_requests
             SET status = 'ACCEPTED', decided_by = ?, decided_at = datetime('now')
             WHERE id = ? AND status = 'PENDING'`
          )
          .run(user.id, negId);
        if (claim.changes === 0) return false;

        db.prepare(
          `UPDATE trip_requests
           SET passenger_count = ?, passengers_json = ?, passenger_nickname = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).run(nextPaxCount, nextPaxJson, nextPaxNickname, trip.id);
        return true;
      });

      if (!claimed) {
        res.status(409).json({ error: 'This hitchhike request has already been processed' });
        return;
      }

      const addedLabel = toAdd.length > 0 ? toAdd.join(', ') : requestedNames.join(', ');
      sendUserNotification(db, {
        userId: Number(nr.requester_user_id),
        triggerType: 'HITCHHIKE_ACCEPTED',
        title: 'Hitchhike Request Accepted!',
        body: `${user.nickname} accepted your hitchhike request on ${trip.registration_plate} (${trip.make} ${trip.model}) to "${trip.destination}". Added to passenger list: ${addedLabel}.`,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: Number(trip.id),
      });

      recordAudit(db, user, 'TRIP_HITCHHIKE_ACCEPTED', 'TRIP_REQUEST', Number(trip.id), null, {
        negotiation_id: negId,
        added_passengers: toAdd,
        passenger_count: nextPaxCount,
      });

      const enriched = broadcastTripUpdate(db, Number(trip.id), 'TRIP_UPDATED');
      res.json({ ok: true, status: 'ACCEPTED', negotiationId: negId, action_type: 'HITCHHIKE', addedPassengers: toAdd, trip: enriched });
      return;
    }

    // ACCEPT REQUEST_CANCEL -> cancel original booking & transfer slot to requester with their swapped passenger list (PENDING_APPROVAL)
    const transferResult = runInTransaction(db, () => {
      const claim = db
        .prepare(
          `UPDATE negotiation_requests
           SET status = 'ACCEPTED', decided_by = ?, decided_at = datetime('now')
           WHERE id = ? AND status = 'PENDING'`
        )
        .run(user.id, negId);
      if (claim.changes === 0) {
        return null;
      }

      const activeAssignment = db
        .prepare('SELECT driver_profile_id FROM assignments WHERE trip_request_id = ? AND is_current = 1')
        .get(trip.id) as { driver_profile_id: number } | undefined;

      // 1. Cancel original booking
      const cancelReason = `Cancelled and transferred slot to ${nr.requester_name} via negotiation #${negId}`;
      db.prepare("UPDATE trip_requests SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?").run(trip.id);
      db.prepare("UPDATE bookings SET status = 'CANCELLED', cancellation_reason = ?, updated_at = datetime('now') WHERE trip_request_id = ? AND status != 'CANCELLED'").run(cancelReason, trip.id);
      db.prepare('UPDATE assignments SET is_current = 0 WHERE trip_request_id = ? AND is_current = 1').run(trip.id);

      // 2. Build swapped passenger list strictly from the requesting user's passenger(s)
      const maxSeats = Number(trip.seats || 5);
      const rawSwapped = String(nr.passenger_nickname || nr.requester_name || 'Employee')
        .split(/[,\n]+/)
        .map((s) => s.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);
      const swappedSeen = new Set<string>();
      const swappedList: Array<{ id: number; nickname: string }> = [];
      for (const name of rawSwapped) {
        const k = name.toLowerCase();
        if (!swappedSeen.has(k) && swappedList.length < maxSeats) {
          swappedSeen.add(k);
          swappedList.push({ id: swappedList.length + 1, nickname: name });
        }
      }
      if (swappedList.length === 0) {
        swappedList.push({ id: 1, nickname: String(nr.requester_name || 'Employee').trim() });
      }
      const transferredPaxJson = JSON.stringify(swappedList);
      const transferredPaxNickname = swappedList.map((p, idx) => `${idx + 1}. ${p.nickname}`).join(', ');
      const transferredPurpose = String(nr.purpose || '').trim()
        ? String(nr.purpose).trim()
        : nr.message
        ? `Transferred booking: ${nr.message}`
        : `Transferred booking (${trip.purpose || 'Operational Trip'})`;
      const transferredOrigin = String(nr.origin || '').trim() || String(trip.origin || '');
      const transferredDest = String(nr.destination || '').trim() || String(trip.destination || '');

      const insTrip = db
        .prepare(
          `INSERT INTO trip_requests (
             requester_id, department_id, vehicle_id, preferred_driver_id,
             passenger_nickname, passengers_json, purpose, origin, destination,
             start_time, end_time, passenger_count, status,
             reservation_type, return_pickup_time, is_urgent, urgent_reason
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?, ?)`
        )
        .run(
          nr.requester_user_id,
          nr.requester_department_id,
          trip.vehicle_id,
          trip.preferred_driver_id || activeAssignment?.driver_profile_id || null,
          transferredPaxNickname,
          transferredPaxJson,
          transferredPurpose,
          transferredOrigin,
          transferredDest,
          trip.start_time,
          trip.end_time,
          swappedList.length,
          trip.reservation_type || 'ONE_WAY',
          trip.return_pickup_time || null,
          Number(trip.is_urgent || 0),
          trip.urgent_reason || null
        );
      const newTripId = Number(insTrip.lastInsertRowid);

      // Immediately lock the vehicle schedule for the transferred booking (Pending Approval — requires fresh FM & HWS approval)
      const insBooking = db
        .prepare(
          `INSERT INTO bookings (vehicle_id, trip_request_id, booked_by, purpose, start_time, end_time, status)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')`
        )
        .run(trip.vehicle_id, newTripId, nr.requester_user_id, transferredPurpose, trip.start_time, trip.end_time);
      const newBookingId = Number(insBooking.lastInsertRowid);

      const carryDriverId = activeAssignment?.driver_profile_id || trip.preferred_driver_id || null;
      if (carryDriverId) {
        db.prepare(
          `INSERT INTO assignments (trip_request_id, booking_id, vehicle_id, driver_profile_id, assigned_by, reason, effective_start, effective_end, is_current, acknowledged_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`
        ).run(
          newTripId,
          newBookingId,
          trip.vehicle_id,
          carryDriverId,
          user.id,
          `Transferred slot from booking #${trip.id} via negotiation #${negId} (Pending FM & HWS Approval)`,
          trip.start_time,
          trip.end_time
        );
      }

      db.prepare('UPDATE negotiation_requests SET transferred_trip_id = ? WHERE id = ?').run(newTripId, negId);

      // Mark any other pending negotiation requests on the cancelled original trip as REJECTED
      db.prepare(
        `UPDATE negotiation_requests
         SET status = 'REJECTED', decided_by = ?, decided_at = datetime('now')
         WHERE trip_request_id = ? AND id != ? AND status = 'PENDING'`
      ).run(user.id, trip.id, negId);

      return {
        newTripId,
        swappedPassengers: swappedList.map((p) => p.nickname),
        transferredOrigin,
        transferredDest,
        transferredPurpose,
      };
    });

    if (!transferResult) {
      res.status(409).json({ error: 'This cancellation request has already been processed' });
      return;
    }

    sendUserNotification(db, {
      userId: Number(nr.requester_user_id),
      triggerType: 'CANCEL_NEGOTIATION_ACCEPTED',
      title: 'Slot Transferred — Awaiting Approval',
      body: `${user.nickname} accepted your cancellation & transfer request! Car ${trip.registration_plate} (${trip.make} ${trip.model}) slot has been transferred to you as Booking #${transferResult.newTripId}.\nRoute: ${transferResult.transferredOrigin} → ${transferResult.transferredDest}\nPassengers: ${transferResult.swappedPassengers.join(', ')}\nStatus: Pending fresh approval from Fleet Manager (FM) & Head of WS (HWS).`,
      relatedEntityType: 'TRIP_REQUEST',
      relatedEntityId: transferResult.newTripId,
    });

    notifyAdmins(db, {
      triggerType: 'TRIP_TRANSFERRED_NEEDS_APPROVAL',
      title: 'Transferred Booking Requires Approval',
      body: `${user.nickname} cancelled Booking #${trip.id} (${trip.registration_plate}) and transferred the timeslot to ${nr.requester_name} as Booking #${transferResult.newTripId}.\nNew Route: ${transferResult.transferredOrigin} → ${transferResult.transferredDest}\nPassengers: ${transferResult.swappedPassengers.join(', ')}\nAction Required: Fresh Stage 1 (Fleet Operation PIC) & Stage 2 (Head of WS) approval is required.`,
      relatedEntityType: 'TRIP_REQUEST',
      relatedEntityId: transferResult.newTripId,
    });

    recordAudit(db, user, 'TRIP_CANCEL_NEGOTIATION_ACCEPTED', 'TRIP_REQUEST', Number(trip.id), { status: trip.status }, {
      negotiation_id: negId,
      status: 'CANCELLED',
      transferred_to_user_id: nr.requester_user_id,
      transferred_trip_id: transferResult.newTripId,
      transferred_origin: transferResult.transferredOrigin,
      transferred_destination: transferResult.transferredDest,
      swapped_passengers: transferResult.swappedPassengers,
      requires_fresh_approval: true,
    });

    const cancelledTrip = broadcastTripUpdate(db, Number(trip.id), 'TRIP_UPDATED', { status: 'CANCELLED' });
    const transferredTrip = broadcastTripUpdate(db, transferResult.newTripId, 'TRIP_CREATED');
    res.json({
      ok: true,
      status: 'ACCEPTED',
      negotiationId: negId,
      action_type: 'REQUEST_CANCEL',
      cancelledTrip,
      transferredTrip,
      transferredTripId: transferResult.newTripId,
      requiresApproval: true,
    });
  };

  // Accept or Reject a Hitchhike or Cancellation/Slot-Transfer negotiation request from Inbox
  app.post('/api/negotiations/:id/respond', requireAuth, (req: Request, res: Response) => {
    const negId = Number(req.params.id);
    const decisionNorm = String(req.body?.decision || '').trim().toUpperCase();
    const reasonText = req.body?.reason ? String(req.body.reason).trim() : '';
    executeNegotiationResponse(req, res, negId, decisionNorm, reasonText);
  });

  // Fallback handler allowing a booking holder to accept or reject a negotiation directly by notification ID (auto-hydrating legacy notifications)
  const handleRespondByNotificationId = (req: Request, res: Response, notifIdInput: number) => {
    const db = getDb();
    const user = req.user!;
    const notifId = Number(notifIdInput);
    const decisionNorm = String(req.body?.decision || '').trim().toUpperCase();
    const reasonText = req.body?.reason ? String(req.body.reason).trim() : '';

    if (!['ACCEPT', 'REJECT'].includes(decisionNorm)) {
      res.status(400).json({ error: 'decision must be ACCEPT or REJECT' });
      return;
    }

    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId) as any;
    if (!notif) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    if (Number(notif.user_id) !== Number(user.id) && !isPrivilegedRole(user)) {
      res.status(403).json({ error: 'You are not allowed to respond to this notification' });
      return;
    }

    const existingNr = db
      .prepare('SELECT id FROM negotiation_requests WHERE notification_id = ? ORDER BY id DESC LIMIT 1')
      .get(notifId) as { id: number } | undefined;

    if (existingNr?.id) {
      executeNegotiationResponse(req, res, Number(existingNr.id), decisionNorm, reasonText);
      return;
    }

    const hydrated = hydrateLegacyNegotiationNotification(db, notif, Number(notif.user_id));
    if (hydrated?.negotiation_id) {
      executeNegotiationResponse(req, res, Number(hydrated.negotiation_id), decisionNorm, reasonText);
      return;
    }

    if (decisionNorm === 'REJECT') {
      db.prepare("UPDATE notifications SET is_read = 1, delivery_status = 'REJECTED' WHERE id = ?").run(notifId);
      res.json({ ok: true, status: 'REJECTED', notificationId: notifId });
      return;
    }

    res.status(400).json({
      error: 'Unable to match the requester account for this legacy notification. Please cancel manually or reject this request.',
    });
  };

  app.post(['/api/notifications/:id/respond-negotiation', '/api/notifications/:id/respond'], requireAuth, (req: Request, res: Response) => {
    handleRespondByNotificationId(req, res, Number(req.params.id));
  });

  app.post('/api/negotiations/respond', requireAuth, (req: Request, res: Response) => {
    const negId = Number(req.body?.negotiation_id || 0);
    const notifId = Number(req.body?.notification_id || 0);
    const decisionNorm = String(req.body?.decision || '').trim().toUpperCase();
    const reasonText = req.body?.reason ? String(req.body.reason).trim() : '';
    if (negId > 0) {
      executeNegotiationResponse(req, res, negId, decisionNorm, reasonText);
      return;
    }
    if (notifId > 0) {
      handleRespondByNotificationId(req, res, notifId);
      return;
    }
    res.status(400).json({ error: 'negotiation_id or notification_id is required' });
  });

  // Allow current booking holder (or Admin) to approve a hitchhiker and add them to the trip's passenger list (deduplicated & seat-limited)
  app.post('/api/trips/:id/hitchhike-accept', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const tripId = Number(req.params.id);
    const { passenger_nickname, passengers, hitchhiker_user_id, notification_id } = req.body ?? {};

    const requestedNames: string[] = [];
    if (Array.isArray(passengers)) {
      for (const p of passengers) {
        const raw = String(typeof p === 'object' && p !== null ? (p.nickname || p.name || '') : p || '').trim();
        for (const part of raw.split(/[,\n]+/)) {
          const n = part.replace(/^\d+\.\s*/, '').trim();
          if (n) requestedNames.push(n);
        }
      }
    }
    if (requestedNames.length === 0 && passenger_nickname) {
      for (const part of String(passenger_nickname).split(/[,\n]+/)) {
        const n = part.replace(/^\d+\.\s*/, '').trim();
        if (n) requestedNames.push(n);
      }
    }

    if (requestedNames.length === 0) {
      res.status(400).json({ error: 'passenger_nickname is required to add hitchhiker' });
      return;
    }

    const trip = db
      .prepare(
        `SELECT tr.*, v.seats, v.registration_plate
         FROM trip_requests tr
         JOIN vehicles v ON v.id = tr.vehicle_id
         WHERE tr.id = ?`
      )
      .get(tripId) as any;

    if (!trip) {
      res.status(404).json({ error: 'Trip request not found' });
      return;
    }

    if (trip.requester_id !== user.id && !isPrivilegedRole(user)) {
      res.status(403).json({ error: 'Only the current booking holder or an Admin can accept a hitchhike request' });
      return;
    }

    const rawExisting: string[] = [];
    if (trip.passengers_json) {
      try {
        const parsed = JSON.parse(trip.passengers_json);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            const raw = String(p?.nickname || p?.name || p || '').trim();
            for (const part of raw.split(/[,\n]+/)) {
              const clean = part.replace(/^\d+\.\s*/, '').trim();
              if (clean) rawExisting.push(clean);
            }
          }
        }
      } catch {}
    }
    if (rawExisting.length === 0 && trip.passenger_nickname) {
      for (const part of String(trip.passenger_nickname).split(/[,\n]+/)) {
        const clean = part.replace(/^\d+\.\s*/, '').trim();
        if (clean) rawExisting.push(clean);
      }
    }

    const currentList: Array<{ id: number; nickname: string }> = [];
    const existingKeys = new Set<string>();
    for (const name of rawExisting) {
      const key = name.toLowerCase();
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        currentList.push({ id: currentList.length + 1, nickname: name });
      }
    }

    const toAdd: string[] = [];
    for (const name of requestedNames) {
      const key = name.toLowerCase();
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        toAdd.push(name);
      }
    }

    if (toAdd.length === 0) {
      if (notification_id) {
        db.prepare("UPDATE notifications SET is_read = 1, delivery_status = 'ACCEPTED' WHERE id = ? AND user_id = ?").run(Number(notification_id), user.id);
      } else {
        db.prepare(
          "UPDATE notifications SET is_read = 1, delivery_status = 'ACCEPTED' WHERE user_id = ? AND related_entity_id = ? AND trigger_type IN ('NEGOTIATE_HITCHHIKE_REQUEST', 'HITCHHIKE_REQUEST')"
        ).run(user.id, tripId);
      }
      db.prepare(
        "UPDATE negotiation_requests SET status = 'ACCEPTED', decided_by = ?, decided_at = datetime('now') WHERE trip_request_id = ? AND action_type = 'HITCHHIKE' AND status = 'PENDING'"
      ).run(user.id, tripId);
      res.status(409).json({ error: 'Passenger is already in the passenger list (duplicate prevented)' });
      return;
    }

    const maxSeats = Number(trip.seats || 5);
    if (currentList.length + toAdd.length > maxSeats) {
      const remaining = Math.max(0, maxSeats - currentList.length);
      res.status(400).json({ error: `Vehicle ${trip.registration_plate} only has ${remaining} seat(s) remaining (${maxSeats} seats max)` });
      return;
    }

    for (const name of toAdd) {
      currentList.push({ id: currentList.length + 1, nickname: name });
    }
    const nextPaxCount = currentList.length;
    const nextPaxJson = JSON.stringify(currentList);
    const nextPaxNickname = currentList.map((p, idx) => `${idx + 1}. ${p.nickname}`).join(', ');

    db.prepare(
      `UPDATE trip_requests
       SET passenger_count = ?, passengers_json = ?, passenger_nickname = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(nextPaxCount, nextPaxJson, nextPaxNickname, tripId);

    if (notification_id) {
      db.prepare("UPDATE notifications SET is_read = 1, delivery_status = 'ACCEPTED' WHERE id = ? AND user_id = ?").run(Number(notification_id), user.id);
    } else {
      db.prepare(
        "UPDATE notifications SET is_read = 1, delivery_status = 'ACCEPTED' WHERE user_id = ? AND related_entity_id = ? AND trigger_type IN ('NEGOTIATE_HITCHHIKE_REQUEST', 'HITCHHIKE_REQUEST')"
      ).run(user.id, tripId);
    }
    db.prepare(
      "UPDATE negotiation_requests SET status = 'ACCEPTED', decided_by = ?, decided_at = datetime('now') WHERE trip_request_id = ? AND action_type = 'HITCHHIKE' AND status = 'PENDING'"
    ).run(user.id, tripId);

    const addedLabel = toAdd.join(', ');
    if (hitchhiker_user_id) {
      sendUserNotification(db, {
        userId: Number(hitchhiker_user_id),
        triggerType: 'HITCHHIKE_ACCEPTED',
        title: 'Hitchhike Ride Accepted!',
        body: `${user.nickname} accepted your hitchhike request on ${trip.registration_plate} to "${trip.destination}". Added to passenger list: ${addedLabel}.`,
        relatedEntityType: 'TRIP_REQUEST',
        relatedEntityId: tripId,
      });
    }

    recordAudit(db, user, 'TRIP_HITCHHIKE_ACCEPTED', 'TRIP_REQUEST', tripId, null, {
      added_passenger: addedLabel,
      added_passengers: toAdd,
      passenger_count: nextPaxCount,
    });

    const enriched = broadcastTripUpdate(db, tripId, 'TRIP_UPDATED');
    res.json({ ok: true, trip: enriched, addedPassengers: toAdd });
  });

  // Direct Bookings & Schedule endpoints (BKG-01 to BKG-11)
  // Item #10: Drivers (DRV) can only view their own schedule; Employees, Admins, FM, and HWS can view all schedules
  app.get('/api/bookings', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const canViewAllSchedules = ['ADM', 'FM', 'HWS'].includes(user.role);

    const baseQuery = `
      SELECT b.*, v.registration_plate, v.make, v.model, v.car_type, v.energy_type, v.seats,
             u.nickname as booked_by_name, u.group_username as requester_username, u.contact_number as requester_contact,
             COALESCE(d.name, 'Group') as department_name,
             tr.status as trip_status, tr.destination, tr.origin, tr.passenger_nickname, tr.passengers_json, tr.passenger_count,
             tr.reservation_type, tr.return_pickup_time,
             a.driver_profile_id, COALESCE(dp.full_name, def_dp.full_name, 'Pool Driver') as driver_name,
             COALESCE(dp.contact_number, def_dp.contact_number) as assigned_driver_phone
      FROM bookings b
      JOIN vehicles v ON v.id = b.vehicle_id
      JOIN users u ON u.id = b.booked_by
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN trip_requests tr ON tr.id = b.trip_request_id
      LEFT JOIN assignments a ON (a.booking_id = b.id OR (a.trip_request_id = b.trip_request_id AND b.trip_request_id IS NOT NULL)) AND a.is_current = 1
      LEFT JOIN driver_profiles dp ON dp.id = a.driver_profile_id
      LEFT JOIN driver_profiles def_dp ON def_dp.id = v.default_driver_id
    `;

    let bookings: unknown[];
    if (user.role === 'DRV') {
      bookings = db
        .prepare(`${baseQuery} WHERE a.driver_profile_id = ? ORDER BY b.start_time DESC`)
        .all(user.driver_profile_id ?? -1);
    } else {
      bookings = db.prepare(`${baseQuery} ORDER BY b.start_time DESC`).all();
    }
    res.json({ bookings, can_view_all_schedules: canViewAllSchedules });
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

    if (nextStatus === 'CANCELLED' && prev.booked_by !== user.id) {
      recordAudit(db, user, 'UNAUTHORIZED_BOOKING_CANCEL_REFUSED', 'BOOKING', bookingId);
      res.status(403).json({ error: 'Only the requester (pemesan) who created this booking can cancel it.' });
      return;
    }

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

      if (prev.trip_request_id && nextStatus === 'CANCELLED') {
        broadcastTripUpdate(db, prev.trip_request_id, 'TRIP_UPDATED', { status: 'CANCELLED' });
      }
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
    const user = req.user!;
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
             ${user.role === 'DRV' ? `AND a.driver_profile_id = ${Number(user.driver_profile_id ?? -1)}` : ''}
             ORDER BY a.id ASC`
          )
          .all(tripRequestId)
      : user.role === 'DRV'
      ? db
          .prepare(
            `SELECT a.*, dp.full_name as driver_name, v.registration_plate, u.nickname as assigned_by_name
             FROM assignments a
             JOIN driver_profiles dp ON dp.id = a.driver_profile_id
             JOIN vehicles v ON v.id = a.vehicle_id
             JOIN users u ON u.id = a.assigned_by
             WHERE a.driver_profile_id = ?
             ORDER BY a.id DESC`
          )
          .all(user.driver_profile_id ?? -1)
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
              trip_request_id, booking_id, vehicle_id, driver_profile_id, assigned_by, reason, effective_start, effective_end, is_current, acknowledged_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`
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
             tr.reservation_type, tr.return_pickup_time,
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
    broadcastTripUpdate(db, tripId, 'TRIP_ACKNOWLEDGED');
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
      | { id: number; current_odometer: number; energy_type: string; registration_plate: string }
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

    notifyAdmins(db, {
      triggerType: 'TRIP_STARTED',
      title: 'Fleet Vehicle En Route',
      body: `Trip #${tripId} ("${trip.purpose}") has departed with vehicle ${vehicle.registration_plate} (Start Odometer: ${odo} km).`,
      relatedEntityType: 'TRIP_REQUEST',
      relatedEntityId: tripId,
    });

    const enriched = broadcastTripUpdate(db, tripId, 'TRIP_STARTED', { odometer: odo });
    res.json({ trip: enriched || db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) });
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

    notifyAdmins(db, {
      triggerType: 'TRIP_COMPLETED',
      title: 'Trip Completed & Returned',
      body: `Trip #${tripId} ("${trip.purpose}") has completed (${distanceKm} km). Returned to ${parking_return_note || 'HQ Pool'}.`,
      relatedEntityType: 'TRIP_REQUEST',
      relatedEntityId: tripId,
    });

    const enriched = broadcastTripUpdate(db, tripId, 'TRIP_COMPLETED', { distance_km: distanceKm });
    res.json({ trip: enriched || db.prepare('SELECT * FROM trip_requests WHERE id = ?').get(tripId) });
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

  // Expenses (EXP-01 to EXP-08, Driver Reimbursements & Petty Cash Mechanism)
  app.get('/api/expenses', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const isPrivileged = isPrivilegedRole(user);
    const sql = isPrivileged
      ? `SELECT e.*, v.registration_plate, v.make, v.model, u.nickname as submitted_by_name,
                dp.full_name as driver_name, dp.petty_cash_balance as driver_petty_cash_balance
         FROM expenses e
         JOIN vehicles v ON v.id = e.vehicle_id
         JOIN users u ON u.id = e.submitted_by
         LEFT JOIN driver_profiles dp ON dp.id = COALESCE(e.driver_profile_id, (SELECT id FROM driver_profiles WHERE user_id = e.submitted_by LIMIT 1))
         ORDER BY e.date_time DESC`
      : `SELECT e.*, v.registration_plate, v.make, v.model, u.nickname as submitted_by_name,
                dp.full_name as driver_name, dp.petty_cash_balance as driver_petty_cash_balance
         FROM expenses e
         JOIN vehicles v ON v.id = e.vehicle_id
         JOIN users u ON u.id = e.submitted_by
         LEFT JOIN driver_profiles dp ON dp.id = COALESCE(e.driver_profile_id, (SELECT id FROM driver_profiles WHERE user_id = e.submitted_by LIMIT 1))
         WHERE e.submitted_by = ?
         ORDER BY e.date_time DESC`;
    const expenses = isPrivileged ? db.prepare(sql).all() : db.prepare(sql).all(user.id);

    let pettyCashBalance: number | null = null;
    if (user.role === 'DRV') {
      const dpRow = db
        .prepare('SELECT petty_cash_balance FROM driver_profiles WHERE user_id = ? OR id = ? LIMIT 1')
        .get(user.id, user.driver_profile_id ?? -1) as { petty_cash_balance?: number } | undefined;
      pettyCashBalance = dpRow?.petty_cash_balance ?? 500000;
    }

    res.json({ expenses, petty_cash_balance: pettyCashBalance });
  });

  app.post('/api/expenses', requireAuth, requireRoles(['ADM', 'FM', 'DRV', 'EMP'], true), (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const {
      vehicle_id,
      trip_request_id,
      date_time,
      category,
      amount,
      description,
      payment_source,
      receipt_document_id,
      receipt_base64,
      receipt_data_url,
      receipt_mime_type,
      receipt_filename,
    } = req.body ?? {};

    // Item #7: For logged-in drivers (DRV), automatically resolve their driver_profile_id and their assigned/dedicated vehicle
    // so reimbursements can never get mixed up with other drivers' vehicles.
    let resolvedDriverProfileId: number | null = user.driver_profile_id ?? null;
    if (!resolvedDriverProfileId && user.role === 'DRV') {
      const dp = db.prepare('SELECT id FROM driver_profiles WHERE user_id = ?').get(user.id) as { id: number } | undefined;
      resolvedDriverProfileId = dp?.id ?? null;
    }

    let resolvedVehicleId: number | null = vehicle_id ? Number(vehicle_id) : null;
    if (user.role === 'DRV' && resolvedDriverProfileId) {
      // Find vehicles assigned or dedicated to this logged-in driver
      const activeAsnVeh = db
        .prepare('SELECT vehicle_id FROM assignments WHERE driver_profile_id = ? AND is_current = 1 ORDER BY id DESC LIMIT 1')
        .get(resolvedDriverProfileId) as { vehicle_id: number } | undefined;
      const dedicatedVehs = db
        .prepare('SELECT id FROM vehicles WHERE default_driver_id = ? ORDER BY id ASC')
        .all(resolvedDriverProfileId) as Array<{ id: number }>;
      const driverAllowedVehicleIds = new Set<number>([
        ...(activeAsnVeh ? [activeAsnVeh.vehicle_id] : []),
        ...dedicatedVehs.map((v) => v.id),
      ]);
      const primaryDriverVehicleId = activeAsnVeh?.vehicle_id ?? dedicatedVehs[0]?.id ?? null;

      if (!resolvedVehicleId && primaryDriverVehicleId) {
        resolvedVehicleId = primaryDriverVehicleId;
      } else if (resolvedVehicleId && driverAllowedVehicleIds.size > 0 && !driverAllowedVehicleIds.has(resolvedVehicleId)) {
        // Check if the requested vehicle is dedicated to a DIFFERENT driver; if so, enforce the logged-in driver's own vehicle
        const requestedVeh = db.prepare('SELECT default_driver_id FROM vehicles WHERE id = ?').get(resolvedVehicleId) as
          | { default_driver_id: number | null }
          | undefined;
        if (requestedVeh?.default_driver_id && requestedVeh.default_driver_id !== resolvedDriverProfileId && primaryDriverVehicleId) {
          resolvedVehicleId = primaryDriverVehicleId;
        }
      }
    }

    if (!resolvedVehicleId || !category || amount === undefined || !description) {
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

    const normalizedPaymentSource =
      payment_source && ['PETTY_CASH', 'PERSONAL_CASH', 'E_TOLL'].includes(String(payment_source).toUpperCase())
        ? String(payment_source).toUpperCase()
        : 'PETTY_CASH';

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
          vehicle_id, trip_request_id, submitted_by, driver_profile_id, date_time, category, amount, description,
          payment_source, receipt_document_id, receipt_data_url, receipt_filename
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        resolvedVehicleId,
        trip_request_id ? Number(trip_request_id) : null,
        user.id,
        resolvedDriverProfileId,
        date_time || new Date().toISOString(),
        category,
        numAmount,
        String(description).trim(),
        normalizedPaymentSource,
        finalDocId,
        finalDataUrl,
        finalFilename
      );

    const expenseId = Number(result.lastInsertRowid);
    if (finalDocId) {
      db.prepare('UPDATE documents SET entity_id = ? WHERE id = ?').run(expenseId, finalDocId);
    }

    // Item #9: Deduct Petty Cash balance when driver submits a PETTY_CASH expense (e.g. cash parking)
    let updatedPettyCash: number | null = null;
    if (resolvedDriverProfileId && normalizedPaymentSource === 'PETTY_CASH') {
      db.prepare(
        "UPDATE driver_profiles SET petty_cash_balance = COALESCE(petty_cash_balance, 500000) - ?, updated_at = datetime('now') WHERE id = ?"
      ).run(numAmount, resolvedDriverProfileId);
      const dpRow = db.prepare('SELECT petty_cash_balance FROM driver_profiles WHERE id = ?').get(resolvedDriverProfileId) as
        | { petty_cash_balance: number }
        | undefined;
      updatedPettyCash = dpRow?.petty_cash_balance ?? null;
    }

    const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
    recordAudit(db, req.user, 'EXPENSE_CREATED', 'EXPENSE', expenseId, null, created);
    res.status(201).json({ expense: created, petty_cash_balance: updatedPettyCash });
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
    const nextAmount = amount !== undefined ? Number(amount) : Number(prev.amount);
    const nextDesc = description !== undefined ? String(description) : String(prev.description);
    const normalizedApproval =
      approval_status !== undefined
        ? String(approval_status).toUpperCase() === 'APPROVED'
          ? 'APPROVED'
          : String(approval_status).toUpperCase() === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING'
        : String(prev.approval_status);
    const normalizedReimb =
      reimbursement_status !== undefined
        ? String(reimbursement_status).toUpperCase().includes('REIMBURSED')
          ? 'REIMBURSED'
          : String(reimbursement_status).toUpperCase() === 'NOT_APPLICABLE'
          ? 'NOT_APPLICABLE'
          : 'PENDING'
        : normalizedApproval === 'APPROVED'
        ? 'REIMBURSED'
        : String(prev.reimbursement_status);

    db.prepare(
      `UPDATE expenses
       SET amount = ?, description = ?, approval_status = ?, reimbursement_status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(nextAmount, nextDesc, normalizedApproval, normalizedReimb, id);

    // Item #9: Replenish/reimburse driver's Petty Cash float when a PETTY_CASH claim is APPROVED (or refund deduction if REJECTED)
    const expDriverProfileId =
      Number(prev.driver_profile_id || 0) ||
      ((db.prepare('SELECT id FROM driver_profiles WHERE user_id = ?').get(Number(prev.submitted_by)) as { id: number } | undefined)?.id ?? 0);

    if (expDriverProfileId && String(prev.payment_source || 'PETTY_CASH') === 'PETTY_CASH') {
      const wasApprovedOrRejected = ['APPROVED', 'REJECTED'].includes(String(prev.approval_status).toUpperCase());
      if (!wasApprovedOrRejected && (normalizedApproval === 'APPROVED' || normalizedApproval === 'REJECTED')) {
        db.prepare(
          "UPDATE driver_profiles SET petty_cash_balance = COALESCE(petty_cash_balance, 500000) + ?, updated_at = datetime('now') WHERE id = ?"
        ).run(nextAmount, expDriverProfileId);
      }
    }

    if (approval_status && normalizedApproval !== String(prev.approval_status)) {
      db.prepare('INSERT INTO expense_decisions (expense_id, decider_id, decision, reason) VALUES (?, ?, ?, ?)').run(
        id,
        req.user!.id,
        normalizedApproval,
        reason || 'Reviewed by Admin'
      );
    }

    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    recordAudit(db, req.user, 'EXPENSE_UPDATED', 'EXPENSE', id, prev, updated);
    res.json({ expense: updated });
  });

  // Item #8: Delete receipt photo from an expense or delete a pending expense claim
  app.delete('/api/expenses/:id/receipt', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const id = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!prev) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    if (Number(prev.submitted_by) !== user.id && !isPrivilegedRole(user)) {
      res.status(403).json({ error: 'Forbidden: cannot modify another user expense receipt' });
      return;
    }

    if (prev.receipt_document_id) {
      try {
        db.prepare('DELETE FROM documents WHERE id = ?').run(Number(prev.receipt_document_id));
      } catch {}
    }

    db.prepare(
      "UPDATE expenses SET receipt_document_id = NULL, receipt_data_url = NULL, receipt_filename = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(id);

    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    recordAudit(db, user, 'EXPENSE_RECEIPT_DELETED', 'EXPENSE', id, prev, updated);
    res.json({ ok: true, expense: updated });
  });

  app.delete('/api/expenses/:id', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const id = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!prev) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    if (Number(prev.submitted_by) !== user.id && !isPrivilegedRole(user)) {
      res.status(403).json({ error: 'Forbidden: cannot delete another user expense claim' });
      return;
    }
    if (String(prev.approval_status) === 'APPROVED' && !isPrivilegedRole(user)) {
      res.status(400).json({ error: 'Cannot delete an already approved expense claim' });
      return;
    }

    const expDriverProfileId =
      Number(prev.driver_profile_id || 0) ||
      ((db.prepare('SELECT id FROM driver_profiles WHERE user_id = ?').get(Number(prev.submitted_by)) as { id: number } | undefined)?.id ?? 0);

    if (expDriverProfileId && String(prev.payment_source || 'PETTY_CASH') === 'PETTY_CASH' && String(prev.approval_status) === 'PENDING') {
      db.prepare(
        "UPDATE driver_profiles SET petty_cash_balance = COALESCE(petty_cash_balance, 500000) + ?, updated_at = datetime('now') WHERE id = ?"
      ).run(Number(prev.amount || 0), expDriverProfileId);
    }

    if (prev.receipt_document_id) {
      try {
        db.prepare('DELETE FROM documents WHERE id = ?').run(Number(prev.receipt_document_id));
      } catch {}
    }
    db.prepare('DELETE FROM expense_decisions WHERE expense_id = ?').run(id);
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);

    recordAudit(db, user, 'EXPENSE_DELETED', 'EXPENSE', id, prev, null);
    res.json({ ok: true, deletedId: id });
  });

  // Item #9: Admin / Fleet PIC Petty Cash Float Top-Up & Adjustment for Drivers
  app.post('/api/drivers/:id/petty-cash-topup', requireAuth, requireRoles(['ADM', 'FM']), (req: Request, res: Response) => {
    const db = getDb();
    const driverId = Number(req.params.id);
    const { amount, mode } = req.body ?? {};
    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount < 0) {
      res.status(400).json({ error: 'Valid petty cash amount is required' });
      return;
    }

    const drv = db.prepare('SELECT * FROM driver_profiles WHERE id = ?').get(driverId) as Record<string, unknown> | undefined;
    if (!drv) {
      res.status(404).json({ error: 'Driver profile not found' });
      return;
    }

    const isSet = String(mode || 'ADD').toUpperCase() === 'SET';
    if (isSet) {
      db.prepare("UPDATE driver_profiles SET petty_cash_balance = ?, updated_at = datetime('now') WHERE id = ?").run(numAmount, driverId);
    } else {
      db.prepare(
        "UPDATE driver_profiles SET petty_cash_balance = COALESCE(petty_cash_balance, 500000) + ?, updated_at = datetime('now') WHERE id = ?"
      ).run(numAmount, driverId);
    }

    const updated = db.prepare('SELECT * FROM driver_profiles WHERE id = ?').get(driverId);
    recordAudit(db, req.user, 'DRIVER_PETTY_CASH_TOPUP', 'DRIVER_PROFILE', driverId, drv, updated);
    res.json({ ok: true, driver: updated });
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
      if (Number.isNaN(d.getTime())) return 'Unknown';
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
        const refTime = String(t.actual_end_time || t.end_time || t.start_time || '');
        const dKey = refTime.length >= 10 ? refTime.slice(0, 10) : 'Unknown';
        const mKey = refTime.length >= 7 ? refTime.slice(0, 7) : 'Unknown';
        const wKey = refTime ? getIsoWeekKey(refTime) : 'Unknown';
        const refMs = refTime ? new Date(refTime).getTime() : NaN;
        const dist = t.distance_km ?? Math.max(0, (t.end_odometer ?? 0) - (t.start_odometer ?? 0));

        totalTrips += 1;
        totalKm += dist;

        if (dKey === todayPrefix) {
          dayTrips += 1;
          dayKm += dist;
        }
        if (Number.isFinite(refMs) && refMs >= weekAgoMs) {
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
        const refTime = String(t.actual_end_time || t.end_time || t.start_time || '');
        const dKey = refTime.length >= 10 ? refTime.slice(0, 10) : 'Unknown';
        const mKey = refTime.length >= 7 ? refTime.slice(0, 7) : 'Unknown';
        const refMs = refTime ? new Date(refTime).getTime() : NaN;
        const dist = t.distance_km ?? Math.max(0, (t.end_odometer ?? 0) - (t.start_odometer ?? 0));

        totalTrips += 1;
        totalKm += dist;
        if (dKey === todayPrefix) {
          dayTrips += 1;
          dayKm += dist;
        }
        if (Number.isFinite(refMs) && refMs >= weekAgoMs) {
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
      const s = t.actual_start_time || t.start_time || '';
      const e = t.actual_end_time || t.end_time || '';
      const sMs = s ? new Date(s).getTime() : NaN;
      const eMs = e ? new Date(e).getTime() : NaN;
      const durationMin = Number.isFinite(sMs) && Number.isFinite(eMs) ? Math.max(1, Math.round((eMs - sMs) / 60000)) : 1;
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

      // Real Driver Tracking: Determine active assigned driver (trip -> assignment -> default driver)
      const assignedDriverProfileId = activeTrip?.assigned_driver_id || (
        db.prepare('SELECT driver_profile_id FROM assignments WHERE vehicle_id = ? AND is_current = 1 ORDER BY id DESC LIMIT 1').get(v.id) as { driver_profile_id: number } | undefined
      )?.driver_profile_id || v.default_driver_id;

      let driverUserId: number | null = null;
      let driverFullName = activeTrip?.assigned_driver_name || v.default_driver_name || null;
      if (assignedDriverProfileId) {
        const dpRow = db.prepare('SELECT user_id, full_name, contact_number, photo_url FROM driver_profiles WHERE id = ?').get(assignedDriverProfileId) as { user_id: number; full_name: string; contact_number: string; photo_url: string } | undefined;
        if (dpRow) {
          driverUserId = dpRow.user_id;
          if (!driverFullName) driverFullName = dpRow.full_name;
        }
      }

      // Check real driver location reports (by vehicle_id, driver_profile_id, or driver_user_id)
      const latestGps = db.prepare(`
        SELECT latitude, longitude, capture_time, phone_state, accuracy_meters
        FROM location_reports
        WHERE (vehicle_id = ? OR (? IS NOT NULL AND driver_profile_id = ?) OR (? IS NOT NULL AND driver_user_id = ?))
          AND latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY id DESC LIMIT 1
      `).get(v.id, assignedDriverProfileId, assignedDriverProfileId, driverUserId, driverUserId) as any;

      // Also check user_locations for the driver's real-time phone GPS updates
      const latestUserLoc = driverUserId ? db.prepare(`
        SELECT latitude, longitude, accuracy_meters, updated_at
        FROM user_locations
        WHERE user_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
      `).get(driverUserId) as any : null;

      let lat: number | null = null;
      let lon: number | null = null;
      let isFollowingDriver = false;
      let locationName = v.last_parking_spot || DEFAULT_POOL.name;

      if (latestUserLoc && latestGps) {
        const gpsTime = new Date(latestGps.capture_time).getTime();
        const userLocTime = new Date(latestUserLoc.updated_at).getTime();
        if (userLocTime >= gpsTime) {
          lat = Number(latestUserLoc.latitude);
          lon = Number(latestUserLoc.longitude);
          isFollowingDriver = true;
          locationName = `Following Driver GPS (${latestUserLoc.accuracy_meters ? `${latestUserLoc.accuracy_meters}m` : 'Live'})`;
        } else {
          lat = Number(latestGps.latitude);
          lon = Number(latestGps.longitude);
          isFollowingDriver = true;
          locationName = `Following Driver GPS (${latestGps.accuracy_meters ? `${latestGps.accuracy_meters}m` : 'Live'})`;
        }
      } else if (latestUserLoc) {
        lat = Number(latestUserLoc.latitude);
        lon = Number(latestUserLoc.longitude);
        isFollowingDriver = true;
        locationName = `Following Driver GPS (${latestUserLoc.accuracy_meters ? `${latestUserLoc.accuracy_meters}m` : 'Live'})`;
      } else if (latestGps) {
        lat = Number(latestGps.latitude);
        lon = Number(latestGps.longitude);
        isFollowingDriver = true;
        locationName = `Following Driver GPS (${latestGps.accuracy_meters ? `${latestGps.accuracy_meters}m` : 'Live'})`;
      }

      if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        const base = v.last_parking_spot?.includes('SCBD') ? HQ_POOL : DEFAULT_POOL;
        const offsetLat = ((index % 4) - 1.5) * 0.0008;
        const offsetLon = (Math.floor(index / 4) - 0.5) * 0.0009;
        lat = Number((base.lat + offsetLat).toFixed(6));
        lon = Number((base.lon + offsetLon).toFixed(6));
        isFollowingDriver = false;
        locationName = v.last_parking_spot || base.name;
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
        is_following_driver: isFollowingDriver,
        following_driver_name: isFollowingDriver ? driverFullName : null,
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
          db.prepare('DELETE FROM negotiation_requests').run();
          db.prepare('DELETE FROM password_reset_requests').run();
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
          db.prepare('DELETE FROM negotiation_requests').run();
          db.prepare('DELETE FROM password_reset_requests').run();
          db.prepare('DELETE FROM trip_requests').run();
          db.prepare('DELETE FROM report_approvals').run();
          db.prepare('DELETE FROM notifications').run();
          db.prepare('UPDATE documents SET replaced_by_id = NULL').run();
          db.prepare('DELETE FROM documents').run();
          db.prepare('UPDATE vehicles SET default_driver_id = NULL').run();
          db.prepare('DELETE FROM vehicles').run();
          db.prepare('DELETE FROM driver_profiles').run();
          db.prepare('DELETE FROM user_locations WHERE user_id != ?').run(req.user!.id);
          db.prepare('DELETE FROM push_subscriptions WHERE user_id != ?').run(req.user!.id);
          db.prepare('DELETE FROM sessions WHERE user_id != ?').run(req.user!.id);
          db.prepare('UPDATE users SET approved_by = NULL').run();
          db.prepare("DELETE FROM users WHERE role != 'ADM'").run();
          ensureDriverGroup(db);
          db.prepare(
            "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('demo_seed_suppressed', '1', datetime('now'))"
          ).run();

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
            ? 'Complete factory reset successful. The system has been returned to a clean production slate with 13 company groups and your Administrator account ready for real fleet registration.'
            : 'Operational test data wiped successfully. Vehicles and drivers remain intact with updated starting odometers.',
      });
    } catch (err: any) {
      console.error('System reset failed:', err);
      res.status(500).json({ error: err.message || 'System reset failed' });
    }
  });

  // ── Digital Summary Report Approvals (Weekly on Friday & End of Month for FM & HWS) ──
  const computeIsoWeekKey = (d: Date): { key: string; monday: Date; friday: Date } => {
    const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = utc.getUTCDay() || 7; // Mon=1..Sun=7
    const monday = new Date(utc);
    monday.setUTCDate(utc.getUTCDate() - (day - 1));
    const friday = new Date(monday);
    friday.setUTCDate(monday.getUTCDate() + 4);
    const thursday = new Date(monday);
    thursday.setUTCDate(monday.getUTCDate() + 3);
    const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const key = `${thursday.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    return { key, monday, friday };
  };

  const fmtIsoDate = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

  const fmtShortDate = (d: Date): string =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const buildPeriodSummarySnapshot = (db: AppDatabase, startIso: string, endIso: string) => {
    const startTs = `${startIso} 00:00:00`;
    const endTs = `${endIso} 23:59:59`;
    const tripStats = db
      .prepare(
        `SELECT COUNT(*) as total_trips,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_trips,
                COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN COALESCE(distance_km, 0) ELSE 0 END), 0) as total_distance_km
         FROM trip_requests
         WHERE COALESCE(actual_end_time, start_time, created_at) BETWEEN ? AND ?`
      )
      .get(startTs, endTs) as { total_trips: number; completed_trips: number; total_distance_km: number };

    const fuelStats = db
      .prepare(
        `SELECT COALESCE(SUM(cost), 0) as total_fuel_cost, COALESCE(SUM(litres), 0) as total_litres
         FROM fuel_records
         WHERE COALESCE(date_time, created_at) BETWEEN ? AND ?`
      )
      .get(startTs, endTs) as { total_fuel_cost: number; total_litres: number };

    const evStats = db
      .prepare(
        `SELECT COALESCE(SUM(cost), 0) as total_ev_cost, COALESCE(SUM(kwh_added), 0) as total_kwh
         FROM ev_charging_records
         WHERE COALESCE(date_time, created_at) BETWEEN ? AND ?`
      )
      .get(startTs, endTs) as { total_ev_cost: number; total_kwh: number };

    const expStats = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total_expense_cost
         FROM expenses
         WHERE COALESCE(date_time, created_at) BETWEEN ? AND ?`
      )
      .get(startTs, endTs) as { total_expense_cost: number };

    const activeVehicles = Number(
      (db.prepare("SELECT COUNT(*) as c FROM vehicles WHERE status != 'Retired'").get() as { c: number })?.c || 0
    );
    const activeDrivers = Number(
      (db.prepare('SELECT COUNT(*) as c FROM driver_profiles').get() as { c: number })?.c || 0
    );

    const fuelCost = Math.round(Number(fuelStats?.total_fuel_cost || 0));
    const evCost = Math.round(Number(evStats?.total_ev_cost || 0));
    const expenseCost = Math.round(Number(expStats?.total_expense_cost || 0));

    return {
      total_trips: Number(tripStats?.total_trips || 0),
      completed_trips: Number(tripStats?.completed_trips || 0),
      total_distance_km: Number(Number(tripStats?.total_distance_km || 0).toFixed(1)),
      total_litres: Number(Number(fuelStats?.total_litres || 0).toFixed(1)),
      total_kwh: Number(Number(evStats?.total_kwh || 0).toFixed(1)),
      total_fuel_cost: fuelCost,
      total_ev_cost: evCost,
      total_expense_cost: expenseCost,
      total_operational_cost_idr: fuelCost + evCost + expenseCost,
      active_vehicles: activeVehicles,
      active_drivers: activeDrivers,
    };
  };

  const ensurePeriodicReportApprovals = (db: AppDatabase, refDate: Date) => {
    const { key: weekKey, monday, friday } = computeIsoWeekKey(refDate);
    const weekStart = fmtIsoDate(monday);
    const weekEnd = fmtIsoDate(friday);
    const weekLabel = `Weekly Summary (${fmtShortDate(monday)} – ${fmtShortDate(friday)})`;
    const weekSummary = JSON.stringify(buildPeriodSummarySnapshot(db, weekStart, weekEnd));

    const existingWeek = db.prepare('SELECT id, overall_status FROM report_approvals WHERE period_key = ?').get(weekKey) as
      | { id: number; overall_status: string }
      | undefined;
    if (!existingWeek) {
      db.prepare(
        `INSERT INTO report_approvals (period_type, period_key, period_label, period_start, period_end, summary_json)
         VALUES ('WEEKLY', ?, ?, ?, ?, ?)`
      ).run(weekKey, weekLabel, weekStart, weekEnd, weekSummary);
    } else if (existingWeek.overall_status === 'PENDING') {
      db.prepare("UPDATE report_approvals SET summary_json = ?, updated_at = datetime('now') WHERE id = ?").run(
        weekSummary,
        existingWeek.id
      );
    }

    const monthStartObj = new Date(Date.UTC(refDate.getFullYear(), refDate.getMonth(), 1));
    const monthEndObj = new Date(Date.UTC(refDate.getFullYear(), refDate.getMonth() + 1, 0));
    const monthKey = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = fmtIsoDate(monthStartObj);
    const monthEnd = fmtIsoDate(monthEndObj);
    const monthName = monthStartObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const monthLabel = `Monthly Summary (${monthName})`;
    const monthSummary = JSON.stringify(buildPeriodSummarySnapshot(db, monthStart, monthEnd));

    const existingMonth = db.prepare('SELECT id, overall_status FROM report_approvals WHERE period_key = ?').get(monthKey) as
      | { id: number; overall_status: string }
      | undefined;
    if (!existingMonth) {
      db.prepare(
        `INSERT INTO report_approvals (period_type, period_key, period_label, period_start, period_end, summary_json)
         VALUES ('MONTHLY', ?, ?, ?, ?, ?)`
      ).run(monthKey, monthLabel, monthStart, monthEnd, monthSummary);
    } else if (existingMonth.overall_status === 'PENDING') {
      db.prepare("UPDATE report_approvals SET summary_json = ?, updated_at = datetime('now') WHERE id = ?").run(
        monthSummary,
        existingMonth.id
      );
    }

    return { weekKey, monthKey, weekEnd, monthEnd };
  };

  app.get('/api/reports/approvals', requireAuth, requireRoles(['ADM', 'FM', 'HWS']), (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const simRaw = typeof req.query.simulate_date === 'string' ? req.query.simulate_date.trim() : '';
    const refDate = /^\d{4}-\d{2}-\d{2}$/.test(simRaw) ? new Date(`${simRaw}T12:00:00Z`) : new Date();
    const { weekKey, monthKey, weekEnd, monthEnd } = ensurePeriodicReportApprovals(db, refDate);

    const rows = db
      .prepare('SELECT * FROM report_approvals ORDER BY period_end DESC, period_type DESC LIMIT 24')
      .all() as any[];

    const approvals = rows.map((r) => {
      let summary: Record<string, unknown> = {};
      try {
        summary = JSON.parse(r.summary_json || '{}');
      } catch {
        summary = {};
      }
      return { ...r, summary };
    });

    const dayOfWeek = refDate.getUTCDay(); // 5 = Friday
    const isFriday = dayOfWeek === 5;
    const isEndOfWeekWindow = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
    const lastDayOfMonth = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() + 1, 0)).getUTCDate();
    const isEndOfMonth = refDate.getUTCDate() >= lastDayOfMonth - 1;
    const todayIso = fmtIsoDate(refDate);

    let pendingPopup: any = null;
    if (user.role === 'FM' || user.role === 'HWS') {
      const roleStatusKey = user.role === 'FM' ? 'fm_status' : 'hws_status';
      const pendingForRole = approvals.filter((a) => a[roleStatusKey] === 'PENDING');

      // Priority 1: Monthly summary on End of Month (last 2 days of month)
      if (isEndOfMonth) {
        pendingPopup = pendingForRole.find((a) => a.period_key === monthKey) || null;
      }
      // Priority 2: Weekly summary on Friday (or weekend if Friday wasn't signed yet)
      if (!pendingPopup && isEndOfWeekWindow) {
        pendingPopup = pendingForRole.find((a) => a.period_key === weekKey) || null;
      }
      // Priority 3: Any overdue report whose period_end already passed
      if (!pendingPopup) {
        pendingPopup = pendingForRole.find((a) => String(a.period_end) < todayIso) || null;
      }
    }

    res.json({
      approvals,
      pendingPopup,
      scheduleInfo: {
        referenceDate: todayIso,
        isFriday,
        isEndOfMonth,
        currentWeekEnd: weekEnd,
        currentMonthEnd: monthEnd,
      },
    });
  });

  app.post('/api/reports/approvals/:id/decision', requireAuth, requireRoles(['FM', 'HWS']), (req: Request, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const reportId = Number(req.params.id);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      res.status(400).json({ error: 'Invalid report approval ID' });
      return;
    }

    const decision = String(req.body?.decision || '').toUpperCase();
    const notes = String(req.body?.notes || '').trim();
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
      return;
    }

    const existing = db.prepare('SELECT * FROM report_approvals WHERE id = ?').get(reportId) as any;
    if (!existing) {
      res.status(404).json({ error: 'Summary report approval record not found' });
      return;
    }

    const nowIso = new Date().toISOString();
    const rawSig = `${reportId}|${existing.period_key}|${user.role}|${user.id}|${decision}|${nowIso}`;
    const signatureHash = `GF-DIGI-${crypto.createHash('sha256').update(rawSig).digest('hex').slice(0, 12).toUpperCase()}`;

    const nextFmStatus = user.role === 'FM' ? decision : existing.fm_status;
    const nextHwsStatus = user.role === 'HWS' ? decision : existing.hws_status;
    let nextOverall = 'PENDING';
    if (nextFmStatus === 'REJECTED' || nextHwsStatus === 'REJECTED') {
      nextOverall = 'REJECTED';
    } else if (nextFmStatus === 'APPROVED' && nextHwsStatus === 'APPROVED') {
      nextOverall = 'APPROVED';
    } else if (nextFmStatus === 'APPROVED' || nextHwsStatus === 'APPROVED') {
      nextOverall = 'PARTIALLY_APPROVED';
    }

    if (user.role === 'FM') {
      db.prepare(
        `UPDATE report_approvals
         SET fm_status = ?, fm_user_id = ?, fm_approved_by_name = ?, fm_approved_at = ?, fm_notes = ?, fm_signature_hash = ?,
             overall_status = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(decision, user.id, user.nickname, nowIso, notes || null, signatureHash, nextOverall, reportId);
    } else {
      db.prepare(
        `UPDATE report_approvals
         SET hws_status = ?, hws_user_id = ?, hws_approved_by_name = ?, hws_approved_at = ?, hws_notes = ?, hws_signature_hash = ?,
             overall_status = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(decision, user.id, user.nickname, nowIso, notes || null, signatureHash, nextOverall, reportId);
    }

    recordAudit(
      db,
      user,
      'REPORT_APPROVAL_DECISION',
      'REPORT_APPROVAL',
      reportId,
      {
        fm_status: existing.fm_status,
        hws_status: existing.hws_status,
        overall_status: existing.overall_status,
      },
      {
        fm_status: nextFmStatus,
        hws_status: nextHwsStatus,
        overall_status: nextOverall,
        signatureHash,
        notes,
      }
    );

    const roleLabel = user.role === 'FM' ? 'Fleet Manager' : 'Head of WS';
    const counterpartRole = user.role === 'FM' ? 'HWS' : 'FM';
    notifyRole(db, counterpartRole, {
      triggerType: 'REPORT_APPROVAL',
      title: `Digital Report ${decision}: ${existing.period_label}`,
      body: `${roleLabel} (${user.nickname}) ${decision.toLowerCase()} the ${existing.period_type.toLowerCase()} summary report (${signatureHash}).`,
      relatedEntityType: 'REPORT_APPROVAL',
      relatedEntityId: reportId,
    });
    notifyAdmins(db, {
      triggerType: 'REPORT_APPROVAL',
      title: `Report ${decision} by ${roleLabel}`,
      body: `${existing.period_label} is now ${nextOverall} (Digital Stamp: ${signatureHash}).`,
      relatedEntityType: 'REPORT_APPROVAL',
      relatedEntityId: reportId,
    });
    liveEvents.broadcast({
      type: 'report_approval',
      data: { reportId, overall_status: nextOverall, period_key: existing.period_key },
    });

    const updated = db.prepare('SELECT * FROM report_approvals WHERE id = ?').get(reportId) as any;
    let summary: Record<string, unknown> = {};
    try {
      summary = JSON.parse(updated.summary_json || '{}');
    } catch {
      summary = {};
    }

    res.json({
      approval: { ...updated, summary },
      signatureHash,
      overall_status: nextOverall,
    });
  });

  // Comprehensive 1-Page Executive Report Generator (Concise Summary, IDR Ledger, Digital Signatures)
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

    let totalDurationMinutes = 0;
    completedTrips.forEach((t) => {
      const s = new Date(t.actual_start_time || t.start_time || '').getTime();
      const e = new Date(t.actual_end_time || t.end_time || '').getTime();
      const durationMin = Number.isFinite(s) && Number.isFinite(e) ? Math.max(1, Math.round((e - s) / 60000)) : 1;
      totalDurationMinutes += durationMin;
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
    const generatedDateStr = new Date().toLocaleDateString('id-ID', { dateStyle: 'full' });
    const auditTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    // Per-vehicle compact summary
    const vehicleRowsHtml = vehicles.map((v) => {
      const vTrips = completedTrips.filter((t) => t.vehicle_id === v.id);
      const vKm = vTrips.reduce((acc, t) => acc + (t.distance_km || 0), 0);
      const startOdo = Math.max(0, (v.current_odometer || 0) - vKm);
      const isEv = v.energy_type === 'Electric';
      const energyAgg = isEv
        ? db.prepare('SELECT COALESCE(SUM(kwh_added), 0) as q, COALESCE(SUM(cost), 0) as c FROM ev_charging_records WHERE vehicle_id = ?').get(v.id) as { q: number; c: number }
        : db.prepare('SELECT COALESCE(SUM(litres), 0) as q, COALESCE(SUM(cost), 0) as c FROM fuel_records WHERE vehicle_id = ?').get(v.id) as { q: number; c: number };

      return `
        <tr>
          <td><strong>${v.registration_plate}</strong></td>
          <td>${v.make} ${v.model}</td>
          <td><span class="badge ${isEv ? 'badge-ev' : 'badge-gas'}">${v.energy_type}</span></td>
          <td class="mono right">${startOdo.toLocaleString('id-ID')} km</td>
          <td class="mono right">${Number(v.current_odometer || 0).toLocaleString('id-ID')} km</td>
          <td class="mono right font-bold text-blue">${vKm.toLocaleString('id-ID')} km</td>
          <td class="center font-bold">${vTrips.length}</td>
          <td class="mono right">${energyAgg.q > 0 ? `${energyAgg.q.toFixed(1)} ${isEv ? 'kWh' : 'L'}` : '0'}</td>
          <td class="mono right font-bold">${formatIdr(energyAgg.c)}</td>
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
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 12px;
      font-size: 11px;
      line-height: 1.35;
    }
    .report-wrap {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 18px 22px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.05);
      page-break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0072de;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand-title { font-size: 19px; font-weight: 800; color: #0072de; margin: 0; letter-spacing: -0.3px; }
    .brand-subtitle { font-size: 11px; color: #64748b; margin-top: 2px; font-weight: 500; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .kpi-label { font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi-val { font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      border-left: 3.5px solid #0072de;
      padding-left: 8px;
      margin: 12px 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-bottom: 10px;
    }
    th, td {
      padding: 4px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    th {
      background: #f1f5f9;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.02em;
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
      padding: 1px 6px;
      border-radius: 9999px;
      font-size: 9.5px;
      font-weight: 800;
    }
    .badge-ev { background: #ecfdf5; color: #059669; }
    .badge-gas { background: #e0edff; color: #0072de; }
    .sign-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
    }
    .sign-box {
      border: 1.5px solid #dbeafe;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      background: #f8fafc;
    }
    .sign-role {
      font-size: 11.5px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .sign-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #ecfdf5;
      border: 1.5px solid #10b981;
      color: #065f46;
      font-weight: 800;
      font-size: 10.5px;
      padding: 4px 10px;
      border-radius: 6px;
      margin: 8px 0 4px 0;
      letter-spacing: 0.04em;
    }
    .sign-meta {
      font-size: 9px;
      color: #64748b;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .no-print {
      margin-bottom: 12px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
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
    <button class="btn btn-blue" onclick="window.print()">Print / Save as 1-Page PDF</button>
  </div>
  <div class="report-wrap">
    <div class="header">
      <div>
        <h1 class="brand-title">GALAXYFLEET EXECUTIVE MANAGEMENT REPORT</h1>
        <div class="brand-subtitle">Official Fleet Operations & Financial Summary • Currency: Indonesian Rupiah (IDR)</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;font-weight:700;color:#0f172a;">Generated: ${generatedDateStr}</div>
        <div style="font-size:9.5px;color:#0072de;font-weight:800;letter-spacing:0.04em;">DIGITALLY CERTIFIED • STRICTLY CONFIDENTIAL</div>
      </div>
    </div>

    <!-- 1. Executive KPI Summary -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Completed Trips</div>
        <div class="kpi-val text-blue">${completedTrips.length} Trips</div>
        <div style="font-size:9.5px;color:#64748b;margin-top:2px;">Across ${vehicles.length} Operational Vehicles</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cumulative Driving Time</div>
        <div class="kpi-val text-green">${totalHours}h ${totalMins}m</div>
        <div style="font-size:9.5px;color:#64748b;margin-top:2px;">Total Driver Road Time</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Distance Traveled</div>
        <div class="kpi-val mono">${totalKm.toLocaleString('id-ID')} km</div>
        <div style="font-size:9.5px;color:#64748b;margin-top:2px;">Verified Fleet Kilometers</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Operational Expenditure</div>
        <div class="kpi-val mono text-blue" style="font-size:15px;">${formatIdr(totalCostIdr)}</div>
        <div style="font-size:9.5px;color:#64748b;margin-top:2px;">Fuel, EV, Toll, Parking & Maint</div>
      </div>
    </div>

    <!-- 2. Vehicle Fleet & Energy Audit Summary -->
    <div class="section-title">1. Vehicle Fleet & Energy Audit Summary</div>
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
          <th class="right">Fuel / Energy</th>
          <th class="right">Cost (IDR)</th>
        </tr>
      </thead>
      <tbody>
        ${vehicleRowsHtml || '<tr><td colspan="9" class="center">No vehicles registered yet.</td></tr>'}
      </tbody>
    </table>

    <!-- 3. Comprehensive Energy & Operating Expense Ledger in IDR -->
    <div class="section-title">2. Comprehensive Energy & Expense Ledger (IDR)</div>
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
          <td><strong>Gasoline Fuel</strong></td>
          <td class="mono">${fuelAgg.l.toFixed(1)} Litres</td>
          <td>Gasoline Fleet Refueling</td>
          <td class="mono right font-bold">${formatIdr(fuelAgg.s)}</td>
        </tr>
        <tr>
          <td><strong>Electric Charging (EV)</strong></td>
          <td class="mono">${evAgg.k.toFixed(1)} kWh</td>
          <td>EV Charging Stations & Fast Chargers</td>
          <td class="mono right font-bold">${formatIdr(evAgg.s)}</td>
        </tr>
        <tr>
          <td><strong>Tollway Operational Fees</strong></td>
          <td>Receipt Verified</td>
          <td>Highway E-Toll Card Reimbursements</td>
          <td class="mono right font-bold">${formatIdr(tollAgg.s)}</td>
        </tr>
        <tr>
          <td><strong>Parking Facility Fees</strong></td>
          <td>Receipt Verified</td>
          <td>Official Operational Parking Fees</td>
          <td class="mono right font-bold">${formatIdr(parkingAgg.s)}</td>
        </tr>
        <tr>
          <td><strong>Scheduled Maintenance & Service</strong></td>
          <td>Periodic Inspections</td>
          <td>Workshop Services & Repairs</td>
          <td class="mono right font-bold">${formatIdr(maintAgg.s)}</td>
        </tr>
        <tr style="background:#f1f5f9;font-weight:800;">
          <td colspan="3">GRAND TOTAL OPERATIONAL EXPENDITURE</td>
          <td class="mono right text-blue" style="font-size:12.5px;">${formatIdr(totalCostIdr)}</td>
        </tr>
      </tbody>
    </table>

    <!-- 4. Digital Sign-off Certification (APPROVED BY SYSTEM) -->
    <div class="sign-grid">
      <div class="sign-box">
        <div style="font-size:9.5px;color:#64748b;text-transform:uppercase;font-weight:800;">Prepared & Dispatched By</div>
        <div class="sign-role">Fleet Operation PIC</div>
        <div class="sign-badge">✓ APPROVED BY SYSTEM</div>
        <div class="sign-meta">Digital Audit: SYS-PIC-CERTIFIED<br/>Timestamp: ${auditTimestamp}</div>
      </div>
      <div class="sign-box">
        <div style="font-size:9.5px;color:#64748b;text-transform:uppercase;font-weight:800;">Reviewed & Authorized By</div>
        <div class="sign-role">Head Of WS Part</div>
        <div class="sign-badge">✓ APPROVED BY SYSTEM</div>
        <div class="sign-meta">Digital Audit: SYS-HWS-CERTIFIED<br/>Timestamp: ${auditTimestamp}</div>
      </div>
      <div class="sign-box">
        <div style="font-size:9.5px;color:#64748b;text-transform:uppercase;font-weight:800;">Final Executive Sign-Off</div>
        <div class="sign-role">Executive General Manager</div>
        <div class="sign-badge">✓ APPROVED BY SYSTEM</div>
        <div class="sign-meta">Digital Audit: SYS-EGM-CERTIFIED<br/>Timestamp: ${auditTimestamp}</div>
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
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n4 0 obj\n<< /Length 1100 >>\nstream\nBT\n/F1 16 Tf 50 790 Td (GALAXYFLEET EXECUTIVE MANAGEMENT REPORT) Tj\n/F2 9.5 Tf 0 -18 Td (Executive Briefing - One-Page Certified Audit | Currency: Indonesian Rupiah [IDR]) Tj\n/F1 11 Tf 0 -26 Td (1. OPERATIONAL & FINANCIAL KPI OVERVIEW) Tj\n/F2 9.5 Tf 0 -16 Td (- Total Operational Vehicles: ${vehicles.length} cars | Completed Trips: ${completedTrips.length} trips) Tj\n0 -14 Td (- Total Cumulative Trip Duration: ${totalHours} Hours ${totalMins} Minutes) Tj\n0 -14 Td (- Total Distance Traveled: ${totalKm} km) Tj\n0 -14 Td (- Total Operational Expenditure: Rp ${Number(totalCostIdr).toLocaleString('id-ID')}) Tj\n/F1 11 Tf 0 -26 Td (2. ENERGY & EXPENSE BREAKDOWN IN IDR) Tj\n/F2 9.5 Tf 0 -16 Td (- Gasoline Fuel: ${fuelAgg.l.toFixed(1)} Litres | Cost: Rp ${Number(fuelAgg.s).toLocaleString('id-ID')}) Tj\n0 -14 Td (- Electric EV: ${evAgg.k.toFixed(1)} kWh | Cost: Rp ${Number(evAgg.s).toLocaleString('id-ID')}) Tj\n0 -14 Td (- Highway Tollway Operational Fees: Rp ${Number(tollAgg.s).toLocaleString('id-ID')}) Tj\n0 -14 Td (- Parking Facility Fees: Rp ${Number(parkingAgg.s).toLocaleString('id-ID')}) Tj\n/F1 11 Tf 0 -26 Td (3. DIGITAL SYSTEM AUDIT APPROVALS - NO MANUAL SIGNING) Tj\n/F2 9.5 Tf 0 -16 Td (- Fleet Operation PIC: [APPROVED BY SYSTEM - Digitally Certified]) Tj\n0 -14 Td (- Head Of WS Part: [APPROVED BY SYSTEM - Digitally Certified]) Tj\n0 -14 Td (- Executive General Manager: [APPROVED BY SYSTEM - Digitally Certified]) Tj\n/F1 9 Tf 0 -35 Td (STRICTLY CONFIDENTIAL - AUTHORIZED EXECUTIVE ACCESS ONLY) Tj\nET\nendstream\nendobj\nxref\n0 7\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000300 00000 n \n0000000210 00000 n \n0000000255 00000 n \ntrailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n1420\n%%EOF\n`,
      'utf8'
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fleet_executive_report_idr.pdf"');
    res.send(pdfBuffer);
  });

  // Item #1: Constant reminder starting 10 minutes before departure (every 2 minutes) & 20-minute auto-cancellation for passenger no-show
  function checkTripAlertsAndAutoCancellations(db: ReturnType<typeof getDb>) {
    const now = new Date();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();

    const approvedTrips = db
      .prepare(
        `SELECT tr.id, tr.requester_id, tr.purpose, tr.origin, tr.destination, tr.start_time,
                tr.passenger_boarded_at, tr.last_reminder_sent_at,
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
      passenger_boarded_at: string | null;
      last_reminder_sent_at: string | null;
      registration_plate: string;
      driver_user_id: number | null;
    }>;

    for (const t of approvedTrips) {
      if (t.passenger_boarded_at) {
        continue;
      }
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
              title: 'Booking Auto-Cancelled (20-Min No Show)',
              body: `Your booking for "${t.purpose}" (${t.registration_plate}) was automatically cancelled because you did not confirm boarding or depart within 20 minutes of scheduled departure. The vehicle and driver slot are now free.`,
              relatedEntityType: 'TRIP_REQUEST',
              relatedEntityId: t.id,
            });

            if (t.driver_user_id) {
              sendUserNotification(db, {
                userId: t.driver_user_id,
                triggerType: 'DISPATCH_AUTO_CANCEL_NO_SHOW',
                title: 'Dispatch Order Cancelled (Passenger No-Show)',
                body: `Trip "${t.purpose}" was automatically cancelled due to passenger no-show after 20 minutes. Vehicle ${t.registration_plate} and your schedule slot are now free.`,
                relatedEntityType: 'TRIP_REQUEST',
                relatedEntityId: t.id,
              });
            }

            broadcastTripUpdate(db, t.id, 'TRIP_UPDATED', {
              status: 'CANCELLED',
              cancellation_reason: 'Auto-cancelled: Passenger no-show within 20 minutes',
            });
          } catch (e) {
            console.error('Error auto-cancelling trip:', e);
          }
        } else {
          // Constant reminder starting 10 minutes before start_time up to +20 minutes after start_time (every 2 minutes)
          const diffToStartMs = startMs - nowMs;
          if (diffToStartMs <= 10 * 60 * 1000) {
            const lastRemMs = t.last_reminder_sent_at ? new Date(t.last_reminder_sent_at).getTime() : 0;
            const shouldSendRepeat = !lastRemMs || Number.isNaN(lastRemMs) || nowMs - lastRemMs >= 2 * 60 * 1000;

            if (shouldSendRepeat) {
              db.prepare('UPDATE trip_requests SET last_reminder_sent_at = ? WHERE id = ?').run(nowIso, t.id);
              const minsToStart = Math.round(diffToStartMs / 60000);
              const minsUntilCancel = Math.max(1, Math.round((startMs + 20 * 60 * 1000 - nowMs) / 60000));
              const titleText =
                minsToStart > 0
                  ? `Car Departing in ${minsToStart} Min (${t.registration_plate})`
                  : `Car Waiting at Pickup (${minsUntilCancel} Min Until Auto-Cancel)`;
              const bodyText =
                minsToStart > 0
                  ? `Reminder: Your booked car ${t.registration_plate} for "${t.purpose}" departs in ${minsToStart} minutes. Please head to the pickup point and tap "I Am Here / Confirm Boarding" (auto-cancels 20 min after schedule if no-show).`
                  : `Urgent Reminder: Your booked car ${t.registration_plate} is waiting for "${t.purpose}". Please board now or tap "I Am Here / Confirm Boarding" — slot will auto-cancel in ${minsUntilCancel} minutes if no-show.`;

              sendUserNotification(db, {
                userId: t.requester_id,
                triggerType: 'TRIP_10MIN_DEPARTURE_REMINDER',
                title: titleText,
                body: bodyText,
                relatedEntityType: 'TRIP_REQUEST',
                relatedEntityId: t.id,
              });

              liveEvents.broadcast({
                type: 'DEPARTURE_REMINDER',
                userId: t.requester_id,
                data: {
                  tripId: t.id,
                  title: titleText,
                  body: bodyText,
                  minsToStart,
                  minsUntilCancel,
                },
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
    const rawNotifications = db
      .prepare(
        `SELECT n.*,
                nr.id as negotiation_id,
                nr.action_type as negotiation_action_type,
                COALESCE(nr.status, CASE WHEN n.delivery_status IN ('ACCEPTED', 'REJECTED') THEN n.delivery_status ELSE NULL END) as negotiation_status,
                nr.requester_user_id as negotiation_requester_id,
                req_u.nickname as negotiation_requester_name,
                nr.passenger_nickname as negotiation_passenger_nickname,
                nr.origin as negotiation_origin,
                nr.destination as negotiation_destination,
                nr.purpose as negotiation_purpose,
                nr.message as negotiation_message,
                nr.transferred_trip_id as negotiation_transferred_trip_id,
                tr.origin as negotiation_original_origin,
                tr.destination as negotiation_original_destination,
                tr.start_time as negotiation_start_time,
                tr.end_time as negotiation_end_time,
                v.registration_plate as negotiation_vehicle_plate,
                (v.make || ' ' || v.model) as negotiation_vehicle_name
         FROM notifications n
         LEFT JOIN negotiation_requests nr ON nr.notification_id = n.id
         LEFT JOIN users req_u ON req_u.id = nr.requester_user_id
         LEFT JOIN trip_requests tr ON tr.id = COALESCE(nr.trip_request_id, CASE WHEN n.related_entity_type = 'TRIP_REQUEST' THEN n.related_entity_id ELSE NULL END)
         LEFT JOIN vehicles v ON v.id = tr.vehicle_id
         WHERE n.user_id = ?
         ORDER BY n.id DESC
         LIMIT 50`
      )
      .all(req.user!.id) as any[];

    const tripCheckStmt = db.prepare('SELECT status, passengers_json, passenger_nickname FROM trip_requests WHERE id = ?');
    const notifications = rawNotifications.map((raw) => {
      const n = !raw.negotiation_id ? hydrateLegacyNegotiationNotification(db, raw, Number(req.user!.id)) : raw;
      const trig = String(n.trigger_type || '');
      if (
        !n.negotiation_status &&
        n.related_entity_id &&
        ['NEGOTIATE_HITCHHIKE_REQUEST', 'HITCHHIKE_REQUEST'].includes(trig)
      ) {
        const tr = tripCheckStmt.get(Number(n.related_entity_id)) as any;
        if (!tr || !['PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS'].includes(String(tr.status || ''))) {
          return { ...n, negotiation_status: 'REJECTED' };
        }
        const match =
          String(n.body || '').match(/Passenger(?:\(s\))?\s+to add(?:\s*\(\d+\))?:\s*([^.]+)/i) ||
          String(n.body || '').match(/^([^\s(]+)/);
        const targetNames = String(match?.[1] || '')
          .split(/[,\n]+/)
          .map((s) => s.replace(/^\d+\.\s*/, '').trim().toLowerCase())
          .filter(Boolean);
        const existingHay = `${String(tr.passengers_json || '')} ${String(tr.passenger_nickname || '')}`.toLowerCase();
        if (targetNames.length > 0 && targetNames.every((nm) => existingHay.includes(nm))) {
          return { ...n, negotiation_status: 'ACCEPTED' };
        }
      }
      return n;
    });
    res.set('Cache-Control', 'no-store');
    res.json({ notifications });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const notifId = Number(req.params.id);
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notifId, req.user!.id);
    res.json({ ok: true });
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
  const appRoot = resolveAppRoot();
  const candidateDistDir = path.join(appRoot, 'dist');
  const distDir = fs.existsSync(candidateDistDir) ? candidateDistDir : path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
        }
      },
    }));
    app.get(/^(?!\/api).*/, (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'), (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
    });
  }

  // Periodic background check for 5-min reminders and 20-min auto-cancellations
  const alertTimer = setInterval(() => {
    if (!isSqlEngineReady()) return;
    try {
      checkTripAlertsAndAutoCancellations(getDb());
    } catch {}
  }, 30000);
  if (typeof alertTimer.unref === 'function') {
    alertTimer.unref();
  }

  // Global API JSON error handler: guarantees every /api error returns structured JSON (never Express default HTML 500)
  app.use('/api', (err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const status =
      typeof err?.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;

    console.error(`[GalaxyFleet API Error] ${req.method} ${req.originalUrl} -> ${status}:`, err);

    if (err?.type === 'entity.too.large' || status === 413) {
      res.status(413).json({
        error: 'Uploaded payload exceeds the 12MB server limit. Please resize or compress your image/document.',
        code: 'PAYLOAD_TOO_LARGE',
      });
      return;
    }

    if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && status === 400)) {
      res.status(400).json({
        error: 'Invalid JSON request payload.',
        code: 'INVALID_JSON',
      });
      return;
    }

    const message =
      typeof err?.message === 'string' && err.message.trim()
        ? err.message
        : 'Internal server error';

    res.status(status).json({
      error: message,
      ...(typeof err?.code === 'string' && err.code ? { code: err.code } : {}),
    });
  });

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status =
      typeof err?.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;
    console.error(`[GalaxyFleet HTTP Error] ${req.method} ${req.originalUrl} -> ${status}:`, err);
    res.status(status).type('text/plain').send(status >= 500 ? 'Internal Server Error' : (err?.message || 'Request Error'));
  });

  return app;
}
