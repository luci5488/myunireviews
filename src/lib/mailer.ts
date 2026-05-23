import { Resend } from 'resend';
import logger from './logger';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3001';
const MAIL_FROM = process.env.MAIL_FROM ?? 'noreply@myunireviews.com';

// Shared client — instantiated once so the underlying HTTP connection is reused
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/** Escape HTML entities so user-controlled strings are safe inside email templates. */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendSuggestionApprovedEmail(
  email: string,
  professorName: string,
  professorId: number
): Promise<void> {
  const url = `${FRONTEND_URL}/professors/${professorId}`;

  if (!process.env.RESEND_API_KEY) {
    logger.debug({ email, professorName, url }, '[DEV] Suggestion approved email');
    return;
  }

  if (!resend) return;
  await resend.emails.send({
    from: MAIL_FROM,
    to: email,
    subject: `Your suggested professor is now on MyUniReviews!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Great news! 🎉</h2>
        <p>The professor you suggested — <strong>${esc(professorName)}</strong> — has been reviewed and added to MyUniReviews.</p>
        <p>You can now view their profile and be the first to write a review!</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          View Profile
        </a>
        <p style="color:#6b7280;font-size:13px;margin-top:20px">
          Thanks for helping make MyUniReviews better for Australian students.
        </p>
      </div>
    `,
  });
}

export async function sendUpvoteNotification(email: string, professorName: string, profileUrl: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.debug({ email, profileUrl }, '[DEV] Upvote notification');
    return;
  }
  if (!resend) return;
  await resend.emails.send({
    from: MAIL_FROM,
    to: email,
    subject: 'Someone found your review helpful!',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Your review was upvoted ⭐</h2>
        <p>Another student found your review of <strong>${esc(professorName)}</strong> helpful.</p>
        <a href="${esc(profileUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          View profile
        </a>
        <p style="color:#6b7280;font-size:12px;margin-top:20px">
          <a href="${FRONTEND_URL}/dashboard#notifications" style="color:#6b7280">Manage notification preferences</a>
        </p>
      </div>
    `,
  });
}

export async function sendBookmarkedReviewNotification(email: string, professorName: string, professorId: number): Promise<void> {
  const url = `${FRONTEND_URL}/professors/${professorId}`;
  if (!process.env.RESEND_API_KEY) {
    logger.debug({ email, professorId, url }, '[DEV] Bookmarked review notification');
    return;
  }
  if (!resend) return;
  await resend.emails.send({
    from: MAIL_FROM,
    to: email,
    subject: `New review for ${professorName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">New review posted 📝</h2>
        <p>A new review has been approved for <strong>${esc(professorName)}</strong>, who you've bookmarked.</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          Read the review
        </a>
        <p style="color:#6b7280;font-size:12px;margin-top:20px">
          <a href="${FRONTEND_URL}/dashboard#notifications" style="color:#6b7280">Manage notification preferences</a>
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${FRONTEND_URL}/auth/reset-password/${token}`;

  if (!process.env.RESEND_API_KEY) {
    logger.debug({ email, url }, '[DEV] Password reset link');
    return;
  }

  if (!resend) return;
  await resend.emails.send({
    from: MAIL_FROM,
    to: email,
    subject: 'Reset your MyUniReviews password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Reset your password</h2>
        <p>We received a request to reset your MyUniReviews password. Click the button below — this link expires in 1 hour.</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
      </div>
    `,
  });
}

export async function sendReviewApprovedEmail(
  email: string,
  professorName: string,
  professorId: number
): Promise<void> {
  const url = `${FRONTEND_URL}/professors/${professorId}`;
  if (!process.env.RESEND_API_KEY) {
    logger.debug({ email, professorId, url }, '[DEV] Review approved email');
    return;
  }
  if (!resend) return;
  await resend.emails.send({
    from: MAIL_FROM,
    to: email,
    subject: `Your review of ${professorName} is now live`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Your review is live ✅</h2>
        <p>Your review of <strong>${esc(professorName)}</strong> has been approved by our moderation team and is now publicly visible.</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          View Profile
        </a>
        <p style="color:#6b7280;font-size:13px;margin-top:20px">
          Thank you for helping fellow students make informed decisions.
        </p>
      </div>
    `,
  });
}

export async function sendReviewRejectedEmail(
  email: string,
  professorName: string,
  reason: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.debug({ email, professorName, reason }, '[DEV] Review rejected email');
    return;
  }
  if (!resend) return;
  await resend.emails.send({
    from: MAIL_FROM,
    to: email,
    subject: `Your review of ${professorName} was not approved`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Review not approved</h2>
        <p>Unfortunately, your review of <strong>${esc(professorName)}</strong> did not pass moderation.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:16px 0">
          <p style="margin:0;color:#991b1b;font-size:14px"><strong>Reason:</strong> ${esc(reason)}</p>
        </div>
        <p>You're welcome to submit a new review that complies with our <a href="${FRONTEND_URL}/guidelines" style="color:#2563eb">Community Guidelines</a>.</p>
        <p style="color:#6b7280;font-size:13px;margin-top:20px">
          If you believe this decision was made in error, please contact our support team.
        </p>
      </div>
    `,
  });
}

export async function sendSupportEmail(opts: {
  fromName: string;
  fromEmail: string;
  category: string;
  subject: string;
  message: string;
}): Promise<void> {
  const supportTo = process.env.SUPPORT_EMAIL ?? 'support@myunireviews.com.au';

  if (!process.env.RESEND_API_KEY) {
    logger.debug({ from: opts.fromEmail, category: opts.category, subject: opts.subject }, '[DEV] Support request');
    return;
  }

  if (!resend) return;
  await resend.emails.send({
    from: MAIL_FROM,
    to: supportTo,
    replyTo: `${opts.fromName} <${opts.fromEmail}>`,
    subject: `[Support] [${esc(opts.category)}] ${esc(opts.subject)}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#1e3a5f;margin-bottom:4px">New support request</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
          <tr>
            <td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">From</td>
            <td style="padding:6px 0"><strong>${esc(opts.fromName)}</strong> &lt;${esc(opts.fromEmail)}&gt;</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">Category</td>
            <td style="padding:6px 0">${esc(opts.category)}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">Subject</td>
            <td style="padding:6px 0">${esc(opts.subject)}</td>
          </tr>
        </table>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(opts.message)}</div>
        <p style="color:#9ca3af;font-size:12px;margin-top:16px">
          Reply directly to this email to respond to the user.
        </p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = `${FRONTEND_URL}/auth/verify-email/${token}`;

  if (!process.env.RESEND_API_KEY) {
    logger.debug({ email, url }, '[DEV] Verification email link');
    return;
  }

  if (!resend) return;
  await resend.emails.send({
    from: MAIL_FROM,
    to: email,
    subject: 'Verify your MyUniReviews account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Verify your email</h2>
        <p>Click the button below to verify your MyUniReviews account. This link expires in 24 hours.</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Verify Email
        </a>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">If you didn't create an account, you can ignore this email.</p>
      </div>
    `,
  });
}
