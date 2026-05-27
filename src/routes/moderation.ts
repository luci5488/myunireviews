import { Router, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { validate, asyncHandler, paginate } from '../middleware/validate';
import { escapeLike, parseId } from '../lib/parseId';
import { AuthRequest } from '../types';
import { sendSuggestionApprovedEmail, sendBookmarkedReviewNotification, sendReviewApprovedEmail, sendReviewRejectedEmail } from '../lib/mailer';
import { emitReviewApproved } from '../lib/reviewEvents';

const router = Router();

// All moderation routes require at minimum 'moderator' role
router.use(authenticate, requireRole('moderator', 'admin'));

async function logAction(
  moderatorId: number,
  action: string,
  entityType: string,
  entityId: number,
  reason?: string,
  metadata?: object
) {
  await pool.query(
    `INSERT INTO moderation_logs (moderator_id, action, entity_type, entity_id, reason, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [moderatorId, action, entityType, entityId, reason ?? null, metadata ? JSON.stringify(metadata) : null]
  );
}

// ─── REVIEW QUEUE ────────────────────────────────────────────

// GET /api/moderation/reviews?status=pending|flagged
router.get(
  '/reviews',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const status = (req.query.status as string) ?? 'pending';
    if (!['pending', 'flagged'].includes(status)) {
      res.status(400).json({ error: 'status must be pending or flagged' });
      return;
    }

    const { page, limit, offset } = paginate(req.query);

    const [countResult, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM reviews WHERE status = $1`, [status]),
      pool.query(
        `SELECT
           r.id, r.overall_rating, r.difficulty_rating, r.comment,
           r.semester, r.year, r.is_anonymous, r.status, r.created_at,
           s.username     AS reviewer_username,
           s.email        AS reviewer_email,
           p.first_name   AS professor_first_name,
           p.last_name    AS professor_last_name,
           c.code         AS course_code,
           c.name         AS course_name,
           r.course_text,
           (SELECT COUNT(*) FROM review_reports rr WHERE rr.review_id = r.id AND rr.status = 'pending') AS pending_reports
         FROM reviews r
         JOIN students s   ON s.id = r.student_id
         JOIN professors p ON p.id = r.professor_id
         LEFT JOIN courses c ON c.id = r.course_id
         WHERE r.status = $1
         ORDER BY r.created_at ASC
         LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: rows.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  })
);

// PATCH /api/moderation/reviews/:id/approve
router.patch(
  '/reviews/:id/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid review ID' }); return; }

    const { rows: [review] } = await pool.query(
      `UPDATE reviews
       SET status = 'approved', moderated_by = $1, moderated_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status IN ('pending','flagged')
       RETURNING id, status, professor_id, student_id`,
      [req.user!.id, id]
    );

    if (!review) {
      res.status(404).json({ error: 'Review not found or not in a reviewable state' });
      return;
    }

    await logAction(req.user!.id, 'approve_review', 'review', review.id);
    emitReviewApproved(review.professor_id);

    // Notify reviewer (fire-and-forget)
    pool.query(
      `SELECT s.email, p.first_name, p.last_name, p.id AS professor_id
       FROM students s JOIN professors p ON p.id = $1
       WHERE s.id = $2 AND s.email IS NOT NULL`,
      [review.professor_id, review.student_id]
    ).then(({ rows }) => {
      if (rows[0]) {
        const r = rows[0];
        sendReviewApprovedEmail(r.email, `${r.first_name} ${r.last_name}`, r.professor_id).catch(() => {});
      }
    }).catch(() => {});

    // Notify bookmarkers (fire-and-forget)
    pool.query(
      `SELECT s.email, p.first_name, p.last_name, p.id AS professor_id
       FROM bookmarks b
       JOIN students s ON s.id = b.student_id
       JOIN professors p ON p.id = b.professor_id
       WHERE b.professor_id = $1 AND s.notif_bookmarked_reviews = TRUE AND s.email IS NOT NULL`,
      [review.professor_id]
    ).then(({ rows }) => {
      rows.forEach((r) => {
        sendBookmarkedReviewNotification(r.email, `${r.first_name} ${r.last_name}`, r.professor_id).catch(() => {});
      });
    }).catch(() => {});

    res.json({ data: review, message: 'Review approved and is now publicly visible.' });
  })
);

// PATCH /api/moderation/reviews/:id/reject
router.patch(
  '/reviews/:id/reject',
  validate(z.object({ reason: z.string().min(5).max(500) })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid review ID' }); return; }

    const { rows: [review] } = await pool.query(
      `UPDATE reviews
       SET status = 'rejected', rejection_reason = $1,
           moderated_by = $2, moderated_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND status IN ('pending','flagged','approved')
       RETURNING id, status, student_id, professor_id`,
      [req.body.reason, req.user!.id, id]
    );

    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    await logAction(req.user!.id, 'reject_review', 'review', review.id, req.body.reason);

    // Notify reviewer (fire-and-forget)
    pool.query(
      `SELECT s.email, p.first_name, p.last_name
       FROM students s JOIN professors p ON p.id = $1
       WHERE s.id = $2 AND s.email IS NOT NULL`,
      [review.professor_id, review.student_id]
    ).then(({ rows }) => {
      if (rows[0]) {
        const r = rows[0];
        sendReviewRejectedEmail(r.email, `${r.first_name} ${r.last_name}`, req.body.reason).catch(() => {});
      }
    }).catch(() => {});

    res.json({ data: review, message: 'Review rejected and removed from public view.' });
  })
);

// ─── REPORTS QUEUE ───────────────────────────────────────────

// GET /api/moderation/reports
router.get(
  '/reports',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { page, limit, offset } = paginate(req.query);

    const [countResult, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM review_reports WHERE status = 'pending'`),
      pool.query(
        `SELECT
           rr.id, rr.status, rr.additional_info, rr.created_at,
           rr.review_id,
           r.comment          AS review_comment,
           r.status           AS review_status,
           r.overall_rating,
           reason.name        AS report_reason,
           reporter.username  AS reported_by_username,
           prof.first_name    AS professor_first_name,
           prof.last_name     AS professor_last_name
         FROM review_reports rr
         JOIN reviews r         ON r.id = rr.review_id
         JOIN students reporter ON reporter.id = rr.reported_by
         JOIN professors prof   ON prof.id = r.professor_id
         LEFT JOIN report_reasons reason ON reason.id = rr.reason_id
         WHERE rr.status = 'pending'
         ORDER BY rr.created_at ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: rows.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  })
);

// PATCH /api/moderation/reports/:id/dismiss
router.patch(
  '/reports/:id/dismiss',
  validate(z.object({ note: z.string().max(500).optional() })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid report ID' }); return; }

    const { rows: [report] } = await pool.query(
      `UPDATE review_reports
       SET status = 'dismissed', reviewed_by = $1, reviewed_at = NOW(), moderator_note = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING id, status, review_id`,
      [req.user!.id, req.body.note ?? null, id]
    );

    if (!report) {
      res.status(404).json({ error: 'Report not found or already resolved' });
      return;
    }

    await logAction(req.user!.id, 'dismiss_report', 'review_report', report.id, req.body.note);
    res.json({ data: report, message: 'Report dismissed.' });
  })
);

// PATCH /api/moderation/reports/:id/action
// Actions the report: marks it actioned AND rejects the associated review
router.patch(
  '/reports/:id/action',
  validate(z.object({ reason: z.string().min(5).max(500) })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid report ID' }); return; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [report] } = await client.query(
        `UPDATE review_reports
         SET status = 'actioned', reviewed_by = $1, reviewed_at = NOW(), moderator_note = $2
         WHERE id = $3 AND status = 'pending'
         RETURNING id, review_id`,
        [req.user!.id, req.body.reason, id]
      );

      if (!report) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Report not found or already resolved' });
        return;
      }

      // Reject the associated review and fetch student/professor info for the notification email
      const { rows: [reviewInfo] } = await client.query(
        `UPDATE reviews r
         SET status = 'rejected', rejection_reason = $1,
             moderated_by = $2, moderated_at = NOW(), updated_at = NOW()
         FROM students s, professors p
         WHERE r.id = $3
           AND s.id = r.student_id
           AND p.id = r.professor_id
         RETURNING s.email AS student_email, p.first_name, p.last_name`,
        [req.body.reason, req.user!.id, report.review_id]
      );

      await client.query('COMMIT');

      await logAction(req.user!.id, 'action_report', 'review_report', report.id, req.body.reason, {
        review_id: report.review_id,
      });

      // Notify the student their review was removed — fire-and-forget, same as the dedicated reject endpoint
      if (reviewInfo?.student_email) {
        sendReviewRejectedEmail(
          reviewInfo.student_email,
          `${reviewInfo.first_name} ${reviewInfo.last_name}`,
          req.body.reason
        ).catch(() => {});
      }

      res.json({ data: report, message: 'Report actioned and review has been removed.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// ─── STUDENT MANAGEMENT (admin only) ─────────────────────────

// GET /api/moderation/students
router.get(
  '/students',
  requireRole('admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { page, limit, offset } = paginate(req.query);
    const { search, banned } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${escapeLike(search)}%`);
      conditions.push(`(username ILIKE $${params.length} ESCAPE '\\' OR email ILIKE $${params.length} ESCAPE '\\')`);
    }
    if (banned === 'true') conditions.push('is_banned = TRUE');
    if (banned === 'false') conditions.push('is_banned = FALSE');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM students ${where}`, params),
      pool.query(
        `SELECT id, email, username, role, is_banned, ban_reason, created_at, last_login_at
         FROM students ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: rows.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  })
);

