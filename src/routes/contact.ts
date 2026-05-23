import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate, asyncHandler } from '../middleware/validate';
import { optionalAuth } from '../middleware/auth';
import { AuthRequest } from '../types';
import { sendSupportEmail } from '../lib/mailer';

const router = Router();

const CATEGORIES = [
  'General question',
  'Bug report',
  'Account issue',
  'Content issue',
  'Other',
] as const;

const contactSchema = z.object({
  name:     z.string().min(1).max(100).trim(),
  email:    z.string().email().max(254),
  category: z.enum(CATEGORIES),
  subject:  z.string().min(3).max(150).trim(),
  message:  z.string().min(10).max(3000).trim(),
});

// POST /api/contact
router.post(
  '/',
  optionalAuth,
  validate(contactSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, email, category, subject, message } = req.body as z.infer<typeof contactSchema>;

    await sendSupportEmail({ fromName: name, fromEmail: email, category, subject, message });

    res.json({ message: 'Your message has been sent. We\'ll be in touch soon.' });
  })
);

export default router;
