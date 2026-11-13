import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from './db.ts';
import { recordAudit } from './audit.ts';

export interface AuthenticatedUser {
  id: number;
  nickname: string;
  group_username: string;
  role: 'ADM' | 'FM' | 'HWS' | 'DRV' | 'EMP';
  is_department_admin: number;
  department_id: number;
  department_name?: string;
  approval_status: string;
  is_active: number;
  driver_profile_id?: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionToken?: string;
    }
  }
}

const TOKEN_SECRET = process.env.SESSION_SECRET || 'fms-internal-hmac-secret-2026-secure-key';

export function createSessionToken(userId: number, sessionId: string): string {
  const payload = `${sessionId}.${userId}`;
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifySignedToken(rawToken: string): { sessionId: string; userId: number } | null {
  const parts = rawToken.split('.');
  if (parts.length !== 3) return null;
  const [sessionId, userIdStr, sig] = parts;
  const payload = `${sessionId}.${userIdStr}`;
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  const userId = Number(userIdStr);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return { sessionId, userId };
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('fms_session='));
    if (match) {
      return decodeURIComponent(match.split('=')[1]);
    }
  }
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const db = getDb();
  const rawToken = extractToken(req);
  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required (AUTH-01)' });
    return;
  }

  const parsed = verifySignedToken(rawToken);
  const sessionKey = parsed ? parsed.sessionId : rawToken;

  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(sessionKey) as
    | {
        token: string;
        user_id: number;
        created_at: number;
        last_active_at: number;
        expires_at: number;
        revoked: number;
      }
    | undefined;

  const now = Date.now();
  const idleMinutesRow = db.prepare("SELECT value FROM system_settings WHERE key = 'session_idle_timeout_minutes'").get() as { value: string } | undefined;
  const idleTimeoutMs = (Number(idleMinutesRow?.value) || 60) * 60 * 1000;

  let userId: number;

  if (session) {
    if (session.revoked === 1) {
      res.status(401).json({ error: 'Session has been signed out (AUTH-07)' });
      return;
    }
    if (now > session.expires_at || now - session.last_active_at > idleTimeoutMs) {
      db.prepare('UPDATE sessions SET revoked = 1 WHERE token = ?').run(sessionKey);
      res.status(401).json({ error: 'Session expired due to inactivity (AUTH-07)' });
      return;
    }
    db.prepare('UPDATE sessions SET last_active_at = ? WHERE token = ?').run(now, sessionKey);
    userId = session.user_id;
  } else if (parsed && process.env.VERCEL) {
    // Re-hydrate session on cold Vercel serverless instance if valid HMAC token
    db.prepare('INSERT OR IGNORE INTO sessions (token, user_id, created_at, last_active_at, expires_at, revoked) VALUES (?, ?, ?, ?, ?, 0)').run(
      parsed.sessionId,
      parsed.userId,
      now,
      now,
      now + 24 * 3600 * 1000
    );
    userId = parsed.userId;
  } else {
    res.status(401).json({ error: 'Invalid or expired session token (AUTH-01)' });
    return;
  }

  const user = db.prepare(`
    SELECT u.id, u.nickname, u.group_username, u.role, u.is_department_admin,
           u.department_id, d.name as department_name, u.approval_status, u.is_active,
           dp.id as driver_profile_id
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN driver_profiles dp ON dp.user_id = u.id
    WHERE u.id = ?
  `).get(userId) as AuthenticatedUser | undefined;

  if (!user || user.is_active === 0) {
    res.status(401).json({ error: 'User account is deactivated or not found (ORG-04)' });
    return;
  }

  if (user.approval_status !== 'APPROVED') {
    res.status(403).json({ error: 'Account registration is pending Administrator approval' });
    return;
  }

  req.user = user;
  req.sessionToken = sessionKey;
  next();
}

export function isPrivilegedRole(user: AuthenticatedUser): boolean {
  return user.role === 'ADM' || user.role === 'FM' || user.role === 'HWS';
}

export function requireRoles(allowedRoles: Array<'ADM' | 'FM' | 'HWS' | 'DRV' | 'EMP'>, allowDepartmentAdmin = false) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const db = getDb();
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const roleAllowed = allowedRoles.includes(user.role) || (allowDepartmentAdmin && user.is_department_admin === 1);
    if (!roleAllowed) {
      recordAudit(
        db,
        user,
        'PERMISSION_DENIED',
        'ENDPOINT',
        `${req.method} ${req.originalUrl}`,
        null,
        null,
        { requiredRoles: allowedRoles, userRole: user.role }
      );
      res.status(403).json({ error: 'Forbidden: insufficient permissions (AUTH-05)' });
      return;
    }

    next();
  };
}
