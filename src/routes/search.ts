import { Router, Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../middleware/validate';
import { escapeLike } from '../lib/parseId';

const router = Router();

// GET /api/search?q=&type=all|professors|courses|institutions
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string)?.trim();
    const type = (req.query.type as string) ?? 'all';

    if (!q || q.length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters.' });
      return;
    }

    const like = `%${escapeLike(q)}%`;
    const results: Record<string, unknown[]> = {};

    const queries: Promise<void>[] = [];

    if (type === 'all' || type === 'professors') {
      queries.push(
        pool
          .query(
            `SELECT
               p.id, p.first_name, p.last_name, p.title, p.is_verified,
               d.name  AS department_name,
               i.name  AS institution_name,
               ps.total_reviews,
               ps.avg_overall_rating
             FROM professors p
             LEFT JOIN departments d  ON d.id = p.department_id
             LEFT JOIN institutions i ON i.id = p.institution_id
             LEFT JOIN professor_summary ps ON ps.professor_id = p.id
             WHERE p.is_active = TRUE
               AND (p.first_name ILIKE $1
                    OR p.last_name ILIKE $1
                    OR (p.first_name || ' ' || p.last_name) ILIKE $1)
             ORDER BY ps.total_reviews DESC NULLS LAST
             LIMIT 10`,
            [like]
          )
          .then(({ rows }) => { results.professors = rows; })
      );
    }

    if (type === 'all' || type === 'courses') {
      queries.push(
        pool
          .query(
            `SELECT c.id, c.code, c.name, c.credits,
                    d.name AS department_name,
                    i.name AS institution_name
             FROM courses c
             LEFT JOIN departments d  ON d.id = c.department_id
             LEFT JOIN institutions i ON i.id = c.institution_id
             WHERE c.name ILIKE $1 OR c.code ILIKE $1
             LIMIT 10`,
            [like]
          )
          .then(({ rows }) => { results.courses = rows; })
      );
    }

    if (type === 'all' || type === 'institutions') {
      queries.push(
        pool
          .query(
            `SELECT id, name, short_name, country, city
             FROM institutions
             WHERE is_active = TRUE
               AND (name ILIKE $1 OR short_name ILIKE $1)
             LIMIT 5`,
            [like]
          )
          .then(({ rows }) => { results.institutions = rows; })
      );
    }

    await Promise.all(queries);

    res.json({ data: results, query: q });
  })
);

export default router;
