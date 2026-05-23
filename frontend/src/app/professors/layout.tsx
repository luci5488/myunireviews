import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Professors — MyUniReviews',
  description: 'Search and browse professor ratings from Australian universities. Filter by institution, sort by rating, and find the right lecturer for your course.',
};

export default function ProfessorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
