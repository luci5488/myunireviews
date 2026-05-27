import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';
import { authenticate, requireRole, requireVerified, optionalAuth } from '../middleware/auth';
import { validate, asyncHandler, paginate } from '../middleware/validate';
import { AuthRequest } from '../types';
import { parseId, escapeLike } from '../lib/parseId';
import { verifySuggestionAsync } from '../services/professorVerification';

const router = Router();

// In-process cache for platform stats (rarely changes)
let statsCache: { data: unknown | null; expiresAt: number } = { data: null, expiresAt: 0 };
const STATS_TTL_MS = 60_000; // 1 minute

const PROFESSOR_TITLES = [
  'Professor', 'Associate Professor', 'Assistant Professor',
  'Lecturer', 'Senior Lecturer', 'Adjunct Professor',
  'Tutor', 'Teaching Assistant', 'Industry Fellow',
] as const;

const suggestSchema = z.object({
  institution_id: z.number().int().positive(),
  department_id: z.number().int().positive().optional(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  title: z.enum(PROFESSOR_TITLES).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(500).optional(),
});

const createSchema = z.object({
  institution_id: z.number().int().positive(),
  department_id: z.number().int().positive().optional(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  title: z.enum([
    'Professor', 'Associate Professor', 'Assistant Professor',
    'Lecturer', 'Senior Lecturer', 'Adjunct Professor',
    'Tutor', 'Teaching Assistant', 'Industry Fellow',
  ]).optional(),
  email: z.string().email().optional(),
  bio: z.string().max(2000).optional(),
  course_ids: z.array(z.number().int().positive()).optional(),
});

// GET /api/professors?institution_id=&department_id=&search=&sort=rating|name|reviews
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { institution_id, department_id, search, sort, course_id } = req.query as Record<string, string>;
    const { page, limit, offset } = paginate(req.query);

    const conditions: string[] = ['p.is_active = TRUE'];
    const params: unknown[] = [];

    if (institution_id) {
      const instId = parseId(institution_id);
      if (!instId) { res.status(400).json({ error: 'Invalid institution_id' }); return; }
      params.push(instId);
      conditions.push(`p.institution_id = $${params.length}`);
    }
    if (department_id) {
      const deptId = parseId(department_id);
      if (!deptId) { res.status(400).json({ error: 'Invalid department_id' }); return; }
      params.push(deptId);
      conditions.push(`p.department_id = $${params.length}`);
    }
    if (course_id) {
      const crsId = parseId(course_id);
      if (!crsId) { res.status(400).json({ error: 'Invalid course_id' }); return; }
      params.push(crsId);
      conditions.push(`EXISTS (SELECT 1 FROM professor_courses pc WHERE pc.professor_id = p.id AND pc.course_id = $${params.length})`);
    }
    if (search) {
      params.push(`%${escapeLike(String(search).slice(0, 255))}%`);
      // Match first name, last name, or full "first last" concatenation so "John Smith" works
      conditions.push(
        `(p.first_name ILIKE $${params.length} ESCAPE '\\'` +
        ` OR p.last_name ILIKE $${params.length} ESCAPE '\\'` +
        ` OR (p.first_name || ' ' || p.last_name) ILIKE $${params.length} ESCAPE '\\')`
      );
    }

    const orderMap: Record<string, string> = {
      rating: 'ps.avg_overall_rating DESC NULLS LAST',
      reviews: 'ps.total_reviews DESC NULLS LAST',
      name: 'p.last_name, p.first_name',
    };
    const orderBy = orderMap[sort] ?? orderMap.name;
    const where = conditions.join(' AND ');

    const [countResult, rows] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM professors p WHERE ${where}`,
        params
      ),
      pool.query(
        `SELECT
           p.id, p.first_name, p.last_name, p.title,
           p.is_verified, p.profile_photo_url,
           d.name  AS department_name,
           i.name  AS institution_name,
           ps.total_reviews,
           ps.avg_overall_rating,
           ps.avg_difficulty,
           ps.pct_would_take_again
         FROM professors p
         LEFT JOIN departments d  ON d.id = p.department_id
         LEFT JOIN institutions i ON i.id = p.institution_id
         LEFT JOIN professor_summary ps ON ps.professor_id = p.id
         WHERE ${where}
         ORDER BY ${orderBy}
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

// GET /api/professors/stats  — platform-wide totals for homepage strip
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!statsCache.data || Date.now() > statsCache.expiresAt) {
      const { rows: [row] } = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM professors WHERE is_active = TRUE)    AS total_professors,
           (SELECT COUNT(*) FROM reviews    WHERE status = 'approved') AS total_reviews,
           (SELECT COUNT(*) FROM institutions)                          AS total_institutions`
      );
      statsCache.data = {
        total_professors:  Number(row.total_professors),
        total_reviews:     Number(row.total_reviews),
        total_institutions: Number(row.total_institutions),
      };
      statsCache.expiresAt = Date.now() + STATS_TTL_MS;
    }
    res.json({ data: statsCache.data });
  })
);

// GET /api/professors/:id
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profId = parseId(req.params.id);
    if (!profId) { res.status(400).json({ error: 'Invalid professor ID' }); return; }

    const queries: Promise<{ rows: Record<string, unknown>[] }>[] = [
      pool.query(
        `SELECT
           p.id, p.first_name, p.last_name, p.title, p.bio, p.office_hours,
           p.welcome_message, p.profile_photo_url, p.is_verified, p.is_active,
           p.department_id, p.institution_id, p.created_at, p.updated_at,
           d.name  AS department_name,
           i.name  AS institution_name,
           i.allowed_semesters,
           ps.total_reviews,
           ps.avg_overall_rating,
           ps.weighted_avg_rating,
           ps.avg_difficulty,
           ps.pct_would_take_again,
           ps.five_star, ps.four_star, ps.three_star, ps.two_star, ps.one_star,
           (
             SELECT json_agg(json_build_object('id', c.id, 'code', c.code, 'name', c.name))
             FROM professor_courses pc
             JOIN courses c ON c.id = pc.course_id
             WHERE pc.professor_id = p.id
           ) AS courses
         FROM professors p
         LEFT JOIN departments d  ON d.id = p.department_id
         LEFT JOIN institutions i ON i.id = p.institution_id
         LEFT JOIN professor_summary ps ON ps.professor_id = p.id
         WHERE p.id = $1 AND p.is_active = TRUE`,
        [profId]
      ),
      pool.query(
        `SELECT criterion, avg_score, score_count
         FROM professor_criteria_averages
         WHERE professor_id = $1`,
        [profId]
      ),
      pool.query(
        `SELECT tag, is_positive, tag_count
         FROM professor_top_tags
         WHERE professor_id = $1
         LIMIT 10`,
        [profId]
      ),
    ];

    if (req.user) {
      queries.push(
        pool.query(
          `SELECT 1 FROM professor_claims
           WHERE professor_id = $1 AND claimant_id = $2 AND status = 'approved'
           LIMIT 1`,
          [profId, req.user.id]
        )
      );
    }

    const results = await Promise.all(queries);
    const [profResult, criteriaResult, tagsResult, claimResult] = results;

    if (!profResult.rows[0]) {
      res.status(404).json({ error: 'Professor not found' });
      return;
    }

    res.json({
      data: {
        ...profResult.rows[0],
        criteria_averages: criteriaResult.rows,
        top_tags: tagsResult.rows,
        viewer_has_claim: claimResult ? claimResult.rows.length > 0 : false,
      },
    });
  })
);

// PATCH /api/professors/:id/profile  — claimed professor updates their own profile
router.patch(
  '/:id/profile',
  authenticate,
  requireVerified,
  validate(z.object({
    bio:             z.string().max(2000).nullable().optional(),
    office_hours:    z.string().max(500).nullable().optional(),
    welcome_message: z.string().max(500).nullable().optional(),
  })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profId = parseId(req.params.id);
    if (!profId) { res.status(400).json({ error: 'Invalid professor ID' }); return; }
    // Verify the authenticated user has an approved claim on this professor
    const { rows: [claim] } = await pool.query(
      `SELECT 1 FROM professor_claims
       WHERE professor_id = $1 AND claimant_id = $2 AND status = 'approved'`,
      [profId, req.user!.id]
    );

    if (!claim) {
      res.status(403).json({ error: 'You do not have a verified claim on this profile.' });
      return;
    }

    const { bio, office_hours, welcome_message } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (bio !== undefined)             { params.push(bio);             sets.push(`bio = $${params.length}`); }
    if (office_hours !== undefined)    { params.push(office_hours);    sets.push(`office_hours = $${params.length}`); }
    if (welcome_message !== undefined) { params.push(welcome_message); sets.push(`welcome_message = $${params.length}`); }

    if (!sets.length) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(profId);
    const { rows: [prof] } = await pool.query(
      `UPDATE professors SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, bio, office_hours, welcome_message`,
      params
    );

    res.json({ data: prof });
  })
);

// GET /api/professors/:id/similar  — up to 4 professors from the same department
router.get(
  '/:id/similar',
  asyncHandler(async (req: Request, res: Response) => {
    const profId = parseId(req.params.id);
    if (!profId) { res.status(400).json({ error: 'Invalid professor ID' }); return; }

    const { rows: [prof] } = await pool.query(
      `SELECT department_id, institution_id FROM professors WHERE id = $1 AND is_active = TRUE`,
      [profId]
    );
    if (!prof) { res.json({ data: [] }); return; }

    const { rows } = await pool.query(
      `SELECT
         p.id, p.first_name, p.last_name, p.title,
         p.is_verified, p.profile_photo_url,
         d.name AS department_name,
         i.name AS institution_name,
         ps.total_reviews, ps.avg_overall_rating,
         ps.avg_difficulty, ps.pct_would_take_again
       FROM professors p
       LEFT JOIN departments d ON d.id = p.department_id
       LEFT JOIN institutions i ON i.id = p.institution_id
       LEFT JOIN professor_summary ps ON ps.professor_id = p.id
       WHERE p.is_active = TRUE
         AND p.id != $1
         AND (
           ($2::int IS NOT NULL AND p.department_id = $2)
           OR p.institution_id = $3
         )
       ORDER BY
         CASE WHEN p.department_id = $2 THEN 0 ELSE 1 END,
         ps.avg_overall_rating DESC NULLS LAST
       LIMIT 4`,
      [profId, prof.department_id ?? null, prof.institution_id]
    );

    res.json({ data: rows });
  })
);

// GET /api/professors/:id/reviews
// GET /api/professors/:id/my-review  — authenticated user's own review for this professor
router.get(
  '/:id/my-review',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profId = parseId(req.params.id);
    if (!profId) { res.status(400).json({ error: 'Invalid professor ID' }); return; }
    const { rows: [review] } = await pool.query(
      `SELECT id, status, overall_rating, difficulty_rating, would_take_again,
              comment, is_anonymous, rejection_reason, created_at, updated_at
       FROM reviews
       WHERE professor_id = $1 AND student_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [profId, req.user!.id]
    );
    res.json({ data: review ?? null });
  })
);

