import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../config/db';
import { authenticate, requireVerified } from '../middleware/auth';
import { validate, asyncHandler } from '../middleware/validate';
import { containsProfanity } from '../lib/profanityFilter';
import { parseId } from '../lib/parseId';
import { AuthRequest } from '../types';
import { addClient, removeClient, getIpConnectionCount, MAX_CONNECTIONS_PER_IP } from '../lib/reviewEvents';

const anthropic = new Anthropic();

const writeLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tight limiter for the SSE endpoint — limits new connection attempts per IP
const sseLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: { error: 'Too many event-stream connections. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Vote limiter — prevents helpfulness score manipulation
const voteLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60,
  message: { error: 'Too many votes. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Report limiter — prevents moderation queue spam
const reportLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many reports submitted. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// In-process caches for quasi-static data — each has its own expiresAt so refreshing one doesn't extend the others
const META_TTL_MS = 5 * 60_000; // 5 minutes
let criteriaCache:      { data: unknown[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
let tagsCache:          { data: unknown[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
let reportReasonsCache: { data: unknown[] | null; expiresAt: number } = { data: null, expiresAt: 0 };

let topReviewsCache: { data: unknown[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
const TOP_REVIEWS_TTL_MS = 2 * 60_000; // 2 minutes

const semesterValues = [
  'Spring', 'Summer', 'Fall', 'Winter',
  'Semester 1', 'Semester 2', 'Trimester 1', 'Trimester 2', 'Trimester 3',
] as const;

const createReviewSchema = z.object({
  professor_id: z.number().int().positive(),
  course_id: z.number().int().positive().optional(),
  // Free-text course fallback — must look like a real course code.
  // Requires: starts with 2+ letters, contains at least one digit (e.g. COMP1511, INFO 1110).
  course_text: z.string()
    .min(3, 'Course code must be at least 3 characters.')
    .max(10, 'Course code must be 10 characters or less.')
    .regex(
      /^[A-Za-z]{2,}[A-Za-z0-9 \-\/]*[0-9][A-Za-z0-9 \-\/]*$/,
      'Course code must start with letters and include a number (e.g. COMP1511, MATH2069).'
    )
    .optional(),
  semester: z.enum(semesterValues),
  year: z.number().int().min(1950).max(2100),
  // overall_rating is now computed by the backend from criterion_scores.
  // The frontend may omit it; any client-supplied value is ignored.
  overall_rating: z.number().int().min(1).max(5).optional(),
  difficulty_rating: z.number().int().min(1).max(5).optional(),
  would_take_again: z.boolean().optional(),
  comment: z.string().min(15).max(3000).optional(),
  is_anonymous: z.boolean().default(true),
  criterion_scores: z
    .array(z.object({ criteria_id: z.number().int().positive(), score: z.number().int().min(1).max(5) }))
    .min(1, 'Rate at least one category to submit your review.')
    .max(10)
    .optional(),
  tag_ids: z.array(z.number().int().positive()).max(6).optional(),
}).refine(
  (d) => !!(d.course_id || d.course_text?.trim()),
  { message: 'Please select or enter a course.', path: ['course_id'] }
);

const updateReviewSchema = z.object({
  difficulty_rating: z.number().int().min(1).max(5).optional(),
  would_take_again: z.boolean().optional(),
  comment: z.string().min(15).max(3000).optional(),
  is_anonymous: z.boolean().optional(),
  semester: z.enum(semesterValues).optional(),
  year: z.number().int().min(1950).max(2100).optional(),
}).strict(); // reject any unrecognised fields

const reportSchema = z.object({
  reason_id: z.number().int().positive().optional(),
  additional_info: z.string().max(1000).optional(),
});

// GET /api/reviews/meta/report-reasons
router.get(
  '/meta/report-reasons',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!reportReasonsCache.data || Date.now() > reportReasonsCache.expiresAt) {
      const { rows } = await pool.query(
        `SELECT id, name, description FROM report_reasons WHERE is_active = TRUE ORDER BY id`
      );
      reportReasonsCache.data = rows;
      reportReasonsCache.expiresAt = Date.now() + META_TTL_MS;
    }
    res.json({ data: reportReasonsCache.data });
  })
);

// GET /api/reviews/meta/criteria
router.get(
  '/meta/criteria',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!criteriaCache.data || Date.now() > criteriaCache.expiresAt) {
      const { rows } = await pool.query(
        `SELECT id, name, description FROM rating_criteria WHERE is_active = TRUE ORDER BY sort_order`
      );
      criteriaCache.data = rows;
      criteriaCache.expiresAt = Date.now() + META_TTL_MS;
    }
    res.json({ data: criteriaCache.data });
  })
);

// GET /api/reviews/meta/tags
router.get(
  '/meta/tags',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!tagsCache.data || Date.now() > tagsCache.expiresAt) {
      const { rows } = await pool.query(
        `SELECT id, name, is_positive FROM tags WHERE is_active = TRUE ORDER BY is_positive DESC, name`
      );
      tagsCache.data = rows;
      tagsCache.expiresAt = Date.now() + META_TTL_MS;
    }
    res.json({ data: tagsCache.data });
  })
);

