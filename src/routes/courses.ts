import { Router, Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler, paginate } from '../middleware/validate';
import { parseId, escapeLike } from '../lib/parseId';

const router = Router();

// GET /api/courses?institution_id=&department_id=&search=
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { institution_id, department_id, search } = req.query as Record<string, string>;
    const { page, limit, offset } = paginate(req.query);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (institution_id) {
      const instId = parseId(institution_id);
      if (!instId) { res.status(400).json({ error: 'Invalid institution_id' }); return; }
      params.push(instId);
      conditions.push(`c.institution_id = $${params.length}`);
    }
    if (department_id) {
      const deptId = parseId(department_id);
      if (!deptId) { res.status(400).json({ error: 'Invalid department_id' }); return; }
      params.push(deptId);
      conditions.push(`c.department_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${escapeLike(search)}%`);
      conditions.push(`(c.name ILIKE $${params.length} OR c.code ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM courses c ${where}`, params),
      pool.query(
        `SELECT c.id, c.code, c.name, c.credits, c.description,
                d.name AS department_name,
                i.name AS institution_name
         FROM courses c
         LEFT JOIN departments d ON d.id = c.department_id
         LEFT JOIN institutions i ON i.id = c.institution_id
         ${where}
         ORDER BY c.code
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

// GET /api/courses/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid course ID' }); return; }

    const { rows } = await pool.query(
      `SELECT c.id, c.code, c.name, c.credits, c.description,
              d.name  AS department_name,
              i.name  AS institution_name,
              json_agg(
                json_build_object(
                  'id', p.id,
                  'first_name', p.first_name,
                  'last_name', p.last_name,
                  'title', p.title,
                  'is_verified', p.is_verified,
                  'department_name', d2.name,
                  'institution_name', i.name,
                  'total_reviews', ps.total_reviews,
                  'avg_overall_rating', ps.avg_overall_rating,
                  'avg_difficulty', ps.avg_difficulty,
                  'pct_would_take_again', ps.pct_would_take_again
                )
              ) FILTER (WHERE p.id IS NOT NULL) AS professors
       FROM courses c
       LEFT JOIN departments d   ON d.id = c.department_id
       LEFT JOIN institutions i  ON i.id = c.institution_id
       LEFT JOIN professor_courses pc ON pc.course_id = c.id
       LEFT JOIN professors p    ON p.id = pc.professor_id
       LEFT JOIN departments d2  ON d2.id = p.department_id
       LEFT JOIN professor_summary ps ON ps.professor_id = p.id
       WHERE c.id = $1
       GROUP BY c.id, d.name, i.name`,
      [id]
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    res.json({ data: rows[0] });
  })
);

export default router;
