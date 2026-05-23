import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { AuthRequest, JwtPayload, UserRole } from '../types';

/** Simple in-process LRU cache to avoid a DB hit on every request. */
interface CacheEntry { tokenVersion: number; isBanned: boolean; emailVerified: boolean; expiresAt: number }
const AUTH_CACHE = new Map<number, CacheEntry>();
const AUTH_CACHE_TTL_MS = 5_000; // 5 s — short enough for ban propagation
const AUTH_CACHE_MAX = 2_000;

function cacheGet(userId: number): CacheEntry | undefined {
  const entry = AUTH_CACHE.get(userId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { AUTH_CACHE.delete(userId); return undefined; }
  return entry;
}

function cacheSet(userId: number, data: Omit<CacheEntry, 'expiresAt'>) {
  if (AUTH_CACHE.size >= AUTH_CACHE_MAX) {
    // Evict the oldest entry (first in insertion order)
    AUTH_CACHE.delete(AUTH_CACHE.keys().next().value!);
  }
  AUTH_CACHE.set(userId, { ...data, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

/** Invalidate the cache for a specific user (call after ban / password change). */
export function invalidateAuthCache(userId: number) {
  AUTH_CACHE.delete(userId);
}

/** Resolve the raw JWT from either the httpOnly session cookie or the Authorization header. */
function extractToken(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (cookies?.rmp_session) return cookies.rmp_session;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Check cache first — avoids a DB round-trip on the hot path
  let cached = cacheGet(payload.id);
  if (!cached) {
    // Fetch token_version, is_banned, AND email_verified in one query
    const { rows: [row] } = await pool.query(
      `SELECT token_version, is_banned, email_verified FROM students WHERE id = $1`,
      [payload.id]
    );
    if (!row) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }
    cacheSet(payload.id, {
      tokenVersion: row.token_version,
      isBanned: row.is_banned,
      emailVerified: row.email_verified,
    });
    cached = cacheGet(payload.id)!;
  }

  if (cached.isBanned || cached.tokenVersion !== payload.tv) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return;
  }

  req.user = payload;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/** Uses email_verified from the auth cache populated by authenticate(). Falls back to DB on miss. */
export async function requireVerified(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
  const cached = cacheGet(req.user.id);
  if (cached) {
    // Fast path — authenticate() already fetched and cached email_verified
    if (!cached.emailVerified) {
      res.status(403).json({ error: 'Please verify your email address before performing this action.' });
      return;
    }
    next();
    return;
  }
  // Cache miss (evicted between authenticate and requireVerified) — fetch all three fields together
  // so we can rebuild a complete, valid cache entry
  const { rows: [s] } = await pool.query(
    `SELECT email_verified, token_version, is_banned FROM students WHERE id = $1`,
    [req.user.id]
  );
  if (!s?.email_verified) {
    res.status(403).json({ error: 'Please verify your email address before performing this action.' });
    return;
  }
  cacheSet(req.user.id, { tokenVersion: s.token_version, isBanned: s.is_banned, emailVerified: s.email_verified });
  next();
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      // Always verify against cache or DB — never trust the JWT payload alone
      let cached = cacheGet(payload.id);
      if (!cached) {
        // Cache miss: fetch all three fields so the cache entry is complete and won't poison requireVerified
        const { rows: [row] } = await pool.query(
          `SELECT token_version, is_banned, email_verified FROM students WHERE id = $1`,
          [payload.id]
        );
        if (row) {
          cacheSet(payload.id, {
            tokenVersion: row.token_version,
            isBanned: row.is_banned,
            emailVerified: row.email_verified, // must read actual value — poisoning with true bypasses requireVerified
          });
          cached = cacheGet(payload.id)!;
        }
      }

      if (cached && !cached.isBanned && cached.tokenVersion === payload.tv) {
        req.user = payload;
      }
      // Otherwise: banned, revoked, or user not found — proceed as unauthenticated
    } catch { /* expired/invalid token — proceed as unauthenticated */ }
  }
  next();
}
