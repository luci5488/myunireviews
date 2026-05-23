import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../config/db';
import { authenticate } from '../middleware/auth';
import { validate, asyncHandler } from '../middleware/validate';
import { AuthRequest } from '../types';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/mailer';

const router = Router();

const registerSchema = z.object({
  email: z.string().email().refine((e) => e.toLowerCase().endsWith('.edu.au'), {
    message: 'Only university email addresses (.edu.au) are allowed.',
  }),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
  password: z.string().min(8).max(72),
  institution_id: z.number().int().positive().optional(),
  year_of_study: z.number().int().min(1).max(10).optional(),
  email_marketing_consent: z.boolean().optional().default(false),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember_me: z.boolean().optional().default(false),
});

const COOKIE_MAX_AGE_MS      = 7  * 24 * 60 * 60 * 1000; // 7 days  — default / token refresh
const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — explicit "remember me"

function signToken(id: number, role: string, tv: number, rm?: boolean) {
  return jwt.sign({ id, role, tv, ...(rm !== undefined ? { rm } : {}) }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as `${number}${'s'|'m'|'h'|'d'}`,
  });
}

/**
 * Set the httpOnly session cookie.
 * - remember=true  → 30-day persistent cookie (user ticked "Remember me")
 * - remember=false → session cookie (no maxAge — cleared when browser closes)
 * - remember omitted → 7-day persistent cookie (token refresh, email verify, etc.)
 */
function setAuthCookie(res: Response, token: string, remember?: boolean) {
  res.cookie('rmp_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // remember=true: 30 days | remember=false: session cookie | omitted: 7-day default
    ...(remember === true  ? { maxAge: REMEMBER_ME_MAX_AGE_MS } :
        remember === false ? {}                                  :
                             { maxAge: COOKIE_MAX_AGE_MS }),
    path: '/',
  });
}

/** Clear the session cookie. */
function clearAuthCookie(res: Response) {
  res.clearCookie('rmp_session', { httpOnly: true, path: '/' });
}

