import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <p className="text-8xl font-bold text-gray-100 dark:text-gray-800 select-none mb-2">404</p>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page not found</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="flex gap-3">
        <Link
          href="/professors"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          Browse professors
        </Link>
        <Link
          href="/"
          className="border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium px-6 py-2.5 rounded-xl transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