// GET /api/reviews/top  — top reviews per institution grouped for the featured page
router.get(
  '/top',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!topReviewsCache.data || Date.now() > topReviewsCache.expiresAt) {
      const { rows } = await pool.query(
        `SELECT
           r.id, r.overall_rating, r.comment, r.is_anonymous, r.created_at,
           CASE WHEN r.is_anonymous THEN NULL ELSE s.username END AS reviewer,
           p.first_name AS professor_first_name,
           p.last_name  AS professor_last_name,
           p.title      AS professor_title,
           p.id         AS professor_id,
           i.id         AS institution_id,
           i.name       AS institution_name,
           COALESCE(v.helpful_votes, 0) AS helpful_votes
         FROM reviews r
         LEFT JOIN students s   ON s.id = r.student_id
         JOIN professors p ON p.id = r.professor_id
         JOIN institutions i ON i.id = p.institution_id
         LEFT JOIN (
           SELECT review_id, COUNT(*) AS helpful_votes
           FROM review_votes
           WHERE vote = 'helpful'
           GROUP BY review_id
         ) v ON v.review_id = r.id
         WHERE r.status = 'approved' AND r.comment IS NOT NULL AND length(r.comment) >= 15
         ORDER BY helpful_votes DESC, r.overall_rating DESC, r.created_at DESC
         LIMIT 60`
      );
      topReviewsCache.data = rows;
      topReviewsCache.expiresAt = Date.now() + TOP_REVIEWS_TTL_MS;
    }
    res.json({ data: topReviewsCache.data });
  })
);

// POST /api/reviews/analyze  — AI-powered review quality check
router.post(
  '/analyze',
  authenticate,
  requireVerified,
  validate(z.object({ comment: z.string().min(1).max(3000) })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { comment } = req.body as { comment: string };
    if (!comment || comment.trim().length < 15) {
      res.json({ score: 100, feedback: null });
      return;
    }

    // Profanity check runs before the AI call — no point asking Claude to
    // assess quality when the review will be blocked at submission anyway.
    if (containsProfanity(comment)) {
      res.json({
        score: 0,
        feedback: 'Your review contains inappropriate language. Please remove any profanity before submitting.',
      });
      return;
    }

    // Check if ANTHROPIC_API_KEY is set
    if (!process.env.ANTHROPIC_API_KEY) {
      res.json({ score: 100, feedback: null });
      return;
    }

    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `You are a review quality checker for a university professor rating platform. Assess this student review and return JSON only.

Review: "${comment.trim()}"

Return JSON with these fields:
- score: integer 0-100 (100 = excellent, 0 = very low quality)
- feedback: string | null (one sentence of constructive advice if score < 70, else null)

A good review: specific about teaching style, gives actionable detail, mentions course context, is respectful.
A poor review: too vague ("good prof"), purely personal ("I hated him"), extremely short (no substance).

JSON only, no other text.`,
        }],
      });

      const text = (message.content[0] as { type: string; text: string }).text.trim();
      const parsed = JSON.parse(text);
      res.json({ score: parsed.score ?? 100, feedback: parsed.feedback ?? null });
    } catch {
      // Don't block submission if AI call fails
      res.json({ score: 100, feedback: null });
    }
  })
);