// POST /api/auth/register
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, username, password, institution_id, year_of_study, email_marketing_consent } = req.body;

    let resolvedInstitutionId: number | null = institution_id ?? null;
    let isVerifiedStudent = false;

    if (resolvedInstitutionId) {
      const { rows: [inst] } = await pool.query(
        `SELECT email_domain FROM institutions WHERE id = $1`, [resolvedInstitutionId]
      );
      if (inst?.email_domain && !email.toLowerCase().endsWith(`@${inst.email_domain}`)) {
        res.status(400).json({ error: `This university requires a @${inst.email_domain} email address.` });
        return;
      }
      if (inst?.email_domain && email.toLowerCase().endsWith(`@${inst.email_domain}`)) {
        isVerifiedStudent = true;
      }
    } else {
      // Auto-detect institution from email domain
      const emailDomain = email.toLowerCase().split('@')[1];
      const { rows: [inst] } = await pool.query(
        `SELECT id FROM institutions WHERE email_domain = $1`, [emailDomain]
      );
      if (inst) {
        resolvedInstitutionId = inst.id;
        isVerifiedStudent = true;
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO students (email, username, password_hash, institution_id, year_of_study, email_marketing_consent, is_verified_student)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, username, role, institution_id, email_verified, created_at`,
      [email.toLowerCase(), username, passwordHash, resolvedInstitutionId, year_of_study ?? null, email_marketing_consent ?? false, isVerifiedStudent]
    );

    const student = rows[0];
    const { rows: [instRow] } = await pool.query(
      `SELECT name FROM institutions WHERE id = $1`, [student.institution_id]
    );

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    await pool.query(
      `INSERT INTO email_verification_tokens (student_id, token_hash) VALUES ($1, $2)`,
      [student.id, verifyTokenHash]
    );

    // Best-effort — email failure must not prevent account creation
    let emailSent = true;
    try {
      await sendVerificationEmail(student.email, verifyToken);
    } catch {
      emailSent = false;
    }

    const token = signToken(student.id, student.role, 1); // new account always starts at version 1
    setAuthCookie(res, token);

    res.status(201).json({
      data: {
        token,
        user: {
          id: student.id,
          email: student.email,
          username: student.username,
          role: student.role,
          institution_id: student.institution_id,
          institution_name: instRow?.name ?? null,
          email_verified: student.email_verified,
        },
        emailSent,
      },
      ...(emailSent ? {} : { warning: 'Account created but verification email could not be sent. Use "Resend verification" from your dashboard.' }),
    });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, remember_me } = req.body;

    const { rows } = await pool.query(
      `SELECT s.id, s.email, s.username, s.password_hash, s.role, s.is_banned, s.ban_reason,
              s.email_verified, s.institution_id, i.name AS institution_name
       FROM students s
       LEFT JOIN institutions i ON i.id = s.institution_id
       WHERE s.email = $1`,
      [email]
    );

    const student = rows[0];
    if (!student) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, student.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (student.is_banned) {
      res.status(403).json({ error: 'Account suspended', reason: student.ban_reason });
      return;
    }

    const { rows: [{ token_version }] } = await pool.query(
      `UPDATE students SET last_login_at = NOW() WHERE id = $1 RETURNING token_version`,
      [student.id]
    );

    const token = signToken(student.id, student.role, token_version, !!remember_me);
    // remember_me=true → 30-day cookie; false → session cookie (cleared on browser close)
    setAuthCookie(res, token, !!remember_me);

    res.json({
      data: {
        token,
        user: {
          id: student.id,
          email: student.email,
          username: student.username,
          role: student.role,
          institution_id: student.institution_id,
          institution_name: student.institution_name ?? null,
          email_verified: student.email_verified,
        },
      },
    });
  })
);

// GET /api/auth/me  — also returns a fresh token so the client can rehydrate after a page reload
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows } = await pool.query(
      `SELECT s.id, s.email, s.username, s.role, s.year_of_study, s.email_verified, s.created_at,
              s.is_banned, s.token_version, i.name AS institution_name
       FROM students s
       LEFT JOIN institutions i ON i.id = s.institution_id
       WHERE s.id = $1`,
      [req.user!.id]
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (rows[0].is_banned) {
      clearAuthCookie(res);
      res.status(403).json({ error: 'Account suspended.' });
      return;
    }

    // Issue a fresh token — carry the original rm flag so the cookie type (session vs persistent) is preserved
    const rm = req.user!.rm;
    const freshToken = signToken(req.user!.id, req.user!.role, rows[0].token_version, rm);
    setAuthCookie(res, freshToken, rm);  // slide the cookie expiry forward, preserving the original remember-me intent

    // Strip internal fields before sending — token_version and is_banned must not reach the client
    const { is_banned: _b, token_version: _tv, ...publicUser } = rows[0];
    res.json({ data: publicUser, token: freshToken });
  })
);

// POST /api/auth/logout
router.post(
  '/logout',
  asyncHandler(async (_req: Request, res: Response) => {
    clearAuthCookie(res);
    res.json({ message: 'Logged out successfully.' });
  })
);

// GET /api/auth/me/reviews  — all reviews submitted by the current user
router.get(
  '/me/reviews',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows } = await pool.query(
      `SELECT
         r.id, r.overall_rating, r.difficulty_rating, r.would_take_again,
         r.comment, r.semester, r.year, r.is_anonymous, r.status,
         r.created_at, r.updated_at, r.is_edited,
         p.id         AS professor_id,
         p.first_name AS professor_first_name,
         p.last_name  AS professor_last_name,
         p.title      AS professor_title,
         i.name       AS institution_name,
         c.code       AS course_code,
         r.course_text,
         (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.vote = 'helpful')     AS helpful_votes,
         (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.vote = 'not_helpful') AS not_helpful_votes
       FROM reviews r
       JOIN professors p ON p.id = r.professor_id
       JOIN institutions i ON i.id = p.institution_id
       LEFT JOIN courses c ON c.id = r.course_id
       WHERE r.student_id = $1
       ORDER BY r.created_at DESC`,
      [req.user!.id]
    );
    res.json({ data: rows });
  })
);

// GET /api/auth/verify-email/:token
router.get(
  '/verify-email/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const incomingHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const { rows: [tokenRow] } = await pool.query(
      `SELECT id, student_id, expires_at, used_at
       FROM email_verification_tokens WHERE token_hash = $1`,
      [incomingHash]
    );

    if (!tokenRow || tokenRow.used_at) {
      res.status(400).json({ error: 'Invalid or already used verification link.' });
      return;
    }
    if (new Date(tokenRow.expires_at) < new Date()) {
      res.status(400).json({ error: 'Verification link has expired. Request a new one.' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE students SET email_verified = TRUE WHERE id = $1`, [tokenRow.student_id]);
      await client.query(`UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`, [tokenRow.id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: 'Email verified successfully! You now have full access.' });
  })
);