// PATCH /api/moderation/students/:id/ban
router.patch(
  '/students/:id/ban',
  requireRole('admin'),
  validate(z.object({ reason: z.string().min(5).max(500) })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const targetId = parseId(req.params.id);
    if (!targetId) { res.status(400).json({ error: 'Invalid student ID' }); return; }
    if (targetId === req.user!.id) {
      res.status(400).json({ error: 'Cannot ban yourself' });
      return;
    }

    const { rows: [student] } = await pool.query(
      `UPDATE students
       SET is_banned = TRUE, ban_reason = $1, banned_at = NOW(),
           token_version = token_version + 1
       WHERE id = $2 AND is_banned = FALSE
       RETURNING id, username, is_banned`,
      [req.body.reason, targetId]
    );

    if (!student) {
      res.status(404).json({ error: 'Student not found or already banned' });
      return;
    }

    await logAction(req.user!.id, 'ban_student', 'student', student.id, req.body.reason);
    res.json({ data: student, message: `Account ${student.username} has been suspended.` });
  })
);

// PATCH /api/moderation/students/:id/unban
router.patch(
  '/students/:id/unban',
  requireRole('admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const targetId = parseId(req.params.id);
    if (!targetId) { res.status(400).json({ error: 'Invalid student ID' }); return; }

    const { rows: [student] } = await pool.query(
      `UPDATE students
       SET is_banned = FALSE, ban_reason = NULL, banned_at = NULL
       WHERE id = $1 AND is_banned = TRUE
       RETURNING id, username, is_banned`,
      [targetId]
    );

    if (!student) {
      res.status(404).json({ error: 'Student not found or not currently banned' });
      return;
    }

    await logAction(req.user!.id, 'unban_student', 'student', student.id);
    res.json({ data: student, message: `Account ${student.username} has been reinstated.` });
  })
);