// GET /api/reviews/events?professor_id=X  — SSE stream for real-time review updates
router.get('/events', sseLimit, (req: Request, res: Response) => {
  const professorId = Number(req.query.professor_id);
  if (!professorId) { res.status(400).json({ error: 'professor_id required' }); return; }

  // Enforce a per-IP concurrent connection cap to prevent connection exhaustion
  const ip = req.ip ?? 'unknown';
  if (getIpConnectionCount(ip) >= MAX_CONNECTIONS_PER_IP) {
    res.status(429).json({ error: 'Too many concurrent event-stream connections from your IP.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Heartbeat every 25 s to keep the connection alive through proxies
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* ignore */ } }, 25_000);

  addClient(professorId, res, ip);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(professorId, res, ip);
  });
});

// GET /api/reviews/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid review ID' }); return; }

    const { rows } = await pool.query(
      `SELECT
         r.id, r.overall_rating, r.difficulty_rating, r.would_take_again,
         r.comment, r.semester, r.year, r.is_anonymous, r.status, r.created_at,
         CASE WHEN r.is_anonymous THEN NULL ELSE s.username END AS reviewer,
         p.first_name  AS professor_first_name,
         p.last_name   AS professor_last_name,
         c.code        AS course_code,
         c.name        AS course_name,
         r.course_text,
         (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.vote = 'helpful')      AS helpful_votes,
         (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.vote = 'not_helpful')  AS not_helpful_votes,
         (
           SELECT json_agg(json_build_object('criterion', rc.name, 'score', rcs.score))
           FROM review_criterion_scores rcs
           JOIN rating_criteria rc ON rc.id = rcs.criteria_id
           WHERE rcs.review_id = r.id
         ) AS criterion_scores,
         (SELECT json_agg(t.name) FROM review_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.review_id = r.id) AS tags
       FROM reviews r
       LEFT JOIN students s   ON s.id = r.student_id
       JOIN professors p ON p.id = r.professor_id
       LEFT JOIN courses c ON c.id = r.course_id
       WHERE r.id = $1 AND r.status = 'approved'`,
      [id]
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    res.json({ data: rows[0] });
  })
);

