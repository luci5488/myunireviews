import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare Professors — MyUniReviews',
  description: 'Compare two professors side by side — overall ratings, difficulty, would-take-again percentage, star distribution, and category breakdowns.',
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