// POST /api/auth/resend-verification
router.post(
  '/resend-verification',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows: [student] } = await pool.query(
      `SELECT id, email, email_verified FROM students WHERE id = $1`,
      [req.user!.id]
    );

    if (student?.email_verified) {
      res.status(400).json({ error: 'Email is already verified.' });
      return;
    }

    // Enforce 60-second cooldown between resend requests
    const { rows: [existing] } = await pool.query(
      `SELECT created_at FROM email_verification_tokens WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user!.id]
    );
    if (existing) {
      const secondsSinceLast = (Date.now() - new Date(existing.created_at).getTime()) / 1000;
      if (secondsSinceLast < 60) {
        res.status(429).json({ error: `Please wait ${Math.ceil(60 - secondsSinceLast)} seconds before requesting another email.` });
        return;
      }
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');

    // Atomic: delete old token and insert new one together so we never leave the user token-less
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM email_verification_tokens WHERE student_id = $1`, [req.user!.id]);
      await client.query(
        `INSERT INTO email_verification_tokens (student_id, token_hash) VALUES ($1, $2)`,
        [req.user!.id, verifyTokenHash]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Email send is best-effort; DB is already consistent regardless of send outcome
    sendVerificationEmail(student.email, verifyToken).catch(() => {});

    res.json({ message: 'Verification email sent. Check your inbox.' });
  })
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }

    // Always return the same message to prevent email enumeration
    const SUCCESS = { message: 'If an account with that email exists, a password reset link has been sent.' };

    const { rows: [student] } = await pool.query(
      `SELECT id, email FROM students WHERE email = $1 AND email_verified = TRUE`,
      [email.toLowerCase()]
    );
    if (!student) { res.json(SUCCESS); return; }

    // Invalidate any existing reset tokens for this student
    await pool.query(`DELETE FROM password_reset_tokens WHERE student_id = $1`, [student.id]);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (student_id, token_hash) VALUES ($1, $2)`,
      [student.id, tokenHash]
    );

    await sendPasswordResetEmail(student.email, rawToken).catch(() => { /* best-effort */ });
    res.json(SUCCESS);
  })
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  validate(z.object({
    token: z.string().min(1),
    password: z.string().min(8).max(72),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { token: rawToken, password } = req.body as { token: string; password: string };
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const { rows: [tokenRow] } = await pool.query(
      `SELECT id, student_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    if (!tokenRow || tokenRow.used_at) {
      res.status(400).json({ error: 'Invalid or already used reset link.' });
      return;
    }
    if (new Date(tokenRow.expires_at) < new Date()) {
      res.status(400).json({ error: 'Reset link has expired. Request a new one.' });
      return;
    }

    const { rows: [student] } = await pool.query(
      `SELECT password_hash FROM students WHERE id = $1`,
      [tokenRow.student_id]
    );
    const sameAsOld = await bcrypt.compare(password, student.password_hash);
    if (sameAsOld) {
      res.status(400).json({ error: 'Your new password must be different from your current password.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Increment token_version to invalidate all existing sessions — mirrors change-password behaviour
      await client.query(
        `UPDATE students SET password_hash = $1, token_version = token_version + 1 WHERE id = $2`,
        [passwordHash, tokenRow.student_id]
      );
      await client.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [tokenRow.id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: 'Password updated successfully. You can now log in.' });
  })
);