router.get(
  '/:id/reviews',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profId = parseId(req.params.id);
    if (!profId) { res.status(400).json({ error: 'Invalid professor ID' }); return; }
    const { sort, cursor: cursorParam } = req.query as Record<string, string>;
    const limit = Math.min(parseInt(req.query.limit as string || '10', 10) || 10, 50);

    // Decode opaque cursor (base64-encoded offset integer); cap to prevent table-scan DoS
    const offset = Math.min(
      cursorParam ? parseInt(Buffer.from(cursorParam, 'base64').toString(), 10) || 0 : 0,
      50_000
    );

    const orderMap: Record<string, string> = {
      newest:  'r.created_at DESC, r.id DESC',
      oldest:  'r.created_at ASC,  r.id ASC',
      highest: 'r.overall_rating DESC, r.created_at DESC',
      lowest:  'r.overall_rating ASC,  r.created_at DESC',
      helpful: 'helpful_votes DESC, r.created_at DESC',
    };
    const orderBy = orderMap[sort] ?? orderMap.newest;

    const rawSearch = req.query.search as string | undefined;
    const search = rawSearch ? String(rawSearch).slice(0, 255) : undefined;
    const rating = req.query.rating as string | undefined;
    const yearParam = req.query.year as string | undefined;
    const semesterParam = req.query.semester as string | undefined;
    const baseParams: unknown[] = [profId];
    let searchClause = '';
    if (search) {
      baseParams.push(`%${escapeLike(search)}%`);
      searchClause = `AND r.comment ILIKE $${baseParams.length} ESCAPE '\\'`;
    }
    let ratingClause = '';
    if (rating) {
      const ratingNum = parseInt(rating, 10);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        res.status(400).json({ error: 'Rating must be an integer between 1 and 5' }); return;
      }
      baseParams.push(ratingNum);
      ratingClause = `AND r.overall_rating = $${baseParams.length}`;
    }
    let yearClause = '';
    if (yearParam) {
      const yearNum = parseInt(yearParam, 10);
      if (!isNaN(yearNum) && yearNum >= 1950 && yearNum <= 2100) {
        baseParams.push(yearNum);
        yearClause = `AND r.year = $${baseParams.length}`;
      }
    }
    let semesterClause = '';
    if (semesterParam) {
      baseParams.push(semesterParam);
      semesterClause = `AND r.semester = $${baseParams.length}`;
    }
    const tagParam = req.query.tag as string | undefined;
    let tagClause = '';
    if (tagParam) {
      baseParams.push(tagParam);
      tagClause = `AND EXISTS (SELECT 1 FROM review_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.review_id = r.id AND t.name = $${baseParams.length})`;
    }

    const currentUserId = req.user?.id ?? null;

    const [countResult, rows] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM reviews r
         WHERE r.professor_id = $1 AND r.status = 'approved' ${searchClause} ${ratingClause} ${yearClause} ${semesterClause} ${tagClause}`,
        baseParams
      ),
      pool.query(
        `SELECT
           r.id, r.overall_rating, r.difficulty_rating, r.would_take_again,
           r.comment, r.semester, r.year, r.is_anonymous, r.created_at, r.updated_at, r.is_edited,
           CASE WHEN r.is_anonymous THEN NULL ELSE r.student_id END AS student_id,
           CASE WHEN r.is_anonymous THEN NULL ELSE s.username END AS reviewer,
           CASE WHEN r.is_anonymous THEN FALSE ELSE s.is_verified_student END AS is_verified_student,
           CASE WHEN $${baseParams.length + 1}::integer IS NOT NULL AND r.student_id = $${baseParams.length + 1}::integer THEN TRUE ELSE FALSE END AS is_own,
           c.code  AS course_code,
           c.name  AS course_name,
           r.course_text,
           (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.vote = 'helpful')     AS helpful_votes,
           (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.vote = 'not_helpful') AS not_helpful_votes,
           (
             SELECT json_agg(json_build_object('criterion', rc.name, 'score', rcs.score))
             FROM review_criterion_scores rcs
             JOIN rating_criteria rc ON rc.id = rcs.criteria_id
             WHERE rcs.review_id = r.id
           ) AS criterion_scores,
           (
             SELECT json_agg(t.name)
             FROM review_tags rt
             JOIN tags t ON t.id = rt.tag_id
             WHERE rt.review_id = r.id
           ) AS tags,
           rr.content    AS professor_reply,
           rr.updated_at AS professor_reply_at
         FROM reviews r
         LEFT JOIN students s  ON s.id = r.student_id
         LEFT JOIN courses c ON c.id = r.course_id
         LEFT JOIN review_responses rr ON rr.review_id = r.id AND rr.professor_id = r.professor_id
         WHERE r.professor_id = $1
           AND r.status = 'approved' ${searchClause} ${ratingClause} ${yearClause} ${semesterClause} ${tagClause}
         ORDER BY ${orderBy}
         LIMIT $${baseParams.length + 2} OFFSET $${baseParams.length + 3}`,
        [...baseParams, currentUserId, limit + 1, offset]  // fetch one extra to detect has_more
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    const fetched = rows.rows;
    const has_more = fetched.length > limit;
    const data = has_more ? fetched.slice(0, limit) : fetched;
    const nextOffset = offset + limit;
    const next_cursor = has_more
      ? Buffer.from(String(nextOffset)).toString('base64')
      : null;

    res.json({
      data,
      has_more,
      next_cursor,
      pagination: { total, page: Math.floor(offset / limit) + 1, limit, totalPages: Math.ceil(total / limit) },
    });
  })
);

const claimSchema = z.object({
  institution_email: z.string().email().optional(),
  staff_id: z.string().max(50).optional(),
  additional_info: z.string().max(1000).optional(),
}).refine(
  (d) => d.institution_email || d.staff_id,
  { message: 'Provide at least an institutional email or staff ID as verification.' }
);

// POST /api/professors/:id/claim   (authenticated — professor claiming their own profile)
router.post(
  '/:id/claim',
  authenticate,
  requireVerified,
  validate(claimSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profId = parseId(req.params.id);
    if (!profId) { res.status(400).json({ error: 'Invalid professor ID' }); return; }
    const { rows: [prof] } = await pool.query(
      `SELECT id, is_verified FROM professors WHERE id = $1`,
      [profId]
    );

    if (!prof) {
      res.status(404).json({ error: 'Professor not found' });
      return;
    }
    if (prof.is_verified) {
      res.status(409).json({ error: 'This profile is already verified.' });
      return;
    }

    const { institution_email, staff_id, additional_info } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO professor_claims
         (professor_id, claimant_id, institution_email, staff_id, additional_info)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (professor_id, claimant_id) DO UPDATE
         SET institution_email = EXCLUDED.institution_email,
             staff_id          = EXCLUDED.staff_id,
             additional_info   = EXCLUDED.additional_info,
             status            = 'pending',
             created_at        = NOW()
       RETURNING id, status, created_at`,
      [profId, req.user!.id, institution_email ?? null, staff_id ?? null, additional_info ?? null]
    );

    res.status(201).json({
      data: rows[0],
      message: 'Claim submitted. Our team will verify your identity within 3–5 business days.',
    });
  })
);

