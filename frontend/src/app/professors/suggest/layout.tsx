import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Suggest a Professor — MyUniReviews',
  description: "Can't find your professor? Submit a suggestion and our team will verify and add them to the directory.",
};

export default function SuggestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
