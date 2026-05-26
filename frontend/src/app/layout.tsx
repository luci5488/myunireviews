import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';
import { Navbar } from '@/components/Navbar';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { VerificationPromptModal } from '@/components/VerificationPromptModal';
import { LoginPromptModal } from '@/components/LoginPromptModal';
import Link from 'next/link';
import { CookieBanner } from '@/components/CookieBanner';
import { BackToTop } from '@/components/BackToTop';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-playfair',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://myunireviews.com'),
  title: 'MyUniReviews — Find the right professor for your course',
  description: 'Transparent, student-driven professor ratings based on real course experiences.',
  verification: {
    google: 'MziaMR4shvl1yvfMyntOaO7zx0T-tMRKlUKbgm49z70',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <Navbar />
          <EmailVerificationBanner />
          <VerificationPromptModal />
          <LoginPromptModal />
          <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">{children}</main>
          <CookieBanner />
          <BackToTop />
          <footer className="border-t border-gray-100 dark:border-gray-800 mt-16 py-6 text-center text-xs text-gray-400 dark:text-gray-500 space-x-4 bg-white dark:bg-gray-900">
            <Link href="/faq" className="hover:text-gray-600 dark:hover:text-gray-300">FAQ</Link>
            <Link href="/guidelines" className="hover:text-gray-600 dark:hover:text-gray-300">Community Guidelines</Link>
            <Link href="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600 dark:hover:text-gray-300">Terms of Service</Link>
            <span>© {new Date().getFullYear()} MyUniReviews</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
