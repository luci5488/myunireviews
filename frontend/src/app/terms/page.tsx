export default function TermsOfServicePage() {
  const updated = '19 April 2026';

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-10">Last updated: {updated}</p>

      <div className="space-y-8 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">1. Acceptance</h2>
          <p>By creating an account and using MyUniReviews, you agree to these Terms of Service. If you do not agree, do not use the platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">2. Eligibility</h2>
          <p>You must be a current or former student at an Australian university with a valid institutional email address (.edu.au) to create an account.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">3. Review guidelines</h2>
          <p>All reviews must:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Be based on your genuine, first-hand experience</li>
            <li>Focus on the academic experience — teaching style, workload, communication, and course structure</li>
            <li>Be respectful and constructive</li>
            <li>Not contain personal attacks, harassment, hate speech, or discriminatory language</li>
            <li>Not include a professor's personal contact details, home address, or private information</li>
            <li>Not be defamatory or knowingly false</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">4. Prohibited conduct</h2>
          <p>You must not:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Create multiple accounts or submit reviews on behalf of others</li>
            <li>Attempt to manipulate ratings through coordinated voting</li>
            <li>Submit reviews for professors you have not personally been taught by</li>
            <li>Use the platform to harass, threaten, or harm any individual</li>
            <li>Attempt to reverse-engineer or scrape the platform</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">5. Moderation</h2>
          <p>All reviews are subject to moderation before publication. We reserve the right to reject or remove any review that violates these terms, without notice. Accounts that repeatedly violate these terms may be suspended.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">6. Defamation and Australian law</h2>
          <p>You are solely responsible for the content of your reviews. Reviews that are false and damaging to a person's reputation may constitute defamation under Australian law. We will cooperate with lawful requests from authorities and may disclose your identity if legally required.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">7. Intellectual property</h2>
          <p>By submitting a review, you grant MyUniReviews a non-exclusive, royalty-free licence to display, store, and moderate your content on the platform. You retain ownership of your content.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">8. Disclaimer</h2>
          <p>MyUniReviews is an independent platform and is not affiliated with any university. Reviews represent the opinions of individual students and do not reflect the views of any institution. We make no warranties about the accuracy or completeness of any review.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">9. Limitation of liability</h2>
          <p>To the extent permitted by Australian law, MyUniReviews is not liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">10. Governing law</h2>
          <p>These terms are governed by the laws of New South Wales, Australia. Any disputes will be subject to the exclusive jurisdiction of the courts of New South Wales.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">11. Changes</h2>
          <p>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance.</p>
        </section>

      </div>
    </div>
  );
}