// POST /api/reviews   (authenticated, verified students only)
router.post(
  '/',
  writeLimit,
  authenticate,
  requireVerified,
  validate(createReviewSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const studentId = req.user!.id;

    // Per-user rate limit: max 5 review submissions per hour
    const { rows: [rateRow] } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM reviews WHERE student_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [studentId]
    );
    if (parseInt(rateRow.cnt) >= 5) {
      res.status(429).json({ error: 'You can submit at most 5 reviews per hour. Please try again later.' });
      return;
    }

    // Block duplicate reviews while one is pending or already approved
    const { rows: [existing] } = await pool.query(
      `SELECT id, status FROM reviews
       WHERE student_id = $1 AND professor_id = $2 AND status IN ('pending','approved')
       LIMIT 1`,
      [studentId, req.body.professor_id]
    );
    if (existing) {
      const msg = existing.status === 'pending'
        ? 'You already have a review pending moderation for this professor.'
        : 'You have already reviewed this professor.';
      res.status(409).json({ error: msg });
      return;
    }

    const {
      professor_id, course_id, course_text, semester, year,
      difficulty_rating, would_take_again,
      comment, is_anonymous, criterion_scores, tag_ids,
    } = req.body;

    // Compute overall rating server-side from category scores.
    // This prevents any client-side tampering and ensures the rating
    // is always a genuine reflection of the per-category scores.
    if (!criterion_scores?.length) {
      res.status(400).json({ error: 'Rate at least one category to submit your review.' });
      return;
    }
    const rawAvg = criterion_scores.reduce(
      (sum: number, c: { score: number }) => sum + c.score, 0
    ) / criterion_scores.length;
    const overall_rating = Math.round(rawAvg);   // stored as integer 1–5

    if (comment && containsProfanity(comment)) {
      res.status(400).json({ error: 'Your review contains inappropriate language. Please revise it before submitting.' });
      return;
    }
    if (course_text && containsProfanity(course_text)) {
      res.status(400).json({ error: 'The course code contains inappropriate language.' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO reviews
           (student_id, professor_id, course_id, course_text, semester, year,
            overall_rating, difficulty_rating, would_take_again,
            comment, is_anonymous)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, status, created_at`,
        [
          studentId, professor_id,
          course_id ?? null,
          // course_text only stored when no course_id is provided
          !course_id && course_text ? course_text.trim() : null,
          semester ?? null, year ?? null,
          overall_rating, difficulty_rating ?? null, would_take_again ?? null,
          comment ?? null, is_anonymous,
        ]
      );
      const review = rows[0];

      // Bulk-insert per-criterion scores (single query via unnest)
      if (criterion_scores?.length) {
        await client.query(
          `INSERT INTO review_criterion_scores (review_id, criteria_id, score)
           SELECT $1, unnest($2::int[]), unnest($3::int[])`,
          [
            review.id,
            criterion_scores.map((c: { criteria_id: number; score: number }) => c.criteria_id),
            criterion_scores.map((c: { criteria_id: number; score: number }) => c.score),
          ]
        );
      }

      // Bulk-attach tags (single query via unnest)
      if (tag_ids?.length) {
        await client.query(
          `INSERT INTO review_tags (review_id, tag_id)
           SELECT $1, unnest($2::int[])
           ON CONFLICT DO NOTHING`,
          [review.id, tag_ids]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        data: review,
        message: 'Review submitted and is pending moderation.',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// PUT /api/reviews/:id   (edit own review)
router.put(
  '/:id',
  authenticate,
  requireVerified,
  validate(updateReviewSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid review ID' }); return; }

    const { rows: [existing] } = await pool.query(
      `SELECT student_id, status FROM reviews WHERE id = $1`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    if (existing.student_id !== req.user!.id) {
      res.status(403).json({ error: 'Cannot edit another user\'s review' });
      return;
    }
    if (existing.status === 'rejected') {
      res.status(409).json({ error: 'Rejected reviews cannot be edited' });
      return;
    }

    if (req.body.comment && containsProfanity(req.body.comment)) {
      res.status(400).json({ error: 'Your review contains inappropriate language. Please revise it before submitting.' });
      return;
    }

    // Build partial update from provided fields
    const allowed = ['difficulty_rating', 'would_take_again', 'comment', 'is_anonymous', 'semester', 'year'];
    const sets: string[] = [];
    const params: unknown[] = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        params.push(req.body[field]);
        sets.push(`${field} = $${params.length}`);
      }
    }

    if (!sets.length) {
      res.status(400).json({ error: 'No updatable fields provided' });
      return;
    }

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE reviews
       SET ${sets.join(', ')},
           updated_at = NOW(),
           is_edited  = TRUE,
           status     = CASE WHEN status = 'approved' THEN 'pending' ELSE status END
       WHERE id = $${params.length}
       RETURNING id, status, updated_at, is_edited`,
      params
    );

    res.json({ data: rows[0] });
  })
);

