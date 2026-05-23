'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { departments as deptApi, professors as profApi } from '@/lib/api';
import { ProfessorCard } from '@/components/ProfessorCard';
import { ProfessorCardSkeleton } from '@/components/Skeleton';
import { Pagination } from '@/components/Pagination';

function DeptHeaderSkeleton() {
  function Bone({ className }: { className: string }) {
    return <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />;
  }
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-8 space-y-3">
        <Bone className="h-8 w-64" />
        <Bone className="h-4 w-40" />
        <Bone className="h-3 w-24" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => <ProfessorCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

export default function DepartmentPage() {
  const { id } = useParams<{ id: string }>();
  const deptId = Number(id);

  const [sort, setSort] = useState<'rating' | 'reviews' | 'name'>('rating');
  const [page, setPage] = useState(1);

  const { data: deptData, isLoading: deptLoading, isError } = useQuery({
    queryKey: ['department', deptId],
    queryFn: () => deptApi.get(deptId),
  });

  const { data: profsData, isLoading: profsLoading } = useQuery({
    queryKey: ['professors', 'dept', deptId, sort, page],
    queryFn: () => profApi.list({ department_id: deptId, sort, page, limit: 12 }),
    enabled: !!deptId,
    placeholderData: (prev) => prev,
  });

  if (deptLoading) return <DeptHeaderSkeleton />;

  if (isError || !deptData?.data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center text-red-600 dark:text-red-400">
        Department not found.
      </div>
    );
  }

  const dept = deptData.data;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                {dept.code ?? dept.name[0]}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{dept.name}</h1>
                <Link
                  href={`/professors?institution=${dept.institution_id}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {dept.institution_name}
                </Link>
              </div>
            </div>
            {dept.code && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full font-mono">
                {dept.code}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{dept.professor_count}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">professor{dept.professor_count !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Professors list */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            All professors
            {profsData && (
              <span className="ml-2 text-sm font-normal text-gray-400">({profsData.pagination.total})</span>
            )}
          </h2>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="rating">Highest Rated</option>
            <option value="reviews">Most Reviewed</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        {profsLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => <ProfessorCardSkeleton key={i} />)}
          </div>
        )}

        {profsData?.data && profsData.data.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-400 text-lg mb-1">No professors listed yet</p>
            <p className="text-gray-400 text-sm">Check back later or browse by institution.</p>
          </div>
        )}

        {profsData?.data && profsData.data.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profsData.data.map((p) => <ProfessorCard key={p.id} professor={p} />)}
            </div>
            <Pagination page={page} totalPages={profsData.pagination.totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
