import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';
import { validate, asyncHandler, paginate } from '../middleware/validate';
import { parseId, escapeLike } from '../lib/parseId';

const router = Router();

const listQuerySchema = z.object({
  search: z.string().optional(),
  country: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// GET /api/institutions
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { search, country } = req.query as Record<string, string>;
    const { page, limit, offset } = paginate(req.query);

    const conditions: string[] = ['is_active = TRUE'];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${escapeLike(search)}%`);
      conditions.push(`(name ILIKE $${params.length} ESCAPE '\\' OR short_name ILIKE $${params.length} ESCAPE '\\')`);
    }
    if (country) {
      params.push(country);
      conditions.push(`country = $${params.length}`);
    }

    const where = conditions.join(' AND ');

    const [countResult, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM institutions WHERE ${where}`, params),
      pool.query(
        `SELECT id, name, short_name, country, state_province, city, website, logo_url, email_domain, allowed_semesters
         FROM institutions WHERE ${where}
         ORDER BY name
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

// GET /api/institutions/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid institution ID' }); return; }

    const { rows } = await pool.query(
      `SELECT i.id, i.name, i.short_name, i.country, i.state_province, i.city,
              i.website, i.logo_url, i.email_domain, i.allowed_semesters,
              i.is_active, i.created_at,
              json_agg(
                json_build_object('id', d.id, 'name', d.name, 'code', d.code)
                ORDER BY d.name
              ) FILTER (WHERE d.id IS NOT NULL) AS departments
       FROM institutions i
       LEFT JOIN departments d ON d.institution_id = i.id
       WHERE i.id = $1
       GROUP BY i.id, i.name, i.short_name, i.country, i.state_province, i.city,
                i.website, i.logo_url, i.email_domain, i.allowed_semesters,
                i.is_active, i.created_at`,
      [id]
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'Institution not found' });
      return;
    }
    res.json({ data: rows[0] });
  })
);

// GET /api/institutions/:id/courses
router.get(
  '/:id/courses',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid institution ID' }); return; }

    const { page, limit, offset } = paginate(req.query);
    const search = req.query.search as string | undefined;

    const params: unknown[] = [id];
    let searchClause = '';
    if (search) {
      params.push(`%${escapeLike(search)}%`);
      searchClause = `AND (c.name ILIKE $${params.length} OR c.code ILIKE $${params.length})`;
    }

    const [countResult, rows] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM courses c WHERE c.institution_id = $1 ${searchClause}`,
        params
      ),
      pool.query(
        `SELECT c.id, c.code, c.name, c.credits,
                d.name AS department_name
         FROM courses c
         LEFT JOIN departments d ON d.id = c.department_id
         WHERE c.institution_id = $1 ${searchClause}
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

export default router;
