import { Router, Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../middleware/validate';
import { parseId } from '../lib/parseId';

const router = Router();

// GET /api/departments/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const deptId = parseId(req.params.id);
    if (!deptId) return res.status(400).json({ error: 'Invalid department ID' });

    const result = await pool.query(
      `SELECT d.id, d.name, d.code, d.institution_id,
              i.name AS institution_name,
              COUNT(DISTINCT p.id) FILTER (WHERE p.is_active) AS professor_count
       FROM departments d
       JOIN institutions i ON i.id = d.institution_id
       LEFT JOIN professors p ON p.department_id = d.id
       WHERE d.id = $1
       GROUP BY d.id, i.name`,
      [deptId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found' });

    const dept = result.rows[0];
    res.json({ data: { ...dept, professor_count: Number(dept.professor_count) } });
  })
);

export default router;