// ─── PROFESSOR CLAIMS ─────────────────────────────────────────

// GET /api/moderation/claims
router.get(
  '/claims',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { page, limit, offset } = paginate(req.query);

    const [countResult, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM professor_claims WHERE status = 'pending'`),
      pool.query(
        `SELECT
           pc.id, pc.status, pc.institution_email, pc.staff_id,
           pc.additional_info, pc.created_at,
           p.id           AS professor_id,
           p.first_name   AS professor_first_name,
           p.last_name    AS professor_last_name,
           i.name         AS institution_name,
           s.username     AS claimant_username,
           s.email        AS claimant_email
         FROM professor_claims pc
         JOIN professors p  ON p.id = pc.professor_id
         JOIN students s    ON s.id = pc.claimant_id
         LEFT JOIN institutions i ON i.id = p.institution_id
         WHERE pc.status = 'pending'
         ORDER BY pc.created_at ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: rows.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  })
);

// PATCH /api/moderation/claims/:id/approve
router.patch(
  '/claims/:id/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const claimId = parseId(req.params.id);
    if (!claimId) { res.status(400).json({ error: 'Invalid claim ID' }); return; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [claim] } = await client.query(
        `UPDATE professor_claims
         SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
         WHERE id = $2 AND status = 'pending'
         RETURNING id, professor_id`,
        [req.user!.id, claimId]
      );

      if (!claim) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Claim not found or already resolved.' });
        return;
      }

      await client.query(
        `UPDATE professors SET is_verified = TRUE WHERE id = $1`,
        [claim.professor_id]
      );

      await client.query('COMMIT');
      await logAction(req.user!.id, 'approve_claim', 'professor_claim', claim.id);
      res.json({ data: claim, message: 'Claim approved. Professor profile is now verified.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// PATCH /api/moderation/claims/:id/reject
router.patch(
  '/claims/:id/reject',
  validate(z.object({ reason: z.string().min(5).max(500) })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const claimId = parseId(req.params.id);
    if (!claimId) { res.status(400).json({ error: 'Invalid claim ID' }); return; }

    const { rows: [claim] } = await pool.query(
      `UPDATE professor_claims
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), moderator_note = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING id, professor_id`,
      [req.user!.id, req.body.reason, claimId]
    );

    if (!claim) {
      res.status(404).json({ error: 'Claim not found or already resolved.' });
      return;
    }

    await logAction(req.user!.id, 'reject_claim', 'professor_claim', claim.id, req.body.reason);
    res.json({ data: claim, message: 'Claim rejected.' });
  })
);

// GET /api/moderation/suggestions
router.get(
  '/suggestions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { page, limit, offset } = paginate(req.query);
    const [countResult, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM professor_suggestions WHERE status = 'pending'`),
      pool.query(
        `SELECT ps.id, ps.first_name, ps.last_name, ps.title, ps.email, ps.notes,
                ps.status, ps.created_at,
                ps.verification_status, ps.verification_source, ps.verification_score,
                i.name AS institution_name,
                d.name AS department_name,
                s.username AS suggested_by_username
         FROM professor_suggestions ps
         LEFT JOIN institutions i ON i.id = ps.institution_id
         LEFT JOIN departments d ON d.id = ps.department_id
         LEFT JOIN students s ON s.id = ps.suggested_by
         WHERE ps.status = 'pending'
         ORDER BY ps.created_at ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.json({ data: rows.rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  })
);

// PATCH /api/moderation/suggestions/:id/approve
router.patch(
  '/suggestions/:id/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const suggestionId = parseId(req.params.id);
    if (!suggestionId) { res.status(400).json({ error: 'Invalid suggestion ID' }); return; }

    const { rows: [s] } = await pool.query(
      `SELECT * FROM professor_suggestions WHERE id = $1 AND status = 'pending'`,
      [suggestionId]
    );
    if (!s) { res.status(404).json({ error: 'Suggestion not found' }); return; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [prof] } = await client.query(
        `INSERT INTO professors (institution_id, department_id, first_name, last_name, title, email)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [s.institution_id, s.department_id ?? null, s.first_name, s.last_name, s.title ?? 'Lecturer', s.email ?? null]
      );
      await client.query(
        `UPDATE professor_suggestions SET status = 'approved', resolved_by = $1, resolved_at = NOW(), professor_id = $3 WHERE id = $2`,
        [req.user!.id, s.id, prof.id]
      );
      await client.query('COMMIT');
      await logAction(req.user!.id, 'approve_suggestion', 'professor_suggestion', s.id);

      // Notify the student who made the suggestion
      const { rows: [student] } = await pool.query(
        `SELECT email FROM students WHERE id = $1`,
        [s.suggested_by]
      );
      if (student?.email) {
        const professorName = `${s.first_name} ${s.last_name}`;
        sendSuggestionApprovedEmail(student.email, professorName, prof.id).catch(() => {});
      }

      res.json({ message: 'Professor added to the platform.', professor_id: prof.id });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// PATCH /api/moderation/suggestions/:id/reject
router.patch(
  '/suggestions/:id/reject',
  validate(z.object({ reason: z.string().min(1) })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const suggestionId = parseId(req.params.id);
    if (!suggestionId) { res.status(400).json({ error: 'Invalid suggestion ID' }); return; }

    const { rows: [s] } = await pool.query(
      `UPDATE professor_suggestions SET status = 'rejected', resolved_by = $1, resolved_at = NOW(), notes = $2
       WHERE id = $3 AND status = 'pending' RETURNING id`,
      [req.user!.id, req.body.reason, suggestionId]
    );
    if (!s) { res.status(404).json({ error: 'Suggestion not found' }); return; }
    await logAction(req.user!.id, 'reject_suggestion', 'professor_suggestion', s.id, req.body.reason);
    res.json({ message: 'Suggestion rejected.' });
  })
);

// ─── PROFESSOR MANAGEMENT ─────────────────────────────────────

// GET /api/moderation/professors
router.get(
  '/professors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { page, limit, offset } = paginate(req.query);
    const search = req.query.search as string | undefined;

    const params: unknown[] = [];
    let where = '';
    if (search) {
      params.push(`%${escapeLike(search)}%`);
      where = `WHERE (p.first_name ILIKE $1 ESCAPE '\\' OR p.last_name ILIKE $1 ESCAPE '\\')`;
    }

    const [countResult, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM professors p ${where}`, params),
      pool.query(
        `SELECT p.id, p.first_name, p.last_name, p.title, p.email,
                p.is_verified, p.is_active, p.created_at,
                i.name AS institution_name,
                d.name AS department_name,
                p.institution_id, p.department_id,
                COUNT(r.id) AS review_count
         FROM professors p
         LEFT JOIN institutions i ON i.id = p.institution_id
         LEFT JOIN departments d ON d.id = p.department_id
         LEFT JOIN reviews r ON r.professor_id = p.id AND r.status = 'approved'
         ${where}
         GROUP BY p.id, i.name, d.name
         ORDER BY p.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    res.json({ data: rows.rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  })
);

// PATCH /api/moderation/professors/:id
router.patch(
  '/professors/:id',
  validate(z.object({
    first_name:     z.string().min(1).max(100).optional(),
    last_name:      z.string().min(1).max(100).optional(),
    title:          z.string().max(50).optional(),
    email:          z.string().email().optional().nullable(),
    institution_id: z.number().int().positive().optional(),
    department_id:  z.number().int().positive().optional().nullable(),
  })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid professor ID' }); return; }

    const fields = req.body as Record<string, unknown>;
    const allowed = ['first_name', 'last_name', 'title', 'email', 'institution_id', 'department_id'];
    const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    const setClauses = updates.map(([k], i) => `${k} = $${i + 1}`).join(', ');
    const values = updates.map(([, v]) => v);

    const { rows: [prof] } = await pool.query(
      `UPDATE professors SET ${setClauses}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING id, first_name, last_name, title, email`,
      [...values, id]
    );

    if (!prof) { res.status(404).json({ error: 'Professor not found' }); return; }

    await logAction(req.user!.id, 'edit_professor', 'professor', id, undefined, { fields: Object.fromEntries(updates) });
    res.json({ data: prof, message: 'Professor updated.' });
  })
);

// DELETE /api/moderation/professors/:id  (admin only)
router.delete(
  '/professors/:id',
  requireRole('admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid professor ID' }); return; }

    const { rows: [prof] } = await pool.query(
      `DELETE FROM professors WHERE id = $1 RETURNING id, first_name, last_name`,
      [id]
    );

    if (!prof) { res.status(404).json({ error: 'Professor not found' }); return; }

    await logAction(req.user!.id, 'delete_professor', 'professor', id);
    res.json({ message: `Professor ${prof.first_name} ${prof.last_name} deleted.` });
  })
);

// GET /api/moderation/logs   (audit trail)
router.get(
  '/logs',
  requireRole('admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { page, limit, offset } = paginate(req.query);

    const [countResult, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM moderation_logs`),
      pool.query(
        `SELECT ml.id, ml.action, ml.entity_type, ml.entity_id,
                ml.reason, ml.metadata, ml.created_at,
                s.username AS moderator_username
         FROM moderation_logs ml
         LEFT JOIN students s ON s.id = ml.moderator_id
         ORDER BY ml.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: rows.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  })
);

export default router;
