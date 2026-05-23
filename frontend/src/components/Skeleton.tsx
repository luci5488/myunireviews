function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-100 dark:bg-gray-700 rounded ${className}`} />;
}

export function ProfessorCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-start gap-3">
        <Bone className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2 pt-1">
          <Bone className="h-4 w-3/4" />
          <Bone className="h-3 w-1/2" />
          <Bone className="h-3 w-2/3" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Bone className="h-5 w-1/4" />
        <Bone className="h-3 w-16" />
      </div>
      <Bone className="mt-3 h-1.5 w-full rounded-full" />
    </div>
  );
}

export function ReviewCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <Bone className="h-4 w-1/3" />
          <Bone className="h-3 w-1/4" />
        </div>
        <div className="space-y-2 flex-shrink-0">
          <Bone className="h-3 w-24" />
          <Bone className="h-3 w-16" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-3/4" />
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-3">
        <Bone className="h-8 w-16 rounded-md" />
        <Bone className="h-8 w-16 rounded-md" />
      </div>
    </div>
  );
}

export function ProfessorProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Bone className="w-16 h-16 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2.5">
            <Bone className="h-7 w-64" />
            <Bone className="h-4 w-48" />
            <Bone className="h-3 w-full max-w-sm" />
            <Bone className="h-3 w-3/4 max-w-xs" />
          </div>
          <Bone className="h-10 w-32 rounded-xl flex-shrink-0" />
        </div>
      </div>

      {/* Ratings breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Bone className="h-20 rounded-xl" />
          <Bone className="h-20 rounded-xl" />
          <Bone className="h-20 rounded-xl" />
        </div>
        <div className="space-y-2.5">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <Bone className="h-3 w-6 flex-shrink-0" />
              <Bone className="h-2.5 flex-1 rounded-full" />
              <Bone className="h-3 w-8 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Review skeletons */}
      <div className="space-y-4">
        {[0, 1, 2].map((i) => <ReviewCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

export function CourseProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-3">
        <Bone className="h-6 w-48" />
        <Bone className="h-4 w-72" />
        <Bone className="h-3 w-40" />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <Bone className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-1/3" />
                <Bone className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