// POST /api/professors/suggest   (authenticated students)
router.post(
  '/suggest',
  authenticate,
  requireVerified,
  validate(suggestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { institution_id, department_id, first_name, last_name, title, email, notes } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO professor_suggestions
         (suggested_by, institution_id, department_id, first_name, last_name, title, email, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, status, created_at`,
      [req.user!.id, institution_id, department_id ?? null, first_name, last_name,
       title ?? null, email ?? null, notes ?? null]
    );

    const suggestion = rows[0];

    // Fire-and-forget: attempt auto-verification in the background.
    // If the professor is found in OpenAlex/ORCID the suggestion will be
    // auto-approved without moderator involvement.
    verifySuggestionAsync({
      id:             suggestion.id,
      first_name,
      last_name,
      title:          title ?? null,
      email:          email ?? null,
      institution_id,
      department_id:  department_id ?? null,
      suggested_by:   req.user!.id,
    });

    res.status(201).json({
      data: suggestion,
      message: 'Suggestion submitted — we\'ll verify it automatically. If we can\'t confirm it online, our team will review it shortly.',
    });
  })
);

// POST /api/professors   (admin only)
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validate(createSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { institution_id, department_id, first_name, last_name, title, email, bio, course_ids } =
      req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO professors (institution_id, department_id, first_name, last_name, title, email, bio)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, institution_id, department_id, first_name, last_name, title, email,
                   profile_photo_url, bio, is_verified, is_active, created_at, updated_at`,
        [institution_id, department_id ?? null, first_name, last_name,
         title ?? 'Professor', email ?? null, bio ?? null]
      );
      const professor = rows[0];

      if (course_ids?.length) {
        for (const course_id of course_ids) {
          await client.query(
            `INSERT INTO professor_courses (professor_id, course_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [professor.id, course_id]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ data: professor });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// PATCH /api/professors/:id/reviews/:reviewId/reply  — claimed professor upserts a reply
router.patch(
  '/:id/reviews/:reviewId/reply',
  authenticate,
  requireVerified,
  validate(z.object({ reply: z.string().min(1).max(1000) })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profId = parseId(req.params.id);
    if (!profId) { res.status(400).json({ error: 'Invalid professor ID' }); return; }
    const reviewId = parseId(req.params.reviewId);
    if (!reviewId) { res.status(400).json({ error: 'Invalid review ID' }); return; }

    // Must have an approved claim on this professor
    const { rows: [claim] } = await pool.query(
      `SELECT 1 FROM professor_claims WHERE professor_id = $1 AND claimant_id = $2 AND status = 'approved'`,
      [profId, req.user!.id]
    );
    if (!claim) { res.status(403).json({ error: 'You do not have a verified claim on this profile.' }); return; }

    // Verify the review actually belongs to this professor (prevents IDOR cross-professor reply)
    const { rows: [reviewCheck] } = await pool.query(
      `SELECT 1 FROM reviews WHERE id = $1 AND professor_id = $2 AND status = 'approved'`,
      [reviewId, profId]
    );
    if (!reviewCheck) { res.status(404).json({ error: 'Review not found' }); return; }

    const { reply } = req.body as { reply: string };
    await pool.query(
      `INSERT INTO review_responses (review_id, professor_id, claimant_id, content)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (review_id, professor_id)
       DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
      [reviewId, profId, req.user!.id, reply]
    );
    res.json({ message: 'Reply saved' });
  })
);

// DELETE /api/professors/:id/reviews/:reviewId/reply  — remove professor reply
router.delete(
  '/:id/reviews/:reviewId/reply',
  authenticate,
  requireVerified,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profId = parseId(req.params.id);
    if (!profId) { res.status(400).json({ error: 'Invalid professor ID' }); return; }
    const reviewId = parseId(req.params.reviewId);
    if (!reviewId) { res.status(400).json({ error: 'Invalid review ID' }); return; }

    const { rows: [claim] } = await pool.query(
      `SELECT 1 FROM professor_claims WHERE professor_id = $1 AND claimant_id = $2 AND status = 'approved'`,
      [profId, req.user!.id]
    );
    if (!claim) { res.status(403).json({ error: 'You do not have a verified claim on this profile.' }); return; }

    // Verify the review actually belongs to this professor before deleting the reply
    const { rows: [review] } = await pool.query(
      `SELECT 1 FROM reviews WHERE id = $1 AND professor_id = $2 AND status = 'approved'`,
      [reviewId, profId]
    );
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }

    await pool.query(
      `DELETE FROM review_responses WHERE review_id = $1 AND professor_id = $2`,
      [reviewId, profId]
    );
    res.json({ message: 'Reply removed' });
  })
);

export default router;