// GET /api/auth/me/notifications
router.get(
  '/me/notifications',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows: [prefs] } = await pool.query(
      `SELECT notif_upvotes, notif_bookmarked_reviews FROM students WHERE id = $1`,
      [req.user!.id]
    );
    if (!prefs) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ data: prefs });
  })
);

// PATCH /api/auth/me/notifications
router.patch(
  '/me/notifications',
  authenticate,
  validate(z.object({
    notif_upvotes: z.boolean().optional(),
    notif_bookmarked_reviews: z.boolean().optional(),
  })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { notif_upvotes, notif_bookmarked_reviews } = req.body as { notif_upvotes?: boolean; notif_bookmarked_reviews?: boolean };

    const sets: string[] = [];
    const params: unknown[] = [];
    if (notif_upvotes !== undefined) { params.push(notif_upvotes); sets.push(`notif_upvotes = $${params.length}`); }
    if (notif_bookmarked_reviews !== undefined) { params.push(notif_bookmarked_reviews); sets.push(`notif_bookmarked_reviews = $${params.length}`); }
    if (!sets.length) { res.status(400).json({ error: 'No fields to update' }); return; }

    params.push(req.user!.id);
    await pool.query(`UPDATE students SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ message: 'Notification preferences saved.' });
  })
);

// PATCH /api/auth/me/profile  — update username
router.patch(
  '/me/profile',
  authenticate,
  validate(z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only').optional(),
  })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { username } = req.body as { username?: string };
    if (!username) { res.status(400).json({ error: 'No fields to update' }); return; }

    const { rows: [taken] } = await pool.query(
      `SELECT 1 FROM students WHERE username = $1 AND id != $2`,
      [username, req.user!.id]
    );
    if (taken) { res.status(409).json({ error: 'Username is already taken.' }); return; }

    const { rows: [updated] } = await pool.query(
      `UPDATE students SET username = $1 WHERE id = $2
       RETURNING id, email, username, role, institution_id, email_verified, token_version`,
      [username, req.user!.id]
    );
    const freshToken = signToken(updated.id, updated.role, updated.token_version);
    setAuthCookie(res, freshToken);
    // Strip token_version before sending — it's internal state and must not reach the client
    const { token_version: _tv, ...publicUpdated } = updated;
    res.json({ data: publicUpdated, token: freshToken });
  })
);

// POST /api/auth/me/change-password
router.post(
  '/me/change-password',
  authenticate,
  validate(z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(8).max(72),
  })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { current_password, new_password } = req.body as { current_password: string; new_password: string };

    const { rows: [student] } = await pool.query(
      `SELECT password_hash FROM students WHERE id = $1`,
      [req.user!.id]
    );
    if (!student) { res.status(404).json({ error: 'User not found' }); return; }

    const valid = await bcrypt.compare(current_password, student.password_hash);
    if (!valid) { res.status(400).json({ error: 'Current password is incorrect' }); return; }

    const newHash = await bcrypt.hash(new_password, 12);
    // Increment token_version to invalidate all existing sessions immediately
    const { rows: [updated] } = await pool.query(
      `UPDATE students SET password_hash = $1, token_version = token_version + 1
       WHERE id = $2 RETURNING token_version, role`,
      [newHash, req.user!.id]
    );
    const freshToken = signToken(req.user!.id, updated.role, updated.token_version);
    setAuthCookie(res, freshToken);
    res.json({ message: 'Password updated' });
  })
);

// GET /api/auth/me/notifications/inbox  — derived notification events
router.get(
  '/me/notifications/inbox',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const [approvedRes, helpfulRes, bookmarkedRes, suggestionRes, studentRes] = await Promise.all([
      pool.query(
        `SELECT r.id, r.professor_id, r.updated_at, p.first_name, p.last_name
         FROM reviews r JOIN professors p ON p.id = r.professor_id
         WHERE r.student_id = $1 AND r.status = 'approved'
           AND r.updated_at > NOW() - INTERVAL '60 days'
         ORDER BY r.updated_at DESC LIMIT 10`,
        [userId]
      ),
      pool.query(
        `SELECT r.id, r.professor_id, r.updated_at, p.first_name, p.last_name,
                COUNT(rv.id) AS helpful_votes
         FROM reviews r
         JOIN professors p ON p.id = r.professor_id
         LEFT JOIN review_votes rv ON rv.review_id = r.id AND rv.vote = 'helpful'
         WHERE r.student_id = $1 AND r.status = 'approved'
         GROUP BY r.id, r.professor_id, r.updated_at, p.first_name, p.last_name
         HAVING COUNT(rv.id) > 0
         ORDER BY helpful_votes DESC LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT p.id AS professor_id, p.first_name, p.last_name,
                COUNT(r.id) AS new_reviews, MAX(r.created_at) AS latest_review
         FROM bookmarks b
         JOIN professors p ON p.id = b.professor_id
         JOIN reviews r ON r.professor_id = p.id
         WHERE b.student_id = $1 AND r.status = 'approved'
           AND r.created_at > NOW() - INTERVAL '30 days'
         GROUP BY p.id, p.first_name, p.last_name
         HAVING COUNT(r.id) > 0
         ORDER BY latest_review DESC LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT ps.id, ps.first_name, ps.last_name, ps.professor_id, ps.resolved_at
         FROM professor_suggestions ps
         WHERE ps.suggested_by = $1 AND ps.status = 'approved'
           AND ps.resolved_at > NOW() - INTERVAL '60 days'
         ORDER BY ps.resolved_at DESC LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT notifications_last_seen_at FROM students WHERE id = $1`,
        [userId]
      ),
    ]);

    const lastSeen: Date | null = studentRes.rows[0]?.notifications_last_seen_at ?? null;

    type NotifItem = { type: string; message: string; link?: string; created_at: string };
    const items: NotifItem[] = [];

    for (const r of approvedRes.rows) {
      items.push({ type: 'review_approved', message: `Your review of ${r.first_name} ${r.last_name} was approved`, link: `/professors/${r.professor_id}`, created_at: new Date(r.updated_at).toISOString() });
    }
    for (const r of helpfulRes.rows) {
      const v = Number(r.helpful_votes);
      items.push({ type: 'helpful_votes', message: `Your review of ${r.first_name} ${r.last_name} has ${v} helpful vote${v !== 1 ? 's' : ''}`, link: `/professors/${r.professor_id}`, created_at: new Date(r.updated_at).toISOString() });
    }
    for (const r of bookmarkedRes.rows) {
      const n = Number(r.new_reviews);
      items.push({ type: 'bookmarked_review', message: `${n} new review${n !== 1 ? 's' : ''} on ${r.first_name} ${r.last_name}`, link: `/professors/${r.professor_id}`, created_at: new Date(r.latest_review).toISOString() });
    }
    for (const s of suggestionRes.rows) {
      items.push({
        type: 'suggestion_approved',
        message: `Your suggestion for ${s.first_name} ${s.last_name} was approved — they're now on the platform!`,
        link: s.professor_id ? `/professors/${s.professor_id}` : undefined,
        created_at: new Date(s.resolved_at).toISOString(),
      });
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const data = items.slice(0, 20);
    const unread_count = lastSeen ? data.filter(i => new Date(i.created_at) > lastSeen).length : data.length;

    res.json({ data, unread_count });
  })
);

// PATCH /api/auth/me/notifications/inbox/seen  — reset unread count
router.patch(
  '/me/notifications/inbox/seen',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await pool.query(`UPDATE students SET notifications_last_seen_at = NOW() WHERE id = $1`, [req.user!.id]);
    res.json({ message: 'Marked as seen' });
  })
);

// DELETE /api/auth/me  — account deletion (anonymises reviews, deletes personal data)
router.delete(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const studentId = req.user!.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Keep review content but remove personal link
      await client.query(
        `UPDATE reviews SET student_id = NULL, is_anonymous = TRUE WHERE student_id = $1`,
        [studentId]
      );
      await client.query(`DELETE FROM students WHERE id = $1`, [studentId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    clearAuthCookie(res);
    res.json({ message: 'Account deleted successfully.' });
  })
);

export default router;
