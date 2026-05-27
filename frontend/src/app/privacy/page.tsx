export default function PrivacyPolicyPage() {
  const updated = '26 May 2026';

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-10">Last updated: {updated}</p>

      <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">1. Who we are</h2>
          <p>MyUniReviews ("we", "us", "our") is an independent student-run platform for rating and reviewing university professors in Australia. This policy explains how we handle your personal information in accordance with the <strong>Privacy Act 1988 (Cth)</strong> and the <strong>Australian Privacy Principles (APPs)</strong>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">2. What information we collect</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Your university email address</li>
            <li>Username and password (stored as a secure hash)</li>
            <li>Your institution selection</li>
            <li>Reviews and ratings you submit</li>
            <li>Votes and reports you make</li>
            <li>Your IP address and last login timestamp (for security)</li>
          </ul>
          <p className="mt-2">We only collect information that is reasonably necessary to operate the platform (APP 3).</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">3. How we use your information</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To create and manage your account</li>
            <li>To verify that you are a current university student</li>
            <li>To display your reviews (anonymously if you choose)</li>
            <li>To send you a one-time email verification link</li>
            <li>To moderate content and enforce our community guidelines</li>
            <li>To investigate reports of policy violations</li>
          </ul>
          <p className="mt-2">We will not use your information for any secondary purpose without your consent (APP 6).</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">4. Disclosure of your information</h2>
          <p>We do not sell, rent, or share your personal information with third parties except:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Resend</strong> — our email delivery provider, used solely to send verification emails. Their servers may be located outside Australia (APP 8 disclosure).</li>
            <li>Where required by Australian law or a court order.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">5. Data security</h2>
          <p>We take reasonable steps to protect your personal information from misuse, interference, loss, and unauthorised access (APP 11). Passwords are hashed using bcrypt and are never stored in plain text. All API communication uses HTTPS in production.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">6. Your rights</h2>
          <p>Under the Privacy Act 1988, you have the right to:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Access</strong> the personal information we hold about you (APP 12)</li>
            <li><strong>Correct</strong> inaccurate information (APP 13)</li>
            <li><strong>Delete</strong> your account — available from your dashboard at any time</li>
            <li><strong>Anonymity</strong> — you may submit reviews anonymously (APP 2)</li>
          </ul>
          <p className="mt-2">When you delete your account, your personal details are permanently removed. Your reviews are anonymised and retained to preserve the integrity of the platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">7. Data retention</h2>
          <p>We retain your personal information for as long as your account is active. If you delete your account, personal data is removed immediately. Anonymised review content may be retained indefinitely.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">8. Notifiable data breaches</h2>
          <p>In the event of a data breach that is likely to result in serious harm, we will notify affected individuals and the Office of the Australian Information Commissioner (OAIC) as required under the <strong>Notifiable Data Breaches (NDB) scheme</strong>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">9. Complaints</h2>
          <p>If you believe we have breached the Australian Privacy Principles, you may contact us first at <a href="mailto:privacy@myunireviews.com" className="text-blue-600 hover:underline">privacy@myunireviews.com</a> to resolve the matter. If unsatisfied, you may lodge a complaint with the <strong>Office of the Australian Information Commissioner (OAIC)</strong> at <a href="https://www.oaic.gov.au" className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">oaic.gov.au</a>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">10. Changes to this policy</h2>
          <p>We may update this policy from time to time. Continued use of the platform after changes constitutes acceptance of the updated policy.</p>
        </section>

      </div>
    </div>
  );
}
