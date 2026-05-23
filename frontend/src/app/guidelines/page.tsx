export const metadata = { title: 'Community Guidelines' };

export default function GuidelinesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Community Guidelines</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-10 text-sm">Last updated: April 2026</p>

      <div className="space-y-10 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Our Purpose</h2>
          <p>
            This platform exists to help Australian university students make informed decisions about
            their education. Reviews should reflect genuine first-hand experiences and contribute
            constructively to the academic community. Every professor, tutor, and lecturer listed
            deserves to be treated with basic dignity — even in a critical review.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">What Makes a Good Review</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Based on direct, first-hand experience in a class or tutorial.</li>
            <li>Specific and constructive — describe teaching style, clarity, accessibility, or assessment feedback rather than vague impressions.</li>
            <li>Balanced — acknowledge strengths as well as weaknesses.</li>
            <li>Helpful to future students deciding whether to enrol.</li>
            <li>Written in plain English, clearly and respectfully.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">What Is Not Allowed</h2>

          <div className="space-y-4">
            <div className="border-l-4 border-red-300 dark:border-red-600 pl-4">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Personal attacks</p>
              <p>Do not target a person's appearance, accent, nationality, gender, age, religion, or any other personal characteristic. Critique the teaching, not the person.</p>
            </div>

            <div className="border-l-4 border-red-300 dark:border-red-600 pl-4">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Defamatory statements</p>
              <p>
                Under Australian law (Defamation Act 2005), publishing false statements of fact that
                damage someone's reputation is unlawful. Only state things you know to be true.
                Opinion must be clearly framed as opinion. Reviews that make false factual claims
                will be removed and may be referred to our legal team.
              </p>
            </div>

            <div className="border-l-4 border-red-300 dark:border-red-600 pl-4">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Harassment and threats</p>
              <p>Any content that could constitute harassment, bullying, intimidation, or a threat — whether directed at a staff member or another student — will be removed immediately and may be reported to the relevant university or law enforcement.</p>
            </div>

            <div className="border-l-4 border-red-300 dark:border-red-600 pl-4">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Profanity and offensive language</p>
              <p>Keep language professional. Profanity, slurs, and offensive or discriminatory language of any kind are prohibited.</p>
            </div>

            <div className="border-l-4 border-red-300 dark:border-red-600 pl-4">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Fake or incentivised reviews</p>
              <p>Do not post reviews you did not personally experience. Do not post on behalf of someone else. Do not submit reviews in exchange for any reward or under any pressure. Coordinated campaigns to inflate or damage a rating violate both these guidelines and Australian Consumer Law.</p>
            </div>

            <div className="border-l-4 border-red-300 dark:border-red-600 pl-4">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Private information</p>
              <p>Do not include anyone's personal contact details, home address, personal social media handles, or any other private information not voluntarily made public. This includes your own sensitive information.</p>
            </div>

            <div className="border-l-4 border-red-300 dark:border-red-600 pl-4">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Off-topic content</p>
              <p>Reviews must relate to the academic or teaching experience. Comments about unrelated matters, advertising, or spam will be removed.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Moderation</h2>
          <p className="mb-2">
            All reviews are moderated before publication. Our team may:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Approve a review as submitted.</li>
            <li>Request edits before approval.</li>
            <li>Reject a review that breaches these guidelines.</li>
            <li>Remove a previously approved review if a valid report is upheld.</li>
          </ul>
          <p className="mt-3">
            Repeated or serious violations may result in suspension or permanent ban of your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Reporting a Review</h2>
          <p>
            If you believe a review breaches these guidelines, use the <strong>Report</strong> button
            on the review card. Our moderation team will investigate within a reasonable timeframe.
            Educators who believe a review is defamatory or false may contact us directly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Your Responsibility</h2>
          <p>
            By submitting a review you confirm that it is truthful, based on personal experience,
            and complies with these guidelines. You accept sole responsibility for the content of
            your review. We reserve the right to remove content and take action against accounts
            that violate these guidelines.
          </p>
        </section>

        <section className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-300">
            Questions or concerns?{' '}
            <a href="/contact" className="text-blue-600 hover:underline">
              Contact our moderation team
            </a>
            . For legal matters, refer to our{' '}
            <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
          </p>
        </section>

      </div>
    </div>
  );
}
