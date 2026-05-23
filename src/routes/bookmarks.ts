import { Router, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';
import { authenticate } from '../middleware/auth';
import { validate, asyncHandler } from '../middleware/validate';
import { parseId } from '../lib/parseId';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/bookmarks  — list user's bookmarked professors
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows } = await pool.query(
      `SELECT
         b.id AS bookmark_id,
         b.created_at AS bookmarked_at,
         p.id, p.first_name, p.last_name, p.title, p.is_verified, p.profile_photo_url,
         d.name  AS department_name,
         i.name  AS institution_name,
         ps.total_reviews, ps.avg_overall_rating, ps.avg_difficulty, ps.pct_would_take_again
       FROM bookmarks b
       JOIN professors p ON p.id = b.professor_id
       LEFT JOIN departments d  ON d.id = p.department_id
       LEFT JOIN institutions i ON i.id = p.institution_id
       LEFT JOIN professor_summary ps ON ps.professor_id = p.id
       WHERE b.student_id = $1
       ORDER BY b.created_at DESC
       LIMIT 200`,
      [req.user!.id]
    );
    res.json({ data: rows });
  })
);

// POST /api/bookmarks
router.post(
  '/',
  authenticate,
  validate(z.object({ professor_id: z.number().int().positive() })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { professor_id } = req.body;
    await pool.query(
      `INSERT INTO bookmarks (student_id, professor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user!.id, professor_id]
    );
    res.status(201).json({ message: 'Bookmarked' });
  })
);

// DELETE /api/bookmarks/:professor_id
router.delete(
  '/:professor_id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profId = parseId(req.params.professor_id);
    if (!profId) { res.status(400).json({ error: 'Invalid professor ID' }); return; }

    await pool.query(
      `DELETE FROM bookmarks WHERE student_id = $1 AND professor_id = $2`,
      [req.user!.id, profId]
    );
    res.json({ message: 'Bookmark removed' });
  })
);

// GET /api/bookmarks/check/:professor_id  — is this professor bookmarked?
router.get(
  '/check/:professor_id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profId = parseId(req.params.professor_id);
    if (!profId) { res.status(400).json({ error: 'Invalid professor ID' }); return; }

    const { rows: [row] } = await pool.query(
      `SELECT 1 FROM bookmarks WHERE student_id = $1 AND professor_id = $2`,
      [req.user!.id, profId]
    );
    res.json({ bookmarked: !!row });
  })
);

export default router;
