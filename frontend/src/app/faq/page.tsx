'use client';

import { useState } from 'react';
import Link from 'next/link';

const FAQS = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is MyUniReviews?',
        a: 'MyUniReviews is a student-driven platform where Australian university students can read and write honest reviews about their professors, tutors, and lecturers. Our goal is to help students make informed decisions about their courses and educators.',
      },
      {
        q: 'Is MyUniReviews free to use?',
        a: 'Yes, completely free. Reading reviews requires no account. Writing reviews requires a free account with a verified university email.',
      },
      {
        q: 'Which universities are supported?',
        a: 'We currently support Australian universities. If your university is not listed, you can still create an account — and if a professor you want to review is missing, verified users can suggest them for addition.',
      },
    ],
  },
  {
    category: 'Accounts & Verification',
    items: [
      {
        q: 'Do I need an account to read reviews?',
        a: 'No. Anyone can browse professors and read reviews without signing up. An account is only required to write reviews, vote on reviews, or report content.',
      },
      {
        q: 'Why do I need a university email to register?',
        a: 'We require a university email (ending in .edu.au) to ensure reviews come from real students. This keeps the platform trustworthy and reduces fake or malicious reviews.',
      },
      {
        q: 'I didn\'t receive my verification email. What should I do?',
        a: 'Check your spam or junk folder first. If it\'s not there, log in and use the "Resend verification email" option shown in the banner at the top of the page. If you still have issues, contact us.',
      },
      {
        q: 'Can I change my username or email?',
        a: 'Username and email changes are not currently supported through the app. Contact our support team if you need assistance.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to My Dashboard and scroll to the Danger Zone section at the bottom. You can permanently delete your account there. This action is irreversible and will remove all your personal data in accordance with our Privacy Policy.',
      },
    ],
  },
  {
    category: 'Writing Reviews',
    items: [
      {
        q: 'Who can write a review?',
        a: 'Any registered user with a verified university email can write a review. Unverified accounts have read-only access.',
      },
      {
        q: 'Are reviews anonymous?',
        a: 'By default, reviews are posted anonymously — your username is hidden from other students. You can choose to post publicly by toggling the anonymity option on the review form.',
      },
      {
        q: 'How long does it take for a review to appear?',
        a: 'All reviews go through a moderation process before being published. This typically takes a short period. You\'ll be able to see approved reviews on the professor\'s profile.',
      },
      {
        q: 'Can I edit or delete my review after submitting?',
        a: 'Review editing is not currently available after submission. If you need a review removed, please contact our moderation team.',
      },
      {
        q: 'What is the minimum length for a written review?',
        a: 'Written comments must be at least 20 characters. There is no strict minimum for star ratings — you can submit a rating without a written comment, though we encourage you to share your experience in detail.',
      },
      {
        q: 'Why was my review rejected?',
        a: 'Reviews may be rejected if they contain profanity, personal attacks, defamatory statements, or violate our Community Guidelines. You\'ll need to submit a new review that complies with our guidelines.',
      },
    ],
  },
  {
    category: 'Ratings & Rankings',
    items: [
      {
        q: 'How is the overall rating calculated?',
        a: 'The overall rating is the average of all approved overall star ratings submitted for a professor. The rating updates automatically as new reviews are approved.',
      },
      {
        q: 'What does "Would take again" mean?',
        a: 'When writing a review, students can indicate whether they would take a class with that professor again. The percentage shown on a profile reflects how many reviewers said yes.',
      },
      {
        q: 'What is the difficulty rating?',
        a: 'Difficulty is rated on a scale of 1 (Very Easy) to 5 (Very Hard). It reflects the workload and academic challenge of the professor\'s course, not a judgement of quality.',
      },
    ],
  },
  {
    category: 'Professors & Content',
    items: [
      {
        q: 'A professor I want to review is not listed. What can I do?',
        a: 'Verified users can suggest new professors using the "+ Add a Professor" button on the Browse page. Our moderation team will review the suggestion and add them if approved.',
      },
      {
        q: 'Can a professor remove their profile or reviews?',
        a: 'Professors cannot unilaterally remove their profiles or individual reviews. However, if a review is factually incorrect or defamatory, it can be reported and reviewed by our moderation team. Professors can claim and verify their profile to manage their public information.',
      },
      {
        q: 'How do I report an inappropriate review?',
        a: 'Click the "⚑ Report" button on any review card. Select the reason that best describes the issue and optionally add additional context. Our moderation team will investigate.',
      },
      {
        q: 'What happens after I report a review?',
        a: 'Our team will review the report and take appropriate action — this may include dismissing the report, editing the review, or removing it entirely. We aim to handle reports promptly.',
      },
    ],
  },
  {
    category: 'Privacy & Safety',
    items: [
      {
        q: 'Is my personal information safe?',
        a: 'We take privacy seriously and comply with the Australian Privacy Act 1988. We do not sell your data. For full details, read our Privacy Policy.',
      },
      {
        q: 'Who can see my email address?',
        a: 'Your email address is never shown publicly. It is only used for account verification and, if needed, moderation purposes.',
      },
      {
        q: 'Can my university see my reviews?',
        a: 'No. Anonymous reviews are completely unlinkable to your identity on the platform. Even non-anonymous reviews only show your username, not your email or real name.',
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{q}</span>
        <span className={`flex-shrink-0 text-blue-500 text-lg transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && (
        <p className="pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Frequently Asked Questions</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-10">Everything you need to know about using MyUniReviews.</p>

      <div className="space-y-10">
        {FAQS.map((section) => (
          <section key={section.category}>
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3">
              {section.category}
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm px-5">
              {section.items.map((item) => (
                <FAQItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-6 text-center border border-blue-100 dark:border-blue-800/50">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Still have questions?</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Our team is happy to help.</p>
        <Link
          href="/contact"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}
