'use client';

import { useQuery } from '@tanstack/react-query';
import { professors as profApi } from '@/lib/api';
import { ProfessorCard } from './ProfessorCard';

interface Props {
  professorId: number;
}

export function SimilarProfessors({ professorId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['similar-professors', professorId],
    queryFn: () => profApi.similar(professorId),
    staleTime: 5 * 60_000,
  });

  const profs = data?.data ?? [];

  if (isLoading) {
    return (
      <section className="mt-10">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
          Professors from the same institution
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (!profs.length) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
        Professors from the same institution
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {profs.map((p) => (
          <ProfessorCard key={p.id} professor={p} />
        ))}
      </div>
    </section>
  );
}