// DELETE /api/reviews/:id   (own review only)
router.delete(
  '/:id',
  authenticate,
  requireVerified,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid review ID' }); return; }

    const { rows: [existing] } = await pool.query(
      `SELECT student_id FROM reviews WHERE id = $1`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    const isMod = ['moderator', 'admin'].includes(req.user!.role);
    if (existing.student_id !== req.user!.id && !isMod) {
      res.status(403).json({ error: 'Cannot delete another user\'s review' });
      return;
    }

    await pool.query(`DELETE FROM reviews WHERE id = $1`, [id]);
    res.json({ message: 'Review deleted' });
  })
);

// POST /api/reviews/:id/vote
router.post(
  '/:id/vote',
  voteLimit,
  authenticate,
  requireVerified,
  validate(z.object({ vote: z.enum(['helpful', 'not_helpful']) })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const reviewId = parseId(req.params.id);
    if (!reviewId) { res.status(400).json({ error: 'Invalid review ID' }); return; }
    const studentId = req.user!.id;

    // Students cannot vote on their own reviews
    const { rows: [review] } = await pool.query(
      `SELECT student_id, status FROM reviews WHERE id = $1`,
      [reviewId]
    );
    if (!review || review.status !== 'approved') {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    if (review.student_id === studentId) {
      res.status(400).json({ error: 'Cannot vote on your own review' });
      return;
    }

    const client = await pool.connect();
    let action: 'added' | 'removed' | 'switched';
    let counts: { helpful_votes: string; not_helpful_votes: string };
    try {
      await client.query('BEGIN');

      const { rows: [existingVote] } = await client.query(
        `SELECT vote FROM review_votes WHERE review_id = $1 AND student_id = $2 FOR UPDATE`,
        [reviewId, studentId]
      );

      if (existingVote && existingVote.vote === req.body.vote) {
        await client.query(
          `DELETE FROM review_votes WHERE review_id = $1 AND student_id = $2`,
          [reviewId, studentId]
        );
        action = 'removed';
      } else {
        await client.query(
          `INSERT INTO review_votes (review_id, student_id, vote)
           VALUES ($1,$2,$3)
           ON CONFLICT (review_id, student_id) DO UPDATE SET vote = EXCLUDED.vote`,
          [reviewId, studentId, req.body.vote]
        );
        action = existingVote ? 'switched' : 'added';
      }

      const { rows: [c] } = await client.query(
        `SELECT
           (SELECT COUNT(*) FROM review_votes WHERE review_id = $1 AND vote = 'helpful')     AS helpful_votes,
           (SELECT COUNT(*) FROM review_votes WHERE review_id = $1 AND vote = 'not_helpful') AS not_helpful_votes`,
        [reviewId]
      );
      counts = c;

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({
      message: 'Vote recorded',
      action,
      helpful_votes: Number(counts.helpful_votes),
      not_helpful_votes: Number(counts.not_helpful_votes),
    });
  })
);

// POST /api/reviews/:id/report
router.post(
  '/:id/report',
  reportLimit,
  authenticate,
  requireVerified,
  validate(reportSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid review ID' }); return; }

    const { rows: [review] } = await pool.query(
      `SELECT student_id, status FROM reviews WHERE id = $1`,
      [id]
    );

    if (!review || review.status === 'rejected') {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    if (review.student_id === req.user!.id) {
      res.status(400).json({ error: 'Cannot report your own review' });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO review_reports (review_id, reported_by, reason_id, additional_info)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (review_id, reported_by) DO UPDATE
         SET reason_id = EXCLUDED.reason_id,
             additional_info = EXCLUDED.additional_info,
             created_at = NOW()
       RETURNING id, status, created_at`,
      [id, req.user!.id, req.body.reason_id ?? null, req.body.additional_info ?? null]
    );

    res.status(201).json({
      data: rows[0],
      message: 'Report submitted. Our moderation team will review it.',
    });
  })
);

export default router;
